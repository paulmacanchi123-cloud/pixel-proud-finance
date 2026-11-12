// Lógica de autorización pura (sin red). ESPEJO de las funciones SQL org_check / org_sod_conflicts_if,
// usada para habilitar/ocultar controles de la interfaz y para pruebas unitarias.
// IMPORTANTE: la autoridad real está en la base de datos (RPC + RLS). Esto es solo comodidad de UX.
import type {
  MyPermission,
  OrgAction,
  OrgRole,
  RolePermission,
  PermissionDef,
  SodRule,
  SodException,
} from "./types";

export type CheckContext = {
  departmentId?: string | null;
  ownerId?: string | null;
  userId?: string | null;
  anyScope?: boolean;
  aal2?: boolean;
  isCeo?: boolean;
};

/** ¿Concede alguno de los permisos efectivos (resource, action) en el contexto dado? Denegación por defecto. */
export function can(
  perms: readonly MyPermission[],
  resource: string,
  action: OrgAction,
  ctx: CheckContext = {},
): boolean {
  if (ctx.isCeo && action !== "auditar") return true;
  return perms.some((p) => {
    if (p.resource !== resource || p.action !== action) return false;
    if (p.require_mfa && !ctx.aal2) return false;
    if (ctx.anyScope) return true;
    if (p.scope === "global") return true;
    if (p.scope === "departamento")
      return !!ctx.departmentId && p.department_id === ctx.departmentId;
    return !!ctx.ownerId && !!ctx.userId && ctx.ownerId === ctx.userId; // propio
  });
}

const POWER_ACTIONS: ReadonlySet<OrgAction> = new Set(["administrar", "aprobar", "auditar"]);

/** Rol privilegiado: marcado como tal o con poderes críticos de control. Solo el CEO lo asigna. */
export function isPrivilegedRole(
  role: Pick<OrgRole, "id" | "is_privileged">,
  rolePerms: readonly RolePermission[],
  defs: readonly PermissionDef[],
): boolean {
  if (role.is_privileged) return true;
  const byId = new Map(defs.map((d) => [d.id, d]));
  return rolePerms.some(
    (rp) =>
      rp.role_id === role.id && POWER_ACTIONS.has(byId.get(rp.permission_id)?.action as OrgAction),
  );
}

const activeException = (e: SodException, now: Date) =>
  e.kind === "rol" && !e.revoked_at && new Date(e.starts_at) <= now && new Date(e.expires_at) > now;

/** Conflictos que se producirían al añadir `newRoleIds` a los roles ya vigentes `heldRoleIds`. */
export function sodConflicts(
  heldRoleIds: readonly string[],
  newRoleIds: readonly string[],
  rules: readonly SodRule[],
  exceptions: readonly SodException[] = [],
  now: Date = new Date(),
): SodRule[] {
  const held = new Set([...heldRoleIds, ...newRoleIds]);
  const added = new Set(newRoleIds);
  const excepted = new Set(exceptions.filter((e) => activeException(e, now)).map((e) => e.rule_id));
  return rules.filter(
    (r) =>
      r.is_active &&
      held.has(r.role_a_id) &&
      held.has(r.role_b_id) &&
      (added.has(r.role_a_id) || added.has(r.role_b_id)) &&
      !excepted.has(r.id),
  );
}

/** Conflictos vigentes sin excepción (fail-closed: esos roles no otorgan permisos). */
export function unresolvedConflicts(
  heldRoleIds: readonly string[],
  rules: readonly SodRule[],
  exceptions: readonly SodException[] = [],
  now: Date = new Date(),
): SodRule[] {
  return sodConflicts([], heldRoleIds, rules, exceptions, now);
}

/** Árbol genérico por clave padre (departamentos y cargos). Tolera padres ausentes tratándolos como raíz. */
export type TreeNode<T> = { item: T; children: TreeNode<T>[] };
export function buildTree<T extends { id: string }>(
  items: readonly T[],
  parentOf: (t: T) => string | null,
  sort: (a: T, b: T) => number = () => 0,
): TreeNode<T>[] {
  const ids = new Set(items.map((i) => i.id));
  const nodes = new Map<string, TreeNode<T>>(items.map((i) => [i.id, { item: i, children: [] }]));
  const roots: TreeNode<T>[] = [];
  for (const i of [...items].sort(sort)) {
    const pid = parentOf(i);
    const node = nodes.get(i.id)!;
    if (pid && ids.has(pid) && pid !== i.id) nodes.get(pid)!.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** ¿Crearía `candidateParent` un ciclo al colgar `id` de él? (validación previa en formularios) */
export function wouldCreateCycle<T extends { id: string }>(
  items: readonly T[],
  parentOf: (t: T) => string | null,
  id: string,
  candidateParent: string | null,
): boolean {
  const map = new Map(items.map((i) => [i.id, i]));
  let cur = candidateParent;
  const seen = new Set<string>();
  while (cur) {
    if (cur === id) return true;
    if (seen.has(cur)) return true;
    seen.add(cur);
    const n = map.get(cur);
    cur = n ? parentOf(n) : null;
  }
  return false;
}

export type AssignmentStatus = "vigente" | "programada" | "vencida" | "revocada";
/** Estado de una asignación de rol en un instante dado (misma regla que org_valid_assignments en SQL). */
export function assignmentStatus(
  a: { revoked_at: string | null; valid_from: string; valid_until: string | null },
  now: Date = new Date(),
): AssignmentStatus {
  if (a.revoked_at) return "revocada";
  if (new Date(a.valid_from) > now) return "programada";
  if (a.valid_until && new Date(a.valid_until) <= now) return "vencida";
  return "vigente";
}
