import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "client" | "artisan" | "admin";

export type Profile = {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  city: string | null;
  state: string | null;
  active: boolean;
};

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  artisanId: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [artisanId, setArtisanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadUserData(userId: string | undefined) {
    if (!userId) {
      setProfile(null);
      setRoles([]);
      setArtisanId(null);
      setError(null);
      return;
    }
    const [profileRes, rolesRes, artisanRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("artisan_profiles").select("id").eq("user_id", userId).maybeSingle(),
    ]);
    const firstError = profileRes.error ?? rolesRes.error ?? artisanRes.error;
    if (firstError) {
      console.error("[Auth] Falha ao carregar dados do usuário:", firstError);
      setError(firstError.message);
      return;
    }

    setError(null);
    setProfile((profileRes.data as Profile) ?? null);
    setRoles(((rolesRes.data ?? []) as { role: AppRole }[]).map((r) => r.role));
    setArtisanId((artisanRes.data as { id: string } | null)?.id ?? null);
  }

  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setTimeout(() => {
        void loadUserData(nextSession?.user?.id);
      }, 0);
    });

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      await loadUserData(data.session?.user?.id);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      roles,
      artisanId,
      loading,
      error,
      refresh: () => loadUserData(session?.user?.id),
      signOut: async () => {
        await supabase.auth.signOut();
        setProfile(null);
        setRoles([]);
        setArtisanId(null);
      },
    }),
    [session, profile, roles, artisanId, loading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return ctx;
}

export function useHasRole(role: AppRole) {
  const { roles } = useAuth();
  return roles.includes(role);
}
