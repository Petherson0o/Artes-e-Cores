import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { categoryImage } from "@/lib/categoryImages";

export const Route = createFileRoute("/categorias")({
  head: () => ({
    meta: [
      { title: "Categorias de artesanato — Arte & Cores" },
      {
        name: "description",
        content: "Cerâmica, têxtil, madeira, palha e decoração: navegue pelas categorias do artesanato cearense.",
      },
      { property: "og:title", content: "Categorias de artesanato — Arte & Cores" },
      { property: "og:description", content: "Navegue pelas categorias do artesanato cearense." },
    ],
  }),
  component: Categorias,
});

function Categorias() {
  const { data, isLoading } = useQuery({
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

  return (
    <AppShell>
      <h1 className="mb-1 text-2xl">Categorias</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Cada categoria guarda um jeito diferente de fazer arte.
      </p>
      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(data ?? []).map((c) => (
          <Link
            key={c.id}
            to="/explorar"
            search={{ categoria: c.slug } as never}
            className="craft-card group overflow-hidden transition-shadow hover:shadow-[var(--shadow-lift)]"
          >
            <img
              src={categoryImage(c.slug, c.image_url)}
              alt={c.name}
              loading="lazy"
              className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="p-4">
              <h2 className="text-lg">{c.name}</h2>
              <p className="text-sm text-muted-foreground">{c.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
