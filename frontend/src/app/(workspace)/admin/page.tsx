"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { KeyRound, Plus, Settings2, ShieldCheck, UserRoundCog } from "lucide-react";

import { LoadingState, Notice } from "@/components/async-state";
import { PageHeading } from "@/components/page-heading";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch, getErrorMessage } from "@/lib/financeflow";

type UserRecord = { id: number; email: string; full_name: string; role: "ANALYST" | "ADMIN"; is_active: boolean; created_at: string };
type ConfigRecord = { key: string; value: unknown; updated_at: string };

export default function AdminPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [configs, setConfigs] = useState<ConfigRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ANALYST" | "ADMIN">("ANALYST");
  const [configKey, setConfigKey] = useState("");
  const [configValue, setConfigValue] = useState("null");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [userList, configList] = await Promise.all([apiFetch<UserRecord[]>("/admin/users"), apiFetch<ConfigRecord[]>("/admin/config")]);
      setUsers(userList); setConfigs(configList);
    } catch (cause) { setError(getErrorMessage(cause)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      await apiFetch<UserRecord>("/admin/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, full_name: fullName, password, role }) });
      setEmail(""); setFullName(""); setPassword(""); setNotice("User created."); await load();
    } catch (cause) { setError(getErrorMessage(cause)); }
    finally { setSaving(false); }
  }

  async function toggleUser(user: UserRecord) {
    setSaving(true); setError(""); setNotice("");
    try { await apiFetch<UserRecord>(`/admin/users/${user.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ is_active: !user.is_active }) }); setNotice(`${user.email} ${user.is_active ? "deactivated" : "activated"}.`); await load(); }
    catch (cause) { setError(getErrorMessage(cause)); }
    finally { setSaving(false); }
  }

  async function saveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    let value: unknown;
    try { value = JSON.parse(configValue); }
    catch { setError("Configuration value must be valid JSON."); setSaving(false); return; }
    try { await apiFetch<ConfigRecord>(`/admin/config/${encodeURIComponent(configKey)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ value }) }); setConfigKey(""); setConfigValue("null"); setNotice("Configuration saved."); await load(); }
    catch (cause) { setError(getErrorMessage(cause)); }
    finally { setSaving(false); }
  }

  return <>
    <PageHeading title="Admin settings" description="Manage FinanceFlow user access and application configuration." />
    {error && <div className="mb-4"><Notice>{error}</Notice></div>}{notice && <div className="mb-4"><Notice tone="success">{notice}</Notice></div>}
    {loading ? <LoadingState label="Loading administration settings…" /> : <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-5">
        <Card className="border-border/80 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><UserRoundCog className="size-4 text-emerald-700" />User access</CardTitle><p className="text-sm text-muted-foreground">Create accounts and manage analyst/admin access.</p></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-y bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-5 py-3 font-medium">User</th><th className="px-4 py-3 font-medium">Role</th><th className="px-4 py-3 font-medium">Access</th><th className="px-5 py-3 text-right font-medium">Action</th></tr></thead><tbody className="divide-y">{users.map((user) => <tr key={user.id}><td className="px-5 py-3.5"><p className="font-medium">{user.full_name}</p><p className="mt-0.5 text-xs text-muted-foreground">{user.email}</p></td><td className="px-4 py-3.5"><StatusBadge value={user.role} /></td><td className="px-4 py-3.5">{user.is_active ? <span className="text-emerald-700 dark:text-emerald-300">Active</span> : <span className="text-muted-foreground">Inactive</span>}</td><td className="px-5 py-3.5 text-right"><Button variant="outline" size="sm" disabled={saving} onClick={() => void toggleUser(user)}>{user.is_active ? "Deactivate" : "Activate"}</Button></td></tr>)}</tbody></table></div></CardContent></Card>
        <Card className="border-border/80 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Plus className="size-4 text-emerald-700" />Create user</CardTitle></CardHeader><CardContent><form onSubmit={(event) => void createUser(event)} className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><label htmlFor="user-full-name" className="text-sm font-medium">Full name</label><Input id="user-full-name" required maxLength={200} value={fullName} onChange={(event) => setFullName(event.target.value)} /></div><div className="space-y-1.5"><label htmlFor="user-email" className="text-sm font-medium">Email</label><Input id="user-email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div><div className="space-y-1.5"><label htmlFor="user-password" className="text-sm font-medium">Temporary password</label><Input id="user-password" required type="password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} /><span className="block text-xs text-muted-foreground">At least 12 characters.</span></div><div className="space-y-1.5"><label htmlFor="user-role" className="text-sm font-medium">Role</label><select id="user-role" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={role} onChange={(event) => setRole(event.target.value as "ANALYST" | "ADMIN")}><option value="ANALYST">Analyst</option><option value="ADMIN">Admin</option></select></div><div className="sm:col-span-2"><Button disabled={saving} type="submit" className="bg-[#17392f] text-white hover:bg-[#214a3e]">Create user</Button></div></form></CardContent></Card>
      </div>
      <div className="space-y-5">
        <Card className="border-border/80 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Settings2 className="size-4 text-emerald-700" />Configuration</CardTitle><p className="text-sm text-muted-foreground">Existing application configuration values.</p></CardHeader><CardContent className="space-y-3">{configs.length ? configs.map((item) => <div key={item.key} className="rounded-lg border p-3"><p className="text-sm font-medium">{item.key}</p><pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-muted-foreground">{JSON.stringify(item.value, null, 2)}</pre></div>) : <p className="text-sm text-muted-foreground">No configuration values have been set.</p>}</CardContent></Card>
        <Card className="border-border/80 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="size-4 text-emerald-700" />Set configuration value</CardTitle></CardHeader><CardContent><form onSubmit={(event) => void saveConfig(event)} className="space-y-3"><div className="space-y-1.5"><label htmlFor="config-key" className="text-sm font-medium">Key</label><Input id="config-key" required maxLength={100} value={configKey} onChange={(event) => setConfigKey(event.target.value)} placeholder="setting_name" /></div><div className="space-y-1.5"><label htmlFor="config-value" className="text-sm font-medium">Value (JSON)</label><textarea id="config-value" className="min-h-24 w-full rounded-md border bg-transparent px-3 py-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={configValue} onChange={(event) => setConfigValue(event.target.value)} /></div><p className="text-xs text-muted-foreground">Enter a JSON value such as a string, number, object, array or null.</p><Button type="submit" disabled={saving || !configKey.trim()}><ShieldCheck className="size-4" />Save configuration</Button></form></CardContent></Card>
      </div>
    </div>}
  </>;
}
