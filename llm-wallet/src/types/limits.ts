export interface SpendingLimits {
  maxTransactionAmount?: bigint;
  dailyLimit?: bigint;
  dailySpent: bigint;
  lastResetTimestamp: number;
  requireApproval: boolean;
  approvalThreshold: bigint;
}

export interface StoredSpendingLimits {
  maxTransactionAmount?: string;
  dailyLimit?: string;
  dailySpent: string;
  lastResetTimestamp: number;
  requireApproval: boolean;
  approvalThreshold: string;
}

