import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/iris";
import FinanzasApp from "@/components/finance/FinanzasApp";

export const Route = createFileRoute("/_authenticated/finanzas")({
  head: () => ({ meta: [{ title: "Finanzas · IRIS" }, { name: "description", content: "Módulos financieros de MI POL." }] }),
  component: FinanzasPage,
});

function FinanzasPage() {
  const { data: me } = useMe();
  const { data, isLoading, error } = useQuery({
    queryKey: ["finance_state"],
    queryFn: async () => {
      const { data, error } = await supabase.from("finance_state").select("data,version").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: Infinity,
  });
  const lastSaved = useRef<string>("");
  const save = useCallback(async (d: unknown) => {
    const json = JSON.stringify(d);
    if (json === lastSaved.current) return;
    const { error } = await supabase.from("finance_state").update({ data: d as any }).eq("id", 1);
    if (error) toast.error("No se pudo guardar: permisos insuficientes o error de red.");
    else lastSaved.current = json;
  }, []);

  if (isLoading || !me) return <p className="p-8 text-muted-foreground">Cargando datos financieros…</p>;
  if (error || !data) return <p className="p-8 text-muted-foreground">No tienes permiso para ver la información financiera.</p>;
  if (!lastSaved.current) lastSaved.current = JSON.stringify(data.data);
  const canEdit = me.permissions.has("edit");
  return <FinanzasApp initialData={data.data} onSave={canEdit ? save : undefined} readOnly={!canEdit} canExport={me.permissions.has("export")} />;
}
