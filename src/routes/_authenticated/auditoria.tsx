import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Empty } from "@/components/iris/ui";

export const Route = createFileRoute("/_authenticated/auditoria")({
  head: () => ({ meta: [{ title: "Auditoría · IRIS" }] }),
  component: () => (
    <div>
      <PageHeader title="Auditoría" />
      <div className="p-6 md:p-10"><Empty>Esta sección aún no tiene pantalla. La protección en el servidor ya está activa.</Empty></div>
    </div>
  ),
});
