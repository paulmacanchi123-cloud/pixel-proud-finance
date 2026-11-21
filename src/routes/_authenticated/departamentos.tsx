import { createFileRoute } from "@tanstack/react-router";
import { OrganizacionPage } from "@/components/org/OrganizacionPage";

export const Route = createFileRoute("/_authenticated/departamentos")({
  head: () => ({ meta: [
    { title: "Departamentos y permisos · IRIS" },
    { name: "description", content: "Organización, cargos, roles y asignaciones autorizadas de MI POL." },
    { property: "og:title", content: "Departamentos y permisos · IRIS" },
    { property: "og:description", content: "Gestión de departamentos y accesos de MI POL." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: OrganizacionPage,
});
