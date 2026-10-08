import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function LoadingState({ label = "Loading FinanceFlow data…" }: { label?: string }) {
  return <Card><CardContent className="flex min-h-40 items-center justify-center gap-3 text-sm text-muted-foreground"><span className="size-4 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent" />{label}</CardContent></Card>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <Card><CardContent className="flex min-h-48 flex-col items-center justify-center px-6 text-center"><div className="mb-3 size-10 rounded-full bg-muted" /><h3 className="font-semibold">{title}</h3><p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p></CardContent></Card>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <Card className="border-rose-200 dark:border-rose-900"><CardContent className="flex flex-col items-start gap-2 p-5"><p className="font-medium text-rose-800 dark:text-rose-300">Unable to load this view</p><p className="text-sm text-muted-foreground">{message}</p>{onRetry && <Button variant="outline" size="sm" className="mt-1" onClick={onRetry}>Try again</Button>}</CardContent></Card>;
}

export function Notice({ children, tone = "error" }: { children: React.ReactNode; tone?: "error" | "success" | "info" }) {
  const styles = tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200" : tone === "info" ? "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200" : "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200";
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}
