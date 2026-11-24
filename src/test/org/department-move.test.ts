import { describe, expect, it } from "vitest";

import { setUserDepartment } from "@/lib/admin.functions";
import { moveUserDepartment } from "@/lib/org/org.functions";

describe("Cambio de departamento unificado", () => {
  it("la ruta heredada y Departamentos usan exactamente la misma función segura", () => {
    expect(setUserDepartment).toBe(moveUserDepartment);
  });
});
