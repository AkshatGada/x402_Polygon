/**
 * Scaled Payment Helpers for X402-SCALED
 *
 * Provides helper functions for working with exact-scaled scheme,
 * including deposit management and cumulative payment creation.
 */
import { Address, Hex } from "viem";
import type { SignerWallet, LocalAccount, ConnectedClient } from "x402/types/shared/evm";
import type { PaymentRequirements } from "x402/types";
/**
 * Check deposit status for a client-server pair
 *
 * @param client Public client for blockchain queries
 * @param clientAddress Client's address
 * @param serverAddress Server's address
 * @param paymentContract Payment contract address
 * @param network Network identifier
 * @returns DepositStatus object
 */
export declare function checkDepositStatus<transport extends any, chain extends any, account extends any>(client: ConnectedClient<transport, chain, account>, clientAddress: Address, serverAddress: Address, paymentContract: Address, network: string): Promise<{
    isLocked: boolean;
    amountLocked: string;
    amountUsed: string;
    availableBalance: string;
    lockupExpiry: string;
    paymentContract: `0x${string}`;
    lastTotalValue: string;
}>;
/**
 * Deposit funds into the payment contract
 *
 * @param wallet Signer wallet that will submit the deposit transaction
 * @param paymentContract Payment contract address
 * @param serverAddress Server's address
 * @param amount Amount to deposit (in token base units, e.g., 10_000_000 for $10 USDC)
 * @param expiresBy Unix timestamp when deposit expires
 * @returns Transaction hash
 */
export declare function depositFunds<chain extends any, transport extends any>(wallet: SignerWallet<chain, transport>, paymentContract: Address, serverAddress: Address, amount: bigint, expiresBy: bigint): Promise<Hex>;
/**
 * Create a cumulative payment header for exact-scaled scheme
 *
 * @param client Signer wallet or local account
 * @param x402Version X402 protocol version
 * @param paymentRequirements Payment requirements with paymentContract
 * @returns Encoded payment header string
 */
export declare function createCumulativePaymentHeaderHelper(client: SignerWallet | LocalAccount, x402Version: number, paymentRequirements: PaymentRequirements & {
    paymentContract: string;
}): Promise<string>;
//# sourceMappingURL=scaled.d.ts.map