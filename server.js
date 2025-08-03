const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

// === FUSION+ START ===
let fusionSecrets = {};
setInterval(() => {
  const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
  Object.keys(fusionSecrets).forEach(hash => {
    if (fusionSecrets[hash].timestamp < tenMinutesAgo) {
      delete fusionSecrets[hash];
    }
  });
}, 10 * 60 * 1000);

const generateFusionSecret = () => {
  return '0x' + crypto.randomBytes(32).toString('hex');
};

const getFusionSecretHash = (secret) => {
  const hash = crypto.createHash('sha3-256');
  hash.update(Buffer.from(secret.slice(2), 'hex'));
  return '0x' + hash.digest('hex');
};

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://localhost:5173', 
    'http://localhost:8080',
    'https://your-hackathon-app.vercel.app'
  ]
}));
app.use(express.json());

const ONEINCH_API_KEY = process.env.ONEINCH_API_KEY;
const ONEINCH_BASE_URL = 'https://api.1inch.dev';

const getAuthHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  if (ONEINCH_API_KEY) {
    headers['Authorization'] = `Bearer ${ONEINCH_API_KEY}`;
  }
  return headers;
};

// Health check route (minimal example)
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

module.exports = app;