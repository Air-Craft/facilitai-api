const express = require('express');
const training_data = require('./endpoints/training-data')

const axios = require('axios');
const cors = require('cors');
const { ApolloClient, InMemoryCache, gql, HttpLink } = require('@apollo/client/core');
const { setContext } = require('@apollo/client/link/context');
const fetch = require('cross-fetch'); // or 'node-fetch'
const fs = require('fs');
const exportData = require('./endpoints/export')
const query = require('./endpoints/query')

const config = require('./config');
const L =  require('./lib/logger');

require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(cors({
  origin: config.frontendUrl, // Replace with your front-end URL
  optionsSuccessStatus: 200,
}));
app.use(express.json());


app.post('/query', query)
app.get('/training-data', training_data)

// EXPORT
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




app.listen(port, () => {
  L.info(`API server listening at http://localhost:${port}`);
  L.info("Using LLM Model " + process.env.HF_MODEL_ID)

});


