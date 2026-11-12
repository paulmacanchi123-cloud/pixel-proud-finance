import { Building2, Crown, UserRound } from "lucide-react";
import { Section, Empty } from "@/components/iris/ui";
import { Badge } from "@/components/ui/badge";
import { buildTree, type TreeNode } from "@/lib/org/authz";
import {
  useDepartments,
  useOrgUsers,
  usePositionAssignments,
  usePositions,
} from "@/lib/org/org.queries";
import type { Department, Position } from "@/lib/org/types";
import { userLabel } from "./shared";

export function OrgChart() {
  const { data: depts = [], isLoading } = useDepartments();
  const { data: positions = [] } = usePositions();
  const { data: users = [] } = useOrgUsers();
  const { data: assigns = [] } = usePositionAssignments();

  const userById = new Map(users.map((u) => [u.id, u]));
  const activeAssigns = assigns.filter((a) => !a.ended_at);
  const holders = (positionId: string) =>
    activeAssigns
      .filter((a) => a.position_id === positionId)
      .map((a) => userLabel(userById.get(a.user_id)));
  const memberCount = (deptId: string) =>
    users.filter((u) => u.department_id === deptId && u.status === "active").length;

  const deptTree = buildTree(
    depts.filter((d) => d.is_active),
    (d) => d.parent_id,
    (a, b) => a.sort_order - b.sort_order,
  );
  const posTree = buildTree(
    positions.filter((p) => p.is_active && !p.is_external),
    (p) => p.reports_to_id,
    (a, b) => a.sort_order - b.sort_order,
  );
  const external = positions.filter((p) => p.is_active && p.is_external);

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando estructura…</p>;
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Section title="Estructura departamental">
        {deptTree.length === 0 ? (
          <Empty>No hay departamentos activos visibles.</Empty>
        ) : (
          <ul className="space-y-1">
            {deptTree.map((n) => (
              <DeptNode
                key={n.item.id}
                node={n}
                depth={0}
                userById={userById}
                memberCount={memberCount}
                positions={positions}
              />
            ))}
          </ul>
        )}
      </Section>
      <Section title="Línea de autoridad por cargos">
        <p className="mb-3 text-xs text-muted-foreground">
          La jerarquía de cargos expresa autoridad organizacional. <strong>No</strong> hereda
          permisos: estos salen solo de los roles asignados.
        </p>
        {posTree.length === 0 ? (
          <Empty>No hay cargos visibles para tu perfil.</Empty>
        ) : (
          <ul className="space-y-1">
            {posTree.map((n) => (
              <PosNode key={n.item.id} node={n} depth={0} holders={holders} depts={depts} />
            ))}
          </ul>
        )}
        {external.length > 0 && (
          <div className="mt-4 border-t pt-3">
            <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
              Fuera de la línea jerárquica
            </div>
            <ul className="space-y-1">
              {external.map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <UserRound className="h-4 w-4 text-muted-foreground" />
                  {p.name}
                  <Badge variant="outline">Externo</Badge>
                  <span className="text-xs text-muted-foreground">{holders(p.id).join(", ")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>
    </div>
  );
}

function DeptNode({
  node,
  depth,
  userById,
  memberCount,
  positions,
}: {
  node: TreeNode<Department>;
  depth: number;
  userById: Map<string, { full_name: string; email: string }>;
  memberCount: (id: string) => number;
  positions: Position[];
}) {
  const d = node.item;
  const head = d.head_user_id ? userLabel(userById.get(d.head_user_id)) : null;
  const posCount = positions.filter((p) => p.department_id === d.id && p.is_active).length;
  return (
    <li>
      <div
        className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60"
        style={{ marginLeft: depth * 18 }}
      >
        <Building2 className="h-4 w-4 text-primary" />
        <span className="font-medium">{d.name}</span>
        <Badge variant="outline">{memberCount(d.id)} miembros</Badge>
        {posCount > 0 && <Badge variant="outline">{posCount} cargos</Badge>}
        {head ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Crown className="h-3 w-3" />
            {head}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Sin responsable</span>
        )}
      </div>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((c) => (
            <DeptNode
              key={c.item.id}
              node={c}
              depth={depth + 1}
              userById={userById}
              memberCount={memberCount}
              positions={positions}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function PosNode({
  node,
  depth,
  holders,
  depts,
}: {
  node: TreeNode<Position>;
  depth: number;
  holders: (id: string) => string[];
  depts: Department[];
}) {
  const p = node.item;
  const who = holders(p.id);
  const dept = depts.find((d) => d.id === p.department_id);
  return (
    <li>
      <div
        className="flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60"
        style={{ marginLeft: depth * 18 }}
      >
        <UserRound className="h-4 w-4 text-primary" />
        <span className="font-medium">{p.name}</span>
        {dept && <Badge variant="outline">{dept.name}</Badge>}
        <span className="text-xs text-muted-foreground">
          {who.length ? who.join(", ") : "Vacante"}
        </span>
      </div>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((c) => (
            <PosNode key={c.item.id} node={c} depth={depth + 1} holders={holders} depts={depts} />
          ))}
        </ul>
      )}
    </li>
  );
}
