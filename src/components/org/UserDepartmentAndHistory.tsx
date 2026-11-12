import { useState } from "react";
import { Empty } from "@/components/iris/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { moveUserDepartment } from "@/lib/org/org.functions";
import { useChangeLog, useDepartments } from "@/lib/org/org.queries";
import type { OrgUser } from "@/lib/org/types";
import { SelectField, fmtDT, useAct, userLabel } from "./shared";

/** Cambio de departamento de una persona. Solo el CEO (lo vuelve a validar la RPC); deja motivo e historial. */
export function MoveDepartmentDialog({
  user,
  open,
  onClose,
}: {
  user: OrgUser;
  open: boolean;
  onClose: () => void;
}) {
  const { data: depts = [] } = useDepartments();
  const act = useAct<unknown>(moveUserDepartment, "Departamento actualizado");
  const [target, setTarget] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const current = depts.find((d) => d.id === user.department_id)?.name ?? "sin departamento";
  const targetName = depts.find((d) => d.id === target)?.name;
  const reset = () => {
    setTarget(null);
    setReason("");
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
          <DialogTitle>Cambiar departamento de {userLabel(user)}</DialogTitle>
          <DialogDescription>
            Hoy pertenece a «{current}». Dirección Ejecutiva está reservada al CEO. Si es
            responsable de su departamento actual, se retirará esa designación.
          </DialogDescription>
        </DialogHeader>
        <SelectField
          label="Nuevo departamento"
          value={target}
          onChange={setTarget}
          placeholder="Selecciona un departamento"
          options={depts
            .filter((d) => d.is_active && d.id !== user.department_id && d.code !== "direccion")
            .map((d) => ({ value: d.id, label: d.name }))}
        />
        {targetName && (
          <p className="text-xs text-muted-foreground">
            Los roles con alcance departamental que no fijen un departamento explícito pasarán a
            aplicarse en «{targetName}».
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="dept-reason">Motivo (queda en el historial)</Label>
          <Textarea
            id="dept-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
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
            disabled={!target || reason.trim().length < 5 || act.busy}
            onClick={async () => {
              if (
                target &&
                (await act.run({ userId: user.id, departmentId: target, reason: reason.trim() }))
              ) {
                reset();
                onClose();
              }
            }}
          >
            Cambiar departamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Historial de cambios de una persona (visible solo para quien puede leer la bitácora: CEO o auditoría). */
export function UserHistory({ userId }: { userId: string }) {
  const { data = [], isLoading } = useChangeLog(500);
  const { data: depts = [] } = useDepartments();
  const rows = data.filter((e) => e.entity === "usuario" && e.entity_id === userId).slice(0, 25);
  const deptName = (v: unknown) => depts.find((d) => d.id === v)?.name;
  const detail = (e: (typeof rows)[number]) => {
    const a = (e.after_data ?? {}) as Record<string, unknown>;
    const b = (e.before_data ?? {}) as Record<string, unknown>;
    if (e.action === "usuario.departamento")
      return `${deptName(b["department_id"]) ?? "—"} → ${deptName(a["department_id"]) ?? "—"}`;
    return Object.keys(a).length ? JSON.stringify(a) : "";
  };
  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando historial…</p>;
  if (rows.length === 0)
    return (
      <Empty>
        Sin cambios registrados que puedas consultar. La bitácora completa solo la ven el CEO y la
        auditoría.
      </Empty>
    );
  return (
    <ul className="space-y-1.5 text-sm">
      {rows.map((e) => (
        <li key={e.id} className="rounded border px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{e.action}</span>
            <Badge variant={e.result === "denegado" ? "destructive" : "secondary"}>
              {e.result === "denegado" ? "Denegado" : "Aplicado"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {fmtDT(e.created_at)} · {e.actor_email ?? "—"}
            </span>
          </div>
          {(detail(e) || e.reason) && (
            <div className="mt-1 text-xs text-muted-foreground">
              {detail(e)} {e.reason ? `· «${e.reason}»` : ""}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
