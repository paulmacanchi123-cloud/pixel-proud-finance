import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { initializeCeo } from "@/lib/admin.functions";
import logo from "@/assets/iris-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acceso · IRIS" },
      { name: "description", content: "Acceso privado a IRIS para personal autorizado de MI POL." },
      { property: "og:title", content: "Acceso · IRIS" },
      { property: "og:description", content: "Acceso privado a IRIS." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const init = useServerFn(initializeCeo);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"login" | "reset">("login");

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    let { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error && email.trim().toLowerCase() === "mipol.company@gmail.com") {
      // Controlled one-time CEO initialization (only works if no CEO exists yet).
      const r = await init();
      if (r.status === "created") ({ error } = await supabase.auth.signInWithPassword({ email: email.trim(), password }));
    }
    setBusy(false);
    if (error) return toast.error("Credenciales inválidas o cuenta no habilitada.");
    navigate({ to: "/panel" });
  }

  async function onReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    toast.success("Si la cuenta existe, recibirás un correo para restablecer la contraseña.");
    setMode("login");
  }

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="hidden flex-col items-center justify-center bg-gradient-navy p-10 text-navy-foreground md:flex">
        <img src={logo.url} alt="IRIS" className="h-72 w-72 rounded-full shadow-elegant" />
        <p className="mt-8 text-xs uppercase tracking-[0.3em] text-silver">Inteligencia · Responsabilidad · Inversión · Supervisión</p>
      </section>
      <section className="flex items-center justify-center bg-background p-6">
        <form onSubmit={mode === "login" ? onLogin : onReset} className="animate-rise w-full max-w-sm space-y-5">
          <img src={logo.url} alt="IRIS" className="mx-auto h-24 w-24 rounded-full md:hidden" />
          <div>
            <h1 className="text-3xl font-semibold text-primary">{mode === "login" ? "Acceso privado" : "Recuperar acceso"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "login" ? "No existe registro público. Las cuentas las crea el CEO." : "Te enviaremos un enlace seguro a tu correo."}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {mode === "login" && (
            <div className="space-y-2">
              <Label htmlFor="pw">Contraseña</Label>
              <Input id="pw" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Procesando…" : mode === "login" ? "Entrar" : "Enviar enlace"}
          </Button>
          <button type="button" className="w-full text-center text-sm text-accent hover:underline" onClick={() => setMode(mode === "login" ? "reset" : "login")}>
            {mode === "login" ? "¿Olvidaste tu contraseña?" : "Volver al acceso"}
          </button>
        </form>
      </section>
    </main>
  );
}
