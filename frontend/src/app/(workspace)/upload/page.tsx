"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";

import { ArrowUpFromLine, CheckCircle2, FileSpreadsheet, UploadCloud } from "lucide-react";

import { Notice } from "@/components/async-state";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, getErrorMessage } from "@/lib/financeflow";

const DATASETS = ["sales", "payments", "ledger", "customers", "accounts"] as const;
type DatasetType = (typeof DATASETS)[number];
type Suggestion = {
  source_column: string;
  canonical_field: string | null;
  explanation: string;
  confidence: number;
  needs_confirmation: boolean;
};
type FilePreview = {
  filename: string;
  dataset_type: DatasetType | null;
  classification_candidates: DatasetType[];
  columns: string[];
  inferred_types: Record<string, string>;
  mapping: { suggestions: Suggestion[]; warnings: string[] } | null;
  needs_confirmation: boolean;
  warnings: string[];
};
type UploadResults = {
  files: { filename: string; dataset_type: DatasetType; uploaded_rows: number; accepted_rows: number; rejected_rows: number; issues: { code: string; message: string; row_number?: number | null; column?: string | null }[] }[];
  transactions_created: number;
  payments_created: number;
  validation_failures: number;
  exceptions_created: number;
  reconciliation: Record<string, number>;
  reconciliation_processed: boolean;
  issues: { code: string; message: string; row_number?: number | null; column?: string | null }[];
};

function fieldsFor(dataset: DatasetType): string[] {
  if (dataset === "sales") return ["transaction_id", "customer_id", "account_id", "transaction_date", "amount", "currency", "status", "transaction_type"];
  if (dataset === "payments") return ["payment_id", "transaction_id", "account_id", "payment_date", "amount", "currency", "status"];
  if (dataset === "ledger") return ["ledger_id", "transaction_id", "account_id", "entry_date", "amount", "currency", "status", "entry_type"];
  if (dataset === "customers") return ["customer_id", "name", "email", "created_at"];
  return ["account_id", "customer_id", "account_number", "currency", "status", "opened_at"];
}

function requiredFor(dataset: DatasetType): string[] {
  if (dataset === "sales") return fieldsFor(dataset);
  if (dataset === "payments") return fieldsFor(dataset);
  if (dataset === "ledger") return fieldsFor(dataset);
  if (dataset === "customers") return ["customer_id", "name"];
  return ["account_id", "customer_id"];
}

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<UploadResults | null>(null);
  const totalBytes = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);
  const ready = files.length > 0 && previews.length === files.length && previews.every((preview) => {
    if (!preview.dataset_type || !preview.mapping) return false;
    const assigned = preview.mapping.suggestions.filter((item) => item.canonical_field).map((item) => item.canonical_field);
    return new Set(assigned).size === assigned.length && requiredFor(preview.dataset_type).every((field) => assigned.includes(field)) && preview.mapping.suggestions.every((item) => !item.needs_confirmation);
  });

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(event.target.files ?? []);
    setFiles(chosen);
    setPreviews([]);
    setResult(null);
    setError("");
  }

  async function analyze(selectedTypes: Record<string, DatasetType> = {}) {
    if (files.length === 0) { setError("Choose one or more CSV files."); return; }
    if (totalBytes > 4 * 1024 * 1024) { setError("Combined files exceed the 4 MiB limit for this deployment path."); return; }
    const body = new FormData();
    files.forEach((file) => body.append("files", file));
    body.append("dataset_types", JSON.stringify(selectedTypes));
    setBusy(true); setError(""); setResult(null);
    try {
      const response = await apiFetch<{ files: FilePreview[] }>("/uploads/preview", { method: "POST", body });
      setPreviews(response.files);
    } catch (cause) { setError(getErrorMessage(cause)); }
    finally { setBusy(false); }
  }

  function selectDataset(index: number, value: DatasetType) {
    const types = Object.fromEntries(previews.flatMap((item) => item.dataset_type ? [[item.filename, item.dataset_type]] : []));
    types[files[index].name] = value;
    void analyze(types as Record<string, DatasetType>);
  }

  function changeSuggestion(fileIndex: number, suggestionIndex: number, field: string) {
    setPreviews((current) => current.map((preview, index) => index !== fileIndex || !preview.mapping ? preview : {
      ...preview,
      needs_confirmation: true,
      mapping: {
        ...preview.mapping,
        suggestions: preview.mapping.suggestions.map((suggestion, itemIndex) => itemIndex !== suggestionIndex ? suggestion : {
          ...suggestion,
          canonical_field: field || null,
          needs_confirmation: true,
          explanation: "Edited by the user; review and confirm this assignment.",
        }),
      },
    }));
  }

  function confirmSuggestion(fileIndex: number, suggestionIndex: number, confirmed: boolean) {
    setPreviews((current) => current.map((preview, index) => index !== fileIndex || !preview.mapping ? preview : {
      ...preview,
      mapping: {
        ...preview.mapping,
        suggestions: preview.mapping.suggestions.map((suggestion, itemIndex) => itemIndex !== suggestionIndex ? suggestion : { ...suggestion, needs_confirmation: !confirmed }),
      },
    }));
  }

  async function process(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) { setError("Complete and review every required column mapping first."); return; }
    const body = new FormData();
    files.forEach((file) => body.append("files", file));
    body.append("mappings", JSON.stringify(previews.map((preview) => ({
      filename: preview.filename,
      dataset_type: preview.dataset_type,
      suggestions: preview.mapping?.suggestions,
    }))));
    setBusy(true); setError(""); setResult(null);
    try { setResult(await apiFetch<UploadResults>("/uploads/process", { method: "POST", body })); }
    catch (cause) { setError(getErrorMessage(cause)); }
    finally { setBusy(false); }
  }

  return <>
    <PageHeading title="Upload data" description="Inspect and map financial CSV files before validating a related batch." />
    <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
      <Card className="border-border/80 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><UploadCloud className="size-4 text-emerald-700" />Financial data files</CardTitle><p className="text-sm text-muted-foreground">Select sales, payment, ledger, customer, or account CSV files. The current Vercel proxy supports up to 4 MiB combined.</p></CardHeader><CardContent>
        <form onSubmit={process} className="space-y-5">
          <label htmlFor="sales-file" className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 text-center transition hover:border-emerald-600 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20">
            <span className="mb-3 flex size-12 items-center justify-center rounded-xl bg-background shadow-sm"><FileSpreadsheet className="size-5 text-emerald-700" /></span>
            <span className="text-sm font-medium">{files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected` : "Choose related CSV files"}</span>
            <span className="mt-1 text-xs text-muted-foreground">{files.length ? `${(totalBytes / 1024).toFixed(1)} KB combined` : "CSV format · 4 MiB combined maximum"}</span>
            <input id="sales-file" type="file" accept=".csv,text/csv" multiple className="sr-only" onChange={chooseFiles} />
          </label>
          {files.length > 0 && <div className="space-y-1 rounded-lg border p-3 text-sm">{files.map((file) => <div key={file.name} className="flex justify-between gap-3"><span className="truncate">{file.name}</span><span className="shrink-0 text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span></div>)}</div>}
          <Button type="button" disabled={busy || files.length === 0} variant="outline" onClick={() => void analyze()}>{busy ? "Inspecting files…" : "Inspect and suggest mappings"}</Button>

          {previews.map((preview, fileIndex) => <section key={preview.filename} className="space-y-3 rounded-lg border p-4">
            <div><h3 className="font-medium">{preview.filename}</h3><p className="text-xs text-muted-foreground">{preview.columns.length} columns · {preview.columns.map((column) => `${column}: ${preview.inferred_types[column]}`).join(" · ")}</p></div>
            {!preview.dataset_type ? <div className="flex items-center gap-2"><label className="text-sm" htmlFor={`dataset-${fileIndex}`}>Choose file type</label><select id={`dataset-${fileIndex}`} className="rounded-md border bg-background p-2 text-sm" value="" onChange={(event) => selectDataset(fileIndex, event.target.value as DatasetType)}><option value="" disabled>Select type</option>{DATASETS.map((dataset) => <option key={dataset} value={dataset}>{dataset}</option>)}</select></div> : <p className="text-sm">Detected as <span className="font-medium">{preview.dataset_type}</span></p>}
            {preview.mapping && <div className="space-y-2">{preview.mapping.suggestions.map((suggestion, suggestionIndex) => <div key={suggestion.source_column} className="grid gap-2 rounded-md bg-muted/20 p-2 sm:grid-cols-[1fr_1fr]"><div className="min-w-0"><p className="truncate text-sm font-medium">{suggestion.source_column} <span className="font-normal text-muted-foreground">({preview.inferred_types[suggestion.source_column]})</span></p><p className="text-xs text-muted-foreground">{suggestion.explanation} · {Math.round(suggestion.confidence * 100)}%</p></div><div className="space-y-1"><select aria-label={`Map ${suggestion.source_column}`} className="w-full rounded-md border bg-background p-2 text-sm" value={suggestion.canonical_field ?? ""} onChange={(event) => changeSuggestion(fileIndex, suggestionIndex, event.target.value)}><option value="">Ignore this column</option>{fieldsFor(preview.dataset_type!).map((field) => <option key={field} value={field}>{field}</option>)}</select>{suggestion.needs_confirmation && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={false} onChange={(event) => confirmSuggestion(fileIndex, suggestionIndex, event.target.checked)} />I reviewed this mapping</label>}</div></div>)}</div>}
            {preview.warnings.length > 0 && <ul className="list-inside list-disc text-xs text-amber-800">{preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
          </section>)}
          {error && <Notice>{error}</Notice>}
          <Button disabled={busy || !ready} type="submit" className="bg-[#17392f] text-white hover:bg-[#214a3e]"><ArrowUpFromLine className="size-4" />{busy ? "Processing batch…" : "Review mappings and process"}</Button>
        </form>
      </CardContent></Card>
      <Card className="border-border/80 shadow-sm"><CardHeader><CardTitle className="text-base">Batch results</CardTitle><p className="text-sm text-muted-foreground">All selected files are committed in one database transaction.</p></CardHeader><CardContent>
        {!result ? <div className="flex min-h-48 flex-col items-center justify-center text-center"><span className="mb-3 flex size-11 items-center justify-center rounded-full bg-muted"><FileSpreadsheet className="size-5 text-muted-foreground" /></span><p className="text-sm font-medium">Results will appear here</p><p className="mt-1 max-w-xs text-sm text-muted-foreground">Each file reports its type, accepted rows, validation findings, and database writes.</p></div> : <div className="space-y-4">
          <Notice tone="success"><span className="inline-flex items-center gap-2"><CheckCircle2 className="size-4" />Batch processed atomically</span></Notice>
          <div className="space-y-3">{result.files.map((file) => <div key={file.filename} className="rounded-lg border p-3"><p className="font-medium">{file.filename} <span className="text-xs font-normal text-muted-foreground">· {file.dataset_type}</span></p><p className="mt-1 text-sm text-muted-foreground">{file.accepted_rows.toLocaleString()} accepted of {file.uploaded_rows.toLocaleString()} · {file.rejected_rows.toLocaleString()} rejected</p></div>)}</div>
          <div className="grid grid-cols-2 gap-3">{[["Transactions created", result.transactions_created], ["Payments created", result.payments_created], ["Validation failures", result.validation_failures], ["Exceptions created", result.exceptions_created]].map(([label, count]) => <div key={label} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{Number(count).toLocaleString()}</p></div>)}</div>
          {result.reconciliation_processed && <p className="text-sm">Reconciliation: {Object.entries(result.reconciliation).map(([status, count]) => `${status.replaceAll("_", " ")}: ${count}`).join(" · ")}</p>}
          {!result.reconciliation_processed && result.files.some((file) => file.dataset_type === "ledger") && <p className="text-xs text-muted-foreground">Reconciliation results require sales and ledger files in the same batch.</p>}
          {result.issues.length > 0 && <div className="max-h-56 space-y-2 overflow-y-auto">{result.issues.map((issue, index) => <div key={`${issue.code}-${issue.row_number}-${index}`} className="rounded-md border bg-muted/20 px-3 py-2 text-xs"><span className="font-medium">{issue.code}</span>{issue.row_number && <span className="text-muted-foreground"> · Row {issue.row_number}</span>}<p className="mt-1 text-muted-foreground">{issue.message}{issue.column ? ` (${issue.column})` : ""}</p></div>)}</div>}
        </div>}
      </CardContent></Card>
    </div>
  </>;
}
