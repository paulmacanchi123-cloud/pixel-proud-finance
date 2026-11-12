// Tipos del módulo Organización y Permisos de IRIS. Reflejan las tablas org_* (ver migraciones).
export const ORG_ACTIONS = [
  "consultar",
  "crear",
  "editar",
  "eliminar",
  "aprobar",
  "exportar",
  "administrar",
  "auditar",
] as const;
export type OrgAction = (typeof ORG_ACTIONS)[number];
export const ORG_SCOPES = ["global", "departamento", "propio"] as const;
export type OrgScope = (typeof ORG_SCOPES)[number];

export const ACTION_LABELS: Record<OrgAction, string> = {
  consultar: "Consultar",
  crear: "Crear",
  editar: "Editar",
  eliminar: "Eliminar",
  aprobar: "Aprobar",
  exportar: "Exportar",
  administrar: "Administrar",
  auditar: "Auditar",
};
export const SCOPE_LABELS: Record<OrgScope, string> = {
  global: "Global",
  departamento: "Departamental",
  propio: "Solo propios",
};

export type Department = {
  id: string;
  code: string;
  name: string;
  description: string;
  sort_order: number;
  parent_id: string | null;
  head_user_id: string | null;
  is_active: boolean;
};
export type Position = {
  id: string;
  code: string;
  name: string;
  description: string;
  department_id: string | null;
  reports_to_id: string | null;
  responsibilities: string[];
  is_external: boolean;
  is_active: boolean;
  sort_order: number;
};
export type OrgRole = {
  id: string;
  code: string;
  name: string;
  description: string;
  is_system: boolean;
  is_privileged: boolean;
  is_active: boolean;
};
export type OrgResource = {
  code: string;
  name: string;
  description: string;
  allowed_actions: OrgAction[];
  allowed_scopes: OrgScope[];
  sort_order: number;
};
export type PermissionDef = {
  id: string;
  resource: string;
  action: OrgAction;
  scope: OrgScope;
  is_sensitive: boolean;
};
export type RolePermission = { role_id: string; permission_id: string; require_mfa: boolean };
export type PositionRole = { position_id: string; role_id: string };
export type SodRule = {
  id: string;
  role_a_id: string;
  role_b_id: string;
  description: string;
  severity: "alta" | "media";
  is_active: boolean;
};
export type SodException = {
  id: string;
  kind: "rol" | "operacion";
  user_id: string;
  rule_id: string | null;
  policy_code: string | null;
  justification: string;
  expires_at: string;
  revoked_at: string | null;
  starts_at: string;
};
export type OrgUser = {
  id: string;
  email: string;
  full_name: string;
  department_id: string | null;
  status: "active" | "suspended" | "disabled";
};
export type UserRoleAssignment = {
  id: string;
  user_id: string;
  role_id: string;
  department_id: string | null;
  justification: string;
  valid_from: string;
  valid_until: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  created_at: string;
};
export type UserPositionAssignment = {
  id: string;
  user_id: string;
  position_id: string;
  department_id: string | null;
  is_primary: boolean;
  starts_at: string;
  ends_at: string | null;
  ended_at: string | null;
  end_reason: string | null;
};
export type MyPermission = {
  resource: string;
  action: OrgAction;
  scope: OrgScope;
  department_id: string | null;
  require_mfa: boolean;
};
export type EffectivePermission = MyPermission & {
  role_code: string;
  role_name: string;
  assignment_id: string | null;
  source: "ceo" | "rol";
};
export type ChangeLogEntry = {
  id: string;
  created_at: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  before_data: unknown;
  after_data: unknown;
  reason: string | null;
  result: "aplicado" | "denegado";
};
export type UserDeny = {
  user_id: string;
  permission_id: string;
  reason: string;
  created_by: string;
  created_at: string;
};
export type UserConflict = {
  rule_id: string;
  role_a_id: string;
  role_b_id: string;
  severity: "alta" | "media";
  description: string;
};

// ---------- Compatibilidad de autorización (migración 0005) ----------
export type AuthzMode = "legacy" | "shadow" | "union" | "org";
export type AuthzConfig = {
  mode: AuthzMode;
  enforcement_unlocked: boolean;
  require_mfa_admin: boolean;
  updated_at: string;
};
export type AuthzDiffRow = {
  user_id: string;
  email: string;
  department_code: string | null;
  perm: string;
  legacy_result: boolean;
  org_result: boolean;
  legacy_source: "usuario" | "departamento" | "ninguno";
  mapped_to: string;
  map_status: string | null;
};
export type ShadowRow = {
  user_id: string;
  email: string | null;
  perm: string;
  legacy_result: boolean;
  org_result: boolean;
  hits: number;
  first_seen: string;
  last_seen: string;
};
export type PlanRow = {
  user_id: string;
  email: string;
  department_code: string | null;
  legacy_perm: string;
  source: "usuario" | "departamento";
  granted: boolean;
  org_resource: string | null;
  org_action: string | null;
  map_status: string;
  proposed_role: string;
  note: string;
};
