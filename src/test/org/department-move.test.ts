import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { setUserDepartment } from "@/lib/admin.functions";
import { moveUserDepartment } from "@/lib/org/org.functions";

const sql = readFileSync("drizzle/migrations/0004_iris_unify_department_moves.sql", "utf8");
const compact = sql.replace(/\s+/g, " ");

describe("Cambio de departamento unificado", () => {
  it("la ruta heredada y Departamentos usan exactamente la misma función segura", () => {
    expect(setUserDepartment).toBe(moveUserDepartment);
  });

  it("actualiza solo alcances departamentales vinculados al perfil y conserva los explícitos", () => {
    expect(compact).toContain("has_dept AND _department IS NOT NULL");
    expect(compact).toContain("revoked_at IS NULL AND department_is_explicit=false");
    expect(compact).toContain("AND (valid_until IS NULL OR valid_until>now())");
  });

  it("retira la responsabilidad anterior antes de actualizar los alcances", () => {
    const clearHead = compact.indexOf("UPDATE public.departments SET head_user_id=NULL");
    const moveRoles = compact.indexOf("UPDATE public.org_user_roles SET department_id=_department");
    expect(clearHead).toBeGreaterThan(-1);
    expect(moveRoles).toBeGreaterThan(clearHead);
  });

  it("registra departamento anterior, nuevo y número de alcances actualizados", () => {
    expect(compact).toContain("jsonb_build_object('department_id',old_dept)");
    expect(compact).toContain("jsonb_build_object('department_id',_department,'profile_linked_roles_updated',moved_roles)");
    expect(compact).toContain("GET DIAGNOSTICS moved_roles=ROW_COUNT");
  });
});
