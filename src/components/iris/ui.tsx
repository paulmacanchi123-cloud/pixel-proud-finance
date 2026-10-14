import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b bg-card px-6 py-6 md:px-10">
      <div>
        <h1 className="text-3xl font-semibold text-primary md:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "good" | "bad" | "accent" }) {
  const toneCls = { default: "border-t-primary", good: "border-t-success", bad: "border-t-destructive", accent: "border-t-accent" }[tone];
  return (
    <div className={`rounded-lg border border-t-4 ${toneCls} bg-card p-4 shadow-sm`}>
      <div className="font-display text-2xl font-semibold text-foreground">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-primary">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed bg-muted/50 p-6 text-center text-sm text-muted-foreground">{children}</p>;
}
