import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StorageService } from './storage.service';
import { promises as fs } from 'fs';
import { join } from 'path';
import type { StoredWallet, SpendingLimits, PaymentHistory } from '../types/index';

// Mock config
vi.mock('../config/index.js', () => ({
  config: {
    STORAGE_DIR: '/tmp/.llm-wallet-test',
    WALLET_ENCRYPTION_KEY: 'test-key',
    NETWORK: 'polygon-amoy',
    FACILITATOR_URL: 'https://test.com',
    LOG_LEVEL: 'error',
  },
}));

describe('StorageService', () => {
  const testDir = '/tmp/.llm-wallet-test';

  beforeEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true });
    } catch {
      // Ignore if doesn't exist
    }
    await StorageService.init();
  });

  afterEach(async () => {
    // Clean up
    try {
      await fs.rm(testDir, { recursive: true });
    } catch {
      // Ignore
    }
  });

  describe('init', () => {
    it('should create storage directory', async () => {
      const stat = await fs.stat(testDir);
      expect(stat.isDirectory()).toBe(true);
    });

    it('should create wallet file', async () => {
      const walletFile = join(testDir, 'wallets.json');
      const content = await fs.readFile(walletFile, 'utf-8');
      expect(content).toBe('[]');
    });
  });

  describe('wallet operations', () => {
    const mockWallet: StoredWallet = {
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
      encryptedPrivateKey: 'encrypted-key',
      label: 'test-wallet',
      createdAt: Date.now(),
    };

    it('should save wallet', async () => {
      await StorageService.saveWallet(mockWallet);
      const wallets = await StorageService.getWallets();

      expect(wallets).toHaveLength(1);
      expect(wallets[0]).toEqual(mockWallet);
    });

    it('should get wallet by address', async () => {
      await StorageService.saveWallet(mockWallet);
      const wallet = await StorageService.getWallet(mockWallet.address);

      expect(wallet).toEqual(mockWallet);
    });

    it('should get wallet case-insensitively', async () => {
      await StorageService.saveWallet(mockWallet);
      const wallet = await StorageService.getWallet(mockWallet.address.toUpperCase());

      expect(wallet).toEqual(mockWallet);
    });

    it('should throw if wallet not found', async () => {
      await expect(
        StorageService.getWallet('0xinvalid')
      ).rejects.toThrow('Wallet not found');
    });

    it('should get active wallet (most recent)', async () => {
      const wallet1 = { ...mockWallet, createdAt: 1000 };
      const wallet2 = { ...mockWallet, address: '0x123', createdAt: 2000 };

      await StorageService.saveWallet(wallet1);
      await StorageService.saveWallet(wallet2);

      const active = await StorageService.getActiveWallet();
      expect(active.address).toBe(wallet2.address);
    });
  });

  describe('spending limits operations', () => {
    const address1 = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';
    const address2 = '0x123456789abcdef123456789abcdef1234567890';
    const limits: SpendingLimits = {
      maxTransactionAmount: BigInt(1000000), // 1 USDC
      dailyLimit: BigInt(10000000), // 10 USDC
      dailySpent: BigInt(0),
      lastResetTimestamp: Date.now(),
      requireApproval: false,
      approvalThreshold: BigInt(500000), // 0.5 USDC
    };

    it('should save and retrieve spending limits', async () => {
      await StorageService.saveWalletLimits(address1, limits);
      const retrieved = await StorageService.getWalletLimits(address1);

      expect(retrieved.maxTransactionAmount).toBe(limits.maxTransactionAmount);
      expect(retrieved.dailyLimit).toBe(limits.dailyLimit);
      expect(retrieved.dailySpent).toBe(limits.dailySpent);
    });

    it('should return default limits if none exist', async () => {
      const retrieved = await StorageService.getWalletLimits(address2);

      expect(retrieved.dailySpent).toBe(BigInt(0));
      expect(retrieved.requireApproval).toBe(false);
      expect(retrieved.maxTransactionAmount).toBeUndefined();
    });

    it('should convert BigInt to string for storage', async () => {
      const testAddress = '0x999';
      await StorageService.saveWalletLimits(testAddress, limits);

      const file = join(testDir, 'limits.json');
      const content = JSON.parse(await fs.readFile(file, 'utf-8'));

      expect(typeof content[testAddress.toLowerCase()].dailySpent).toBe('string');
    });
  });

  describe('payment history operations', () => {
    const payment: PaymentHistory = {
      id: 'test-123',
      timestamp: Date.now(),
      paymentHeader: 'base64-header',
      verified: true,
      settled: false,
      amount: '0.01',
      network: 'polygon-amoy',
    };

    it('should save payment to history', async () => {
      await StorageService.savePayment(payment);
      const history = await StorageService.getHistory();

      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(payment);
    });

    it('should retrieve paginated history', async () => {
      // First, clear any existing payments
      const historyFile = join(testDir, 'history.json');
      await fs.writeFile(historyFile, '[]');

      const payments = Array.from({ length: 15 }, (_, i) => ({
        ...payment,
        id: `payment-${i}`,
        timestamp: Date.now() + i, // Ensure different timestamps
      }));

      for (const p of payments) {
        await StorageService.savePayment(p);
      }

      const page1 = await StorageService.getHistory(10, 0);
      const page2 = await StorageService.getHistory(10, 10);

      expect(page1.length).toBeGreaterThanOrEqual(10);
      expect(page2.length).toBeGreaterThanOrEqual(5);
    });
  });
});

