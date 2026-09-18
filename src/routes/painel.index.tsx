import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Boxes, DollarSign, Package, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/painel/")({
  component: PainelHome,
});

function PainelHome() {
  const { artisanId } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["panel-overview", artisanId],
    enabled: !!artisanId,
    queryFn: async () => {
      const [products, items, materials] = await Promise.all([
        supabase
          .from("products")
          .select("id,name,stock_quantity,minimum_stock,status,price_cents,sales_count")
          .eq("artisan_id", artisanId!),
        supabase
          .from("order_items")
          .select("quantity,subtotal_cents,orders(status,created_at)")
          .eq("artisan_id", artisanId!),
        supabase
          .from("materials")
          .select("id,name,quantity,minimum_quantity")
          .eq("artisan_id", artisanId!),
      ]);
      if (products.error) throw products.error;
      if (items.error) throw items.error;
      if (materials.error) throw materials.error;

      const sold = (items.data ?? []).filter(
        (i) => (i.orders as unknown as { status: string } | null)?.status !== "cancelled",
      );
      const revenue = sold.reduce((s, i) => s + i.subtotal_cents, 0);
      const units = sold.reduce((s, i) => s + i.quantity, 0);

      return {
        products: products.data ?? [],
        lowStock: (products.data ?? []).filter((p) => p.stock_quantity <= p.minimum_stock),
        lowMaterials: (materials.data ?? []).filter((m) => m.quantity <= m.minimum_quantity),
        revenue,
        units,
        orders: sold.length,
      };
    },
  });

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground">Carregando indicadores...</p>;
  }

  const cards = [
    { label: "Faturamento", value: formatBRL(data.revenue), icon: DollarSign },
    { label: "Peças vendidas", value: String(data.units), icon: ShoppingBag },
    { label: "Produtos cadastrados", value: String(data.products.length), icon: Package },
    {
      label: "Publicados",
      value: String(data.products.filter((p) => p.status === "published").length),
      icon: Boxes,
    },
  ];

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="craft-card p-4">
            <c.icon className="h-5 w-5 text-primary" />
            <p className="mt-2 text-xs text-muted-foreground">{c.label}</p>
            <p className="font-display text-xl">{c.value}</p>
          </div>
        ))}
      </div>

      {(data.lowStock.length > 0 || data.lowMaterials.length > 0) && (
        <section className="craft-card border-primary/40 p-4">
          <h2 className="section-title mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-primary" /> Alertas de estoque
          </h2>
          <ul className="grid gap-1 text-sm">
            {data.lowStock.map((p) => (
              <li key={p.id} className="text-muted-foreground">
                <strong className="text-foreground">{p.name}</strong> — apenas {p.stock_quantity}{" "}
                em estoque
              </li>
            ))}
            {data.lowMaterials.map((m) => (
              <li key={m.id} className="text-muted-foreground">
                Material <strong className="text-foreground">{m.name}</strong> — {m.quantity}{" "}
                restante(s)
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="craft-card p-4">
        <h2 className="section-title mb-3">Mais vendidos do seu ateliê</h2>
        {data.products.length ? (
          <ul className="grid gap-2 text-sm">
            {[...data.products]
              .sort((a, b) => b.sales_count - a.sales_count)
              .slice(0, 5)
              .map((p) => (
                <li key={p.id} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">{p.name}</span>
                  <span className="text-muted-foreground">{p.sales_count} venda(s)</span>
                </li>
              ))}
          </ul>
        ) : (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Você ainda não cadastrou produtos.
            </p>
            <Button asChild className="mt-3">
              <Link to="/painel/produtos">Cadastrar primeiro produto</Link>
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
