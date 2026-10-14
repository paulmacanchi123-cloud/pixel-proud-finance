import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nueva contraseña · IRIS" },
      { name: "description", content: "Define una nueva contraseña para tu cuenta IRIS." },
      { property: "og:title", content: "Nueva contraseña · IRIS" },
      { property: "og:description", content: "Restablecimiento seguro de contraseña." },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 10) return toast.error("Usa al menos 10 caracteres.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (!error) await supabase.rpc("mark_password_changed");
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Contraseña actualizada.");
    navigate({ to: "/panel" });
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <h1 className="text-3xl font-semibold text-primary">Nueva contraseña</h1>
        <div className="space-y-2">
          <Label htmlFor="pw">Contraseña nueva</Label>
          <Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>Guardar</Button>
      </form>
    </main>
  );
}
