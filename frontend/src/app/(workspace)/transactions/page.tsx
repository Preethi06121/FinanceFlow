"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Link from "next/link";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { EmptyState, ErrorState, LoadingState } from "@/components/async-state";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch, formatDate, formatMoney, getErrorMessage, Page, Transaction } from "@/lib/financeflow";

const pageSize = 50;

export default function TransactionsPage() {
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<Page<Transaction> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    const params = new URLSearchParams({ offset: String(page * pageSize), limit: String(pageSize) });
    if (status) params.set("status", status);
    try { setData(await apiFetch<Page<Transaction>>(`/transactions?${params}`)); }
    catch (cause) { setError(getErrorMessage(cause)); }
    finally { setLoading(false); }
  }, [page, status]);
  useEffect(() => { void load(); }, [load]);
  const rows = useMemo(() => (data?.items || []).filter((row) => `${row.reference} ${row.currency} ${row.status} ${row.transaction_type}`.toLowerCase().includes(search.toLowerCase())), [data, search]);

  return <>
    <PageHeading title="Transactions" description="Search and review financial transactions recorded in FinanceFlow." />
    <Card className="border-border/80 shadow-sm"><CardContent className="p-4 md:p-5">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm"><Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search transactions" className="pl-9" placeholder="Search reference, currency or type" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">Status<select className="h-9 rounded-md border bg-background px-3 text-sm text-foreground" value={status} onChange={(event) => { setPage(0); setStatus(event.target.value); }}><option value="">All statuses</option>{["pending", "posted", "settled", "failed", "reversed"].map((option) => <option key={option} value={option}>{option[0].toUpperCase() + option.slice(1)}</option>)}</select></label>
      </div>
      {loading ? <LoadingState label="Loading transactions…" /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : rows.length === 0 ? <EmptyState title={search ? "No matching transactions" : "No transactions yet"} description={search ? "Try a different reference, currency or transaction type." : "Transactions will appear here after data is uploaded."} /> : <>
        <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Reference</th><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Account</th><th className="px-4 py-3 text-right font-medium">Amount</th><th className="px-4 py-3 font-medium">Status</th></tr></thead><tbody className="divide-y">{rows.map((row) => <tr key={row.id} className="transition-colors hover:bg-muted/30"><td className="px-4 py-3.5"><Link href={`/transactions/${row.id}`} className="font-medium text-foreground decoration-emerald-700 underline-offset-4 hover:underline">{row.reference}</Link><div className="mt-0.5 text-xs text-muted-foreground">ID {row.id}</div></td><td className="px-4 py-3.5">{row.transaction_type}</td><td className="whitespace-nowrap px-4 py-3.5 text-muted-foreground">{formatDate(row.transaction_date)}</td><td className="px-4 py-3.5 text-muted-foreground">{row.to_account_id ?? row.from_account_id ?? "—"}</td><td className="whitespace-nowrap px-4 py-3.5 text-right font-medium tabular-nums">{formatMoney(row.amount, row.currency)}</td><td className="px-4 py-3.5"><StatusBadge value={row.status} /></td></tr>)}</tbody></table></div>
        <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>Showing {data!.total === 0 ? 0 : page * pageSize + 1}–{Math.min(page * pageSize + data!.items.length, data!.total)} of {data!.total.toLocaleString()} transactions</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="size-4" />Previous</Button><Button variant="outline" size="sm" disabled={(page + 1) * pageSize >= data!.total || loading} onClick={() => setPage((value) => value + 1)}>Next<ChevronRight className="size-4" /></Button></div></div>
      </>}
    </CardContent></Card>
  </>;
}
