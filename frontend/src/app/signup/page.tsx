"use client";

import { FormEvent, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ArrowRight, UserRoundPlus, WalletCards } from "lucide-react";

import { Notice } from "@/components/async-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ApiError = { detail?: string | Array<{ msg?: string }> };

function errorMessage(payload: ApiError) {
  if (typeof payload.detail === "string") return payload.detail;
  if (Array.isArray(payload.detail)) return payload.detail.map((item) => item.msg).filter(Boolean).join(" ") || "Check the information and try again.";
  return "Could not create your account. Check the information and try again.";
}

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const normalizedName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedName) { setError("Enter your name."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) { setError("Enter a valid email address."); return; }
    if (password.length < 12) { setError("Use a password with at least 12 characters."); return; }
    if (password.length > 256) { setError("Password must be 256 characters or fewer."); return; }

    setBusy(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ full_name: normalizedName, email: normalizedEmail, password }),
      });
      const payload = await response.json() as ApiError;
      if (!response.ok) throw new Error(errorMessage(payload));
      router.replace("/login?registered=1");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "FinanceFlow could not create your account.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
    <section className="relative hidden flex-col justify-between overflow-hidden bg-[#112620] p-10 text-white lg:flex xl:p-14">
      <div className="absolute -right-28 -bottom-36 size-[520px] rounded-full border border-emerald-100/10" /><div className="absolute -right-8 -bottom-16 size-[360px] rounded-full border border-emerald-100/10" />
      <Link href="/signup" className="relative flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-emerald-300 text-[#112620]"><WalletCards className="size-5" /></span><span className="font-display text-xl font-semibold">FinanceFlow</span></Link>
      <div className="relative max-w-xl pb-10"><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs text-emerald-100"><span className="size-1.5 rounded-full bg-emerald-300" />FINANCIAL OPERATIONS PLATFORM</div><h1 className="font-display text-5xl leading-[1.08] font-semibold tracking-tight xl:text-6xl">Bring your financial data into focus.</h1><p className="mt-6 max-w-lg text-base leading-7 text-white/65">Create an account to validate financial data, reconcile activity and resolve exceptions with confidence.</p></div>
      <div className="relative flex items-center justify-between text-xs text-white/45"><span>Secure access for FinanceFlow teams</span><span>FinanceFlow</span></div>
    </section>
    <section className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-[410px]">
        <div className="mb-8 flex items-center gap-3 lg:hidden"><span className="flex size-10 items-center justify-center rounded-xl bg-[#112620] text-emerald-300"><WalletCards className="size-5" /></span><span className="font-display text-xl font-semibold">FinanceFlow</span></div>
        <div className="mb-8"><p className="mb-2 text-xs font-semibold tracking-[0.15em] text-emerald-700 dark:text-emerald-300">GET STARTED</p><h2 className="font-display text-3xl font-semibold tracking-tight">Create your account</h2><p className="mt-2 text-sm text-muted-foreground">Set up your FinanceFlow workspace access.</p></div>
        <Card className="border-border/80 shadow-sm"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><UserRoundPlus className="size-4 text-emerald-700 dark:text-emerald-300" />Account details</CardTitle></CardHeader><CardContent>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div className="space-y-1.5"><label htmlFor="signup-name" className="text-sm font-medium">Full name</label><Input id="signup-name" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your name" required maxLength={200} /></div>
            <div className="space-y-1.5"><label htmlFor="signup-email" className="text-sm font-medium">Email</label><Input id="signup-email" autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required maxLength={320} /></div>
            <div className="space-y-1.5"><label htmlFor="signup-password" className="text-sm font-medium">Password</label><Input id="signup-password" autoComplete="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} maxLength={256} aria-describedby="signup-password-help" /><p id="signup-password-help" className="text-xs text-muted-foreground">Use at least 12 characters.</p></div>
            <div className="rounded-md border border-emerald-700/15 bg-emerald-700/5 px-3 py-2.5 text-xs leading-5 text-muted-foreground">New accounts are created with the <span className="font-semibold text-foreground">Analyst</span> role. Administrative access is managed separately.</div>
            {error && <Notice>{error}</Notice>}
            <Button type="submit" className="mt-1 w-full bg-[#17392f] text-white hover:bg-[#214a3e]" disabled={busy}>{busy ? "Creating account…" : "Create account"}<ArrowRight className="size-4" /></Button>
          </form>
        </CardContent></Card>
        <p className="mt-6 text-center text-sm text-muted-foreground">Already have an account? <Link className="font-medium text-emerald-800 underline underline-offset-4 dark:text-emerald-300" href="/login">Sign in</Link></p>
      </div>
    </section>
  </div>;
}
