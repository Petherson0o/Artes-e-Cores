import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  Filter,
  MapPin,
  Search,
  Sparkles,
  Star,
  Store,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/lojas")({
  head: () => ({
    meta: [
      { title: "Lojas — Arte & Cores" },
      {
        name: "description",
        content:
          "Encontre artesãos e lojas de artesanato do Ceará.",
      },
      {
        property: "og:title",
        content: "Lojas — Arte & Cores",
      },
      {
        property: "og:description",
        content:
          "Encontre artesãos e lojas de artesanato do Ceará.",
      },
    ],
  }),
  component: Lojas,
});

type ArtisanProfile = {
  id: string;
  user_id: string;
  store_name: string;
  bio: string | null;
  story: string | null;
  city: string | null;
  state: string | null;
  specialties: string[];
  avatar_url: string | null;
  cover_url: string | null;
  instagram: string | null;
  whatsapp: string | null;
  featured: boolean;
  created_at: string;
};

type SortOption = "relevance" | "recent" | "name";

function Lojas() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [location, setLocation] = useState("all");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [sort, setSort] = useState<SortOption>("relevance");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const {
    data: stores,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["artisan-stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("artisan_profiles")
        .select(`
          id,
          user_id,
          store_name,
          bio,
          story,
          city,
          state,
          specialties,
          avatar_url,
          cover_url,
          instagram,
          whatsapp,
          featured,
          created_at
        `)
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []) as ArtisanProfile[];
    },
  });

  /*
   * Monta a lista de categorias a partir das especialidades
   * cadastradas nas lojas.
   */
  const categories = useMemo(() => {
    const values = new Set<string>();

    for (const store of stores ?? []) {
      for (const specialty of store.specialties ?? []) {
        const value = specialty?.trim();

        if (value) {
          values.add(value);
        }
      }
    }

    return Array.from(values).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  }, [stores]);

  /*
   * Monta a lista de cidades existentes nas lojas.
   */
  const locations = useMemo(() => {
    const values = new Set<string>();

    for (const store of stores ?? []) {
      const city = store.city?.trim();

      if (city) {
        values.add(city);
      }
    }

    return Array.from(values).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  }, [stores]);

  const filteredStores = useMemo(() => {
    const term = search.trim().toLowerCase();

    const result = (stores ?? []).filter((store) => {
      const content = [
        store.store_name,
        store.bio,
        store.story,
        store.city,
        store.state,
        ...(store.specialties ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !term || content.includes(term);

      const matchesCategory =
        category === "all" ||
        (store.specialties ?? []).some(
          (specialty) =>
            specialty.trim().toLowerCase() ===
            category.trim().toLowerCase(),
        );

      const matchesLocation =
        location === "all" ||
        store.city?.trim().toLowerCase() ===
          location.trim().toLowerCase();

      const matchesFeatured =
        !featuredOnly || store.featured;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesLocation &&
        matchesFeatured
      );
    });

    if (sort === "name") {
      return [...result].sort((a, b) =>
        a.store_name.localeCompare(
          b.store_name,
          "pt-BR",
        ),
      );
    }

    if (sort === "recent") {
      return [...result].sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime(),
      );
    }

    return result;
  }, [
    stores,
    search,
    category,
    location,
    featuredOnly,
    sort,
  ]);

  const featuredStores = filteredStores.filter(
    (store) => store.featured,
  );

  const regularStores = filteredStores.filter(
    (store) => !store.featured,
  );

  const hasActiveFilters =
    category !== "all" ||
    location !== "all" ||
    featuredOnly ||
    sort !== "relevance";

  function clearFilters() {
    setCategory("all");
    setLocation("all");
    setFeaturedOnly(false);
    setSort("relevance");
  }

  return (
    <AppShell>
      <div className="mb-8">
        {/* Cabeçalho */}
        <div className="mb-5 flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Store className="h-5 w-5" />
          </div>

          <div>
            <h1 className="text-3xl">Lojas</h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Conheça os artesãos e encontre peças feitas à mão.
            </p>
          </div>
        </div>

        {/* Busca + botão de filtros */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Buscar loja, artesão, cidade ou especialidade..."
              className="h-11 pl-9"
            />
          </div>

          <Button
            type="button"
            variant={
              filtersOpen || hasActiveFilters
                ? "secondary"
                : "outline"
            }
            className="h-11 shrink-0 gap-2"
            onClick={() =>
              setFiltersOpen((value) => !value)
            }
          >
            <Filter className="h-4 w-4" />

            Filtros

            {hasActiveFilters && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">
                {Number(category !== "all") +
                  Number(location !== "all") +
                  Number(featuredOnly) +
                  Number(sort !== "relevance")}
              </span>
            )}

            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                filtersOpen ? "rotate-180" : ""
              }`}
            />
          </Button>
        </div>

        {/* Filtros rápidos */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {/* Categoria */}
          <FilterSelect
            label="Categorias"
            value={category}
            options={categories}
            allLabel="Todas as categorias"
            onChange={setCategory}
          />

          {/* Localização */}
          <FilterSelect
            label="Localização"
            value={location}
            options={locations}
            allLabel="Todas as cidades"
            onChange={setLocation}
          />

          {/* Destaques */}
          <button
            type="button"
            onClick={() =>
              setFeaturedOnly((value) => !value)
            }
            className={`flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors ${
              featuredOnly
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background hover:bg-muted"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Em destaque
          </button>

          {/* Ordenação */}
          <FilterSelect
            label="Ordenar"
            value={sort}
            options={["recent", "name"]}
            optionLabels={{
              recent: "Mais recentes",
              name: "Nome A–Z",
            }}
            allLabel="Mais relevantes"
            onChange={(value) =>
              setSort(value as SortOption)
            }
          />

          {/* Limpar */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
              Limpar
            </button>
          )}
        </div>

        {/* Painel de filtros */}
        {filtersOpen && (
          <div className="mt-3 craft-card p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-medium">
                  Filtrar lojas
                </h2>

                <p className="text-xs text-muted-foreground">
                  Encontre artesãos pelo tipo de trabalho e
                  localização.
                </p>
              </div>

              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                >
                  Limpar filtros
                </Button>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Categoria */}
              <FilterPanelSelect
                label="Categoria ou especialidade"
                value={category}
                options={categories}
                allLabel="Todas"
                onChange={setCategory}
              />

              {/* Cidade */}
              <FilterPanelSelect
                label="Cidade"
                value={location}
                options={locations}
                allLabel="Todas as cidades"
                onChange={setLocation}
              />

              {/* Ordenação */}
              <FilterPanelSelect
                label="Ordenação"
                value={sort}
                options={[
                  "relevance",
                  "recent",
                  "name",
                ]}
                optionLabels={{
                  relevance: "Mais relevantes",
                  recent: "Mais recentes",
                  name: "Nome A–Z",
                }}
                allLabel="Mais relevantes"
                onChange={(value) =>
                  setSort(value as SortOption)
                }
              />
            </div>

            {/* Somente destaque */}
            <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 hover:bg-muted/50">
              <input
                type="checkbox"
                checked={featuredOnly}
                onChange={(e) =>
                  setFeaturedOnly(e.target.checked)
                }
                className="h-4 w-4 accent-primary"
              />

              <span>
                <span className="block text-sm font-medium">
                  Mostrar somente lojas em destaque
                </span>

                <span className="block text-xs text-muted-foreground">
                  Exibe apenas os artesãos marcados como
                  destaque.
                </span>
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Carregando */}
      {isLoading && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Carregando lojas...
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="craft-card p-6 text-center">
          <p className="font-medium">
            Não foi possível carregar as lojas.
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            Tente atualizar a página.
          </p>
        </div>
      )}

      {!isLoading && !error && (
        <>
          {/* Lojas em destaque */}
          {featuredStores.length > 0 && (
            <section className="mb-10">
              <div className="mb-4">
                <h2 className="text-xl">
                  ✨ Em destaque
                </h2>

                <p className="text-sm text-muted-foreground">
                  Lojas que estão ganhando destaque na Arte
                  & Cores.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {featuredStores.map((store) => (
                  <StoreCard
                    key={store.id}
                    store={store}
                    featured
                  />
                ))}
              </div>
            </section>
          )}

          {/* Todas as lojas */}
          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl">
                  {search || hasActiveFilters
                    ? "Resultados"
                    : "Explore nossas lojas"}
                </h2>

                <p className="text-sm text-muted-foreground">
                  {filteredStores.length}{" "}
                  {filteredStores.length === 1
                    ? "loja encontrada"
                    : "lojas encontradas"}
                </p>
              </div>
            </div>

            {filteredStores.length === 0 ? (
              <div className="craft-card p-10 text-center">
                <Store className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />

                <h3 className="font-medium">
                  Nenhuma loja encontrada
                </h3>

                <p className="mt-1 text-sm text-muted-foreground">
                  Tente mudar a busca ou remover algum filtro.
                </p>

                {(search || hasActiveFilters) && (
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      setSearch("");
                      clearFilters();
                    }}
                  >
                    Limpar busca e filtros
                  </Button>
                )}
              </div>
            ) : (
              <>
                {regularStores.length > 0 && (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {regularStores.map((store) => (
                      <StoreCard
                        key={store.id}
                        store={store}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}

/* =========================================================
   FILTRO EM FORMATO DE BOTÃO
   ========================================================= */

function FilterSelect({
  label,
  value,
  options,
  allLabel,
  onChange,
  optionLabels,
}: {
  label: string;
  value: string;
  options: string[];
  allLabel: string;
  onChange: (value: string) => void;
  optionLabels?: Record<string, string>;
}) {
  const selectedLabel =
    value === "all"
      ? label
      : optionLabels?.[value] ?? value;

  return (
    <div className="relative h-9 shrink-0">
      {/* Select invisível por cima do botão.
          Assim o navegador abre o menu nativo corretamente. */}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={`absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none opacity-0 ${
          value !== "all" ? "pointer-events-auto" : ""
        }`}
      >
        <option value="all">{allLabel}</option>

        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabels?.[option] ?? option}
          </option>
        ))}
      </select>

      {/* Aparência visual do botão */}
      <div
        className={`pointer-events-none flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors ${
          value !== "all"
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-background"
        }`}
      >
        <span className="max-w-44 truncate">
          {selectedLabel}
        </span>

        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
      </div>
    </div>
  );
}

/* =========================================================
   FILTRO DENTRO DO PAINEL
   ========================================================= */

function FilterPanelSelect({
  label,
  value,
  options,
  allLabel,
  onChange,
  optionLabels,
}: {
  label: string;
  value: string;
  options: string[];
  allLabel: string;
  onChange: (value: string) => void;
  optionLabels?: Record<string, string>;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">
        {label}
      </span>

      <div className="relative">
        <select
          value={value}
          onChange={(e) =>
            onChange(e.target.value)
          }
          className="h-10 w-full appearance-none rounded-lg border border-input bg-background px-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">
            {allLabel}
          </option>

          {options.map((option) => (
            <option
              key={option}
              value={option}
            >
              {optionLabels?.[option] ?? option}
            </option>
          ))}
        </select>

        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </label>
  );
}

/* =========================================================
   CARD DA LOJA
   ========================================================= */

function StoreCard({
  store,
  featured = false,
}: {
  store: ArtisanProfile;
  featured?: boolean;
}) {
  const cover =
    store.cover_url ||
    store.avatar_url ||
    "/placeholder.svg";

  const avatar =
    store.avatar_url ||
    "/placeholder.svg";

  return (
    <Link
      to="/artesao/$id"
      params={{ id: store.id }}
      className="craft-card group overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
    >
      {/* Capa */}
      <div className="relative h-36 overflow-hidden bg-muted">
        <img
          src={cover}
          alt=""
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />

        {featured && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium backdrop-blur">
            <Sparkles className="h-3 w-3" />
            Destaque
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent" />

        {/* Logo */}
        <div className="absolute bottom-3 left-4">
          <img
            src={avatar}
            alt={store.store_name}
            className="h-14 w-14 rounded-full border-2 border-background bg-background object-cover shadow-md"
            loading="lazy"
          />
        </div>
      </div>

      {/* Informações */}
      <div className="p-4 pt-8">
        <h3 className="line-clamp-1 text-lg font-medium">
          {store.store_name}
        </h3>

        <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" />

          <span>
            {store.city
              ? `${store.city}${
                  store.state
                    ? `, ${store.state}`
                    : ""
                }`
              : "Ceará"}
          </span>
        </div>

        {/* Especialidades */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(store.specialties ?? [])
            .slice(0, 3)
            .map((specialty) => (
              <span
                key={specialty}
                className="rounded-full bg-muted px-2.5 py-1 text-xs"
              >
                {specialty}
              </span>
            ))}
        </div>

        {store.bio && (
          <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
            {store.bio}
          </p>
        )}

        {/* Rodapé */}
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Star className="h-4 w-4 fill-current" />
            Loja artesanal
          </span>

          <span className="text-sm font-medium text-primary">
            Ver loja →
          </span>
        </div>
      </div>
    </Link>
  );
}