/**
 * SIMULATION MODE — active only while no backend base URL is configured.
 * It mirrors the backend contracts declared in endpoints.ts so the complete
 * journey (order -> ZEC detection -> confirmations -> payout -> completion)
 * can be demonstrated. Replace by supplying VITE_BMC_API_BASE.
 */
import { PLACEHOLDER_DEPOSIT_ADDRESS } from "./endpoints";
import { canTransition, type TransactionStatus } from "./status";
import type { CreateOrderInput, PaymentCheck, StatusHistoryEntry, TransactionOrder } from "./types";

const STORAGE_KEY = "build-my-crypto:orders:v1";
const ORDER_TTL_MS = 30 * 60 * 1000;
const REQUIRED_CONFIRMATIONS = 3;

function readAll(): Record<string, TransactionOrder> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, TransactionOrder>) : {};
  } catch {
    return {};
  }
}

function writeAll(orders: Record<string, TransactionOrder>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch {
    /* storage unavailable */
  }
}

function save(order: TransactionOrder) {
  const all = readAll();
  all[order.id] = order;
  writeAll(all);
  return order;
}

function load(id: string): TransactionOrder {
  const order = readAll()[id];
  if (!order) throw new Error("Transaction order was not found.");
  return order;
}

function transition(order: TransactionOrder, to: TransactionStatus, reason: string): TransactionOrder {
  if (order.status === to) return order;
  if (!canTransition(order.status, to)) return order;
  const at = new Date().toISOString();
  const entry: StatusHistoryEntry = { from: order.status, to, at, reason };
  return {
    ...order,
    status: to,
    statusHistory: [...order.statusHistory, entry],
    statusTimestamps: { ...order.statusTimestamps, [to]: at },
  };
}

function newId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid
    ? `BMC-${uuid.replace(/-/g, "").slice(0, 12).toUpperCase()}`
    : `BMC-${Date.now().toString(36).toUpperCase()}`;
}

export function simCreateOrder(input: CreateOrderInput): TransactionOrder {
  const now = new Date();
  const createdAt = now.toISOString();
  const base: TransactionOrder = {
    id: newId(),
    ...input,
    status: "CREATED",
    statusHistory: [{ from: null, to: "CREATED", at: createdAt, reason: "Order created" }],
    statusTimestamps: { CREATED: createdAt },
    createdAt,
    expiresAt: new Date(now.getTime() + ORDER_TTL_MS).toISOString(),
    depositAddress: PLACEHOLDER_DEPOSIT_ADDRESS,
    payment: null,
    payout: null,
    lastError: null,
    errorHistory: [],
  };
  return save(transition(base, "AWAITING_ZEC", "Awaiting ZEC deposit"));
}

export function simGetOrder(id: string) {
  return load(id);
}

/** Advances the simulated on-chain state based on elapsed time since funding. */
export function simCheckPayment(id: string): PaymentCheck {
  let order = load(id);
  const fundedAt = (order as TransactionOrder & { _fundedAt?: string })._fundedAt;

  if (!fundedAt) {
    if (Date.now() > new Date(order.expiresAt).getTime()) {
      order = save(transition(order, "EXPIRED", "Order expired before funding"));
    }
    return {
      state: order.status,
      payment: order.payment ?? null,
      checkedAt: new Date().toISOString(),
      source: "unavailable",
      network: "testnet",
      statusHistory: order.statusHistory,
      statusTimestamps: order.statusTimestamps,
    };
  }

  const elapsed = Date.now() - new Date(fundedAt).getTime();
  const confirmations = Math.min(REQUIRED_CONFIRMATIONS, Math.floor(elapsed / 6000));
  const payment = {
    txid: `sim-${order.id.toLowerCase()}`,
    receivedZec: order.requiredZec,
    confirmations,
    requiredConfirmations: REQUIRED_CONFIRMATIONS,
    detectedAt: fundedAt,
    address: order.depositAddress,
  };
  order = { ...order, payment };
  if (confirmations === 0) order = transition(order, "ZEC_DETECTED", "Deposit seen in mempool");
  else if (confirmations < REQUIRED_CONFIRMATIONS) {
    order = transition(order, "ZEC_DETECTED", "Deposit seen in mempool");
    order = transition(order, "CONFIRMING", `${confirmations}/${REQUIRED_CONFIRMATIONS} confirmations`);
  } else {
    order = transition(order, "ZEC_DETECTED", "Deposit seen in mempool");
    order = transition(order, "CONFIRMING", "Confirming");
    order = transition(order, "ZEC_CONFIRMED", "Required confirmations reached");
  }
  save(order);

  return {
    state: order.status,
    payment: order.payment ?? null,
    checkedAt: new Date().toISOString(),
    source: "zebra",
    network: "testnet",
    statusHistory: order.statusHistory,
    statusTimestamps: order.statusTimestamps,
  };
}

/** Stands in for the resident actually broadcasting a ZEC transaction. */
export function simMarkFunded(id: string) {
  const order = load(id) as TransactionOrder & { _fundedAt?: string };
  if (!order._fundedAt) save({ ...order, _fundedAt: new Date().toISOString() } as TransactionOrder);
  return simCheckPayment(id);
}

export function simPayout(id: string): TransactionOrder {
  let order = load(id);
  if (!["ZEC_CONFIRMED", "PAYOUT_FAILED"].includes(order.status)) {
    throw new Error("Payout can only start once the ZEC payment is confirmed.");
  }
  const at = new Date().toISOString();
  order = transition(order, "PAYOUT_PROCESSING", "Payout requested");
  order = {
    ...order,
    payout: {
      currency: order.fiatCurrency,
      amount: order.fiatAmount,
      provider: "simulated-payout-provider",
      status: "SENT",
      providerReference: `SIM-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      attempts: [
        ...(order.payout?.attempts ?? []),
        {
          attemptId: `att-${(order.payout?.attempts.length ?? 0) + 1}`,
          provider: "simulated-payout-provider",
          status: "SENT",
          requestedAt: at,
          completedAt: at,
        },
      ],
      createdAt: order.payout?.createdAt ?? at,
      updatedAt: at,
    },
  };
  order = transition(order, "FIAT_SENT", "Fiat payout submitted to the recipient bank");
  order = transition(order, "COMPLETED", "Recipient credited");
  return save(order);
}

export function simCancel(id: string): TransactionOrder {
  const order = load(id);
  const cancelled = transition(order, "CANCELLED", "Cancelled by user");
  if (cancelled.status !== "CANCELLED") throw new Error("This transaction can no longer be cancelled.");
  return save(cancelled);
}
