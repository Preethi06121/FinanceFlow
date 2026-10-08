import Link from "next/link";

import { ArrowLeft, WalletCards } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return <main className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-5 text-center"><span className="mb-5 flex size-12 items-center justify-center rounded-xl bg-[#112620] text-emerald-300"><WalletCards className="size-6" /></span><p className="text-xs font-semibold tracking-[0.16em] text-emerald-700">FINANCEFLOW</p><h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">Page not found</h1><p className="mt-3 max-w-md text-sm text-muted-foreground">The requested FinanceFlow page could not be found.</p><Button asChild className="mt-6 bg-[#17392f] text-white hover:bg-[#214a3e]"><Link href="/dashboard"><ArrowLeft className="size-4" />Return to dashboard</Link></Button></main>;
}
