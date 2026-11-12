// Equivalencias APROBADAS entre los permisos actuales (enum iris_permission) y el modelo nuevo.
// Espejo de la tabla org_legacy_map (migración 0005); una prueba verifica que no se desalineen.
export type LegacyEquivalence = { perm: string; target: string | null; note: string };

export const LEGACY_MAP: readonly LegacyEquivalence[] = [
  { perm: "view", target: "finanzas:consultar", note: "Lectura de Finanzas (finance_state)." },
  {
    perm: "edit",
    target: "finanzas:editar",
    note: "Escritura de finance_state (registro único: solo alcance global).",
  },
  { perm: "export", target: "finanzas:exportar", note: "Exportación desde Finanzas." },
  {
    perm: "create",
    target: "transacciones:crear",
    note: "Hoy solo habilita crear solicitudes de aprobación.",
  },
  {
    perm: "approve_operations",
    target: "transacciones:aprobar",
    note: "Solo VER solicitudes. La decisión sigue siendo exclusiva del CEO.",
  },
  { perm: "view_audit", target: "auditoria:consultar", note: "Lectura de audit_log." },
  {
    perm: "manage_users",
    target: "usuarios:consultar",
    note: "Solo LEER perfiles. Crear/suspender/mover usuarios es exclusivo del CEO.",
  },
  { perm: "view_patrimony", target: "patrimonio:consultar", note: "Recurso independiente." },
  {
    perm: "manage_investments",
    target: "inversiones:editar",
    note: "Recurso independiente. Sin uso actual en el código.",
  },
  {
    perm: "manage_accounts",
    target: "cuentas:administrar",
    note: "Recurso independiente. Sin uso actual en el código.",
  },
  {
    perm: "delete",
    target: null,
    note: "Sin equivalencia segura: queda denegado en modo org (solo CEO).",
  },
];
