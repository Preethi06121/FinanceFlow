"use client";

import { FormEvent, Suspense, useState } from "react";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { ArrowRight, LockKeyhole, WalletCards } from "lucide-react";

import { Notice } from "@/components/async-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function LoginForm() {
  const router = useRouter();
  const query = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(typeof payload.detail === "string" ? payload.detail : "Could not sign in. Check your credentials and try again.");
      router.replace("/dashboard"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "FinanceFlow could not sign you in."); }
    finally { setBusy(false); }
  }

  return <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
    <section className="relative hidden flex-col justify-between overflow-hidden bg-[#112620] p-10 text-white lg:flex xl:p-14">
      <div className="absolute -right-28 -bottom-36 size-[520px] rounded-full border border-emerald-100/10" /><div className="absolute -right-8 -bottom-16 size-[360px] rounded-full border border-emerald-100/10" />
      <Link href="/login" className="relative flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-emerald-300 text-[#112620]"><WalletCards className="size-5" /></span><span className="font-display text-xl font-semibold">FinanceFlow</span></Link>
      <div className="relative max-w-xl pb-10"><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs text-emerald-100"><span className="size-1.5 rounded-full bg-emerald-300" />FINANCIAL OPERATIONS PLATFORM</div><h1 className="font-display text-5xl leading-[1.08] font-semibold tracking-tight xl:text-6xl">Clarity for every transaction.</h1><p className="mt-6 max-w-lg text-base leading-7 text-white/65">A single workspace to validate financial data, reconcile activity and resolve exceptions with confidence.</p></div>
      <div className="relative flex items-center justify-between text-xs text-white/45"><span>Secure access for FinanceFlow teams</span><span>FinanceFlow</span></div>
    </section>
    <section className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-[410px]">
        <div className="mb-8 flex items-center gap-3 lg:hidden"><span className="flex size-10 items-center justify-center rounded-xl bg-[#112620] text-emerald-300"><WalletCards className="size-5" /></span><span className="font-display text-xl font-semibold">FinanceFlow</span></div>
        <div className="mb-8"><p className="mb-2 text-xs font-semibold tracking-[0.15em] text-emerald-700 dark:text-emerald-300">WELCOME BACK</p><h2 className="font-display text-3xl font-semibold tracking-tight">Sign in to your workspace</h2><p className="mt-2 text-sm text-muted-foreground">Use your FinanceFlow account to continue.</p></div>
        {query.get("expired") && <div className="mb-4"><Notice tone="info">Your session ended. Sign in again to continue.</Notice></div>}
        {query.get("registered") && <div className="mb-4"><Notice tone="success">Your Analyst account is ready. Sign in to continue.</Notice></div>}
        <Card className="border-border/80 shadow-sm"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><LockKeyhole className="size-4 text-emerald-700 dark:text-emerald-300" />Account credentials</CardTitle></CardHeader><CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5"><label htmlFor="login-email" className="text-sm font-medium">Work email</label><Input id="login-email" autoComplete="username" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required /></div>
            <div className="space-y-1.5"><label htmlFor="login-password" className="text-sm font-medium">Password</label><Input id="login-password" autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
            {error && <Notice>{error}</Notice>}
            <Button type="submit" className="mt-1 w-full bg-[#17392f] text-white hover:bg-[#214a3e]" disabled={busy}>{busy ? "Signing in…" : "Sign in"}<ArrowRight className="size-4" /></Button>
          </form>
        </CardContent></Card>
        <p className="mt-6 text-center text-sm text-muted-foreground">Don&apos;t have an account? <Link className="font-medium text-emerald-800 underline underline-offset-4 dark:text-emerald-300" href="/signup">Sign up</Link></p>
        <p className="mt-3 text-center text-xs text-muted-foreground">FinanceFlow accounts receive Analyst access. Need administrative access? Contact your administrator.</p>
      </div>
    </section>
  </div>;
}

export default function LoginPage() {
  return <Suspense fallback={<div className="p-10 text-sm text-muted-foreground">Loading sign-in…</div>}><LoginForm /></Suspense>;
}
