import { describe, expect, it } from "vitest";
import {
  buildTree,
  can,
  isPrivilegedRole,
  sodConflicts,
  unresolvedConflicts,
  wouldCreateCycle,
} from "@/lib/org/authz";
import type {
  MyPermission,
  PermissionDef,
  RolePermission,
  SodException,
  SodRule,
} from "@/lib/org/types";

const perm = (
  resource: string,
  action: MyPermission["action"],
  scope: MyPermission["scope"],
  department_id: string | null = null,
  require_mfa = false,
): MyPermission => ({ resource, action, scope, department_id, require_mfa });

describe("can() — denegación por defecto y alcances", () => {
  it("sin permisos no concede nada", () => {
    expect(can([], "finanzas", "consultar")).toBe(false);
    expect(can([], "finanzas", "consultar", { anyScope: true })).toBe(false);
  });
  it("global concede en cualquier contexto", () => {
    expect(can([perm("finanzas", "consultar", "global")], "finanzas", "consultar")).toBe(true);
  });
  it("no mezcla recursos ni acciones", () => {
    const p = [perm("finanzas", "consultar", "global")];
    expect(can(p, "finanzas", "editar")).toBe(false);
    expect(can(p, "ventas", "consultar")).toBe(false);
  });
  it("departamental exige el mismo departamento", () => {
    const p = [perm("ventas", "editar", "departamento", "d1")];
    expect(can(p, "ventas", "editar", { departmentId: "d1" })).toBe(true);
    expect(can(p, "ventas", "editar", { departmentId: "d2" })).toBe(false);
    expect(can(p, "ventas", "editar")).toBe(false);
  });
  it("propio exige que el propietario sea el usuario", () => {
    const p = [perm("ventas", "consultar", "propio")];
    expect(can(p, "ventas", "consultar", { userId: "u1", ownerId: "u1" })).toBe(true);
    expect(can(p, "ventas", "consultar", { userId: "u1", ownerId: "u2" })).toBe(false);
    expect(can(p, "ventas", "consultar", { userId: "u1" })).toBe(false);
  });
  it("anyScope sirve para menús pero respeta la acción", () => {
    const p = [perm("ventas", "consultar", "propio")];
    expect(can(p, "ventas", "consultar", { anyScope: true })).toBe(true);
    expect(can(p, "ventas", "eliminar", { anyScope: true })).toBe(false);
  });
  it("MFA: sin aal2 se deniega el permiso que lo exige", () => {
    const p = [perm("transacciones", "aprobar", "global", null, true)];
    expect(can(p, "transacciones", "aprobar", { aal2: false })).toBe(false);
    expect(can(p, "transacciones", "aprobar", { aal2: true })).toBe(true);
  });
  it("CEO tiene facultad global salvo 'auditar' (independencia)", () => {
    expect(can([], "finanzas", "editar", { isCeo: true })).toBe(true);
    expect(can([], "auditoria", "auditar", { isCeo: true })).toBe(false);
    expect(
      can([perm("auditoria", "auditar", "global")], "auditoria", "auditar", { isCeo: true }),
    ).toBe(true);
  });
});

const rule = (id: string, a: string, b: string, is_active = true): SodRule => ({
  id,
  role_a_id: a,
  role_b_id: b,
  description: "x",
  severity: "alta",
  is_active,
});
const exc = (rule_id: string, over: Partial<SodException> = {}): SodException => ({
  id: "e" + rule_id,
  kind: "rol",
  user_id: "u",
  rule_id,
  policy_code: null,
  justification: "justificación suficiente aquí",
  starts_at: new Date(Date.now() - 1000).toISOString(),
  expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  revoked_at: null,
  ...over,
});

describe("separación de funciones", () => {
  const rules = [rule("r1", "oper", "aprob"), rule("r2", "aprob", "audit")];
  it("detecta el conflicto al añadir el segundo rol", () => {
    expect(sodConflicts(["oper"], ["aprob"], rules).map((r) => r.id)).toEqual(["r1"]);
  });
  it("no reporta conflictos entre roles ya existentes que no se están añadiendo", () => {
    expect(sodConflicts(["oper", "aprob"], ["otro"], rules)).toEqual([]);
  });
  it("una excepción vigente levanta el conflicto", () => {
    expect(sodConflicts(["oper"], ["aprob"], rules, [exc("r1")])).toEqual([]);
  });
  it("una excepción vencida o revocada NO lo levanta", () => {
    const vencida = exc("r1", {
      expires_at: new Date(Date.now() - 1000).toISOString(),
      starts_at: new Date(Date.now() - 5000).toISOString(),
    });
    const revocada = exc("r1", { revoked_at: new Date().toISOString() });
    expect(sodConflicts(["oper"], ["aprob"], rules, [vencida])).toHaveLength(1);
    expect(sodConflicts(["oper"], ["aprob"], rules, [revocada])).toHaveLength(1);
  });
  it("las reglas inactivas se ignoran", () => {
    expect(sodConflicts(["oper"], ["aprob"], [rule("r1", "oper", "aprob", false)])).toEqual([]);
  });
  it("unresolvedConflicts detecta conflictos ya vigentes (fail-closed)", () => {
    expect(unresolvedConflicts(["oper", "aprob"], rules).map((r) => r.id)).toEqual(["r1"]);
    expect(unresolvedConflicts(["oper", "aprob"], rules, [exc("r1")])).toEqual([]);
    expect(unresolvedConflicts(["oper"], rules)).toEqual([]);
  });
});

describe("roles privilegiados", () => {
  const defs: PermissionDef[] = [
    { id: "p1", resource: "ventas", action: "consultar", scope: "propio", is_sensitive: false },
    { id: "p2", resource: "transacciones", action: "aprobar", scope: "global", is_sensitive: true },
    { id: "p3", resource: "usuarios", action: "administrar", scope: "global", is_sensitive: true },
    { id: "p4", resource: "reportes", action: "exportar", scope: "global", is_sensitive: true },
  ];
  const rp = (role_id: string, permission_id: string): RolePermission => ({
    role_id,
    permission_id,
    require_mfa: false,
  });
  it("la marca explícita basta", () =>
    expect(isPrivilegedRole({ id: "a", is_privileged: true }, [], defs)).toBe(true));
  it("aprobar/administrar/auditar vuelven privilegiado al rol", () => {
    expect(isPrivilegedRole({ id: "a", is_privileged: false }, [rp("a", "p2")], defs)).toBe(true);
    expect(isPrivilegedRole({ id: "a", is_privileged: false }, [rp("a", "p3")], defs)).toBe(true);
  });
  it("consultar o exportar no lo hacen privilegiado", () => {
    expect(
      isPrivilegedRole({ id: "a", is_privileged: false }, [rp("a", "p1"), rp("a", "p4")], defs),
    ).toBe(false);
  });
  it("solo cuentan los permisos del propio rol", () => {
    expect(isPrivilegedRole({ id: "a", is_privileged: false }, [rp("b", "p2")], defs)).toBe(false);
  });
});

describe("jerarquías", () => {
  const items = [
    { id: "ceo", parent: null as string | null },
    { id: "dir", parent: "ceo" },
    { id: "ger", parent: "dir" },
    { id: "huerfano", parent: "no-existe" },
  ];
  it("construye el árbol y trata padres ausentes como raíz", () => {
    const tree = buildTree(items, (i) => i.parent);
    expect(tree.map((n) => n.item.id).sort()).toEqual(["ceo", "huerfano"]);
    expect(tree.find((n) => n.item.id === "ceo").children[0].children[0].item.id).toBe("ger");
  });
  it("detecta ciclos antes de enviar al servidor", () => {
    expect(wouldCreateCycle(items, (i) => i.parent, "ceo", "ger")).toBe(true);
    expect(wouldCreateCycle(items, (i) => i.parent, "dir", "dir")).toBe(true);
    expect(wouldCreateCycle(items, (i) => i.parent, "ger", "ceo")).toBe(false);
    expect(wouldCreateCycle(items, (i) => i.parent, "ger", null)).toBe(false);
  });
});
