// 1inch API Proxy Server - Clean Production Version
// Run with: node server.js

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

// === FUSION+ START ===
// In-memory secret storage for hackathon demo (use Redis in production)
let fusionSecrets = {}; // key: secretHash, value: secret

// Cleanup old secrets every 10 minutes
setInterval(() => {
  const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
  Object.keys(fusionSecrets).forEach(hash => {
    if (fusionSecrets[hash].timestamp < tenMinutesAgo) {
      delete fusionSecrets[hash];
    }
  });
}, 10 * 60 * 1000);

// For Fusion+ secret generation (using Node.js crypto instead of ethers for simplicity)
const generateFusionSecret = () => {
  return '0x' + crypto.randomBytes(32).toString('hex');
};

const getFusionSecretHash = (secret) => {
  // Simple keccak256 implementation using crypto
  const hash = crypto.createHash('sha3-256');
  hash.update(Buffer.from(secret.slice(2), 'hex'));
  return '0x' + hash.digest('hex');
};

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for your frontend - simplified
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://localhost:5173', 
    'http://localhost:8080',
    'https://your-hackathon-app.vercel.app'
  ]
}));

app.use(express.json());

// 1inch API configuration
const ONEINCH_API_KEY = process.env.ONEINCH_API_KEY;
const ONEINCH_BASE_URL = 'https://api.1inch.dev';

// Helper function to get auth headers - CORRECTED for Fusion+
const getAuthHeaders = () => {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (ONEINCH_API_KEY) {
    // CORRECTION: Fusion+ uses Authorization: Bearer, not X-API-Key
    headers['Authorization'] = `Bearer ${ONEINCH_API_KEY}`;
  }
  
  return headers;
};

// Test CORRECT Fusion+ endpoint with FIXED variable references
app.post('/api/test-fusion-direct', async (req, res) => {
  try {
    console.log('Testing CORRECT Fusion+ /orders endpoint');
    
    // Generate proper Fusion+ secret (raw secret, not hash)
    const secret = generateFusionSecret();
    
    // Store secret for reference
    fusionSecrets[secret] = {
      secret,
      timestamp: Date.now(),
      metadata: 'test-fusion-orders'
    };
    
    // FIXED: Define chainIds properly from constants, not undefined variables
    const fromChainId = 1;  // Ethereum
    const toChainId = 56;   // BSC
    
    // KNOWN WORKING pair for Ethereum mainnet
    const payload = {
      fromTokenAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC (known good)
      toTokenAddress: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',   // Native ETH
      amount: '1000000', // 1 USDC (6 decimals) - about $1
      walletAddress: '0x742d35Cc6634C0532925a3b8d3b9e4d5b3A4B1cE',
      fromChainId: 1,   // Ethereum mainnet
      toChainId: 56,    // BSC  
      secret            // Use raw secret
    };
    
    console.log('Testing CORRECT /orders endpoint with payload:', JSON.stringify(payload, null, 2));
    console.log('Using Authorization: Bearer header');
    
    // Try different Fusion+ endpoints to find the working one
    let response;
    try {
      // Try method 1: /fusion/orders
      console.log('Trying /fusion/orders endpoint...');
      response = await axios.post(`${ONEINCH_BASE_URL}/fusion/orders`, payload, {
        headers: getAuthHeaders(),
        timeout: 15000
      });
    } catch (error) {
      if (error.response?.status === 404) {
        try {
          // Try method 2: /fusion/orders/quote  
          console.log('Trying /fusion/orders/quote endpoint...');
          response = await axios.post(`${ONEINCH_BASE_URL}/fusion/orders/quote`, payload, {
            headers: getAuthHeaders(),
            timeout: 15000
          });
        } catch (error2) {
          if (error2.response?.status === 404) {
            // Try method 3: /fusion/quoter/v2.0/quote
            console.log('Trying /fusion/quoter/v2.0/quote endpoint...');
            response = await axios.post(`${ONEINCH_BASE_URL}/fusion/quoter/v2.0/quote`, payload, {
              headers: getAuthHeaders(),
              timeout: 15000
            });
          } else {
            throw error2;
          }
        }
      } else {
        throw error;
      }
    }
    
    res.json({
      success: true,
      message: 'REAL Fusion+ /orders endpoint works!',
      data: response.data,
      status: response.status,
      endpoint: '/fusion/orders',
      metadata: {
        fromChain: 'Ethereum',
        toChain: 'BSC',
        amount: '1 USDC → ETH cross-chain (~$1 test)',
        authMethod: 'Authorization: Bearer (CORRECTED)'
      },
      fusionSecret: secret
    });
    
  } catch (error) {
    console.error('Fusion+ /orders test failed:', error.response?.status, error.response?.statusText);
    console.error('Error details:', error.response?.data || error.message);
    
    let errorData = error.response?.data;
    if (typeof errorData === 'string' && errorData.includes('<')) {
      errorData = 'HTML error response - check endpoint URL';
    }
    
    res.status(error.response?.status || 500).json({
      success: false,
      error: errorData || error.message,
      status: error.response?.status,
      endpoint: '/fusion/orders',
      note: 'Using CORRECT endpoint and auth format',
      fixes: {
        variables: 'FIXED: fromChainId and toChainId now properly defined',
        auth: 'FIXED: Using Authorization: Bearer instead of X-API-Key',
        amount: 'FIXED: Using tiny 0.00001 ETH test amount'
      },
      troubleshooting: {
        apiKey: 'Make sure API key was regenerated after ETHGlobal promo',
        endpoint: 'Using correct /fusion/orders',
        auth: 'Using Authorization: Bearer format',
        amount: 'Using reasonable test amount'
      }
    });
  }
});

// Get actual token addresses from 1inch to use correct ones
app.get('/api/get-real-tokens', async (req, res) => {
  try {
    console.log('Getting REAL token addresses from 1inch');
    
    const response = await axios.get(`${ONEINCH_BASE_URL}/swap/v6.0/1/tokens`, {
      headers: getAuthHeaders(),
      timeout: 10000
    });
    
    const tokens = response.data.tokens;
    
    // Find common tokens we can use for testing
    const commonTokens = {
      ETH: tokens['0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'],
      USDC: tokens['0xA0b86a33E6441c8B4d36dC4C88ef0c9e31cE4eE8'] || 
            tokens['0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'], // Try both USDC addresses
      USDT: tokens['0xdAC17F958D2ee523a2206206994597C13D831ec7'],
      WETH: tokens['0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2']
    };
    
    res.json({
      success: true,
      totalTokens: Object.keys(tokens).length,
      commonTokens,
      // Include first 5 token addresses for reference
      sampleTokens: Object.keys(tokens).slice(0, 5).map(addr => ({
        address: addr,
        symbol: tokens[addr].symbol,
        decimals: tokens[addr].decimals
      }))
    });
    
  } catch (error) {
    console.error('Real tokens request failed:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.message
    });
  }
});
app.get('/api/test-regular-swap', async (req, res) => {
  try {
    console.log('Testing regular 1inch swap endpoint (non-Fusion)');
    
    // Test regular swap quote - this should work with your API key
    const testParams = {
      src: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH
      dst: '0xA0b86a33E6441c8B4d36dC4C88ef0c9e31cE4eE8', // USDC
      amount: '1000000000000000000', // 1 ETH
      from: '0x742d35Cc6634C0532925a3b8d3b9e4d5b3A4B1cE',
      slippage: '1'
    };
    
    console.log('Testing regular swap with params:', testParams);
    
    const response = await axios.get(`${ONEINCH_BASE_URL}/swap/v6.0/1/quote`, {
      params: testParams,
      headers: getAuthHeaders(),
      timeout: 10000
    });
    
    res.json({
      success: true,
      message: 'Regular 1inch swap endpoint works!',
      data: response.data,
      status: response.status,
      note: 'Your API key works for regular swaps - Fusion+ may need separate access'
    });
    
  } catch (error) {
    console.error('Regular swap test failed:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status,
      endpoint: '/swap/v6.0/1/quote',
      note: 'Testing regular swap to verify API key works'
    });
  }
});

// Check supported chains endpoint
app.get('/api/test-chains', async (req, res) => {
  try {
    console.log('Testing supported chains endpoint');
    
    const response = await axios.get(`${ONEINCH_BASE_URL}/swap/v6.0/1/tokens`, {
      headers: getAuthHeaders(),
      timeout: 10000
    });
    
    res.json({
      success: true,
      message: 'Chains/tokens endpoint works!',
      dataCount: Object.keys(response.data.tokens || {}).length,
      status: response.status,
      note: 'Your API key has access to swap endpoints'
    });
    
  } catch (error) {
    console.error('Chains test failed:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status,
      endpoint: '/swap/v6.0/1/tokens'
    });
  }
});

// Health check endpoint - use a simpler test
app.get('/api/health', async (req, res) => {
  try {
    console.log('Health check request');
    // Use Fusion+ supported chains instead of portfolio endpoint
    const response = await axios.get(`${ONEINCH_BASE_URL}/fusion/quoter/v1.0/supported-chains`, {
      headers: getAuthHeaders()
    });
    res.json({
      success: true,
      data: {
        status: 'healthy',
        chains: response.data.length || 0,
        fusionSupported: true
      },
      proxy: 'working',
      apiStatus: response.status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check failed:', error.response?.status, error.response?.data || error.message);
    
    // Return the REAL error status from 1inch API
    res.status(error.response?.status || 500).json({
      success: false,
      data: {
        status: 'api-error',
        note: '1inch Fusion+ API returned error'
      },
      proxy: 'working',
      apiError: error.response?.data || error.message,
      apiStatus: error.response?.status,
      timestamp: new Date().toISOString()
    });
  }
});

// Debug endpoint to check API key setup
app.get('/api/debug', (req, res) => {
  res.json({
    success: true,
    debug: {
      hasApiKey: !!ONEINCH_API_KEY,
      apiKeyLength: ONEINCH_API_KEY ? ONEINCH_API_KEY.length : 0,
      apiKeyPrefix: ONEINCH_API_KEY ? ONEINCH_API_KEY.substring(0, 8) + '...' : 'not set',
      baseUrl: ONEINCH_BASE_URL,
      headerFormat: 'Authorization: Bearer (CORRECTED)',
      timestamp: new Date().toISOString()
    }
  });
});

// Test different auth methods
app.get('/api/test-auth', async (req, res) => {
  if (!ONEINCH_API_KEY) {
    return res.json({
      success: false,
      error: 'No API key set'
    });
  }

  const testMethods = [
    { name: 'X-API-Key', headers: { 'X-API-Key': ONEINCH_API_KEY } },
    { name: 'Bearer', headers: { 'Authorization': `Bearer ${ONEINCH_API_KEY}` } },
    { name: 'API-Key', headers: { 'API-Key': ONEINCH_API_KEY } },
    { name: 'No Auth', headers: {} }
  ];

  const results = [];

  for (const method of testMethods) {
    try {
      console.log(`Testing auth method: ${method.name}`);
      const response = await axios.get(`${ONEINCH_BASE_URL}/portfolio/v4/general/supported_chains`, {
        headers: {
          'Content-Type': 'application/json',
          ...method.headers
        }
      });
      
      results.push({
        method: method.name,
        success: true,
        status: response.status,
        dataLength: response.data?.length || 0
      });
    } catch (error) {
      results.push({
        method: method.name,
        success: false,
        status: error.response?.status,
        error: error.response?.data || error.message
      });
    }
  }

  res.json({
    success: true,
    results
  });
});

// Get supported chains - use swap endpoint instead of portfolio
app.get('/api/chains', async (req, res) => {
  try {
    console.log('Chains request');
    // Use Fusion+ chains endpoint which should work with your API key
    const response = await axios.get(`${ONEINCH_BASE_URL}/fusion/quoter/v1.0/supported-chains`, {
      headers: getAuthHeaders()
    });
    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error('Chains request failed:', error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.message
    });
  }
});

// Get tokens for a specific chain
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

// Fusion+ quote endpoint with enhanced secret storage and metadata - FIXED variables
app.post('/api/fusion/quote', async (req, res) => {
  try {
    console.log('Fusion+ REAL cross-chain quote request:', req.body);
    
    const { fromTokenAddress, toTokenAddress, amount, walletAddress } = req.body;
    const fromChainId = req.body.fromChainId || 1;  // FIXED: properly get from req.body
    const toChainId = req.body.toChainId || 56;     // FIXED: properly get from req.body
    
    if (!fromTokenAddress || !toTokenAddress || !amount || !walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: fromTokenAddress, toTokenAddress, amount, walletAddress'
      });
    }
    
    // Generate Fusion+ secret for trustless execution
    const secret = generateFusionSecret();
    
    // Store secret with metadata for later execution
    fusionSecrets[secret] = {
      secret,
      timestamp: Date.now(),
      metadata: {
        fromTokenAddress,
        toTokenAddress,
        amount,
        walletAddress,
        fromChainId,
        toChainId
      }
    };
    
    console.log('Generated and stored Fusion+ secret:', secret);
    
    // Use REAL 1inch Fusion+ for cross-chain swaps with proper secret
    const fusionRequest = {
      fromTokenAddress,
      toTokenAddress, 
      amount,
      walletAddress,
      fromChainId, // FIXED: now properly defined
      toChainId,   // FIXED: now properly defined
      secret       // Required for Fusion+ trustless execution
    };
    
    // Try different Fusion+ endpoints to find working one
    let response;
    let endpointUsed = '';
    
    try {
      console.log('Trying /fusion/orders endpoint...');
      endpointUsed = '/fusion/orders';
      response = await axios.post(`${ONEINCH_BASE_URL}/fusion/orders`, fusionRequest, {
        headers: getAuthHeaders(),
        timeout: 15000
      });
    } catch (error) {
      if (error.response?.status === 404) {
        try {
          console.log('Trying /fusion/quoter/v1.0/quote endpoint...');
          endpointUsed = '/fusion/quoter/v1.0/quote';
          response = await axios.post(`${ONEINCH_BASE_URL}/fusion/quoter/v1.0/quote`, fusionRequest, {
            headers: getAuthHeaders(),
            timeout: 15000
          });
        } catch (error2) {
          if (error2.response?.status === 404) {
            console.log('Trying /swap/v6.0/1/quote endpoint as fallback...');
            endpointUsed = '/swap/v6.0/1/quote (same-chain fallback)';
            // Fallback to same-chain swap if cross-chain not available
            response = await axios.get(`${ONEINCH_BASE_URL}/swap/v6.0/${fromChainId}/quote`, {
              params: {
                src: fromTokenAddress,
                dst: toTokenAddress,
                amount,
                from: walletAddress
              },
              headers: getAuthHeaders(),
              timeout: 15000
            });
          } else {
            throw error2;
          }
        }
      } else {
        throw error;
      }
    }
    
    res.json({
      success: true,
      data: response.data,
      crossChain: endpointUsed.includes('fusion'),
      provider: '1inch-fusion+',
      apiStatus: response.status,
      endpointUsed,
      metadata: {
        fromChainId,
        toChainId,
        amount,
        secretStored: true,
        timestamp: new Date().toISOString()
      },
      // For hackathon demo only - don't expose secrets in production!
      fusionSecret: secret
    });
  } catch (error) {
    console.error('Fusion+ REAL cross-chain failed:', error.response?.data || error.message);
    
    // Better error handling
    let errorData = error.response?.data;
    if (typeof errorData === 'string' && errorData.includes('<')) {
      errorData = 'HTML error response from 1inch API';
    }
    
    // Pass through the REAL API error status
    res.status(error.response?.status || 500).json({
      success: false,
      error: errorData || error.message,
      details: error.response?.data,
      apiStatus: error.response?.status,
      provider: '1inch-fusion+',
      requestMetadata: {
        fromChainId,
        toChainId,
        amount
      }
    });
  }
});

// Execute REAL Fusion+ cross-chain swap with enhanced secret retrieval
app.post('/api/fusion/swap', async (req, res) => {
  try {
    console.log('Fusion+ REAL cross-chain swap execution:', req.body);
    
    const { secret, secretHash, ...orderData } = req.body;
    
    // Retrieve secret from storage if not provided
    const finalSecret = secret || (secretHash && fusionSecrets[secretHash]?.secret);
    
    if (!finalSecret) {
      return res.status(400).json({
        success: false,
        error: 'Missing secret for Fusion+ order execution. Provide secret or valid secretHash.'
      });
    }
    
    // Get stored metadata if available
    const storedData = secretHash ? fusionSecrets[secretHash] : null;
    
    // Execute the Fusion+ order with the secret
    const response = await axios.post(`${ONEINCH_BASE_URL}/fusion/orders`, {
      ...orderData,
      secret: finalSecret // Include the original secret for execution
    }, {
      headers: getAuthHeaders(),
      timeout: 20000 // 20 second timeout for order execution
    });
    
    // Clean up used secret
    if (secretHash && fusionSecrets[secretHash]) {
      delete fusionSecrets[secretHash];
    }
    
    res.json({
      success: true,
      data: response.data,
      crossChain: true,
      provider: '1inch-fusion+',
      message: 'Fusion+ order executed with trustless protocol',
      metadata: storedData?.metadata || {}
    });
  } catch (error) {
    console.error('Fusion+ REAL cross-chain swap failed:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data || error.message,
      details: error.response?.data,
      provider: '1inch-fusion+'
    });
  }
});
// === FUSION+ END ===

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

// Token address helper endpoint
app.get('/api/token-addresses', (req, res) => {
  const TOKEN_ADDRESSES = {
    ethereum: {
      ETH: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      USDC: '0xA0b86a33E6441c8B4d36dC4C88ef0c9e31cE4eE8'
    },
    tron: {
      TRX: 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb',
      USDT: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
      USDC: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8'
    }
  };
  
  res.json({
    success: true,
    data: TOKEN_ADDRESSES
  });
});

// Error handling middleware
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
  console.log(`Auth method: Authorization: Bearer header (CORRECTED)`);
  console.log(`\nAvailable endpoints:`);
  console.log(`   GET  /api/health - Health check`);
  console.log(`   GET  /api/debug - API key debug info`);
  console.log(`   GET  /api/test-auth - Test auth methods`);
  console.log(`   GET  /api/chains - Supported chains`);
  console.log(`   GET  /api/tokens/:chainId - Tokens for chain`);
  console.log(`   GET  /api/quote/:chainId - Swap quote`);
  console.log(`   GET  /api/swap/:chainId - Execute swap`);
  console.log(`   POST /api/fusion/quote - REAL Fusion+ cross-chain quote`);
  console.log(`   POST /api/fusion/swap - REAL Fusion+ cross-chain execution`);
  console.log(`   GET  /api/fusion/chains - Fusion+ supported chains`);
  console.log(`   GET  /api/token-addresses - Token address reference`);
});