const { neo4jgraphql, makeAugmentedSchema } = require( 'neo4j-graphql-js');
const { applyDeepAuth } = require('neo4j-deepauth');
const { gql } = require('apollo-server');

const typeDefs = gql`
type Genre {
   _id: Long!
   name: String!
   movies: [Movie] @relation(name: "IN_GENRE", direction: IN)
}

type User {
   _id: Long!
   name: String!
   userId: String!
   ratings: [Movie] @relation(name: "RATED", direction: OUT)
   rated: [RATED]
}

type Director {
   _id: Long!
   bio: String
   born: Date
   bornIn: String
   died: Date
   imdbId: String
   name: String!
   poster: String
   tmdbId: String!
   url: String!
   acted_in: [Movie] @relation(name: "ACTED_IN", direction: OUT)
   directed: [Movie] @relation(name: "DIRECTED", direction: OUT)
}

type Actor {
   _id: Long!
   bio: String
   born: Date
   bornIn: String
   died: Date
   imdbId: String
   name: String!
   poster: String
   tmdbId: String!
   url: String!
   acted_in: [Movie] @relation(name: "ACTED_IN", direction: OUT)
   directed: [Movie] @relation(name: "DIRECTED", direction: OUT)
}

type Movie {
   _id: Long!
   budget: Int
   countries: [String]
   imdbId: String!
   imdbRating: Float
   imdbVotes: Int
   languages: [String]
   movieId: String!
   plot: String
   poster: String
   released: String
   revenue: Int
   runtime: Int
   title: String!
   tmdbId: String
   url: String
   year: Int   
   in_genre: [Genre] @relation(name: "IN_GENRE", direction: "OUT")
   ratings: [RATED]
   actors: [Actor] @relation(name: "ACTED_IN", direction: "IN")
   directors: [Director] @relation(name: "DIRECTED", direction: "IN")
}

type RATED @relation(name: "RATED") {
  from: User!
  to: Movie!
  rating: Float!
  timestamp: Int!
}

extend type User @deepAuth(
   path: """
   { ratings_some: { actors_some: { name: "$user_id"} } }
   """
   variables: ["$user_id"]
)

extend type Director @deepAuth(
   path: """{ OR: [
       { acted_in_some: { actors_some: { name: "$user_id" } } }
       { directed_some: { actors_some: { name: "$user_id" } } }]}"""
   variables: ["$user_id"]
)

extend type Actor @deepAuth(
   path: """{ OR: [
       { acted_in_some: { actors_some: { name: "$user_id" } } }
       { directed_some: { actors_some: { name: "$user_id" } } }]}"""
   variables: ["$user_id"]
)

extend type Movie @deepAuth(
   path: """{ actors_some: { name: "$user_id"} }""",
   variables: ["$user_id"]
)

# deepAuth does not currently work on Relationship Types
# because of some internal things with neo4j-graphql-js schema augmentation
# Working on a hotfix to allow it to be applied through field-level

extend type RATED @deepAuth(
   path: """{ Movie: { actors_some: { name: "$user_id" } } }"""
   variables: ["$user_id"]
)

directive @deepAuth(
   path: String
   variables: [String]
) on OBJECT | INTERFACE
`;

const resolvers = {
  // root entry point to GraphQL service
  Query: {
    Actor(object, params, ctx, resolveInfo) {
      // No deepauth
        const {authParams, authResolveInfo} = applyDeepAuth(params, ctx, resolveInfo);
        return neo4jgraphql(object, authParams, ctx, authResolveInfo);
      // const authResolveInfo = applyDeepAuth(params, ctx, resolveInfo);
      // return neo4jgraphql(object, params, ctx, authResolveInfo);
    },
    Director(object, params, ctx, resolveInfo) {
      // No deepauth
        const {authParams, authResolveInfo} = applyDeepAuth(params, ctx, resolveInfo);
        return neo4jgraphql(object, authParams, ctx, authResolveInfo);
      // const authResolveInfo = applyDeepAuth(params, ctx, resolveInfo);
      // return neo4jgraphql(object, params, ctx, authResolveInfo);
    },
    Genre(object, params, ctx, resolveInfo) {
      // Uses deepauth
        const {authParams, authResolveInfo} = applyDeepAuth(params, ctx, resolveInfo);
        return neo4jgraphql(object, authParams, ctx, authResolveInfo);
    },
    Movie(object, params, ctx, resolveInfo) {
      // No deepauth
        const {authParams, authResolveInfo} = applyDeepAuth(params, ctx, resolveInfo);
        return neo4jgraphql(object, authParams, ctx, authResolveInfo);
      // const authResolveInfo = applyDeepAuth(params, ctx, resolveInfo);
      // return neo4jgraphql(object, params, ctx, authResolveInfo);
    },
    User(object, params, ctx, resolveInfo) {
      // Uses deepauth
        const {authParams, authResolveInfo} = applyDeepAuth(params, ctx, resolveInfo);
        return neo4jgraphql(object, authParams, ctx, authResolveInfo);
    }
  },
};

const movieSchema = makeAugmentedSchema({typeDefs, resolvers});

module.exports = { typeDefs, resolvers, movieSchema };