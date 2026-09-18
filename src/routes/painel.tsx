import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { AppShell, PanelShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/painel")({
  head: () => ({
    meta: [
      { title: "Painel do artesão — Arte & Cores" },
      {
        name: "description",
        content: "Gerencie produtos, materiais, custos, estoque e vendas do seu ateliê.",
      },
      { property: "og:title", content: "Painel do artesão — Arte & Cores" },
      { property: "og:description", content: "Gestão do seu ateliê artesanal." },
    ],
  }),
  component: Painel,
});

export const PANEL_TABS = [
  { to: "/painel", label: "Visão geral" },
  { to: "/painel/produtos", label: "Produtos" },
  { to: "/painel/materiais", label: "Materiais" },
  { to: "/painel/custos", label: "Custos" },
  { to: "/painel/estoque", label: "Estoque" },
  { to: "/painel/vendas", label: "Vendas" },
  { to: "/minha-loja", label: "Personalizar minha loja" },
];

function Painel() {
  const { loading, user, roles } = useAuth();

  if (loading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Carregando painel...</p>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <div className="craft-card p-10 text-center">
          <h1 className="text-lg">Entre com sua conta de artesão</h1>
          <Button asChild className="mt-4">
            <Link to="/auth">Entrar</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  if (!roles.includes("artisan")) {
    return (
      <AppShell>
        <div className="craft-card p-10 text-center">
          <h1 className="text-lg">Esta área é exclusiva de artesãos</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Crie uma conta de artesão para cadastrar e vender suas peças.
          </p>
          <Button asChild className="mt-4">
            <Link to="/explorar">Voltar às compras</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <PanelShell title="Painel do artesão" tabs={PANEL_TABS}>
      <div className="mb-5 flex justify-end">
        <Button asChild variant="outline">
          <Link to="/minha-loja">Personalizar minha loja</Link>
        </Button>
      </div>

      <Outlet />
    </PanelShell>
  );
}
