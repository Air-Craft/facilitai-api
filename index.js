const express = require('express');
const training_data = require('./endpoints/training-data')

const axios = require('axios');
const cors = require('cors');
const { ApolloClient, InMemoryCache, gql, HttpLink } = require('@apollo/client/core');
const { setContext } = require('@apollo/client/link/context');
const fetch = require('cross-fetch'); // or 'node-fetch'
const fs = require('fs');
const exportData = require('./endpoints/export')

const config = require('./config');

require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middlewares
// app.use(cors());
app.use(express.json());


// Route to handle query requests
app.post('/query', async (req, res) => {
  const inputQuery = req.body.query;

  if (!inputQuery) {
    return res.status(400).json({ error: 'No query provided.' });
  }

  // Add prompt engineering
  const inputText = `${config.promptEngineer} ${inputQuery}`

  try {
    // Call Hugging Face Inference API
    let url = `https://api-inference.huggingface.co/models/${process.env.HF_MODEL_ID}`
    console.log("Calling: ", url)//, "Token: ", process.env.HF_API_TOKEN)

    const hf_response = await axios.post(
      url,
      { 
        inputs: inputText,
        parameters: {
          // Increase max_new_tokens to allow longer responses
          max_new_tokens: 1000, // Adjust this value as needed
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
        timeout: 60000 // Set a timeout as the generation might take time
      }
    );

    const output = hf_response.data;

    // Parse the response based on the model's output format
    const generatedTextRaw = output[0]?.generated_text || 'No response generated.';

    // Remove the inpout text
    const generatedText = generatedTextRaw.substr(inputText.length)

    console.log("LLM Result: ", generatedText)

    res.json({ response: generatedText });

  } catch (error) {
    console.error('Error querying Hugging Face API:', error.message);
    res.status(500).json({ error: 'Failed to generate response.' });
  }
});


// EXPORT

// New /export route
app.get('/export', async (req, res) => {
  console.log("API::EXPORT")
  try {
    let data = await exportData()

    return res.json(data)


  } catch (error) {
    console.error('Error fetching data from Keystone API:', error.message);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});


app.get('/training-data', training_data)



app.listen(port, () => {
  console.log(`API server listening at http://localhost:${port}`);
});