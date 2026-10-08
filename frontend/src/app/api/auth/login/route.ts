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
  try {
    const upstream = await fetch(`${financeFlowApiBaseUrl()}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(credentials),
      cache: "no-store",
    });
    const payload = await upstream.json();
    if (!upstream.ok) return NextResponse.json(payload, { status: upstream.status });
    const response = NextResponse.json({ user_id: payload.user_id, email: payload.email, role: payload.role });
    response.cookies.set("financeflow_token", payload.access_token, {
      ...authCookieOptions(true, payload.expires_in),
    });
    response.cookies.set("financeflow_user", JSON.stringify({ user_id: payload.user_id, email: payload.email, role: payload.role }), {
      ...authCookieOptions(false, payload.expires_in),
    });
    return response;
  } catch {
    return NextResponse.json({ detail: "FinanceFlow API is unavailable" }, { status: 503 });
  }
}
