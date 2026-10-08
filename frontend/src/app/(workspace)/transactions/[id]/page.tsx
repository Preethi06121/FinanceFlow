"use client";

import { useCallback, useEffect, useState } from "react";

import Link from "next/link";
import { useParams } from "next/navigation";

import { ArrowLeft, CalendarClock, CircleDollarSign, CreditCard, Hash } from "lucide-react";

import { ErrorState, LoadingState } from "@/components/async-state";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, formatDate, formatMoney, getErrorMessage, Transaction } from "@/lib/financeflow";

function Field({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ElementType }) {
  return <div className="rounded-lg border bg-background p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground">{Icon && <Icon className="size-3.5" />}{label}</div><div className="mt-2 break-words text-sm font-medium">{value || "—"}</div></div>;
}

export default function TransactionDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setTransaction(await apiFetch<Transaction>(`/transactions/${encodeURIComponent(id)}`)); }
    catch (cause) { setError(getErrorMessage(cause)); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  return <>
    <div className="mb-5"><Button asChild variant="ghost" size="sm"><Link href="/transactions"><ArrowLeft className="size-4" />Back to transactions</Link></Button></div>
    {loading ? <LoadingState label="Loading transaction…" /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : transaction && <>
      <PageHeading title={transaction.reference} description="Transaction details from the FinanceFlow ledger." action={<StatusBadge value={transaction.status} />} />
      <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
        <Card className="border-border/80 shadow-sm"><CardHeader><CardTitle className="text-base">Transaction information</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2"><Field label="Amount" value={formatMoney(transaction.amount, transaction.currency)} icon={CircleDollarSign} /><Field label="Transaction type" value={transaction.transaction_type} icon={CreditCard} /><Field label="Transaction date" value={formatDate(transaction.transaction_date)} icon={CalendarClock} /><Field label="Reference" value={transaction.reference} icon={Hash} /><Field label="From account ID" value={transaction.from_account_id?.toString() || "—"} /><Field label="To account ID" value={transaction.to_account_id?.toString() || "—"} /><Field label="Created" value={formatDate(transaction.created_at)} /><Field label="Last updated" value={formatDate(transaction.updated_at)} /></CardContent></Card>
        <Card className="border-border/80 shadow-sm"><CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">{transaction.description || "No description was supplied for this transaction."}</p></CardContent></Card>
      </div>
    </>}
  </>;
}
