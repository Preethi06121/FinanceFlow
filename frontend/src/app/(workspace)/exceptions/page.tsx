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
import { apiFetch, formatAmount, formatDate, getErrorMessage, Page, FinanceException } from "@/lib/financeflow";

const pageSize = 50;

export default function ExceptionsPage() {
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<Page<FinanceException> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    const params = new URLSearchParams({ offset: String(page * pageSize), limit: String(pageSize) });
    if (status) params.set("status", status);
    if (priority) params.set("priority", priority);
    try { setData(await apiFetch<Page<FinanceException>>(`/exceptions?${params}`)); }
    catch (cause) { setError(getErrorMessage(cause)); }
    finally { setLoading(false); }
  }, [page, status, priority]);
  useEffect(() => { void load(); }, [load]);
  const rows = useMemo(() => (data?.items || []).filter((row) => `${row.transaction_reference || ""} ${row.exception_type} ${row.reason} ${row.status} ${row.priority}`.toLowerCase().includes(search.toLowerCase())), [data, search]);

  return <>
    <PageHeading title="Exceptions" description="Investigate data quality and reconciliation issues, then track each resolution." />
    <Card className="border-border/80 shadow-sm"><CardContent className="p-4 md:p-5">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative w-full xl:max-w-sm"><Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search exceptions" className="pl-9" placeholder="Search reference, type or reason" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <div className="flex flex-wrap gap-2"><label className="flex items-center gap-2 text-sm text-muted-foreground">Status<select className="h-9 rounded-md border bg-background px-3 text-sm text-foreground" value={status} onChange={(event) => { setPage(0); setStatus(event.target.value); }}><option value="">All</option>{["OPEN", "UNDER_REVIEW", "RESOLVED"].map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></label><label className="flex items-center gap-2 text-sm text-muted-foreground">Priority<select className="h-9 rounded-md border bg-background px-3 text-sm text-foreground" value={priority} onChange={(event) => { setPage(0); setPriority(event.target.value); }}><option value="">All</option>{["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div>
      </div>
      {loading ? <LoadingState label="Loading exceptions…" /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : rows.length === 0 ? <EmptyState title={search ? "No matching exceptions" : "No exceptions found"} description={search ? "Try changing your search or filters." : "Processing issues will appear here when they are identified."} /> : <>
        <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[960px] text-left text-sm"><thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Exception</th><th className="px-4 py-3 font-medium">Transaction</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Priority</th><th className="px-4 py-3 text-right font-medium">Difference</th><th className="px-4 py-3 font-medium">Created</th><th className="px-4 py-3 font-medium">Action</th></tr></thead><tbody className="divide-y">{rows.map((row) => <tr key={row.id} className="hover:bg-muted/30"><td className="px-4 py-3.5"><Link className="font-medium hover:underline" href={`/exceptions/${row.id}`}>{row.exception_type.replaceAll("_", " ")}</Link><div className="mt-1 max-w-sm truncate text-xs text-muted-foreground">{row.reason}</div></td><td className="px-4 py-3.5 text-muted-foreground">{row.transaction_reference || "—"}</td><td className="px-4 py-3.5"><StatusBadge value={row.status} /></td><td className="px-4 py-3.5"><StatusBadge value={row.priority} /></td><td className="px-4 py-3.5 text-right font-medium tabular-nums">{formatAmount(row.difference)}</td><td className="whitespace-nowrap px-4 py-3.5 text-muted-foreground">{formatDate(row.created_at)}</td><td className="px-4 py-3.5"><Button asChild variant="outline" size="sm"><Link href={`/exceptions/${row.id}`}>{row.status === "RESOLVED" ? "View" : "Investigate"}</Link></Button></td></tr>)}</tbody></table></div>
        <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>Showing {page * pageSize + 1}–{Math.min(page * pageSize + data!.items.length, data!.total)} of {data!.total.toLocaleString()} exceptions</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="size-4" />Previous</Button><Button variant="outline" size="sm" disabled={(page + 1) * pageSize >= data!.total || loading} onClick={() => setPage((value) => value + 1)}>Next<ChevronRight className="size-4" /></Button></div></div>
      </>}
    </CardContent></Card>
  </>;
}
