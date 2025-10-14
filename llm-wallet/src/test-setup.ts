// Test setup - sets environment variables before any imports
process.env.STORAGE_DIR = process.env.STORAGE_DIR || '/tmp/.llm-wallet-test';
process.env.WALLET_ENCRYPTION_KEY = process.env.WALLET_ENCRYPTION_KEY || 'test-encryption-key-32-characters-long-minimum';
process.env.NETWORK = process.env.NETWORK || 'polygon-amoy';
process.env.FACILITATOR_URL = process.env.FACILITATOR_URL || 'https://x402-amoy.polygon.technology';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';

