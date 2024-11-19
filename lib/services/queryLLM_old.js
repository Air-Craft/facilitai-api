const axios = require('axios');
const L = require('../logger')

async function queryLLM(inputQuery) {

	// Call Hugging Face Inference API
	let url = `https://api-inference.huggingface.co/models/${process.env.HF_MODEL_ID}`
	L.info("Querying LLM at URL: ", url, "with query of length", inputQuery.length)//, "Token: ", process.env.HF_API_TOKEN)
	// L.verbose("INPUT QUERY\n", inputQuery)

	// End of query token
	const EOQ = "<#!EOQ!#>"

// Call Hugging Face Inference API
	const hf_response = await axios.post(
	  url,
	  { 
	    inputs: inputQuery + EOQ,
	    parameters: {
	      // Increase max_new_tokens to allow longer responses
	      max_new_tokens: 5000, // Adjust this value as needed
	      // You can also set temperature, top_p, etc.
	      // temperature: 0.7, // Optional: Controls randomness
	      // top_p: 0.9,       // Optional: Controls diversity
	    },
	    options: {
	      wait_for_model: true, // Waits for the model to be ready
	    },
	  },
	  {
	    headers: {
	      'Content-Type': 'application/json',
	      'Authorization': `Bearer ${process.env.HF_API_TOKEN}`
	    },
	    timeout: 120000 // Set a timeout as the generation might take time
	  }
	);

	
	const output = hf_response.data;
	// L.verbose("...LLM Response: ", hf_response.data)

	// Parse the response based on the model's output format
	const generatedTextRaw = output[0]?.generated_text || 'No response generated.';

	// Remove the input text
	const generatedText = generatedTextRaw.split(EOQ)[1].trim();

	L.debug("...LLM answer: ", generatedText)    
	return generatedText
}

module.exports = queryLLM