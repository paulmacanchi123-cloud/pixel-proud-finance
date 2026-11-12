import { useMemo, useState } from "react";
import { ClipboardCopy, Lock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Section, Empty } from "@/components/iris/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LEGACY_MAP } from "@/lib/org/legacy-map";
import { setAuthzMode, setRequireMfaAdmin } from "@/lib/org/org.functions";
import {
  useAuthzConfig,
  useAuthzDiff,
  useMigrationPlan,
  useShadowReport,
} from "@/lib/org/org.queries";
import type { AuthzMode, PlanRow } from "@/lib/org/types";
import { ReadOnlyNote, ReasonDialog, fmtDT, useAct } from "./shared";

const MODES: { mode: AuthzMode; label: string; help: string }[] = [
  {
    mode: "legacy",
    label: "Legacy",
    help: "Comportamiento actual de IRIS, sin cambios. Es el modo por defecto.",
  },
  {
    mode: "shadow",
    label: "Shadow",
    help: "Decide como hoy y compara con el modelo nuevo. No altera ningún acceso.",
  },
  {
    mode: "union",
    label: "Union",
    help: "Concede si cualquiera de los dos modelos concede. BLOQUEADO hasta aprobación expresa.",
  },
  {
    mode: "org",
    label: "Org",
    help: "Decide solo el modelo nuevo. BLOQUEADO hasta aprobación expresa.",
  },
];

/** Solo CEO. Cambiar de modo, ver el informe de diferencias y revisar el plan de migración EN SECO. */
export function MigrationPanel() {
  const { data: cfg, error: cfgError } = useAuthzConfig(true);
  const { data: diff = [] } = useAuthzDiff(true);
  const { data: shadow = [] } = useShadowReport(true);
  const { data: plan = [] } = useMigrationPlan(true);
  const modeAct = useAct<unknown>(setAuthzMode, "Modo de autorización actualizado");
  const mfaAct = useAct<unknown>(setRequireMfaAdmin, "Ajuste de MFA actualizado");
  const [target, setTarget] = useState<AuthzMode | null>(null);
  const [mfaTarget, setMfaTarget] = useState<boolean | null>(null);

  const summary = useMemo(() => {
    const m = new Map<string, { lose: number; gain: number }>();
    for (const r of diff) {
      const cur = m.get(r.perm) ?? { lose: 0, gain: 0 };
      if (r.legacy_result && !r.org_result) cur.lose++;
      if (!r.legacy_result && r.org_result) cur.gain++;
      m.set(r.perm, cur);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [diff]);

  const planByRole = useMemo(() => {
    const m = new Map<string, PlanRow[]>();
    for (const r of plan) m.set(r.proposed_role, [...(m.get(r.proposed_role) ?? []), r]);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [plan]);

  const copyPlan = async () => {
    const head =
      "usuario;departamento;permiso_actual;origen;concedido;recurso_nuevo;accion_nueva;estado;rol_propuesto;nota";
    const body = plan.map((r) =>
      [
        r.email,
        r.department_code ?? "",
        r.legacy_perm,
        r.source,
        r.granted,
        r.org_resource ?? "",
        r.org_action ?? "",
        r.map_status,
        r.proposed_role,
        r.note.replace(/;/g, ","),
      ].join(";"),
    );
    try {
      await navigator.clipboard.writeText([head, ...body].join("\n"));
      toast.success("Plan copiado (CSV)");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  if (cfgError)
    return (
      <Section title="Migración de autorización">
        <Empty>Solo el CEO puede ver esta sección.</Empty>
      </Section>
    );
  if (!cfg) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  return (
    <div className="space-y-6">
      <Section title="Modo de autorización">
        <ReadOnlyNote>
          Define cómo decide <code>has_permission()</code>, que gobierna las políticas de la base de
          datos y los permisos de la interfaz. Se despliega en <b>legacy</b>. <b>Union</b> y{" "}
          <b>Org</b> están bloqueados por la base de datos: solo se habilitan con aprobación expresa
          y una acción del propietario de la base, nunca desde la aplicación.
        </ReadOnlyNote>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {MODES.map((m) => {
            const locked = (m.mode === "union" || m.mode === "org") && !cfg.enforcement_unlocked;
            const current = cfg.mode === m.mode;
            return (
              <div
                key={m.mode}
                className={`rounded-lg border p-3 ${current ? "border-primary bg-primary/5" : ""}`}
              >
                <div className="flex items-center justify-between font-medium">
                  {m.label}
                  {current && <Badge>Actual</Badge>}
                  {locked && <Lock className="h-4 w-4 text-muted-foreground" />}
                </div>
                <p className="my-2 min-h-[3.5rem] text-xs text-muted-foreground">{m.help}</p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={current || locked}
                  onClick={() => setTarget(m.mode)}
                >
                  Cambiar a {m.label}
                </Button>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm">
          <ShieldAlert className="h-4 w-4 text-primary" />
          <span>
            Exigir MFA (aal2) en operaciones administrativas del módulo:{" "}
            <b>{cfg.require_mfa_admin ? "activado" : "desactivado"}</b>.
          </span>
          <Button size="sm" variant="outline" onClick={() => setMfaTarget(!cfg.require_mfa_admin)}>
            {cfg.require_mfa_admin ? "Desactivar" : "Activar"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Para activarlo debes haber iniciado sesión con segundo factor: así se comprueba que
            funciona antes de aplicarlo.
          </span>
        </div>
      </Section>

      <Section title="Equivalencias entre permisos actuales y nuevos">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Permiso actual</TableHead>
                <TableHead>Equivalente nuevo</TableHead>
                <TableHead>Observación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {LEGACY_MAP.map((e) => (
                <TableRow key={e.perm}>
                  <TableCell>
                    <code>{e.perm}</code>
                  </TableCell>
                  <TableCell>
                    {e.target ? (
                      <code>{e.target}</code>
                    ) : (
                      <Badge variant="outline">Sin equivalencia segura</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Section>

      <Section title="Informe de diferencias (legacy frente a org)">
        <ReadOnlyNote>
          Para cada usuario activo que no es CEO: qué permiso conserva hoy y qué decidiría el modelo
          nuevo con los roles asignados. «Perdería» = tiene acceso hoy y no lo tendría en modo org.
          «Ganaría» = lo tendría solo por un rol nuevo asignado explícitamente.
        </ReadOnlyNote>
        {summary.length === 0 ? (
          <div className="mt-3">
            <Empty>Sin diferencias: ambos modelos deciden igual para todos los usuarios.</Empty>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Permiso</TableHead>
                  <TableHead className="text-right">Usuarios que perderían acceso</TableHead>
                  <TableHead className="text-right">Usuarios que ganarían acceso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map(([perm, c]) => (
                  <TableRow key={perm}>
                    <TableCell>
                      <code>{perm}</code>
                    </TableCell>
                    <TableCell className="text-right">{c.lose}</TableCell>
                    <TableCell className="text-right">{c.gain}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {diff.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-primary">
              Ver detalle por usuario ({diff.length})
            </summary>
            <div className="mt-2 max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Dpto.</TableHead>
                    <TableHead>Permiso</TableHead>
                    <TableHead>Origen actual</TableHead>
                    <TableHead>Hoy</TableHead>
                    <TableHead>Org</TableHead>
                    <TableHead>Equivalente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diff.map((r) => (
                    <TableRow key={`${r.user_id}-${r.perm}`}>
                      <TableCell className="text-xs">{r.email}</TableCell>
                      <TableCell className="text-xs">{r.department_code ?? "—"}</TableCell>
                      <TableCell>
                        <code>{r.perm}</code>
                      </TableCell>
                      <TableCell className="text-xs">{r.legacy_source}</TableCell>
                      <TableCell>{r.legacy_result ? "sí" : "no"}</TableCell>
                      <TableCell>{r.org_result ? "sí" : "no"}</TableCell>
                      <TableCell className="text-xs">{r.mapped_to}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </details>
        )}
      </Section>

      <Section title="Divergencias observadas en vivo (modo shadow)">
        <ReadOnlyNote>
          Registro de mejor esfuerzo: las lecturas de PostgREST se ejecutan en transacciones de solo
          lectura y no pueden registrarse (por diseño, para no romper nunca la autorización). El
          informe de diferencias de arriba es la fuente completa.
        </ReadOnlyNote>
        {shadow.length === 0 ? (
          <div className="mt-3">
            <Empty>
              {cfg.mode === "shadow"
                ? "Aún no hay divergencias registradas."
                : "Disponible cuando el modo shadow esté activo."}
            </Empty>
          </div>
        ) : (
          <div className="mt-3 max-h-80 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Permiso</TableHead>
                  <TableHead>Hoy</TableHead>
                  <TableHead>Org</TableHead>
                  <TableHead className="text-right">Veces</TableHead>
                  <TableHead>Última</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shadow.map((r) => (
                  <TableRow key={`${r.user_id}-${r.perm}-${r.legacy_result}`}>
                    <TableCell className="text-xs">{r.email}</TableCell>
                    <TableCell>
                      <code>{r.perm}</code>
                    </TableCell>
                    <TableCell>{r.legacy_result ? "sí" : "no"}</TableCell>
                    <TableCell>{r.org_result ? "sí" : "no"}</TableCell>
                    <TableCell className="text-right">{r.hits}</TableCell>
                    <TableCell className="text-xs">{fmtDT(r.last_seen)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      <Section
        title="Plan de migración en seco"
        right={
          plan.length > 0 && (
            <Button size="sm" variant="outline" onClick={copyPlan}>
              <ClipboardCopy className="mr-1 h-4 w-4" />
              Copiar CSV
            </Button>
          )
        }
      >
        <ReadOnlyNote>
          <b>Solo propuesta.</b> No crea roles, no asigna nada y no elimina permisos antiguos. Cada
          rol propuesto reproduce lo que hoy se obtiene por departamento o por ajuste individual;
          tras tu aprobación se crearían y asignarían explícitamente, con justificación y registro.
        </ReadOnlyNote>
        {planByRole.length === 0 ? (
          <div className="mt-3">
            <Empty>No hay usuarios con permisos legacy que migrar.</Empty>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {planByRole.map(([role, rows]) => (
              <details key={role} className="rounded border p-2">
                <summary className="cursor-pointer text-sm font-medium">
                  {role}{" "}
                  <Badge variant="outline" className="ml-2">
                    {new Set(rows.map((r) => r.user_id)).size} usuarios
                  </Badge>
                </summary>
                <div className="mt-2 max-h-72 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuario</TableHead>
                        <TableHead>Permiso actual</TableHead>
                        <TableHead>Equivalente</TableHead>
                        <TableHead>Nota</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={`${r.user_id}-${r.legacy_perm}`}>
                          <TableCell className="text-xs">{r.email}</TableCell>
                          <TableCell>
                            <code>{r.legacy_perm}</code>
                            {!r.granted && (
                              <Badge variant="outline" className="ml-1">
                                denegado
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {r.org_resource ? `${r.org_resource}:${r.org_action}` : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.note}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </details>
            ))}
          </div>
        )}
      </Section>

      <ReasonDialog
        open={!!target}
        onClose={() => setTarget(null)}
        busy={modeAct.busy}
        title={`Cambiar a modo ${target ?? ""}`}
        confirmLabel="Cambiar modo"
        description={
          target === "shadow"
            ? "No altera ningún acceso: solo compara."
            : "Vuelve al comportamiento actual de IRIS."
        }
        onConfirm={(reason) => modeAct.run({ mode: target, reason })}
      />
      <ReasonDialog
        open={mfaTarget !== null}
        onClose={() => setMfaTarget(null)}
        busy={mfaAct.busy}
        title={mfaTarget ? "Activar exigencia de MFA" : "Desactivar exigencia de MFA"}
        confirmLabel="Confirmar"
        description={
          mfaTarget
            ? "Se exigirá segundo factor en toda operación administrativa de organización y permisos. Debes estar con sesión aal2."
            : undefined
        }
        onConfirm={(reason) => mfaAct.run({ on: mfaTarget, reason })}
      />
    </div>
  );
}
