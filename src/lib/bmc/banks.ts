export type BankCountry = "NG" | "GH";
export type ProviderType = "bank" | "fintech" | "mobile_money";

export type Bank = {
  id: string;
  name: string;
  code?: string;
  country: BankCountry;
  currency: "NGN" | "GHS";
  type: ProviderType;
};

export const PROVIDER_GROUPS: Array<{ type: ProviderType; label: string }> = [
  { type: "bank", label: "Banks" },
  { type: "fintech", label: "Fintech & digital banks" },
  { type: "mobile_money", label: "Mobile money & wallets" },
];

/**
 * Local fallback directory used until the backend `/banks` endpoint is supplied.
 * Provider credentials (Paystack / Flutterwave etc.) must stay server-side.
 */
export const FALLBACK_BANKS: Bank[] = [
  { id: "ng-access", name: "Access Bank", code: "044", country: "NG", currency: "NGN", type: "bank" },
  { id: "ng-firstbank", name: "First Bank of Nigeria", code: "011", country: "NG", currency: "NGN", type: "bank" },
  { id: "ng-gtb", name: "Guaranty Trust Bank", code: "058", country: "NG", currency: "NGN", type: "bank" },
  { id: "ng-uba", name: "United Bank for Africa", code: "033", country: "NG", currency: "NGN", type: "bank" },
  { id: "ng-zenith", name: "Zenith Bank", code: "057", country: "NG", currency: "NGN", type: "bank" },
  { id: "ng-fidelity", name: "Fidelity Bank", code: "070", country: "NG", currency: "NGN", type: "bank" },
  { id: "ng-stanbic", name: "Stanbic IBTC Bank", code: "221", country: "NG", currency: "NGN", type: "bank" },
  { id: "ng-sterling", name: "Sterling Bank", code: "232", country: "NG", currency: "NGN", type: "bank" },
  { id: "ng-wema", name: "Wema Bank", code: "035", country: "NG", currency: "NGN", type: "bank" },
  { id: "ng-union", name: "Union Bank of Nigeria", code: "032", country: "NG", currency: "NGN", type: "bank" },
  { id: "ng-polaris", name: "Polaris Bank", code: "076", country: "NG", currency: "NGN", type: "bank" },
  { id: "ng-opay", name: "OPay", country: "NG", currency: "NGN", type: "fintech" },
  { id: "ng-palmpay", name: "PalmPay", country: "NG", currency: "NGN", type: "fintech" },
  { id: "ng-moniepoint", name: "Moniepoint", code: "50515", country: "NG", currency: "NGN", type: "fintech" },
  { id: "ng-kuda", name: "Kuda", country: "NG", currency: "NGN", type: "fintech" },
  { id: "ng-carbon", name: "Carbon", country: "NG", currency: "NGN", type: "fintech" },
  { id: "ng-opay-wallet", name: "OPay Wallet", country: "NG", currency: "NGN", type: "mobile_money" },
  { id: "ng-palmpay-wallet", name: "PalmPay Wallet", country: "NG", currency: "NGN", type: "mobile_money" },

  { id: "gh-absa", name: "Absa Bank Ghana", code: "030100", country: "GH", currency: "GHS", type: "bank" },
  { id: "gh-ecobank", name: "Ecobank Ghana", code: "130100", country: "GH", currency: "GHS", type: "bank" },
  { id: "gh-gcb", name: "GCB Bank", code: "040100", country: "GH", currency: "GHS", type: "bank" },
  { id: "gh-stanbic", name: "Stanbic Bank Ghana", code: "190100", country: "GH", currency: "GHS", type: "bank" },
  { id: "gh-sc", name: "Standard Chartered Bank Ghana", code: "060100", country: "GH", currency: "GHS", type: "bank" },
  { id: "gh-uba", name: "United Bank for Africa Ghana", code: "220100", country: "GH", currency: "GHS", type: "bank" },
  { id: "gh-fidelity", name: "Fidelity Bank Ghana", country: "GH", currency: "GHS", type: "bank" },
  { id: "gh-cal", name: "CalBank", country: "GH", currency: "GHS", type: "bank" },
  { id: "gh-zenith", name: "Zenith Bank Ghana", country: "GH", currency: "GHS", type: "bank" },
  { id: "gh-republic", name: "Republic Bank Ghana", country: "GH", currency: "GHS", type: "bank" },
  { id: "gh-mtn", name: "MTN MoMo", country: "GH", currency: "GHS", type: "mobile_money" },
  { id: "gh-telecel", name: "Telecel Cash", country: "GH", currency: "GHS", type: "mobile_money" },
  { id: "gh-at", name: "AT Money", country: "GH", currency: "GHS", type: "mobile_money" },
  { id: "gh-gmoney", name: "G-Money", country: "GH", currency: "GHS", type: "mobile_money" },
  { id: "gh-zeepay", name: "Zeepay", country: "GH", currency: "GHS", type: "fintech" },
  { id: "gh-hubtel", name: "Hubtel", country: "GH", currency: "GHS", type: "fintech" },
];
