const config = require('../config')
const { fetchAllProcesses } = require('../lib/services/fetchData')
const { extractStringVariants } = require('../lib/utils')

module.exports = async (req, res) => {

	try {
    // Fetch data from the GraphQL API
  	console.log("Exporting GraphQL data...")
	  const data = await fetchAllProcesses()
	  // console.log("DATA", data)

    // Generate training data
    //console.log("REQ", req.body, req.query)
    const numPrompts = req.query.numPrompts  // Adjust the number as needed
    const trainingData = generateSyntheticPrompts(numPrompts, data)

    // Convert training data to JSON Lines format
    const jsonlData = JSON.stringify(trainingData)
    //     .map(item => JSON.stringify({
    //   prompt: item.prompt,
    //   response: item.response
    // })).join(',\n');


    if (true) {
    	// Set headers to prompt file download
		  res.setHeader('Content-Disposition', 'attachment; filename="facilitai-training.jsonl"');
		  res.setHeader('Content-Type', 'application/jsonl');

  		// Send the data directly
  		res.send(jsonlData);

    } else {
    	return res.json(jsonlData)
  	}

    // // Set the response headers for file download
    // res.setHeader('Content-disposition', 'attachment; filename=training_data.jsonl');
    // res.setHeader('Content-Type', 'application/jsonl');

    // // Send the data as a stream
    // const stream = Readable.from([jsonlData]);
    // stream.pipe(res);

  } catch (error) {
    console.error('Error generating training data:', error);
    res.status(500).send('An error occurred while generating the training data.');
  }

}

// Helper function to extract names from arrays of objects
function extractNames(array) {
  return array.map(item => item.name);
}

const responsePrefix = 'Here are some processes you might try:\n\n'
const processResponseTemplate = `
	# {title}

	Duration: {duration}
	Group Type: {groupType}
	
	{description}. These are the instructions:

	{instructions}
`


// Define prompt templates
const promptTemplates = [
  // Existing templates
  "Suggest activities suitable for {groupType} that involve {activityType} and {physicality}.",
  "What are some {activityType} activities for {groupType} that include {physicality}?",
  "Can you recommend {genre} exercises that feature {activityType} and are appropriate for {groupType}?",
  "I'm looking for activities that are {activityType}, involve {physicality}, and are good for {groupType}.",
  "List activities in the genre of {genre} suitable for {groupType} involving {physicality}.",
  "Do you have any suggestions for {activityType} in {genre} for {groupType}?",
  "Please recommend activities with {miscTag} for {groupType} that include {physicality}.",
  "What activities can {groupType} do that involve {physicality} and {activityType}?",
  "What are some activities I can do with {groupType}?",

  // New templates involving duration
  "What activities can be done in {duration}?",
  "Suggest some activities that last around {duration}.",
  "I have {duration} available. What activities can I do?",
  "List activities with a duration of {duration}.",

  // New templates involving just genre
  "What activities are there in the genre of {genre}?",
  "Suggest some {genre} activities.",
  "I'm interested in {genre}. What activities can you recommend?",
  "Do you have any activities related to {genre}?",

  // New templates involving just activityType
  "List some {activityType} activities.",
  "What are some activities that involve {activityType}?",
  "Can you recommend activities focused on {activityType}?",
  "Suggest activities categorized under {activityType}.",

  // New templates involving just physicality
  "What activities involve {physicality}?",
  "Suggest activities that include {physicality}.",
  "I'm looking for activities with {physicality}. What do you recommend?",
  "List activities that require {physicality}.",

  // Templates involving physicality & activityType
  "What {activityType} activities involve {physicality}?",
  "Can you suggest {activityType} activities that include {physicality}?",
  "I'm interested in {activityType} activities with {physicality}.",

  // Templates involving duration & physicality
  "What activities lasting {duration} involve {physicality}?",
  "Suggest activities that take around {duration} and include {physicality}.",
  "Do you have any {duration} activities that involve {physicality}?",

  // Templates involving duration & groupType
  "What activities for {groupType} last about {duration}?",
  "Suggest {duration} activities suitable for {groupType}.",
  "I'm looking for activities for {groupType} that take around {duration}.",

  // Templates involving groupType & physicality
  "What activities for {groupType} involve {physicality}?",
  "Suggest activities suitable for {groupType} that include {physicality}.",
  "I'm seeking activities for {groupType} that involve {physicality}.",

  // Templates involving duration & genre
  "What {genre} activities can be done in {duration}?",
  "Suggest {genre} activities that last around {duration}.",
  "I'm interested in {genre} activities that take {duration}."
];

// Helper function to replace placeholders in the templates
function fillTemplate(template, values) {
  return template.replace(/{([^}]+)}/g, (match, key) => (values[key] !== undefined ? values[key] : match));
}

// Function to generate synthetic prompts
function generateSyntheticPrompts(numPrompts, data) {

  const genres = extractNames(data.genres);
  const activityTypes = extractNames(data.activityTypes);
  const physicalities = extractNames(data.physicalities);
  const groupTypes = extractNames(data.groupTypes);
  const miscTags = extractNames(data.tags); // Assuming 'tags' correspond to 'miscTags'
  const durations = extractStringVariants(data.processes, 'duration')
  // console.log("DURATIONS", durations)

  const processes = data.processes;

	console.log(`Generating ${numPrompts} from ${genres.length} genres, ${activityTypes.length} activity types, ${physicalities.length} physicalities, ${groupTypes.length} group types, ${durations.length} durations, ${miscTags.length} tags`)

  const promptResponses = [];
  while (promptResponses.length < numPrompts) { //if (let i = 0; i < numPrompts; i++) {

  	const template = promptTemplates[Math.floor(Math.random() * promptTemplates.length)];
    // console.log("TEMPL", template)

    // Randomly select values for placeholders based on what's needed in the template
    const placeholders = {};

    // Check which placeholders are in the selected template
    const placeholderMatches = template.match(/{([^}]+)}/g);
    if (!placeholderMatches) {
    	throw new Error("No matching placeholders! Shouldnt be!")
    }

    placeholderMatches.forEach((placeholder) => {
      const key = placeholder.replace(/[{}]/g, '');
      switch (key) {
        case 'groupType':
          placeholders[key] = groupTypes[Math.floor(Math.random() * groupTypes.length)];
          break;
        case 'activityType':
          placeholders[key] = activityTypes[Math.floor(Math.random() * activityTypes.length)];
          break;
        case 'physicality':
          placeholders[key] = physicalities[Math.floor(Math.random() * physicalities.length)];
          break;
        case 'genre':
          placeholders[key] = genres[Math.floor(Math.random() * genres.length)];
          break;
        case 'miscTag':
          placeholders[key] = miscTags[Math.floor(Math.random() * miscTags.length)];
          break;
        case 'duration':
          placeholders[key] = durations[Math.floor(Math.random() * durations.length)];
          break;
        default:
          break;
      }
    });

    // Create prompt using the template
    const prompt = fillTemplate(template, placeholders);

    // console.log("PROMPT", prompt)

    // Find matching processes
    const matchingProcesses = processes.filter(process => {
      const processGroupTypes = extractNames(process.groupTypes || []);
      const processActivityTypes = extractNames(process.activityTypes || []);
      const processPhysicalities = extractNames(process.physicalities || []);
      const processGenres = extractNames(process.genres || []);
      const processMiscTags = extractNames(process.miscTags || []);
      const processDuration = process.duration.replace(/[{}]/g, '') // remove whitespace for comparison

      // Check criteria only if they were in the template
      const criteriaMatched =
        (placeholders['groupType'] === undefined || processGroupTypes.includes(placeholders['groupType'])) &&
        (placeholders['activityType'] === undefined || processActivityTypes.includes(placeholders['activityType'])) &&
        (placeholders['physicality'] === undefined || processPhysicalities.includes(placeholders['physicality'])) &&
        (placeholders['genre'] === undefined || processGenres.includes(placeholders['genre'])) &&
        (placeholders['miscTag'] === undefined || processMiscTags.includes(placeholders['miscTag'])) &&
        (placeholders['duration'] === undefined || processDuration == placeholders['duration'])

      	return criteriaMatched;
    });


    if (matchingProcesses.length > 0) {
    	// if (Object.keys(placeholders).length > 1) {
    	// 	console.log(`MATCHED ${matchingProcesses.length} for `, placeholders)
    	// }

      // Construct the response by listing the matching processes

      const response = matchingProcesses.map(process => {
        // Handling possible missing fields
        // console.dir(process.description.document[0].children[0].text)
        const title = process.title
        const description = process.description && process.description.document ? process.description.document[0].children[0].text : '';
        const instructions = process.instructions && process.instructions.document ? process.instructions.document[0].children[0].text : '';
        const duration = process.duration
        const sources = process.sources
        const groupType = process.groupTypes.map((e) => e.name).join(', ')

        // console.log({
        // 	description: description,
        // 	instructions: instructions,
        // 	duration: duration,
        // 	sources: sources,
        // 	groupType: groupType
        // })

        const replaceMap = {
        	title: title,
        	description: description,
        	instructions: instructions,
        	duration: duration,
        	groupType: groupType
        }

        // console.log(replaceMap)

        return fillTemplate(processResponseTemplate, replaceMap)
      }).join('\n\n');

      // Add the prompt and response pair to the prompts array
      const fullResp = `${responsePrefix} ${response}`
      const promptResp = { prompt, response: fullResp }
      // console.log(promptResp)

      promptResponses.push(promptResp);

    } else {
      // Optionally, handle cases with no matching processes
      // For now, we'll skip prompts with no matches
      continue;
    }

    if (promptResponses.length % 100 == 0) console.log(`${promptResponses.length} prompts created`)
  }
  // console.log("PROMPTS", prompts.slice(0, 20).map((e)=>e.prompt))
	console.log("SIZE", JSON.stringify(promptResponses).length)
	// console.log("PRs", promptResponses)


	return promptResponses
}

