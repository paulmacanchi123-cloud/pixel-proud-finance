import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Se aíslan red y server functions: estas pruebas verifican lo que la interfaz MUESTRA con datos de la base.
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/org/org.functions", () => ({ setUserDeny: vi.fn(), moveUserDepartment: vi.fn() }));

const NOW = Date.now();
const iso = (ms: number) => new Date(NOW + ms).toISOString();
const DAY = 86_400_000;

const { data, q } = vi.hoisted(() => ({
  q:
    <T,>(value: T) =>
    () => ({ data: value, isLoading: false, error: null }),
  data: {
    changeLog: [] as unknown[],
    limits: [] as number[],
    conflicts: [] as unknown[],
    perms: [] as unknown[],
    denies: [] as unknown[],
    assignments: [] as unknown[],
  },
}));

vi.mock("@/lib/org/org.queries", () => ({
  useOrgRefresh: () => () => Promise.resolve(),
  useChangeLog: (limit: number) => {
    data.limits.push(limit);
    return {
      data: data.changeLog.slice(0, limit),
      isLoading: false,
      isFetching: false,
      error: null,
    };
  },
  useOrgUsers: q([
    { id: "me", email: "admin@x", full_name: "Admin Org", department_id: "d1", status: "active" },
    {
      id: "u2",
      email: "vend@x",
      full_name: "Vendedora Uno",
      department_id: "d1",
      status: "active",
    },
  ]),
  useDepartments: q([
    {
      id: "d1",
      code: "comercial",
      name: "Comercial y Ventas",
      description: "",
      sort_order: 1,
      parent_id: null,
      head_user_id: null,
      is_active: true,
    },
  ]),
  usePermissionDefs: q([
    { id: "p1", resource: "ventas", action: "consultar", scope: "propio", is_sensitive: false },
  ]),
  useResources: q([
    {
      code: "ventas",
      name: "Ventas",
      description: "",
      allowed_actions: ["consultar"],
      allowed_scopes: ["propio"],
      sort_order: 1,
    },
  ]),
  useRoles: q([
    {
      id: "r1",
      code: "vendedor",
      name: "Vendedor",
      description: "",
      is_system: false,
      is_privileged: false,
      is_active: true,
    },
    {
      id: "r2",
      code: "auditor",
      name: "Auditor interno",
      description: "",
      is_system: true,
      is_privileged: true,
      is_active: true,
    },
    {
      id: "r3",
      code: "aprob",
      name: "Aprobación",
      description: "",
      is_system: true,
      is_privileged: true,
      is_active: true,
    },
  ]),
  useRoleAssignments: () => ({ data: data.assignments, isLoading: false, error: null }),
  useUserDenies: () => ({ data: data.denies, isLoading: false, error: null }),
  useSodExceptions: q([]),
  useEffectivePermissions: () => ({ data: data.perms, isLoading: false, error: null }),
  useUserConflicts: () => ({ data: data.conflicts, isLoading: false, error: null }),
}));

import { ChangeHistory } from "@/components/org/ChangeHistory";
import { EffectivePermissions } from "@/components/org/EffectivePermissions";
import { RoleUsersDialog } from "@/components/org/RoleUsersDialog";
import { AccessProvider } from "@/components/org/shared";

const asAdmin = (ui: React.ReactElement) =>
  render(
    <AccessProvider isCeo={false} userId="me" perms={[]}>
      {ui}
    </AccessProvider>,
  );

describe("Personas con un rol", () => {
  const role = {
    id: "r1",
    code: "vendedor",
    name: "Vendedor",
    description: "",
    is_system: false,
    is_privileged: false,
    is_active: true,
  };
  const base = {
    department_id: null,
    justification: "Alta en el equipo",
    created_at: iso(-30 * DAY),
    revoke_reason: null,
  };
  const assignments = [
    {
      ...base,
      id: "a1",
      user_id: "u2",
      role_id: "r1",
      valid_from: iso(-20 * DAY),
      valid_until: null,
      revoked_at: null,
    },
    {
      ...base,
      id: "a2",
      user_id: "gone",
      role_id: "r1",
      valid_from: iso(-20 * DAY),
      valid_until: iso(-DAY),
      revoked_at: null,
    },
    {
      ...base,
      id: "a3",
      user_id: "me",
      role_id: "r1",
      valid_from: iso(-20 * DAY),
      valid_until: null,
      revoked_at: iso(-5 * DAY),
      revoke_reason: "Cambio de funciones",
    },
    {
      ...base,
      id: "a4",
      user_id: "u2",
      role_id: "r2",
      valid_from: iso(-20 * DAY),
      valid_until: null,
      revoked_at: null,
    },
  ];
  const users = [
    {
      id: "me",
      email: "admin@x",
      full_name: "Admin Org",
      department_id: "d1",
      status: "active" as const,
    },
    {
      id: "u2",
      email: "vend@x",
      full_name: "Vendedora Uno",
      department_id: "d1",
      status: "active" as const,
    },
  ];

  it("lista solo las asignaciones del rol, con estado, y ordena vigentes primero", () => {
    render(
      <RoleUsersDialog
        role={role}
        assignments={assignments}
        users={users}
        departments={[]}
        onClose={() => {}}
      />,
    );
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("Vendedora Uno")).toBeTruthy();
    expect(within(rows[0]).getByText("Vigente")).toBeTruthy();
    expect(within(rows[1]).getByText("Vencida")).toBeTruthy();
    expect(within(rows[2]).getByText("Revocada")).toBeTruthy();
    expect(screen.getByText("Cambio de funciones")).toBeTruthy();
  });
  it("las personas fuera del alcance de consulta no revelan su identidad", () => {
    render(
      <RoleUsersDialog
        role={role}
        assignments={assignments}
        users={users}
        departments={[]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("(fuera de tu alcance)")).toBeTruthy();
    expect(screen.queryByText("gone")).toBeNull();
  });
  it("indica el conteo de vigentes y el caso vacío", () => {
    const { rerender } = render(
      <RoleUsersDialog
        role={role}
        assignments={assignments}
        users={users}
        departments={[]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/1 vigente\(s\) de 3/)).toBeTruthy();
    rerender(
      <RoleUsersDialog
        role={{ ...role, id: "nadie" }}
        assignments={assignments}
        users={users}
        departments={[]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/Nadie tiene este rol/)).toBeTruthy();
  });
});

describe("Historial", () => {
  const mk = (over: Record<string, unknown>) => ({
    id: String(Math.random()),
    created_at: "2026-10-20T15:00:00.000Z",
    actor_id: "a",
    actor_email: "ceo@x",
    action: "rol.asignar",
    entity: "usuario",
    entity_id: "12345678-aaaa",
    before_data: null,
    after_data: { role: "vendedor" },
    reason: "alta de vendedor",
    result: "aplicado",
    ...over,
  });
  it("muestra actor, fecha, acción y resultado, distinguiendo los intentos denegados", () => {
    data.changeLog = [
      mk({}),
      mk({
        action: "assign_role",
        entity: "intento",
        result: "denegado",
        actor_email: "plain@x",
        reason: "No autorizado: se requiere administrar roles",
      }),
    ];
    render(<ChangeHistory />);
    expect(screen.getByText("ceo@x")).toBeTruthy();
    expect(screen.getByText("plain@x")).toBeTruthy();
    expect(screen.getByText("Aplicado")).toBeTruthy();
    expect(screen.getAllByText("Denegado").length).toBeGreaterThan(0);
    expect(screen.getByText(/2 de 2 registros · 1 intento\(s\) denegado\(s\)/)).toBeTruthy();
  });
  it("filtra por texto y permite limpiar", () => {
    data.changeLog = [
      mk({}),
      mk({ action: "assign_role", entity: "intento", result: "denegado", actor_email: "plain@x" }),
    ];
    render(<ChangeHistory />);
    fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "plain@x" } });
    expect(screen.getByText(/1 de 2 registros/)).toBeTruthy();
    expect(screen.queryByText("ceo@x")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));
    expect(screen.getByText(/2 de 2 registros/)).toBeTruthy();
  });
  it("abre el detalle con antes y después", () => {
    data.changeLog = [
      mk({ before_data: { department_id: "viejo" }, after_data: { department_id: "nuevo" } }),
    ];
    render(<ChangeHistory />);
    fireEvent.click(screen.getByTitle("Ver detalle"));
    expect(screen.getByText(/"viejo"/)).toBeTruthy();
    expect(screen.getByText(/"nuevo"/)).toBeTruthy();
  });
  it("al llegar al límite de 500 avisa de que puede haber más y permite cargar 500 más", () => {
    const many = Array.from({ length: 1200 }, (_, i) =>
      mk({ id: `m${i}`, created_at: new Date(Date.UTC(2026, 9, 1) + i * 1000).toISOString() }),
    );
    data.changeLog = many;
    data.limits.length = 0;
    render(<ChangeHistory />);
    expect(
      screen.getByText(/Se muestran los últimos 500 registros; puede haber más antiguos/),
    ).toBeTruthy();
    expect(
      screen.getByText(/Los filtros se aplican solo sobre los registros cargados/),
    ).toBeTruthy();
    expect(screen.getByText(/500 de 500 registros/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cargar 500 más" }));
    expect(data.limits.at(-1)).toBe(1000);
    expect(screen.getByText(/Se muestran los últimos 1000 registros/)).toBeTruthy();
    expect(screen.getByText(/1000 de 1000 registros/)).toBeTruthy();
  });
  it("solo pinta 200 filas a la vez y permite mostrar más sin perder los filtros cargados", () => {
    data.changeLog = Array.from({ length: 450 }, (_, i) => mk({ id: `r${i}` }));
    render(<ChangeHistory />);
    expect(screen.getAllByRole("row").length - 1).toBe(200);
    expect(screen.getByText(/Mostrando 200 de 450 registros filtrados/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar 200 más" }));
    expect(screen.getAllByRole("row").length - 1).toBe(400);
    fireEvent.click(screen.getByRole("button", { name: "Mostrar 200 más" }));
    expect(screen.getAllByRole("row").length - 1).toBe(450);
    expect(screen.queryByRole("button", { name: /Mostrar/ })).toBeNull();
  }, 60_000);
  it("si hay menos registros que el límite no muestra el aviso", () => {
    data.changeLog = [mk({}), mk({})];
    render(<ChangeHistory />);
    expect(screen.queryByText(/puede haber más antiguos/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Cargar/ })).toBeNull();
  });
  it("en el máximo (5000) deja de ofrecer cargar más e indica cómo continuar", () => {
    data.changeLog = Array.from({ length: 6000 }, (_, i) => mk({ id: `x${i}` }));
    render(<ChangeHistory />);
    for (let i = 0; i < 9; i++)
      fireEvent.click(screen.getByRole("button", { name: "Cargar 500 más" }));
    expect(screen.getByText(/Máximo alcanzado \(5000\)/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cargar 500 más" })).toBeNull();
  }, 120_000);
  it("sin registros visibles muestra un mensaje claro", () => {
    data.changeLog = [];
    render(<ChangeHistory />);
    expect(screen.getByText(/Sin registros visibles/)).toBeTruthy();
  });
});

describe("Permisos efectivos", () => {
  it("muestra origen, alcance, vigencia y restricción MFA", () => {
    data.conflicts = [];
    data.denies = [];
    data.assignments = [
      {
        id: "as1",
        user_id: "me",
        role_id: "r1",
        department_id: null,
        justification: "x",
        valid_from: iso(-DAY),
        valid_until: iso(10 * DAY),
        revoked_at: null,
        revoke_reason: null,
        created_at: iso(-DAY),
      },
    ];
    data.perms = [
      {
        resource: "ventas",
        action: "consultar",
        scope: "propio",
        department_id: null,
        require_mfa: true,
        role_code: "vendedor",
        role_name: "Vendedor",
        assignment_id: "as1",
        source: "rol",
      },
    ];
    asAdmin(<EffectivePermissions />);
    const row = screen.getAllByRole("row")[1];
    expect(within(row).getByText("Ventas")).toBeTruthy();
    expect(within(row).getByText("Consultar")).toBeTruthy();
    expect(within(row).getByText("Solo propios")).toBeTruthy();
    expect(within(row).getByText("Vendedor")).toBeTruthy();
    expect(within(row).getByText(/Hasta/)).toBeTruthy();
    expect(within(row).getByText(/MFA/)).toBeTruthy();
  });
  it("advierte de conflictos sin excepción e indica que los roles no otorgan permisos", () => {
    data.perms = [];
    data.conflicts = [
      {
        rule_id: "x",
        role_a_id: "r2",
        role_b_id: "r3",
        severity: "alta",
        description: "La auditoría debe ser independiente de la aprobación",
      },
    ];
    asAdmin(<EffectivePermissions />);
    const alert = screen.getByRole("alert");
    expect(within(alert).getByText(/Conflicto de funciones sin excepción vigente/)).toBeTruthy();
    expect(within(alert).getByText(/Auditor interno ⟷ Aprobación/)).toBeTruthy();
    expect(within(alert).getByText(/no están otorgando ningún permiso/)).toBeTruthy();
  });
  it("sin permisos: denegación por defecto explícita", () => {
    data.conflicts = [];
    data.perms = [];
    data.assignments = [];
    asAdmin(<EffectivePermissions />);
    expect(screen.getByText(/no tiene permisos efectivos/)).toBeTruthy();
  });
  it("lista las denegaciones individuales con su motivo", () => {
    data.perms = [];
    data.assignments = [];
    data.denies = [
      {
        user_id: "me",
        permission_id: "p1",
        reason: "Investigación interna",
        created_by: "x",
        created_at: iso(-DAY),
      },
    ];
    asAdmin(<EffectivePermissions />);
    expect(screen.getByText(/Investigación interna/)).toBeTruthy();
    expect(screen.getByText(/Ventas · Consultar · Solo propios/)).toBeTruthy();
    // el usuario no puede levantar sus propias restricciones
    expect(screen.queryByRole("button", { name: /Levantar/ })).toBeNull();
  });
  it("el CEO se muestra con su facultad global", () => {
    data.conflicts = [];
    data.denies = [];
    data.assignments = [];
    data.perms = [
      {
        resource: "finanzas",
        action: "editar",
        scope: "global",
        department_id: null,
        require_mfa: false,
        role_code: "ceo",
        role_name: "CEO (facultad global)",
        assignment_id: null,
        source: "ceo",
      },
    ];
    asAdmin(<EffectivePermissions />);
    expect(screen.getByText(/facultad global \(todo salvo «auditar»/)).toBeTruthy();
    expect(screen.getByText("Permanente")).toBeTruthy();
  });
});
