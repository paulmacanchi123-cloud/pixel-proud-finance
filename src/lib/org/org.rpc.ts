// Capa mínima de llamada a RPC desde el servidor (sin dependencias de TanStack: probable en aislamiento).
// Si la base de datos rechaza una operación por motivos de SEGURIDAD, se registra el intento en una transacción
// NUEVA (la original revirtió y no puede dejar rastro). El registro es de mejor esfuerzo y nunca oculta el error.
export type RpcError = { message: string; code?: string };
export type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: RpcError | null }>;
};
export type Ctx = { supabase: unknown };

// Rechazos de SEGURIDAD (permiso, escalada, conflicto de funciones, MFA…). Los de validación de formato no se registran.
const SECURITY_DENIAL =
  /no autorizado|solo el ceo|escalada|conflicto de funciones|privilegiad|sensibles|separaci[oó]n de funciones|ti mismo|propi[oa]s?\s|mfa|dos pasos|bloqueados|reservad/i;
export function isSecurityDenial(e: RpcError): boolean {
  return e.code === "42501" || SECURITY_DENIAL.test(e.message);
}

export async function rpc(ctx: Ctx, fn: string, args: Record<string, unknown>) {
  const client = ctx.supabase as RpcClient;
  const { data, error } = await client.rpc(fn, args);
  if (error) {
    if (isSecurityDenial(error)) {
      // Transacción NUEVA: el intento rechazado revirtió la anterior y no podía dejar rastro dentro de ella.
      try {
        await client.rpc("org_log_denied", {
          _action: fn.replace(/^org_/, ""),
          _entity: "intento",
          _entity_id: fn,
          _error: error.message,
        });
      } catch {
        /* el registro es de mejor esfuerzo: nunca oculta el error original */
      }
    }
    throw new Error(error.message);
  }
  return data;
}

/** RPC que devuelve el uuid del registro creado/modificado. */
export async function rpcId(ctx: Ctx, fn: string, args: Record<string, unknown>): Promise<string> {
  return String(await rpc(ctx, fn, args));
}
