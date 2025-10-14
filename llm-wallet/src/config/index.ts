import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';
import { join } from 'path';
import { homedir } from 'os';

dotenvConfig();

const ConfigSchema = z.object({
  WALLET_ENCRYPTION_KEY: z.string().min(32, 'Encryption key must be at least 32 characters'),
  NETWORK: z.enum(['polygon', 'polygon-amoy']),
  FACILITATOR_URL: z.string().url().default('https://x402-amoy.polygon.technology'),
  RPC_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  STORAGE_DIR: z.string().default(join(homedir(), '.llm-wallet')),
  MAX_TX_AMOUNT: z.string().optional(),
  DAILY_LIMIT: z.string().optional(),
  REQUIRE_APPROVAL: z.string().transform(val => val === 'true').default('false'),
  APPROVAL_THRESHOLD: z.string().default('0.50'),
});

export type Config = z.infer<typeof ConfigSchema>;

export const config = ConfigSchema.parse(process.env);

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

export type Network = keyof typeof NETWORKS;

