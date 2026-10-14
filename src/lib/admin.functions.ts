import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const CEO_EMAIL = "mipol.company@gmail.com";

const PERMISSIONS = [
  "view", "create", "edit", "delete", "export", "manage_accounts",
  "view_patrimony", "manage_investments", "approve_operations", "manage_users", "view_audit",
] as const;
const permEnum = z.enum(PERMISSIONS);

type Ctx = { supabase: any; userId: string };

async function assertCeo(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("is_ceo", { _user_id: ctx.userId });
  if (error || data !== true) throw new Error("Solo el CEO autorizado puede realizar esta acción.");
}

async function audit(ctx: Ctx, action: string, target: string, details: Record<string, unknown> = {}) {
  await ctx.supabase.rpc("write_audit", { _action: action, _target: target, _details: details as any });
}

async function assertNotDirection(ctx: Ctx, departmentId: string) {
  const { data } = await ctx.supabase.from("departments").select("code").eq("id", departmentId).maybeSingle();
  if (!data) throw new Error("Departamento inválido.");
  if (data.code === "direccion") throw new Error("Dirección Ejecutiva está reservada al CEO.");
}

/** One-time, controlled CEO initialization. Only creates the fixed CEO account, only if no CEO exists. */
export const initializeCeo = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "ceo");
  if ((count ?? 0) > 0) return { status: "exists" as const };
  const password = process.env["IRIS_CEO_INITIAL_PASSWORD"];
  if (!password) return { status: "missing_secret" as const };
  const { error } = await supabaseAdmin.auth.admin.createUser({
    email: CEO_EMAIL,
    password,
    email_confirm: true,
    user_metadata: { full_name: "CEO MI POL" },
  });
  if (error) {
    console.error("initializeCeo", error.message);
    return { status: "error" as const };
  }
  return { status: "created" as const };
});

export const createIrisUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      email: z.string().trim().toLowerCase().email().max(255),
      fullName: z.string().trim().min(2).max(120),
      departmentId: z.string().uuid(),
      tempPassword: z.string().min(10).max(72),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCeo(context);
    await assertNotDirection(context, data.departmentId);
    if (data.email === CEO_EMAIL) throw new Error("Ese correo está reservado.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin.from("profiles").select("id").eq("email", data.email).maybeSingle();
    if (existing) throw new Error("Ya existe un usuario con ese correo.");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.tempPassword,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) throw new Error(error?.message ?? "No se pudo crear el usuario.");
    await supabaseAdmin.from("profiles").update({
      full_name: data.fullName,
      department_id: data.departmentId,
      created_by: context.userId,
      must_change_password: true,
    }).eq("id", created.user.id);
    await audit(context, "user_created", created.user.id, { email: data.email, departmentId: data.departmentId });
    return { id: created.user.id };
  });

export const setUserStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), status: z.enum(["active", "suspended", "disabled"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCeo(context);
    if (data.userId === context.userId) throw new Error("No puedes cambiar tu propio estado.");
    const { error } = await context.supabase.from("profiles").update({ status: data.status }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.status === "active" ? "none" : "876000h",
    });
    await audit(context, "user_status_changed", data.userId, { status: data.status });
    return { ok: true };
  });

export const setUserDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), departmentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCeo(context);
    if (data.userId === context.userId) throw new Error("No puedes modificar tu propio departamento.");
    await assertNotDirection(context, data.departmentId);
    const { error } = await context.supabase.from("profiles").update({ department_id: data.departmentId }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    await audit(context, "user_department_changed", data.userId, { departmentId: data.departmentId });
    return { ok: true };
  });

export const setUserPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ userId: z.string().uuid(), permission: permEnum, mode: z.enum(["grant", "revoke", "inherit"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCeo(context);
    if (data.userId === context.userId) throw new Error("No puedes modificar tus propios permisos.");
    if (data.mode === "inherit") {
      const { error } = await context.supabase.from("user_permissions").delete()
        .eq("user_id", data.userId).eq("permission", data.permission);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("user_permissions").upsert({
        user_id: data.userId, permission: data.permission, granted: data.mode === "grant",
        updated_by: context.userId, updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
    }
    await audit(context, "user_permission_changed", data.userId, { permission: data.permission, mode: data.mode });
    return { ok: true };
  });

export const setDepartmentPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ departmentId: z.string().uuid(), permission: permEnum, enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCeo(context);
    await assertNotDirection(context, data.departmentId);
    const q = data.enabled
      ? context.supabase.from("department_permissions").upsert({ department_id: data.departmentId, permission: data.permission })
      : context.supabase.from("department_permissions").delete().eq("department_id", data.departmentId).eq("permission", data.permission);
    const { error } = await q;
    if (error) throw new Error(error.message);
    await audit(context, "department_permission_changed", data.departmentId, { permission: data.permission, enabled: data.enabled });
    return { ok: true };
  });

export const decideApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), decision: z.enum(["approved", "rejected"]), note: z.string().max(500).default("") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCeo(context);
    const { error } = await context.supabase.from("approvals")
      .update({ status: data.decision, decision_note: data.note }).eq("id", data.id).eq("status", "pending");
    if (error) throw new Error(error.message);
    await audit(context, "approval_decided", data.id, { decision: data.decision });
    return { ok: true };
  });
