const { ApolloServer } = require('apollo-server');
const express = require('express');
const { graphqlHTTP } = require('express-graphql');
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

// Experiencing issues related to ApolloServer
// After N consecutive queries, ApolloServer will hang without an error message.
// This behavior does not occur with Express-GraphQL.
// Until it can be diagnosed, recommend express-graphql or to try your luck with
// a non-Apollo server.

const app = express();

app.use('/', graphqlHTTP((request) => ({
  schema: movieSchema,
  context: {
      driver,
      headers: request.headers,
      deepAuthParams: {
        $user_id: 'Sam Neill', // Dummy user ID (or Actor Name for Movie example)
      },
  },
  graphiql: true
})));

app.listen(process.env.GRAPHQL_LISTEN_PORT || 3000, '0.0.0.0', () => {
    console.log(`GraphQL API ready for business`);
});