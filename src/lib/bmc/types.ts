import type { Currency } from "./conversion";
import type { TransactionStatus } from "./status";

export type RecipientPaymentInfo = {
  providerName: string;
  providerCode: string;
  providerType: string;
  accountNumber: string;
  accountName: string;
  country: string;
  currency: Currency;
};

export type StatusHistoryEntry = {
  from: TransactionStatus | null;
  to: TransactionStatus;
  at: string;
  reason: string;
};

export type TransactionError = {
  code: string;
  message: string;
  retryable: boolean;
  at: string;
  details?: unknown;
};

export type PayoutAttempt = {
  attemptId: string;
  provider: string;
  providerReference?: string;
  status: "PROCESSING" | "SENT" | "FAILED";
  requestedAt: string;
  completedAt?: string;
  error?: string;
};

export type TransactionOrder = {
  id: string;
  fiatCurrency: Currency;
  fiatAmount: number;
  requiredZec: number;
  quotedRate: number;
  recipient: RecipientPaymentInfo;
  status: TransactionStatus;
  statusHistory: StatusHistoryEntry[];
  statusTimestamps: Partial<Record<TransactionStatus, string>>;
  createdAt: string;
  expiresAt: string;
  depositAddress: string;
  payment?: {
    txid: string;
    receivedZec: number;
    confirmations: number;
    requiredConfirmations: number;
    detectedAt: string;
    address?: string;
  } | null;
  payout?: {
    currency: Currency;
    amount: number;
    provider: string;
    status: "PROCESSING" | "SENT" | "FAILED";
    providerReference?: string;
    attempts: PayoutAttempt[];
    createdAt: string;
    updatedAt: string;
    error?: string;
  } | null;
  lastError?: TransactionError | null;
  errorHistory?: TransactionError[];
};

export type CreateOrderInput = {
  fiatCurrency: Currency;
  fiatAmount: number;
  requiredZec: number;
  quotedRate: number;
  recipient: RecipientPaymentInfo;
};

export type PaymentCheck = {
  state: TransactionStatus;
  payment: TransactionOrder["payment"];
  checkedAt: string;
  source: "zebra" | "zakura" | "unavailable";
  network: "mainnet" | "testnet" | "regtest";
  error?: string;
  errorCode?: string;
  retryable?: boolean;
  statusHistory?: StatusHistoryEntry[];
  statusTimestamps?: Partial<Record<TransactionStatus, string>>;
};
