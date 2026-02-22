import { TransactionType, WithdrawalStatus, PaymentMethod } from './enums';

/** User wallet */
export interface Wallet {
  id: string;
  userId: string;
  balance: number;
  currency: string;
  totalEarned: number;
  totalWithdrawn: number;
  totalTips: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** A single transaction in the wallet */
export interface Transaction {
  id: string;
  walletId: string;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  currency: string;
  description: string;
  referenceId: string | null; // order ID, withdrawal ID, etc.
  referenceType: string | null; // 'order', 'withdrawal', 'bonus', etc.
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

/** Withdrawal request */
export interface Withdrawal {
  id: string;
  walletId: string;
  userId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  destination: string; // bank account number, mobile money number
  destinationName: string; // account name
  bankCode: string | null;
  status: WithdrawalStatus;
  processedAt: Date | null;
  failureReason: string | null;
  paymentReference: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Input for requesting a withdrawal */
export interface RequestWithdrawalInput {
  amount: number;
  method: PaymentMethod;
  destination: string;
  destinationName: string;
  bankCode?: string;
}
