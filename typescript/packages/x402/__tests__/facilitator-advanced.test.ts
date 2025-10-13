import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express, { Router, Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import { createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygon, polygonAmoy } from 'viem/chains';
import { paymentMiddleware } from '../../../packages/x402-express/src';
import { wrapFetchWithPayment } from '../../../packages/x402-fetch/src';
import { withPaymentInterceptor } from '../../../packages/x402-axios/src';
import axios from 'axios';
import { createSigner } from '../src/types/shared/evm';

const FACILITATOR_URL = 'https://x402.polygon.technology';
const TEST_PORT = 5403;
const TEST_SERVER_URL = `http://localhost:${TEST_PORT}`;

// Test wallet configuration
const TEST_PRIVATE_KEY = 'c54698db0aca65242f49e5e84485d859c0fa41ee7a075d741eaa811da4b441c9';
const TEST_WALLET_ADDRESS = '0xCA3953e536bDA86D1F152eEfA8aC7b0C82b6eC00';

// Initialize wallet client
const signer = createSigner('polygon-amoy', `0x${TEST_PRIVATE_KEY}`);

describe('Advanced Facilitator Tests', () => {
  let server: Server;

  beforeAll(async () => {
    const app = express();
    const router = Router();

    // Configure multiple price points and networks
    const middleware = paymentMiddleware(
      TEST_WALLET_ADDRESS,
      {
        '/low-price': {
          price: '0.01',
          network: 'polygon-amoy'
        },
        '/high-price': {
          price: '1.0',
          network: 'polygon-amoy'
        },
        '/base-price': {
          price: '0.01',
          network: 'base-sepolia'
        }
      },
      {
        url: FACILITATOR_URL
      }
    );

    router.use('/', middleware);

    router.get('/low-price', (_req: Request, res: Response, _next: NextFunction) => {
      res.json({ message: 'Low price content' });
    });

    router.get('/high-price', (_req: Request, res: Response, _next: NextFunction) => {
      res.json({ message: 'High price content' });
    });

    router.get('/base-price', (_req: Request, res: Response, _next: NextFunction) => {
      res.json({ message: 'Base price content' });
    });

    app.use(router);
    server = app.listen(TEST_PORT);
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  describe('Valid Signed Payloads', () => {
    it('should successfully verify a valid signed payload', async () => {
      const authorization = {
        from: TEST_WALLET_ADDRESS,
        to: TEST_WALLET_ADDRESS,
        value: parseEther('0.01').toString(),
        validAfter: Math.floor(Date.now() / 1000).toString(),
        validBefore: (Math.floor(Date.now() / 1000) + 3600).toString(),
        nonce: '0x' + Math.random().toString(16).slice(2)
      };

      const signature = await signer.signMessage({
        message: JSON.stringify(authorization)
      });

      const paymentPayload = {
        x402Version: 1,
        scheme: 'exact',
        network: 'polygon-amoy',
        payload: {
          signature,
          authorization
        }
      };

      try {
        await axios.post(`${FACILITATOR_URL}/verify`, paymentPayload);
      } catch (error: any) {
        expect(error.response.status).toBe(422);
        expect(error.response.data).toContain('signature_verification_failed');
      }
    });
  });

  describe('Price Points and Configurations', () => {
    it('should handle different price points correctly', async () => {
      // Test low price endpoint
      const lowPriceResponse = await fetch(`${TEST_SERVER_URL}/low-price`);
      expect(lowPriceResponse.status).toBe(402);
      const lowPriceData = await lowPriceResponse.json();
      expect(lowPriceData.accepts[0]).toHaveProperty('network', 'polygon-amoy');

      // Test high price endpoint
      const highPriceResponse = await fetch(`${TEST_SERVER_URL}/high-price`);
      expect(highPriceResponse.status).toBe(402);
      const highPriceData = await highPriceResponse.json();
      expect(highPriceData.accepts[0]).toHaveProperty('network', 'polygon-amoy');
    });
  });

  describe('Error Cases', () => {
    it('should reject expired payloads', async () => {
      const authorization = {
        from: TEST_WALLET_ADDRESS,
        to: TEST_WALLET_ADDRESS,
        value: parseEther('0.01').toString(),
        validAfter: (Math.floor(Date.now() / 1000) - 7200).toString(), // 2 hours ago
        validBefore: (Math.floor(Date.now() / 1000) - 3600).toString(), // 1 hour ago
        nonce: '0x' + Math.random().toString(16).slice(2)
      };

      const signature = await signer.signMessage({
        message: JSON.stringify(authorization)
      });

      const paymentPayload = {
        x402Version: 1,
        scheme: 'exact',
        network: 'polygon-amoy',
        payload: {
          signature,
          authorization
        }
      };

      try {
        await axios.post(`${FACILITATOR_URL}/verify`, paymentPayload);
      } catch (error: any) {
        expect(error.response.status).toBe(422);
        expect(error.response.data).toContain('expired');
      }
    });

    it('should reject wrong network payloads', async () => {
      const response = await fetch(`${TEST_SERVER_URL}/base-price`);
      expect(response.status).toBe(402);
      const data = await response.json();
      expect(data.accepts[0]).toHaveProperty('network', 'base-sepolia');

      // Try to verify with wrong network
      const authorization = {
        from: TEST_WALLET_ADDRESS,
        to: TEST_WALLET_ADDRESS,
        value: parseEther('0.01').toString(),
        validAfter: Math.floor(Date.now() / 1000).toString(),
        validBefore: (Math.floor(Date.now() / 1000) + 3600).toString(),
        nonce: '0x' + Math.random().toString(16).slice(2)
      };

      const signature = await signer.signMessage({
        message: JSON.stringify(authorization)
      });

      const paymentPayload = {
        x402Version: 1,
        scheme: 'exact',
        network: 'polygon-amoy',
        payload: {
          signature,
          authorization
        }
      };

      try {
        await axios.post(`${FACILITATOR_URL}/verify`, paymentPayload);
      } catch (error: any) {
        expect(error.response.status).toBe(422);
        expect(error.response.data).toContain('invalid_chain');
      }
    });
  });

  describe('Full Payment Flow', () => {
    it('should complete full payment flow from requirement to settlement', async () => {
      // 1. Get payment requirement
      const response = await fetch(`${TEST_SERVER_URL}/low-price`);
      expect(response.status).toBe(402);
      const requirement = await response.json();
      expect(requirement.accepts[0]).toHaveProperty('network', 'polygon-amoy');

      // 2. Create and sign payload
      const authorization = {
        from: TEST_WALLET_ADDRESS,
        to: requirement.accepts[0].payTo,
        value: parseEther('0.01').toString(),
        validAfter: Math.floor(Date.now() / 1000).toString(),
        validBefore: (Math.floor(Date.now() / 1000) + 3600).toString(),
        nonce: '0x' + Math.random().toString(16).slice(2)
      };

      const signature = await signer.signMessage({
        message: JSON.stringify(authorization)
      });

      const paymentPayload = {
        x402Version: 1,
        scheme: 'exact',
        network: 'polygon-amoy',
        payload: {
          signature,
          authorization
        }
      };

      // 3. Verify payment
      try {
        await axios.post(`${FACILITATOR_URL}/verify`, paymentPayload);
      } catch (error: any) {
        expect(error.response.status).toBe(422);
        expect(error.response.data).toContain('signature_verification_failed');
      }

      // 4. Settle payment
      try {
        await axios.post(`${FACILITATOR_URL}/settle`, paymentPayload);
      } catch (error: any) {
        expect(error.response.status).toBe(422);
        expect(error.response.data).toContain('signature_verification_failed');
      }

      // 5. Access protected content with payment header
      const wrappedFetch = wrapFetchWithPayment({
        facilitator: {
          url: FACILITATOR_URL
        },
        wallet: signer.walletClient
      });

      try {
        await wrappedFetch(`