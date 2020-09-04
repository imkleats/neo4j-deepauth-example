const { neo4jgraphql } = require( 'neo4j-graphql-js');
const { applyDeepAuth } = require('neo4j-deepauth');

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
      const authResolveInfo = applyDeepAuth(params, ctx, {...resolveInfo, schema: hiddenSchema});
      try {
        return neo4jgraphql(object, params, ctx, authResolveInfo);
      } catch (e) {
        console.warn(e);
        return neo4jgraphql(object, params, ctx, resolveInfo);
      }
    },
    Cat(object, params, ctx, resolveInfo) {
      // Uses deepauth
      const authResolveInfo = applyDeepAuth(params, ctx, {...resolveInfo, schema: hiddenSchema})
      try {
        return neo4jgraphql(object, params, ctx, authResolveInfo);
      } catch (e) {
        console.warn(e);
        return neo4jgraphql(object, params, ctx, resolveInfo);
      }
    },
    User(object, params, ctx, resolveInfo) {
      // Uses deepauth
      const authResolveInfo = applyDeepAuth(params, ctx, {...resolveInfo, schema: hiddenSchema});
      try {
        return neo4jgraphql(object, params, ctx, authResolveInfo);
      } catch (e) {
        console.warn(e);
        return neo4jgraphql(object, params, ctx, resolveInfo);
      }
    },
  },
});

module.exports = { typeDefs, resolvers, hiddenTypes };