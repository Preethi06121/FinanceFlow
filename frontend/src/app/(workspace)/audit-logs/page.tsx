"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Search } from "lucide-react";

import { EmptyState, ErrorState, LoadingState } from "@/components/async-state";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch, AuditLog, formatDate, getErrorMessage, Page } from "@/lib/financeflow";

export default function AuditLogsPage() {
  const [entityType, setEntityType] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<Page<AuditLog> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    const params = new URLSearchParams({ offset: "0", limit: "100" });
    if (entityType.trim()) params.set("entity_type", entityType.trim());
    try { setData(await apiFetch<Page<AuditLog>>(`/audit-logs?${params}`)); }
    catch (cause) { setError(getErrorMessage(cause)); }
    finally { setLoading(false); }
  }, [entityType]);
  useEffect(() => { void load(); }, [load]);
  const rows = useMemo(() => (data?.items || []).filter((item) => `${item.action} ${item.entity_type} ${item.entity_id || ""} ${item.user_id || ""} ${JSON.stringify(item.details || {})}`.toLowerCase().includes(search.toLowerCase())), [data, search]);

  return <>
    <PageHeading title="Audit logs" description="Review the recorded history of FinanceFlow operational changes." />
    <Card className="border-border/80 shadow-sm"><CardContent className="p-4 md:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="relative w-full sm:max-w-sm"><Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search audit logs" className="pl-9" placeholder="Search action, entity or details" value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="flex gap-2"><Input className="w-full sm:w-52" placeholder="Filter entity type" aria-label="Filter entity type" value={entityType} onChange={(event) => setEntityType(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void load(); }} /><Button variant="outline" onClick={() => void load()} disabled={loading}>Filter</Button></div></div>
      {loading ? <LoadingState label="Loading audit history…" /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : rows.length === 0 ? <EmptyState title="No audit events found" description="Recorded status and administrative changes will appear here." /> : <>
        <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Time</th><th className="px-4 py-3 font-medium">Action</th><th className="px-4 py-3 font-medium">Entity</th><th className="px-4 py-3 font-medium">Entity ID</th><th className="px-4 py-3 font-medium">User ID</th><th className="px-4 py-3 font-medium">Details</th></tr></thead><tbody className="divide-y">{rows.map((item) => <tr key={item.id} className="align-top hover:bg-muted/30"><td className="whitespace-nowrap px-4 py-3.5 text-muted-foreground">{formatDate(item.created_at)}</td><td className="px-4 py-3.5 font-medium">{item.action.replaceAll("_", " ")}</td><td className="px-4 py-3.5">{item.entity_type}</td><td className="px-4 py-3.5 font-mono text-xs">{item.entity_id || "—"}</td><td className="px-4 py-3.5">{item.user_id ?? "System"}</td><td className="max-w-sm px-4 py-3.5"><pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-muted-foreground">{item.details ? JSON.stringify(item.details, null, 2) : "—"}</pre></td></tr>)}</tbody></table></div>
        <div className="mt-4 text-xs text-muted-foreground">Showing {rows.length} filtered of {data!.total.toLocaleString()} events in this page.</div>
      </>}
    </CardContent></Card>
  </>;
}
