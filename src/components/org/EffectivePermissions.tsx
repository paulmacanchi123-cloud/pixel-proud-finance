import { useMemo, useState } from "react";
import { AlertTriangle, Ban, Lock, Undo2 } from "lucide-react";
import { Section, Empty } from "@/components/iris/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { assignmentStatus } from "@/lib/org/authz";
import { setUserDeny } from "@/lib/org/org.functions";
import {
  useDepartments,
  useEffectivePermissions,
  useOrgUsers,
  usePermissionDefs,
  useResources,
  useRoleAssignments,
  useRoles,
  useSodExceptions,
  useUserConflicts,
  useUserDenies,
} from "@/lib/org/org.queries";
import { ACTION_LABELS, SCOPE_LABELS, type EffectivePermission } from "@/lib/org/types";
import {
  AssignmentBadge,
  ReadOnlyNote,
  ReasonDialog,
  SelectField,
  fmtDate,
  useAccess,
  useAct,
  userLabel,
} from "./shared";

type DenyTarget = { kind: "deny" | "lift"; permissionId: string };

export function EffectivePermissions() {
  const { can, userId: me } = useAccess();
  const { data: users = [] } = useOrgUsers();
  const { data: depts = [] } = useDepartments();
  const { data: defs = [] } = usePermissionDefs();
  const { data: resources = [] } = useResources();
  const { data: roles = [] } = useRoles();
  const { data: assignments = [] } = useRoleAssignments();
  const { data: denies = [] } = useUserDenies();
  const { data: exceptions = [] } = useSodExceptions();
  const [userId, setUserId] = useState<string | null>(me);
  const [filter, setFilter] = useState("");
  const { data: perms = [], isLoading, error } = useEffectivePermissions(userId);
  const { data: conflicts = [] } = useUserConflicts(userId);
  const [target, setTarget] = useState<DenyTarget | null>(null);
  const act = useAct<unknown>(setUserDeny, "Permiso actualizado");

  const canDeny = can("permisos", "administrar") && !!userId && userId !== me;
  const resName = (c: string) => resources.find((r) => r.code === c)?.name ?? c;
  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? "—";
  const deptName = (id: string | null) => depts.find((d) => d.id === id)?.name;
  const assignmentById = new Map(assignments.map((a) => [a.id, a]));
  const defId = (p: EffectivePermission) =>
    defs.find((d) => d.resource === p.resource && d.action === p.action && d.scope === p.scope)?.id;

  const sorted = useMemo(
    () =>
      [...perms]
        .filter((p) =>
          `${resources.find((r) => r.code === p.resource)?.name ?? p.resource} ${p.action} ${p.scope} ${p.role_name}`
            .toLowerCase()
            .includes(filter.toLowerCase()),
        )
        .sort(
          (a, b) =>
            a.resource.localeCompare(b.resource) ||
            a.action.localeCompare(b.action) ||
            a.scope.localeCompare(b.scope),
        ),
    [perms, filter, resources],
  );
  const userAssignments = assignments.filter((a) => a.user_id === userId);
  const userDenies = denies.filter((d) => d.user_id === userId);
  const userExceptions = exceptions.filter(
    (e) => e.user_id === userId && !e.revoked_at && new Date(e.expires_at) > new Date(),
  );
  const isCeoView = perms.some((p) => p.source === "ceo");

  const options = [
    ...(users.some((u) => u.id === me) ? [] : [{ value: me, label: "Yo" }]),
    ...users.map((u) => ({ value: u.id, label: userLabel(u) + (u.id === me ? " (yo)" : "") })),
  ];

  return (
    <div className="space-y-6">
      <Section title="Permisos efectivos de un usuario">
        <div className="mb-4 max-w-md">
          <SelectField
            label="Usuario"
            value={userId}
            onChange={setUserId}
            placeholder="Selecciona un usuario"
            options={options}
          />
        </div>
        <ReadOnlyNote>
          Resultado calculado por el servidor: roles vigentes, sin conflictos de funciones
          pendientes, sin denegaciones y con departamentos activos. Sin filas = sin acceso
          (denegación por defecto). Los cargos no aparecen aquí porque no conceden permisos.
        </ReadOnlyNote>
      </Section>

      {conflicts.length > 0 && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
        >
          <div className="mb-1 flex items-center gap-2 font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Conflicto de funciones sin excepción vigente
          </div>
          <p className="text-xs text-muted-foreground">
            Por seguridad (fail-closed), los roles en conflicto{" "}
            <b>no están otorgando ningún permiso</b> hasta que se revoque uno o el CEO apruebe una
            excepción acotada.
          </p>
          <ul className="mt-2 list-disc pl-5 text-xs">
            {conflicts.map((c) => (
              <li key={c.rule_id}>
                {roleName(c.role_a_id)} ⟷ {roleName(c.role_b_id)} ({c.severity}): {c.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Section title="Roles asignados y vigencia">
        {isCeoView ? (
          <Empty>
            El CEO actúa con su facultad global (todo salvo «auditar», que exige un rol de auditoría
            explícito).
          </Empty>
        ) : userAssignments.length === 0 ? (
          <Empty>Sin roles asignados (o fuera de tu alcance de consulta).</Empty>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {userAssignments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 rounded border px-3 py-2">
                <span className="font-medium">{roleName(a.role_id)}</span>
                <AssignmentBadge status={assignmentStatus(a)} />
                <span className="text-xs text-muted-foreground">
                  {deptName(a.department_id) ? `${deptName(a.department_id)} · ` : ""}desde{" "}
                  {fmtDate(a.valid_from)}
                  {a.valid_until ? ` hasta ${fmtDate(a.valid_until)}` : " sin vencimiento"}
                </span>
              </li>
            ))}
          </ul>
        )}
        {userExceptions.length > 0 && (
          <div className="mt-3 border-t pt-3 text-xs">
            <div className="mb-1 uppercase tracking-wider text-muted-foreground">
              Excepciones de separación de funciones vigentes
            </div>
            <ul className="space-y-1">
              {userExceptions.map((e) => (
                <li key={e.id} className="rounded border px-2 py-1">
                  Vence {fmtDate(e.expires_at)} · {e.justification}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section title="Denegaciones individuales">
        {userDenies.length === 0 ? (
          <Empty>No hay permisos denegados individualmente a esta persona.</Empty>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {userDenies.map((d) => {
              const def = defs.find((x) => x.id === d.permission_id);
              return (
                <li
                  key={d.permission_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2"
                >
                  <div>
                    <span className="font-medium">
                      {def
                        ? `${resName(def.resource)} · ${ACTION_LABELS[def.action]} · ${SCOPE_LABELS[def.scope]}`
                        : d.permission_id}
                    </span>
                    <div className="text-xs text-muted-foreground">
                      Desde {fmtDate(d.created_at)} · «{d.reason}»
                    </div>
                  </div>
                  {canDeny && def && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTarget({ kind: "lift", permissionId: def.id })}
                    >
                      <Undo2 className="mr-1 h-4 w-4" />
                      Levantar
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Permisos vigentes">
        <Input
          className="mb-3 max-w-xs"
          placeholder="Filtrar por recurso, acción o rol…"
          aria-label="Filtrar permisos"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {isLoading ? (
          <p role="status" className="text-sm text-muted-foreground">
            Calculando…
          </p>
        ) : error ? (
          <Empty>No tienes autoridad para ver los permisos de este usuario.</Empty>
        ) : sorted.length === 0 ? (
          <Empty>Esta persona no tiene permisos efectivos.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recurso</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Alcance</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Vigencia</TableHead>
                  <TableHead>Restricciones</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((p, i) => {
                  const id = defId(p);
                  return (
                    <PermissionRow
                      key={`${p.resource}-${p.action}-${p.scope}-${p.assignment_id ?? p.source}-${i}`}
                      p={p}
                      resName={resName}
                      deptName={deptName}
                      until={
                        p.assignment_id
                          ? (assignmentById.get(p.assignment_id)?.valid_until ?? null)
                          : null
                      }
                      onDeny={
                        canDeny && p.source === "rol" && id
                          ? () => setTarget({ kind: "deny", permissionId: id })
                          : undefined
                      }
                    />
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      <ReasonDialog
        open={!!target}
        onClose={() => setTarget(null)}
        destructive={target?.kind === "deny"}
        busy={act.busy}
        title={target?.kind === "deny" ? "Denegar permiso" : "Levantar denegación"}
        description={
          target?.kind === "deny"
            ? "La denegación gana sobre cualquier rol y se aplica en la siguiente operación. Queda registrada."
            : "El permiso volverá a aplicarse si algún rol vigente lo otorga."
        }
        confirmLabel={target?.kind === "deny" ? "Denegar" : "Levantar"}
        onConfirm={(reason) =>
          !userId || !target ? Promise.resolve(false) : act.run({
            userId: userId,
            permissionId: target.permissionId,
            deny: target.kind === "deny",
            reason,
          })
        }
      />
    </div>
  );
}

function PermissionRow({
  p,
  resName,
  deptName,
  until,
  onDeny,
}: {
  p: EffectivePermission;
  resName: (c: string) => string;
  deptName: (id: string | null) => string | undefined;
  until: string | null;
  onDeny?: (() => void) | undefined;
}) {
  return (
    <TableRow>
      <TableCell>{resName(p.resource)}</TableCell>
      <TableCell>{ACTION_LABELS[p.action]}</TableCell>
      <TableCell>
        {SCOPE_LABELS[p.scope]}
        {p.department_id && (
          <span className="ml-1 text-xs text-muted-foreground">({deptName(p.department_id)})</span>
        )}
      </TableCell>
      <TableCell>
        {p.source === "ceo" ? <Badge>CEO</Badge> : <Badge variant="secondary">{p.role_name}</Badge>}
      </TableCell>
      <TableCell className="whitespace-nowrap text-xs">
        {p.source === "ceo" ? "Permanente" : until ? `Hasta ${fmtDate(until)}` : "Sin vencimiento"}
      </TableCell>
      <TableCell>
        {p.require_mfa ? (
          <Badge variant="outline">
            <Lock className="mr-1 h-3 w-3" />
            MFA (aal2)
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        {onDeny && (
          <Button
            size="icon"
            variant="ghost"
            title="Denegar este permiso a la persona"
            onClick={onDeny}
          >
            <Ban className="h-4 w-4" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
