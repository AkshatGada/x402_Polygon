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
    name: 'x402_check_payment',
    description: 'BUYER-SIDE: Check if wallet can afford payment from 402 response. Validates balance and spending limits before creating payment.',
    inputSchema: {
      paymentRequirements: z.any().describe('Payment requirements from 402 response accepts array'),
    },
    async handler(args: { paymentRequirements: PaymentRequirements }) {
      const requirement = args.paymentRequirements;
      const paymentAmount = BigInt(requirement.maxAmountRequired);

      // Get wallet and limits
      const storedWallet = await StorageService.getActiveWallet();
      const limits = await StorageService.getWalletLimits(storedWallet.address);

      // Check per-transaction limit
      const txLimitOk = !limits.maxTransactionAmount || paymentAmount <= limits.maxTransactionAmount;

      // Check daily limit
      const newDailyTotal = limits.dailySpent + paymentAmount;
      const dailyLimitOk = !limits.dailyLimit || newDailyTotal <= limits.dailyLimit;

      // Check approval threshold
      const needsApproval = limits.requireApproval && paymentAmount > limits.approvalThreshold;

      const canPay = txLimitOk && dailyLimitOk && !needsApproval;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            canPay,
            amount: formatUnits(paymentAmount, 6),
            network: requirement.network,
            checks: {
              transactionLimit: {
                ok: txLimitOk,
                amount: formatUnits(paymentAmount, 6),
                limit: limits.maxTransactionAmount
                  ? formatUnits(limits.maxTransactionAmount, 6)
                  : 'none',
              },
              dailyLimit: {
                ok: dailyLimitOk,
                spent: formatUnits(limits.dailySpent, 6),
                afterPayment: formatUnits(newDailyTotal, 6),
                limit: limits.dailyLimit ? formatUnits(limits.dailyLimit, 6) : 'none',
              },
              approval: {
                required: needsApproval,
                threshold: formatUnits(limits.approvalThreshold, 6),
              },
            },
            recommendation: canPay
              ? 'Payment can proceed'
              : needsApproval
                ? 'Manual approval required'
                : !txLimitOk
                  ? 'Exceeds per-transaction limit'
                  : 'Exceeds daily limit',
          }, null, 2),
        }],
      };
    },
  },

  {
    name: 'x402_verify',
    description: 'Verify an x402 payment header with the facilitator',
    inputSchema: {
      paymentHeader: z.string().describe('Base64 encoded X-PAYMENT header'),
      paymentRequirements: z.any().describe('Payment requirements from 402 response'),
    },
    async handler(args: { paymentHeader: string; paymentRequirements: PaymentRequirements }) {
      const result = await x402Service.verifyPayment(
        args.paymentHeader,
        args.paymentRequirements
      );

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    }
  },

  {
    name: 'x402_settle',
    description: 'Settle a verified payment on-chain via facilitator',
    inputSchema: {
      paymentHeader: z.string().describe('Base64 encoded X-PAYMENT header'),
      paymentRequirements: z.any().describe('Payment requirements for settlement'),
    },
    async handler(args: { paymentHeader: string; paymentRequirements: PaymentRequirements }) {
      const result = await x402Service.settlePayment(
        args.paymentHeader,
        args.paymentRequirements
      );

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    }
  },

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

