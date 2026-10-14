import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ClipboardCheck, Users, Building2, ShieldCheck, ScrollText, Landmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe, fmtUSD, fmtDateTime } from "@/lib/iris";
import { summarize } from "@/lib/finance-summary";
import { PageHeader, Stat, Section, Empty } from "@/components/iris/ui";

export const Route = createFileRoute("/_authenticated/panel")({
  head: () => ({ meta: [{ title: "Centro de control · IRIS" }, { name: "description", content: "Centro de control del CEO de MI POL." }] }),
  component: Panel,
});

function Panel() {
  const { data: me } = useMe();
  const canView = !!me?.permissions.has("view");
  const finance = useQuery({
    queryKey: ["finance_state"],
    enabled: canView,
    queryFn: async () => (await supabase.from("finance_state").select("data,version").eq("id", 1).maybeSingle()).data,
  });
  const approvals = useQuery({
    queryKey: ["approvals", "pending"],
    queryFn: async () => (await supabase.from("approvals").select("*").eq("status", "pending").order("created_at", { ascending: false }).limit(5)).data ?? [],
  });
  const audit = useQuery({
    queryKey: ["audit", "recent"],
    enabled: !!me?.permissions.has("view_audit"),
    queryFn: async () => (await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(6)).data ?? [],
  });
  const users = useQuery({
    queryKey: ["users", "count"],
    enabled: !!me?.isCeo,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("status");
      return data ?? [];
    },
  });

  if (!me) return null;
  const s = summarize(finance.data?.data as any);
  const firstName = (me.fullName || me.email).split(" ")[0];

  return (
    <div>
      <PageHeader
        title={me.isCeo ? "Centro de control del CEO" : `Bienvenido, ${firstName}`}
        subtitle={me.isCeo ? "Visión ejecutiva de MI POL con datos reales registrados en IRIS." : `Departamento: ${me.department?.name ?? "—"}`}
      />
      <div className="space-y-6 p-6 md:p-10">
        {canView ? (
          s.isEmpty ? (
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
                    ) : <Empty>Se necesitan al menos dos registros diarios de patrimonio para mostrar la tendencia.</Empty>}
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
              <div className="grid gap-6 lg:grid-cols-2">
                <Section title="Movimientos recientes">
                  {s.recent.length ? (
                    <ul className="divide-y text-sm">
                      {s.recent.map((m: any) => (
                        <li key={m.id} className="flex justify-between py-2">
                          <span>{m.concept || m.type}<span className="ml-2 text-xs text-muted-foreground">{m.date}</span></span>
                          <span className={m.type === "Ingreso" ? "text-success" : m.type === "Gasto" ? "text-destructive" : ""}>{fmtUSD(m.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <Empty>Sin movimientos.</Empty>}
                </Section>
                <Section title="Alertas">
                  <ul className="space-y-2 text-sm">
                    {s.overdue > 0 && <li className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" /> {s.overdue} cobro(s) o deuda(s) vencidos con saldo pendiente.</li>}
                    {(approvals.data?.length ?? 0) > 0 && <li className="flex items-center gap-2 text-warning"><ClipboardCheck className="h-4 w-4" /> {approvals.data!.length} operación(es) esperando aprobación.</li>}
                    {s.overdue === 0 && !(approvals.data?.length) && <li className="text-muted-foreground">Sin alertas relevantes.</li>}
                  </ul>
                </Section>
              </div>
            </>
          )
        ) : (
          <Empty>Tu departamento tiene acceso limitado. Solo verás los servicios que el CEO te haya autorizado.</Empty>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Aprobaciones pendientes" right={<Link to="/aprobaciones" className="text-sm text-accent hover:underline">Ver todas</Link>}>
            {approvals.data?.length ? (
              <ul className="divide-y text-sm">
                {approvals.data.map((a) => (
                  <li key={a.id} className="flex justify-between py-2"><span>{a.operation}<span className="ml-2 text-xs text-muted-foreground">{a.requester_email}</span></span><span className="font-medium">{fmtUSD(Number(a.amount))}</span></li>
                ))}
              </ul>
            ) : <Empty>No hay operaciones pendientes.</Empty>}
          </Section>
          {me.permissions.has("view_audit") && (
            <Section title="Actividad reciente" right={<Link to="/auditoria" className="text-sm text-accent hover:underline">Auditoría</Link>}>
              {audit.data?.length ? (
                <ul className="divide-y text-sm">
                  {audit.data.map((l) => (
                    <li key={l.id} className="flex justify-between gap-2 py-2"><span>{l.action}<span className="ml-2 text-xs text-muted-foreground">{l.actor_email}</span></span><span className="text-xs text-muted-foreground">{fmtDateTime(l.created_at)}</span></li>
                  ))}
                </ul>
              ) : <Empty>Sin actividad registrada.</Empty>}
            </Section>
          )}
        </div>

        {me.isCeo && (
          <Section title="Accesos de administración">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              {[
                { to: "/usuarios", l: `Usuarios (${users.data?.length ?? 0})`, i: Users },
                { to: "/departamentos", l: "Departamentos", i: Building2 },
                { to: "/departamentos", l: "Permisos", i: ShieldCheck },
                { to: "/aprobaciones", l: "Aprobaciones", i: ClipboardCheck },
                { to: "/auditoria", l: "Auditoría", i: ScrollText },
                { to: "/finanzas", l: "Finanzas", i: Landmark },
              ].map((x) => (
                <Link key={x.l} to={x.to} className="flex flex-col items-center gap-2 rounded-lg border bg-gradient-silver p-4 text-center text-sm text-primary transition hover:shadow-elegant">
                  <x.i className="h-5 w-5" /> {x.l}
                </Link>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
