const { neo4jgraphql } = require( 'neo4j-graphql-js');
const { applyDeepAuth } = require('neo4j-deepauth');
const { delegateToSchema } = require('apollo-server');

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
      const authResolveInfo = applyDeepAuth(params, ctx, {...resolveInfo, schema: hiddenSchema})
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
      const authResolveInfo = applyDeepAuth(params, ctx, {...resolveInfo, schema: hiddenSchema});
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
      const authResolveInfo = applyDeepAuth(params, ctx, {...resolveInfo, schema: hiddenSchema})
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
        return neo4jgraphql(object, params, ctx, resolveInfo).then(
          (result) => {
            // console.log(JSON.stringify(resolveInfo, undefined, 0));
            console.log(JSON.stringify(result));
            console.log(params);
            return result;
          }
        );
      } catch (e) {
        console.warn(e);
        return neo4jgraphql(object, params, ctx, resolveInfo);
      }
    },
    User(object, params, ctx, resolveInfo) {
      // Uses deepauth
      try {
        return neo4jgraphql(object, params, ctx, resolveInfo);
      } catch (e) {
        console.warn(e);
        return neo4jgraphql(object, params, ctx, resolveInfo);
      }
    },
  },
};

module.exports = { typeDefs, resolvers, hiddenTypes, hiddenResolvers };