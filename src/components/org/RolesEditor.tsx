import { useMemo, useState } from "react";
import { Lock, LockOpen, Pencil, Plus, Power, ShieldAlert, Users } from "lucide-react";
import { Section, Empty } from "@/components/iris/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { assignmentStatus, isPrivilegedRole } from "@/lib/org/authz";
import { setRoleActive, setRolePermission, upsertRole } from "@/lib/org/org.functions";
import {
  useDepartments,
  useOrgUsers,
  usePermissionDefs,
  useResources,
  useRoleAssignments,
  useRolePermissions,
  useRoles,
  useSodRules,
} from "@/lib/org/org.queries";
import {
  ACTION_LABELS,
  ORG_ACTIONS,
  SCOPE_LABELS,
  type OrgRole,
  type OrgScope,
} from "@/lib/org/types";
import { RoleUsersDialog } from "./RoleUsersDialog";
import {
  ActiveBadge,
  FilterSelect,
  QueryBoundary,
  ReadOnlyNote,
  ReasonDialog,
  SelectField,
  TextField,
  useAccess,
  useAct,
} from "./shared";

type Draft = {
  id: string | null;
  code: string;
  name: string;
  description: string;
  isPrivileged: boolean;
};
const empty: Draft = { id: null, code: "", name: "", description: "", isPrivileged: false };

export function RolesEditor({ onOpenMatrix }: { onOpenMatrix: (roleId: string) => void }) {
  const { can, isCeo } = useAccess();
  const canAdmin = can("roles", "administrar");
  const rolesQ = useRoles();
  const { data: roles = [] } = rolesQ;
  const permsQ = useRolePermissions();
  const { data: rolePerms = [] } = permsQ;
  const { data: defs = [] } = usePermissionDefs();
  const { data: rules = [] } = useSodRules();
  const { data: assignments = [] } = useRoleAssignments();
  const { data: users = [] } = useOrgUsers();
  const { data: depts = [] } = useDepartments();
  const [q, setQ] = useState("");
  const [state, setState] = useState<"todos" | "activos" | "inactivos">("todos");
  const [kind, setKind] = useState<"todos" | "privilegiados" | "sistema" | "personalizados">(
    "todos",
  );
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toggle, setToggle] = useState<OrgRole | null>(null);
  const [usersFor, setUsersFor] = useState<OrgRole | null>(null);
  const save = useAct<unknown>(upsertRole, "Rol guardado");
  const active = useAct<unknown>(setRoleActive, "Estado actualizado");

  const privileged = (r: OrgRole) => isPrivilegedRole(r, rolePerms, defs);
  const rows = useMemo(
    () =>
      roles.filter((r) => {
        if (!`${r.name} ${r.code}`.toLowerCase().includes(q.toLowerCase())) return false;
        if (state === "activos" && !r.is_active) return false;
        if (state === "inactivos" && r.is_active) return false;
        if (kind === "privilegiados" && !isPrivilegedRole(r, rolePerms, defs)) return false;
        if (kind === "sistema" && !r.is_system) return false;
        if (kind === "personalizados" && r.is_system) return false;
        return true;
      }),
    [roles, q, state, kind, rolePerms, defs],
  );
  const count = (id: string) => rolePerms.filter((p) => p.role_id === id).length;
  const holders = (id: string) =>
    assignments.filter((a) => a.role_id === id && assignmentStatus(a) === "vigente").length;
  const conflicts = (id: string) =>
    rules.filter((r) => r.is_active && (r.role_a_id === id || r.role_b_id === id)).length;
  const lockedFor = (r: OrgRole) => !isCeo && (r.is_system || privileged(r));
  const errors: string[] = [];
  if (draft) {
    if (!/^[a-z0-9_]{3,50}$/.test(draft.code)) errors.push("Código: a-z, 0-9 y _ (3-50).");
    if (draft.name.trim().length < 2) errors.push("Nombre: mínimo 2 caracteres.");
  }

  return (
    <Section
      title="Roles"
      right={
        canAdmin && (
          <Button size="sm" onClick={() => setDraft(empty)}>
            <Plus className="mr-1 h-4 w-4" />
            Nuevo rol
          </Button>
        )
      }
    >
      <ReadOnlyNote>
        Los roles agrupan permisos (recurso · acción · alcance). Los roles con poder de{" "}
        <strong>administrar, aprobar o auditar</strong> son privilegiados: solo el CEO los crea,
        edita y asigna. Los roles en conflicto de funciones no pueden coexistir sin una excepción
        vigente aprobada por el CEO.
      </ReadOnlyNote>
      <div className="my-3 flex flex-wrap items-end gap-3">
        <Input
          className="max-w-xs"
          placeholder="Buscar rol…"
          aria-label="Buscar rol"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <FilterSelect
          label="Estado"
          value={state}
          onChange={(v) => setState(v as typeof state)}
          options={[
            ["todos", "Todos"],
            ["activos", "Activos"],
            ["inactivos", "Inactivos"],
          ]}
        />
        <FilterSelect
          label="Tipo"
          value={kind}
          onChange={(v) => setKind(v as typeof kind)}
          options={[
            ["todos", "Todos"],
            ["privilegiados", "Privilegiados"],
            ["sistema", "Del sistema"],
            ["personalizados", "Personalizados"],
          ]}
        />
      </div>
      <QueryBoundary queries={[rolesQ, permsQ]}>
        {rows.length === 0 ? (
          <Empty>Sin resultados o sin permiso para ver roles.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rol</TableHead>
                  <TableHead>Permisos</TableHead>
                  <TableHead>Personas</TableHead>
                  <TableHead>Incompatibilidades</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">
                        {r.name}
                        {privileged(r) && (
                          <Badge variant="outline" className="ml-1">
                            <ShieldAlert className="mr-1 h-3 w-3" />
                            Privilegiado
                          </Badge>
                        )}
                        {r.is_system && (
                          <Badge variant="secondary" className="ml-1">
                            Sistema
                          </Badge>
                        )}
                      </div>
                      <div className="max-w-md text-xs text-muted-foreground">{r.description}</div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="link"
                        className="h-auto p-0"
                        onClick={() => onOpenMatrix(r.id)}
                      >
                        {count(r.id)} permisos · ver matriz
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button variant="link" className="h-auto p-0" onClick={() => setUsersFor(r)}>
                        {holders(r.id)} vigente(s)
                      </Button>
                    </TableCell>
                    <TableCell>
                      {conflicts(r.id) > 0 ? (
                        <Badge variant="outline">{conflicts(r.id)} reglas</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <ActiveBadge active={r.is_active} />
                    </TableCell>
                    <TableCell className="space-x-1 text-right whitespace-nowrap">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Personas con este rol"
                        onClick={() => setUsersFor(r)}
                      >
                        <Users className="h-4 w-4" />
                      </Button>
                      {canAdmin && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Editar"
                            disabled={lockedFor(r)}
                            onClick={() =>
                              setDraft({
                                id: r.id,
                                code: r.code,
                                name: r.name,
                                description: r.description,
                                isPrivileged: r.is_privileged,
                              })
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title={r.is_active ? "Desactivar (revoca de inmediato)" : "Activar"}
                            disabled={lockedFor(r)}
                            onClick={() => setToggle(r)}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryBoundary>

      <RoleUsersDialog
        role={usersFor}
        assignments={assignments}
        users={users}
        departments={depts}
        onClose={() => setUsersFor(null)}
      />

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar rol" : "Nuevo rol"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <TextField
                label="Nombre"
                value={draft.name}
                onChange={(v) => setDraft({ ...draft, name: v })}
                maxLength={120}
              />
              <TextField
                label="Código (identificador estable)"
                value={draft.code}
                disabled={!!draft.id && roles.find((r) => r.id === draft.id)?.is_system}
                onChange={(v) =>
                  setDraft({ ...draft, code: v.toLowerCase().replace(/[^a-z0-9_]/g, "") })
                }
                maxLength={50}
              />
              <div className="space-y-1.5">
                <Label>Descripción</Label>
                <Textarea
                  rows={2}
                  maxLength={600}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>
              <label className={`flex items-center gap-2 text-sm ${isCeo ? "" : "opacity-50"}`}>
                <Switch
                  disabled={!isCeo}
                  checked={draft.isPrivileged}
                  onCheckedChange={(v) => setDraft({ ...draft, isPrivileged: v })}
                />
                Rol privilegiado (solo el CEO puede asignarlo)
              </label>
              {errors.map((e) => (
                <p key={e} className="text-xs text-destructive">
                  {e}
                </p>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!draft || errors.length > 0 || save.busy}
              onClick={async () => {
                if (draft && (await save.run(draft))) setDraft(null);
              }}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReasonDialog
        open={!!toggle}
        onClose={() => setToggle(null)}
        busy={active.busy}
        destructive={!!toggle?.is_active}
        title={toggle?.is_active ? `Desactivar «${toggle?.name}»` : `Activar «${toggle?.name}»`}
        description={
          toggle?.is_active
            ? `Las ${holders(toggle.id)} persona(s) con este rol pierden de inmediato los permisos que les otorga.`
            : undefined
        }
        confirmLabel={toggle?.is_active ? "Desactivar" : "Activar"}
        onConfirm={(reason) => toggle ? active.run({ id: toggle.id, active: !toggle.is_active, reason }) : Promise.resolve(false)}
      />
    </Section>
  );
}

const SCOPE_SHORT: Record<OrgScope, string> = { global: "G", departamento: "D", propio: "P" };

/** Matriz recurso × acción de un rol. Cada celda muestra los alcances válidos (G global · D departamental · P propios). */
export function PermissionMatrix({
  roleId,
  onRoleChange,
}: {
  roleId: string | null;
  onRoleChange: (id: string | null) => void;
}) {
  const { can, isCeo } = useAccess();
  const { data: roles = [] } = useRoles();
  const { data: resources = [] } = useResources();
  const { data: defs = [] } = usePermissionDefs();
  const { data: rolePerms = [] } = useRolePermissions();
  const act = useAct<unknown>(setRolePermission, "Permiso actualizado");
  const role = roles.find((r) => r.id === roleId) ?? null;
  const priv = role ? isPrivilegedRole(role, rolePerms, defs) : false;
  const canEditRole =
    !!role && can("permisos", "administrar") && (isCeo || (!role.is_system && !priv));
  const mine = new Map(
    rolePerms.filter((p) => p.role_id === roleId).map((p) => [p.permission_id, p]),
  );

  return (
    <Section title="Matriz de permisos por recurso y acción">
      <div className="mb-4 max-w-md">
        <SelectField
          label="Rol"
          value={roleId}
          onChange={onRoleChange}
          placeholder="Selecciona un rol"
          options={roles.map((r) => ({
            value: r.id,
            label: r.name + (r.is_active ? "" : " (inactivo)"),
          }))}
        />
      </div>
      {!role ? (
        <Empty>Selecciona un rol para ver su matriz.</Empty>
      ) : (
        <>
          {!canEditRole && (
            <ReadOnlyNote>
              Matriz en solo lectura
              {role.is_system || priv
                ? ": los roles del sistema o privilegiados solo los edita el CEO"
                : ""}
              .{" "}
              {!isCeo &&
                "Los permisos sensibles (aprobar, exportar, administrar, auditar, eliminar) solo los otorga el CEO."}
            </ReadOnlyNote>
          )}
          <p className="my-2 text-xs text-muted-foreground">
            Alcance: <b>G</b> global · <b>D</b> departamental · <b>P</b> solo registros propios. El
            candado exige MFA (sesión aal2) al usar el permiso. Los cambios se aplican y auditan al
            instante.
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recurso</TableHead>
                  {ORG_ACTIONS.map((a) => (
                    <TableHead key={a} className="text-center">
                      {ACTION_LABELS[a]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {resources.map((res) => (
                  <TableRow key={res.code}>
                    <TableCell className="font-medium">{res.name}</TableCell>
                    {ORG_ACTIONS.map((a) => {
                      const cell = defs.filter((d) => d.resource === res.code && d.action === a);
                      return (
                        <TableCell key={a} className="text-center">
                          {cell.length === 0 ? (
                            <span className="text-muted-foreground">·</span>
                          ) : (
                            <div className="flex justify-center gap-1">
                              {cell
                                .sort((x, y) => x.scope.localeCompare(y.scope))
                                .map((d) => {
                                  const on = mine.get(d.id);
                                  const blocked = !canEditRole || (!isCeo && d.is_sensitive);
                                  return (
                                    <span key={d.id} className="inline-flex items-center">
                                      <button
                                        type="button"
                                        disabled={blocked || act.busy}
                                        title={`${SCOPE_LABELS[d.scope]}${d.is_sensitive ? " · sensible" : ""}`}
                                        onClick={() =>
                                          act.run({
                                            roleId: role.id,
                                            permissionId: d.id,
                                            enabled: !on,
                                            requireMfa: on?.require_mfa ?? false,
                                          })
                                        }
                                        className={`h-6 w-6 rounded border text-xs font-semibold transition-colors disabled:cursor-not-allowed ${on ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"} ${d.is_sensitive ? "ring-1 ring-accent" : ""} ${blocked && !on ? "opacity-40" : ""}`}
                                      >
                                        {SCOPE_SHORT[d.scope]}
                                      </button>
                                      {on && canEditRole && (
                                        <button
                                          type="button"
                                          disabled={blocked || act.busy}
                                          title={
                                            on.require_mfa
                                              ? "Exige MFA (clic para quitar)"
                                              : "Exigir MFA"
                                          }
                                          onClick={() =>
                                            act.run({
                                              roleId: role.id,
                                              permissionId: d.id,
                                              enabled: true,
                                              requireMfa: !on.require_mfa,
                                            })
                                          }
                                          className="-ml-0.5 p-0.5"
                                        >
                                          {on.require_mfa ? (
                                            <Lock className="h-3 w-3 text-primary" />
                                          ) : (
                                            <LockOpen className="h-3 w-3 text-muted-foreground" />
                                          )}
                                        </button>
                                      )}
                                    </span>
                                  );
                                })}
                            </div>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </Section>
  );
}
