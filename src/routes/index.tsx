import { createFileRoute, Link } from "@tanstack/react-router";
import logo from "@/assets/iris-logo.png.asset.json";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IRIS · Plataforma financiera de MI POL" },
      { name: "description", content: "Inteligencia, Responsabilidad, Inversión y Supervisión para la administración financiera de MI POL." },
      { property: "og:title", content: "IRIS · Plataforma financiera de MI POL" },
      { property: "og:description", content: "Inteligencia, Responsabilidad, Inversión y Supervisión." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-navy px-6 text-navy-foreground">
      <img src={logo.url} alt="Logotipo IRIS" className="animate-rise h-56 w-56 rounded-full shadow-elegant ring-1 ring-silver/40 md:h-72 md:w-72" />
      <h1 className="animate-rise mt-8 text-center text-4xl font-semibold tracking-wide md:text-5xl">IRIS</h1>
      <p className="animate-rise mt-3 max-w-md text-center text-sm uppercase tracking-[0.3em] text-silver">
        Inteligencia · Responsabilidad · Inversión · Supervisión
      </p>
      <Button asChild size="lg" variant="secondary" className="animate-rise mt-10 px-10">
        <Link to="/auth">Acceso privado</Link>
      </Button>
      <p className="mt-6 text-xs text-silver/80">Uso exclusivo del personal autorizado de MI POL.</p>
    </main>
  );
}
