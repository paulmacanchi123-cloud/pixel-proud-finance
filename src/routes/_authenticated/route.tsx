import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  LayoutDashboard, Landmark, ClipboardCheck, Users, Building2, ScrollText, ShieldCheck, LogOut, Menu, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe, type Me, type Permission } from "@/lib/iris";
import logo from "@/assets/iris-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: Shell,
});

type NavItem = { to: string; label: string; icon: typeof Users; show: (m: Me) => boolean };
const has = (m: Me, p: Permission) => m.permissions.has(p);
const NAV: NavItem[] = [
  { to: "/panel", label: "Centro de control", icon: LayoutDashboard, show: () => true },
  { to: "/finanzas", label: "Finanzas", icon: Landmark, show: (m) => has(m, "view") },
  { to: "/aprobaciones", label: "Aprobaciones", icon: ClipboardCheck, show: (m) => has(m, "create") || has(m, "approve_operations") },
  { to: "/usuarios", label: "Usuarios", icon: Users, show: (m) => m.isCeo || has(m, "manage_users") },
  { to: "/departamentos", label: "Departamentos y permisos", icon: Building2, show: (m) => m.isCeo },
  { to: "/auditoria", label: "Auditoría", icon: ScrollText, show: (m) => has(m, "view_audit") },
  { to: "/seguridad", label: "Seguridad", icon: ShieldCheck, show: () => true },
];

function Shell() {
  const { data: me, isLoading } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [mfaNeeded, setMfaNeeded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (data && data.nextLevel === "aal2" && data.currentLevel !== "aal2") {
        const { data: f } = await supabase.auth.mfa.listFactors();
        const totp = f?.totp?.[0];
        if (totp) setMfaNeeded(totp.id);
      }
    })();
  }, []);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (isLoading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Cargando IRIS…</div>;
  if (!me) return <Blocked text="Tu cuenta no tiene un perfil válido en IRIS." onSignOut={signOut} />;
  if (me.status !== "active") return <Blocked text="Tu cuenta está suspendida o desactivada. Contacta al CEO." onSignOut={signOut} />;
  if (mfaNeeded) return <MfaChallenge factorId={mfaNeeded} onDone={() => setMfaNeeded(null)} onSignOut={signOut} />;
  if (me.mustChangePassword) return <ForcePassword onSignOut={signOut} />;

  const items = NAV.filter((n) => n.show(me));
  return (
    <div className="flex min-h-screen bg-background">
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-sidebar text-sidebar-foreground transition-transform md:static md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex flex-col items-center gap-2 border-b border-sidebar-border px-4 py-6">
          <img src={logo.url} alt="IRIS" className="h-20 w-20 rounded-full ring-1 ring-sidebar-primary/40" />
          <div className="font-display text-2xl tracking-widest text-sidebar-accent-foreground">IRIS</div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-sidebar-primary">MI POL</div>
        </div>
        <nav className="space-y-1 p-3">
          {items.map((n) => {
            const active = path.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60"}`}>
                <Icon className="h-4 w-4" /> {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute inset-x-0 bottom-0 border-t border-sidebar-border p-4 text-xs">
          <div className="truncate text-sidebar-accent-foreground">{me.fullName || me.email}</div>
          <div className="text-sidebar-primary">{me.isCeo ? "CEO" : me.department?.name ?? "Sin departamento"}</div>
          <button onClick={signOut} className="mt-3 flex items-center gap-2 hover:text-sidebar-accent-foreground"><LogOut className="h-3.5 w-3.5" /> Cerrar sesión</button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-navy/50 md:hidden" onClick={() => setOpen(false)} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b bg-card px-4 py-3 md:hidden">
          <button onClick={() => setOpen(!open)} aria-label="Menú">{open ? <X /> : <Menu />}</button>
          <span className="font-display text-xl text-primary">IRIS</span>
        </header>
        <main className="min-w-0 flex-1 animate-rise"><Outlet /></main>
      </div>
    </div>
  );
}

function Blocked({ text, onSignOut }: { text: string; onSignOut: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="max-w-sm text-muted-foreground">{text}</p>
      <Button variant="outline" onClick={onSignOut}>Cerrar sesión</Button>
    </div>
  );
}

function ForcePassword({ onSignOut }: { onSignOut: () => void }) {
  const qc = useQueryClient();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [current, setCurrent] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 10 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return toast.error("Mínimo 10 caracteres, con letras y números.");
    if (pw !== pw2) return toast.error("Las contraseñas no coinciden.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw, current_password: current } as any);
    if (!error) await supabase.rpc("mark_password_changed");
    setBusy(false);
    if (error) return toast.error(error.message.includes("pwned") || error.message.includes("weak") ? "Contraseña demasiado común; elige otra." : error.message);
    toast.success("Contraseña actualizada.");
    qc.invalidateQueries({ queryKey: ["me"] });
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-silver p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl bg-card p-6 shadow-elegant">
        <h1 className="text-2xl font-semibold text-primary">Cambia tu contraseña</h1>
        <p className="text-sm text-muted-foreground">Estás usando una contraseña temporal. Define una contraseña segura para continuar.</p>
        <div className="space-y-2"><Label>Contraseña actual (temporal)</Label><Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required /></div>
        <div className="space-y-2"><Label>Nueva contraseña</Label><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required /></div>
        <div className="space-y-2"><Label>Repetir nueva contraseña</Label><Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required /></div>
        <Button type="submit" className="w-full" disabled={busy}>Guardar y continuar</Button>
        <button type="button" onClick={onSignOut} className="w-full text-sm text-muted-foreground hover:underline">Cerrar sesión</button>
      </form>
    </div>
  );
}

function MfaChallenge({ factorId, onDone, onSignOut }: { factorId: string; onDone: () => void; onSignOut: () => void }) {
  const [code, setCode] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    if (error) return toast.error("Código incorrecto.");
    onDone();
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-silver p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl bg-card p-6 shadow-elegant">
        <h1 className="text-2xl font-semibold text-primary">Verificación en dos pasos</h1>
        <p className="text-sm text-muted-foreground">Introduce el código de 6 dígitos de tu aplicación autenticadora.</p>
        <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
        <Button type="submit" className="w-full">Verificar</Button>
        <button type="button" onClick={onSignOut} className="w-full text-sm text-muted-foreground hover:underline">Cerrar sesión</button>
      </form>
    </div>
  );
}
