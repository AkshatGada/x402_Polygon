/**
 * Exact-Scaled Scheme
 * 
 * Batch payment scheme using cumulative EIP-712 signatures with deposit-based model.
 * Enables batching multiple API calls into one on-chain transaction.
 */

export * from './client';
export * from './facilitator';
export * from './sign';

// Re-export types for convenience
export type { PaymentPayload, PaymentRequirements, VerifyResponse, SettleResponse } from '../../types/verify';

