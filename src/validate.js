const { coerceInputValue, isInputType, parseValue, valueFromASTUntyped } = require("graphql");

function validateDeepAuth(schema) {
    const typeMap = schema.getTypeMap();
    for (const namedType of Object.keys(typeMap)) {
        // Apply neo4jgraphql naming convention to find filter Input Object type name
        const filterInputTypeName = `_${namedType}Filter`;
        if (typeMap[namedType].astNode && typeMap[namedType].astNode.directives) {
            typeMap[namedType].astNode.directives.filter( directive => directive.name.value === 'deepAuth').map(
                directive => {
                    const pathNode = directive.arguments.filter( arg => arg.name.value === 'path')[0].value;
                    const path = pathNode.kind === 'StringValue' ? `${pathNode.value}` : '';
                    const inputType = schema.getType(filterInputTypeName);
                    if (isInputType(inputType)){
                        coerceInputValue(valueFromASTUntyped(parseValue(path)),  inputType);
                    }
                }
            );
        }
    }
}

module.exports = {validateDeepAuth}