import { describe, expect, it, vi } from "vitest";
import { isSecurityDenial, rpc, rpcId } from "@/lib/org/org.rpc";

type Reply = { data: unknown; error: { message: string; code?: string } | null };
function ctxWith(replies: Record<string, Reply>) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const supabase = {
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return replies[fn] ?? { data: null, error: null };
    }),
  };
  return { ctx: { supabase }, calls };
}

describe("isSecurityDenial", () => {
  it.each([
    'No autorizado: se requiere administrar "roles"',
    "Solo el CEO puede asignar roles privilegiados (escalada bloqueada)",
    "Conflicto de funciones (alta): La auditoría debe ser independiente",
    "No puedes asignarte roles a ti mismo",
    "Separación de funciones: ya realizaste el paso",
    "Esta operación requiere verificación en dos pasos (MFA)",
    "Los modos union/org están BLOQUEADOS",
    "Dirección Ejecutiva está reservada al CEO",
  ])("clasifica como seguridad: %s", (message) => {
    expect(isSecurityDenial({ message })).toBe(true);
  });
  it("el código 42501 siempre es seguridad", () => {
    expect(isSecurityDenial({ message: "cualquier cosa", code: "42501" })).toBe(true);
  });
  it.each([
    "Indica un motivo (mínimo 5 caracteres)",
    "duplicate key value violates unique constraint",
    "Código inválido (a-z, 0-9, _; 2-40)",
    "Departamento no encontrado",
  ])("NO clasifica como seguridad (validación): %s", (message) => {
    expect(isSecurityDenial({ message })).toBe(false);
  });
});

describe("rpc()", () => {
  it("devuelve los datos cuando la RPC tiene éxito y no registra nada", async () => {
    const { ctx, calls } = ctxWith({ org_assign_role: { data: "abc", error: null } });
    await expect(rpc(ctx, "org_assign_role", { _user: "u" })).resolves.toBe("abc");
    expect(calls.map((c) => c.fn)).toEqual(["org_assign_role"]);
  });
  it("registra el intento denegado en una llamada posterior y relanza el error original", async () => {
    const { ctx, calls } = ctxWith({
      org_assign_role: {
        data: null,
        error: { message: "Solo el CEO puede asignar roles privilegiados", code: "P0001" },
      },
    });
    await expect(rpc(ctx, "org_assign_role", { _user: "u" })).rejects.toThrow(
      "Solo el CEO puede asignar roles privilegiados",
    );
    expect(calls.map((c) => c.fn)).toEqual(["org_assign_role", "org_log_denied"]);
    expect(calls[1].args).toMatchObject({
      _action: "assign_role",
      _entity: "intento",
      _entity_id: "org_assign_role",
    });
    expect(String(calls[1].args["_error"])).toMatch(/Solo el CEO/);
  });
  it("no registra errores de validación (no son intentos de acceso)", async () => {
    const { ctx, calls } = ctxWith({
      org_upsert_department: {
        data: null,
        error: { message: "Código inválido (a-z, 0-9, _; 2-40)" },
      },
    });
    await expect(rpc(ctx, "org_upsert_department", {})).rejects.toThrow("Código inválido");
    expect(calls.map((c) => c.fn)).toEqual(["org_upsert_department"]);
  });
  it("si el registro falla, el error original sigue siendo el que se informa", async () => {
    const supabase = {
      rpc: vi.fn(async (fn: string) => {
        if (fn === "org_log_denied") throw new Error("red caída");
        return { data: null, error: { message: "No autorizado", code: "42501" } };
      }),
    };
    await expect(rpc({ supabase }, "org_revoke_role", {})).rejects.toThrow("No autorizado");
  });
  it("rpcId devuelve el uuid como texto", async () => {
    const { ctx } = ctxWith({
      org_upsert_role: { data: "11111111-1111-1111-1111-111111111111", error: null },
    });
    await expect(rpcId(ctx, "org_upsert_role", {})).resolves.toBe(
      "11111111-1111-1111-1111-111111111111",
    );
  });
});
