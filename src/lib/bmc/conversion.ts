export type Currency = "NGN" | "GHS";

export type ConversionRates = {
  zecUsd: number;
  usdToNgn: number;
  usdToGhs: number;
  fetchedAt: number;
  source: string;
};

export type ConversionResult = {
  fiatAmount: number;
  currency: Currency;
  zecAmount: number;
  fiatPerZec: number;
  usdValue: number;
};

export const CURRENCIES: Record<
  Currency,
  { name: string; symbol: string; flag: string; country: string; countryCode: "NG" | "GH" }
> = {
  NGN: { name: "Nigerian Naira", symbol: "\u20a6", flag: "\uD83C\uDDF3\uD83C\uDDEC", country: "Nigeria", countryCode: "NG" },
  GHS: { name: "Ghanaian Cedi", symbol: "GH\u20b5", flag: "\uD83C\uDDEC\uD83C\uDDED", country: "Ghana", countryCode: "GH" },
};

export const MIN_AMOUNT: Record<Currency, number> = { NGN: 1000, GHS: 10 };
export const ZEC_DECIMALS = 6;

export function convertFiatToZec(
  fiatAmount: number,
  currency: Currency,
  rates: ConversionRates,
): ConversionResult {
  if (!Number.isFinite(fiatAmount) || fiatAmount < 0) {
    throw new Error("Enter a valid recipient amount.");
  }

  const usdToLocal = currency === "NGN" ? rates.usdToNgn : rates.usdToGhs;
  if (![rates.zecUsd, usdToLocal].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("A valid exchange rate is required for conversion.");
  }

  const fiatPerZec = rates.zecUsd * usdToLocal;
  return {
    fiatAmount,
    currency,
    zecAmount: fiatAmount / fiatPerZec,
    fiatPerZec,
    usdValue: fiatAmount / usdToLocal,
  };
}

export function formatFiat(value: number, currency: Currency) {
  return `${CURRENCIES[currency].symbol}${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value)}`;
}

export function formatZec(value: number) {
  return value.toFixed(ZEC_DECIMALS);
}

export function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function maskAccount(value: string) {
  return value.length <= 4 ? "\u2022\u2022\u2022\u2022" : `\u2022\u2022\u2022\u2022 ${value.slice(-4)}`;
}
