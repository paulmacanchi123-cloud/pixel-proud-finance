import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRightLeft, ShieldCheck, UserPlus } from "lucide-react";
import { Section, Empty } from "@/components/iris/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isPrivilegedRole, sodConflicts, unresolvedConflicts } from "@/lib/org/authz";
import {
  assignPosition,
  assignRole,
  createSodException,
  endPosition,
  revokeRole,
  revokeSodException,
} from "@/lib/org/org.functions";
import {
  useDepartments,
  useOrgUsers,
  usePermissionDefs,
  usePositionAssignments,
  usePositionRoles,
  usePositions,
  useRoleAssignments,
  useRolePermissions,
  useRoles,
  useSodExceptions,
  useSodRules,
} from "@/lib/org/org.queries";
import { MoveDepartmentDialog, UserHistory } from "./UserDepartmentAndHistory";
import {
  FilterSelect,
  ReadOnlyNote,
  ReasonDialog,
  SelectField,
  TextField,
  fmtDate,
  useAccess,
  useAct,
  userLabel,
} from "./shared";

const isCurrent = (a: {
  revoked_at: string | null;
  valid_until: string | null;
  valid_from: string;
}) =>
  !a.revoked_at &&
  new Date(a.valid_from) <= new Date() &&
  (!a.valid_until || new Date(a.valid_until) > new Date());

export function UserAssignments() {
  const { can, isCeo, userId: me } = useAccess();
  const canRoles = can("roles", "administrar");
  const canPositions = can("cargos", "administrar");
  const { data: users = [], error: usersError, isLoading: usersLoading } = useOrgUsers();
  const { data: depts = [] } = useDepartments();
  const { data: roles = [] } = useRoles();
  const { data: positions = [] } = usePositions();
  const { data: posRoles = [] } = usePositionRoles();
  const { data: rolePerms = [] } = useRolePermissions();
  const { data: defs = [] } = usePermissionDefs();
  const { data: roleAssigns = [] } = useRoleAssignments();
  const { data: posAssigns = [] } = usePositionAssignments();
  const { data: rules = [] } = useSodRules();
  const { data: exceptions = [] } = useSodExceptions();
  const [q, setQ] = useState("");
  const [deptFilter, setDeptFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [moveDialog, setMoveDialog] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [roleDialog, setRoleDialog] = useState(false);
  const [posDialog, setPosDialog] = useState(false);
  const [revoke, setRevoke] = useState<{
    kind: "role" | "pos" | "exc";
    id: string;
    label: string;
  } | null>(null);
  const [excDialog, setExcDialog] = useState(false);

  const revokeAct = useAct<unknown>(revokeRole, "Rol revocado");
  const endAct = useAct<unknown>(endPosition, "Cargo finalizado");
  const excRevokeAct = useAct<unknown>(revokeSodException, "Excepción revocada");

  const filtered = useMemo(
    () =>
      users.filter(
        (u) =>
          `${u.full_name} ${u.email}`.toLowerCase().includes(q.toLowerCase()) &&
          (deptFilter === "todos" ||
            (deptFilter === "ninguno" ? !u.department_id : u.department_id === deptFilter)) &&
          (statusFilter === "todos" || u.status === statusFilter),
      ),
    [users, q, deptFilter, statusFilter],
  );
  const user = users.find((u) => u.id === selected) ?? null;
  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? "—";
  const posName = (id: string) => positions.find((p) => p.id === id)?.name ?? "—";
  const deptName = (id: string | null) => depts.find((d) => d.id === id)?.name ?? "—";

  const myRoles = roleAssigns.filter((a) => a.user_id === selected);
  const currentRoles = myRoles.filter(isCurrent);
  const myPositions = posAssigns.filter((a) => a.user_id === selected);
  const myExceptions = exceptions.filter(
    (e) => e.user_id === selected && !e.revoked_at && new Date(e.expires_at) > new Date(),
  );
  const conflicts = unresolvedConflicts(
    currentRoles.map((a) => a.role_id),
    rules,
    exceptions.filter((e) => e.user_id === selected),
  );

  if (usersLoading)
    return (
      <p role="status" className="p-4 text-sm text-muted-foreground">
        Cargando usuarios…
      </p>
    );
  if (usersError)
    return (
      <Section title="Usuarios y asignaciones">
        <Empty>No tienes permiso para consultar usuarios.</Empty>
      </Section>
    );

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
      <Section title="Usuarios">
        <Input
          placeholder="Buscar nombre o correo…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar usuario"
          className="mb-3"
        />
        <div className="mb-3 flex flex-wrap gap-2">
          <FilterSelect
            label="Departamento"
            value={deptFilter}
            onChange={setDeptFilter}
            options={[
              ["todos", "Todos"],
              ["ninguno", "Sin departamento"],
              ...depts.map((d): [string, string] => [d.id, d.name]),
            ]}
          />
          <FilterSelect
            label="Estado"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              ["todos", "Todos"],
              ["active", "Activos"],
              ["suspended", "Suspendidos"],
              ["disabled", "Desactivados"],
            ]}
          />
        </div>
        <p className="mb-2 text-xs text-muted-foreground" role="status">
          {filtered.length} de {users.length} usuarios
        </p>
        <ul className="max-h-[32rem] space-y-1 overflow-y-auto">
          {filtered.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => setSelected(u.id)}
                className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${selected === u.id ? "border-primary bg-primary/5" : "hover:bg-muted/60"}`}
              >
                <div className="font-medium">{userLabel(u)}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {u.email} · {deptName(u.department_id)}
                </div>
                {u.status !== "active" && (
                  <Badge variant="secondary" className="mt-1">
                    {u.status === "suspended" ? "Suspendida" : "Desactivada"}
                  </Badge>
                )}
              </button>
            </li>
          ))}
          {filtered.length === 0 && <Empty>Sin usuarios.</Empty>}
        </ul>
      </Section>

      {!user ? (
        <Section title="Detalle">
          <Empty>Selecciona un usuario para ver y gestionar sus cargos y roles.</Empty>
        </Section>
      ) : (
        <div className="space-y-6">
          <Section
            title={userLabel(user)}
            right={
              isCeo &&
              user.id !== me && (
                <Button size="sm" variant="outline" onClick={() => setMoveDialog(true)}>
                  <ArrowRightLeft className="mr-1 h-4 w-4" />
                  Cambiar departamento
                </Button>
              )
            }
          >
            <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Correo</dt>
                <dd>{user.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Departamento</dt>
                <dd>{deptName(user.department_id)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Estado de la cuenta</dt>
                <dd>
                  {user.status === "active"
                    ? "Activa"
                    : user.status === "suspended"
                      ? "Suspendida"
                      : "Desactivada"}
                </dd>
              </div>
            </dl>
            {!isCeo && (
              <ReadOnlyNote>El departamento de una persona solo lo cambia el CEO.</ReadOnlyNote>
            )}
          </Section>

          {conflicts.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <div className="mb-1 flex items-center gap-2 font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Conflicto de funciones sin excepción vigente
              </div>
              <p className="text-xs text-muted-foreground">
                Por seguridad (fail-closed) los roles involucrados{" "}
                <b>no están otorgando permisos</b> hasta que se revoque uno o el CEO apruebe una
                excepción acotada.
              </p>
              <ul className="mt-2 list-disc pl-5 text-xs">
                {conflicts.map((c) => (
                  <li key={c.id}>
                    {roleName(c.role_a_id)} ⟷ {roleName(c.role_b_id)}: {c.description}
                  </li>
                ))}
              </ul>
              {isCeo && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => setExcDialog(true)}
                >
                  Aprobar excepción temporal
                </Button>
              )}
            </div>
          )}

          <Section
            title={`Cargos de ${userLabel(user)}`}
            right={
              canPositions &&
              user.id !== me &&
              user.status === "active" && (
                <Button size="sm" onClick={() => setPosDialog(true)}>
                  <UserPlus className="mr-1 h-4 w-4" />
                  Asignar cargo
                </Button>
              )
            }
          >
            {myPositions.length === 0 ? (
              <Empty>Sin cargos asignados.</Empty>
            ) : (
              <ul className="space-y-2">
                {myPositions.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">{posName(a.position_id)}</span>
                      {a.is_primary && <Badge className="ml-2">Principal</Badge>}
                      {a.ended_at && (
                        <Badge variant="secondary" className="ml-2">
                          Finalizado
                        </Badge>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {deptName(a.department_id)} · desde {fmtDate(a.starts_at)}
                        {a.ends_at ? ` hasta ${fmtDate(a.ends_at)}` : ""}
                        {a.end_reason ? ` · ${a.end_reason}` : ""}
                      </div>
                    </div>
                    {!a.ended_at && canPositions && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setRevoke({ kind: "pos", id: a.id, label: posName(a.position_id) })
                        }
                      >
                        Finalizar
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Roles y permisos"
            right={
              canRoles &&
              user.id !== me &&
              user.status === "active" && (
                <Button size="sm" onClick={() => setRoleDialog(true)}>
                  <ShieldCheck className="mr-1 h-4 w-4" />
                  Asignar rol
                </Button>
              )
            }
          >
            {user.id === me && (
              <ReadOnlyNote>No puedes modificar tus propios cargos ni roles.</ReadOnlyNote>
            )}
            {myRoles.length === 0 ? (
              <Empty>
                Sin roles asignados. Sin roles, la persona no tiene acceso a nada (denegación por
                defecto).
              </Empty>
            ) : (
              <ul className="mt-2 space-y-2">
                {myRoles.map((a) => {
                  const role = roles.find((r) => r.id === a.role_id);
                  const priv = role ? isPrivilegedRole(role, rolePerms, defs) : false;
                  const cur = isCurrent(a);
                  return (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 text-sm"
                    >
                      <div>
                        <span className="font-medium">{roleName(a.role_id)}</span>
                        {priv && (
                          <Badge variant="outline" className="ml-2">
                            Privilegiado
                          </Badge>
                        )}
                        {a.revoked_at ? (
                          <Badge variant="secondary" className="ml-2">
                            Revocado
                          </Badge>
                        ) : !cur ? (
                          <Badge variant="secondary" className="ml-2">
                            Fuera de vigencia
                          </Badge>
                        ) : (
                          <Badge className="ml-2 bg-success/15 text-success hover:bg-success/15">
                            Vigente
                          </Badge>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {a.department_id ? `${deptName(a.department_id)} · ` : ""}desde{" "}
                          {fmtDate(a.valid_from)}
                          {a.valid_until ? ` hasta ${fmtDate(a.valid_until)}` : ""} · «
                          {a.justification}»
                          {a.revoke_reason ? ` · revocado: ${a.revoke_reason}` : ""}
                        </div>
                      </div>
                      {cur && canRoles && (isCeo || !priv) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setRevoke({ kind: "role", id: a.id, label: roleName(a.role_id) })
                          }
                        >
                          Revocar
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {myExceptions.length > 0 && (
              <div className="mt-4 border-t pt-3">
                <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                  Excepciones de separación de funciones vigentes
                </div>
                <ul className="space-y-1 text-xs">
                  {myExceptions.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center justify-between gap-2 rounded border px-2 py-1"
                    >
                      <span>
                        Vence {fmtDate(e.expires_at)} · {e.justification}
                      </span>
                      {isCeo && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRevoke({ kind: "exc", id: e.id, label: "excepción" })}
                        >
                          Revocar
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          <Section title="Historial de cambios de esta persona">
            <UserHistory userId={user.id} />
          </Section>
        </div>
      )}

      {user && (
        <AssignRoleDialog
          open={roleDialog}
          onClose={() => setRoleDialog(false)}
          userId={user.id}
          userDept={user.department_id}
          heldRoleIds={currentRoles.map((a) => a.role_id)}
          suggestedRoleIds={[
            ...new Set(
              myPositions
                .filter((p) => !p.ended_at)
                .flatMap((p) =>
                  posRoles.filter((r) => r.position_id === p.position_id).map((r) => r.role_id),
                ),
            ),
          ]}
        />
      )}
      {user && (
        <AssignPositionDialog
          open={posDialog}
          onClose={() => setPosDialog(false)}
          userId={user.id}
          userDept={user.department_id}
        />
      )}
      {user && (
        <ExceptionDialog
          open={excDialog}
          onClose={() => setExcDialog(false)}
          userId={user.id}
          ruleIds={conflicts.map((c) => c.id)}
        />
      )}

      {user && (
        <MoveDepartmentDialog user={user} open={moveDialog} onClose={() => setMoveDialog(false)} />
      )}

      <ReasonDialog
        open={!!revoke}
        onClose={() => setRevoke(null)}
        destructive
        busy={revokeAct.busy || endAct.busy || excRevokeAct.busy}
        title={revoke ? `${revoke.kind === "pos" ? "Finalizar" : "Revocar"} «${revoke.label}»` : ""}
        description={
          revoke?.kind === "role" ? "La revocación es efectiva de inmediato." : undefined
        }
        confirmLabel={revoke?.kind === "pos" ? "Finalizar" : "Revocar"}
        onConfirm={(reason) =>
          !revoke ? Promise.resolve(false) : revoke.kind === "role"
            ? revokeAct.run({ assignmentId: revoke.id, reason })
            : revoke.kind === "pos"
              ? endAct.run({ assignmentId: revoke.id, reason })
              : excRevokeAct.run({ id: revoke.id, reason })
        }
      />
    </div>
  );
}

function AssignRoleDialog({
  open,
  onClose,
  userId,
  userDept,
  heldRoleIds,
  suggestedRoleIds,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  userDept: string | null;
  heldRoleIds: string[];
  suggestedRoleIds: string[];
}) {
  const { isCeo } = useAccess();
  const { data: roles = [] } = useRoles();
  const { data: depts = [] } = useDepartments();
  const { data: rolePerms = [] } = useRolePermissions();
  const { data: defs = [] } = usePermissionDefs();
  const { data: rules = [] } = useSodRules();
  const { data: exceptions = [] } = useSodExceptions();
  const act = useAct<unknown>(assignRole, "Rol asignado");
  const [roleId, setRoleId] = useState<string | null>(null);
  const [deptId, setDeptId] = useState<string | null>(null);
  const [until, setUntil] = useState("");
  const [why, setWhy] = useState("");

  const role = roles.find((r) => r.id === roleId) ?? null;
  const priv = role ? isPrivilegedRole(role, rolePerms, defs) : false;
  const hasDeptScope =
    !!role &&
    rolePerms.some(
      (rp) =>
        rp.role_id === role.id &&
        defs.find((d) => d.id === rp.permission_id)?.scope === "departamento",
    );
  const conflicts = role
    ? sodConflicts(
        heldRoleIds,
        [role.id],
        rules,
        exceptions.filter((e) => e.user_id === userId),
      )
    : [];
  const blocked = (priv && !isCeo) || conflicts.length > 0;
  const untilIso = until ? new Date(`${until}T23:59:59`).toISOString() : null;
  const valid =
    !!role && !blocked && why.trim().length >= 10 && (!until || new Date(untilIso ?? "") > new Date());
  const reset = () => {
    setRoleId(null);
    setDeptId(null);
    setUntil("");
    setWhy("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Asignar rol</DialogTitle>
          <DialogDescription>
            Concede permisos efectivos. Queda registrado con tu justificación.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {suggestedRoleIds.length > 0 && (
            <div className="text-xs">
              <span className="text-muted-foreground">Sugeridos por sus cargos: </span>
              {suggestedRoleIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRoleId(id)}
                  className="mr-1 rounded border px-2 py-0.5 hover:bg-muted"
                >
                  {roles.find((r) => r.id === id)?.name}
                </button>
              ))}
            </div>
          )}
          <SelectField
            label="Rol"
            value={roleId}
            onChange={setRoleId}
            placeholder="Selecciona un rol"
            options={roles
              .filter((r) => r.is_active)
              .map((r) => ({
                value: r.id,
                label: r.name,
                disabled: !isCeo && isPrivilegedRole(r, rolePerms, defs),
              }))}
          />
          {role && <p className="text-xs text-muted-foreground">{role.description}</p>}
          {priv && !isCeo && (
            <p className="text-xs text-destructive">
              Rol privilegiado: solo el CEO puede asignarlo.
            </p>
          )}
          {conflicts.map((c) => (
            <p
              key={c.id}
              className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive"
            >
              Conflicto de funciones ({c.severity}): {c.description}. Requiere una excepción del
              CEO.
            </p>
          ))}
          {hasDeptScope && (
            <SelectField
              label="Departamento de aplicación"
              value={deptId ?? userDept}
              onChange={setDeptId}
              placeholder="Usar departamento del usuario"
              options={depts
                .filter((d) => d.is_active)
                .map((d) => ({ value: d.id, label: d.name }))}
            />
          )}
          <TextField
            label="Vigente hasta (opcional; para sustituciones y delegaciones)"
            type="date"
            value={until}
            onChange={setUntil}
          />
          <div className="space-y-1.5">
            <Label>Justificación (mín. 10 caracteres)</Label>
            <Textarea
              rows={3}
              maxLength={500}
              value={why}
              onChange={(e) => setWhy(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancelar
          </Button>
          <Button
            disabled={!valid || act.busy}
            onClick={async () => {
              if (!role) return;
              if (
                await act.run({
                  userId,
                  roleId: role.id,
                  departmentId: hasDeptScope ? (deptId ?? userDept) : null,
                  validUntil: untilIso,
                  justification: why.trim(),
                })
              ) {
                reset();
                onClose();
              }
            }}
          >
            Asignar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignPositionDialog({
  open,
  onClose,
  userId,
  userDept,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  userDept: string | null;
}) {
  const { data: positions = [] } = usePositions();
  const { data: depts = [] } = useDepartments();
  const act = useAct<unknown>(assignPosition, "Cargo asignado");
  const [positionId, setPositionId] = useState<string | null>(null);
  const [deptId, setDeptId] = useState<string | null>(null);
  const [primary, setPrimary] = useState(false);
  const [endsAt, setEndsAt] = useState("");
  const [why, setWhy] = useState("");
  const reset = () => {
    setPositionId(null);
    setDeptId(null);
    setPrimary(false);
    setEndsAt("");
    setWhy("");
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar cargo</DialogTitle>
          <DialogDescription>
            El cargo define autoridad organizacional; no concede permisos. Una persona puede tener
            más de un cargo si sus funciones no entran en conflicto.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <SelectField
            label="Cargo"
            value={positionId}
            onChange={(v) => {
              setPositionId(v);
              setDeptId(positions.find((p) => p.id === v)?.department_id ?? userDept);
            }}
            placeholder="Selecciona un cargo"
            options={positions
              .filter((p) => p.is_active)
              .map((p) => ({ value: p.id, label: p.name }))}
          />
          <SelectField
            label="Departamento del cargo"
            value={deptId}
            onChange={setDeptId}
            placeholder="Según el cargo"
            options={depts.filter((d) => d.is_active).map((d) => ({ value: d.id, label: d.name }))}
          />
          <TextField
            label="Fecha de fin (opcional)"
            type="date"
            value={endsAt}
            onChange={setEndsAt}
          />
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={primary} onCheckedChange={setPrimary} />
            Cargo principal
          </label>
          <div className="space-y-1.5">
            <Label>Motivo</Label>
            <Textarea rows={2} value={why} onChange={(e) => setWhy(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancelar
          </Button>
          <Button
            disabled={!positionId || why.trim().length < 5 || act.busy}
            onClick={async () => {
              if (!positionId) return;
              if (
                await act.run({
                  userId,
                  positionId,
                  departmentId: deptId,
                  isPrimary: primary,
                  endsAt: endsAt || null,
                  reason: why.trim(),
                })
              ) {
                reset();
                onClose();
              }
            }}
          >
            Asignar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExceptionDialog({
  open,
  onClose,
  userId,
  ruleIds,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  ruleIds: string[];
}) {
  const { data: rules = [] } = useSodRules();
  const { data: roles = [] } = useRoles();
  const act = useAct<unknown>(createSodException, "Excepción aprobada");
  const [ruleId, setRuleId] = useState<string | null>(null);
  const [days, setDays] = useState("7");
  const [why, setWhy] = useState("");
  const n = Number(days);
  const nm = (id: string) => roles.find((r) => r.id === id)?.name ?? id;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excepción temporal de separación de funciones</DialogTitle>
          <DialogDescription>
            Solo el CEO. Máximo 90 días, justificada y auditada; al vencer, los roles en conflicto
            vuelven a bloquearse.
          </DialogDescription>
        </DialogHeader>
        <SelectField
          label="Regla a exceptuar"
          value={ruleId}
          onChange={setRuleId}
          placeholder="Selecciona la regla"
          options={rules
            .filter((r) => ruleIds.includes(r.id))
            .map((r) => ({ value: r.id, label: `${nm(r.role_a_id)} ⟷ ${nm(r.role_b_id)}` }))}
        />
        <TextField
          label="Vigencia en días (1-90)"
          type="number"
          min={1}
          max={90}
          value={days}
          onChange={setDays}
        />
        <div className="space-y-1.5">
          <Label>Justificación (mín. 20 caracteres)</Label>
          <Textarea rows={3} value={why} onChange={(e) => setWhy(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!ruleId || why.trim().length < 20 || !(n >= 1 && n <= 90) || act.busy}
            onClick={async () => {
              if (await act.run({ userId, ruleId, justification: why.trim(), days: n })) {
                setWhy("");
                setRuleId(null);
                onClose();
              }
            }}
          >
            Aprobar excepción
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
