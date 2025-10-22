import { formatUnits } from 'viem';
import { WalletService, StorageService, X402Service } from '../services/index.js';
import type { PaymentRequirements } from 'x402/types';
import { randomUUID } from 'crypto';
import { decodeXPaymentResponse } from 'x402-fetch';
import { z } from 'zod';

const walletService = new WalletService();
const x402Service = new X402Service();

export const x402Tools = [
  {
    name: 'x402_pay',
    description: 'BUYER-SIDE: Make payment to x402-protected resource using x402-fetch. Automatically handles 402 response, creates payment, and retries.',
    inputSchema: {
      resourceUrl: z.string().describe('URL of x402-protected resource'),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).optional().describe('HTTP method (GET, POST, etc.)'),
      body: z.string().optional().describe('Request body (JSON string, optional for GET)'),
      headers: z.record(z.string()).optional().describe('Additional headers (optional)'),
    },
    async handler(args: {
      resourceUrl: string;
      method?: string;
      body?: string;
      headers?: Record<string, string>;
    }) {
      const wallet = await walletService.getWallet();
      const storedWallet = await StorageService.getActiveWallet();
      const limits = await StorageService.getWalletLimits(storedWallet.address);

      // Create x402-fetch wrapped client
      const fetchWithPayment = await x402Service.createBuyerFetch(
        wallet.privateKey,
        limits.maxTransactionAmount || BigInt(10 * 10 ** 6)
      );

      // Make request - x402-fetch handles 402 automatically
      const response = await fetchWithPayment(args.resourceUrl, {
        method: args.method || 'GET',
        headers: args.headers,
        body: args.body,
      });

      // Decode X-PAYMENT-RESPONSE header if present
      const paymentResponseHeader = response.headers.get('X-PAYMENT-RESPONSE');
      let settlementInfo = null;
      if (paymentResponseHeader) {
        try {
          settlementInfo = decodeXPaymentResponse(paymentResponseHeader);
        } catch (e) {
          // Ignore decode errors
        }
      }

      // Get response data
      const contentType = response.headers.get('content-type');
      let data: any;
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      // Log successful payment
      if (response.ok && settlementInfo) {
        await StorageService.savePayment({
          id: randomUUID(),
          timestamp: Date.now(),
          paymentHeader: '', // x402-fetch handled this
          verified: true,
          settled: true,
          amount: settlementInfo.value ? formatUnits(BigInt(settlementInfo.value), 6) : '0',
          network: storedWallet.network,
          resource: args.resourceUrl,
        });
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: response.ok,
            status: response.status,
            data,
            payment: settlementInfo ? {
              settled: true,
              payer: settlementInfo.from,
              payee: settlementInfo.to,
              amount: settlementInfo.value ? formatUnits(BigInt(settlementInfo.value), 6) : '0',
              transactionHash: settlementInfo.transactionHash,
            } : null,
            note: 'x402-fetch automatically handled payment flow (402 → pay → retry)'
          }, null, 2)
        }]
      };
    }
  }
];

