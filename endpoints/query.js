const config = require('../config')
const { fetchMetadata, fetchProcesses } = require('../lib/services/fetchData');
const queryLLM = require('../lib/services/queryLLM')
const JSON5 = require('json5')
const L = require('../lib/logger')

module.exports = async (req, res) => {
  const userQuery = req.body.query;
  L.info("Querying API with input query: ", userQuery)

  if (!userQuery) {
    return res.status(400).json({ error: 'No query provided.' });
  }

  try {
    /*
    MAIN FLOW


    QUICK START
    1) query the various database parameters 
    2) Construct llm query to convert user query to db search parameters
    3) Run the search to retrieve the context data
    4) Run the llm query with the data context and prompt engineering to generate the results
    5) (convert into a conversation bot rather than a single search)

    BETTER
    *) Above does not include the description texts and doesnt allow smart handling of group size or duration
    *) Convert tags to text statements and combine with text content. Create vector set representation of the text content.
    *) Handle duration second. Feed the id and duration to a second query to get ones that work for the duration
    *) finally add the records as the context to the query and begin the conversation
    */

    // Use the LLM to generate a "where" param for the graphQL search based on the user's query
    L.debug("Determining 'where' clause for GraphQL query...")
    const whereClause = await determineGQLWhereClause(userQuery)
    L.debug("...where: ", whereClause)

    // Do the search
    L.debug("Fetching related processes...")
    const results = await fetchProcesses(whereClause)
    const processes = results.processes

    L.debug("...found: ", processes.length, " results.")
    L.verbose("Processes:\n", processes)

    // Convert processes into strings for the Context of the LLM query
    var processesContext = ""
    if (processes.length > 0) {
      for (const process of processes) {
        processesContext += processToLLMString(process) + "\n\n"
      }
    }
    // L.verbose("Process Context:\n", processesContext)

    // Key parts for the system prompt
    // * Tone
    // * Use the given context only(?)
    // * How to format the output. What to include in initial 
    // * Instructions to not engage when query does not pertain to purpose of this LLM

    const promptWithContext = `
System: 
You are a helpful and enthusiastic research assistant for a database of processes for facilitators to run.
The potentially relevant processes are provided in Database.
In the initial query, you act like a search engine for the processes listed in Database. 
List the ones that are relevant to the user's query. 
If there are less than 5 from the Database then supplement with additional ones from outside the Database
First just give the user a list with titles and short summaries and offer to explain further.
In subsequent queries, you may answer questions about the processes give in the first answer and also refine (add or remove) from your initial suggestions.

Clearly indicate that these suggestions are outside the scope of the Database data.
If a user's query does not relate to searching for facilitation processes, do not answer their question but just remind them about your scope.
Again do not answer questions outside of the scope outlined above.
Format your answer as Markdown. Make the title a header.

User Query:
${userQuery}

Database:
${processesContext}
`
    L.debug("Querying LLM for final answer...)")
    const answer = await queryLLM(promptWithContext)
    
    L.debug("...LLM Result: ", answer)

    res.json({ response: answer });

  } catch (error) {
    L.error('Error: Call to /query failed:', error.message)
    if (error.cause) {
      L.error("ERROR MESSAGES:\n", error.cause.result.errors);
    }
    L.error("FULL ERROR", error)

    res.status(500).json({ error: 'Query failed.' });
  }
}



/// Uses prompt engineering combined with the Process metadata dump to convert 
/// the users query into a JSON object that can be used to search the Process database
///
/// @throws Error if the query fails or the JSON object cannot be parsed
async function determineGQLWhereClause(userQuery) {
  L.info("Generating where clause from userQuery: ", userQuery)

  const metadata = await fetchMetadata();
  
  // Convert the metadata to a string where each line has the format: key: list, of, values
  let metadataString = Object.entries(metadata).map(([key, values]) => `${key}: ${values.map((e)=>e.name).join(', ')}`).join('; ')
  // L.verbose("METADATA STRING: ", metadataString)

  // Convert "tags" to "miscTags" to match parameter on Processes
  metadataString = metadataString.replace("tags:", 'miscTags:')

  const prompt = 
    "System: " + 
"Generate a valid \"where\" clause for GraphQL (keystoneJS) given the following User Query and Metadata. " + 
"The Metadata categories (e.g. genres) represents objects with a many-to-many relationship in the graphQL database. " +
"The values listed represent all possible values of the \"name\" property of their respective objects." +
"Pay careful attention on how you combine them with booleans (AND, OR, NOT) and other filters keys (e.g. \"in\", \"some\", \"all\") so that it accurately models the User Query." +
"Important: Only give the resulting where clause, none of the explanation or preamble!" +
"If no metadata values are clear for a given parameter, exclude it from the where string." +
"If no parameters have clear values return an empty string." +
"Return the \"where\" string only. Do not include any other text." +
"Make sure this is correct GraphQL code and uses booleans explicitly and correctly." +
    "-- Metadata: " + metadataString +
    "-- User Query: " + userQuery


//  var prompt = "<s>[INST]You are an excessively happy and excited dracula character[/INST]</s>[INST]tell me how you like people[/INST]"
  // L.verbose("PROMPT: ", prompt)

  // Run the query and parse the resultant json string to ensure it works
  const generatedText = await queryLLM(prompt);
L.debug("GENERATED TEXT: ", generatedText)
  const graphQLWhereClause = fixGeneratedWhereClause(generatedText)
L.debug("FIXED TEXT: ", graphQLWhereClause)
  return graphQLWhereClause
}

/**
 * Convert the process object into a string for the LLM. Designates the title and other fields explicitly
 */
function processToLLMString(process) {
  // L.debug("PROCESS:", process)
  // Convert newlines to space in the text
  return `
Title: ${process.title}
Source: ${process.sources} 
Description: ${documentToMarkdown(process.description.document).replace(/\n/g, ' ')}
Instructions: ${documentToMarkdown(process.instructions.document).replace(/\n/g, ' ')}}
Duration: ${process.duration}
Genres: ${process.genres.map((e) => e.name).join(', ')}
Group Size: ${process.groupTypes.map((e) => e.name).join(', ')}
Activity Types: ${process.activityTypes.map((e) => e.name).join(', ')}
Physicalities: ${process.physicalities.map((e) => e.name).join(', ')}
`
}

/**
 * Transforms a GraphQL where clause by:
 * 1. Removing the "where:" preamble.
 * 2. Converting "type_modifier: {...}" into "type: { modifier: { ... } }".
 *
 * @param {Object} whereClause - The original where clause object.
 * @returns {Object} - The transformed where clause object.
 */
function fixGeneratedWhereClause(code) {
  // Remove 'where: ' preamble. Also Llama 3.1 adds backticks
  code = code.replace(/^`?where:\s*/, '');

  // remove backticks
  code = code.replace(/\`/g, '').trim();

 // Ensure it is wrapped in { }
  if (!code.startsWith('{')) {
    code = `{${code}}`;
  }

  // Convert the string into a JavaScript object.
  // We'll use `Function` constructor for safer parsing than `eval`.
  const obj = Function('"use strict";return (' + code + ')')();

  // Function to recursively transform the object
  function transform(obj) {
    if (Array.isArray(obj)) {
      return obj.map(transform);
    } else if (obj && typeof obj === 'object') {
      const newObj = {};
      for (const key in obj) {
        const value = obj[key];

        // If the key contains an underscore, split it and nest
        if (key.includes('_')) {
          const [outerKey, innerKey] = key.split('_');
          newObj[outerKey] = newObj[outerKey] || {};
          newObj[outerKey][innerKey] = transform(value);
        }
        // If the key ends with a modifier (e.g., '_in'), split and nest
        else if (key.match(/^(.*?)(_(in|some|none|every|not|gt|lt|gte|lte))$/)) {
          const [, propName, , modifier] = key.match(/^(.*?)(_(in|some|none|every|not|gt|lt|gte|lte))$/);
          newObj[propName] = newObj[propName] || {};
          newObj[propName][modifier] = transform(value);
        } else if (["activityTypes", "genres", "groupTypes", "physicalities", "miscTags"].includes(key) && value.in) {
          // Insert "name" before "in" modifier
          newObj[key] = { some: { name: value } }
        } else if (key == "some" && value.in) {
          newObj[key] = { name: value }
        } else if (key == "name" && !value.in) {
          // Add "in" for name lists
          newObj[key] = { in: value } 
        } else {
          newObj[key] = transform(value);
        }
      }
      return newObj;
    }
    return obj;
  }

  const transformedObj = transform(obj);

  // Function to convert the object back to string with unquoted keys
  function stringify(obj) {
    if (Array.isArray(obj)) {
      return `[${obj.map(stringify).join(', ')}]`;
    } else if (obj && typeof obj === 'object') {
      const props = Object.entries(obj).map(
        ([key, value]) => `${key}: ${stringify(value)}`
      );
      return `{ ${props.join(', ')} }`;
    } else if (typeof obj === 'string') {
      return `"${obj}"`;
    }
    return String(obj);
  }

  let fixedQueryStr = stringify(transformedObj);
  return fixedQueryStr
}

function documentToMarkdown(document) {
  // L.debug("-")

  let markdown = '';

  function traverse(node) {
    if (!node) return '';

    switch (node.type) {
      case 'paragraph':
        return processParagraph(node);
      case 'heading':
        return processHeading(node);
      case 'list':
        return processList(node);
      case 'blockquote':
        return processBlockquote(node);
      case 'code':
        return processCodeBlock(node);
      // Add more cases as needed for other node types
      default:
        if (node.text) {
          return processText(node)
        } else if (node.children) {
          return node.children.map(traverse).join('');
        }
        return '';
    }
  }

  function processParagraph(node) {
    // Process child nodes and accumulate text
    let text = node.children.map(traverse).join('');
    // Add paragraph text with two newlines
    return `${text}\n\n`;
  }

  function processHeading(node) {
    const level = node.level || 1;
    const hashes = '#'.repeat(level);
    // Process child nodes to get heading text
    let text = node.children.map(traverse).join('');
    // Format heading
    return `\n\n${hashes} ${text}\n\n`;
  }

  function processList(node) {
    let items = node.items.map((item, index) => {
      let prefix = node.ordered ? `${index + 1}. ` : '- ';
      let content = item.children.map(traverse).join('');
      return `${prefix}${content}`;
    });
    // Join list items with newlines
    return `\n${items.join('\n')}\n\n`;
  }

  function processBlockquote(node) {
    let content = node.children.map(traverse).join('');
    // Format blockquote
    return `\n\n> ${content}\n\n`;
  }

  function processCodeBlock(node) {
    const language = node.language || '';
    const code = node.code || '';
    // Format code block
    return `\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;
  }

  function processText(node) {
    let text = node.text || '';

    // Apply formatting based on text properties
    if (node.bold) text = `**${text}**`;
    if (node.italic) text = `*${text}*`;
    if (node.underline) text = `<u>${text}</u>`;
    if (node.code) text = `\`${text}\``;
    if (node.strikethrough) text = `~~${text}~~`;

    return text;
  }

  // Start traversal from the top-level document node
  if (Array.isArray(document)) {
    markdown = document.map(traverse).join('').trim();
  }

  // Return the accumulated markdown
  return markdown;
}