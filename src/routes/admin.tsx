import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  LayoutDashboard,
  Package,
  Palette,
  Search,
  Shield,
  ShoppingCart,
  Star,
  Tags,
  ToggleLeft,
  ToggleRight,
  Users,
  WalletCards,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { formatBRL, formatDate, ORDER_STATUS_LABEL, parseBRLToCents } from "@/lib/format";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administração — Arte & Cores" },
      { name: "description", content: "Central de gestão da plataforma Arte & Cores." },
    ],
  }),
  component: Admin,
});

type Section = "overview" | "artisans" | "products" | "plans" | "categories" | "orders" | "users";

const sections: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "artisans", label: "Artesãos", icon: Palette },
  { id: "products", label: "Produtos", icon: Package },
  { id: "plans", label: "Planos", icon: WalletCards },
  { id: "categories", label: "Categorias", icon: Tags },
  { id: "orders", label: "Pedidos", icon: ShoppingCart },
  { id: "users", label: "Usuários", icon: Users },
];

function Admin() {
  const { user, roles, loading } = useAuth();
  const isAdmin = roles.includes("admin");
  const [section, setSection] = useState<Section>("overview");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-data"],
    enabled: isAdmin,
    queryFn: async () => {
      const [categories, artisans, products, orders, plans, profiles, payments] = await Promise.all([
        supabase.from("categories").select("id,name,slug,active").order("name"),
        supabase.from("artisan_profiles").select("id,user_id,store_name,city,state,featured,created_at").order("store_name"),
        supabase.from("products").select("id,artisan_id,category_id,name,price_cents,stock_quantity,status,sales_count,created_at").order("created_at", { ascending: false }),
        supabase.from("orders").select("id,order_number,status,total_cents,created_at").order("created_at", { ascending: false }).limit(30),
        supabase.from("plans").select("*").order("audience").order("sort_order"),
        supabase.from("profiles").select("id,name,email,city,state,active,created_at").order("created_at", { ascending: false }).limit(100),
        supabase.from("payments").select("id,amount_cents,status,created_at").order("created_at", { ascending: false }).limit(100),
      ]);
      const result = { categories, artisans, products, orders, plans, profiles, payments };
      for (const [name, response] of Object.entries(result)) {
        if (response.error) throw new Error(`${name}: ${response.error.message}`);
      }
      return {
        categories: categories.data ?? [],
        artisans: artisans.data ?? [],
        products: products.data ?? [],
        orders: orders.data ?? [],
        plans: plans.data ?? [],
        profiles: profiles.data ?? [],
        payments: payments.data ?? [],
      };
    },
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["admin-data"] });

  const updateTable = useMutation({
    mutationFn: async ({ table, id, patch }: { table: "categories" | "artisan_profiles" | "products" | "plans" | "profiles"; id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from(table).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar a alteração."),
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Categoria excluída"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível excluir."),
  });

  const [search, setSearch] = useState("");
  const artisans = data?.artisans ?? [];
  const products = data?.products ?? [];
  const profiles = data?.profiles ?? [];
  const filteredArtisans = useMemo(() => artisans.filter((a) => `${a.store_name} ${a.city ?? ""}`.toLowerCase().includes(search.toLowerCase())), [artisans, search]);
  const filteredProducts = useMemo(() => products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())), [products, search]);
  const filteredUsers = useMemo(() => profiles.filter((p) => `${p.name} ${p.email ?? ""}`.toLowerCase().includes(search.toLowerCase())), [profiles, search]);

  if (!loading && (!user || !isAdmin)) {
    return <AppShell><div className="craft-card p-10 text-center"><h1 className="text-lg">Área restrita à administração</h1><Button asChild className="mt-4"><Link to="/">Voltar ao início</Link></Button></div></AppShell>;
  }

  const published = products.filter((p) => p.status === "published").length;
  const activeCategories = (data?.categories ?? []).filter((c) => c.active).length;
  const featured = artisans.filter((a) => a.featured).length;
  const paid = (data?.payments ?? []).filter((p) => p.status === "paid" || p.status === "confirmed");
  const revenue = paid.reduce((sum, p) => sum + p.amount_cents, 0);

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground"><Shield className="h-4 w-4" /> Central administrativa</div>
          <h1 className="font-display text-3xl">Arte & Cores</h1>
          <p className="mt-1 text-sm text-muted-foreground">Controle o marketplace, os artesãos e o conteúdo da plataforma.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs"><CheckCircle2 className="h-4 w-4 text-primary" /> Administrador ativo</div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Usuários" value={profiles.length} />
        <Stat icon={Palette} label="Artesãos" value={artisans.length} extra={`${featured} em destaque`} />
        <Stat icon={Package} label="Produtos publicados" value={published} extra={`${products.length} no total`} />
        <Stat icon={BarChart3} label="Receita registrada" value={formatBRL(revenue)} extra={`${paid.length} pagamentos pagos`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="craft-card h-fit p-2">
          <div className="mb-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gerenciar</div>
          <nav className="grid gap-1">
            {sections.map((item) => {
              const Icon = item.icon;
              return <button key={item.id} type="button" onClick={() => { setSection(item.id); setSearch(""); }} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${section === item.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}><Icon className="h-4 w-4" />{item.label}<ChevronRight className="ml-auto h-4 w-4 opacity-60" /></button>;
            })}
          </nav>
        </aside>

        <main className="min-w-0">
          {isLoading ? <div className="craft-card p-8 text-sm text-muted-foreground">Carregando dados da administração...</div> : null}
          {!isLoading && section === "overview" && <Overview data={data} activeCategories={activeCategories} />}
          {!isLoading && section === "artisans" && <Artisans items={filteredArtisans} search={search} setSearch={setSearch} mutate={updateTable} />}
          {!isLoading && section === "products" && <Products items={filteredProducts} search={search} setSearch={setSearch} mutate={updateTable} />}
          {!isLoading && section === "plans" && <Plans items={data?.plans ?? []} mutate={updateTable} />}
          {!isLoading && section === "categories" && <Categories items={data?.categories ?? []} mutate={updateTable} deleteCategory={deleteCategory} />}
          {!isLoading && section === "orders" && <Orders items={data?.orders ?? []} />}
          {!isLoading && section === "users" && <UsersSection items={filteredUsers} search={search} setSearch={setSearch} mutate={updateTable} />}
        </main>
      </div>
    </AppShell>
  );
}

function Stat({ icon: Icon, label, value, extra }: { icon: typeof Users; label: string; value: string | number; extra?: string }) {
  return <div className="craft-card p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{label}</span><Icon className="h-4 w-4 text-muted-foreground" /></div><p className="mt-2 font-display text-2xl">{value}</p>{extra && <p className="mt-1 text-xs text-muted-foreground">{extra}</p>}</div>;
}

function Overview({ data, activeCategories }: { data: any; activeCategories: number }) {
  const orders = data?.orders ?? [];
  return <div className="grid gap-4 xl:grid-cols-2">
    <section className="craft-card p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="section-title">Resumo da plataforma</h2><p className="text-xs text-muted-foreground">Indicadores atuais do banco.</p></div><BarChart3 className="h-5 w-5 text-muted-foreground" /></div><div className="grid grid-cols-2 gap-3"><Mini label="Categorias ativas" value={activeCategories} /><Mini label="Artesãos" value={data?.artisans.length ?? 0} /><Mini label="Produtos" value={data?.products.length ?? 0} /><Mini label="Pedidos" value={orders.length} /></div></section>
    <section className="craft-card p-5"><h2 className="section-title mb-4">Pedidos recentes</h2><div className="grid gap-2">{orders.slice(0, 7).map((o: any) => <div key={o.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"><span>#{String(o.order_number).padStart(5, "0")} · {formatDate(o.created_at)}</span><span className="flex items-center gap-2"><Badge variant="secondary">{ORDER_STATUS_LABEL[o.status]}</Badge>{formatBRL(o.total_cents)}</span></div>)}</div></section>
  </div>;
}

function Mini({ label, value }: { label: string; value: string | number }) { return <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>; }

function Toolbar({ search, setSearch, placeholder }: { search: string; setSearch: (v: string) => void; placeholder: string }) { return <div className="mb-4 relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={placeholder} className="pl-9" /></div>; }

function Artisans({ items, search, setSearch, mutate }: any) {
  return <section className="craft-card p-5"><Header title="Artesãos" subtitle="Controle as lojas e escolha quem aparece em destaque." /><Toolbar search={search} setSearch={setSearch} placeholder="Buscar por loja ou cidade..." /><div className="grid gap-2">{items.map((a: any) => <div key={a.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><p className="font-semibold">{a.store_name}</p>{a.featured && <Badge><Star className="mr-1 h-3 w-3" /> Destaque</Badge>}</div><p className="text-xs text-muted-foreground">{a.city ?? "Sem cidade"}{a.state ? ` · ${a.state}` : ""}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant={a.featured ? "secondary" : "outline"} onClick={() => mutate.mutate({ table: "artisan_profiles", id: a.id, patch: { featured: !a.featured } })}><Star className="mr-1 h-4 w-4" />{a.featured ? "Remover destaque" : "Destacar"}</Button><Button size="sm" variant="outline" asChild><Link to={`/artesao/${a.id}`}><Eye className="mr-1 h-4 w-4" />Ver loja</Link></Button></div></div>)}{!items.length && <Empty />}</div></section>;
}

function Products({ items, search, setSearch, mutate }: any) {
  return <section className="craft-card p-5"><Header title="Produtos" subtitle="Publique, despublique ou desative peças sem entrar no painel de cada artesão." /><Toolbar search={search} setSearch={setSearch} placeholder="Buscar produto..." /><div className="grid gap-2">{items.map((p: any) => <div key={p.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><p className="font-semibold">{p.name}</p><Badge variant={p.status === "published" ? "secondary" : "outline"}>{p.status === "published" ? "Publicado" : p.status === "inactive" ? "Inativo" : "Rascunho"}</Badge></div><p className="text-xs text-muted-foreground">{formatBRL(p.price_cents)} · estoque {p.stock_quantity} · {p.sales_count} vendas</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => mutate.mutate({ table: "products", id: p.id, patch: { status: p.status === "published" ? "inactive" : "published" } })}>{p.status === "published" ? <><EyeOff className="mr-1 h-4 w-4" />Despublicar</> : <><Eye className="mr-1 h-4 w-4" />Publicar</>}</Button></div></div>)}{!items.length && <Empty />}</div></section>;
}

function Plans({ items, mutate }: any) {
  return <section className="craft-card p-5"><Header title="Planos" subtitle="Edite preços, benefícios e limites dos planos." /><div className="grid gap-3 md:grid-cols-2">{items.map((plan: any) => <div key={plan.id} className="rounded-xl border border-border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{plan.name}</p><p className="text-xs text-muted-foreground">{plan.audience === "artisan" ? "Artesão" : "Cliente"} · {plan.billing_interval}</p></div><Button size="sm" variant={plan.active ? "secondary" : "outline"} onClick={() => mutate.mutate({ table: "plans", id: plan.id, patch: { active: !plan.active } })}>{plan.active ? "Ativo" : "Inativo"}</Button></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><label className="text-xs text-muted-foreground">Preço (R$)<Input defaultValue={(plan.price_cents / 100).toFixed(2).replace(".", ",")} onBlur={(e) => { const value = parseBRLToCents(e.currentTarget.value); if (value !== plan.price_cents) mutate.mutate({ table: "plans", id: plan.id, patch: { price_cents: value } }); }} /></label><label className="text-xs text-muted-foreground">Limite de produtos<Input defaultValue={plan.product_limit ?? ""} placeholder="Ilimitado" onBlur={(e) => { const value = e.currentTarget.value.trim() === "" ? null : Number(e.currentTarget.value); if (value !== plan.product_limit) mutate.mutate({ table: "plans", id: plan.id, patch: { product_limit: value } }); }} /></label></div><p className="mt-3 text-xs text-muted-foreground">Destaque: {plan.boost_priority} · Perfil: {plan.store_profile_level} · Produto em destaque: {plan.product_feature_level}</p></div>)}</div></section>;
}

function Categories({ items, mutate, deleteCategory }: any) {
  return <section className="craft-card p-5"><Header title="Categorias" subtitle="Controle quais categorias aparecem para o público." /><div className="grid gap-2">{items.map((c: any) => <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-4"><div><p className="font-semibold">{c.name}</p><p className="text-xs text-muted-foreground">/{c.slug}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => mutate.mutate({ table: "categories", id: c.id, patch: { active: !c.active } })}>{c.active ? <><ToggleRight className="mr-1 h-4 w-4" />Ativa</> : <><ToggleLeft className="mr-1 h-4 w-4" />Desativada</>}</Button><Button size="sm" variant="ghost" onClick={() => { if (confirm(`Excluir a categoria "${c.name}"?`)) deleteCategory.mutate(c.id); }}>Excluir</Button></div></div>)}</div></section>;
}

function Orders({ items }: any) {
  return <section className="craft-card p-5"><Header title="Pedidos" subtitle="Acompanhe os pedidos mais recentes da plataforma." /><div className="grid gap-2">{items.map((o: any) => <div key={o.id} className="flex flex-col gap-2 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">#{String(o.order_number).padStart(5, "0")}</p><p className="text-xs text-muted-foreground">{formatDate(o.created_at)}</p></div><div className="flex items-center gap-3"><Badge variant="secondary">{ORDER_STATUS_LABEL[o.status]}</Badge><span className="font-semibold">{formatBRL(o.total_cents)}</span></div></div>)}{!items.length && <Empty />}</div></section>;
}

function UsersSection({ items, search, setSearch, mutate }: any) {
  return <section className="craft-card p-5"><Header title="Usuários" subtitle="Ative ou desative contas e pesquise rapidamente pelo cadastro." /><Toolbar search={search} setSearch={setSearch} placeholder="Buscar nome ou e-mail..." /><div className="grid gap-2">{items.map((p: any) => <div key={p.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{p.name || "Sem nome"}</p><p className="text-xs text-muted-foreground">{p.email ?? "Sem e-mail"}{p.city ? ` · ${p.city}` : ""}</p></div><Button size="sm" variant={p.active ? "secondary" : "outline"} onClick={() => mutate.mutate({ table: "profiles", id: p.id, patch: { active: !p.active } })}>{p.active ? "Conta ativa" : "Conta desativada"}</Button></div>)}{!items.length && <Empty />}</div></section>;
}

function Header({ title, subtitle }: { title: string; subtitle: string }) { return <div className="mb-5"><h2 className="section-title">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p></div>; }
function Empty() { return <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhum resultado encontrado.</div>; }
