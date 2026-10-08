"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import Link from "next/link";
import { useParams } from "next/navigation";

import { ArrowLeft, CalendarClock, CircleDollarSign, FileWarning, Hash, UserRound } from "lucide-react";

import { ErrorState, LoadingState, Notice } from "@/components/async-state";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch, FinanceException, formatAmount, formatDate, getErrorMessage } from "@/lib/financeflow";

function Detail({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return <div className="rounded-lg border bg-background p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="size-3.5" />{label}</div><div className="mt-2 break-words text-sm font-medium">{value || "—"}</div></div>;
}

export default function ExceptionDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [record, setRecord] = useState<FinanceException | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setRecord(await apiFetch<FinanceException>(`/exceptions/${encodeURIComponent(id)}`)); }
    catch (cause) { setError(getErrorMessage(cause)); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  async function update(status: "UNDER_REVIEW" | "RESOLVED", event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const next = await apiFetch<FinanceException>(`/exceptions/${encodeURIComponent(id)}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, ...(status === "RESOLVED" ? { resolution_reason: reason.trim() } : {}) }),
      });
      setRecord(next); setReason(""); setNotice(status === "RESOLVED" ? "Exception resolved and audit event recorded." : "Exception moved to under review.");
    } catch (cause) { setError(getErrorMessage(cause)); }
    finally { setSaving(false); }
  }

  return <>
    <div className="mb-5"><Button asChild variant="ghost" size="sm"><Link href="/exceptions"><ArrowLeft className="size-4" />Back to exceptions</Link></Button></div>
    {loading ? <LoadingState label="Loading exception…" /> : error && !record ? <ErrorState message={error} onRetry={() => void load()} /> : record && <>
      <PageHeading title={`Exception #${record.id}`} description={`${record.exception_type.replaceAll("_", " ")} · ${record.transaction_reference || "No transaction reference"}`} action={<div className="flex gap-2"><StatusBadge value={record.priority} /><StatusBadge value={record.status} /></div>} />
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/80 shadow-sm"><CardHeader><CardTitle className="text-base">Investigation details</CardTitle></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-2"><Detail label="Exception type" value={record.exception_type} icon={FileWarning} /><Detail label="Transaction reference" value={record.transaction_reference || "—"} icon={Hash} /><Detail label="Customer ID" value={record.customer_id?.toString() || "—"} icon={UserRound} /><Detail label="Created" value={formatDate(record.created_at)} icon={CalendarClock} /><Detail label="Source amount" value={formatAmount(record.source_amount)} icon={CircleDollarSign} /><Detail label="Ledger amount" value={formatAmount(record.ledger_amount)} icon={CircleDollarSign} /><Detail label="Difference" value={formatAmount(record.difference)} icon={CircleDollarSign} /><Detail label="Last updated" value={formatDate(record.updated_at)} icon={CalendarClock} /></div><div className="mt-4 rounded-lg bg-muted/40 p-4"><p className="text-xs font-semibold tracking-wide text-muted-foreground">REASON</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{record.reason}</p></div>{record.resolution_reason && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/30"><p className="text-xs font-semibold tracking-wide text-emerald-800 dark:text-emerald-300">RESOLUTION</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{record.resolution_reason}</p><p className="mt-2 text-xs text-muted-foreground">Resolved {formatDate(record.resolved_at)}</p></div>}</CardContent></Card>
        <Card className="h-fit border-border/80 shadow-sm"><CardHeader><CardTitle className="text-base">Investigation workflow</CardTitle><p className="text-sm text-muted-foreground">Move through the existing exception lifecycle.</p></CardHeader><CardContent className="space-y-4">
          {notice && <Notice tone="success">{notice}</Notice>}{error && <Notice>{error}</Notice>}
          {record.status === "OPEN" && <><p className="text-sm leading-6 text-muted-foreground">Begin the investigation. FinanceFlow records this status change in the audit history.</p><Button className="w-full bg-[#17392f] text-white hover:bg-[#214a3e]" disabled={saving} onClick={() => void update("UNDER_REVIEW")}>{saving ? "Updating…" : "Mark Under Review"}</Button></>}
          {record.status === "UNDER_REVIEW" && <form onSubmit={(event) => void update("RESOLVED", event)} className="space-y-3"><div className="space-y-1.5"><label htmlFor="resolution-reason" className="text-sm font-medium">Resolution reason<span className="text-rose-600"> *</span></label><Input id="resolution-reason" required minLength={1} maxLength={4000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Describe what was investigated or corrected" /></div><p className="text-xs leading-5 text-muted-foreground">A resolution reason is required by the FinanceFlow API and will be included in the exception record.</p><Button type="submit" className="w-full bg-[#17392f] text-white hover:bg-[#214a3e]" disabled={saving || !reason.trim()}>{saving ? "Saving resolution…" : "Resolve Exception"}</Button></form>}
          {record.status === "RESOLVED" && <div className="space-y-3"><Notice tone="success">This exception is resolved. Its resolution reason and timestamp are shown with the investigation details.</Notice><Button asChild variant="outline" className="w-full"><Link href="/audit-logs">View Audit Logs</Link></Button></div>}
          <div className="border-t pt-4"><p className="text-xs font-semibold tracking-wide text-muted-foreground">STATUS PROGRESSION</p><div className="mt-3 flex items-center gap-2 text-xs"><StatusBadge value="OPEN" /><span className="text-muted-foreground">→</span><StatusBadge value="UNDER_REVIEW" /><span className="text-muted-foreground">→</span><StatusBadge value="RESOLVED" /></div></div>
        </CardContent></Card>
      </div>
    </>}
  </>;
}
