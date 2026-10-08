import { NextRequest, NextResponse } from "next/server";

import { financeFlowApiBaseUrl } from "@/lib/server-config";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ detail: "Invalid request origin" }, { status: 403 });
  }

  let account: { full_name?: string; email?: string; password?: string };
  try {
    account = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }

  let stage = "configuration";
  try {
    if (!process.env.FINANCEFLOW_API_BASE_URL?.trim() && process.env.NODE_ENV === "production") {
      // eslint-disable-next-line no-console -- Server-side operational diagnostic; request data is excluded.
      console.error("[api/auth/register] request failed", { reason: "missing_backend_url" });
      return NextResponse.json({ detail: "FinanceFlow API is unavailable" }, { status: 503 });
    }

    const apiBaseUrl = financeFlowApiBaseUrl();
    stage = "backend_fetch";
    const upstream = await fetch(`${apiBaseUrl}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(account),
      cache: "no-store",
    });
    stage = "backend_response";
    let payload;
    try {
      payload = await upstream.json();
    } catch (error) {
      // eslint-disable-next-line no-console -- Server-side operational diagnostic; response body is excluded.
      console.error("[api/auth/register] request failed", {
        reason: "backend_non_json_response",
        status: upstream.status,
        contentType: upstream.headers.get("content-type"),
        errorType: error instanceof Error ? error.name : "unknown",
      });
      return NextResponse.json({ detail: "FinanceFlow API is unavailable" }, { status: 503 });
    }
    return NextResponse.json(payload, { status: upstream.status });
  } catch (error) {
    // eslint-disable-next-line no-console -- Server-side operational diagnostic; error message is excluded.
    console.error("[api/auth/register] request failed", {
      reason: stage === "backend_fetch" ? "backend_fetch_failed" : "proxy_error",
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ detail: "FinanceFlow API is unavailable" }, { status: 503 });
  }
}
