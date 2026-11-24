import { useMemo, useState } from "react";
import { Pencil, Plus, Power, UserCog, Users } from "lucide-react";
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
import { wouldCreateCycle } from "@/lib/org/authz";
import {
  moveUserDepartment,
  setDepartmentActive,
  setDepartmentHead,
  upsertDepartment,
} from "@/lib/org/org.functions";
import {
  useDepartments,
  useOrgUsers,
  usePositionAssignments,
  usePositions,
} from "@/lib/org/org.queries";
import type { Department } from "@/lib/org/types";
import {
  ActiveBadge,
  QueryBoundary,
  ReadOnlyNote,
  ReasonDialog,
  SelectField,
  TextField,
  useAccess,
  useAct,
  userLabel,
} from "./shared";

type Draft = {
  id: string | null;
  code: string;
  name: string;
  description: string;
  parentId: string | null;
  sortOrder: number;
};
const empty: Draft = {
  id: null,
  code: "",
  name: "",
  description: "",
  parentId: null,
  sortOrder: 100,
};

export function DepartmentsManager() {
  const { can, isCeo } = useAccess();
  const canAdmin = isCeo && can("departamentos", "administrar");
  const deptsQ = useDepartments();
  const depts = useMemo(() => deptsQ.data ?? [], [deptsQ.data]);
  const { data: posAssigns = [] } = usePositionAssignments();
  const { data: users = [] } = useOrgUsers();
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toggle, setToggle] = useState<Department | null>(null);
  const [headOf, setHeadOf] = useState<Department | null>(null);
  const [membersOf, setMembersOf] = useState<Department | null>(null);

  const save = useAct<unknown>(upsertDepartment, "Departamento guardado");
  const active = useAct<unknown>(setDepartmentActive, "Estado actualizado");

  const rows = useMemo(
    () =>
      depts.filter(
        (d) =>
          (showInactive || d.is_active) &&
          `${d.name} ${d.code}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [depts, q, showInactive],
  );
  const name = (id: string | null) => depts.find((d) => d.id === id)?.name ?? "—";
  const userById = new Map(users.map((u) => [u.id, u]));

  const draftErrors: string[] = [];
  if (draft) {
    if (!/^[a-z0-9_]{2,40}$/.test(draft.code)) draftErrors.push("Código: a-z, 0-9 y _ (2-40).");
    if (draft.name.trim().length < 2) draftErrors.push("Nombre: mínimo 2 caracteres.");
    if (draft.id && wouldCreateCycle(depts, (d) => d.parent_id, draft.id, draft.parentId))
      draftErrors.push("El departamento superior crearía un ciclo.");
  }

  return (
    <Section
      title="Departamentos"
      right={
        canAdmin && (
          <Button size="sm" onClick={() => setDraft(empty)}>
            <Plus className="mr-1 h-4 w-4" />
            Nuevo
          </Button>
        )
      }
    >
      {!canAdmin && (
        <ReadOnlyNote>
          Tienes acceso de solo lectura. La administración de departamentos está reservada al CEO.
        </ReadOnlyNote>
      )}
      <div className="my-3 flex flex-wrap items-center gap-4">
        <Input
          className="max-w-xs"
          placeholder="Buscar por nombre o código…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={showInactive} onCheckedChange={setShowInactive} />
          Mostrar inactivos
        </label>
      </div>
      <QueryBoundary queries={[deptsQ]}>
        {rows.length === 0 ? (
          <Empty>Sin resultados.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Depende de</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs text-muted-foreground">{d.code}</div>
                    </TableCell>
                    <TableCell>{name(d.parent_id)}</TableCell>
                    <TableCell>
                      {d.head_user_id ? (
                        userLabel(userById.get(d.head_user_id))
                      ) : (
                        <span className="text-muted-foreground">Sin responsable</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ActiveBadge active={d.is_active} />
                    </TableCell>
                    <TableCell className="space-x-1 text-right whitespace-nowrap">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Miembros"
                        onClick={() => setMembersOf(d)}
                      >
                        <Users className="h-4 w-4" />
                      </Button>
                      {canAdmin && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Responsable"
                            disabled={!d.is_active}
                            onClick={() => setHeadOf(d)}
                          >
                            <UserCog className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Editar"
                            onClick={() =>
                              setDraft({
                                id: d.id,
                                code: d.code,
                                name: d.name,
                                description: d.description,
                                parentId: d.parent_id,
                                sortOrder: d.sort_order,
                              })
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title={d.is_active ? "Desactivar" : "Activar"}
                            disabled={d.code === "direccion"}
                            onClick={() => setToggle(d)}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar departamento" : "Nuevo departamento"}</DialogTitle>
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
                disabled={draft.code === "direccion"}
                onChange={(v) =>
                  setDraft({ ...draft, code: v.toLowerCase().replace(/[^a-z0-9_]/g, "") })
                }
                maxLength={40}
              />
              <SelectField
                label="Depende de"
                value={draft.parentId}
                onChange={(v) => setDraft({ ...draft, parentId: v })}
                placeholder="Ninguno (raíz)"
                disabled={draft.code === "direccion"}
                options={depts
                  .filter((d) => d.is_active && d.id !== draft.id)
                  .map((d) => ({ value: d.id, label: d.name }))}
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
              {draftErrors.map((e) => (
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
              disabled={!draft || draftErrors.length > 0 || save.busy}
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
            ? `Los permisos con alcance departamental sobre este departamento dejan de aplicar de inmediato. Los miembros no se eliminan (${users.filter((u) => u.department_id === toggle.id && u.status === "active").length} activos visibles). Si hay titulares de cargos vigentes en él, el servidor rechazará la operación hasta finalizarlos.`
            : undefined
        }
        confirmLabel={toggle?.is_active ? "Desactivar" : "Activar"}
        onConfirm={(reason) => toggle ? active.run({ id: toggle.id, active: !toggle.is_active, reason }) : Promise.resolve(false)}
      />

      <HeadDialog dept={headOf} onClose={() => setHeadOf(null)} />
      <MembersDialog dept={membersOf} isCeo={isCeo} onClose={() => setMembersOf(null)} />
    </Section>
  );
}

function HeadDialog({ dept, onClose }: { dept: Department | null; onClose: () => void }) {
  const { data: users = [] } = useOrgUsers();
  const act = useAct<unknown>(setDepartmentHead, "Responsable actualizado");
  const [userId, setUserId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const members = users.filter((u) => dept && u.department_id === dept.id && u.status === "active");
  return (
    <Dialog
      open={!!dept}
      onOpenChange={(o) => {
        if (!o) {
          setUserId(null);
          setReason("");
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Responsable de «{dept?.name}»</DialogTitle>
        </DialogHeader>
        <SelectField
          label="Responsable (debe ser miembro activo)"
          value={userId ?? dept?.head_user_id ?? null}
          onChange={setUserId}
          placeholder="Sin responsable"
          options={members.map((u) => ({ value: u.id, label: userLabel(u) }))}
        />
        {members.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Este departamento no tiene miembros activos visibles para ti.
          </p>
        )}
        <div className="space-y-1.5">
          <Label>Motivo</Label>
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={reason.trim().length < 5 || act.busy}
            onClick={async () => {
              if (!dept) return;
              if (
                await act.run({
                  departmentId: dept.id,
                  userId: userId ?? dept?.head_user_id ?? null,
                  reason: reason.trim(),
                })
              ) {
                setReason("");
                setUserId(null);
                onClose();
              }
            }}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MembersDialog({
  dept,
  isCeo,
  onClose,
}: {
  dept: Department | null;
  isCeo: boolean;
  onClose: () => void;
}) {
  const { data: users = [] } = useOrgUsers();
  const { data: depts = [] } = useDepartments();
  const move = useAct<unknown>(moveUserDepartment, "Departamento asignado");
  const [pick, setPick] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const members = users.filter((u) => dept && u.department_id === dept.id);
  const others = users.filter((u) => dept && u.department_id !== dept.id && u.status === "active");
  const reserved = dept?.code === "direccion";
  const deptName = (id: string | null) =>
    depts.find((d) => d.id === id)?.name ?? "sin departamento";
  const picked = users.find((u) => u.id === pick);
  return (
    <Dialog open={!!dept} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Miembros de «{dept?.name}»</DialogTitle>
        </DialogHeader>
        {members.length === 0 ? (
          <Empty>Sin miembros visibles.</Empty>
        ) : (
          <ul className="max-h-60 space-y-1 overflow-y-auto text-sm">
            {members.map((u) => (
              <li key={u.id} className="flex items-center justify-between rounded border px-2 py-1">
                <span>
                  {userLabel(u)} <span className="text-xs text-muted-foreground">{u.email}</span>
                </span>
                {u.status !== "active" && <Badge variant="secondary">{u.status}</Badge>}
              </li>
            ))}
          </ul>
        )}
        {isCeo && !reserved && dept?.is_active && (
          <div className="space-y-2 border-t pt-3">
            <SelectField
              label="Asignar usuario a este departamento"
              value={pick}
              onChange={setPick}
              placeholder="Selecciona un usuario"
              options={others.map((u) => ({
                value: u.id,
                label: `${userLabel(u)} (hoy: ${deptName(u.department_id)})`,
              }))}
            />
            {picked && (
              <p className="text-xs text-muted-foreground">
                Pasará de «{deptName(picked.department_id)}» a «{dept.name}». Si era responsable de
                su departamento, se retirará esa designación; los roles con alcance departamental
                sin departamento explícito seguirán al nuevo.
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="move-reason">Motivo (queda en el historial)</Label>
              <Textarea
                id="move-reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              disabled={!pick || reason.trim().length < 5 || move.busy}
              onClick={async () => {
                if (
                  pick &&
                  (await move.run({ userId: pick, departmentId: dept.id, reason: reason.trim() }))
                ) {
                  setPick(null);
                  setReason("");
                }
              }}
            >
              Asignar
            </Button>
          </div>
        )}
        {!isCeo && (
          <ReadOnlyNote>
            El cambio de departamento de una persona lo realiza solo el CEO (regla vigente de IRIS).
          </ReadOnlyNote>
        )}
        {reserved && <ReadOnlyNote>Dirección Ejecutiva está reservada al CEO.</ReadOnlyNote>}
      </DialogContent>
    </Dialog>
  );
}
