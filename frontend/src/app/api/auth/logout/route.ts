import { NextRequest, NextResponse } from "next/server";

import { authCookieOptions } from "@/lib/server-config";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ detail: "Invalid request origin" }, { status: 403 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set("financeflow_token", "", authCookieOptions(true, 0));
  response.cookies.set("financeflow_user", "", authCookieOptions(false, 0));
  return response;
}
