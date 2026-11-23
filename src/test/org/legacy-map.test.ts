import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LEGACY_MAP } from "@/lib/org/legacy-map";

const sql0000 = readFileSync("drizzle/migrations/0000_migration.sql", "utf8");
const sqlSeed = readFileSync("supabase/seed.sql", "utf8");
const sqlAuthz = readFileSync("drizzle/migrations/0003_iris_org_authz_security.sql", "utf8");

// Valores del enum iris_permission definidos en la migración original
const enumValues = [
  ...(/create type public\.iris_permission as enum \(([^)]*)\)/i.exec(sql0000)?.[1] ?? "").matchAll(
    /'([a-z_]+)'/g,
  ),
].map((m) => m[1]);

// Filas de org_legacy_map en la semilla reproducible
const sqlRows = [
  ...sqlSeed.matchAll(
    /\('([a-z_]+)',\s*(null|'[a-z_]+'),\s*(null|'[a-z_]+'),\s*'(equivalente|sin_equivalencia)'/g,
  ),
].map((m) => ({
  perm: m[1],
  resource: m[2] === "null" ? null : m[2]?.slice(1, -1),
  action: m[3] === "null" ? null : m[3]?.slice(1, -1),
  status: m[4],
}));

describe("equivalencias legacy → nuevo", () => {
  it("la migración original define los 11 permisos esperados", () => {
    expect(enumValues).toHaveLength(11);
  });
  it("cubre TODOS los permisos antiguos (ninguno queda sin decisión explícita)", () => {
    expect(sqlRows.map((r) => r.perm).sort()).toEqual([...enumValues].sort());
    expect(LEGACY_MAP.map((e) => e.perm).sort()).toEqual([...enumValues].sort());
  });
  it("el mapa de la interfaz coincide con el de la migración", () => {
    for (const row of sqlRows) {
      const ui = LEGACY_MAP.find((e) => e.perm === row.perm);
      expect(ui?.target).toBe(row.resource ? `${row.resource}:${row.action}` : null);
    }
  });
  it("'delete' es el único sin equivalencia segura", () => {
    expect(sqlRows.filter((r) => r.status === "sin_equivalencia").map((r) => r.perm)).toEqual([
      "delete",
    ]);
  });
  it("patrimonio, inversiones y cuentas son recursos independientes de finanzas", () => {
    const targets = Object.fromEntries(LEGACY_MAP.map((e) => [e.perm, e.target]));
    expect(targets["view_patrimony"]).toMatch(/^patrimonio:/);
    expect(targets["manage_investments"]).toMatch(/^inversiones:/);
    expect(targets["manage_accounts"]).toMatch(/^cuentas:/);
  });
  it("approve_operations NO se mapea a una acción de decisión distinta de aprobar-visibilidad ni a un permiso de administración", () => {
    const t = LEGACY_MAP.find((e) => e.perm === "approve_operations");
    expect(t?.target).toBe("transacciones:aprobar");
    expect(t?.note).toMatch(/CEO/);
  });
  it("el modo por defecto es legacy y union/org nacen bloqueados", () => {
    expect(sqlAuthz).toMatch(/mode\s+text not null default 'legacy'/i);
    expect(sqlAuthz).toMatch(/enforcement_unlocked boolean not null default false/i);
    expect(sqlAuthz).toMatch(/require_mfa_admin\s+boolean not null default false/i);
  });
});
