import { Button } from "@/components/ui/button";
import { useState } from "react";
import { PageHeader, Empty } from "@/components/iris/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMe } from "@/lib/iris";
import { useMyOrgPermissions } from "@/lib/org/org.queries";
import { can } from "@/lib/org/authz";
import { AccessProvider } from "./shared";
import { OrgChart } from "./OrgChart";
import { DepartmentsManager } from "./DepartmentsManager";
import { PositionsCatalog } from "./PositionsCatalog";
import { UserAssignments } from "./UserAssignments";
import { PermissionMatrix, RolesEditor } from "./RolesEditor";
import { EffectivePermissions } from "./EffectivePermissions";
import { ChangeHistory } from "./ChangeHistory";
import { MigrationPanel } from "./MigrationPanel";

/** Página del módulo. Cada pestaña se muestra solo si el usuario tiene algún permiso relacionado;
 *  aun así, TODA lectura/escritura se vuelve a validar en la base de datos (RLS + RPC). */
export function OrganizacionPage() {
  const { data: me } = useMe();
  const { data: perms = [], isLoading, error, refetch } = useMyOrgPermissions();
  const [tab, setTab] = useState("organigrama");
  const [matrixRole, setMatrixRole] = useState<string | null>(null);

  if (!me || isLoading) return <p className="p-8 text-muted-foreground">Cargando…</p>;
  if (error) return <div className="p-8"><p role="alert" className="text-destructive">No se pudieron cargar los permisos.</p><Button variant="outline" onClick={() => refetch()}>Reintentar</Button></div>;
  const ceo = me.isCeo;
  const any = (resource: string) =>
    can(perms, resource, "consultar", { isCeo: ceo, anyScope: true, aal2: true });
  const show = {
    org: any("departamentos") || any("cargos") || any("usuarios") || ceo,
    roles: any("roles") || any("permisos") || ceo,
    users:
      any("usuarios") ||
      can(perms, "roles", "administrar", { isCeo: ceo, anyScope: true, aal2: true }) ||
      can(perms, "cargos", "administrar", { isCeo: ceo, anyScope: true, aal2: true }),
    history: ceo || can(perms, "auditoria", "consultar", { anyScope: true, aal2: true }),
  };
  if (!show.org && !show.roles && !show.users && !show.history) {
    return (
      <div>
        <PageHeader title="Departamentos y permisos" />
        <div className="p-6 md:p-10">
          <Empty>No tienes permisos para consultar la estructura organizacional.</Empty>
        </div>
      </div>
    );
  }

  return (
    <AccessProvider isCeo={ceo} userId={me.id} perms={perms}>
      <PageHeader
        title="Departamentos y permisos"
        subtitle="Organización, cargos, roles y control de accesos de MI POL"
      />
      <div className="p-4 md:p-8">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4 h-auto flex-wrap justify-start">
            {show.org && <TabsTrigger value="organigrama">Organigrama</TabsTrigger>}
            {show.org && <TabsTrigger value="departamentos">Departamentos</TabsTrigger>}
            {show.org && <TabsTrigger value="cargos">Cargos</TabsTrigger>}
            {show.users && <TabsTrigger value="usuarios">Usuarios y asignaciones</TabsTrigger>}
            {show.roles && <TabsTrigger value="roles">Roles</TabsTrigger>}
            {show.roles && <TabsTrigger value="matriz">Matriz de permisos</TabsTrigger>}
            {(show.users || show.roles) && (
              <TabsTrigger value="efectivos">Permisos efectivos</TabsTrigger>
            )}
            {show.history && <TabsTrigger value="historial">Historial</TabsTrigger>}
            {ceo && <TabsTrigger value="migracion">Migración</TabsTrigger>}
          </TabsList>
          {show.org && (
            <TabsContent value="organigrama">
              <OrgChart />
            </TabsContent>
          )}
          {show.org && (
            <TabsContent value="departamentos">
              <DepartmentsManager />
            </TabsContent>
          )}
          {show.org && (
            <TabsContent value="cargos">
              <PositionsCatalog />
            </TabsContent>
          )}
          {show.users && (
            <TabsContent value="usuarios">
              <UserAssignments />
            </TabsContent>
          )}
          {show.roles && (
            <TabsContent value="roles">
              <RolesEditor
                onOpenMatrix={(id) => {
                  setMatrixRole(id);
                  setTab("matriz");
                }}
              />
            </TabsContent>
          )}
          {show.roles && (
            <TabsContent value="matriz">
              <PermissionMatrix roleId={matrixRole} onRoleChange={setMatrixRole} />
            </TabsContent>
          )}
          {(show.users || show.roles) && (
            <TabsContent value="efectivos">
              <EffectivePermissions />
            </TabsContent>
          )}
          {show.history && (
            <TabsContent value="historial">
              <ChangeHistory />
            </TabsContent>
          )}
          {ceo && <TabsContent value="migracion"><MigrationPanel /></TabsContent>}
        </Tabs>
      </div>
    </AccessProvider>
  );
}
