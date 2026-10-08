export function PageHeading({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-2 text-xs font-semibold tracking-[0.16em] text-emerald-700 dark:text-emerald-300">FINANCEFLOW WORKSPACE</p><h1 className="font-display text-3xl font-semibold tracking-tight md:text-[34px]">{title}</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p></div>{action}</div>;
}
