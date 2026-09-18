/**
 * ---------------------------------------------------------------------------
 * BACKEND ENDPOINT PLACEHOLDERS
 * ---------------------------------------------------------------------------
 * Every network call the app makes is declared here and nowhere else.
 * When the real backend is supplied, set VITE_BMC_API_BASE (e.g.
 * "https://api.buildmycrypto.example") and adjust any path below that differs.
 *
 * Until a base URL is configured the app runs in SIMULATION MODE: a local,
 * clearly-labelled stand-in fulfils the same contracts so the full journey can
 * be demonstrated end to end. No fake data is ever presented as real.
 */

export const API_BASE: string = (import.meta.env.VITE_BMC_API_BASE as string | undefined) ?? "";

export const IS_BACKEND_CONFIGURED = API_BASE.trim().length > 0;

export const ENDPOINTS = {
  /** GET -> { zecUsd, usdToNgn, usdToGhs, source } */
  rates: "/rates",
  /** GET ?country=NG|GH -> { banks: Bank[] } */
  banks: "/banks",
  /** POST CreateOrderInput -> TransactionOrder */
  createOrder: "/orders",
  /** GET -> TransactionOrder */
  order: (id: string) => `/orders/${encodeURIComponent(id)}`,
  /** GET -> { id, status, statusHistory, statusTimestamps, lastError } */
  orderStatus: (id: string) => `/orders/${encodeURIComponent(id)}/status`,
  /** GET -> PaymentCheck (Zebra / Zakura payment monitor) */
  paymentMonitor: (id: string) => `/payment-monitor/${encodeURIComponent(id)}`,
  /** POST -> { ok, order } */
  payout: (id: string) => `/orders/${encodeURIComponent(id)}/payout`,
  /** POST -> { ok, order } */
  cancel: (id: string) => `/orders/${encodeURIComponent(id)}/cancel`,
} as const;

/** Receiving address is supplied per-order by the backend; this is the fallback label. */
export const PLACEHOLDER_DEPOSIT_ADDRESS =
  (import.meta.env.VITE_ZEC_RECEIVING_ADDRESS as string | undefined) ??
  "u1placeholder-zec-address-supplied-by-backend";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE.replace(/\/$/, "")}${path}`, {
    cache: "no-store",
    ...init,
    headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload?.error || `Request failed (${response.status})`);
  }
  return payload;
}
