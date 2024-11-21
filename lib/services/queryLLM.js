// Import necessary modules
const { HfInference } = require("@huggingface/inference");
const L = require('../logger'); // Ensure this path is correct based on your project structure
const config = require('../../config');

// Initialize the Hugging Face Inference client with your API token
const client = new HfInference(process.env.HF_API_TOKEN);

/**
 * Queries the Language Model using Hugging Face's Chat Completion API.
 *
 * @param {string} messages - The conversation input.  [
                { role: "user", content: inputQuery }, ...
            ],
 * @returns {Promise<string>} - The generated text response from the LLM.
 */
async function queryLLM(messages) {
    // Construct the model URL for logging purposes
    const url = `https://api-inference.huggingface.co/models/${process.env.HF_MODEL_ID}`;

    L.info("Querying LLM at URL:", url, "with query of length", JSON.stringify(messages).length);
    // Optionally log the full input query at a verbose level
    L.verbose("INPUT QUERY\n");
    L.dir(messages);

    // Initialize an empty string to accumulate the output
    let generatedOutput = "";

    try {
        // Start the streaming chat completion
        const stream = client.chatCompletionStream({
            model: process.env.HF_MODEL_ID, // Use the model ID from environment variables
            messages: messages,
            temperature: config.LLM.temperature, // Adjust as needed (controls randomness)
            max_tokens: config.LLM.max_tokens,  // Adjust based on desired response length
            top_p: 0.9,         // Adjust as needed (controls diversity)
            // You can include other parameters like `frequency_penalty`, `presence_penalty`, etc., if needed
        });

        // Iterate over each chunk of the streamed response
        for await (const chunk of stream) {
            if (chunk.choices && chunk.choices.length > 0) {
                const delta = chunk.choices[0].delta;
                if (delta && delta.content) {
                    generatedOutput += delta.content;
                    // Optionally log each chunk as it's received
                    // console.log(delta.content);
                }
            }
        }

        // version given for 405b but that requires a dedicated endpoint
        // const chatCompletion = await client.chatCompletion({
        //     model: process.env.HF_MODEL_ID, // Use the model ID from environment variables
        //     messages: [
        //         {
        //             role: "user",
        //             content: "What is the capital of France?"
        //         }
        //     ],
        //     max_tokens: 500
        // });

        // generatedOutput = chatCompletion.choices[0].message
    } catch (error) {
        L.error("Error querying LLM:", error);
        return 'No response generated.';
    }

    // Trim any leading/trailing whitespace from the generated output
    const generatedText = generatedOutput.trim() || 'No response generated.';

    // Log the final generated answer
    L.debug("LLM QUERY RESPONSE:", generatedText);    

    return generatedText;
}

// Export the function for use in other modules
module.exports = queryLLM;