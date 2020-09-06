# neo4j-deepauth-example
Example of using `neo4j-deepauth` for fine-grained access control with `neo4j-graphql-js`.

### Updated for Version: v0.2.0 full release
`npm install neo4j-deepauth`

or

`yarn add neo4j-deepauth`

## Examples

### Movie Recommendations Example

Configured to restrict the Neo4j Sandbox Movie Recommendations dataset to a subgraph closely related to Sam Neill. You could change the actor name, but honestly, why would you?

### Delegated/Proxy Schema Example

Maybe you want to make the documentation for your GraphQL API public, but you don't want to share all those access control implementation details.

### Simple Schema

Just a very vanilla example.