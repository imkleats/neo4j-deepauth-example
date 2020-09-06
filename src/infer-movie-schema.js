// const { gql } = require('apollo-server');
const { inferSchema,  } = require('neo4j-graphql-js');
const neo4j = require('neo4j-driver');

var fs = require('fs')
var logger = fs.createWriteStream('movie-schema.graphql', {
  flags: 'a' // 'a' means appending (old data will be preserved)
});

const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'notneo4j'
  )
);

inferSchema(driver).then( result => {
  console.log("Connected and inferred");
  logger.write(result.typeDefs);
  console.log("completed inference");
}).catch( e => console.error(e));