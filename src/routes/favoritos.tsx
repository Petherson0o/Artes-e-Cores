import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/favoritos")({
  head: () => ({
    meta: [
      { title: "Meus favoritos — Arte & Cores" },
      { name: "description", content: "As peças artesanais que você salvou para depois." },
      { property: "og:title", content: "Meus favoritos — Arte & Cores" },
      { property: "og:description", content: "Peças artesanais salvas por você." },
    ],
  }),
  component: Favoritos,
});

function Favoritos() {
  const { user, loading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["favorite-products", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favorites")
        .select(
          "product_id,products(id,name,price_cents,image_url,rating,rating_count,stock_quantity,origin_city,status,artisan_profiles(store_name,city))",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? [])
        .map((f) => f.products as unknown as (ProductCardData & { status: string }) | null)
        .filter((p): p is ProductCardData & { status: string } => !!p && p.status === "published");
    },
  });

  if (!loading && !user) {
    return (
      <AppShell>
        <EmptyState
          title="Entre para ver seus favoritos"
          description="Seus favoritos ficam guardados na sua conta."
          action={<Button asChild><Link to="/auth">Entrar</Link></Button>}
        />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="mb-4 text-2xl">Favoritos</h1>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : data?.length ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {data.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Nenhum favorito ainda"
          description="Toque no coração das peças que você quiser guardar."
          action={<Button asChild><Link to="/explorar">Explorar peças</Link></Button>}
        />
      )}
    </AppShell>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="craft-card flex flex-col items-center gap-2 p-10 text-center">
      <Heart className="h-8 w-8 text-muted-foreground" />
      <h2 className="text-lg">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}
