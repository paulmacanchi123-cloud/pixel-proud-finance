import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  me: { id: "me", isCeo: false } as { id: string; isCeo: boolean } | undefined,
  perms: [] as {
    resource: string;
    action: string;
    scope: string;
    department_id: null;
    require_mfa: boolean;
  }[],
  loading: false,
}));

vi.mock("@/lib/iris", () => ({ useMe: () => ({ data: state.me }) }));
vi.mock("@/lib/org/org.queries", () => ({
  useMyOrgPermissions: () => ({ data: state.perms, isLoading: state.loading }),
}));
for (const [file, name] of [
  ["OrgChart", "OrgChart"],
  ["DepartmentsManager", "DepartmentsManager"],
  ["PositionsCatalog", "PositionsCatalog"],
  ["UserAssignments", "UserAssignments"],
  ["EffectivePermissions", "EffectivePermissions"],
  ["ChangeHistory", "ChangeHistory"],
  ["MigrationPanel", "MigrationPanel"],
] as const) {
  vi.doMock(`@/components/org/${file}`, () => ({ [name]: () => <div>{name}</div> }));
}
vi.mock("@/components/org/RolesEditor", () => ({
  RolesEditor: () => <div>RolesEditor</div>,
  PermissionMatrix: () => <div>PermissionMatrix</div>,
}));
vi.mock("@/components/iris/ui", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
  Empty: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

const perm = (resource: string, action: string, scope = "global") => ({
  resource,
  action,
  scope,
  department_id: null,
  require_mfa: false,
});
const tabs = () => screen.queryAllByRole("tab").map((t) => t.textContent);

async function renderPage() {
  vi.resetModules();
  const { OrganizacionPage } = await import("@/components/org/OrganizacionPage");
  return render(<OrganizacionPage />);
}

describe("Departamentos y Permisos: visibilidad de las secciones según permisos", () => {
  it("CEO: las 8 secciones y la pestaña Migración", async () => {
    state.me = { id: "ceo", isCeo: true };
    state.perms = [];
    state.loading = false;
    await renderPage();
    expect(tabs()).toEqual([
      "Organigrama",
      "Departamentos",
      "Cargos",
      "Usuarios y asignaciones",
      "Roles",
      "Matriz de permisos",
      "Permisos efectivos",
      "Historial",
      "Migración",
    ]);
  });
  it("usuario sin permisos: no ve ninguna sección (denegación por defecto)", async () => {
    state.me = { id: "u", isCeo: false };
    state.perms = [];
    await renderPage();
    expect(tabs()).toEqual([]);
    expect(
      screen.getByText(/No tienes permisos para consultar la estructura organizacional/),
    ).toBeTruthy();
  });
  it("administrador de organización delegado: gestiona estructura y roles, sin Historial ni Migración", async () => {
    state.me = { id: "adm", isCeo: false };
    state.perms = [
      perm("departamentos", "consultar"),
      perm("departamentos", "administrar"),
      perm("cargos", "consultar"),
      perm("cargos", "administrar"),
      perm("roles", "consultar"),
      perm("roles", "administrar"),
      perm("permisos", "consultar"),
      perm("permisos", "administrar"),
      perm("usuarios", "consultar"),
    ];
    await renderPage();
    const t = tabs();
    expect(t).toEqual(
      expect.arrayContaining([
        "Organigrama",
        "Departamentos",
        "Cargos",
        "Usuarios y asignaciones",
        "Roles",
        "Matriz de permisos",
        "Permisos efectivos",
      ]),
    );
    expect(t).not.toContain("Historial");
    expect(t).not.toContain("Migración");
  });
  it("auditor: ve el Historial y las secciones de lectura, nunca Migración", async () => {
    state.me = { id: "aud", isCeo: false };
    state.perms = [
      perm("auditoria", "consultar"),
      perm("roles", "consultar"),
      perm("permisos", "consultar"),
      perm("usuarios", "consultar"),
    ];
    await renderPage();
    expect(tabs()).toContain("Historial");
    expect(tabs()).not.toContain("Migración");
  });
  it("solo con una acción NO relacionada (p. ej. ventas propias) no hay acceso al apartado", async () => {
    state.me = { id: "v", isCeo: false };
    state.perms = [perm("ventas", "consultar", "propio")];
    await renderPage();
    expect(tabs()).toEqual([]);
  });
});
