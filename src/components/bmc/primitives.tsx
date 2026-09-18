import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, type TransactionStatus } from "@/lib/bmc/status";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold tracking-tight transition-all disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" &&
          "bg-primary text-primary-foreground hover:brightness-110 active:scale-[0.99] shadow-[0_18px_40px_-20px_var(--color-primary)]",
        variant === "ghost" && "border border-border bg-surface-2 text-foreground hover:border-primary/60",
        variant === "danger" && "border border-destructive/50 bg-transparent text-destructive hover:bg-destructive/10",
        className,
      )}
    />
  );
}

export function TextField({
  label,
  error,
  hint,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  return (
    <label className="block">
      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <input
        {...props}
        className={cn(
          "field mt-2 focus:field-focus",
          error && "border-destructive",
          className,
        )}
      />
      {error ? (
        <span className="mt-1.5 block text-xs text-destructive">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}

export function Row({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border/60 py-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-right text-sm font-semibold", mono && "font-mono text-[0.82rem]")}>{value}</span>
    </div>
  );
}

const TONE: Record<string, string> = {
  good: "bg-success/15 text-success border-success/30",
  warn: "bg-warning/15 text-warning border-warning/30",
  bad: "bg-destructive/15 text-destructive border-destructive/30",
  idle: "bg-accent/15 text-accent border-accent/30",
};

export function StatusBadge({ status }: { status: TransactionStatus }) {
  const tone =
    status === "COMPLETED" || status === "FIAT_SENT" || status === "ZEC_CONFIRMED"
      ? "good"
      : status === "EXPIRED" || status === "CANCELLED" || status === "PAYOUT_FAILED"
        ? "bad"
        : status === "UNDERPAID" || status === "OVERPAID"
          ? "warn"
          : "idle";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.1em]",
        TONE[tone],
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function Notice({
  tone = "warn",
  children,
}: {
  tone?: "warn" | "bad" | "idle";
  children: ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border px-4 py-3 text-sm", TONE[tone])}>{children}</div>
  );
}
