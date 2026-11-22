import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Permission =
  | "view" | "create" | "edit" | "delete" | "export" | "manage_accounts"
  | "view_patrimony" | "manage_investments" | "approve_operations" | "manage_users" | "view_audit";

export const PERMISSION_LABELS: Record<Permission, string> = {
  view: "Ver información",
  create: "Crear registros",
  edit: "Editar registros",
  delete: "Eliminar registros",
  export: "Exportar información",
  manage_accounts: "Administrar cuentas",
  view_patrimony: "Consultar patrimonio",
  manage_investments: "Gestionar inversiones",
  approve_operations: "Aprobar operaciones",
  manage_users: "Administrar usuarios y roles",
  view_audit: "Consultar auditoría",
};
export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as Permission[];

export const STATUS_LABELS = { active: "Activa", suspended: "Suspendida", disabled: "Desactivada" } as const;

export type Me = {
  id: string;
  email: string;
  fullName: string;
  status: "active" | "suspended" | "disabled";
  mustChangePassword: boolean;
  department: { id: string; code: string; name: string } | null;
  isCeo: boolean;
  permissions: Set<Permission>;
};

export const CEO_EMAIL = "mipol.company@gmail.com";

export class MissingProfileError extends Error {
  readonly email: string;

  constructor(email: string) {
    super("No existe un perfil para este usuario.");
    this.name = "MissingProfileError";
    this.email = email;
  }
}

export async function fetchMe(client: typeof supabase = supabase): Promise<Me | null> {
  const { data: u, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!u.user) return null;

  const [profileResult, rolesResult, permissionsResult] = await Promise.all([
    client.from("profiles").select("id,email,full_name,status,must_change_password,department:departments!profiles_department_id_fkey(id,code,name)").eq("id", u.user.id).maybeSingle(),
    client.from("user_roles").select("role").eq("user_id", u.user.id),
    client.rpc("my_permissions"),
  ]);
  if (profileResult.error) throw profileResult.error;
  if (rolesResult.error) throw rolesResult.error;
  if (permissionsResult.error) throw permissionsResult.error;

  const p = profileResult.data;
  if (!p) throw new MissingProfileError(u.user.email ?? "");
  const roles = rolesResult.data ?? [];
  const permissions = permissionsResult.data ?? [];
  return {
    id: p.id,
    email: p.email,
    fullName: p.full_name,
    status: p.status,
    mustChangePassword: p.must_change_password,
    department: (p.department as any) ?? null,
    isCeo: roles.some((r) => r.role === "ceo"),
    permissions: new Set(permissions as Permission[]),
  };
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => fetchMe(),
    retry: (failureCount, error) => !(error instanceof MissingProfileError) && failureCount < 2,
  });
}

export const fmtUSD = (n: number) =>
  (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
export const fmtDateTime = (s: string | null) => (s ? new Date(s).toLocaleString("es-EC") : "—");
