import { describe, expect, it } from "vitest";

import type { supabase } from "@/integrations/supabase/client";
import { CEO_EMAIL, fetchMe, MissingProfileError } from "@/lib/iris";

type Client = typeof supabase;

type FakeOptions = {
  profile?: Record<string, unknown> | null;
  profileError?: Error;
  roles?: Array<{ role: string }>;
  rolesError?: Error;
  permissions?: string[];
  permissionsError?: Error;
  profileSelects?: string[];
};

function fakeClient({
  profile = null,
  profileError,
  roles = [],
  rolesError,
  permissions = [],
  permissionsError,
  profileSelects,
}: FakeOptions = {}): Client {
  const client = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "ceo-id", email: CEO_EMAIL } },
        error: null,
      }),
    },
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: (columns: string) => {
            profileSelects?.push(columns);
            return {
              eq: () => ({
                maybeSingle: async () => ({ data: profile, error: profileError ?? null }),
              }),
            };
          },
        };
      }
      if (table === "user_roles") {
        return {
          select: () => ({
            eq: async () => ({ data: roles, error: rolesError ?? null }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
    rpc: async (name: string) => {
      if (name !== "my_permissions") throw new Error(`Unexpected RPC: ${name}`);
      return { data: permissions, error: permissionsError ?? null };
    },
  };
  return client as unknown as Client;
}

describe("Carga del perfil de IRIS", () => {
  it("distingue un perfil ausente de un fallo de red o permisos", async () => {
    await expect(fetchMe(fakeClient())).rejects.toBeInstanceOf(MissingProfileError);
    await expect(fetchMe(fakeClient({ profileError: new Error("network") }))).rejects.toThrow("network");
  });

  it("conserva el rol CEO y el cambio obligatorio de contraseña del perfil existente", async () => {
    const me = await fetchMe(fakeClient({
      profile: {
        id: "ceo-id",
        email: CEO_EMAIL,
        full_name: "CEO MI POL",
        status: "active",
        must_change_password: true,
        department: { id: "direction-id", code: "direccion", name: "Dirección Ejecutiva" },
      },
      roles: [{ role: "ceo" }],
      permissions: ["view", "manage_users"],
    }));

    expect(me).toMatchObject({
      id: "ceo-id",
      email: CEO_EMAIL,
      status: "active",
      mustChangePassword: true,
      isCeo: true,
    });
    expect(me?.permissions).toEqual(new Set(["view", "manage_users"]));
  });

  it("usa la relación de departamento del perfil, no la del responsable del departamento", async () => {
    const profileSelects: string[] = [];
    await fetchMe(fakeClient({
      profile: {
        id: "ceo-id",
        email: CEO_EMAIL,
        full_name: "CEO MI POL",
        status: "active",
        must_change_password: true,
        department: null,
      },
      profileSelects,
    }));

    expect(profileSelects).toHaveLength(1);
    expect(profileSelects[0]).toContain("department:departments!profiles_department_id_fkey(id,code,name)");
  });

  it("no oculta errores al cargar roles o permisos", async () => {
    const profile = {
      id: "ceo-id",
      email: CEO_EMAIL,
      full_name: "CEO MI POL",
      status: "active",
      must_change_password: true,
      department: null,
    };
    await expect(fetchMe(fakeClient({ profile, rolesError: new Error("roles denied") }))).rejects.toThrow("roles denied");
    await expect(fetchMe(fakeClient({ profile, permissionsError: new Error("permissions denied") }))).rejects.toThrow("permissions denied");
  });
});
