import { NextRequest, NextResponse } from "next/server";

import { authCookieOptions, financeFlowApiBaseUrl } from "@/lib/server-config";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ detail: "Invalid request origin" }, { status: 403 });
  }
  let credentials: { email?: string; password?: string };
  try {
    credentials = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }
  let stage = "configuration";
  try {
    if (!process.env.FINANCEFLOW_API_BASE_URL?.trim() && process.env.NODE_ENV === "production") {
      // eslint-disable-next-line no-console -- Server-side operational diagnostic; request data is excluded.
      console.error("[api/auth/login] request failed", { reason: "missing_backend_url" });
      return NextResponse.json({ detail: "FinanceFlow API is unavailable" }, { status: 503 });
    }

    const apiBaseUrl = financeFlowApiBaseUrl();
    stage = "backend_fetch";
    const upstream = await fetch(`${apiBaseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(credentials),
      cache: "no-store",
    });
    stage = "backend_response";
    let payload;
    try {
      payload = await upstream.json();
    } catch (error) {
      // eslint-disable-next-line no-console -- Server-side operational diagnostic; response body is excluded.
      console.error("[api/auth/login] request failed", {
        reason: "backend_non_json_response",
        status: upstream.status,
        contentType: upstream.headers.get("content-type"),
        errorType: error instanceof Error ? error.name : "unknown",
      });
      return NextResponse.json({ detail: "FinanceFlow API is unavailable" }, { status: 503 });
    }
    if (!upstream.ok) return NextResponse.json(payload, { status: upstream.status });
    const response = NextResponse.json({ user_id: payload.user_id, email: payload.email, role: payload.role });
    response.cookies.set("financeflow_token", payload.access_token, {
      ...authCookieOptions(true, payload.expires_in),
    });
    response.cookies.set("financeflow_user", JSON.stringify({ user_id: payload.user_id, email: payload.email, role: payload.role }), {
      ...authCookieOptions(false, payload.expires_in),
    });
    return response;
  } catch (error) {
    // eslint-disable-next-line no-console -- Server-side operational diagnostic; error message is excluded.
    console.error("[api/auth/login] request failed", {
      reason: stage === "backend_fetch" ? "backend_fetch_failed" : "proxy_error",
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ detail: "FinanceFlow API is unavailable" }, { status: 503 });
  }
}
