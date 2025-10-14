import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { X402Service } from '../services/x402.service.js';
import { PaymentRequirements } from 'x402/types';
import { z } from 'zod';

const x402Service = new X402Service();

/**
 * SELLER-SIDE MCP Tools
 * 
 * These tools help sellers manage payment-protected resources:
 * - Verify incoming payments
 * - Settle verified payments
 * - Decode payment headers
 * - Generate payment requirements
 */

export const sellerTools: Tool[] = [
  {
    name: 'seller_verify_payment',
    description: 'SELLER-SIDE: Verify an incoming payment from a buyer. Call this when you receive X-Payment header.',
    inputSchema: {
      paymentHeader: z.string().describe('X-Payment header value from buyer request'),
      paymentRequirements: z.any().describe('Your payment requirements (scheme, network, amount, etc.)'),
    },
    async handler(args: { paymentHeader: string; paymentRequirements: PaymentRequirements }) {
      try {
        // Decode payment first
        const decoded = x402Service.decodePaymentHeader(args.paymentHeader);

        // Verify with facilitator
        const result = await x402Service.verifyPayment(
          args.paymentHeader,
          args.paymentRequirements
        );

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              isValid: result.isValid,
              payer: result.payer,
              invalidReason: result.invalidReason,
              paymentDetails: {
                from: decoded.from,
                to: decoded.to,
                value: decoded.value,
                validBefore: new Date(Number(decoded.validBefore) * 1000).toISOString(),
                nonce: decoded.nonce,
              },
              nextStep: result.isValid
                ? 'Execute protected business logic, then call seller_settle_payment'
                : 'Return 402 error to buyer with invalidReason',
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              isValid: false,
              error: error instanceof Error ? error.message : String(error),
              nextStep: 'Return 402 error to buyer',
            }, null, 2),
          }],
        };
      }
    },
  },

  {
    name: 'seller_settle_payment',
    description: 'SELLER-SIDE: Settle a verified payment on-chain. Call this AFTER executing protected logic successfully.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        paymentHeader: {
          type: 'string',
          description: 'X-Payment header value (same one you verified)',
        },
        paymentRequirements: {
          type: 'object',
          description: 'Your payment requirements (same as verification)',
        },
      },
      required: ['paymentHeader', 'paymentRequirements'],
    },
    async handler(args: { paymentHeader: string; paymentRequirements: PaymentRequirements }) {
      try {
        const result = await x402Service.settlePayment(
          args.paymentHeader,
          args.paymentRequirements
        );

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: result.success,
              transactionHash: result.transactionHash,
              error: result.error,
              nextStep: result.success
                ? 'Return resource to buyer with X-PAYMENT-RESPONSE header'
                : 'Log settlement failure, optionally return resource anyway (payment was verified)',
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
              recommendation: 'Log error for manual review. Payment was verified, so consider returning resource.',
            }, null, 2),
          }],
        };
      }
    },
  },

  {
    name: 'seller_decode_payment',
    description: 'SELLER-SIDE: Decode payment header to inspect authorization details without calling facilitator.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        paymentHeader: {
          type: 'string',
          description: 'X-Payment header value from buyer',
        },
      },
      required: ['paymentHeader'],
    },
    async handler(args: { paymentHeader: string }) {
      try {
        const decoded = x402Service.decodePaymentHeader(args.paymentHeader);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              from: decoded.from,
              to: decoded.to,
              value: decoded.value,
              validAfter: new Date(Number(decoded.validAfter) * 1000).toISOString(),
              validBefore: new Date(Number(decoded.validBefore) * 1000).toISOString(),
              nonce: decoded.nonce,
              signature: {
                v: decoded.v,
                r: decoded.r,
                s: decoded.s,
              },
              note: 'Decoded successfully. Call seller_verify_payment to validate with facilitator.',
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: 'Malformed payment header',
              details: error instanceof Error ? error.message : String(error),
              recommendation: 'Return 402 error to buyer with "Invalid payment header format"',
            }, null, 2),
          }],
        };
      }
    },
  },

  {
    name: 'seller_create_requirements',
    description: 'SELLER-SIDE: Generate payment requirements for a protected resource.',
    inputSchema: {
      price: z.string().describe('Price in dollars (e.g., "$0.001") or atomic units (e.g., "1000")'),
      network: z.string().describe('Network name (e.g., "polygon-amoy", "base-sepolia")'),
      payTo: z.string().describe('Your receiving wallet address'),
      resourceUrl: z.string().describe('URL of protected resource'),
      description: z.string().optional().describe('Resource description (optional)'),
      inputSchema: z.any().optional().describe('JSON Schema for input parameters (optional)'),
      outputSchema: z.any().optional().describe('JSON Schema for output format (optional)'),
    },
    async handler(args: {
      price: string;
      network: string;
      payTo: string;
      resourceUrl: string;
      description?: string;
      inputSchema?: any;
      outputSchema?: any;
    }) {
      // Parse price to atomic units
      let maxAmountRequired: string;
      if (args.price.startsWith('$')) {
        const dollars = parseFloat(args.price.substring(1));
        maxAmountRequired = (dollars * 1_000_000).toString(); // USDC has 6 decimals
      } else {
        maxAmountRequired = args.price;
      }

      // Get asset address for network
      const assetAddresses: Record<string, string> = {
        'polygon-amoy': '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
        'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        'polygon': '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      };

      const asset = assetAddresses[args.network] || assetAddresses['polygon-amoy'];

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: args.network as any,
        maxAmountRequired,
        resource: args.resourceUrl as any,
        description: args.description || '',
        mimeType: 'application/json',
        payTo: args.payTo as any,
        maxTimeoutSeconds: 60,
        asset: asset as any,
        outputSchema: {
          input: {
            type: 'http',
            method: 'GET',
            discoverable: true,
            ...(args.inputSchema || {}),
          },
          output: args.outputSchema,
        },
        extra: {}, // Would need full EIP-712 domain
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            requirements,
            usage: {
              '402Response': {
                x402Version: 1,
                error: 'X-PAYMENT header is required',
                accepts: [requirements],
              },
              expressMiddleware: {
                code: `app.use(paymentMiddleware("${args.payTo}", { "GET ${new URL(args.resourceUrl).pathname}": { price: "${args.price}", network: "${args.network}" } }))`,
              },
            },
          }, null, 2),
        }],
      };
    },
  },

  {
    name: 'seller_generate_402_response',
    description: 'SELLER-SIDE: Generate a complete 402 Payment Required response for when buyer has no X-Payment header.',
    inputSchema: {
      requirements: z.array(z.any()).describe('Array of payment requirements (from seller_create_requirements)'),
      customError: z.string().optional().describe('Custom error message (optional)'),
    },
    async handler(args: { requirements: PaymentRequirements[]; customError?: string }) {
      const response = {
        statusCode: 402,
        headers: {
          'Content-Type': 'application/json',
        },
        body: {
          x402Version: 1,
          error: args.customError || 'X-PAYMENT header is required',
          accepts: args.requirements,
        },
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            response,
            usage: {
              express: 'res.status(402).json(response.body)',
              fetch: 'return new Response(JSON.stringify(response.body), { status: 402, headers: response.headers })',
              nextjs: 'return NextResponse.json(response.body, { status: 402 })',
            },
          }, null, 2),
        }],
      };
    },
  },
];

