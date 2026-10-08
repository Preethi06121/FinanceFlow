export type Page<T> = { items: T[]; total: number; offset: number; limit: number };

export type SessionUser = { user_id: number; email: string; role: "ANALYST" | "ADMIN" };
export type Transaction = {
  id: number;
  reference: string;
  from_account_id: number | null;
  to_account_id: number | null;
  amount: string;
  currency: string;
  transaction_type: string;
  transaction_date: string | null;
  status: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};
export type Reconciliation = {
  id: number;
  transaction_id: number | null;
  transaction_reference: string;
  status: string;
  source_reference: string | null;
  source_amount: string | null;
  ledger_amount: string | null;
  difference: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};
export type FinanceException = {
  id: number;
  transaction_id: number | null;
  customer_id: number | null;
  transaction_reference: string | null;
  exception_type: string;
  source_amount: string | null;
  ledger_amount: string | null;
  difference: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED";
  reason: string;
  resolution_reason: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};
export type AuditLog = {
  id: number;
  user_id: number | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};
export type DashboardSummary = {
  transactions: { count: number; amount_total: string; by_status: Record<string, number> };
  exceptions: { count: number; by_status: Record<string, number>; by_priority: Record<string, number> };
  reconciliation: { count: number; by_status: Record<string, number> };
};
export type UploadResult = {
  filename: string;
  uploaded_rows: number;
  accepted_rows: number;
  rejected_rows: number;
  validation_failures: number;
  transactions_created: number;
  exceptions_created: number;
  issues: { code: string; message: string; row_number: number | null; column: string | null }[];
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { ...init, credentials: "same-origin", cache: "no-store" });
  } catch {
    throw new ApiError("Could not reach FinanceFlow. Check that the API is running and try again.", 0);
  }
  const contentType = response.headers.get("content-type") ?? "";
  const payload: unknown = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const detail = typeof payload === "object" && payload !== null && "detail" in payload
      ? (payload as { detail: unknown }).detail
      : payload;
    const message = typeof detail === "string" ? detail : JSON.stringify(detail || `Request failed (${response.status})`);
    if (response.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.assign("/login?expired=1");
    }
    throw new ApiError(message, response.status);
  }
  return payload as T;
}

export function formatMoney(value: string | number | null | undefined, currency = "USD") {
  if (value === null || value === undefined || value === "") return "—";
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}

export function formatAmount(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(amount) : "—";
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function labelize(value: string) {
  return value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}
