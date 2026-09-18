import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { AppImage } from "@/components/AppImage";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/carrinho")({
  head: () => ({
    meta: [
      { title: "Carrinho — Arte & Cores" },
      { name: "description", content: "Revise as peças artesanais escolhidas antes de finalizar o pedido." },
      { property: "og:title", content: "Carrinho — Arte & Cores" },
      { property: "og:description", content: "Revise suas peças antes de finalizar." },
    ],
  }),
  component: Carrinho,
});

export type CartRow = {
  id: string;
  quantity: number;
  product_id: string;
  products: {
    id: string;
    name: string;
    price_cents: number;
    image_url: string | null;
    stock_quantity: number;
    status: string;
  } | null;
};

export function useCart() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["cart", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cart_items")
        .select("id,quantity,product_id,products(id,name,price_cents,image_url,stock_quantity,status)")
        .order("created_at");
      if (error) throw error;
      return data as unknown as CartRow[];
    },
  });
}

function Carrinho() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: items, isLoading } = useCart();

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["cart"] });
    void qc.invalidateQueries({ queryKey: ["cart-count"] });
  };

  const updateQty = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const { error } = await supabase.from("cart_items").update({ quantity }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error("Não foi possível atualizar a quantidade."),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cart_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Item removido");
    },
  });

  if (!loading && !user) {
    return (
      <AppShell>
        <div className="craft-card flex flex-col items-center gap-2 p-10 text-center">
          <ShoppingBag className="h-8 w-8 text-muted-foreground" />
          <h1 className="text-lg">Entre para usar o carrinho</h1>
          <Button asChild>
            <Link to="/auth">Entrar</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const valid = (items ?? []).filter((i) => i.products && i.products.status === "published");
  const total = valid.reduce((sum, i) => sum + (i.products?.price_cents ?? 0) * i.quantity, 0);

  return (
    <AppShell>
      <h1 className="mb-4 text-2xl">Carrinho</h1>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : valid.length ? (
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <ul className="grid gap-3">
            {valid.map((item) => {
              const p = item.products!;
              const maxed = item.quantity >= p.stock_quantity;
              return (
                <li key={item.id} className="craft-card flex gap-3 p-3">
                  <Link to="/produto/$id" params={{ id: p.id }} className="shrink-0">
                    <AppImage
                      src={p.image_url}
                      alt={p.name}
                      className="h-20 w-20 rounded-lg object-cover"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold">{p.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {formatBRL(p.price_cents)} · un
                    </p>
                    <p className="font-display text-primary">
                      {formatBRL(p.price_cents * item.quantity)}
                    </p>
                    {maxed && (
                      <p className="text-xs text-muted-foreground">
                        Estoque disponível: {p.stock_quantity}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end justify-between">
                    <Button variant="ghost" size="icon" onClick={() => removeItem.mutate(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center rounded-lg border border-border">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={item.quantity <= 1}
                        onClick={() =>
                          updateQty.mutate({ id: item.id, quantity: item.quantity - 1 })
                        }
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="w-8 text-center text-sm">{item.quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={maxed}
                        onClick={() =>
                          updateQty.mutate({ id: item.id, quantity: item.quantity + 1 })
                        }
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <aside className="craft-card h-fit p-4">
            <h2 className="section-title mb-3">Resumo</h2>
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatBRL(total)}</span>
            </div>
            <div className="hairline my-3" />
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span className="font-display text-primary">{formatBRL(total)}</span>
            </div>
            <Button className="mt-4 w-full" size="lg" onClick={() => navigate({ to: "/checkout" })}>
              Finalizar compra
            </Button>
          </aside>
        </div>
      ) : (
        <div className="craft-card flex flex-col items-center gap-2 p-10 text-center">
          <ShoppingBag className="h-8 w-8 text-muted-foreground" />
          <h2 className="text-lg">Seu carrinho está vazio</h2>
          <Button asChild>
            <Link to="/explorar">Explorar peças</Link>
          </Button>
        </div>
      )}
    </AppShell>
  );
}
