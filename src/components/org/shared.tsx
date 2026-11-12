import { createContext, useContext, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { can as canCheck } from "@/lib/org/authz";
import { useOrgRefresh } from "@/lib/org/org.queries";
import { assignmentStatus, type AssignmentStatus } from "@/lib/org/authz";
import type { MyPermission, OrgAction, OrgUser } from "@/lib/org/types";

// ---------- Acceso (solo UX: la autoridad real está en la base de datos) ----------
type Access = {
  isCeo: boolean;
  userId: string;
  can: (resource: string, action: OrgAction) => boolean;
};
const AccessCtx = createContext<Access>({ isCeo: false, userId: "", can: () => false });
export const useAccess = () => useContext(AccessCtx);
export function AccessProvider({
  isCeo,
  userId,
  perms,
  children,
}: {
  isCeo: boolean;
  userId: string;
  perms: MyPermission[];
  children: ReactNode;
}) {
  const value: Access = {
    isCeo,
    userId,
    can: (resource, action) =>
      canCheck(perms, resource, action, { isCeo, anyScope: true, aal2: true }),
  };
  return <AccessCtx.Provider value={value}>{children}</AccessCtx.Provider>;
}

// ---------- Ejecución de acciones del servidor con mensajes claros ----------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useAct<T>(serverFn: any, okMessage: string) {
  const call = useServerFn(serverFn) as (a: { data: T }) => Promise<unknown>;
  const refresh = useOrgRefresh();
  const [busy, setBusy] = useState(false);
  async function run(data: T): Promise<boolean> {
    setBusy(true);
    try {
      await call({ data });
      toast.success(okMessage);
      await refresh();
      return true;
    } catch (e) {
      toast.error(cleanError(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { run, busy };
}

export function cleanError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  try {
    const arr = JSON.parse(m);
    if (Array.isArray(arr) && arr[0]?.message) return String(arr[0].message); // errores de zod
  } catch {
    /* no es JSON */
  }
  return m.replace(/^error:\s*/i, "");
}

// ---------- Diálogo con motivo obligatorio (desactivar, revocar, finalizar…) ----------
export function ReasonDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  destructive,
  busy,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string | undefined;
  confirmLabel: string;
  destructive?: boolean | undefined;
  busy?: boolean | undefined;
  onConfirm: (reason: string) => Promise<boolean>;
}) {
  const [reason, setReason] = useState("");
  const valid = reason.trim().length >= 5;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setReason("");
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reason">Motivo (queda en la bitácora)</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
          />
          {!valid && reason.length > 0 && (
            <p className="text-xs text-destructive">Mínimo 5 caracteres.</p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setReason("");
              onClose();
            }}
          >
            Cancelar
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={!valid || busy}
            onClick={async () => {
              if (await onConfirm(reason.trim())) {
                setReason("");
                onClose();
              }
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Piezas pequeñas ----------
export const NONE = "__none";
export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = "Sin asignar",
  disabled,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  options: { value: string; label: string; disabled?: boolean | undefined }[];
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select
        value={value ?? NONE}
        onValueChange={(v) => onChange(v === NONE ? null : v)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{placeholder}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  ...rest
}: { label: string; value: string; onChange: (v: string) => void } & Omit<
  React.ComponentProps<typeof Input>,
  "onChange" | "value"
>) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </div>
  );
}

export const ActiveBadge = ({ active }: { active: boolean }) =>
  active ? (
    <Badge className="bg-success/15 text-success hover:bg-success/15">Activo</Badge>
  ) : (
    <Badge variant="secondary">Inactivo</Badge>
  );

export const userLabel = (u?: Pick<OrgUser, "full_name" | "email"> | null) =>
  u ? u.full_name || u.email : "—";
export const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("es-EC") : "—");
export const fmtDT = (s: string | null) => (s ? new Date(s).toLocaleString("es-EC") : "—");

export function ReadOnlyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-dashed bg-muted/50 p-3 text-xs text-muted-foreground">
      {children}
    </p>
  );
}

// ---------- Estados de carga y error de consultas esenciales ----------
export function QueryBoundary({
  queries,
  children,
}: {
  queries: { isLoading: boolean; error: unknown }[];
  children: ReactNode;
}) {
  const failed = queries.find((q) => q.error);
  if (failed) {
    return (
      <div
        role="alert"
        className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
      >
        No se pudieron cargar los datos: {cleanError(failed.error)}
      </div>
    );
  }
  if (queries.some((q) => q.isLoading)) {
    return (
      <p role="status" className="p-4 text-sm text-muted-foreground">
        Cargando…
      </p>
    );
  }
  return <>{children}</>;
}

const ASSIGNMENT_STYLE: Record<AssignmentStatus, string> = {
  vigente: "bg-success/15 text-success hover:bg-success/15",
  programada: "bg-primary/10 text-primary hover:bg-primary/10",
  vencida: "bg-muted text-muted-foreground hover:bg-muted",
  revocada: "bg-destructive/10 text-destructive hover:bg-destructive/10",
};
export function AssignmentBadge({ status }: { status: AssignmentStatus }) {
  return (
    <Badge className={ASSIGNMENT_STYLE[status]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>
  );
}
export { assignmentStatus };

export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-44" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
