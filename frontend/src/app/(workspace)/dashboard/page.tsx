"use client";

import { useCallback, useEffect, useState } from "react";

import Link from "next/link";

import { Activity, ArrowRight, ArrowLeftRight, CircleDollarSign, ShieldAlert, Target } from "lucide-react";

import { EmptyState, ErrorState, LoadingState } from "@/components/async-state";
import { PageHeading } from "@/components/page-heading";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, DashboardSummary, formatAmount, formatDate, formatMoney, getErrorMessage, Page, Transaction } from "@/lib/financeflow";

function Distribution({ title, items }: { title: string; items: Record<string, number> }) {
  const entries = Object.entries(items).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, count]) => count));
  return <Card className="border-border/80 shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="space-y-4 pt-1">{entries.length ? entries.map(([label, count]) => <div key={label}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="truncate text-muted-foreground">{label.replaceAll("_", " ")}</span><span className="font-medium tabular-nums">{count.toLocaleString()}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-700 dark:bg-emerald-400" style={{ width: `${Math.max(2, (count / max) * 100)}%` }} /></div></div>) : <p className="py-6 text-center text-sm text-muted-foreground">No results yet.</p>}</CardContent></Card>;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [aggregate, recent] = await Promise.all([
        apiFetch<DashboardSummary>("/dashboard/summary"),
        apiFetch<Page<Transaction>>("/transactions?offset=0&limit=6"),
      ]);
      setSummary(aggregate); setTransactions(recent.items);
    } catch (cause) { setError(getErrorMessage(cause)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const activeExceptions = summary ? (summary.exceptions.by_status.OPEN || 0) + (summary.exceptions.by_status.UNDER_REVIEW || 0) : 0;
  const matched = summary?.reconciliation.by_status.MATCHED || 0;
  return <>
    <PageHeading title="Dashboard" description="A live view of financial activity, reconciliation outcomes and open work." action={<Button asChild className="bg-[#17392f] text-white hover:bg-[#214a3e]"><Link href="/upload">Upload data <ArrowRight className="size-4" /></Link></Button>} />
    {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : summary && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Transactions" value={summary.transactions.count.toLocaleString()} note="Total transactions recorded" icon={ArrowLeftRight} />
        <StatCard label="Recorded amount sum" value={formatAmount(summary.transactions.amount_total)} note="Raw API sum across currencies; no conversion applied" icon={CircleDollarSign} />
        <StatCard label="Matched records" value={matched.toLocaleString()} note={`${summary.reconciliation.count.toLocaleString()} reconciliation results`} icon={Target} />
        <StatCard label="Active exceptions" value={activeExceptions.toLocaleString()} note={`${(summary.exceptions.by_status.OPEN || 0).toLocaleString()} open · ${(summary.exceptions.by_status.UNDER_REVIEW || 0).toLocaleString()} under review`} icon={ShieldAlert} />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Card className="border-border/80 shadow-sm"><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle className="text-base">Recent transactions</CardTitle><p className="mt-1 text-sm text-muted-foreground">Latest records from FinanceFlow</p></div><Button asChild variant="ghost" size="sm"><Link href="/transactions">View all <ArrowRight className="size-4" /></Link></Button></CardHeader><CardContent className="p-0">{transactions.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-y bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-6 py-3 font-medium">Reference</th><th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Amount</th><th className="px-6 py-3 font-medium">Status</th></tr></thead><tbody className="divide-y">{transactions.map((item) => <tr key={item.id} className="hover:bg-muted/30"><td className="px-6 py-3.5"><Link className="font-medium hover:underline" href={`/transactions/${item.id}`}>{item.reference}</Link></td><td className="whitespace-nowrap px-4 py-3.5 text-muted-foreground">{formatDate(item.transaction_date)}</td><td className="whitespace-nowrap px-4 py-3.5 tabular-nums">{formatMoney(item.amount, item.currency)}</td><td className="px-6 py-3.5"><StatusBadge value={item.status} /></td></tr>)}</tbody></table></div> : <div className="p-5"><EmptyState title="No transactions yet" description="Uploaded sales records will appear here." /></div>}</CardContent></Card>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-1"><Distribution title="Reconciliation results" items={summary.reconciliation.by_status} /><Distribution title="Exception priority" items={summary.exceptions.by_priority} /></div>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2"><Distribution title="Transaction status" items={summary.transactions.by_status} /><Card className="border-border/80 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Activity className="size-4 text-emerald-700" />Operational overview</CardTitle><p className="text-sm text-muted-foreground">Current totals returned by the FinanceFlow API.</p></CardHeader><CardContent className="grid grid-cols-2 gap-4"><div className="rounded-lg bg-muted/50 p-4"><p className="text-xs text-muted-foreground">Reconciliation records</p><p className="mt-2 text-2xl font-semibold">{summary.reconciliation.count.toLocaleString()}</p></div><div className="rounded-lg bg-muted/50 p-4"><p className="text-xs text-muted-foreground">All exceptions</p><p className="mt-2 text-2xl font-semibold">{summary.exceptions.count.toLocaleString()}</p></div></CardContent></Card></div>
    </>}
  </>;
}
