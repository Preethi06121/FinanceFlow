"use client";

import { FormEvent, useRef, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ArrowRight, Eye, EyeOff, UserRoundPlus, WalletCards } from "lucide-react";

import { Notice } from "@/components/async-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type FieldErrors = Partial<Record<"fullName" | "email" | "password" | "confirmPassword", string>>;

function passwordLength(password: string) {
  return Array.from(password).length;
}

function strengthFor(password: string) {
  const length = passwordLength(password);
  if (length < 12) return { bars: Math.max(1, Math.ceil((length / 12) * 3)), label: "Too short" };
  if (length < 16) return { bars: 2, label: "Good" };
  return { bars: 3, label: "Strong" };
}

export default function SignupPage() {
  const router = useRouter();
  const submitting = useRef(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const strength = strengthFor(password);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError("");

    const normalizedName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const nextErrors: FieldErrors = {};
    if (!normalizedName) nextErrors.fullName = "Enter your full name.";
    else if (normalizedName.length > 200) nextErrors.fullName = "Name must be 200 characters or fewer.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) nextErrors.email = "Enter a valid email address.";
    else if (normalizedEmail.length > 320) nextErrors.email = "Email must be 320 characters or fewer.";
    if (passwordLength(password) < 12) nextErrors.password = "Use at least 12 characters.";
    else if (passwordLength(password) > 256) nextErrors.password = "Password must be 256 characters or fewer.";
    if (password !== confirmPassword) nextErrors.confirmPassword = "Passwords do not match.";
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    submitting.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ full_name: normalizedName, email: normalizedEmail, password }),
      });
      if (response.status === 409) {
        setError("An account with this email already exists. Sign in or use another email.");
        return;
      }
      if (response.status === 422) {
        setError("Please check your name, email, and password requirements, then try again.");
        return;
      }
      if (response.status !== 201) {
        setError("FinanceFlow could not create your account right now. Please try again later.");
        return;
      }
      router.replace("/login?registered=1");
    } catch {
      setError("Could not reach FinanceFlow. Check your connection and try again.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const updateField = (field: keyof FieldErrors, update: () => void) => {
    update();
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setError("");
  };

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
          <form onSubmit={submit} className="space-y-4" noValidate aria-busy={busy}>
            <div className="space-y-1.5"><label htmlFor="signup-name" className="text-sm font-medium">Full name</label><Input id="signup-name" autoComplete="name" value={fullName} onChange={(event) => updateField("fullName", () => setFullName(event.target.value))} placeholder="Your name" required maxLength={200} aria-invalid={Boolean(fieldErrors.fullName)} aria-describedby={fieldErrors.fullName ? "signup-name-error" : undefined} />{fieldErrors.fullName && <p id="signup-name-error" className="text-xs text-destructive" role="alert">{fieldErrors.fullName}</p>}</div>
            <div className="space-y-1.5"><label htmlFor="signup-email" className="text-sm font-medium">Email</label><Input id="signup-email" autoComplete="email" type="email" value={email} onChange={(event) => updateField("email", () => setEmail(event.target.value))} placeholder="you@company.com" required maxLength={320} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "signup-email-error" : undefined} />{fieldErrors.email && <p id="signup-email-error" className="text-xs text-destructive" role="alert">{fieldErrors.email}</p>}</div>
            <div className="space-y-1.5"><label htmlFor="signup-password" className="text-sm font-medium">Password</label><div className="relative"><Input id="signup-password" autoComplete="new-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => updateField("password", () => setPassword(event.target.value))} required minLength={12} maxLength={256} aria-invalid={Boolean(fieldErrors.password)} aria-describedby="signup-password-help signup-password-strength" className="pr-11" /><button type="button" className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center rounded-r-md text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div><p id="signup-password-help" className="text-xs text-muted-foreground">Use at least 12 characters. Password strength is estimated by length.</p><div id="signup-password-strength" className="flex items-center gap-2" aria-live="polite"><div className="flex flex-1 gap-1" aria-hidden="true">{[1, 2, 3].map((bar) => <span key={bar} className={`h-1 flex-1 rounded-full ${bar <= strength.bars ? "bg-emerald-600" : "bg-muted"}`} />)}</div><span className="text-xs text-muted-foreground">{strength.label}</span></div>{fieldErrors.password && <p className="text-xs text-destructive" role="alert">{fieldErrors.password}</p>}</div>
            <div className="space-y-1.5"><label htmlFor="signup-confirm-password" className="text-sm font-medium">Confirm password</label><div className="relative"><Input id="signup-confirm-password" autoComplete="new-password" type={showConfirmation ? "text" : "password"} value={confirmPassword} onChange={(event) => updateField("confirmPassword", () => setConfirmPassword(event.target.value))} required maxLength={256} aria-invalid={Boolean(fieldErrors.confirmPassword)} aria-describedby={fieldErrors.confirmPassword ? "signup-confirm-error" : undefined} className="pr-11" /><button type="button" className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center rounded-r-md text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={showConfirmation ? "Hide confirmation password" : "Show confirmation password"} aria-pressed={showConfirmation} onClick={() => setShowConfirmation((value) => !value)}>{showConfirmation ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>{fieldErrors.confirmPassword && <p id="signup-confirm-error" className="text-xs text-destructive" role="alert">{fieldErrors.confirmPassword}</p>}</div>
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
