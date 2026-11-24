import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Se aíslan red y server functions: esta prueba solo verifica las reglas de la interfaz.
vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
  createServerFn: () => ({}),
}));
vi.mock("@/lib/org/org.functions", () => ({ setRolePermission: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/org/org.queries", () => {
  const q =
    <T,>(data: T) =>
    () => ({ data, isLoading: false, error: null });
  return {
    useOrgRefresh: () => () => Promise.resolve(),
    useRoles: q([
      {
        id: "r1",
        code: "custom",
        name: "Rol personalizado",
        description: "",
        is_system: false,
        is_privileged: false,
        is_active: true,
      },
    ]),
    useResources: q([
      {
        code: "transacciones",
        name: "Transacciones",
        description: "",
        allowed_actions: ["consultar", "aprobar"],
        allowed_scopes: ["global"],
        sort_order: 1,
      },
    ]),
    usePermissionDefs: q([
      {
        id: "p-read",
        resource: "transacciones",
        action: "consultar",
        scope: "global",
        is_sensitive: false,
      },
      {
        id: "p-approve",
        resource: "transacciones",
        action: "aprobar",
        scope: "global",
        is_sensitive: true,
      },
    ]),
    useRolePermissions: q([]),
  };
});

import { PermissionMatrix } from "@/components/org/RolesEditor";
import { AccessProvider } from "@/components/org/shared";
import type { MyPermission } from "@/lib/org/types";

const adminPerms: MyPermission[] = [
  {
    resource: "permisos",
    action: "administrar",
    scope: "global",
    department_id: null,
    require_mfa: false,
  },
];

describe("Matriz de permisos (UI)", () => {
  it("un rol administrativo que no es CEO ve toda la matriz en solo lectura", () => {
    render(
      <AccessProvider isCeo={false} userId="u1" perms={adminPerms}>
        <PermissionMatrix roleId="r1" onRoleChange={() => {}} />
      </AccessProvider>,
    );
    expect((screen.getByTitle("Global") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTitle("Global · sensible") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/solo lectura/i)).toBeTruthy();
  });

  it("sin permiso de administrar permisos: matriz de solo lectura", () => {
    render(
      <AccessProvider isCeo={false} userId="u1" perms={[]}>
        <PermissionMatrix roleId="r1" onRoleChange={() => {}} />
      </AccessProvider>,
    );
    expect((screen.getByTitle("Global") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/solo lectura/i)).toBeTruthy();
  });

  it("CEO: puede editar también los permisos sensibles", () => {
    render(
      <AccessProvider isCeo={true} userId="ceo" perms={[]}>
        <PermissionMatrix roleId="r1" onRoleChange={() => {}} />
      </AccessProvider>,
    );
    expect((screen.getByTitle("Global · sensible") as HTMLButtonElement).disabled).toBe(false);
  });
});
