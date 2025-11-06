import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';
import { join } from 'path';
import { homedir } from 'os';
import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';

dotenvConfig();

const ConfigSchema = z.object({
  WALLET_ENCRYPTION_KEY: z.string().min(32, 'Encryption key must be at least 32 characters').optional(),
  NETWORK: z.enum(['polygon', 'polygon-amoy']).default('polygon-amoy'),
  RPC_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  STORAGE_DIR: z.string().default(join(homedir(), '.llm-wallet')),
  MAX_TX_AMOUNT: z.string().optional(),
  DAILY_LIMIT: z.string().optional(),
  REQUIRE_APPROVAL: z.string().transform(val => val === 'true').default('false'),
  APPROVAL_THRESHOLD: z.string().default('0.50'),
});

export type Config = z.infer<typeof ConfigSchema>;

export const NETWORKS = {
  'polygon-amoy': {
    chainId: 80002,
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    usdcAddress: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    facilitatorUrl: 'https://x402-amoy.polygon.technology',
  },
  'polygon': {
    chainId: 137,
    rpcUrl: 'https://polygon-rpc.com',
    usdcAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    facilitatorUrl: 'https://x402.org/facilitator',
  },
} as const;

// Parse environment variables
const rawConfig = ConfigSchema.parse(process.env);

// Function to get or create a persistent encryption key
function getOrCreateEncryptionKey(): string {
  const storageDir = rawConfig.STORAGE_DIR || join(homedir(), '.llm-wallet');
  const keyFile = join(storageDir, '.encryption-key');

  // If WALLET_ENCRYPTION_KEY is explicitly set in env, use it
  if (rawConfig.WALLET_ENCRYPTION_KEY) {
    return rawConfig.WALLET_ENCRYPTION_KEY;
  }

  // Check if key file exists
  if (existsSync(keyFile)) {
    try {
      const key = require('fs').readFileSync(keyFile, 'utf-8').trim();
      if (key.length >= 32) {
        return key;
      }
    } catch (error) {
      console.error('Failed to read encryption key file, generating new one:', error);
    }
  }

  // Generate new key
  const newKey = randomBytes(32).toString('hex');

  // Try to persist the key (non-blocking)
  try {
    require('fs').mkdirSync(storageDir, { recursive: true });
    require('fs').writeFileSync(keyFile, newKey, { mode: 0o600 });
    console.error(`Encryption key persisted to ${keyFile}`);
  } catch (error) {
    console.error('Warning: Could not persist encryption key to disk:', error);
  }

  return newKey;
}

// Get or create encryption key
const encryptionKey = getOrCreateEncryptionKey();

// Get network configuration
const network = rawConfig.NETWORK;
const networkConfig = NETWORKS[network];

// Create final config with auto-generated values
export const config = {
  ...rawConfig,
  WALLET_ENCRYPTION_KEY: encryptionKey,
  FACILITATOR_URL: networkConfig.facilitatorUrl,
  RPC_URL: rawConfig.RPC_URL || networkConfig.rpcUrl,
};

export type Network = keyof typeof NETWORKS;

