import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Store, Instagram, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/artesao/$id")({
  head: () => ({
    meta: [
      { title: "Perfil do artesão — Arte & Cores" },
      {
        name: "description",
        content: "Conheça a história do artesão e veja todas as suas peças.",
      },
      {
        property: "og:title",
        content: "Perfil do artesão — Arte & Cores",
      },
      {
        property: "og:description",
        content: "História e peças do artesão.",
      },
    ],
  }),
  component: Artesao,
});

function Artesao() {
  const { id } = Route.useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["artisan", id],
    queryFn: async () => {
      const { data: artisan, error: artisanError } = await supabase
        .from("artisan_profiles")
        .select(
          "id,store_name,bio,city,state,story,specialties,avatar_url,cover_url,instagram,whatsapp",
        )
        .eq("id", id)
        .maybeSingle();

      if (artisanError) throw artisanError;
      if (!artisan) return null;

      const { data: products, error: productsError } = await supabase
        .from("products")
        .select(
          "id,name,price_cents,image_url,rating,rating_count,stock_quantity,origin_city,artisan_profiles(store_name,city)",
        )
        .eq("artisan_id", id)
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (productsError) throw productsError;

      return {
        artisan,
        products: products as unknown as ProductCardData[],
      };
    },
  });

  if (isLoading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <div className="craft-card p-10 text-center">
          <h1 className="text-xl">Não foi possível carregar a loja</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tente novamente em alguns instantes.
          </p>
          <Button asChild className="mt-4">
            <Link to="/lojas">Voltar para lojas</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <div className="craft-card p-10 text-center">
          <h1 className="text-xl">Artesão não encontrado</h1>
          <Button asChild className="mt-4">
            <Link to="/explorar">Explorar peças</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const { artisan, products } = data;

  const instagramUrl = artisan.instagram
    ? artisan.instagram.startsWith("http")
      ? artisan.instagram
      : `https://instagram.com/${artisan.instagram.replace("@", "")}`
    : null;

  const whatsappUrl = artisan.whatsapp
    ? `https://wa.me/${artisan.whatsapp.replace(/\D/g, "")}`
    : null;

  return (
    <AppShell>
      <div className="space-y-6">

        {/* CAPA E PERFIL */}
        <section className="craft-card overflow-hidden">
          <div className="relative h-48 w-full bg-muted sm:h-64">
            {artisan.cover_url ? (
              <img
                src={artisan.cover_url}
                alt={`Capa da loja ${artisan.store_name}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-accent/40">
                <Store className="h-12 w-12 text-muted-foreground" />
              </div>
            )}

            <div className="absolute -bottom-10 left-5">
              <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-background bg-accent shadow-md">
                {artisan.avatar_url ? (
                  <img
                    src={artisan.avatar_url}
                    alt={`Logo da loja ${artisan.store_name}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center">
                    <Store className="h-9 w-9 text-accent-foreground" />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="px-5 pb-5 pt-14">
            <h1 className="text-2xl leading-tight">
              {artisan.store_name}
            </h1>

            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {[artisan.city, artisan.state]
                .filter(Boolean)
                .join(" · ") || "Ceará"}
            </p>

            {artisan.bio && (
              <p className="mt-3 text-sm text-muted-foreground">
                {artisan.bio}
              </p>
            )}

            {artisan.specialties?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {artisan.specialties.map((specialty: string) => (
                  <span
                    key={specialty}
                    className="rounded-full bg-accent px-3 py-1 text-xs text-accent-foreground"
                  >
                    {specialty}
                  </span>
                ))}
              </div>
            )}

            {(instagramUrl || whatsappUrl) && (
              <div className="mt-5 flex flex-wrap gap-2">
                {instagramUrl && (
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={instagramUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Instagram className="mr-2 h-4 w-4" />
                      Instagram
                    </a>
                  </Button>
                )}

                {whatsappUrl && (
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle className="mr-2 h-4 w-4" />
                      WhatsApp
                    </a>
                  </Button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* HISTÓRIA */}
        {artisan.story && (
          <section className="craft-card p-5">
            <h2 className="section-title mb-2">Nossa história</h2>
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {artisan.story}
            </p>
          </section>
        )}

        {/* PRODUTOS */}
        <section>
          <h2 className="section-title mb-3">Peças deste artesão</h2>

          {products.length ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Este artesão ainda não publicou peças. Volte em breve.
            </p>
          )}
        </section>

      </div>
    </AppShell>
  );
}