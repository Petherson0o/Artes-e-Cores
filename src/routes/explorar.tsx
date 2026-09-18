import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SearchX, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Search = {
  q?: string | undefined;
  categoria?: string | undefined;
  ordem?: string | undefined;
  min?: number | undefined;
  max?: number | undefined;
  pagina?: number | undefined;
  disponivel?: boolean | undefined;
};

const PAGE_SIZE = 12;

export const Route = createFileRoute("/explorar")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    q: typeof search["q"] === "string" ? search["q"] : undefined,
    categoria: typeof search["categoria"] === "string" ? search["categoria"] : undefined,
    ordem: typeof search["ordem"] === "string" ? search["ordem"] : undefined,
    min: search["min"] ? Number(search["min"]) : undefined,
    max: search["max"] ? Number(search["max"]) : undefined,
    pagina: search["pagina"] ? Number(search["pagina"]) : undefined,
    disponivel: search["disponivel"] === true || search["disponivel"] === "true",
  }),
  head: () => ({
    meta: [
      { title: "Explorar artesanato — Arte & Cores" },
      {
        name: "description",
        content: "Pesquise e filtre peças artesanais por categoria, preço, avaliação e artesão.",
      },
      { property: "og:title", content: "Explorar artesanato — Arte & Cores" },
      { property: "og:description", content: "Pesquise peças artesanais do Ceará." },
    ],
  }),
  component: Explorar,
});

const productSelect =
  "id,name,description,price_cents,image_url,rating,rating_count,stock_quantity,origin_city,category_id,artisan_profiles!inner(store_name,city)";

function Explorar() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/explorar" });
  const [showFilters, setShowFilters] = useState(false);
  const page = search.pagina ?? 1;

  const { data: categories, isError: categoriesError } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id,slug,name")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const categoryId = categories?.find((c) => c.slug === search.categoria)?.id;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["explore", search, categoryId],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select(productSelect, { count: "exact" })
        .eq("status", "published");

      if (search.q) {
        const term = `%${search.q}%`;
        query = query.or(
          `name.ilike.${term},description.ilike.${term},main_material.ilike.${term},origin_city.ilike.${term}`,
        );
      }
      if (categoryId) query = query.eq("category_id", categoryId);
      if (search.min) query = query.gte("price_cents", Math.round(search.min * 100));
      if (search.max) query = query.lte("price_cents", Math.round(search.max * 100));
      if (search.disponivel) query = query.gt("stock_quantity", 0);

      switch (search.ordem) {
        case "menor":
          query = query.order("price_cents", { ascending: true });
          break;
        case "maior":
          query = query.order("price_cents", { ascending: false });
          break;
        case "vendidos":
          query = query.order("sales_count", { ascending: false });
          break;
        case "avaliados":
          query = query.order("rating", { ascending: false, nullsFirst: false });
          break;
        case "recentes":
          query = query.order("created_at", { ascending: false });
          break;
        default:
          query = query.order("sales_count", { ascending: false }).order("created_at", {
            ascending: false,
          });
      }

      const from = (page - 1) * PAGE_SIZE;
      const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      return { items: data as unknown as ProductCardData[], count: count ?? 0 };
    },
  });

  function update(patch: Partial<Search>) {
    void navigate({ search: (prev) => ({ ...prev, ...patch, pagina: patch.pagina ?? 1 }) });
  }

  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE));

  return (
    <AppShell>
      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl">Explorar</h1>
          <p className="text-sm text-muted-foreground">
            {data?.count ?? 0} peça(s) encontrada(s)
            {search.q ? ` para "${search.q}"` : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowFilters((v) => !v)}>
          <SlidersHorizontal className="mr-1 h-4 w-4" /> Filtros
        </Button>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => update({ categoria: undefined })}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-sm",
            !search.categoria
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card",
          )}
        >
          Todas
        </button>
        {(categories ?? []).map((c) => (
          <button
            key={c.id}
            onClick={() => update({ categoria: c.slug })}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm",
              search.categoria === c.slug
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card",
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      {categoriesError && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          Não foi possível carregar as categorias.
        </div>
      )}

      {showFilters && (
        <div className="craft-card mb-5 grid gap-4 p-4 sm:grid-cols-4">
          <div>
            <Label htmlFor="min">Preço mínimo (R$)</Label>
            <Input
              id="min"
              type="number"
              min={0}
              defaultValue={search.min ?? ""}
              onBlur={(e) => update({ min: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>
          <div>
            <Label htmlFor="max">Preço máximo (R$)</Label>
            <Input
              id="max"
              type="number"
              min={0}
              defaultValue={search.max ?? ""}
              onBlur={(e) => update({ max: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>
          <div>
            <Label>Ordenar por</Label>
            <Select value={search.ordem ?? "relevantes"} onValueChange={(v) => update({ ordem: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevantes">Mais relevantes</SelectItem>
                <SelectItem value="menor">Menor preço</SelectItem>
                <SelectItem value="maior">Maior preço</SelectItem>
                <SelectItem value="vendidos">Mais vendidos</SelectItem>
                <SelectItem value="avaliados">Melhor avaliados</SelectItem>
                <SelectItem value="recentes">Mais recentes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Switch
              id="disp"
              checked={!!search.disponivel}
              onCheckedChange={(v) => update({ disponivel: v })}
            />
            <Label htmlFor="disp">Somente disponíveis</Label>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando peças...</p>
      ) : data?.items.length ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {data.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => update({ pagina: page - 1 })}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => update({ pagina: page + 1 })}
              >
                Próxima
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="craft-card flex flex-col items-center gap-2 p-10 text-center">
          <SearchX className="h-8 w-8 text-muted-foreground" />
          <h2 className="text-lg">Nenhuma peça encontrada</h2>
          <p className="text-sm text-muted-foreground">
            Tente outra palavra ou remova alguns filtros.
          </p>
          <Button variant="outline" onClick={() => void navigate({ search: {} })}>
            Limpar filtros
          </Button>
        </div>
      )}
    </AppShell>
  );
}
