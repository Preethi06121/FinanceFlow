export function financeFlowApiBaseUrl() {
  const configured = process.env.FINANCEFLOW_API_BASE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("FINANCEFLOW_API_BASE_URL is not configured");
  }
  return "http://127.0.0.1:8000";
}

export function authCookieOptions(httpOnly: boolean, maxAge: number) {
  return {
    httpOnly,
    secure: process.env.NODE_ENV === "production" || process.env.AUTH_COOKIE_SECURE === "true",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
