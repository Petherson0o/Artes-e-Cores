import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Home,
  LayoutGrid,
  Heart,
  ShoppingBag,
  User,
  Search,
  LogOut,
  Store,
  Shield,
  Package,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function useCartCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["cart-count", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return 0;

      const { count } = await supabase
        .from("cart_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      return count ?? 0;
    },
  });
}

const navItems = [
  { to: "/", label: "Início", icon: Home },
  { to: "/categorias", label: "Categorias", icon: LayoutGrid },
  { to: "/lojas", label: "Lojas", icon: Store },
  { to: "/favoritos", label: "Favoritos", icon: Heart },
  { to: "/carrinho", label: "Carrinho", icon: ShoppingBag },
  { to: "/perfil", label: "Perfil", icon: User },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();

  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });

  const [term, setTerm] = useState("");
  const { data: cartCount } = useCartCount();

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();

    void navigate({
      to: "/explorar",
      search: { q: term || undefined } as never,
    });
  }

  return (
    <div className="paper min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur">
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:flex sm:justify-between">
          <Link to="/" className="min-w-0">
            <Logo />
          </Link>

          <form onSubmit={submitSearch} className="hidden flex-1 px-6 sm:block">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Buscar artesanato, artesão, cidade..."
                className="pl-9"
                aria-label="Buscar"
              />
            </div>
          </form>

          <nav className="flex shrink-0 items-center gap-1">
            {/* Painel do artesão */}
            {roles.includes("artisan") && (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="hidden sm:inline-flex"
              >
                <Link to="/painel">
                  <Store className="mr-1 h-4 w-4" />
                  Painel
                </Link>
              </Button>
            )}

            {/* Admin */}
            {roles.includes("admin") && (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="hidden sm:inline-flex"
              >
                <Link to="/admin">
                  <Shield className="mr-1 h-4 w-4" />
                  Admin
                </Link>
              </Button>
            )}

            {/* Lojas */}
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
            >
              <Link to="/lojas">
                <Store className="mr-1 h-4 w-4" />
                Lojas
              </Link>
            </Button>

            {/* Favoritos */}
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="hidden sm:inline-flex"
            >
              <Link to="/favoritos" aria-label="Favoritos">
                <Heart className="h-5 w-5" />
              </Link>
            </Button>

            {/* Perfil */}
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="hidden sm:inline-flex"
            >
              <Link to="/perfil" aria-label="Perfil">
                <User className="h-5 w-5" />
              </Link>
            </Button>

            {/* Carrinho */}
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="relative hidden sm:inline-flex"
            >
              <Link to="/carrinho" aria-label="Carrinho">
                <ShoppingBag className="h-5 w-5" />

                {!!cartCount && (
                  <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
                    {cartCount}
                  </span>
                )}
              </Link>
            </Button>

            {/* Login / Logout */}
            {user ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Sair"
                onClick={async () => {
                  await signOut();
                  void navigate({ to: "/" });
                }}
              >
                <LogOut className="h-5 w-5" />
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link to="/auth">Entrar</Link>
              </Button>
            )}
          </nav>
        </div>

        {/* Busca no celular */}
        <form onSubmit={submitSearch} className="px-4 pb-3 sm:hidden">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="O que você procura hoje?"
              className="pl-9"
              aria-label="Buscar"
            />
          </div>
        </form>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-4 pb-28 sm:pb-12">
        {children}
      </main>

      <footer className="hidden border-t border-border bg-card/60 py-8 sm:block">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 text-sm text-muted-foreground">
          <Logo />

          <p>Mais que produtos, são histórias, tradição e cultura.</p>

          <p className="text-xs">
            Artesanato do Ceará — projeto acadêmico Arte &amp; Cores.
          </p>
        </div>
      </footer>

      {/* Navegação inferior no celular */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur sm:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-6">
          {navItems.map((item) => {
            const active =
              item.to === "/"
                ? pathname === "/"
                : pathname === item.to ||
                  pathname.startsWith(`${item.to}/`);

            const Icon = item.icon;

            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2 text-[10px]",
                    active
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  <span className="relative">
                    <Icon className="h-5 w-5" />

                    {item.to === "/carrinho" && !!cartCount && (
                      <span className="absolute -top-1 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
                        {cartCount}
                      </span>
                    )}
                  </span>

                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export function PanelShell({
  children,
  title,
  tabs,
}: {
  children: ReactNode;
  title: string;
  tabs: { to: string; label: string }[];
}) {
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });

  return (
    <AppShell>
      <div className="mb-5 flex min-w-0 items-center gap-2">
        <Package className="h-5 w-5 shrink-0 text-primary" />

        <h1 className="truncate text-2xl">{title}</h1>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors",
              pathname === t.to
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-accent",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {children}
    </AppShell>
  );
}