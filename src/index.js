const { makeAugmentedSchema } = require('neo4j-graphql-js');
const { ApolloServer, gql, makeExecutableSchema } = require('apollo-server');
const neo4j  = require('neo4j-driver');
const { typeDefs, resolvers }  = require('./test-schema');
const { validateDeepAuth } = require('./validate');

// Add auto-generated mutations
const schema = makeAugmentedSchema({
    typeDefs,
    resolvers,
  });

const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'notneo4j'
  )
);

try {
  validateDeepAuth(schema);
  console.log("Validated schema");
} catch (e) {
  console.warn("deepAuth arguments do not match schema");
  console.warn(e);
}

const server = new ApolloServer({
    schema,
    context: ({ req }) => {
      return {
        driver,
        headers: req.headers,
        // Pass schema so in some resolvers, we have the ability
        // to call other queries/mutations internally
        schema: schema,
        deepAuthParams: {
          $user_id: '123', // Dummy user ID
        },
      };
    },
    // By default, the GraphQL Playground interface and GraphQL introspection
    // is disabled in "production" (i.e. when `process.env.NODE_ENV` is `production`).
    //
    // If you'd like to have GraphQL Playground and introspection enabled in production,
    // the `playground` and `introspection` options must be set explicitly to `true`.
    introspection: true,
    playground: {
      // FIXME: Hide in prod?
      endpoint: '/dev/graphql',
    },
  });

server
  .listen(process.env.GRAPHQL_LISTEN_PORT || 3000, '0.0.0.0')
  .then(({ url }) => {
    console.log(`GraphQL API ready at ${url}`);
  });