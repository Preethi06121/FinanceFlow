"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import {
  Activity, ArrowLeftRight, BarChart3, FileClock, LayoutDashboard,
  LogOut, PanelLeftClose, Settings2, ShieldAlert, Upload, WalletCards,
} from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import type { SessionUser } from "@/lib/financeflow";

const items = [
  { href: "/upload", label: "Upload Data", icon: Upload, primary: true },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/reconciliation", label: "Reconciliation", icon: Activity },
  { href: "/exceptions", label: "Exceptions", icon: ShieldAlert },
  { href: "/audit-logs", label: "Audit Logs", icon: FileClock },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const navigation = user?.role === "ADMIN" ? [...items, { href: "/admin", label: "Admin settings", icon: Settings2 }] : items;

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (data) setUser(data); })
      .catch(() => setUser(null));
  }, []);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <aside className="hidden border-r bg-[#112620] text-white lg:fixed lg:inset-y-0 lg:flex lg:w-[248px] lg:flex-col">
        <Link href="/dashboard" className="flex h-[76px] items-center gap-3 border-b border-white/10 px-6">
          <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-300 text-[#112620]"><WalletCards className="size-5" /></span>
          <span className="font-display text-lg font-semibold tracking-tight">FinanceFlow</span>
        </Link>
        <div className="px-4 pt-6 text-[11px] font-semibold tracking-[0.14em] text-white/45">WORKSPACE</div>
        <nav className="flex-1 space-y-1 px-3 pt-3">
          {navigation.map(({ href, label, icon: Icon, primary }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
            return <Link key={href} href={href} className={`flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${primary ? "bg-emerald-300 font-semibold text-[#112620] hover:bg-emerald-200" : active ? "bg-white/10 font-medium text-white" : "text-white/65 hover:bg-white/5 hover:text-white"}`}>
              <Icon className={`size-4 ${primary ? "text-[#112620]" : active ? "text-emerald-300" : "text-white/50"}`} />{label}
            </Link>;
          })}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="mb-3 flex items-center gap-3 px-1">
            <div className="flex size-9 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-emerald-200">{user?.email?.slice(0, 1).toUpperCase() || "U"}</div>
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{user?.email || "Signed in"}</div><div className="text-xs text-white/50">{user?.role || "FinanceFlow user"}</div></div>
          </div>
          <Button variant="ghost" className="h-9 w-full justify-start text-white/65 hover:bg-white/10 hover:text-white" onClick={signOut}><LogOut className="size-4" />Sign out</Button>
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex min-h-[68px] items-center justify-between border-b bg-background/90 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3 lg:hidden"><span className="flex size-8 items-center justify-center rounded-lg bg-[#112620] text-emerald-300"><WalletCards className="size-4" /></span><span className="font-display font-semibold">FinanceFlow</span></div>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground lg:flex"><PanelLeftClose className="size-4" />Financial operations</div>
          <div className="flex items-center gap-2"><span className="hidden text-xs text-muted-foreground sm:inline">{user?.role || ""}</span><ThemeToggle /><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Sign out" onClick={signOut}><LogOut className="size-4" /></Button></div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b bg-background px-3 py-2 lg:hidden">
          {navigation.map(({ href, label, icon: Icon, primary }) => <Link key={href} href={href} aria-label={label} title={label} className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-xs ${primary ? "bg-[#17392f] font-semibold text-white" : pathname === href || pathname.startsWith(`${href}/`) ? "bg-accent font-medium text-foreground" : "text-muted-foreground"}`}><Icon className="size-4" /><span>{label}</span></Link>)}
        </nav>
        <main className="mx-auto w-full max-w-[1500px] px-4 py-7 md:px-8 md:py-9">{children}</main>
      </div>
    </div>
  );
}
