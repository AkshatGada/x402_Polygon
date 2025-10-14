export interface PaymentHistory {
  id: string;
  timestamp: number;
  paymentHeader: string;
  verified: boolean;
  settled: boolean;
  transactionHash?: string;
  amount: string;
  network: string;
  resource?: string;
}

