/**
 * Fetch database data via GraphQL API
 */
const { ApolloClient, InMemoryCache, gql, HttpLink } = require('@apollo/client/core');
const { setContext } = require('@apollo/client/link/context');
const fetch = require('cross-fetch');
const fs = require('fs');
const config = require('../../config.js')
const L = require('../logger.js')


// @NEXT: convert fetchAllData to fetchProcessData(queryType)
// convert bewlot to TYPE's and use conversion function to get gql
// use metadata to work out queryLLM step 1

// Enum of queryTypes

const FETCH_TYPE = {
  metadata: 'metadata',
  processes_all_fields: 'processes_all_fields',
  processes_search: 'processes_search' 
}

async function fetchMetadata() {
  return await fetchData(FETCH_TYPE.metadata) 
}

async function fetchAllProcesses() {
  return await fetchData(FETCH_TYPE.processes) 
}

async function fetchProcesses(where) {
  return await fetchData(FETCH_TYPE.processes_search, where)
}

/**
 * @param where  required for processes_search type. String to print in the GraphQL query where parameter
 */
async function fetchData(fetchType, where) {
  try {
    // Include necessary headers to avoid CSRF error
    L.debug(`fetchData(): Fetching data from ${config.graphqlUrl} for type ${fetchType}. where=${where}`)

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

    let query = getGraphQLQuery(fetchType, where)

    // L.debug("GraphQL query\n", query)

    // while (fetchMore) {
      const { data } = await client.query({
        query: query,
        // variables: { skip, first: limit },
      });

    //   allData = allData.concat(data.allPosts);
    //   skip += limit;
    //   fetchMore = data.allPosts.length === limit;
    // }
    if (data) {
      // L.debug(`...Data returned`)
      // L.verbose(data)
      return data;
    } else {
      throw new Error('No data returned from the query.');
    }
    
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
}


/**
 * @param where  required for processes_search type. 
 */
function getGraphQLQuery(fetchType, where) {
  switch (fetchType) {
    case FETCH_TYPE.metadata:
      return gql`
        query {
          genres { name }
          groupTypes { name }
          activityTypes { name }
          physicalities { name }
          tags { name }
        }`
    case FETCH_TYPE.processes_all_fields:
      return gql`
        query {
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
        }`
      case FETCH_TYPE.processes_search:
        if (!where) {
          throw new Error("Where parameter must be specified for FETCH_TYPE.processes_search!")
          return ''
        }
        return gql`
          query {
            processes(where: ${where}) {
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
          }`
    default:
      throw new Error(`Invalid fetchType: ${fetchType}`);
  }
}


module.exports = {
  fetchMetadata,
  fetchAllProcesses,
  fetchProcesses
}



// OLD AUTH STUFF (not needed for public data)


// const SIGN_IN = gql`
//   mutation ($email: String!, $password: String!) {
//     authenticateUserWithPassword(email: $email, password: $password) {
//       token
//     }
//   }
// `;

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
