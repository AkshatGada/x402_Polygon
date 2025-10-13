import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express, { Router, Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import { paymentMiddleware } from '../../../packages/x402-express/src';
import { wrapFetchWithPayment } from '../../../packages/x402-fetch/src';
import { withPaymentInterceptor } from '../../../packages/x402-axios/src';
import axios from 'axios';
import { createSigner } from '../src/types/shared/evm';

const FACILITATOR_URL = 'https://x402.polygon.technology';
const TEST_PORT = 5402;
const TEST_SERVER_URL = `http://localhost:${TEST_PORT}`;

// Test wallet configuration
const TEST_PRIVATE_KEY = 'c54698db0aca65242f49e5e84485d859c0fa41ee7a075d741eaa811da4b441c9';
const TEST_WALLET_ADDRESS = '0xCA3953e536bDA86D1F152eEfA8aC7b0C82b6eC00';

// Initialize wallet client
const signer = createSigner('polygon-amoy', `0x${TEST_PRIVATE_KEY}`);

describe('Facilitator Integration Tests', () => {
  let server: Server;

  beforeAll(async () => {
    const app = express();
    const router = Router();

    const middleware = paymentMiddleware(
      '0x1234567890123456789012345678901234567890',
      {
        '/protected': {
          price: '0.01',
          network: 'polygon-amoy'
        }
      },
      {
        url: FACILITATOR_URL
      }
    );

    router.use(middleware);

    router.get('/protected', (_req: Request, res: Response, _next: NextFunction) => {
      res.json({ message: 'Protected content' });
    });

    app.use(router);
    server = app.listen(TEST_PORT);
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  describe('x402-express Integration', () => {
    it('should return 402 for protected route without payment', async () => {
      const response = await fetch(`${TEST_SERVER_URL}/protected`);
      expect(response.status).toBe(402);
      const data = await response.json();
      expect(data).toHaveProperty('accepts');
      expect(data.accepts[0]).toHaveProperty('network', 'polygon-amoy');
    });
  });

  describe('x402-fetch Integration', () => {
    it('should handle payment required response', async () => {
      const wrappedFetch = wrapFetchWithPayment(
        fetch,
        signer
      );

      try {
        const response = await wrappedFetch(`${TEST_SERVER_URL}/protected`);
        expect(response.ok).toBe(false);
      } catch (error: any) {
        const response = await error.response;
        expect(response.status).toBe(402);
        const data = await response.json();
        expect(data).toHaveProperty('accepts');
        expect(data.accepts[0]).toHaveProperty('network', 'polygon-amoy');
      }
    });
  });

  describe('x402-axios Integration', () => {
    it('should handle payment required response', async () => {
      const client = axios.create();
      withPaymentInterceptor(client, signer);

      try {
        const response = await client.get(`${TEST_SERVER_URL}/protected`);
        expect(response.status).toBe(402);
      } catch (error: any) {
        expect(error.response.status).toBe(402);
        expect(error.response.data).toHaveProperty('accepts');
        expect(error.response.data.accepts[0]).toHaveProperty('network', 'polygon-amoy');
      }
    });
  });
}); 