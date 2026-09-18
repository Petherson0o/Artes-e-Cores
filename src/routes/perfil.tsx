import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Camera,
  Check,
  Heart,
  LogOut,
  MapPin,
  Package,
  Save,
  Shield,
  Store,
  User,
  X,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Meu perfil — Arte & Cores" },
      {
        name: "description",
        content: "Gerencie seus dados, foto, endereços e configurações.",
      },
      {
        property: "og:title",
        content: "Meu perfil — Arte & Cores",
      },
      {
        property: "og:description",
        content: "Gerencie seus dados pessoais e sua conta.",
      },
    ],
  }),
  component: Perfil,
});

const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Informe seu nome")
    .max(80, "O nome deve ter no máximo 80 caracteres"),
  phone: z
    .string()
    .trim()
    .max(20, "Telefone inválido")
    .optional(),
  city: z
    .string()
    .trim()
    .max(60, "Cidade muito longa")
    .optional(),
  state: z
    .string()
    .trim()
    .max(2, "UF inválida")
    .optional(),
});

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(6, "A senha precisa ter pelo menos 6 caracteres"),
    confirmation: z.string(),
  })
  .refine((data) => data.password === data.confirmation, {
    message: "As senhas não coincidem",
    path: ["confirmation"],
  });

type ProfileForm = {
  name: string;
  phone: string;
  city: string;
  state: string;
};

type ProfileWithPhone = {
  name?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  avatar_url?: string | null;
};

function formatPhone(value: string) {
  const numbers = value.replace(/\D/g, "").slice(0, 11);

  if (numbers.length <= 2) {
    return numbers.length ? `(${numbers}` : "";
  }

  if (numbers.length <= 7) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  }

  if (numbers.length <= 10) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(
      6,
    )}`;
  }

  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(
    7,
  )}`;
}

function getInitials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.split("@")[0] || "U";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    const first = parts[0] ?? "";
    const last = parts[parts.length - 1] ?? "";

    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function Perfil() {
  const { user, profile, roles, loading, signOut, refresh } = useAuth();

  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<ProfileForm>({
    name: "",
    phone: "",
    city: "",
    state: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    password: "",
    confirmation: "",
  });

  const [passwordErrors, setPasswordErrors] = useState<
    Record<string, string>
  >({});

  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const typedProfile = profile as ProfileWithPhone | null;

  useEffect(() => {
    if (!profile) return;

    setForm({
      name: typedProfile?.name ?? "",
      phone: typedProfile?.phone ?? "",
      city: typedProfile?.city ?? "",
      state: typedProfile?.state ?? "",
    });
  }, [profile]);

  const { data: addresses = [], isLoading: loadingAddresses } = useQuery({
    queryKey: ["addresses", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false });

      if (error) throw error;

      return data ?? [];
    },
  });

  const { data: notifications = [], isLoading: loadingNotifications } =
    useQuery({
      queryKey: ["notifications", user?.id],
      enabled: !!user,
      queryFn: async () => {
        if (!user) return [];

        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (error) throw error;

        return data ?? [];
      },
    });

  const { data: orderCount = 0 } = useQuery({
    queryKey: ["profile-order-count", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return 0;

      const { count, error } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (error) throw error;

      return count ?? 0;
    },
  });

  const { data: favoriteCount = 0 } = useQuery({
    queryKey: ["profile-favorite-count", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return 0;

      const { count, error } = await supabase
        .from("favorites")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (error) throw error;

      return count ?? 0;
    },
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      const parsed = profileSchema.safeParse(form);

      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};

        parsed.error.issues.forEach((issue) => {
          const field = issue.path[0];

          if (typeof field === "string") {
            fieldErrors[field] = issue.message;
          }
        });

        setErrors(fieldErrors);

        throw new Error("Confira os campos preenchidos.");
      }

      setErrors({});

      const profileUpdate = {
        name: parsed.data.name,
        phone: parsed.data.phone || null,
        city: parsed.data.city || null,
        state: parsed.data.state
          ? parsed.data.state.toUpperCase()
          : null,
      };

      const { error } = await supabase
        .from("profiles")
        .update(profileUpdate as never)
        .eq("id", user.id);

      if (error) throw error;
    },

    onSuccess: async () => {
      await refresh();

      queryClient.invalidateQueries({
        queryKey: ["profile-order-count", user?.id],
      });

      toast.success("Perfil atualizado com sucesso!");
    },

    onError: (error) => {
      if (error.message !== "Confira os campos preenchidos.") {
        toast.error(`Não foi possível salvar: ${error.message}`);
      }
    },
  });

  const changePassword = useMutation({
    mutationFn: async () => {
      const parsed = passwordSchema.safeParse(passwordForm);

      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};

        parsed.error.issues.forEach((issue) => {
          const field = issue.path[0];

          if (typeof field === "string") {
            fieldErrors[field] = issue.message;
          }
        });

        setPasswordErrors(fieldErrors);

        throw new Error("Confira os campos da senha.");
      }

      setPasswordErrors({});

      const { error } = await supabase.auth.updateUser({
        password: parsed.data.password,
      });

      if (error) throw error;
    },

    onSuccess: () => {
      setPasswordForm({
        password: "",
        confirmation: "",
      });

      setShowPasswordForm(false);

      toast.success("Senha alterada com sucesso!");
    },

    onError: (error) => {
      if (error.message !== "Confira os campos da senha.") {
        toast.error(`Não foi possível alterar a senha: ${error.message}`);
      }
    },
  });

  const markNotificationRead = useMutation({
    mutationFn: async (notificationId: string) => {
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      const { error } = await supabase
        .from("notifications")
        .update({
          read: true,
        })
        .eq("id", notificationId)
        .eq("user_id", user.id);

      if (error) throw error;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["notifications", user?.id],
      });
    },

    onError: (error) => {
      toast.error(`Não foi possível marcar como lida: ${error.message}`);
    },
  });

  const removeAddress = useMutation({
    mutationFn: async (addressId: string) => {
      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      const { error } = await supabase
        .from("addresses")
        .delete()
        .eq("id", addressId)
        .eq("user_id", user.id);

      if (error) throw error;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["addresses", user?.id],
      });

      toast.success("Endereço removido.");
    },

    onError: (error) => {
      toast.error(`Não foi possível remover: ${error.message}`);
    },
  });

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Escolha uma imagem válida.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem precisa ter no máximo 5 MB.");
      return;
    }

    try {
      setUploadingAvatar(true);

      const extension =
        file.name.split(".").pop()?.toLowerCase() || "jpg";

      const filePath = `${user.id}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const avatarUrl = publicUrlData.publicUrl;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          avatar_url: avatarUrl,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      await refresh();

      toast.success("Foto de perfil atualizada!");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a foto.";

      toast.error(message);
    } finally {
      setUploadingAvatar(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  if (loading) {
    return (
      <AppShell>
        <main className="mx-auto w-full max-w-6xl px-4 py-10">
          <div className="animate-pulse space-y-5">
            <div className="h-10 w-48 rounded-lg bg-muted" />
            <div className="h-48 rounded-2xl bg-muted" />
            <div className="h-80 rounded-2xl bg-muted" />
          </div>
        </main>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <main className="mx-auto flex min-h-[60vh] w-full max-w-6xl items-center justify-center px-4">
          <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>

            <h1 className="text-2xl font-bold">
              Você não está conectado
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              Entre na sua conta para acessar seu perfil.
            </p>

            <Button asChild className="mt-6 w-full">
              <Link to="/auth">Entrar ou criar conta</Link>
            </Button>
          </div>
        </main>
      </AppShell>
    );
  }

  const unreadNotifications = notifications.filter(
    (notification) => !notification.read,
  ).length;

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* CABEÇALHO */}
        <section className="mb-8">
          <div className="relative overflow-hidden rounded-3xl border bg-card shadow-sm">
            <div className="h-32 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent sm:h-40" />

            <div className="px-5 pb-6 sm:px-8">
              <div className="-mt-12 flex flex-col gap-5 sm:-mt-14 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-end gap-4">
                  <div className="relative">
                    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-muted text-2xl font-bold shadow-md sm:h-28 sm:w-28">
                      {typedProfile?.avatar_url ? (
                        <img
                          src={typedProfile.avatar_url}
                          alt={`Foto de ${
                            typedProfile.name || "perfil"
                          }`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>
                          {getInitials(
                            typedProfile?.name,
                            user.email,
                          )}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleAvatarClick}
                      disabled={uploadingAvatar}
                      className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-sm transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
                      title="Alterar foto"
                    >
                      {uploadingAvatar ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </div>

                  <div className="pb-1">
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                      {typedProfile?.name || "Meu perfil"}
                    </h1>

                    <p className="mt-1 text-sm text-muted-foreground">
                      {user.email}
                    </p>

                    <button
                      type="button"
                      onClick={handleAvatarClick}
                      className="mt-2 text-sm font-medium text-primary hover:underline"
                    >
                      {uploadingAvatar
                        ? "Enviando foto..."
                        : "Alterar foto"}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {roles.includes("artisan") && (
                    <Button variant="outline" asChild>
                      <Link to="/painel">
                        <Store className="mr-2 h-4 w-4" />
                        Minha loja
                      </Link>
                    </Button>
                  )}

                  {roles.includes("admin") && (
                    <Button variant="outline" asChild>
                      <Link to="/admin">
                        <Shield className="mr-2 h-4 w-4" />
                        Administração
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ATALHOS */}
        <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link
            to="/pedidos"
            className="group rounded-2xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Package className="h-5 w-5" />
            </div>

            <p className="text-sm font-medium">Meus pedidos</p>

            <p className="mt-1 text-xs text-muted-foreground">
              {orderCount}{" "}
              {orderCount === 1 ? "pedido" : "pedidos"}
            </p>
          </Link>

          <Link
            to="/favoritos"
            className="group rounded-2xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
              <Heart className="h-5 w-5" />
            </div>

            <p className="text-sm font-medium">Favoritos</p>

            <p className="mt-1 text-xs text-muted-foreground">
              {favoriteCount}{" "}
              {favoriteCount === 1
                ? "favorito"
                : "favoritos"}
            </p>
          </Link>

          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <MapPin className="h-5 w-5" />
            </div>

            <p className="text-sm font-medium">Endereços</p>

            <p className="mt-1 text-xs text-muted-foreground">
              {addresses.length}{" "}
              {addresses.length === 1
                ? "endereço"
                : "endereços"}
            </p>
          </div>

          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="relative mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-500/10 text-yellow-600">
              <Bell className="h-5 w-5" />

              {unreadNotifications > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {unreadNotifications}
                </span>
              )}
            </div>

            <p className="text-sm font-medium">Notificações</p>

            <p className="mt-1 text-xs text-muted-foreground">
              {unreadNotifications > 0
                ? `${unreadNotifications} não lida${
                    unreadNotifications > 1 ? "s" : ""
                  }`
                : "Tudo em dia"}
            </p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          {/* DADOS PESSOAIS */}
          <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold">
                Dados pessoais
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Mantenha suas informações atualizadas.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="name">Nome</Label>

                <Input
                  id="name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="mt-2"
                  placeholder="Seu nome"
                />

                {errors["name"] && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors["name"]}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="email">E-mail</Label>

                <Input
                  id="email"
                  value={user.email ?? ""}
                  disabled
                  className="mt-2"
                />

                <p className="mt-1 text-xs text-muted-foreground">
                  O e-mail da conta não é alterado por este formulário.
                </p>
              </div>

              <div>
                <Label htmlFor="phone">Telefone</Label>

                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      phone: formatPhone(event.target.value),
                    }))
                  }
                  className="mt-2"
                  placeholder="(85) 99999-9999"
                  inputMode="tel"
                />

                {errors["phone"] && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors["phone"]}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="city">Cidade</Label>

                <Input
                  id="city"
                  value={form.city}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      city: event.target.value,
                    }))
                  }
                  className="mt-2"
                  placeholder="Sua cidade"
                />

                {errors["city"] && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors["city"]}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="state">UF</Label>

                <Input
                  id="state"
                  value={form.state}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      state: event.target.value
                        .toUpperCase()
                        .replace(/[^A-Z]/g, "")
                        .slice(0, 2),
                    }))
                  }
                  className="mt-2"
                  placeholder="CE"
                  maxLength={2}
                />

                {errors["state"] && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors["state"]}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                onClick={() => saveProfile.mutate()}
                disabled={saveProfile.isPending}
              >
                {saveProfile.isPending ? (
                  <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}

                {saveProfile.isPending
                  ? "Salvando..."
                  : "Salvar alterações"}
              </Button>
            </div>
          </section>

          {/* CONTA */}
          <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold">
                Minha conta
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Segurança e configurações da conta.
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() =>
                  setShowPasswordForm((current) => !current)
                }
                className="flex w-full items-center gap-3 rounded-xl border p-4 text-left transition hover:bg-muted/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <Lock className="h-5 w-5" />
                </div>

                <div className="flex-1">
                  <p className="font-medium">Alterar senha</p>

                  <p className="text-xs text-muted-foreground">
                    Atualize a senha da sua conta
                  </p>
                </div>

                {showPasswordForm ? (
                  <X className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Alterar
                  </span>
                )}
              </button>

              {showPasswordForm && (
                <div className="rounded-xl bg-muted/40 p-4">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="new-password">
                        Nova senha
                      </Label>

                      <Input
                        id="new-password"
                        type="password"
                        value={passwordForm.password}
                        onChange={(event) =>
                          setPasswordForm((current) => ({
                            ...current,
                            password: event.target.value,
                          }))
                        }
                        className="mt-2"
                        placeholder="Mínimo de 6 caracteres"
                      />

                      {passwordErrors["password"] && (
                        <p className="mt-1 text-xs text-destructive">
                          {passwordErrors["password"]}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="password-confirmation">
                        Confirmar nova senha
                      </Label>

                      <Input
                        id="password-confirmation"
                        type="password"
                        value={passwordForm.confirmation}
                        onChange={(event) =>
                          setPasswordForm((current) => ({
                            ...current,
                            confirmation: event.target.value,
                          }))
                        }
                        className="mt-2"
                        placeholder="Digite novamente"
                      />

                      {passwordErrors["confirmation"] && (
                        <p className="mt-1 text-xs text-destructive">
                          {passwordErrors["confirmation"]}
                        </p>
                      )}
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => changePassword.mutate()}
                      disabled={changePassword.isPending}
                    >
                      {changePassword.isPending
                        ? "Alterando..."
                        : "Confirmar nova senha"}
                    </Button>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 rounded-xl border border-destructive/20 p-4 text-left text-destructive transition hover:bg-destructive/5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10">
                  <LogOut className="h-5 w-5" />
                </div>

                <div>
                  <p className="font-medium">Sair da conta</p>

                  <p className="text-xs opacity-70">
                    Encerrar sua sessão neste dispositivo
                  </p>
                </div>
              </button>
            </div>

            <div className="mt-6 rounded-xl bg-muted/50 p-4">
              <div className="flex gap-3">
                <Shield className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />

                <div>
                  <p className="text-sm font-medium">
                    Sua conta está protegida
                  </p>

                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Seus dados pessoais são vinculados à sua própria
                    conta e não aparecem publicamente no marketplace.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ENDEREÇOS */}
          <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6 lg:col-span-2">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  Meus endereços
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Endereços utilizados para suas compras.
                </p>
              </div>

              <Button variant="outline" asChild>
                <Link to="/checkout">
                  <MapPin className="mr-2 h-4 w-4" />
                  Gerenciar no checkout
                </Link>
              </Button>
            </div>

            {loadingAddresses ? (
              <div className="h-24 animate-pulse rounded-xl bg-muted" />
            ) : addresses.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <MapPin className="mx-auto h-8 w-8 text-muted-foreground" />

                <p className="mt-3 font-medium">
                  Nenhum endereço cadastrado
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Seus endereços poderão ser cadastrados durante uma
                  compra.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {addresses.map((address) => (
                  <div
                    key={address.id}
                    className="rounded-xl border p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">
                            {address.recipient_name}
                          </p>

                          {address.is_default && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                              Principal
                            </span>
                          )}
                        </div>

                        <p className="mt-2 text-sm text-muted-foreground">
                          {address.street}
                          {address.number
                            ? `, ${address.number}`
                            : ""}
                          {address.complement
                            ? ` — ${address.complement}`
                            : ""}
                        </p>

                        <p className="text-sm text-muted-foreground">
                          {address.neighborhood
                            ? `${address.neighborhood}, `
                            : ""}
                          {address.city} - {address.state}
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          CEP: {address.zip_code}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          removeAddress.mutate(address.id)
                        }
                        disabled={removeAddress.isPending}
                        className="rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        title="Remover endereço"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* NOTIFICAÇÕES */}
          <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6 lg:col-span-2">
            <div className="mb-6">
              <h2 className="text-xl font-semibold">
                Notificações
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Acompanhe novidades e informações da sua conta.
              </p>
            </div>

            {loadingNotifications ? (
              <div className="space-y-3">
                <div className="h-20 animate-pulse rounded-xl bg-muted" />
                <div className="h-20 animate-pulse rounded-xl bg-muted" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <Bell className="mx-auto h-8 w-8 text-muted-foreground" />

                <p className="mt-3 font-medium">
                  Nenhuma notificação
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Quando houver novidades, elas aparecerão aqui.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notification) => {
                  const isUnread = !notification.read;

                  return (
                    <div
                      key={notification.id}
                      className={`rounded-xl border p-4 transition ${
                        isUnread
                          ? "border-primary/30 bg-primary/5"
                          : "bg-background"
                      }`}
                    >
                      <div className="flex gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                          <Bell className="h-5 w-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-medium">
                                {notification.title}
                              </p>

                              {notification.body && (
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {notification.body}
                                </p>
                              )}
                            </div>

                            {isUnread && (
                              <span className="w-fit rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                                Nova
                              </span>
                            )}
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <span className="text-xs text-muted-foreground">
                              {formatDate(notification.created_at)}
                            </span>

                            {isUnread && (
                              <button
                                type="button"
                                onClick={() =>
                                  markNotificationRead.mutate(
                                    notification.id,
                                  )
                                }
                                className="inline-flex items-center text-xs font-medium text-primary hover:underline"
                              >
                                <Check className="mr-1 h-3.5 w-3.5" />
                                Marcar como lida
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </AppShell>
  );
}