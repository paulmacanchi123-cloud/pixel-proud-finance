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

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async (): Promise<Me | null> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const [{ data: p }, { data: roles }, { data: perms }] = await Promise.all([
        supabase.from("profiles").select("id,email,full_name,status,must_change_password,department:departments(id,code,name)").eq("id", u.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
        supabase.rpc("my_permissions"),
      ]);
      if (!p) return null;
      return {
        id: p.id,
        email: p.email,
        fullName: p.full_name,
        status: p.status,
        mustChangePassword: p.must_change_password,
        department: (p.department as any) ?? null,
        isCeo: (roles ?? []).some((r) => r.role === "ceo"),
        permissions: new Set((perms ?? []) as Permission[]),
      };
    },
  });
}

export const fmtUSD = (n: number) =>
  (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
export const fmtDateTime = (s: string | null) => (s ? new Date(s).toLocaleString("es-EC") : "—");
