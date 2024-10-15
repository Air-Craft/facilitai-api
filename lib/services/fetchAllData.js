const { ApolloClient, InMemoryCache, gql, HttpLink } = require('@apollo/client/core');
const { setContext } = require('@apollo/client/link/context');
const fetch = require('cross-fetch');
const fs = require('fs');
const config = require('../../config.js')

// const SIGN_IN = gql`
//   mutation ($email: String!, $password: String!) {
//     authenticateUserWithPassword(email: $email, password: $password) {
//       token
//     }
//   }
// `;

// const GET_ALL_DATA = gql`
//   query ($skip: Int!, $first: Int!) {
//     processes(skip: $skip, first: $first) {
//       id
//       title
//       source,
//       duration
//       description,
//       instructions,
//       genre,
//       activityType,
//       physicality,
//       groupType
//     }
//   }
// `;

const GET_ALL_DATA = gql`
  query {
    genres { name }
    groupTypes { name }
    activityTypes { name }
    physicalities { name }
    tags {name }
    collections {
      title   
    } 

    processes {
      title
      description { document }
      instructions { document }
      sources
      genres { name }
      activityTypes { name }
      miscTags {
        name
      }
      physicalities { name }
      groupTypes { name }
      duration
    }
  }
`;


// async function authenticate() {
//   // Include necessary headers to avoid CSRF error
//   const httpLink = new HttpLink({
//     uri: config.graphqlUrl,
//     fetch,
//     headers: {
//       'Content-Type': 'application/json',
//       'apollo-require-preflight': 'true',
//     },
//   });

//   const client = new ApolloClient({
//     link: httpLink,
//     cache: new InMemoryCache(),
//   });

//   const { data, errors } = await client.mutate({
//     mutation: SIGN_IN,
//     variables: {
//       email: 'briquinn@pm.me',
//       password: 'KriyaJapa48',
//     },
//   });

//   if (errors) {
//     throw new Error(`Authentication Error: ${errors[0].message}`);
//   }

//   if (!data.authenticateUserWithPassword || !data.authenticateUserWithPassword.token) {
//     throw new Error('Authentication failed: Invalid credentials');
//   }

//   return data.authenticateUserWithPassword.token;
// }

async function fetchAllData(token) {
  try {
    // Include necessary headers to avoid CSRF error
    console.log(config.graphqlUrl)
    const httpLink = new HttpLink({
      uri: config.graphqlUrl,
      fetch,
    });

    const authLink = setContext((_, { headers }) => {
      return {
        headers: {
          ...headers,
          // 'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'apollo-require-preflight': 'true',
        },
      };
    });

    const client = new ApolloClient({
      link: authLink.concat(httpLink),
      cache: new InMemoryCache(),
    });

    // let allData = [];
    // let skip = 0;
    // const limit = 50;
    // let fetchMore = true;

    // while (fetchMore) {
      const { data } = await client.query({
        query: GET_ALL_DATA,
        // variables: { skip, first: limit },
      });

    //   allData = allData.concat(data.allPosts);
    //   skip += limit;
    //   fetchMore = data.allPosts.length === limit;
    // }
    if (data) {
      return data;
    } else {
      throw new Error('No data returned from the query.');
    }
    
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
}


module.exports = fetchAllData