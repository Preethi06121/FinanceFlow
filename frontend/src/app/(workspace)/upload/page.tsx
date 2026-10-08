"use client";

import { FormEvent, useState } from "react";

import { ArrowUpFromLine, CheckCircle2, FileSpreadsheet, UploadCloud } from "lucide-react";

import { Notice } from "@/components/async-state";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, getErrorMessage, UploadResult } from "@/lib/financeflow";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) { setError("Choose a CSV file to upload."); return; }
    if (!file.name.toLowerCase().endsWith(".csv")) { setError("Only CSV files can be uploaded."); return; }
    const body = new FormData(); body.append("file", file);
    setBusy(true); setError(""); setResult(null);
    try { setResult(await apiFetch<UploadResult>("/transactions/upload", { method: "POST", body })); }
    catch (cause) { setError(getErrorMessage(cause)); }
    finally { setBusy(false); }
  }

  return <>
    <PageHeading title="Upload data" description="Import sales transactions into FinanceFlow for validation and processing." />
    <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
      <Card className="border-border/80 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><UploadCloud className="size-4 text-emerald-700" />Sales data file</CardTitle><p className="text-sm text-muted-foreground">Choose the sales CSV you want FinanceFlow to validate.</p></CardHeader><CardContent>
        <form onSubmit={submit} className="space-y-5">
          <label htmlFor="sales-file" className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 text-center transition hover:border-emerald-600 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20">
            <span className="mb-3 flex size-12 items-center justify-center rounded-xl bg-background shadow-sm"><FileSpreadsheet className="size-5 text-emerald-700" /></span>
            <span className="text-sm font-medium">{file ? file.name : "Choose a sales CSV file"}</span>
            <span className="mt-1 text-xs text-muted-foreground">{file ? `${(file.size / 1024).toFixed(1)} KB` : "CSV format · Maximum 10 MiB"}</span>
            <input id="sales-file" type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => { setFile(event.target.files?.[0] || null); setError(""); setResult(null); }} />
          </label>
          <div className="rounded-lg bg-muted/40 p-4"><p className="text-xs font-semibold tracking-wide text-muted-foreground">REQUIRED COLUMNS</p><p className="mt-2 text-sm leading-6">transaction_id, customer_id, account_id, transaction_date, amount, currency, status, transaction_type</p></div>
          {error && <Notice>{error}</Notice>}
          <Button disabled={busy || !file} type="submit" className="bg-[#17392f] text-white hover:bg-[#214a3e]"><ArrowUpFromLine className="size-4" />{busy ? "Uploading and validating…" : "Upload and validate"}</Button>
        </form>
      </CardContent></Card>
      <Card className="border-border/80 shadow-sm"><CardHeader><CardTitle className="text-base">Upload results</CardTitle><p className="text-sm text-muted-foreground">Validation and creation counts returned by the API.</p></CardHeader><CardContent>
        {!result ? <div className="flex min-h-48 flex-col items-center justify-center text-center"><span className="mb-3 flex size-11 items-center justify-center rounded-full bg-muted"><FileSpreadsheet className="size-5 text-muted-foreground" /></span><p className="text-sm font-medium">Results will appear here</p><p className="mt-1 max-w-xs text-sm text-muted-foreground">After a successful upload, the API reports accepted rows, validation findings and created exceptions.</p></div> : <div className="space-y-4">
          <Notice tone="success"><span className="inline-flex items-center gap-2"><CheckCircle2 className="size-4" />Upload processed: {result.filename}</span></Notice>
          <div className="grid grid-cols-2 gap-3">{[["Rows uploaded", result.uploaded_rows], ["Accepted", result.accepted_rows], ["Rejected", result.rejected_rows], ["Validation failures", result.validation_failures], ["Transactions created", result.transactions_created], ["Exceptions created", result.exceptions_created]].map(([label, count]) => <div key={label} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{Number(count).toLocaleString()}</p></div>)}</div>
          {result.issues.length > 0 && <div><p className="mb-2 text-sm font-medium">Ingestion findings</p><div className="max-h-56 space-y-2 overflow-y-auto">{result.issues.map((issue, index) => <div key={`${issue.code}-${issue.row_number}-${index}`} className="rounded-md border bg-muted/20 px-3 py-2 text-xs"><span className="font-medium">{issue.code}</span>{issue.row_number && <span className="text-muted-foreground"> · Row {issue.row_number}</span>}<p className="mt-1 text-muted-foreground">{issue.message}{issue.column ? ` (${issue.column})` : ""}</p></div>)}</div></div>}
        </div>}
      </CardContent></Card>
    </div>
  </>;
}
