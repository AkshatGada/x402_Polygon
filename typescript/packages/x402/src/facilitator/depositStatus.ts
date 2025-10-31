/**
 * Deposit Status Query for X402-SCALED
 * 
 * Provides functionality to query payment contract for deposit information.
 * Used by facilitators and servers to check if a client has an active deposit.
 */

import { Address, Hex, Transport, Chain, Account } from "viem";
import { ConnectedClient } from "../types/shared/evm";
import { Network } from "../types/shared";

export interface DepositStatus {
  isLocked: boolean;              // Has active deposit?
  amountLocked: string;          // Total deposited (e.g., "10000000" = $10)
  amountUsed: string;            // Amount already claimed (e.g., "1000" = $0.001)
  availableBalance: string;      // amountLocked - amountUsed
  lockupExpiry: string;          // Unix timestamp
  paymentContract: Address;       // Contract address
  lastTotalValue?: string;       // Last cumulative signature value (if any)
}

/**
 * Payment contract ABI for deposit queries
 */
const PAYMENT_CONTRACT_ABI = [
  {
    inputs: [
      { name: "user", type: "address" },
      { name: "server", type: "address" },
    ],
    name: "deposits",
    outputs: [
      { name: "amount", type: "uint256" },
      { name: "expiresBy", type: "uint256" },
      { name: "amountUsed", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * Query deposit status from payment contract
 * 
 * @param client Public client for blockchain queries
 * @param clientAddress Client's address
 * @param serverAddress Server's address
 * @param paymentContract Payment contract address
 * @param network Network identifier
 * @param lastTotalValue Optional: last known totalValue from signature storage
 * @returns DepositStatus object
 */
export async function getDepositStatus<
  transport extends Transport,
  chain extends Chain,
  account extends Account | undefined,
>(
  client: ConnectedClient<transport, chain, account>,
  clientAddress: Address,
  serverAddress: Address,
  paymentContract: Address,
  network: Network,
  lastTotalValue?: string
): Promise<DepositStatus> {
  try {
    // Query contract for deposit info
    const depositInfo = await client.readContract({
      address: paymentContract,
      abi: PAYMENT_CONTRACT_ABI,
      functionName: "deposits",
      args: [clientAddress, serverAddress],
    });

    const [amount, expiresBy, amountUsed] = depositInfo as [bigint, bigint, bigint];
    const now = BigInt(Math.floor(Date.now() / 1000));

    const isLocked = amount > 0n && expiresBy > now;
    const availableBalance = (amount - amountUsed).toString();

    return {
      isLocked,
      amountLocked: amount.toString(),
      amountUsed: amountUsed.toString(),
      availableBalance,
      lockupExpiry: expiresBy.toString(),
      paymentContract,
      lastTotalValue,
    };
  } catch (error) {
    // If contract call fails, return empty status
    return {
      isLocked: false,
      amountLocked: "0",
      amountUsed: "0",
      availableBalance: "0",
      lockupExpiry: "0",
      paymentContract,
      lastTotalValue,
    };
  }
}

