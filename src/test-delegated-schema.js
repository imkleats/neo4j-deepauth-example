const { neo4jgraphql } = require( 'neo4j-graphql-js');
const { applyDeepAuth } = require('neo4j-deepauth');
const { delegateToSchema } = require('apollo-server');
const { astFromValue, valueFromASTUntyped, isInputType, isObjectType, getNamedType, parseValue, isNonNullType, isInputObjectType, isLeafType, valueFromAST, isListType } = require('graphql');

const typeDefs = `
type User {
    uuid: ID!
    name: String!
    dogs: [Dog] @relation(name: "OWNS", direction: "OUT")
    cats: [Cat] @relation(name: "OWNS", direction: "OUT")
  }
  
  type Dog {
    id: ID!
    name: String!
    breed: String!
    owner: User @relation(name: "HAS_OWNER", direction: "IN")
  }
  
  type Cat {
    id: ID!
    name: String!
    breed: String!
    owner: User @relation(name: "HAS_OWNER", direction: "IN")
  }

  interface Node {
      id: ID!
  }
`;

const hiddenTypes = `
${typeDefs}

extend type User @deepAuth(
  path: """{name_contains: "$user_id"}""",
  variables: ["$user_id"]
)

extend type Cat implements Node {
  newBreed: String!
} 

directive @deepAuth(
  path: String
  variables: [String]
) on OBJECT | INTERFACE | FIELD_DEFINITION

extend interface Node @deepAuth(
  path: """{owner: {name_contains: "$user_id"}}""",
  variables: ["$user_id"]
) {
  owner: User
}
`

const resolvers = (hiddenSchema) => ({
  // root entry point to GraphQL service
  Query: {
    Dog(object, params, ctx, resolveInfo) {
      // No deepauth
      const authResolveInfo = applyDeepAuth(params, ctx, {...resolveInfo, schema: hiddenSchema}, [AuthorizationFilterRule])
      return delegateToSchema({
        schema: hiddenSchema,
        operation: 'query',
        fieldName: "Dog",
        args: params,
        context: {...ctx, authResolveInfo},
        info: authResolveInfo
      });
      // const authResolveInfo = applyDeepAuth(params, ctx, resolveInfo);
      // return neo4jgraphql(object, params, ctx, authResolveInfo);
    },
    Cat(object, params, ctx, resolveInfo) {
      // Uses deepauth
      const authResolveInfo = applyDeepAuth(params, ctx, {...resolveInfo, schema: hiddenSchema}, [AuthorizationFilterRule]);
      // console.log(JSON.stringify(translate(params, ctx, { ...resolveInfo, schema: hiddenSchema })));
      return delegateToSchema({
        schema: hiddenSchema,
        operation: 'query',
        fieldName: "Cat",
        args: params,
        context: {...ctx, authResolveInfo},
        info: authResolveInfo
      });
    },
    User(object, params, ctx, resolveInfo) {
      // Uses deepauth
      const authResolveInfo = applyDeepAuth(params, ctx, {...resolveInfo, schema: hiddenSchema}, [AuthorizationFilterRule])
      return delegateToSchema({
        schema: hiddenSchema,
        operation: 'query',
        fieldName: "User",
        args: params,
        context: {...ctx, authResolveInfo},
        info: authResolveInfo
      });
    },
  },
});

const hiddenResolvers = {
  // root entry point to GraphQL service
  Query: {
    Dog(object, params, ctx, resolveInfo) {
      // No deepauth
      return neo4jgraphql(object, params, ctx, resolveInfo);
      // const authResolveInfo = applyDeepAuth(params, ctx, resolveInfo);
      // return neo4jgraphql(object, params, ctx, authResolveInfo);
    },
    Cat(object, params, ctx, resolveInfo) {
      // Uses deepauth
      try {
        return neo4jgraphql(object, params, ctx, resolveInfo);
      } catch (e) {
        console.warn(e);
        return neo4jgraphql(object, params, ctx, resolveInfo);
      }
    },
    User(object, params, ctx, resolveInfo) {
      // Uses deepauth
      try {
        return neo4jgraphql(object, params, ctx, ctx.authResolveInfo);
      } catch (e) {
        console.warn(e);
        return neo4jgraphql(object, params, ctx, resolveInfo);
      }
    },
  },
};

function AuthorizationFilterRule(
  context, // The TranslationContext class we instantiate in translate().
) {
  // Returns an ASTVisitor
  return {
    enter: {
      // The Document visitor establishes necessary parts of the
      Document() {
        context.postToAstMap({ loc: 'authFilters', node: () => context.getAuthActions() });
      },

      // The Field visitor assesses whether each field of a selection
      // set needs an augmented filter argument. This visitor must comply
      // to the following requirements:
      //   1) If `Field`'s type has a @deepAuth directive, it needs a
      //      root authorization filter.
      //   2) If `Field` has an exisiting filter argument, that filter
      //      must be augmented to ensure nested filters are compliant.
      //   3) If (1) and (2), then replace existing filter argument with
      //      wrapped `AND [ (1), (2) ]`. If only (1), then add (1) as
      //      filter argument. If only (2), replace filter argument
      //      with (2).
      //   4) If `Field` has neither @deepAuth directive or existing
      //      filter arguments, no updates to AST are needed.
      Field(
        node,
        key,
        parent,
        path,
        ancestors,
      ) {
        const fieldType = context.getType();
        const innerType = fieldType ? getNamedType(fieldType) : undefined;
        // Currently does not support Interface or Union types.
        // Check for ObjectTypes that can have @deepAuth directive.
        const filterInputType = context.getSchema().getType(`_${innerType?.name}Filter`);
        const authFilter = isObjectType(innerType) ? getDeepAuthFromType(innerType, context) : undefined;
        console.log(JSON.stringify(isObjectType(innerType) && innerType.getInterfaces().map(interfaceType => interfaceType?.extensionASTNodes)));
        console.log(JSON.stringify(authFilter, undefined, 2));
        // Get user-submitted Filter argument & index of that argument in the Field's Arguments array
        const [existingFilter, argIndex] = getExistingFilter(node) ?? [undefined, 0];

        let authAction;
        if (existingFilter && isInputType(filterInputType)) {
          authAction = {
            // At this point, appropriate action is SET. If other directives need to
            // modify the pre-exisiting Filter argument through a TranslationRule,
            // it might be necessary to use a REPLACE action, which has different behavior
            // to accommodate non-colocated translations.
            action: 'SET',
            payload: {
              node: {
                kind: 'Argument',
                name: { kind: 'Name', value: 'filter' },
                // `value` must be type ValueNode.
                value: astFromValue(
                  coerceDeepAuthInputValue(valueFromASTUntyped(existingFilter.value), filterInputType, context),
                  filterInputType,
                ),
              },
              path: [...path, 'arguments', argIndex],
            },
          };
        } else {
          authAction = authFilter
            ? {
                action: 'SET',
                payload: {
                  node: { kind: 'Argument', name: { kind: 'Name', value: 'filter' }, value: authFilter },
                  path: [...path, 'arguments', argIndex],
                },
              }
            : {
                action: 'SKIP',
                payload: {},
              };
        }
        context.addAuthAction(authAction);
        // The @return value of visitor functions elicit special behavior.
        // In most cases, we just want to return undefined.
      },

      // To deal with nested relationship filters, we moved to applying
      // the directive through `coerceDeepAuthInputValue`, modeled from
      // the reference implementation's `coerceInputValue` function.
      // FYI: This function could be generalized to apply directive-based
      // changes to any other kind of GraphQLInputValue too.
    },
  };
}

 function getDeepAuthFromType(type, context) {
    // Currently does not support Union types.
    // Check for presence of @deepAuth directive with following precedence:
    // 1) typeDef extension; 2) original typeDef; 3) Interface
    const authConfig = getDeepAuthFromTypeExtensionAst(type.extensionASTNodes)
    ?? getDeepAuthFromTypeAst(type.astNode) ?? getDeepAuthFromInterfaces(type.getInterfaces());
    return authConfig
      ? parseValue(
          populateArgsInPath(authConfig.path, authConfig.variables, context.fromRequestContext('deepAuthParams')),
        )
      : undefined;
  }
  
  function deepAuthArgumentReducer(acc, arg) {
    switch (arg.name.value) {
      case 'path':
        if (arg.value.kind === 'StringValue') {
          acc.path = arg.value.value;
        }
        break;
      case 'variables':
        const authVariables = [];
        if (arg.value.kind === 'ListValue') {
          arg.value.values.map(varArg => {
            if (varArg.kind === 'StringValue') {
              authVariables.push(varArg.value);
            }
          });
          acc.variables = authVariables;
        }
        break;
    }
    return acc;
  }
  
  
  const findDirective = (name) => (directive) => directive.name.value === name;
  const findExtensionWithDirective = (name, filterFn) => (extension) =>
    extension?.directives?.find(filterFn(name));
  
 function getDeepAuthFromTypeAst(typeDef) {
    return typeDef?.directives
      ?.find(findDirective('deepAuth'))
      ?.arguments?.reduce(deepAuthArgumentReducer, { path: '', variables: [] });
  }
  
function getDeepAuthFromInterfaces(interfaces) {
    const config = interfaces
      ?.find(inter =>  inter?.astNode?.directives?.find(findDirective('deepAuth')))
      ?.astNode?.directives?.find(findDirective('deepAuth'))
      ?.arguments?.reduce(deepAuthArgumentReducer, { path: '', variables: [] })
        ?? interfaces?.find( inter => inter?.extensionASTNodes
          ?.find(findExtensionWithDirective('deepAuth', findDirective)))?.extensionASTNodes
          ?.find(findExtensionWithDirective('deepAuth', findDirective))?.directives?.find(findDirective('deepAuth'))
          ?.arguments?.reduce(deepAuthArgumentReducer, { path: '', variables: [] });
    console.log(JSON.stringify(config, undefined, 2));
    return config;
  }
  
function getDeepAuthFromTypeExtensionAst(extensions) {
    return extensions
          ?.find(findExtensionWithDirective('deepAuth', findDirective))
          ?.directives?.find(findDirective('deepAuth'))
          ?.arguments?.reduce(deepAuthArgumentReducer, { path: '', variables: [] });
  }
  
  function populateArgsInPath(myPath, args, ctxParams){
    const populatedPath = args?.reduce((acc, param) => {
      return acc.replace(param, ctxParams[param]);
    }, myPath);
    return populatedPath;
  }
  function getExistingFilter(fieldNode){
    return fieldNode.arguments
            ?.reduce(
                (accTuple, argNode, argIdx) => {
                  if (accTuple?.[0] === undefined) {
                    // Until a filterArgument is found...
                    if (argNode.name.value === 'filter') {
                      //  Check if argument.value.name is filter
                      return [argNode, argIdx]; //  return the argumentNode if it is, and the actual index.
                    } else {
                      //  Else (argument is not filter && filter has not yet been found)
                      return [undefined, argIdx + 1]; //  Keep undefined node, and set Index at idx+1 in case filter never found.
                    }
                  }
                  return [undefined, accTuple?.[1]]; // If filter has already been found, return the accumulator.
                },
                [undefined, 0],
              );
  }

  function isCollection(obj) {
    if (obj == null || typeof obj !== 'object') {
      return false;
    }
  
    // Is Array like?
    const length = obj.length;
    if (typeof length === 'number' && length >= 0 && length % 1 === 0) {
      return true;
    }
  
    // Is Iterable?
    return typeof obj[typeof Symbol === 'function' ? Symbol.iterator : '@@iterator'] === 'function';
  }
  
  function isObjectLike(value) {
    return typeof value === 'object' && value !== null;
  }
  function isFilterInput(typeName) {
    return typeName.startsWith('_') && typeName.endsWith('Filter');
  }
  function getTypeNameFromFilterName(filterName) {
    return filterName.slice(1, filterName.length - 6);
  }

  function coerceDeepAuthInputValue(inputValue, type, context) {
    return coerceDeepAuthInputValueImpl(inputValue, type, context);
  }
  
  function coerceDeepAuthInputValueImpl(inputValue, type, context) {
    if (isNonNullType(type)) {
      if (inputValue != null) {
        return coerceDeepAuthInputValueImpl(inputValue, type.ofType, context);
      }
      throw Error('expected non-nullable type to not be null');
      return;
    }
  
    if (inputValue == null) {
      // Explicitly return the value null.
      return null;
    }
  
    if (isListType(type)) {
      const itemType = type.ofType;
      if (isCollection(inputValue)) {
        return Array.from(inputValue, (itemValue, index) => {
          return coerceDeepAuthInputValueImpl(itemValue, itemType, context);
        });
      }
      // Lists accept a non-list value as a list of one.
      return [coerceDeepAuthInputValueImpl(inputValue, itemType, context)];
    }
  
    if (isInputObjectType(type)) {
      if (!isObjectLike(inputValue)) {
        throw Error('should be an object');
      }
  
      let coercedValue = {};
      const fieldDefs = type.getFields();
      const parentType = type.name;
  
      for (const field of Object.keys(fieldDefs).map(key => fieldDefs[key])) {
        const fieldValue = inputValue[field.name];
  
        if (fieldValue === undefined) {
          if (field.defaultValue !== undefined) {
            coercedValue[field.name] = field.defaultValue;
          } else if (isNonNullType(field.type)) {
            throw Error('non null type requires a value or a default');
          }
          continue;
        }
  
        coercedValue[field.name] = coerceDeepAuthInputValueImpl(fieldValue, field.type, context);
      }
  
      // Ensure every provided field is defined.
      for (const fieldName of Object.keys(inputValue)) {
        if (!fieldDefs[fieldName]) {
          throw Error('field not defined on input object');
        }
      }
  
      if (isFilterInput(type.name)) {
        const filteredType = context.getSchema().getType(getTypeNameFromFilterName(type.name));
        const deepAuthFilter = filteredType && isObjectType(filteredType) ? getDeepAuthFromType(filteredType, context) : null;
        if (deepAuthFilter) {
          coercedValue = { AND: [valueFromAST(deepAuthFilter, type), coercedValue] };
        }
      }
      return coercedValue;
    }
  
    if (isLeafType(type)) {
      let parseResult;
  
      // Scalars and Enums determine if a input value is valid via parseValue(),
      // which can throw to indicate failure. If it throws, maintain a reference
      // to the original error.
      parseResult = type.parseValue(inputValue);
      return parseResult;
    }
  }

module.exports = { typeDefs, resolvers, hiddenResolvers, hiddenTypes };