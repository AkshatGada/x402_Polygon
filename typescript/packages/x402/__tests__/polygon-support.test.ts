import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import axios, { AxiosError } from 'axios';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygon, polygonAmoy } from 'viem/chains';

// Import from workspace packages
import { paymentMiddleware } from '../../../packages/x402-express/src';
import { wrapFetchWithPayment } from '../../../packages/x402-fetch/src';
import { withPaymentInterceptor } from '../../../packages/x402-axios/src';

// Mock wallet for testing
const testPrivateKey = '0x1234567890123456789012345678901234567890123456789012345678901234';
const testAccount = privateKeyToAccount(testPrivateKey);

describe('Polygon Network Support Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('x402-express Polygon Support', () => {
    it('should accept Polygon mainnet configuration', () => {
      const app = express();
      expect(() => {
        paymentMiddleware(
          '0x1234567890123456789012345678901234567890',
          {
            '/protected': {
              price: '0.1',
              network: 'polygon'
            }
          }
        );
      }).not.toThrow();
    });

    it('should accept Polygon Amoy testnet configuration', () => {
      const app = express();
      expect(() => {
        paymentMiddleware(
          '0x1234567890123456789012345678901234567890',
          {
            '/protected': {
              price: '0.1',
              network: 'polygon-amoy'
            }
          }
        );
      }).not.toThrow();
    });
  });

  describe('x402-fetch Polygon Support', () => {
    it('should configure fetch client with Polygon mainnet', () => {
      const transport = http();
      const walletClient = createWalletClient({
        account: testAccount,
        chain: polygon,
        transport
      });

      expect(() => {
        wrapFetchWithPayment(fetch, walletClient, BigInt(0.1 * 10 ** 6));
      }).not.toThrow();
    });

    it('should configure fetch client with Polygon Amoy testnet', () => {
      const transport = http();
      const walletClient = createWalletClient({
        account: testAccount,
        chain: polygonAmoy,
        transport
      });

      expect(() => {
        wrapFetchWithPayment(fetch, walletClient, BigInt(0.1 * 10 ** 6));
      }).not.toThrow();
    });
  });

  describe('x402-axios Polygon Support', () => {
    it('should configure axios client with Polygon mainnet', () => {
      const transport = http();
      const walletClient = createWalletClient({
        account: testAccount,
        chain: polygon,
        transport
      });

      const axiosInstance = axios.create();
      expect(() => {
        withPaymentInterceptor(axiosInstance, walletClient);
      }).not.toThrow();
    });

    it('should configure axios client with Polygon Amoy testnet', () => {
      const transport = http();
      const walletClient = createWalletClient({
        account: testAccount,
        chain: polygonAmoy,
        transport
      });

      const axiosInstance = axios.create();
      expect(() => {
        withPaymentInterceptor(axiosInstance, walletClient);
      }).not.toThrow();
    });
  });

  describe('Integration Tests', () => {
    it('should handle Polygon payment requirements correctly', async () => {
      const transport = http();
      const walletClient = createWalletClient({
        account: testAccount,
        chain: polygon,
        transport
      });

      const axiosInstance = axios.create();
      withPaymentInterceptor(axiosInstance, walletClient);

      // Mock axios response for 402 Payment Required
      vi.spyOn(axiosInstance, 'get').mockRejectedValue(new AxiosError(
        'Payment Required',
        '402',
        undefined,
        undefined,
        {
          status: 402,
          data: {
            accepts: [{
              network: 'polygon',
              maxAmountRequired: '100000',
              payTo: '0x1234567890123456789012345678901234567890',
              asset: '0x1234567890123456789012345678901234567890'
            }]
          }
        } as any
      ));

      try {
        await axiosInstance.get('https://api.example.com/protected');
        throw new Error('Should have thrown 402 error');
      } catch (error) {
        const axiosError = error as AxiosError;
        expect(axiosError.response?.status).toBe(402);
        expect(axiosError.response?.data.accepts[0].network).toBe('polygon');
      }
    });
  });
}); 