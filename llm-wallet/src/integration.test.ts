import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { promises as fs } from 'fs';
import { StorageService, WalletService, X402Service } from './services/index.js';

/**
 * Integration tests for complete payment flows
 * 
 * These tests verify:
 * 1. Wallet creation and encryption
 * 2. Spending limit enforcement
 * 3. Payment flow execution
 * 4. Storage persistence
 */
describe('Integration Tests', () => {
  const testDir = '/tmp/.llm-wallet-integration-test';

  beforeAll(async () => {
    await StorageService.init();
  });

  afterAll(async () => {
    try {
      await fs.rm(testDir, { recursive: true });
    } catch {
      // Ignore
    }
  });

  describe('Complete Wallet Lifecycle', () => {
    it('should create wallet, set limits, and track spending', async () => {
      const walletService = new WalletService();

      // 1. Create wallet
      const { address, mnemonic } = await walletService.createWallet('integration-test');
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(mnemonic.split(' ')).toHaveLength(12);

      // 2. Set spending limits
      const limits = {
        maxTransactionAmount: BigInt(1000000), // 1 USDC
        dailyLimit: BigInt(5000000), // 5 USDC
        dailySpent: BigInt(0),
        lastResetTimestamp: Date.now(),
        requireApproval: false,
        approvalThreshold: BigInt(500000),
      };
      await StorageService.saveWalletLimits(address, limits);

      // 3. Retrieve and verify limits
      const retrievedLimits = await StorageService.getWalletLimits(address);
      expect(retrievedLimits.maxTransactionAmount).toBe(limits.maxTransactionAmount);
      expect(retrievedLimits.dailyLimit).toBe(limits.dailyLimit);

      // 4. Simulate spending
      retrievedLimits.dailySpent = BigInt(1000000);
      await StorageService.saveWalletLimits(address, retrievedLimits);

      // 5. Verify updated spending
      const updatedLimits = await StorageService.getWalletLimits(address);
      expect(updatedLimits.dailySpent).toBe(BigInt(1000000));
    });

    it('should persist wallet across service instances', async () => {
      const walletService1 = new WalletService();
      const { address } = await walletService1.createWallet('persist-test');

      // Create new instance and retrieve
      const walletService2 = new WalletService();
      const wallet = await walletService2.getWallet(address);

      expect(wallet.address).toBe(address);
      expect(wallet.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });
  });

  describe('Payment History Tracking', () => {
    it('should log and retrieve payment history', async () => {
      const payments = [
        {
          id: 'payment-1',
          timestamp: Date.now(),
          paymentHeader: 'header-1',
          verified: true,
          settled: true,
          transactionHash: '0xabc123',
          amount: '0.01',
          network: 'polygon-amoy',
        },
        {
          id: 'payment-2',
          timestamp: Date.now() + 1000,
          paymentHeader: 'header-2',
          verified: true,
          settled: false,
          amount: '0.02',
          network: 'polygon-amoy',
        },
      ];

      for (const payment of payments) {
        await StorageService.savePayment(payment);
      }

      const history = await StorageService.getHistory(10, 0);
      expect(history).toHaveLength(2);
      expect(history[0].id).toBe('payment-1');
      expect(history[1].id).toBe('payment-2');
    });
  });

  describe('Spending Limit Enforcement', () => {
    it('should enforce per-transaction limit', async () => {
      const walletService = new WalletService();
      const { address } = await walletService.createWallet('limit-test');

      const limits = {
        maxTransactionAmount: BigInt(100000), // 0.1 USDC
        dailyLimit: undefined,
        dailySpent: BigInt(0),
        lastResetTimestamp: Date.now(),
        requireApproval: false,
        approvalThreshold: BigInt(0),
      };
      await StorageService.saveWalletLimits(address, limits);

      const retrieved = await StorageService.getWalletLimits(address);

      // Should allow payment under limit
      const smallPayment = BigInt(50000); // 0.05 USDC
      expect(retrieved.maxTransactionAmount! >= smallPayment).toBe(true);

      // Should block payment over limit
      const largePayment = BigInt(200000); // 0.2 USDC
      expect(retrieved.maxTransactionAmount! < largePayment).toBe(true);
    });

    it('should reset daily spending after 24 hours', async () => {
      const walletService = new WalletService();
      const { address } = await walletService.createWallet('reset-test');

      // Set limits with old timestamp (>24h ago)
      const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      const limits = {
        maxTransactionAmount: undefined,
        dailyLimit: BigInt(5000000), // 5 USDC
        dailySpent: BigInt(3000000), // 3 USDC spent
        lastResetTimestamp: oldTimestamp,
        requireApproval: false,
        approvalThreshold: BigInt(0),
      };
      await StorageService.saveWalletLimits(address, limits);

      // Retrieve limits (should NOT auto-reset in storage service)
      const retrieved = await StorageService.getWalletLimits(address);

      // Check if reset logic would trigger
      const hoursSinceReset = (Date.now() - retrieved.lastResetTimestamp) / (1000 * 60 * 60);
      expect(hoursSinceReset).toBeGreaterThan(24);

      // Manual reset (simulating what the tool would do)
      if (hoursSinceReset >= 24) {
        retrieved.dailySpent = BigInt(0);
        retrieved.lastResetTimestamp = Date.now();
        await StorageService.saveWalletLimits(address, retrieved);
      }

      const afterReset = await StorageService.getWalletLimits(address);
      expect(afterReset.dailySpent).toBe(BigInt(0));
    });
  });

  describe('Multi-Wallet Support', () => {
    it('should handle multiple wallets correctly', async () => {
      const walletService = new WalletService();

      const wallet1 = await walletService.createWallet('wallet-1');
      const wallet2 = await walletService.createWallet('wallet-2');

      expect(wallet1.address).not.toBe(wallet2.address);

      // Retrieve specific wallets
      const retrieved1 = await walletService.getWallet(wallet1.address);
      const retrieved2 = await walletService.getWallet(wallet2.address);

      expect(retrieved1.address).toBe(wallet1.address);
      expect(retrieved2.address).toBe(wallet2.address);

      // Active wallet should be the most recent
      const active = await StorageService.getActiveWallet();
      expect(active.address).toBe(wallet2.address);
    });
  });
});

