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

  try {
    const upstream = await fetch(`${financeFlowApiBaseUrl()}/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(account),
      cache: "no-store",
    });
    const payload = await upstream.json();
    return NextResponse.json(payload, { status: upstream.status });
  } catch {
    return NextResponse.json({ detail: "FinanceFlow API is unavailable" }, { status: 503 });
  }
}
