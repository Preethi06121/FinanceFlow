import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { authCookieOptions, financeFlowApiBaseUrl } from "@/lib/server-config";

async function proxy(request: NextRequest) {
  const method = request.method;
  if (method !== "GET" && request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ detail: "Invalid request origin" }, { status: 403 });
  }
  const token = (await cookies()).get("financeflow_token")?.value;
  if (!token) return NextResponse.json({ detail: "Authentication required" }, { status: 401 });
  const path = request.nextUrl.pathname.replace(/^\/api/, "");
  let target: string;
  try {
    target = `${financeFlowApiBaseUrl()}${path}${request.nextUrl.search}`;
  } catch {
    return NextResponse.json({ detail: "FinanceFlow API is unavailable" }, { status: 503 });
  }
  const headers = new Headers({ authorization: `Bearer ${token}`, accept: "application/json" });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  try {
    const upstream = await fetch(target, {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
    });
    const responseHeaders = new Headers();
    const upstreamType = upstream.headers.get("content-type");
    if (upstreamType) responseHeaders.set("content-type", upstreamType);
    const response = new NextResponse(await upstream.arrayBuffer(), { status: upstream.status, headers: responseHeaders });
    if (upstream.status === 401) {
      response.cookies.set("financeflow_token", "", authCookieOptions(true, 0));
      response.cookies.set("financeflow_user", "", authCookieOptions(false, 0));
    }
    return response;
  } catch {
    return NextResponse.json({ detail: "FinanceFlow API is unavailable" }, { status: 503 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
