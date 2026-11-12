// Lecturas del módulo. Usan el cliente del navegador, por lo que TODO pasa por RLS:
// si el usuario no tiene permiso, la base devuelve 0 filas o error (no hay datos "ocultos solo en la UI").
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  AuthzConfig,
  AuthzDiffRow,
  PlanRow,
  ShadowRow,
  UserConflict,
  UserDeny,
  ChangeLogEntry,
  Department,
  EffectivePermission,
  MyPermission,
  OrgResource,
  OrgRole,
  OrgUser,
  PermissionDef,
  Position,
  PositionRole,
  RolePermission,
  SodException,
  SodRule,
  UserPositionAssignment,
  UserRoleAssignment,
} from "./types";

// Las tablas org_* aún no figuran en src/integrations/supabase/types.ts (se regenera tras aplicar las migraciones),
// por eso se usa una interfaz mínima sin tipos generados.
type Result = PromiseLike<{ data: unknown; error: { message: string } | null }>;
interface Query extends Result {
  order(column: string, opts?: { ascending: boolean }): Query;
  limit(n: number): Query;
}
interface UntypedDb {
  from(table: string): { select(columns: string): Query };
  rpc(fn: string, args?: Record<string, unknown>): Result;
}
const db = supabase as unknown as UntypedDb;

async function select<T>(table: string, order?: string): Promise<T[]> {
  let q = db.from(table).select("*");
  if (order) q = q.order(order, { ascending: true });
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}
async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export const ORG_KEY = "org";
const k = (...p: unknown[]) => [ORG_KEY, ...p];

export const useMyOrgPermissions = () =>
  useQuery({
    queryKey: k("my-permissions"),
    queryFn: () => call<MyPermission[]>("org_my_permissions"),
  });
export const useDepartments = () =>
  useQuery({
    queryKey: k("departments"),
    queryFn: () => select<Department>("departments", "sort_order"),
  });
export const usePositions = () =>
  useQuery({
    queryKey: k("positions"),
    queryFn: () => select<Position>("org_positions", "sort_order"),
  });
export const useRoles = () =>
  useQuery({ queryKey: k("roles"), queryFn: () => select<OrgRole>("org_roles", "name") });
export const useResources = () =>
  useQuery({
    queryKey: k("resources"),
    queryFn: () => select<OrgResource>("org_resources", "sort_order"),
  });
export const usePermissionDefs = () =>
  useQuery({
    queryKey: k("permission-defs"),
    queryFn: () => select<PermissionDef>("org_permissions"),
  });
export const useRolePermissions = () =>
  useQuery({
    queryKey: k("role-permissions"),
    queryFn: () => select<RolePermission>("org_role_permissions"),
  });
export const usePositionRoles = () =>
  useQuery({
    queryKey: k("position-roles"),
    queryFn: () => select<PositionRole>("org_position_roles"),
  });
export const useSodRules = () =>
  useQuery({ queryKey: k("sod-rules"), queryFn: () => select<SodRule>("org_sod_rules") });
export const useSodExceptions = () =>
  useQuery({
    queryKey: k("sod-exceptions"),
    queryFn: () => select<SodException>("org_sod_exceptions", "created_at"),
  });
export const useOrgUsers = () =>
  useQuery({ queryKey: k("users"), queryFn: () => call<OrgUser[]>("org_list_users") });
export const useRoleAssignments = () =>
  useQuery({
    queryKey: k("role-assignments"),
    queryFn: () => select<UserRoleAssignment>("org_user_roles", "created_at"),
  });
export const usePositionAssignments = () =>
  useQuery({
    queryKey: k("position-assignments"),
    queryFn: () => select<UserPositionAssignment>("org_user_positions", "created_at"),
  });
export const useEffectivePermissions = (userId: string | null) =>
  useQuery({
    queryKey: k("effective", userId),
    enabled: !!userId,
    queryFn: () => call<EffectivePermission[]>("org_user_effective_permissions", { _user: userId }),
  });
export const useChangeLog = (limit = 300) =>
  useQuery({
    queryKey: k("change-log", limit),
    queryFn: async () => {
      const { data, error } = await db
        .from("org_change_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []) as ChangeLogEntry[];
    },
    // al ampliar el límite se siguen mostrando los datos previos mientras llegan los nuevos
    placeholderData: (previous) => previous,
  });

/** Tras cualquier mutación se invalida todo el módulo (permisos efectivos incluidos). */
export function useOrgRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [ORG_KEY] });
}

// ---------- Compatibilidad de autorización (solo CEO; las RPC lo vuelven a validar) ----------
export const useAuthzConfig = (enabled: boolean) =>
  useQuery({
    queryKey: k("authz-config"),
    enabled,
    queryFn: async () => (await call<AuthzConfig[]>("org_get_authz_config"))[0] ?? null,
  });
export const useAuthzDiff = (enabled: boolean) =>
  useQuery({
    queryKey: k("authz-diff"),
    enabled,
    queryFn: () => call<AuthzDiffRow[]>("org_authz_diff"),
  });
export const useShadowReport = (enabled: boolean) =>
  useQuery({
    queryKey: k("shadow-report"),
    enabled,
    queryFn: () => call<ShadowRow[]>("org_shadow_report"),
  });
export const useMigrationPlan = (enabled: boolean) =>
  useQuery({
    queryKey: k("migration-plan"),
    enabled,
    queryFn: () => call<PlanRow[]>("org_migration_plan"),
  });

export const useUserDenies = () =>
  useQuery({
    queryKey: k("user-denies"),
    queryFn: () => select<UserDeny>("org_user_denies", "created_at"),
  });
export const useUserConflicts = (userId: string | null) =>
  useQuery({
    queryKey: k("user-conflicts", userId),
    enabled: !!userId,
    queryFn: () => call<UserConflict[]>("org_user_conflicts", { _user: userId }),
  });
