export const TRANSACTION_STATUSES = [
  "CREATED",
  "AWAITING_ZEC",
  "ZEC_DETECTED",
  "CONFIRMING",
  "ZEC_CONFIRMED",
  "PAYOUT_PROCESSING",
  "FIAT_SENT",
  "COMPLETED",
  "EXPIRED",
  "UNDERPAID",
  "OVERPAID",
  "PAYOUT_FAILED",
  "CANCELLED",
] as const;

export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const CORE_STATUS_FLOW: TransactionStatus[] = [
  "CREATED",
  "AWAITING_ZEC",
  "ZEC_DETECTED",
  "CONFIRMING",
  "ZEC_CONFIRMED",
  "PAYOUT_PROCESSING",
  "FIAT_SENT",
  "COMPLETED",
];

export const VALID_TRANSITIONS: Record<TransactionStatus, TransactionStatus[]> = {
  CREATED: ["AWAITING_ZEC", "CANCELLED"],
  AWAITING_ZEC: ["ZEC_DETECTED", "UNDERPAID", "OVERPAID", "EXPIRED", "CANCELLED"],
  ZEC_DETECTED: ["CONFIRMING", "UNDERPAID", "OVERPAID", "EXPIRED", "CANCELLED"],
  CONFIRMING: ["ZEC_CONFIRMED", "UNDERPAID", "OVERPAID", "EXPIRED", "CANCELLED"],
  ZEC_CONFIRMED: ["PAYOUT_PROCESSING"],
  PAYOUT_PROCESSING: ["FIAT_SENT", "PAYOUT_FAILED"],
  FIAT_SENT: ["COMPLETED"],
  COMPLETED: [],
  EXPIRED: [],
  UNDERPAID: ["ZEC_DETECTED", "CONFIRMING", "EXPIRED", "CANCELLED"],
  OVERPAID: ["ZEC_DETECTED", "CONFIRMING", "CANCELLED"],
  PAYOUT_FAILED: ["PAYOUT_PROCESSING", "CANCELLED"],
  CANCELLED: [],
};

export function canTransition(from: TransactionStatus, to: TransactionStatus) {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export const STATUS_LABELS: Record<TransactionStatus, string> = {
  CREATED: "Transaction created",
  AWAITING_ZEC: "Awaiting ZEC",
  ZEC_DETECTED: "ZEC detected",
  CONFIRMING: "Confirming on-chain",
  ZEC_CONFIRMED: "ZEC confirmed",
  PAYOUT_PROCESSING: "Payout processing",
  FIAT_SENT: "Fiat sent",
  COMPLETED: "Completed",
  EXPIRED: "Order expired",
  UNDERPAID: "Payment underpaid",
  OVERPAID: "Payment overpaid",
  PAYOUT_FAILED: "Payout failed",
  CANCELLED: "Transaction cancelled",
};

export const TERMINAL_STATUSES: TransactionStatus[] = ["COMPLETED", "EXPIRED", "CANCELLED"];

export const EXCEPTION_STATUSES: TransactionStatus[] = [
  "EXPIRED",
  "UNDERPAID",
  "OVERPAID",
  "PAYOUT_FAILED",
  "CANCELLED",
];

export function getTrackingStages(status: TransactionStatus) {
  const currentIndex = CORE_STATUS_FLOW.indexOf(status);
  return CORE_STATUS_FLOW.slice(1).map((stage) => ({
    status: stage,
    label: STATUS_LABELS[stage],
    done: currentIndex >= 0 && CORE_STATUS_FLOW.indexOf(stage) < currentIndex,
    current: stage === status,
  }));
}
