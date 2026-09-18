import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, CreditCard, MapPin, QrCode, Truck } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/lib/auth";
import { formatBRL } from "@/lib/format";
import { useCart } from "@/routes/carrinho";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Finalizar compra — Arte & Cores" },
      { name: "description", content: "Informe o endereço, escolha o pagamento e confirme seu pedido." },
      { property: "og:title", content: "Finalizar compra — Arte & Cores" },
      { property: "og:description", content: "Endereço, pagamento e confirmação do pedido." },
    ],
  }),
  component: Checkout,
});

const addressSchema = z.object({
  recipient_name: z.string().trim().min(2, "Informe o nome de quem recebe").max(80),
  zip_code: z.string().trim().regex(/^\d{5}-?\d{3}$/, "CEP inválido (00000-000)"),
  street: z.string().trim().min(2, "Informe a rua").max(120),
  number: z.string().trim().min(1, "Informe o número").max(10),
  complement: z.string().trim().max(60),
  neighborhood: z.string().trim().min(2, "Informe o bairro").max(60),
  city: z.string().trim().min(2, "Informe a cidade").max(60),
  state: z.string().trim().length(2, "UF com 2 letras"),
});

type Step = "endereco" | "pagamento" | "revisao" | "sucesso";

function Checkout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: cart } = useCart();
  const [step, setStep] = useState<Step>("endereco");
  const [addressId, setAddressId] = useState<string | null>(null);
  const [method, setMethod] = useState("pix");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const [newAddress, setNewAddress] = useState({
    recipient_name: "",
    zip_code: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "CE",
  });

  const { data: addresses } = useQuery({
    queryKey: ["addresses", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addresses")
        .select("*")
        .order("is_default", { ascending: false });
      if (error) throw error;
      if (data?.[0] && !addressId) setAddressId(data[0].id);
      return data;
    },
  });

  const saveAddress = useMutation({
    mutationFn: async () => {
      const parsed = addressSchema.safeParse(newAddress);
      if (!parsed.success) {
        const errs: Record<string, string> = {};
        parsed.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
        setErrors(errs);
        throw new Error("validation");
      }
      setErrors({});
      const { data, error } = await supabase
        .from("addresses")
        .insert({
          ...parsed.data,
          zip_code: parsed.data.zip_code.replace(/(\d{5})-?(\d{3})/, "$1-$2"),
          state: parsed.data.state.toUpperCase(),
          user_id: user!.id,
          is_default: !addresses?.length,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      setAddressId(id);
      void qc.invalidateQueries({ queryKey: ["addresses"] });
      toast.success("Endereço salvo");
    },
    onError: (e: Error) => {
      if (e.message !== "validation") toast.error("Não foi possível salvar o endereço.");
    },
  });

  const placeOrder = useMutation({
    mutationFn: async () => {
      if (!addressId) throw new Error("Selecione um endereço de entrega.");
      const { data, error } = await supabase.rpc("place_order", {
        _address_id: addressId,
        _payment_method: method,
      });
      if (error) throw error;
      const { data: order } = await supabase
        .from("orders")
        .select("order_number")
        .eq("id", data as string)
        .maybeSingle();
      return order?.order_number ?? null;
    },
    onSuccess: (num) => {
      setOrderNumber(num);
      setStep("sucesso");
      void qc.invalidateQueries({ queryKey: ["cart"] });
      void qc.invalidateQueries({ queryKey: ["cart-count"] });
      void qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e: Error) =>
      toast.error(
        e.message.includes("stock") || e.message.includes("estoque")
          ? "Algum item ficou sem estoque. Revise seu carrinho."
          : "Não foi possível concluir o pedido. Tente novamente.",
      ),
  });

  if (!loading && !user) {
    return (
      <AppShell>
        <div className="craft-card p-10 text-center">
          <h1 className="text-lg">Entre para finalizar a compra</h1>
          <Button asChild className="mt-4">
            <Link to="/auth">Entrar</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const items = (cart ?? []).filter((i) => i.products && i.products.status === "published");
  const total = items.reduce((s, i) => s + (i.products?.price_cents ?? 0) * i.quantity, 0);

  if (step === "sucesso") {
    return (
      <AppShell>
        <div className="craft-card mx-auto flex max-w-md flex-col items-center gap-3 p-10 text-center">
          <CheckCircle2 className="h-10 w-10 text-forest" />
          <h1 className="text-2xl">Pedido confirmado!</h1>
          {orderNumber && (
            <p className="text-sm text-muted-foreground">
              Número do pedido #{String(orderNumber).padStart(5, "0")}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            O artesão já foi avisado e vai preparar sua peça com carinho.
          </p>
          <div className="mt-2 flex gap-2">
            <Button asChild>
              <Link to="/pedidos">Ver meus pedidos</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/explorar">Continuar comprando</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!items.length) {
    return (
      <AppShell>
        <div className="craft-card p-10 text-center">
          <h1 className="text-lg">Seu carrinho está vazio</h1>
          <Button asChild className="mt-4">
            <Link to="/explorar">Explorar peças</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="mb-1 text-2xl">Finalizar compra</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Etapa {step === "endereco" ? 1 : step === "pagamento" ? 2 : 3} de 3
      </p>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="grid gap-4">
          {step === "endereco" && (
            <section className="craft-card p-4">
              <h2 className="section-title mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Endereço de entrega
              </h2>

              {!!addresses?.length && (
                <RadioGroup
                  value={addressId ?? ""}
                  onValueChange={setAddressId}
                  className="mb-4 grid gap-2"
                >
                  {addresses.map((a) => (
                    <Label
                      key={a.id}
                      htmlFor={a.id}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm"
                    >
                      <RadioGroupItem value={a.id} id={a.id} className="mt-1" />
                      <span>
                        <strong>{a.recipient_name}</strong>
                        <br />
                        {a.street}, {a.number}
                        {a.complement ? ` - ${a.complement}` : ""} — {a.neighborhood}
                        <br />
                        {a.city}/{a.state} · {a.zip_code}
                      </span>
                    </Label>
                  ))}
                </RadioGroup>
              )}

              <details className="rounded-lg border border-border p-3" open={!addresses?.length}>
                <summary className="cursor-pointer text-sm font-semibold">
                  Cadastrar novo endereço
                </summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["recipient_name", "Quem recebe"],
                      ["zip_code", "CEP"],
                      ["street", "Rua"],
                      ["number", "Número"],
                      ["complement", "Complemento (opcional)"],
                      ["neighborhood", "Bairro"],
                      ["city", "Cidade"],
                      ["state", "UF"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key}>
                      <Label htmlFor={key}>{label}</Label>
                      <Input
                        id={key}
                        value={newAddress[key]}
                        onChange={(e) =>
                          setNewAddress((a) => ({ ...a, [key]: e.target.value }))
                        }
                      />
                      {errors[key] && (
                        <p className="mt-1 text-xs text-destructive">{errors[key]}</p>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  className="mt-3"
                  variant="outline"
                  disabled={saveAddress.isPending}
                  onClick={() => saveAddress.mutate()}
                >
                  Salvar endereço
                </Button>
              </details>

              <Button
                className="mt-4 w-full"
                disabled={!addressId}
                onClick={() => setStep("pagamento")}
              >
                Continuar para pagamento
              </Button>
            </section>
          )}

          {step === "pagamento" && (
            <section className="craft-card p-4">
              <h2 className="section-title mb-3">Forma de pagamento</h2>
              <RadioGroup value={method} onValueChange={setMethod} className="grid gap-2">
                {[
                  { v: "pix", label: "Pix", icon: QrCode, hint: "Confirmação simulada na hora" },
                  {
                    v: "card",
                    label: "Cartão de crédito",
                    icon: CreditCard,
                    hint: "Pagamento simulado para fins acadêmicos",
                  },
                  {
                    v: "on_delivery",
                    label: "Pagar na entrega",
                    icon: Truck,
                    hint: "Combine com o artesão",
                  },
                ].map((m) => (
                  <Label
                    key={m.v}
                    htmlFor={m.v}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 text-sm"
                  >
                    <RadioGroupItem value={m.v} id={m.v} />
                    <m.icon className="h-4 w-4 text-primary" />
                    <span>
                      <strong>{m.label}</strong>
                      <br />
                      <span className="text-xs text-muted-foreground">{m.hint}</span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" onClick={() => setStep("endereco")}>
                  Voltar
                </Button>
                <Button className="flex-1" onClick={() => setStep("revisao")}>
                  Revisar pedido
                </Button>
              </div>
            </section>
          )}

          {step === "revisao" && (
            <section className="craft-card p-4">
              <h2 className="section-title mb-3">Revisão do pedido</h2>
              <ul className="grid gap-2 text-sm">
                {items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">
                      {i.quantity}× {i.products?.name}
                    </span>
                    <span>{formatBRL((i.products?.price_cents ?? 0) * i.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex gap-2">
                <Button variant="outline" onClick={() => setStep("pagamento")}>
                  Voltar
                </Button>
                <Button
                  className="flex-1"
                  size="lg"
                  disabled={placeOrder.isPending}
                  onClick={() => placeOrder.mutate()}
                >
                  {placeOrder.isPending ? "Confirmando..." : "Confirmar pedido"}
                </Button>
              </div>
            </section>
          )}
        </div>

        <aside className="craft-card h-fit p-4">
          <h2 className="section-title mb-3">Resumo</h2>
          <div className="flex justify-between text-sm">
            <span>{items.length} item(ns)</span>
            <span>{formatBRL(total)}</span>
          </div>
          <div className="hairline my-3" />
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span className="font-display text-primary">{formatBRL(total)}</span>
          </div>
          <Button asChild variant="ghost" className="mt-3 w-full">
            <Link to="/carrinho">Editar carrinho</Link>
          </Button>
        </aside>
      </div>
    </AppShell>
  );
}
