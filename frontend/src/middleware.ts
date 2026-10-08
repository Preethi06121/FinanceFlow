import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const hasToken = request.cookies.has("financeflow_token");
  if (request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL(hasToken ? "/dashboard" : "/login", request.url));
  }
  if (request.nextUrl.pathname.startsWith("/login")) {
    if (hasToken) return NextResponse.redirect(new URL("/dashboard", request.url));
    return NextResponse.next();
  }
  if (!hasToken) return NextResponse.redirect(new URL("/login", request.url));
  if (request.nextUrl.pathname.startsWith("/admin")) {
    try {
      const user = JSON.parse(request.cookies.get("financeflow_user")?.value || "{}");
      if (user.role !== "ADMIN") return NextResponse.redirect(new URL("/dashboard", request.url));
    } catch {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/", "/login", "/dashboard/:path*", "/transactions/:path*", "/upload", "/reconciliation/:path*", "/exceptions/:path*", "/audit-logs/:path*", "/reports/:path*", "/admin/:path*"] };
