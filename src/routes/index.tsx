import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";

import { FlowProgress } from "@/components/bmc/FlowProgress";
import { Button, Notice, Row, StatusBadge, TextField } from "@/components/bmc/primitives";
import {
  cancelOrder,
  checkPayment,
  createOrder,
  declareDepositSent,
  fetchBanks,
  fetchConversionRates,
  fetchOrder,
  requestPayout,
} from "@/lib/bmc/api";
import { PROVIDER_GROUPS, type Bank } from "@/lib/bmc/banks";
import {
  CURRENCIES,
  MIN_AMOUNT,
  convertFiatToZec,
  formatFiat,
  formatUsd,
  formatZec,
  maskAccount,
  type ConversionRates,
  type Currency,
} from "@/lib/bmc/conversion";
import { IS_BACKEND_CONFIGURED } from "@/lib/bmc/endpoints";
import { EXCEPTION_STATUSES, STATUS_LABELS, getTrackingStages } from "@/lib/bmc/status";
import type { TransactionOrder } from "@/lib/bmc/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Build My Crypto — Send Zcash, recipients get NGN or GHS" },
      {
        name: "description",
        content:
          "Build My Crypto converts ZEC into Nigerian Naira or Ghanaian Cedi paid straight into a recipient's bank account, with live rates and on-chain transaction tracking.",
      },
      { property: "og:title", content: "Build My Crypto — Zcash to Naira and Cedi payouts" },
      {
        property: "og:description",
        content:
          "Set the amount your recipient receives, send the quoted ZEC, and track the payout from deposit detection to bank credit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BuildMyCrypto,
});

type Step = 1 | 2 | 3 | 4 | 5;

type RecipientForm = {
  accountNumber: string;
  accountName: string;
  providerName: string;
  providerCode: string;
  providerType: string;
};

const EMPTY_RECIPIENT: RecipientForm = {
  accountNumber: "",
  accountName: "",
  providerName: "",
  providerCode: "",
  providerType: "",
};

function BuildMyCrypto() {
  const [step, setStep] = useState<Step>(1);
  const [currency, setCurrency] = useState<Currency>("NGN");
  const [amount, setAmount] = useState("100000");
  const [rates, setRates] = useState<ConversionRates | null>(null);
  const [loadingRates, setLoadingRates] = useState(true);
  const [rateError, setRateError] = useState("");
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankSearch, setBankSearch] = useState("");
  const [bankError, setBankError] = useState("");
  const [recipient, setRecipient] = useState<RecipientForm>(EMPTY_RECIPIENT);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [order, setOrder] = useState<TransactionOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState("");

  const meta = CURRENCIES[currency];
  const numericAmount = Number(amount.replace(/,/g, "")) || 0;

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  const loadRates = useCallback(async () => {
    setLoadingRates(true);
    setRateError("");
    try {
      setRates(await fetchConversionRates());
    } catch (error) {
      setRateError(error instanceof Error ? error.message : "Live exchange rates are unavailable.");
    } finally {
      setLoadingRates(false);
    }
  }, []);

  useEffect(() => {
    void loadRates();
    const interval = window.setInterval(() => void loadRates(), 60_000);
    return () => window.clearInterval(interval);
  }, [loadRates]);

  useEffect(() => {
    let cancelled = false;
    setBankError("");
    fetchBanks(meta.countryCode)
      .then((list) => !cancelled && setBanks(list))
      .catch((error: unknown) =>
        !cancelled &&
        setBankError(error instanceof Error ? error.message : "Unable to load the provider list."),
      );
    return () => {
      cancelled = true;
    };
  }, [meta.countryCode]);

  const conversion = useMemo(() => {
    if (!rates || numericAmount <= 0) return null;
    try {
      return convertFiatToZec(numericAmount, currency, rates);
    } catch {
      return null;
    }
  }, [rates, numericAmount, currency]);

  const amountError =
    numericAmount > 0 && numericAmount < MIN_AMOUNT[currency]
      ? `Minimum is ${formatFiat(MIN_AMOUNT[currency], currency)}`
      : numericAmount <= 0
        ? "Enter the amount the recipient should receive."
        : "";

  const recipientErrors = {
    accountNumber: !recipient.accountNumber.trim()
      ? "Account number is required."
      : !/^[A-Za-z0-9\- ]{6,20}$/.test(recipient.accountNumber.trim())
        ? "Enter a valid account number."
        : "",
    accountName: !recipient.accountName.trim()
      ? "Account name is required."
      : recipient.accountName.trim().length < 2
        ? "Enter the account holder name."
        : "",
    providerName: !recipient.providerName ? "Select where the money should land." : "",
  };
  const recipientValid = Object.values(recipientErrors).every((value) => !value);

  const filteredBanks = banks.filter((bank) =>
    bank.name.toLowerCase().includes(bankSearch.trim().toLowerCase()),
  );

  // Polling: the UI never advances on its own, it mirrors backend state only.
  useEffect(() => {
    if (!order || step < 4) return;
    if (["COMPLETED", "CANCELLED", "EXPIRED"].includes(order.status)) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const result = await checkPayment(order.id);
        if (cancelled) return;
        const fresh = await fetchOrder(order.id);
        if (cancelled) return;
        setOrder(fresh);
        if (result.error) setActionError(result.error);
      } catch (error) {
        if (!cancelled)
          setActionError(
            error instanceof Error ? error.message : "Transaction status is temporarily unavailable.",
          );
      }
    };
    void tick();
    const interval = window.setInterval(() => void tick(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [order?.id, order?.status, step]);

  const chooseCurrency = (next: Currency) => {
    setCurrency(next);
    setRecipient((prev) => ({ ...prev, providerName: "", providerCode: "", providerType: "" }));
    setBankSearch("");
  };

  const submitOrder = async () => {
    if (!conversion) return;
    setBusy(true);
    setActionError("");
    try {
      const created = await createOrder({
        fiatCurrency: currency,
        fiatAmount: conversion.fiatAmount,
        requiredZec: Number(conversion.zecAmount.toFixed(6)),
        quotedRate: conversion.fiatPerZec,
        recipient: {
          providerName: recipient.providerName,
          providerCode: recipient.providerCode,
          providerType: recipient.providerType,
          accountNumber: recipient.accountNumber.trim(),
          accountName: recipient.accountName.trim(),
          country: meta.country,
          currency,
        },
      });
      setOrder(created);
      setStep(4);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The transaction order could not be created.");
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (fn: () => Promise<TransactionOrder>, success: string) => {
    setBusy(true);
    setActionError("");
    try {
      setOrder(await fn());
      showToast(success);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "That action could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  const copyAddress = async () => {
    if (!order) return;
    try {
      await navigator.clipboard.writeText(order.depositAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Copy failed — select the address manually.");
    }
  };

  const marketStatus = loadingRates ? "Updating rates" : rateError ? "Rate unavailable" : "Live market rates";

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary font-display text-lg font-bold text-primary-foreground">
            Z
          </span>
          <span className="leading-tight">
            <strong className="block font-display text-sm tracking-[0.18em]">BUILD MY CRYPTO</strong>
            <small className="text-xs text-muted-foreground">Powered by Zcash</small>
          </span>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
            rateError ? "border-destructive/40 text-destructive" : "border-success/30 text-success",
          )}
        >
          <span className="size-1.5 animate-pulse rounded-full bg-current" />
          {marketStatus}
        </span>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-5 pb-20 lg:grid-cols-[1fr_minmax(0,28rem)] lg:items-start">
        <section className="pt-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">
            Private payments for Africa
          </span>
          <h1 className="mt-6 text-4xl leading-[1.05] sm:text-5xl">
            Send Zcash.
            <br />
            <em className="not-italic text-primary">They get paid in cash.</em>
          </h1>
          <p className="mt-5 max-w-lg text-base text-muted-foreground">
            Choose Naira or Cedi, set exactly what the recipient should receive, send the quoted ZEC, and
            follow the payment from the moment it lands on-chain to the moment the bank account is credited.
          </p>

          <div className="panel mt-8 flex items-center justify-between gap-4 p-5">
            <div>
              <span className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">ZEC / USD</span>
              <strong className="mt-1 block font-display text-2xl">
                {rates ? formatUsd(rates.zecUsd) : "—"}
              </strong>
              <small className="text-xs text-muted-foreground">
                {rates ? `Live · ${rates.source}` : rateError || "Waiting for market data"}
              </small>
            </div>
            <button
              onClick={() => void loadRates()}
              disabled={loadingRates}
              aria-label="Refresh market rates"
              className="flex size-10 items-center justify-center rounded-full border border-border text-lg hover:border-primary disabled:opacity-40"
            >
              <span className={loadingRates ? "inline-block animate-spin" : ""}>↻</span>
            </button>
          </div>

          {!IS_BACKEND_CONFIGURED && (
            <div className="mt-6">
              <Notice tone="warn">
                <strong>Simulation mode.</strong> The live service links have not been supplied yet, so orders,
                deposit detection and payouts run on a clearly-marked local stand-in. Every screen and rule is
                final — only the links need swapping in.
              </Notice>
            </div>
          )}
        </section>

        <section className="panel p-6 sm:p-7">
          <FlowProgress step={step} />

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Step 1 of 5
                </span>
                <h2 className="mt-1 text-xl">Recipient gets</h2>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(CURRENCIES) as Currency[]).map((code) => (
                  <button
                    key={code}
                    onClick={() => chooseCurrency(code)}
                    className={cn(
                      "rounded-xl border px-4 py-3 text-left transition-colors",
                      currency === code
                        ? "border-primary bg-primary/10"
                        : "border-border bg-surface-2 hover:border-primary/50",
                    )}
                  >
                    <span className="block text-lg">{CURRENCIES[code].flag}</span>
                    <strong className="mt-1 block text-sm">{code}</strong>
                    <small className="text-xs text-muted-foreground">{CURRENCIES[code].name}</small>
                  </button>
                ))}
              </div>

              <TextField
                label={`Amount in ${currency}`}
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0"
                error={touched.amount ? amountError : ""}
                onBlur={() => setTouched((prev) => ({ ...prev, amount: true }))}
                className="font-display text-2xl"
              />

              <div className="rounded-xl border border-border bg-surface-2 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
                    You send
                  </span>
                  <span className="font-mono text-lg text-primary">
                    {conversion ? `${formatZec(conversion.zecAmount)} ZEC` : "—"}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {rateError
                    ? rateError
                    : conversion
                      ? `1 ZEC ≈ ${formatFiat(conversion.fiatPerZec, currency)} · ${formatUsd(conversion.usdValue)}`
                      : "Quote appears once a valid amount and a live rate are available."}
                </p>
              </div>

              <Button
                disabled={Boolean(amountError) || !conversion}
                onClick={() => {
                  setTouched((prev) => ({ ...prev, amount: true }));
                  if (!amountError && conversion) setStep(2);
                }}
              >
                Continue
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Step 2 of 5
                </span>
                <h2 className="mt-1 text-xl">Where should the money land?</h2>
              </div>

              {bankError && <Notice tone="bad">{bankError}</Notice>}

              <TextField
                label="Search bank, fintech or wallet"
                value={bankSearch}
                onChange={(event) => setBankSearch(event.target.value)}
                placeholder={meta.country === "Nigeria" ? "e.g. Access Bank" : "e.g. MTN MoMo"}
              />

              <div className="max-h-56 space-y-3 overflow-y-auto rounded-xl border border-border bg-surface-2 p-3">
                {PROVIDER_GROUPS.map((group) => {
                  const items = filteredBanks.filter((bank) => bank.type === group.type);
                  if (!items.length) return null;
                  return (
                    <div key={group.type}>
                      <p className="px-1 pb-1 text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">
                        {group.label}
                      </p>
                      <div className="grid gap-1">
                        {items.map((bank) => (
                          <button
                            key={bank.id}
                            onClick={() =>
                              setRecipient((prev) => ({
                                ...prev,
                                providerName: bank.name,
                                providerCode: bank.code ?? "",
                                providerType: bank.type,
                              }))
                            }
                            className={cn(
                              "rounded-lg px-3 py-2 text-left text-sm transition-colors",
                              recipient.providerName === bank.name
                                ? "bg-primary/15 text-primary"
                                : "hover:bg-surface",
                            )}
                          >
                            {bank.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {!filteredBanks.length && (
                  <p className="px-1 py-6 text-center text-sm text-muted-foreground">No match found.</p>
                )}
              </div>
              {touched.providerName && recipientErrors.providerName && (
                <p className="text-xs text-destructive">{recipientErrors.providerName}</p>
              )}

              <TextField
                label="Account number"
                value={recipient.accountNumber}
                onChange={(event) =>
                  setRecipient((prev) => ({ ...prev, accountNumber: event.target.value }))
                }
                onBlur={() => setTouched((prev) => ({ ...prev, accountNumber: true }))}
                error={touched.accountNumber ? recipientErrors.accountNumber : ""}
                inputMode="numeric"
                placeholder="0123456789"
              />
              <TextField
                label="Account name"
                value={recipient.accountName}
                onChange={(event) => setRecipient((prev) => ({ ...prev, accountName: event.target.value }))}
                onBlur={() => setTouched((prev) => ({ ...prev, accountName: true }))}
                error={touched.accountName ? recipientErrors.accountName : ""}
                placeholder="Full name on the account"
              />

              <div className="grid grid-cols-2 gap-3">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  onClick={() => {
                    setTouched({ accountNumber: true, accountName: true, providerName: true, amount: true });
                    if (recipientValid) setStep(3);
                  }}
                >
                  Review
                </Button>
              </div>
            </div>
          )}

          {step === 3 && conversion && (
            <div className="space-y-5">
              <div>
                <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Step 3 of 5
                </span>
                <h2 className="mt-1 text-xl">Check everything</h2>
              </div>

              <div className="rounded-xl border border-border bg-surface-2 px-4 py-1">
                <Row label="Recipient gets" value={formatFiat(conversion.fiatAmount, currency)} />
                <Row label="You send" value={`${formatZec(conversion.zecAmount)} ZEC`} mono />
                <Row label="Quoted rate" value={`1 ZEC = ${formatFiat(conversion.fiatPerZec, currency)}`} />
                <Row label="Destination" value={recipient.providerName} />
                <Row label="Account" value={maskAccount(recipient.accountNumber)} mono />
                <Row label="Account name" value={recipient.accountName} />
                <Row label="Country" value={meta.country} />
              </div>

              <p className="text-xs text-muted-foreground">
                The quote is locked when the order is created and stays valid for 30 minutes.
              </p>
              {actionError && <Notice tone="bad">{actionError}</Notice>}

              <div className="grid grid-cols-2 gap-3">
                <Button variant="ghost" onClick={() => setStep(2)} disabled={busy}>
                  Back
                </Button>
                <Button onClick={() => void submitOrder()} disabled={busy}>
                  {busy ? "Creating…" : "Create order"}
                </Button>
              </div>
            </div>
          )}

          {step >= 4 && order && (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Order {order.id}
                  </span>
                  <h2 className="mt-1 text-xl">
                    {step === 4 ? "Send your ZEC" : "Transaction progress"}
                  </h2>
                </div>
                <StatusBadge status={order.status} />
              </div>

              {step === 4 && (
                <>
                  <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
                    <span className="text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
                      Send exactly
                    </span>
                    <strong className="mt-1 block font-mono text-2xl text-primary">
                      {formatZec(order.requiredZec)} ZEC
                    </strong>
                    <p className="mt-4 text-[0.68rem] uppercase tracking-[0.14em] text-muted-foreground">
                      To this address
                    </p>
                    <p className="mt-1 break-all font-mono text-xs">{order.depositAddress}</p>
                    <Button variant="ghost" className="mt-3" onClick={() => void copyAddress()}>
                      {copied ? "Copied" : "Copy address"}
                    </Button>
                  </div>

                  <div className="rounded-xl border border-border bg-surface-2 px-4 py-1">
                    <Row label="Recipient gets" value={formatFiat(order.fiatAmount, order.fiatCurrency)} />
                    <Row label="Destination" value={order.recipient.providerName} />
                    <Row label="Account" value={maskAccount(order.recipient.accountNumber)} mono />
                    <Row label="Expires" value={new Date(order.expiresAt).toLocaleTimeString()} />
                  </div>

                  <Button
                    onClick={() =>
                      void runAction(async () => {
                        await declareDepositSent(order.id);
                        const fresh = await fetchOrder(order.id);
                        setStep(5);
                        return fresh;
                      }, "Watching the network for your deposit.")
                    }
                    disabled={busy || order.status !== "AWAITING_ZEC"}
                  >
                    I have sent the ZEC
                  </Button>
                  <button
                    className="w-full text-xs text-muted-foreground underline-offset-4 hover:underline"
                    onClick={() => setStep(5)}
                  >
                    Skip to tracking
                  </button>
                </>
              )}

              {step === 5 && (
                <>
                  <ol className="space-y-3">
                    {getTrackingStages(order.status).map((stage) => (
                      <li key={stage.status} className="flex items-start gap-3">
                        <span
                          className={cn(
                            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[0.6rem]",
                            stage.done && "border-success bg-success text-success-foreground",
                            stage.current && "border-primary text-primary",
                            !stage.done && !stage.current && "border-border text-muted-foreground",
                          )}
                        >
                          {stage.done ? "\u2713" : ""}
                        </span>
                        <div>
                          <p
                            className={cn(
                              "text-sm",
                              stage.done || stage.current ? "text-foreground" : "text-muted-foreground",
                            )}
                          >
                            {stage.label}
                          </p>
                          {order.statusTimestamps[stage.status] && (
                            <p className="text-xs text-muted-foreground">
                              {new Date(order.statusTimestamps[stage.status]!).toLocaleTimeString()}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>

                  {order.payment && (
                    <div className="rounded-xl border border-border bg-surface-2 px-4 py-1">
                      <Row label="Received" value={`${formatZec(order.payment.receivedZec)} ZEC`} mono />
                      <Row
                        label="Confirmations"
                        value={`${order.payment.confirmations}/${order.payment.requiredConfirmations}`}
                      />
                      <Row label="Transaction id" value={order.payment.txid} mono />
                    </div>
                  )}

                  {order.payout && (
                    <div className="rounded-xl border border-border bg-surface-2 px-4 py-1">
                      <Row label="Payout status" value={order.payout.status} />
                      <Row label="Reference" value={order.payout.providerReference ?? "—"} mono />
                      <Row label="Attempts" value={String(order.payout.attempts.length)} />
                    </div>
                  )}

                  {EXCEPTION_STATUSES.includes(order.status) && (
                    <Notice tone={order.status === "UNDERPAID" || order.status === "OVERPAID" ? "warn" : "bad"}>
                      {STATUS_LABELS[order.status]}.{" "}
                      {order.status === "UNDERPAID" && "Top up the difference or contact support for a refund."}
                      {order.status === "OVERPAID" && "The surplus is held for refund; no payout was started."}
                      {order.status === "EXPIRED" && "Start a new order — late funds are never auto-completed."}
                      {order.status === "PAYOUT_FAILED" && "You can retry the payout below."}
                      {order.status === "CANCELLED" && "This transaction was cancelled."}
                    </Notice>
                  )}

                  {actionError && <Notice tone="bad">{actionError}</Notice>}

                  <div className="grid gap-3">
                    {["ZEC_CONFIRMED", "PAYOUT_FAILED"].includes(order.status) && (
                      <Button
                        onClick={() => void runAction(() => requestPayout(order.id), "Payout requested.")}
                        disabled={busy}
                      >
                        {order.status === "PAYOUT_FAILED" ? "Retry payout" : "Release fiat payout"}
                      </Button>
                    )}
                    {["AWAITING_ZEC", "ZEC_DETECTED", "CONFIRMING", "UNDERPAID", "OVERPAID"].includes(
                      order.status,
                    ) && (
                      <Button
                        variant="danger"
                        onClick={() => void runAction(() => cancelOrder(order.id), "Transaction cancelled.")}
                        disabled={busy}
                      >
                        Cancel transaction
                      </Button>
                    )}
                    {["COMPLETED", "CANCELLED", "EXPIRED"].includes(order.status) && (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setOrder(null);
                          setRecipient(EMPTY_RECIPIENT);
                          setTouched({});
                          setActionError("");
                          setStep(1);
                        }}
                      >
                        Start another transaction
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-border bg-surface px-5 py-2.5 text-sm shadow-[var(--shadow-card)]">
          {toast}
        </div>
      )}
    </div>
  );
}
