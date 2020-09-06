const { ApolloServer } = require('apollo-server');
const neo4j  = require('neo4j-driver');
// const { exampleProxiedSchema }  = require('./test-delegated-schema'); // Schema obfuscating Authorization Paths
// const { plainSchema } = require('./test-schema');  // Just a simple schema
const { movieSchema } = require('./test-movie-schema'); // Using the Neo4j Recommendations sandbox dataset

const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'notneo4j'
  )
);

const server = new ApolloServer({
  schema: movieSchema,
  context: ({req}) => ({
      driver,
      headers: req.headers,
      deepAuthParams: {
        $user_id: 'Sam Neill', // Dummy user ID (or Actor Name for Movie example)
      },
  }),
  // By default, the GraphQL Playground interface and GraphQL introspection
  // is disabled in "production" (i.e. when `process.env.NODE_ENV` is `production`).
  //
  // If you'd like to have GraphQL Playground and introspection enabled in production,
  // the `playground` and `introspection` options must be set explicitly to `true`.
  introspection: true,
  graphiql: true,
  playground: {
    // FIXME: Hide in prod?
    endpoint: '/dev/graphql',
  },
});

server
  .listen(process.env.GRAPHQL_LISTEN_PORT || 3000, '0.0.0.0').then(({ url }) => {
    console.log(`GraphQL API ready at ${url}`);
  });