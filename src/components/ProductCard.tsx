import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, MapPin, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatBRL } from "@/lib/format";
import { AppImage } from "@/components/AppImage";
import { cn } from "@/lib/utils";

export type ProductCardData = {
  id: string;
  name: string;
  price_cents: number;
  image_url: string | null;
  rating: number | null;
  rating_count: number;
  stock_quantity: number;
  origin_city: string | null;
  artisan_profiles?: { store_name: string; city: string | null } | null;
};

export function useFavorites() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["favorites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("favorites").select("product_id");
      if (error) throw error;
      return (data ?? []).map((f) => f.product_id as string);
    },
  });
}

export function FavoriteButton({ productId, className }: { productId: string; className?: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: favorites } = useFavorites();
  const isFav = favorites?.includes(productId) ?? false;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Entre na sua conta para favoritar.");
      if (isFav) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", productId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("favorites")
          .insert({ user_id: user.id, product_id: productId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["favorites"] });
      void qc.invalidateQueries({ queryKey: ["favorite-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <button
      type="button"
      aria-label={isFav ? "Remover dos favoritos" : "Favoritar"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        mutation.mutate();
      }}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-full border border-border bg-card/90 text-foreground transition-colors hover:bg-accent",
        className,
      )}
    >
      <Heart className={cn("h-4 w-4", isFav && "fill-primary text-primary")} />
    </button>
  );
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const soldOut = product.stock_quantity <= 0;
  return (
    <Link
      to="/produto/$id"
      params={{ id: product.id }}
      className="craft-card group relative flex flex-col overflow-hidden transition-shadow hover:shadow-[var(--shadow-lift)]"
    >
      <div className="relative aspect-square overflow-hidden bg-sand">
        <AppImage
          src={product.image_url}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <FavoriteButton productId={product.id} className="absolute top-2 right-2" />
        {soldOut && (
          <span className="absolute bottom-2 left-2 rounded-full bg-foreground/85 px-2 py-0.5 text-[11px] text-background">
            Indisponível
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm leading-snug font-semibold">{product.name}</h3>
        <p className="font-display text-base text-primary">{formatBRL(product.price_cents)}</p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Star className="h-3.5 w-3.5 fill-gold text-gold" />
          {product.rating ? product.rating.toFixed(1).replace(".", ",") : "Novo"}
          {product.rating_count > 0 && <span>({product.rating_count})</span>}
        </div>
        <div className="mt-auto flex min-w-0 items-center gap-1 pt-1 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {product.artisan_profiles?.store_name}
            {product.origin_city || product.artisan_profiles?.city
              ? ` · ${product.origin_city ?? product.artisan_profiles?.city}`
              : ""}
          </span>
        </div>
      </div>
    </Link>
  );
}
