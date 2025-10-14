import { parseUnits, formatUnits } from 'viem';
import { StorageService } from '../services/index.js';
import type { SpendingLimits } from '../types/index.js';
import { z } from 'zod';

export const limitsTools = [
  {
    name: 'wallet_set_limit',
    description: 'Set spending limits for wallet (per-transaction and daily caps)',
    inputSchema: {
      maxTransactionAmount: z.string().optional().describe('Maximum USDC per transaction (e.g., "1.00")'),
      dailyLimit: z.string().optional().describe('Maximum USDC spend per 24 hours (e.g., "10.00")'),
      requireApproval: z.boolean().optional().default(false).describe('Require manual approval for amounts above threshold'),
      approvalThreshold: z.string().optional().default('0.50').describe('Amount requiring approval (e.g., "0.50")'),
    },
    async handler(args: {
      maxTransactionAmount?: string;
      dailyLimit?: string;
      requireApproval?: boolean;
      approvalThreshold?: string;
    }) {
      const wallet = await StorageService.getActiveWallet();

      const limits: SpendingLimits = {
        maxTransactionAmount: args.maxTransactionAmount
          ? parseUnits(args.maxTransactionAmount, 6)
          : undefined,
        dailyLimit: args.dailyLimit
          ? parseUnits(args.dailyLimit, 6)
          : undefined,
        requireApproval: args.requireApproval || false,
        approvalThreshold: parseUnits(args.approvalThreshold || '0.50', 6),
        dailySpent: BigInt(0),
        lastResetTimestamp: Date.now(),
      };

      await StorageService.saveWalletLimits(wallet.address, limits);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            address: wallet.address,
            limits: {
              maxTransactionAmount: args.maxTransactionAmount || 'unlimited',
              dailyLimit: args.dailyLimit || 'unlimited',
              requireApproval: args.requireApproval || false,
              approvalThreshold: args.approvalThreshold || '0.50'
            },
            message: 'Spending limits updated successfully'
          }, null, 2)
        }]
      };
    }
  },

  {
    name: 'wallet_get_limits',
    description: 'Get current spending limits and daily usage statistics',
    inputSchema: {},
    async handler() {
      const wallet = await StorageService.getActiveWallet();
      const limits = await StorageService.getWalletLimits(wallet.address);

      // Reset daily counter if 24 hours passed
      const now = Date.now();
      const hoursSinceReset = (now - limits.lastResetTimestamp) / (1000 * 60 * 60);
      if (hoursSinceReset >= 24) {
        limits.dailySpent = BigInt(0);
        limits.lastResetTimestamp = now;
        await StorageService.saveWalletLimits(wallet.address, limits);
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            address: wallet.address,
            limits: {
              maxTransactionAmount: limits.maxTransactionAmount
                ? formatUnits(limits.maxTransactionAmount, 6)
                : 'unlimited',
              dailyLimit: limits.dailyLimit
                ? formatUnits(limits.dailyLimit, 6)
                : 'unlimited',
              dailySpent: formatUnits(limits.dailySpent, 6),
              remainingToday: limits.dailyLimit
                ? formatUnits(limits.dailyLimit - limits.dailySpent, 6)
                : 'unlimited',
              requireApproval: limits.requireApproval,
              approvalThreshold: formatUnits(limits.approvalThreshold, 6),
              lastReset: new Date(limits.lastResetTimestamp).toISOString()
            }
          }, null, 2)
        }]
      };
    }
  }
];

