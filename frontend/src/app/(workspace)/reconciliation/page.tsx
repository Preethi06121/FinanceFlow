"use client";

import { useCallback, useEffect, useState } from "react";

import { Activity, Play, RefreshCw } from "lucide-react";

import { EmptyState, ErrorState, LoadingState, Notice } from "@/components/async-state";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, formatAmount, formatDate, getErrorMessage, Page, Reconciliation } from "@/lib/financeflow";

type RunResult = { database?: string; sales_rows?: number; valid_transactions?: number; validation_failures?: number; transactions_with_validation_failures?: number; reconciliation?: Record<string, number>; exceptions_created?: number; exceptions_added_this_run?: number };

export default function ReconciliationPage() {
  const [rows, setRows] = useState<Page<Reconciliation> | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setRows(await apiFetch<Page<Reconciliation>>("/reconciliation/results?offset=0&limit=100")); }
    catch (cause) { setError(getErrorMessage(cause)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function run() {
    setRunning(true); setError(""); setRunResult(null);
    try { setRunResult(await apiFetch<RunResult>("/reconciliation/run", { method: "POST" })); await load(); }
    catch (cause) { setError(getErrorMessage(cause)); }
    finally { setRunning(false); }
  }

  return <>
    <PageHeading title="Reconciliation" description="Compare sales records with ledger entries and review the persisted reconciliation outcomes." action={<Button onClick={() => void run()} disabled={running} className="bg-[#17392f] text-white hover:bg-[#214a3e]"><Play className="size-4" />{running ? "Reconciliation running…" : "Run reconciliation"}</Button>} />
    {error && <div className="mb-5"><Notice>{error}</Notice></div>}
    {runResult && <div className="mb-5"><Notice tone="success">Reconciliation completed. {runResult.sales_rows?.toLocaleString() ?? "—"} sales rows processed; {runResult.validation_failures?.toLocaleString() ?? "—"} validation failures; {runResult.exceptions_added_this_run?.toLocaleString() ?? "—"} new exceptions created.</Notice></div>}
    {runResult?.reconciliation && <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(runResult.reconciliation).map(([status, count]) => <Card key={status} className="border-border/80"><CardContent className="flex items-center justify-between p-4"><StatusBadge value={status} /><span className="text-xl font-semibold tabular-nums">{count.toLocaleString()}</span></CardContent></Card>)}</div>}
    <Card className="border-border/80 shadow-sm"><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle className="flex items-center gap-2 text-base"><Activity className="size-4 text-emerald-700" />Reconciliation results</CardTitle><p className="mt-1 text-sm text-muted-foreground">Persisted outcomes from the latest FinanceFlow processing run.</p></div><Button variant="outline" size="sm" disabled={loading} onClick={() => void load()}><RefreshCw className="size-4" />Refresh</Button></CardHeader><CardContent className="p-0">{loading ? <div className="p-5"><LoadingState label="Loading reconciliation results…" /></div> : error && !rows ? <div className="p-5"><ErrorState message={error} onRetry={() => void load()} /></div> : rows?.items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[750px] text-left text-sm"><thead className="border-y bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Transaction</th><th className="px-4 py-3 font-medium">Outcome</th><th className="px-4 py-3 text-right font-medium">Source</th><th className="px-4 py-3 text-right font-medium">Ledger</th><th className="px-4 py-3 text-right font-medium">Difference</th><th className="px-5 py-3 font-medium">Processed</th></tr></thead><tbody className="divide-y">{rows.items.map((row) => <tr key={row.id} className="hover:bg-muted/30"><td className="px-5 py-3.5 font-medium">{row.transaction_reference}</td><td className="px-4 py-3.5"><StatusBadge value={row.status} /></td><td className="px-4 py-3.5 text-right tabular-nums">{formatAmount(row.source_amount)}</td><td className="px-4 py-3.5 text-right tabular-nums">{formatAmount(row.ledger_amount)}</td><td className="px-4 py-3.5 text-right tabular-nums">{formatAmount(row.difference)}</td><td className="whitespace-nowrap px-5 py-3.5 text-muted-foreground">{formatDate(row.created_at)}</td></tr>)}</tbody></table><div className="border-t px-5 py-3 text-xs text-muted-foreground">Showing {rows.items.length} of {rows.total.toLocaleString()} reconciliation results</div></div> : <div className="p-5"><EmptyState title="No reconciliation results" description="Run reconciliation to compare the current sales and ledger records." /></div>}</CardContent></Card>
  </>;
}
