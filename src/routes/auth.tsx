import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import hero from "@/assets/hero-xilogravura.jpg";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar ou criar conta — Arte & Cores" },
      {
        name: "description",
        content: "Acesse sua conta de cliente ou artesão no Arte & Cores.",
      },
      {
        property: "og:title",
        content: "Entrar ou criar conta — Arte & Cores",
      },
      {
        property: "og:description",
        content: "Acesse sua conta no Arte & Cores.",
      },
    ],
  }),
  component: Auth,
});

const signUpSchema = z
  .object({
    name: z.string().trim().min(2, "Informe seu nome completo").max(80),
    email: z.string().trim().email("E-mail inválido").max(160),
    password: z
      .string()
      .min(8, "A senha precisa de ao menos 8 caracteres")
      .regex(/[A-Za-z]/, "Inclua ao menos uma letra")
      .regex(/[0-9]/, "Inclua ao menos um número"),
    confirm: z.string(),
    role: z.enum(["client", "artisan"]),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "As senhas não coincidem",
  });

type Mode = "login" | "signup" | "recover" | "reset";

function Auth() {
  const navigate = useNavigate();
  const { session, roles, loading } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
    role: "client" as "client" | "artisan",
  });

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.location.hash.includes("type=recovery")
    ) {
      setMode("reset");
    }
  }, []);

  useEffect(() => {
    if (loading || !session || mode === "reset") return;

    if (roles.includes("admin")) {
      void navigate({ to: "/admin" });
    } else if (roles.includes("artisan")) {
      void navigate({ to: "/painel" });
    } else {
      void navigate({ to: "/explorar" });
    }
  }, [session, roles, loading, mode, navigate]);

  function setField(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    setBusy(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: form.email.trim().toLowerCase(),
      password: form.password,
    });

    setBusy(false);

    if (error) {
      toast.error("Não foi possível entrar. Verifique e-mail e senha.");
      return;
    }

    toast.success("Bem-vindo de volta!");
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();

    const parsed = signUpSchema.safeParse(form);

    if (!parsed.success) {
      const errs: Record<string, string> = {};

      parsed.error.issues.forEach(
        (i) => (errs[String(i.path[0])] = i.message),
      );

      setErrors(errs);
      return;
    }

    setErrors({});
    setBusy(true);

    const email = parsed.data.email.trim().toLowerCase();

    // Verifica primeiro se o e-mail já possui uma conta.
    const { data: emailCheck, error: emailCheckError } =
      await supabase.functions.invoke("check-email", {
        body: { email },
      });

    if (emailCheckError) {
      console.error(
        "[Auth] Erro ao verificar e-mail:",
        emailCheckError,
      );

      setBusy(false);

      toast.error(
        "Não foi possível verificar o e-mail. E-mail já cadastrado.",
      );

      return;
    }

    if (emailCheck?.exists === true) {
      setBusy(false);

      toast.error(
        "Este e-mail já está cadastrado. Tente entrar ou recuperar sua senha.",
      );

      return;
    }

    // E-mail não encontrado → cria a conta normalmente.
    const { error } = await supabase.auth.signUp({
      email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
        data: {
          name: parsed.data.name,
          role: parsed.data.role,
        },
      },
    });

    setBusy(false);

    if (error) {
      console.error("[Auth] Erro no cadastro:", error);

      toast.error(
        "Não foi possível concluir o cadastro. Tente novamente.",
      );

      return;
    }

    toast.success("Conta criada! Verifique seu e-mail.");
  }

  async function handleRecover(e: React.FormEvent) {
    e.preventDefault();

    setBusy(true);

    await supabase.auth.resetPasswordForEmail(
      form.email.trim().toLowerCase(),
      {
        redirectTo: `${window.location.origin}/auth`,
      },
    );

    setBusy(false);

    toast.success("Verifique seu e-mail com as instruções.");

    setMode("login");
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();

    if (form.password !== form.confirm) {
      setErrors({
        confirm: "As senhas não coincidem",
      });

      return;
    }

    setBusy(true);

    const { error } = await supabase.auth.updateUser({
      password: form.password,
    });

    setBusy(false);

    if (error) {
      toast.error("Não foi possível redefinir a senha.");
      return;
    }

    toast.success("Senha atualizada!");

    setMode("login");
  }

  return (
    <div className="paper grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <img
          src={hero}
          alt="Ilustração em xilogravura do artesanato cearense"
          className="h-full w-full object-cover"
        />

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/80 to-transparent p-8">
          <p className="font-display text-2xl text-background">
            Mais que produtos, são histórias, tradição e cultura.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="craft-card w-full max-w-md p-6">
          <Link to="/" className="mb-6 inline-block">
            <Logo />
          </Link>

          {mode === "login" && (
            <form onSubmit={handleLogin} className="grid gap-4">
              <h1 className="text-2xl">Entrar</h1>

              <div>
                <Label htmlFor="email">E-mail</Label>

                <Input
                  id="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) =>
                    setField("email", e.target.value)
                  }
                />
              </div>

              <div>
                <Label htmlFor="password">Senha</Label>

                <Input
                  id="password"
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) =>
                    setField("password", e.target.value)
                  }
                />
              </div>

              <Button type="submit" disabled={busy}>
                {busy ? "Entrando..." : "Entrar"}
              </Button>

              <div className="flex justify-between text-sm">
                <button
                  type="button"
                  className="text-primary"
                  onClick={() => setMode("recover")}
                >
                  Esqueci minha senha
                </button>

                <button
                  type="button"
                  className="text-primary"
                  onClick={() => setMode("signup")}
                >
                  Criar conta
                </button>
              </div>
            </form>
          )}

          {mode === "signup" && (
            <form onSubmit={handleSignUp} className="grid gap-4">
              <h1 className="text-2xl">Criar conta</h1>

              <div>
                <Label htmlFor="name">Nome</Label>

                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) =>
                    setField("name", e.target.value)
                  }
                />

                {errors["name"] && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors["name"]}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="semail">E-mail</Label>

                <Input
                  id="semail"
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setField("email", e.target.value)
                  }
                />

                {errors["email"] && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors["email"]}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="spassword">Senha</Label>

                <Input
                  id="spassword"
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setField("password", e.target.value)
                  }
                />

                {errors["password"] && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors["password"]}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="confirm">
                  Confirmar senha
                </Label>

                <Input
                  id="confirm"
                  type="password"
                  value={form.confirm}
                  onChange={(e) =>
                    setField("confirm", e.target.value)
                  }
                />

                {errors["confirm"] && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors["confirm"]}
                  </p>
                )}
              </div>

              <div>
                <Label>Tipo de conta</Label>

                <RadioGroup
                  value={form.role}
                  onValueChange={(v) =>
                    setField("role", v)
                  }
                  className="mt-2 grid grid-cols-2 gap-2"
                >
                  <Label
                    htmlFor="r-client"
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3"
                  >
                    <RadioGroupItem
                      value="client"
                      id="r-client"
                    />
                    Cliente
                  </Label>

                  <Label
                    htmlFor="r-artisan"
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-3"
                  >
                    <RadioGroupItem
                      value="artisan"
                      id="r-artisan"
                    />
                    Artesão
                  </Label>
                </RadioGroup>
              </div>

              <Button type="submit" disabled={busy}>
                {busy ? "Criando..." : "Criar conta"}
              </Button>

              <button
                type="button"
                className="text-sm text-primary"
                onClick={() => setMode("login")}
              >
                Já tenho conta
              </button>
            </form>
          )}

          {mode === "recover" && (
            <form onSubmit={handleRecover} className="grid gap-4">
              <h1 className="text-2xl">Recuperar senha</h1>

              <p className="text-sm text-muted-foreground">
                Informe seu e-mail e enviaremos um link para
                criar uma nova senha.
              </p>

              <div>
                <Label htmlFor="remail">E-mail</Label>

                <Input
                  id="remail"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) =>
                    setField("email", e.target.value)
                  }
                />
              </div>

              <Button type="submit" disabled={busy}>
                Enviar instruções
              </Button>

              <button
                type="button"
                className="text-sm text-primary"
                onClick={() => setMode("login")}
              >
                Voltar
              </button>
            </form>
          )}

          {mode === "reset" && (
            <form onSubmit={handleReset} className="grid gap-4">
              <h1 className="text-2xl">Nova senha</h1>

              <div>
                <Label htmlFor="np">Senha</Label>

                <Input
                  id="np"
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setField("password", e.target.value)
                  }
                />
              </div>

              <div>
                <Label htmlFor="nc">
                  Confirmar senha
                </Label>

                <Input
                  id="nc"
                  type="password"
                  value={form.confirm}
                  onChange={(e) =>
                    setField("confirm", e.target.value)
                  }
                />

                {errors["confirm"] && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors["confirm"]}
                  </p>
                )}
              </div>

              <Button type="submit" disabled={busy}>
                Salvar nova senha
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}