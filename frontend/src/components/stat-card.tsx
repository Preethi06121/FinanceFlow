import { Card, CardContent } from "@/components/ui/card";

export function StatCard({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: React.ElementType }) {
  return <Card className="border-border/80 shadow-sm"><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 font-display text-3xl font-semibold tracking-tight">{value}</p></div><span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"><Icon className="size-5" /></span></div><p className="mt-3 text-xs text-muted-foreground">{note}</p></CardContent></Card>;
}
