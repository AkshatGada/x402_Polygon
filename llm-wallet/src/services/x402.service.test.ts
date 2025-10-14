import { describe, it, expect, beforeEach, vi } from 'vitest';
import { X402Service } from './x402.service';

// Mock x402 modules
vi.mock('x402/schemes', () => ({
  exact: {
    evm: {
      createPaymentHeader: vi.fn(),
      decodePayment: vi.fn(),
    },
  },
}));

vi.mock('x402/verify', () => ({
  useFacilitator: vi.fn(() => ({
    verify: vi.fn(),
    settle: vi.fn(),
  })),
}));

vi.mock('viem/accounts', () => ({
  privateKeyToAccount: vi.fn((key) => ({
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
    signMessage: vi.fn(),
  })),
}));

vi.mock('../config/index.js', () => ({
  config: {
    NETWORK: 'polygon-amoy',
    FACILITATOR_URL: 'https://x402-amoy.polygon.technology',
    WALLET_ENCRYPTION_KEY: 'test-key',
    LOG_LEVEL: 'error',
    STORAGE_DIR: '/tmp/test',
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

describe('X402Service', () => {
  let x402Service: X402Service;
  const mockPrivateKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const mockPaymentRequirements = {
    scheme: 'exact',
    network: 'polygon-amoy',
    maxAmountRequired: '10000',
    resource: 'https://api.example.com/data',
    payTo: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
    asset: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    maxTimeoutSeconds: 60,
    description: 'Test payment',
    mimeType: 'application/json',
    outputSchema: {},
    extra: {},
  };

  beforeEach(() => {
    x402Service = new X402Service();
    vi.clearAllMocks();
  });

  describe('createPaymentHeader', () => {
    it('should create payment header using exact scheme', async () => {
      const { exact } = await import('x402/schemes');
      const mockHeader = 'base64-encoded-payment';
      vi.mocked(exact.evm.createPaymentHeader).mockResolvedValue(mockHeader);

      const result = await x402Service.createPaymentHeader(
        mockPaymentRequirements as any,
        mockPrivateKey
      );

      expect(result).toBe(mockHeader);
      expect(exact.evm.createPaymentHeader).toHaveBeenCalled();
    });
  });

  describe('verifyPayment', () => {
    it('should verify payment via facilitator', async () => {
      const { useFacilitator } = await import('x402/verify');
      const { exact } = await import('x402/schemes');

      const mockDecodedPayment = { payload: 'decoded' };
      const mockVerifyResult = {
        isValid: true,
        payer: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
      };

      vi.mocked(exact.evm.decodePayment).mockReturnValue(mockDecodedPayment as any);
      const mockVerify = vi.fn().mockResolvedValue(mockVerifyResult);
      vi.mocked(useFacilitator).mockReturnValue({ verify: mockVerify, settle: vi.fn() } as any);

      const result = await x402Service.verifyPayment(
        'payment-header',
        mockPaymentRequirements as any
      );

      expect(result.isValid).toBe(true);
      expect(result.payer).toBe(mockVerifyResult.payer);
      expect(mockVerify).toHaveBeenCalled();
    });

    it('should handle verification failure', async () => {
      const { useFacilitator } = await import('x402/verify');
      const mockVerify = vi.fn().mockResolvedValue({
        isValid: false,
        invalidReason: 'Invalid signature',
      });
      vi.mocked(useFacilitator).mockReturnValue({ verify: mockVerify, settle: vi.fn() } as any);

      const result = await x402Service.verifyPayment(
        'payment-header',
        mockPaymentRequirements as any
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('Invalid signature');
    });
  });

  describe('settlePayment', () => {
    it('should settle payment successfully', async () => {
      const { useFacilitator } = await import('x402/verify');
      const mockSettle = vi.fn().mockResolvedValue({
        success: true,
        transactionHash: '0xabc123',
      });
      vi.mocked(useFacilitator).mockReturnValue({ verify: vi.fn(), settle: mockSettle } as any);

      const result = await x402Service.settlePayment(
        'payment-header',
        mockPaymentRequirements as any
      );

      expect(result.success).toBe(true);
      expect(result.transactionHash).toBe('0xabc123');
    });

    it('should handle settlement errors', async () => {
      const { useFacilitator } = await import('x402/verify');
      const mockSettle = vi.fn().mockRejectedValue(new Error('Settlement failed'));
      vi.mocked(useFacilitator).mockReturnValue({ verify: vi.fn(), settle: mockSettle } as any);

      const result = await x402Service.settlePayment(
        'payment-header',
        mockPaymentRequirements as any
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Settlement failed');
    });
  });

  describe('executePaymentFlow', () => {
    it('should execute complete payment flow', async () => {
      const { useFacilitator } = await import('x402/verify');
      const { exact } = await import('x402/schemes');

      vi.mocked(exact.evm.createPaymentHeader).mockResolvedValue('payment-header');
      const mockVerify = vi.fn().mockResolvedValue({ isValid: true });
      const mockSettle = vi.fn().mockResolvedValue({
        success: true,
        transactionHash: '0xabc123',
      });
      vi.mocked(useFacilitator).mockReturnValue({
        verify: mockVerify,
        settle: mockSettle
      } as any);

      const result = await x402Service.executePaymentFlow(
        mockPaymentRequirements as any,
        mockPrivateKey
      );

      expect(result.paymentHeader).toBe('payment-header');
      expect(result.verified).toBe(true);
      expect(result.settled).toBe(true);
      expect(result.transactionHash).toBe('0xabc123');
    });

    it('should throw error if verification fails', async () => {
      const { useFacilitator } = await import('x402/verify');
      const mockVerify = vi.fn().mockResolvedValue({
        isValid: false,
        invalidReason: 'Invalid payment',
      });
      vi.mocked(useFacilitator).mockReturnValue({
        verify: mockVerify,
        settle: vi.fn()
      } as any);

      await expect(
        x402Service.executePaymentFlow(mockPaymentRequirements as any, mockPrivateKey)
      ).rejects.toThrow('Verification failed: Invalid payment');
    });
  });
});

