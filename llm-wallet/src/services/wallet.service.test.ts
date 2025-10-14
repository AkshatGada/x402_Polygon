import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WalletService } from './wallet.service';
import { StorageService } from './storage.service';

// Mock StorageService
vi.mock('./storage.service', () => ({
  StorageService: {
    saveWallet: vi.fn(),
    getWallet: vi.fn(),
    getActiveWallet: vi.fn(),
  },
}));

// Mock config
vi.mock('../config/index.js', () => ({
  config: {
    WALLET_ENCRYPTION_KEY: 'test-encryption-key-32-characters-long',
    NETWORK: 'polygon-amoy',
    FACILITATOR_URL: 'https://x402-amoy.polygon.technology',
    LOG_LEVEL: 'error',
    STORAGE_DIR: '/tmp/.llm-wallet-test',
  },
  NETWORKS: {
    'polygon-amoy': {
      chainId: 80002,
      rpcUrl: 'https://rpc-amoy.polygon.technology',
      usdcAddress: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
      facilitatorUrl: 'https://x402-amoy.polygon.technology',
    },
  },
}));

describe('WalletService', () => {
  let walletService: WalletService;

  beforeEach(() => {
    walletService = new WalletService();
    vi.clearAllMocks();
  });

  describe('createWallet', () => {
    it('should create HD wallet with valid address and mnemonic', async () => {
      const result = await walletService.createWallet('test-wallet');

      expect(result.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(result.mnemonic).toBeTruthy();
      expect(result.mnemonic.split(' ')).toHaveLength(12);
      expect(StorageService.saveWallet).toHaveBeenCalled();
    });

    it('should save encrypted wallet to storage', async () => {
      await walletService.createWallet('test-wallet');

      expect(StorageService.saveWallet).toHaveBeenCalledWith(
        expect.objectContaining({
          address: expect.stringMatching(/^0x[a-fA-F0-9]{40}$/),
          encryptedPrivateKey: expect.any(String),
          label: 'test-wallet',
          createdAt: expect.any(Number),
          network: 'polygon-amoy',
        })
      );
    });
  });

  describe('importWallet', () => {
    const testPrivateKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

    it('should import wallet from private key', async () => {
      const address = await walletService.importWallet(testPrivateKey, 'imported-wallet');

      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(StorageService.saveWallet).toHaveBeenCalled();
    });

    it('should handle private key without 0x prefix', async () => {
      const keyWithoutPrefix = testPrivateKey.slice(2);
      const address = await walletService.importWallet(keyWithoutPrefix, 'imported-wallet');

      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  describe('getWallet', () => {
    const mockWallet = {
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
      encryptedPrivateKey: JSON.stringify({
        iv: 'a'.repeat(32),
        encrypted: 'b'.repeat(64),
        authTag: 'c'.repeat(32),
      }),
      label: 'test',
      createdAt: Date.now(),
    };

    it('should retrieve active wallet by default', async () => {
      vi.mocked(StorageService.getActiveWallet).mockResolvedValue(mockWallet);

      const result = await walletService.getWallet();

      expect(result.address).toBe(mockWallet.address);
      expect(StorageService.getActiveWallet).toHaveBeenCalled();
    });

    it('should retrieve specific wallet by address', async () => {
      vi.mocked(StorageService.getWallet).mockResolvedValue(mockWallet);

      const result = await walletService.getWallet(mockWallet.address);

      expect(result.address).toBe(mockWallet.address);
      expect(StorageService.getWallet).toHaveBeenCalledWith(mockWallet.address);
    });
  });

  describe('encryption', () => {
    it('should encrypt and decrypt private key correctly', async () => {
      const testKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

      // Create wallet to get encrypted key
      const { address } = await walletService.createWallet('encryption-test');

      // Mock the stored wallet
      const savedWallet = vi.mocked(StorageService.saveWallet).mock.calls[0][0];
      vi.mocked(StorageService.getActiveWallet).mockResolvedValue(savedWallet);

      // Retrieve and decrypt
      const result = await walletService.getWallet();

      expect(result.privateKey).toBeTruthy();
      expect(result.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });
  });
});

