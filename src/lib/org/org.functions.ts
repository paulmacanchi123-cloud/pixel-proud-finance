// Server functions del módulo. Siguen el patrón de src/lib/admin.functions.ts (createServerFn +
// requireSupabaseAuth + zod). Validan la entrada y delegan en RPC SECURITY DEFINER, donde se
// aplica la autorización real (permiso, anti-escalada, separación de funciones, bitácora).
// No usan la clave de servicio: se ejecutan con el JWT del usuario, por lo que RLS/RPC siempre aplican.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { rpc, rpcId } from "./org.rpc";

const uuid = z.string().uuid();
const reason = z.string().trim().min(5, "Indica un motivo (mínimo 5 caracteres)").max(500);
const code = (min: number, max: number) =>
  z
    .string()
    .trim()
    .toLowerCase()
    .regex(new RegExp(`^[a-z0-9_]{${min},${max}}$`), "Solo a-z, 0-9 y _");

// ---------- Departamentos ----------
export const upsertDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: uuid.nullable(),
        code: code(2, 40),
        name: z.string().trim().min(2).max(120),
        description: z.string().trim().max(600).default(""),
        parentId: uuid.nullable(),
        sortOrder: z.number().int().min(0).max(9999).default(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => ({
    id: await rpcId(context, "org_upsert_department", {
      _id: data.id,
      _code: data.code,
      _name: data.name,
      _description: data.description,
      _parent_id: data.parentId,
      _sort: data.sortOrder,
    }),
  }));

export const setDepartmentActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid, active: z.boolean(), reason }).parse(d))
  .handler(async ({ data, context }) => {
    await rpc(context, "org_set_department_active", {
      _id: data.id,
      _active: data.active,
      _reason: data.reason,
    });
    return { ok: true };
  });

export const setDepartmentHead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ departmentId: uuid, userId: uuid.nullable(), reason }).parse(d))
  .handler(async ({ data, context }) => {
    await rpc(context, "org_set_department_head", {
      _dept: data.departmentId,
      _user: data.userId,
      _reason: data.reason,
    });
    return { ok: true };
  });

// ---------- Cargos ----------
export const upsertPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: uuid.nullable(),
        code: code(2, 50),
        name: z.string().trim().min(2).max(120),
        description: z.string().trim().max(600).default(""),
        departmentId: uuid.nullable(),
        reportsToId: uuid.nullable(),
        responsibilities: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
        isExternal: z.boolean().default(false),
        sortOrder: z.number().int().min(0).max(9999).default(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => ({
    id: await rpcId(context, "org_upsert_position", {
      _id: data.id,
      _code: data.code,
      _name: data.name,
      _description: data.description,
      _department_id: data.departmentId,
      _reports_to_id: data.reportsToId,
      _responsibilities: data.responsibilities,
      _is_external: data.isExternal,
      _sort: data.sortOrder,
    }),
  }));

export const setPositionActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid, active: z.boolean(), reason }).parse(d))
  .handler(async ({ data, context }) => {
    await rpc(context, "org_set_position_active", {
      _id: data.id,
      _active: data.active,
      _reason: data.reason,
    });
    return { ok: true };
  });

export const setPositionRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ positionId: uuid, roleIds: z.array(uuid).max(50) }).parse(d))
  .handler(async ({ data, context }) => {
    await rpc(context, "org_set_position_roles", {
      _position: data.positionId,
      _role_ids: data.roleIds,
    });
    return { ok: true };
  });

export const assignPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        userId: uuid,
        positionId: uuid,
        departmentId: uuid.nullable(),
        isPrimary: z.boolean().default(false),
        endsAt: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable(),
        reason,
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => ({
    id: await rpcId(context, "org_assign_position", {
      _user: data.userId,
      _position: data.positionId,
      _department: data.departmentId,
      _is_primary: data.isPrimary,
      _ends_at: data.endsAt,
      _reason: data.reason,
    }),
  }));

export const endPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ assignmentId: uuid, reason }).parse(d))
  .handler(async ({ data, context }) => {
    await rpc(context, "org_end_position", {
      _assignment: data.assignmentId,
      _reason: data.reason,
    });
    return { ok: true };
  });

// ---------- Roles y permisos ----------
export const upsertRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: uuid.nullable(),
        code: code(3, 50),
        name: z.string().trim().min(2).max(120),
        description: z.string().trim().max(600).default(""),
        isPrivileged: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => ({
    id: await rpcId(context, "org_upsert_role", {
      _id: data.id,
      _code: data.code,
      _name: data.name,
      _description: data.description,
      _is_privileged: data.isPrivileged,
    }),
  }));

export const setRoleActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid, active: z.boolean(), reason }).parse(d))
  .handler(async ({ data, context }) => {
    await rpc(context, "org_set_role_active", {
      _id: data.id,
      _active: data.active,
      _reason: data.reason,
    });
    return { ok: true };
  });

export const setRolePermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        roleId: uuid,
        permissionId: uuid,
        enabled: z.boolean(),
        requireMfa: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await rpc(context, "org_set_role_permission", {
      _role: data.roleId,
      _permission: data.permissionId,
      _enabled: data.enabled,
      _require_mfa: data.requireMfa,
    });
    return { ok: true };
  });

export const assignRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        userId: uuid,
        roleId: uuid,
        departmentId: uuid.nullable(),
        validUntil: z.string().datetime({ offset: true }).nullable(),
        justification: z
          .string()
          .trim()
          .min(10, "Justifica la asignación (mínimo 10 caracteres)")
          .max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => ({
    id: await rpcId(context, "org_assign_role", {
      _user: data.userId,
      _role: data.roleId,
      _department: data.departmentId,
      _valid_until: data.validUntil,
      _justification: data.justification,
    }),
  }));

export const revokeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ assignmentId: uuid, reason }).parse(d))
  .handler(async ({ data, context }) => {
    await rpc(context, "org_revoke_role", { _assignment: data.assignmentId, _reason: data.reason });
    return { ok: true };
  });

export const setUserDeny = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ userId: uuid, permissionId: uuid, deny: z.boolean(), reason }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await rpc(context, "org_set_user_deny", {
      _user: data.userId,
      _permission: data.permissionId,
      _deny: data.deny,
      _reason: data.reason,
    });
    return { ok: true };
  });

// ---------- Excepciones de separación de funciones (solo CEO; lo valida la RPC) ----------
export const createSodException = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        userId: uuid,
        ruleId: uuid,
        justification: z
          .string()
          .trim()
          .min(20, "Justificación de al menos 20 caracteres")
          .max(800),
        days: z.number().int().min(1).max(90),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => ({
    id: await rpcId(context, "org_create_sod_exception", {
      _kind: "rol",
      _user: data.userId,
      _rule: data.ruleId,
      _policy: null,
      _record: null,
      _justification: data.justification,
      _days: data.days,
    }),
  }));

export const revokeSodException = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid, reason }).parse(d))
  .handler(async ({ data, context }) => {
    await rpc(context, "org_revoke_sod_exception", { _id: data.id, _reason: data.reason });
    return { ok: true };
  });

// ---------- Modo de autorización y MFA administrativo (solo CEO; lo valida la RPC) ----------
// 'union' y 'org' se aceptan en el esquema para devolver el error claro del servidor mientras estén BLOQUEADOS.
export const setAuthzMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ mode: z.enum(["legacy", "shadow", "union", "org"]), reason }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await rpc(context, "org_set_authz_mode", { _mode: data.mode, _reason: data.reason });
    return { ok: true };
  });

export const setRequireMfaAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ on: z.boolean(), reason }).parse(d))
  .handler(async ({ data, context }) => {
    await rpc(context, "org_set_require_mfa_admin", { _on: data.on, _reason: data.reason });
    return { ok: true };
  });

// ---------- Departamento de una persona (solo CEO; historial propio en org_change_log) ----------
export const moveUserDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: uuid, departmentId: uuid, reason }).parse(d))
  .handler(async ({ data, context }) => {
    await rpc(context, "org_set_user_department", {
      _user: data.userId,
      _department: data.departmentId,
      _reason: data.reason,
    });
    return { ok: true };
  });
