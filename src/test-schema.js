const { neo4jgraphql } = require( 'neo4j-graphql-js');
const { applyDeepAuth } = require('neo4j-deepauth');

const typeDefs = `
type User @deepAuth(
  path: """{name_contains: "$user_id"}""",
  variables: ["$user_id"]
) {
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
  
  type Cat @deepAuth(
    path: """{owner: {name_contains: "$user_id"}}""",
    variables: ["$user_id"]
  ){
    id: ID!
    name: String!
    breed: String!
    owner: User @relation(name: "HAS_OWNER", direction: "IN")
  }
  
directive @deepAuth(
  path: String
  variables: [String]
) on OBJECT | INTERFACE | FIELD_DEFINITION
`;

const resolvers = {
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
        const authResolveInfo = applyDeepAuth(params, ctx, resolveInfo)
        return neo4jgraphql(object, params, ctx, authResolveInfo);
      } catch (e) {
        console.warn(e);
        return neo4jgraphql(object, params, ctx, resolveInfo);
      }
    },
    User(object, params, ctx, resolveInfo) {
      // Uses deepauth
      try {
        const authResolveInfo = applyDeepAuth(params, ctx, resolveInfo)
        return neo4jgraphql(object, params, ctx, authResolveInfo);
      } catch (e) {
        console.warn(e);
        return neo4jgraphql(object, params, ctx, resolveInfo);
      }
    },
  },
};

module.exports = { typeDefs, resolvers };