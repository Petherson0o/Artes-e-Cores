import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Sparkles, ShieldCheck, TrendingUp, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { categoryImage } from "@/lib/categoryImages";
import hero from "@/assets/hero-xilogravura.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Arte & Cores — Artesanato que conta histórias" },
      {
        name: "description",
        content:
          "Descubra e compre artesanato do Ceará direto de quem faz: cerâmica, têxtil, madeira, palha e decoração.",
      },
      { property: "og:title", content: "Arte & Cores — Artesanato que conta histórias" },
      {
        property: "og:description",
        content: "Artesanato cearense, histórias e tradição em um só lugar.",
      },
    ],
  }),
  component: Index,
});

const productSelect =
  "id,name,price_cents,image_url,rating,rating_count,stock_quantity,origin_city,artisan_profiles(store_name,city)";

function Index() {
  const { user, roles } = useAuth();

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: bestSellers } = useQuery({
    queryKey: ["best-sellers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(productSelect)
        .eq("status", "published")
        .order("sales_count", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data as unknown as ProductCardData[];
    },
  });

  const { data: newest } = useQuery({
    queryKey: ["newest"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(productSelect)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data as unknown as ProductCardData[];
    },
  });

  const { data: artisans } = useQuery({
    queryKey: ["featured-artisans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("artisan_profiles")
        .select("id,store_name,city,state,bio")
        .limit(6);
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell>
      <section className="craft-card overflow-hidden">
        <div className="grid gap-0 md:grid-cols-2">
          <div className="flex flex-col justify-center gap-4 p-6 md:p-10">
            <span className="w-fit rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
              Artesanato do Ceará
            </span>
            <h1 className="text-3xl leading-tight md:text-4xl">Artesanato que conta histórias.</h1>
            <p className="text-muted-foreground">
              Mais que produtos, são histórias, tradição e cultura. Conheça artesãs e artesãos
              cearenses e leve um pedaço do sertão para a sua casa.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="lg">
                <Link to={user ? "/explorar" : "/auth"}>
                  Começar <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/explorar">Explorar artesanatos</Link>
              </Button>
            </div>
          </div>
          <img
            src={hero}
            alt="Ilustração em xilogravura de artesão moldando um vaso de barro no sertão"
            width={1600}
            height={1008}
            className="h-56 w-full object-cover md:h-full"
          />
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="section-title">Categorias</h2>
          <Link to="/categorias" className="text-sm text-primary hover:underline">
            Ver todas
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {(categories ?? []).map((c) => (
            <Link
              key={c.id}
              to="/explorar"
              search={{ categoria: c.slug } as never}
              className="craft-card group overflow-hidden"
            >
              <img
                src={categoryImage(c.slug, c.image_url)}
                alt={c.name}
                loading="lazy"
                className="h-28 w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="p-3">
                <h3 className="text-sm font-semibold">{c.name}</h3>
                <p className="line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <ProductRow title="Mais vendidos" products={bestSellers} />
      <ProductRow title="Novidades" products={newest} />

      {!!artisans?.length && (
        <section className="mt-10">
          <h2 className="section-title mb-3">Artesãos em destaque</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {artisans.map((a) => (
              <Link
                key={a.id}
                to="/artesao/$id"
                params={{ id: a.id }}
                className="craft-card flex gap-3 p-4 transition-shadow hover:shadow-[var(--shadow-lift)]"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                  <Store className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold">{a.store_name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {[a.city, a.state].filter(Boolean).join(" · ") || "Ceará"}
                  </p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{a.bio}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="craft-card mt-10 grid gap-4 p-6 md:grid-cols-[1.2fr_1fr] md:p-8">
        <div>
          <h2 className="section-title">É artesã ou artesão? Venda no Arte &amp; Cores</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Cadastre seus produtos, controle estoque e materiais, calcule o preço justo do seu
            trabalho e acompanhe suas vendas.
          </p>
          <Button asChild className="mt-4">
            <Link to={roles.includes("artisan") ? "/painel" : "/auth"}>
              {roles.includes("artisan") ? "Abrir meu painel" : "Quero vender"}
            </Link>
          </Button>
        </div>
        <ul className="grid gap-3 text-sm">
          <li className="flex gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-primary" /> Vitrine com a cara do seu trabalho
          </li>
          <li className="flex gap-2">
            <TrendingUp className="h-4 w-4 shrink-0 text-primary" /> Precificação com custo,
            materiais e margem
          </li>
          <li className="flex gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" /> Estoque com baixa automática e
            alertas
          </li>
        </ul>
      </section>
    </AppShell>
  );
}

function ProductRow({
  title,
  products,
}: {
  title: string;
  products?: ProductCardData[] | undefined;
}) {
  if (!products?.length) return null;
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-end justify-between">
        <h2 className="section-title">{title}</h2>
        <Link to="/explorar" className="text-sm text-primary hover:underline">
          Ver mais
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
