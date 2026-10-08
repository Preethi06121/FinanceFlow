import { labelize } from "@/lib/financeflow";
import { cn } from "@/lib/utils";

export function StatusBadge({ value, className }: { value: string; className?: string }) {
  const normalized = value.toUpperCase();
  const tone = normalized === "MATCHED" || normalized === "RESOLVED" || normalized === "SETTLED" || normalized === "POSTED"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300"
    : normalized === "OPEN" || normalized === "MISSING_LEDGER" || normalized === "MISSING_SOURCE" || normalized === "FAILED"
      ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300"
      : normalized === "CRITICAL" || normalized === "HIGH" || normalized === "AMOUNT_MISMATCH"
        ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300"
        : "border-border bg-muted text-muted-foreground";
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium", tone, className)}>{labelize(value)}</span>;
}
