import { Empty } from "@/components/iris/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { assignmentStatus, type AssignmentStatus } from "@/lib/org/authz";
import type { Department, OrgRole, OrgUser, UserRoleAssignment } from "@/lib/org/types";
import { AssignmentBadge, fmtDate, userLabel } from "./shared";

const ORDER: Record<AssignmentStatus, number> = {
  vigente: 0,
  programada: 1,
  vencida: 2,
  revocada: 3,
};

/** Personas que tienen (o tuvieron) un rol. Los datos llegan filtrados por RLS: solo se ven asignaciones dentro del alcance del usuario. */
export function RoleUsersDialog({
  role,
  assignments,
  users,
  departments,
  onClose,
  now = new Date(),
}: {
  role: OrgRole | null;
  assignments: UserRoleAssignment[];
  users: OrgUser[];
  departments: Department[];
  onClose: () => void;
  now?: Date;
}) {
  const userById = new Map(users.map((u) => [u.id, u]));
  const deptName = (id: string | null) => departments.find((d) => d.id === id)?.name;
  const rows = assignments
    .filter((a) => a.role_id === role?.id)
    .map((a) => ({ a, status: assignmentStatus(a, now) }))
    .sort(
      (x, y) => ORDER[x.status] - ORDER[y.status] || x.a.created_at.localeCompare(y.a.created_at),
    );
  const vigentes = rows.filter((r) => r.status === "vigente").length;

  return (
    <Dialog open={!!role} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Personas con el rol «{role?.name}»</DialogTitle>
          <DialogDescription>
            {vigentes} vigente(s) de {rows.length} asignación(es) en tu alcance, incluido el
            historial.
          </DialogDescription>
        </DialogHeader>
        {rows.length === 0 ? (
          <Empty>Nadie tiene este rol (o no tienes alcance para verlo).</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Persona</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Justificación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ a, status }) => {
                const u = userById.get(a.user_id);
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="font-medium">
                        {u ? userLabel(u) : "(fuera de tu alcance)"}
                      </div>
                      {u && <div className="text-xs text-muted-foreground">{u.email}</div>}
                    </TableCell>
                    <TableCell className="text-xs">
                      {deptName(a.department_id) ?? "Del perfil"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {fmtDate(a.valid_from)} →{" "}
                      {a.valid_until ? fmtDate(a.valid_until) : "sin vencimiento"}
                    </TableCell>
                    <TableCell>
                      <AssignmentBadge status={status} />
                      {a.revoke_reason && (
                        <div className="mt-1 text-xs text-muted-foreground">{a.revoke_reason}</div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[14rem] text-xs text-muted-foreground">
                      {a.justification}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
