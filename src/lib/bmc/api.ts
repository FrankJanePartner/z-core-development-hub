import { FALLBACK_BANKS, type Bank, type BankCountry } from "./banks";
import type { ConversionRates } from "./conversion";
import { apiFetch, ENDPOINTS, IS_BACKEND_CONFIGURED } from "./endpoints";
import {
  simCancel,
  simCheckPayment,
  simCreateOrder,
  simGetOrder,
  simMarkFunded,
  simPayout,
} from "./simulation";
import type { CreateOrderInput, PaymentCheck, TransactionOrder } from "./types";

const ZEC_PRICE_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=zcash&vs_currencies=usd";
const FX_URL = "https://open.er-api.com/v6/latest/USD";

function positive(value: unknown, label: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} is unavailable.`);
  return number;
}

/** Live market data. Backend `/rates` takes over once configured. */
export async function fetchConversionRates(): Promise<ConversionRates> {
  if (IS_BACKEND_CONFIGURED) {
    const data = await apiFetch<Partial<ConversionRates>>(ENDPOINTS.rates);
    return {
      zecUsd: positive(data.zecUsd, "ZEC/USD rate"),
      usdToNgn: positive(data.usdToNgn, "USD/NGN rate"),
      usdToGhs: positive(data.usdToGhs, "USD/GHS rate"),
      fetchedAt: Date.now(),
      source: data.source || "Build My Crypto pricing service",
    };
  }

  const [zecResponse, fxResponse] = await Promise.all([
    fetch(ZEC_PRICE_URL, { headers: { accept: "application/json" } }),
    fetch(FX_URL, { headers: { accept: "application/json" } }),
  ]);
  if (!zecResponse.ok || !fxResponse.ok) throw new Error("Live exchange-rate providers are unavailable.");
  const [zecData, fxData] = await Promise.all([zecResponse.json(), fxResponse.json()]);
  return {
    zecUsd: positive(zecData?.zcash?.usd, "ZEC/USD rate"),
    usdToNgn: positive(fxData?.rates?.NGN, "USD/NGN rate"),
    usdToGhs: positive(fxData?.rates?.GHS, "USD/GHS rate"),
    fetchedAt: Date.now(),
    source: "CoinGecko + ExchangeRate-API",
  };
}

export async function fetchBanks(country: BankCountry): Promise<Bank[]> {
  if (IS_BACKEND_CONFIGURED) {
    const data = await apiFetch<{ banks?: Bank[] }>(`${ENDPOINTS.banks}?country=${country}`);
    if (!Array.isArray(data.banks)) throw new Error("Bank service returned an invalid response.");
    return data.banks;
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
  return FALLBACK_BANKS.filter((bank) => bank.country === country);
}

export async function createOrder(input: CreateOrderInput): Promise<TransactionOrder> {
  if (IS_BACKEND_CONFIGURED) {
    return apiFetch<TransactionOrder>(ENDPOINTS.createOrder, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
  return simCreateOrder(input);
}

export async function fetchOrder(id: string): Promise<TransactionOrder> {
  if (IS_BACKEND_CONFIGURED) return apiFetch<TransactionOrder>(ENDPOINTS.order(id));
  return simGetOrder(id);
}

export async function checkPayment(id: string): Promise<PaymentCheck> {
  if (IS_BACKEND_CONFIGURED) return apiFetch<PaymentCheck>(ENDPOINTS.paymentMonitor(id));
  return simCheckPayment(id);
}

export async function requestPayout(id: string): Promise<TransactionOrder> {
  if (IS_BACKEND_CONFIGURED) {
    const data = await apiFetch<{ order: TransactionOrder }>(ENDPOINTS.payout(id), {
      method: "POST",
      body: "{}",
    });
    return data.order;
  }
  return simPayout(id);
}

export async function cancelOrder(id: string): Promise<TransactionOrder> {
  if (IS_BACKEND_CONFIGURED) {
    const data = await apiFetch<{ order: TransactionOrder }>(ENDPOINTS.cancel(id), { method: "POST" });
    return data.order;
  }
  return simCancel(id);
}

/**
 * Demonstration helper only: stands in for the resident broadcasting ZEC.
 * With a real backend the payment monitor detects the deposit on its own.
 */
export async function declareDepositSent(id: string): Promise<PaymentCheck> {
  if (IS_BACKEND_CONFIGURED) return checkPayment(id);
  return simMarkFunded(id);
}
