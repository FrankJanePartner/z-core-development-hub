import { cn } from "@/lib/utils";

const STEPS = ["Amount", "Recipient", "Review", "Pay ZEC", "Track"];

export function FlowProgress({ step }: { step: number }) {
  return (
    <div className="relative mb-8">
      <div className="absolute left-0 right-0 top-4 h-px bg-border">
        <span
          className="block h-px bg-primary transition-all duration-500"
          style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
        />
      </div>
      <ol className="relative flex justify-between">
        {STEPS.map((label, index) => {
          const value = index + 1;
          const done = step > value;
          const current = step === value;
          return (
            <li key={label} className="flex flex-col items-center gap-2">
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                  done && "border-primary bg-primary text-primary-foreground",
                  current && "border-primary bg-background text-primary",
                  !done && !current && "border-border bg-background text-muted-foreground",
                )}
              >
                {done ? "\u2713" : value}
              </span>
              <span
                className={cn(
                  "text-[0.65rem] uppercase tracking-[0.12em]",
                  current || done ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
