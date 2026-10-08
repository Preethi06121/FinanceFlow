"use client";

import { useCallback, useEffect, useState } from "react";

import { BarChart3, CircleDollarSign, ShieldAlert, Target, TrendingUp } from "lucide-react";

import { ErrorState, LoadingState, Notice } from "@/components/async-state";
import { PageHeading } from "@/components/page-heading";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, DashboardSummary, formatAmount, getErrorMessage } from "@/lib/financeflow";

function Breakdown({ title, description, data }: { title: string; description: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  const max = Math.max(1, ...entries.map(([, count]) => count));
  return <Card className="border-border/80 shadow-sm"><CardHeader><CardTitle className="text-base">{title}</CardTitle><p className="text-sm text-muted-foreground">{description}</p></CardHeader><CardContent className="space-y-4">{entries.length ? entries.map(([label, count]) => <div key={label}><div className="mb-1.5 flex items-center justify-between gap-3"><StatusBadge value={label} /><span className="text-sm font-medium tabular-nums">{count.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">({total ? ((count / total) * 100).toFixed(1) : "0.0"}%)</span></span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-700 dark:bg-emerald-400" style={{ width: `${Math.max(2, (count / max) * 100)}%` }} /></div></div>) : <p className="py-4 text-sm text-muted-foreground">No data available yet.</p>}</CardContent></Card>;
}

export default function ReportsPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(await apiFetch<DashboardSummary>("/dashboard/summary")); }
    catch (cause) { setError(getErrorMessage(cause)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <>
    <PageHeading title="Reports" description="Operational summaries and status distributions backed by FinanceFlow API aggregates." />
    {loading ? <LoadingState label="Preparing reports…" /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : data && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Transactions" value={data.transactions.count.toLocaleString()} note="Recorded transaction count" icon={TrendingUp} /><StatCard label="Recorded amount sum" value={formatAmount(data.transactions.amount_total)} note="Raw API sum across currencies; no conversion applied" icon={CircleDollarSign} /><StatCard label="Reconciled items" value={data.reconciliation.count.toLocaleString()} note="Persisted reconciliation results" icon={Target} /><StatCard label="Exceptions" value={data.exceptions.count.toLocaleString()} note="Persisted exception records" icon={ShieldAlert} /></div>
      <div className="mt-5 grid gap-5 xl:grid-cols-3"><Breakdown title="Transaction status" description="Distribution of transactions by current status." data={data.transactions.by_status} /><Breakdown title="Reconciliation outcomes" description="Comparison outcomes returned from stored reconciliation results." data={data.reconciliation.by_status} /><Breakdown title="Exception status" description="Current lifecycle state for exception records." data={data.exceptions.by_status} /></div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2"><Breakdown title="Exception priority" description="Priority breakdown from recorded exceptions." data={data.exceptions.by_priority} /><Card className="border-border/80 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="size-4 text-emerald-700" />Report coverage</CardTitle></CardHeader><CardContent className="space-y-3 text-sm leading-6 text-muted-foreground"><p>These summaries use the actual aggregates returned by <code className="rounded bg-muted px-1.5 py-0.5 text-xs">GET /dashboard/summary</code>.</p><Notice tone="info">The current API does not expose validation result aggregates, so no validation failure chart or count is shown here.</Notice></CardContent></Card></div>
    </>}
  </>;
}
