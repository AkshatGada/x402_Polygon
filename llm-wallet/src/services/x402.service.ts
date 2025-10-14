import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { wrapFetchWithPayment } from 'x402-fetch';
import { useFacilitator } from 'x402/verify';
import { exact } from 'x402/schemes';
import type { PaymentRequirements, PaymentPayload } from 'x402/types';
import { config, NETWORKS } from '../config/index.js';
import { EvmNetworkToChainId } from 'x402/types';

export class X402Service {
  private facilitatorUrl: string;

  constructor() {
    const networkConfig = NETWORKS[config.NETWORK];
    this.facilitatorUrl = config.FACILITATOR_URL || networkConfig.facilitatorUrl;
  }

  /**
   * BUYER-SIDE: Create x402-fetch wrapped client
   * This automatically handles 402 responses and payment flow
   * Returns a fetch function that handles payments automatically
   */
  async createBuyerFetch(
    walletPrivateKey: string,
    maxValue?: bigint
  ): Promise<typeof fetch> {
    const account = privateKeyToAccount(walletPrivateKey as `0x${string}`);

    // Get chain ID from network
    const chainId = EvmNetworkToChainId.get(config.NETWORK as any);
    const chains = await import('viem/chains');
    const chain = Object.values(chains).find(c => typeof c === 'object' && c && 'id' in c && c.id === chainId);

    const walletClient = createWalletClient({
      account,
      chain: chain as any,
      transport: http(),
    });

    // Wrap fetch with automatic payment handling
    return wrapFetchWithPayment(
      fetch,
      walletClient,
      maxValue || BigInt(10 * 10 ** 6) // Default 10 USDC max
    );
  }

  /**
   * SELLER-SIDE ONLY: Verify payment with facilitator
   * NOTE: Buyer should NOT call this - only seller calls verify
   * Kept for seller tools only
   */
  async verifyPayment(
    paymentHeader: string,
    paymentRequirements: PaymentRequirements
  ): Promise<{ isValid: boolean; invalidReason?: string; payer?: string }> {
    const { verify } = useFacilitator({ url: this.facilitatorUrl });
    const decoded = exact.evm.decodePayment(paymentHeader);

    const result = await verify(decoded, paymentRequirements);

    return {
      isValid: result.isValid,
      invalidReason: result.invalidReason,
      payer: result.payer,
    };
  }

  /**
   * SELLER-SIDE ONLY: Settle payment on-chain
   * NOTE: Buyer should NOT call this - only seller calls settle
   * Kept for seller tools only
   */
  async settlePayment(
    paymentHeader: string,
    paymentRequirements: PaymentRequirements
  ): Promise<{ success: boolean; transaction?: string; error?: string }> {
    const { settle } = useFacilitator({ url: this.facilitatorUrl });
    const decoded = exact.evm.decodePayment(paymentHeader);

    try {
      const result = await settle(decoded, paymentRequirements);
      return {
        success: result.success,
        transaction: result.transaction,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Local validation (buyer/seller-side)
   * Decode payment header to inspect authorization details
   */
  decodePaymentHeader(paymentHeader: string): PaymentPayload {
    return exact.evm.decodePayment(paymentHeader);
  }
}

