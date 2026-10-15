import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ClipboardCheck, Users, Building2, ShieldCheck, ScrollText, Landmark, KeyRound, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe, fmtUSD, fmtDateTime, type Me } from "@/lib/iris";
import { summarize } from "@/lib/finance-summary";
import { PageHeader, Stat, Section, Empty } from "@/components/iris/ui";

export const Route = createFileRoute("/_authenticated/panel")({
  head: () => ({ meta: [{ title: "Centro de control · IRIS" }, { name: "description", content: "Centro de control del CEO de MI POL." }] }),
  component: Panel,
});

// Every query below goes through the browser client, so server-side RLS decides what rows come back.
async function must<T>(p: PromiseLike<{ data: T; error: any }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data;
}

function Loading() {
  return <p className="animate-pulse py-4 text-center text-sm text-muted-foreground">Cargando…</p>;
}
function Failed() {
  return <p className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-center text-sm text-destructive">No se pudo cargar esta información.</p>;
}
function State<T>({ q, empty, children }: { q: { isLoading: boolean; isError: boolean; data: T | undefined }; empty: (d: T) => boolean; children: (d: T) => ReactNode; }) {
  if (q.isLoading) return <Loading />;
  if (q.isError || q.data === undefined) return <Failed />;
  if (empty(q.data)) return null;
  return <>{children(q.data)}</>;
}

const QUICK: { to: string; l: string; i: typeof Users; show: (m: Me) => boolean }[] = [
  { to: "/aprobaciones", l: "Aprobaciones", i: ClipboardCheck, show: (m) => m.permissions.has("create") || m.permissions.has("approve_operations") },
  { to: "/usuarios", l: "Usuarios", i: Users, show: (m) => m.isCeo || m.permissions.has("manage_users") },
  { to: "/departamentos", l: "Departamentos y permisos", i: Building2, show: (m) => m.isCeo },
  { to: "/auditoria", l: "Auditoría", i: ScrollText, show: (m) => m.permissions.has("view_audit") },
  { to: "/seguridad", l: "Seguridad", i: ShieldCheck, show: () => true },
  { to: "/finanzas", l: "Finanzas", i: Landmark, show: (m) => m.permissions.has("view") },
];

function Panel() {
  const { data: me } = useMe();
  const canView = !!me?.permissions.has("view");
  const canSeeApprovals = !!me && (me.permissions.has("create") || me.permissions.has("approve_operations"));
  const canAdminUsers = !!me && (me.isCeo || me.permissions.has("manage_users"));

  const finance = useQuery({
    queryKey: ["finance_state"],
    enabled: canView,
    queryFn: async () => must(supabase.from("finance_state").select("data,version").eq("id", 1).maybeSingle()),
  });
  const approvals = useQuery({
    queryKey: ["approvals", "pending"],
    enabled: canSeeApprovals,
    queryFn: async () => {
      const { data, count, error } = await supabase.from("approvals").select("*", { count: "exact" }).eq("status", "pending").order("created_at", { ascending: false }).limit(5);
      if (error) throw new Error(error.message);
      return { rows: data ?? [], total: count ?? 0 };
    },
  });
  const audit = useQuery({
    queryKey: ["audit", "recent"],
    enabled: !!me?.permissions.has("view_audit"),
    queryFn: async () => (await must(supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(8))) ?? [],
  });
  const users = useQuery({
    queryKey: ["users", "status-summary"],
    enabled: canAdminUsers,
    queryFn: async () => {
      const rows = (await must(supabase.from("profiles").select("status,must_change_password"))) ?? [];
      return {
        active: rows.filter((r) => r.status === "active").length,
        inactive: rows.filter((r) => r.status !== "active").length,
        tempPassword: rows.filter((r) => r.status === "active" && r.must_change_password).length,
      };
    },
  });
  const mfa = useQuery({
    queryKey: ["mfa", "factors"],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw new Error(error.message);
      return (data?.totp ?? []).some((f) => f.status === "verified");
    },
  });

  if (!me) return null;
  const s = summarize(finance.data?.data as any);
  const firstName = (me.fullName || me.email).split(" ")[0];
  const quick = QUICK.filter((q) => q.show(me));

  // Security alerts: only facts we can read reliably.
  const securityAlerts: { icon: typeof Users; text: string; tone: string; to?: string }[] = [];
  if (mfa.data === false) securityAlerts.push({ icon: ShieldCheck, text: "Tu cuenta no tiene verificación en dos pasos activada.", tone: "text-warning", to: "/seguridad" });
  if (users.data?.tempPassword) securityAlerts.push({ icon: KeyRound, text: `${users.data.tempPassword} usuario(s) activos aún con contraseña temporal.`, tone: "text-warning", to: "/usuarios" });
  if (users.data?.inactive) securityAlerts.push({ icon: UserX, text: `${users.data.inactive} cuenta(s) suspendidas o desactivadas.`, tone: "text-muted-foreground", to: "/usuarios" });

  return (
    <div>
      <PageHeader
        title={me.isCeo ? "Centro de control del CEO" : `Bienvenido, ${firstName}`}
        subtitle={me.isCeo ? "Visión ejecutiva de MI POL con datos reales registrados en IRIS." : `Departamento: ${me.department?.name ?? "—"}`}
      />
      <div className="space-y-6 p-6 md:p-10">
        {/* A. Resumen ejecutivo */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {canSeeApprovals && <Stat label="Aprobaciones pendientes" value={approvals.isLoading ? "…" : approvals.isError ? "—" : String(approvals.data?.total ?? 0)} tone="accent" />}
          {canAdminUsers && <Stat label="Usuarios activos" value={users.isLoading ? "…" : users.isError ? "—" : String(users.data?.active ?? 0)} />}
          <Stat label="Alertas de seguridad" value={mfa.isLoading || users.isLoading ? "…" : String(securityAlerts.length)} tone={securityAlerts.length ? "bad" : "good"} />
        </div>

        {canView ? (
          finance.isLoading ? <Loading /> : finance.isError ? <Failed /> : s.isEmpty ? (
            <Empty>
              Aún no hay datos financieros registrados. Empieza en <Link to="/finanzas" className="text-accent underline">Finanzas</Link> o restaura tu respaldo JSON desde «Importar / exportar».
            </Empty>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Dinero disponible" value={fmtUSD(s.dineroDisponible)} tone="accent" />
                <Stat label="Ingresos" value={fmtUSD(s.totalIngresos)} tone="good" />
                <Stat label="Gastos" value={fmtUSD(s.totalGastos)} tone="bad" />
                <Stat label="Flujo neto" value={fmtUSD(s.flujoNeto)} tone={s.flujoNeto >= 0 ? "good" : "bad"} />
                {me.permissions.has("view_patrimony") && <Stat label="Patrimonio neto" value={fmtUSD(s.patrimonio)} />}
                <Stat label="Inversiones" value={fmtUSD(s.totalInversiones)} />
                <Stat label="Por cobrar" value={fmtUSD(s.totalPorCobrar)} />
                <Stat label="Deudas" value={fmtUSD(s.totalDeudas)} tone="bad" />
              </div>
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <Section title="Evolución del patrimonio">
                    {me.permissions.has("view_patrimony") && s.snapshots.length > 1 ? (
                      <div className="h-64">
                        <ResponsiveContainer>
                          <AreaChart data={s.snapshots}>
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                            <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={70} />
                            <Tooltip formatter={(v: any) => fmtUSD(Number(v))} />
                            <Area type="monotone" dataKey="value" stroke="var(--primary)" fill="var(--accent)" fillOpacity={0.15} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : <Empty>{me.permissions.has("view_patrimony") ? "Se necesitan al menos dos registros diarios de patrimonio para mostrar la tendencia." : "No tienes permiso para consultar el patrimonio."}</Empty>}
                  </Section>
                </div>
                <Section title="Cuentas">
                  {s.accounts.length ? (
                    <ul className="divide-y text-sm">
                      {s.accounts.map((a) => (
                        <li key={a.id} className="flex justify-between py-2"><span>{a.name}<span className="ml-2 text-xs text-muted-foreground">{a.type}</span></span><span className="font-medium">{fmtUSD(a.balance)}</span></li>
                      ))}
                    </ul>
                  ) : <Empty>Sin cuentas registradas.</Empty>}
                </Section>
              </div>
            </>
          )
        ) : (
          <Empty>Tu departamento no tiene acceso a la información financiera. Solo verás los servicios que el CEO te haya autorizado.</Empty>
        )}

        {/* D. Alertas y pendientes */}
        <Section title="Alertas y pendientes">
          {mfa.isLoading || (canAdminUsers && users.isLoading) || (canSeeApprovals && approvals.isLoading) ? <Loading /> : (
            <ul className="space-y-2 text-sm">
              {canView && s.overdue > 0 && <li className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" /> {s.overdue} cobro(s) o deuda(s) vencidos con saldo pendiente.</li>}
              {(approvals.data?.total ?? 0) > 0 && <li><Link to="/aprobaciones" className="flex items-center gap-2 text-warning hover:underline"><ClipboardCheck className="h-4 w-4" /> {approvals.data!.total} operación(es) esperando aprobación.</Link></li>}
              {securityAlerts.map((a) => (
                <li key={a.text}><Link to={a.to ?? "/seguridad"} className={`flex items-center gap-2 hover:underline ${a.tone}`}><a.icon className="h-4 w-4" /> {a.text}</Link></li>
              ))}
              {(mfa.isError || users.isError || approvals.isError) && <li className="text-destructive">Parte de las alertas no se pudo cargar.</li>}
              {!(canView && s.overdue > 0) && !(approvals.data?.total) && securityAlerts.length === 0 && !(mfa.isError || users.isError || approvals.isError) && (
                <li className="text-muted-foreground">Sin alertas ni pendientes.</li>
              )}
            </ul>
          )}
        </Section>

        <div className="grid gap-6 lg:grid-cols-2">
          {canSeeApprovals && (
            <Section title="Aprobaciones pendientes" right={<Link to="/aprobaciones" className="text-sm text-accent hover:underline">Ver todas</Link>}>
              <State q={approvals} empty={() => false}>
                {(d) => d.rows.length ? (
                  <ul className="divide-y text-sm">
                    {d.rows.map((a) => (
                      <li key={a.id} className="flex justify-between gap-2 py-2"><span>{a.operation}<span className="ml-2 text-xs text-muted-foreground">{a.requester_email} · {fmtDateTime(a.created_at)}</span></span><span className="font-medium">{fmtUSD(Number(a.amount))}</span></li>
                    ))}
                  </ul>
                ) : <Empty>No hay operaciones pendientes.</Empty>}
              </State>
            </Section>
          )}
          {/* B. Actividad reciente */}
          {me.permissions.has("view_audit") && (
            <Section title="Actividad reciente" right={<Link to="/auditoria" className="text-sm text-accent hover:underline">Auditoría</Link>}>
              <State q={audit} empty={() => false}>
                {(rows) => rows.length ? (
                  <ul className="divide-y text-sm">
                    {rows.map((l) => (
                      <li key={l.id} className="flex justify-between gap-2 py-2">
                        <span><span className="font-medium">{l.actor_email ?? "Sistema"}</span> · {l.action}{l.target ? <span className="text-muted-foreground"> ({l.target})</span> : null}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{fmtDateTime(l.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                ) : <Empty>Sin actividad registrada.</Empty>}
              </State>
            </Section>
          )}
        </div>

        {/* C. Accesos rápidos */}
        <Section title="Accesos rápidos">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {quick.map((x) => (
              <Link key={x.to} to={x.to} className="flex flex-col items-center gap-2 rounded-lg border bg-gradient-silver p-4 text-center text-sm text-primary transition hover:shadow-elegant">
                <x.i className="h-5 w-5" /> {x.l}
              </Link>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
