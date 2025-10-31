/**
 * Signature Storage for X402-SCALED
 * 
 * Stores the last known totalValue per client-server pair for cumulative payment verification.
 * This is used to ensure that new signatures have a totalValue greater than the last one,
 * preventing replay attacks and ensuring forward progress.
 */

import { Address } from "viem";

export interface SignatureState {
  client: Address;
  server: Address;
  lastTotalValue: string;      // Last cumulative value seen
  lastSignature: string;       // Last signature (for reference)
  lastVerifiedAt: number;     // Timestamp
  requestCount: number;        // Number of requests processed
}

/**
 * In-memory storage implementation for signature states
 * In production, this should be replaced with a persistent database (PostgreSQL, Redis, etc.)
 */
class SignatureStorage {
  private storage: Map<string, SignatureState> = new Map();

  /**
   * Generate storage key from client and server addresses
   */
  private getKey(client: Address, server: Address): string {
    return `${client.toLowerCase()}:${server.toLowerCase()}`;
  }

  /**
   * Get the last known totalValue for a client-server pair
   * @param client Client address
   * @param server Server address
   * @returns Last totalValue as bigint, or 0n if not found
   */
  getLastTotalValue(client: Address, server: Address): bigint {
    const key = this.getKey(client, server);
    const state = this.storage.get(key);
    return state ? BigInt(state.lastTotalValue) : 0n;
  }

  /**
   * Store the last signature state for a client-server pair
   * @param client Client address
   * @param server Server address
   * @param totalValue Cumulative totalValue from the signature
   * @param signature The signature itself
   */
  storeSignature(
    client: Address,
    server: Address,
    totalValue: string,
    signature: string
  ): void {
    const key = this.getKey(client, server);
    const existing = this.storage.get(key);

    const state: SignatureState = {
      client,
      server,
      lastTotalValue: totalValue,
      lastSignature: signature,
      lastVerifiedAt: Date.now(),
      requestCount: existing ? existing.requestCount + 1 : 1,
    };

    this.storage.set(key, state);
  }

  /**
   * Get full signature state for a client-server pair
   * @param client Client address
   * @param server Server address
   * @returns SignatureState or undefined if not found
   */
  getState(client: Address, server: Address): SignatureState | undefined {
    const key = this.getKey(client, server);
    return this.storage.get(key);
  }

  /**
   * Clear storage (useful for testing)
   */
  clear(): void {
    this.storage.clear();
  }

  /**
   * Get all stored states (useful for debugging/metrics)
   */
  getAllStates(): SignatureState[] {
    return Array.from(this.storage.values());
  }
}

// Export singleton instance
export const signatureStorage = new SignatureStorage();

// Export class for custom instances
export { SignatureStorage };

