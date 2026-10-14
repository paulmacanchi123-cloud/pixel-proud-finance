import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Empty } from "@/components/iris/ui";

export const Route = createFileRoute("/_authenticated/aprobaciones")({
  head: () => ({ meta: [{ title: "Aprobaciones · IRIS" }] }),
  component: () => (
    <div>
      <PageHeader title="Aprobaciones" />
      <div className="p-6 md:p-10"><Empty>Esta sección aún no tiene pantalla. La protección en el servidor ya está activa.</Empty></div>
    </div>
  ),
});
