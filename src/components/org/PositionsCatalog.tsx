import { useMemo, useState } from "react";
import { KeyRound, Pencil, Plus, Power } from "lucide-react";
import { Section, Empty } from "@/components/iris/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isPrivilegedRole, wouldCreateCycle } from "@/lib/org/authz";
import { setPositionActive, setPositionRoles, upsertPosition } from "@/lib/org/org.functions";
import {
  useDepartments,
  usePermissionDefs,
  usePositionAssignments,
  usePositionRoles,
  usePositions,
  useRolePermissions,
  useRoles,
} from "@/lib/org/org.queries";
import type { Position } from "@/lib/org/types";
import {
  ActiveBadge,
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
  departmentId: string | null;
  reportsToId: string | null;
  responsibilities: string;
  isExternal: boolean;
  sortOrder: number;
};
const empty: Draft = {
  id: null,
  code: "",
  name: "",
  description: "",
  departmentId: null,
  reportsToId: null,
  responsibilities: "",
  isExternal: false,
  sortOrder: 100,
};

export function PositionsCatalog() {
  const { can, isCeo } = useAccess();
  const canAdmin = isCeo && can("cargos", "administrar");
  const positionsQ = usePositions();
  const positions = useMemo(() => positionsQ.data ?? [], [positionsQ.data]);
  const { data: posAssigns = [] } = usePositionAssignments();
  const { data: depts = [] } = useDepartments();
  const { data: roles = [] } = useRoles();
  const { data: posRoles = [] } = usePositionRoles();
  const { data: rolePerms = [] } = useRolePermissions();
  const { data: defs = [] } = usePermissionDefs();
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toggle, setToggle] = useState<Position | null>(null);
  const [rolesFor, setRolesFor] = useState<Position | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const save = useAct<unknown>(upsertPosition, "Cargo guardado");
  const active = useAct<unknown>(setPositionActive, "Estado actualizado");
  const saveRoles = useAct<unknown>(setPositionRoles, "Roles sugeridos actualizados");

  const rows = useMemo(
    () =>
      positions.filter(
        (p) =>
          (showInactive || p.is_active) &&
          `${p.name} ${p.code}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [positions, q, showInactive],
  );
  const deptName = (id: string | null) => depts.find((d) => d.id === id)?.name ?? "—";
  const posName = (id: string | null) => positions.find((p) => p.id === id)?.name ?? "—";
  const suggested = (pid: string) =>
    posRoles
      .filter((r) => r.position_id === pid)
      .map((r) => roles.find((x) => x.id === r.role_id)?.name)
      .filter(Boolean) as string[];

  const errors: string[] = [];
  if (draft) {
    if (!/^[a-z0-9_]{2,50}$/.test(draft.code)) errors.push("Código: a-z, 0-9 y _ (2-50).");
    if (draft.name.trim().length < 2) errors.push("Nombre: mínimo 2 caracteres.");
    if (
      draft.id &&
      wouldCreateCycle(positions, (p) => p.reports_to_id, draft.id, draft.reportsToId)
    )
      errors.push("El superior elegido crearía un ciclo jerárquico.");
    if (draft.responsibilities.split("\n").filter((l) => l.trim()).length > 20)
      errors.push("Máximo 20 responsabilidades.");
  }

  return (
    <Section
      title="Catálogo de cargos"
      right={
        canAdmin && (
          <Button size="sm" onClick={() => setDraft(empty)}>
            <Plus className="mr-1 h-4 w-4" />
            Nuevo cargo
          </Button>
        )
      }
    >
      <ReadOnlyNote>
        Un cargo define autoridad organizacional y responsabilidades.{" "}
        <strong>No concede permisos por sí mismo</strong>: los «roles sugeridos» son una plantilla
        que se aplica de forma explícita y auditada al asignar la persona.
      </ReadOnlyNote>
      <div className="my-3 flex flex-wrap items-center gap-4">
        <Input
          className="max-w-xs"
          placeholder="Buscar cargo…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={showInactive} onCheckedChange={setShowInactive} />
          Mostrar inactivos
        </label>
      </div>
      <QueryBoundary queries={[positionsQ]}>
        {rows.length === 0 ? (
          <Empty>Sin resultados.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Reporta a</TableHead>
                  <TableHead>Titulares</TableHead>
                  <TableHead>Roles sugeridos</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">
                        {p.name}{" "}
                        {p.is_external && (
                          <Badge variant="outline" className="ml-1">
                            Externo
                          </Badge>
                        )}
                      </div>
                      <div
                        className="max-w-xs truncate text-xs text-muted-foreground"
                        title={p.responsibilities.join(" · ")}
                      >
                        {p.responsibilities.join(" · ") || p.description}
                      </div>
                    </TableCell>
                    <TableCell>{deptName(p.department_id)}</TableCell>
                    <TableCell>{posName(p.reports_to_id)}</TableCell>
                    <TableCell>
                      {posAssigns.filter((a) => a.position_id === p.id && !a.ended_at).length || (
                        <span className="text-muted-foreground">Vacante</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[16rem]">
                      <div className="flex flex-wrap gap-1">
                        {suggested(p.id).map((n) => (
                          <Badge key={n} variant="secondary">
                            {n}
                          </Badge>
                        ))}
                        {suggested(p.id).length === 0 && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ActiveBadge active={p.is_active} />
                    </TableCell>
                    <TableCell className="space-x-1 text-right whitespace-nowrap">
                      {canAdmin && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Roles sugeridos"
                            onClick={() => {
                              setRolesFor(p);
                              setPicked(
                                new Set(
                                  posRoles
                                    .filter((r) => r.position_id === p.id)
                                    .map((r) => r.role_id),
                                ),
                              );
                            }}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Editar"
                            onClick={() =>
                              setDraft({
                                id: p.id,
                                code: p.code,
                                name: p.name,
                                description: p.description,
                                departmentId: p.department_id,
                                reportsToId: p.reports_to_id,
                                responsibilities: p.responsibilities.join("\n"),
                                isExternal: p.is_external,
                                sortOrder: p.sort_order,
                              })
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title={p.is_active ? "Desactivar" : "Activar"}
                            disabled={p.code === "ceo"}
                            onClick={() => setToggle(p)}
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

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar cargo" : "Nuevo cargo"}</DialogTitle>
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
                disabled={draft.code === "ceo"}
                onChange={(v) =>
                  setDraft({ ...draft, code: v.toLowerCase().replace(/[^a-z0-9_]/g, "") })
                }
                maxLength={50}
              />
              <SelectField
                label="Departamento"
                value={draft.departmentId}
                onChange={(v) => setDraft({ ...draft, departmentId: v })}
                placeholder="Sin departamento"
                options={depts
                  .filter((d) => d.is_active)
                  .map((d) => ({ value: d.id, label: d.name }))}
              />
              <SelectField
                label="Superior jerárquico (autoridad, no permisos)"
                value={draft.reportsToId}
                onChange={(v) => setDraft({ ...draft, reportsToId: v })}
                placeholder="Ninguno"
                disabled={draft.code === "ceo"}
                options={positions
                  .filter((p) => p.is_active && p.id !== draft.id)
                  .map((p) => ({ value: p.id, label: p.name }))}
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
              <div className="space-y-1.5">
                <Label>Responsabilidades (una por línea)</Label>
                <Textarea
                  rows={4}
                  value={draft.responsibilities}
                  onChange={(e) => setDraft({ ...draft, responsibilities: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={draft.isExternal}
                  onCheckedChange={(v) => setDraft({ ...draft, isExternal: v })}
                />
                Cargo externo a la línea jerárquica (socio, inversionista…)
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
                if (!draft) return;
                const ok = await save.run({
                  ...draft,
                  responsibilities: draft.responsibilities
                    .split("\n")
                    .map((l) => l.trim())
                    .filter(Boolean),
                });
                if (ok) setDraft(null);
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
        description={toggle?.is_active ? "No puede haber titulares vigentes del cargo." : undefined}
        confirmLabel={toggle?.is_active ? "Desactivar" : "Activar"}
        onConfirm={(reason) => toggle ? active.run({ id: toggle.id, active: !toggle.is_active, reason }) : Promise.resolve(false)}
      />

      <Dialog open={!!rolesFor} onOpenChange={(o) => !o && setRolesFor(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Roles sugeridos · {rolesFor?.name}</DialogTitle>
            <DialogDescription>
              Plantilla de conveniencia: al asignar este cargo se propondrán estos roles, pero cada
              asignación exige confirmación y justificación. Los roles privilegiados solo los puede
              vincular el CEO.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {roles
              .filter((r) => r.is_active)
              .map((r) => {
                const priv = isPrivilegedRole(r, rolePerms, defs);
                const disabled = priv && !isCeo;
                return (
                  <label
                    key={r.id}
                    className={`flex items-start gap-2 rounded border px-2 py-1.5 text-sm ${disabled ? "opacity-50" : ""}`}
                  >
                    <Checkbox
                      disabled={disabled}
                      checked={picked.has(r.id)}
                      onCheckedChange={(c) => {
                        const n = new Set(picked);
                        if (c) n.add(r.id);
                        else n.delete(r.id);
                        setPicked(n);
                      }}
                    />
                    <span>
                      <span className="font-medium">{r.name}</span>{" "}
                      {priv && (
                        <Badge variant="outline" className="ml-1">
                          Privilegiado
                        </Badge>
                      )}
                      <span className="block text-xs text-muted-foreground">{r.description}</span>
                    </span>
                  </label>
                );
              })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRolesFor(null)}>
              Cancelar
            </Button>
            <Button
              disabled={saveRoles.busy}
              onClick={async () => {
                if (rolesFor && await saveRoles.run({ positionId: rolesFor.id, roleIds: [...picked] }))
                  setRolesFor(null);
              }}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}
