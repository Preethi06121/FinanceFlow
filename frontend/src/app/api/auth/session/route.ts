import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const encoded = request.cookies.get("financeflow_user")?.value;
  if (!encoded || !request.cookies.has("financeflow_token")) {
    return NextResponse.json({ detail: "Authentication required" }, { status: 401 });
  }
  try {
    const user = JSON.parse(encoded);
    if (!["ANALYST", "ADMIN"].includes(user.role) || typeof user.email !== "string") throw new Error("Invalid session");
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ detail: "Authentication required" }, { status: 401 });
  }
}
