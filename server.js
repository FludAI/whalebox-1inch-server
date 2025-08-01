// 1inch API proxy server 

const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// frontend CORS 
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://localhost:5173', 
    'http://localhost:8080',
    'https://your-hackathon-app.vercel.app'
  ],
  credentials: true
}));

app.use(express.json());

// 1inch API config
const ONEINCH_API_KEY = process.env.ONEINCH_API_KEY;
const ONEINCH_BASE_URL = 'https://api.1inch.dev';

//TRON/ETH swap addresses
const TOKEN_ADDRESSES = {
  ethereum: {
    ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    USDC: '0xA0b86a33E6441c8B4d36dC4C88ef0c9e31cE4eE8'
  },
  tron: {
    TRX: 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb', // Native TRX
    USDT: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', // USDT-TRC20
    USDC: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8' // USDC-TRC20
  }
};

// Helper - get auth headers
const getAuthHeaders = () => {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (ONEINCH_API_KEY) {
    headers['Authorization'] = `Bearer ${ONEINCH_API_KEY}`;
  }
  
  return headers;
};

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    console.log('Health check request');
    const response = await axios.get(`${ONEINCH_BASE_URL}/healthcheck`);
    res.json({
      success: true,
      data: response.data,
      proxy: 'working',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      proxy: 'failed'
    });
  }
});

// Get supported chains
app.get('/api/chains', async (req, res) => {
  try {
    console.log('Chains request');
    const response = await axios.get(`${ONEINCH_BASE_URL}/portfolio/v4/general/supported_chains`);
    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error('Chains request failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get chain specific tokens
app.get('/api/tokens/:chainId', async (req, res) => {
  try {
    const { chainId } = req.params;
    console.log(`Tokens request for chain ${chainId}`);
    
    const response = await axios.get(`${ONEINCH_BASE_URL}/swap/v6.0/${chainId}/tokens`, {
      headers: getAuthHeaders()
    });
    
    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error('Tokens request failed:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

// Get swap quote for ETH/TRON compatible tokens
app.get('/api/quote/:chainId', async (req, res) => {
  try {
    const { chainId } = req.params;
    const { src, dst, amount, from, slippage = '1' } = req.query;
    
    console.log(`Quote request for chain ${chainId}:`, { src, dst, amount, from, slippage });
    
    if (!src || !dst || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: src, dst, amount'
      });
    }
    
    const response = await axios.get(`${ONEINCH_BASE_URL}/swap/v6.0/${chainId}/quote`, {
      params: { src, dst, amount, from, slippage },
      headers: getAuthHeaders()
    });
    
    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error('Quote request failed:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

// Execute swap for ETH/TRON compatible tokens
app.get('/api/swap/:chainId', async (req, res) => {
  try {
    const { chainId } = req.params;
    const { src, dst, amount, from, slippage = '1' } = req.query;
    
    console.log(`Swap request for chain ${chainId}:`, { src, dst, amount, from, slippage });
    
    if (!src || !dst || !amount || !from) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: src, dst, amount, from'
      });
    }
    
    const response = await axios.get(`${ONEINCH_BASE_URL}/swap/v6.0/${chainId}/swap`, {
      params: { src, dst, amount, from, slippage },
      headers: getAuthHeaders()
    });
    
    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error('Swap request failed:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

// Fusion+ quote endpoint 
app.post('/api/fusion/quote', async (req, res) => {
  try {
    console.log('Fusion+ REAL cross-chain quote request:', req.body);
    
    const { fromTokenAddress, toTokenAddress, amount, walletAddress, fromChainId, toChainId } = req.body;
    
    if (!fromTokenAddress || !toTokenAddress || !amount || !walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: fromTokenAddress, toTokenAddress, amount, walletAddress'
      });
    }
    
    // 1inch Fusion+ for cross-chain swaps
    const response = await axios.post(`${ONEINCH_BASE_URL}/fusion/quoter/v1.0/quote`, {
      fromTokenAddress,
      toTokenAddress, 
      amount,
      walletAddress,
      fromChainId: fromChainId || 1, // Ethereum mainnet
      toChainId: toChainId || 56,    // BSC or target chain
      ...req.body // Pass through any additional 1inch parameters
    }, {
      headers: getAuthHeaders()
    });
    
    res.json({
      success: true,
      data: response.data,
      crossChain: true,
      provider: '1inch-fusion+'
    });
  } catch (error) {
    console.error('Fusion+ REAL cross-chain failed:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || error.message,
      details: error.response?.data
    });
  }
});

// Fusion+ cross-chain swap
app.post('/api/fusion/swap', async (req, res) => {
  try {
    console.log('Fusion+ REAL cross-chain swap execution:', req.body);
    
    const response = await axios.post(`${ONEINCH_BASE_URL}/fusion/orders`, req.body, {
      headers: getAuthHeaders()
    });
    
    res.json({
      success: true,
      data: response.data,
      crossChain: true,
      provider: '1inch-fusion+'
    });
  } catch (error) {
    console.error('Fusion+ REAL cross-chain swap failed:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || error.message,
      details: error.response?.data
    });
  }
});

// Get REAL cross-chain supported chains and tokens
app.get('/api/fusion/chains', async (req, res) => {
  try {
    console.log('Getting REAL Fusion+ supported chains');
    
    const response = await axios.get(`${ONEINCH_BASE_URL}/fusion/quoter/v1.0/supported-chains`, {
      headers: getAuthHeaders()
    });
    
    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error('Fusion+ chains request failed:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});


// Generic proxy - any 1inch endpoint
app.all('/api/proxy/*', async (req, res) => {
  try {
    const endpoint = req.params[0];
    const url = `${ONEINCH_BASE_URL}/${endpoint}`;
    
    console.log(`Proxying ${req.method} request to: ${url}`);
    
    const config = {
      method: req.method,
      url,
      headers: getAuthHeaders(),
      params: req.query
    };
    
    if (req.method !== 'GET' && req.body) {
      config.data = req.body;
    }
    
    const response = await axios(config);
    
    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error('Proxy request failed:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || error.message
    });
  }
});

// Token address helper endpoint
app.get('/api/token-addresses', (req, res) => {
  res.json({
    success: true,
    data: TOKEN_ADDRESSES
  });
});

// Error handler middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: error.message
  });
});

app.listen(PORT, () => {
  console.log(`1inch Proxy Server running on port ${PORT}`);
  console.log(`Frontend can call: http://localhost:${PORT}/api/*`);
  console.log(`API Key status: ${ONEINCH_API_KEY ? 'SET' : 'NOT SET (add to .env file)'}`);
  console.log(`\nAvailable endpoints:`);
  console.log(`   GET  /api/health - Health check`);
  console.log(`   GET  /api/chains - Supported chains`);
  console.log(`   GET  /api/tokens/:chainId - Tokens for chain`);
  console.log(`   GET  /api/quote/:chainId - Swap quote`);
  console.log(`   GET  /api/swap/:chainId - Execute swap`);
  console.log(`   POST /api/fusion/quote - REAL Fusion+ cross-chain quote`);
  console.log(`   POST /api/fusion/swap - REAL Fusion+ cross-chain execution`);
  console.log(`   GET  /api/fusion/chains - Fusion+ supported chains`);
  console.log(`   *    /api/proxy/* - Generic proxy`);
  console.log(`   GET  /api/token-addresses - Token address reference`);
});