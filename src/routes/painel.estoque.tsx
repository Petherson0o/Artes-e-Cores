import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { formatDate, MOVEMENT_LABEL } from "@/lib/format";

export const Route = createFileRoute("/painel/estoque")({
  component: Estoque,
});

function Estoque() {
  const { artisanId, user } = useAuth();
  const qc = useQueryClient();
  const [productId, setProductId] = useState("");
  const [type, setType] = useState<"in" | "out" | "adjust">("in");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");

  const { data: products } = useQuery({
    queryKey: ["panel-products-stock", artisanId],
    enabled: !!artisanId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,stock_quantity,minimum_stock")
        .eq("artisan_id", artisanId!)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: movements } = useQuery({
    queryKey: ["stock-movements", artisanId],
    enabled: !!artisanId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("id,type,quantity,reason,created_at,product_id,products(name)")
        .eq("artisan_id", artisanId!)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
  });

  const register = useMutation({
    mutationFn: async () => {
      const product = products?.find((p) => p.id === productId);
      if (!product) throw new Error("Escolha um produto.");
      const qty = Number(quantity);
      if (!Number.isInteger(qty) || qty <= 0) throw new Error("Quantidade inválida.");

      const newStock =
        type === "in"
          ? product.stock_quantity + qty
          : type === "out"
            ? product.stock_quantity - qty
            : qty;
      if (newStock < 0) throw new Error("O estoque não pode ficar negativo.");

      const { error: upErr } = await supabase
        .from("products")
        .update({ stock_quantity: newStock })
        .eq("id", product.id);
      if (upErr) throw upErr;

      const { error } = await supabase.from("stock_movements").insert({
        artisan_id: artisanId!,
        product_id: product.id,
        type,
        quantity: qty,
        reason: reason || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setQuantity("1");
      setReason("");
      void qc.invalidateQueries({ queryKey: ["panel-products-stock"] });
      void qc.invalidateQueries({ queryKey: ["stock-movements"] });
      void qc.invalidateQueries({ queryKey: ["panel-products"] });
      toast.success("Movimentação registrada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
      <section className="craft-card h-fit p-4">
        <h2 className="section-title mb-3">Registrar movimentação</h2>
        <div className="grid gap-3">
          <div>
            <Label>Produto</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolher produto" />
              </SelectTrigger>
              <SelectContent>
                {(products ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.stock_quantity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Entrada (produção)</SelectItem>
                  <SelectItem value="out">Saída (perda, brinde)</SelectItem>
                  <SelectItem value="adjust">Ajuste (definir total)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="qty">Quantidade</Label>
              <Input
                id="qty"
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="reason">Motivo (opcional)</Label>
            <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <Button disabled={register.isPending} onClick={() => register.mutate()}>
            Registrar
          </Button>
        </div>
      </section>

      <div className="grid gap-4">
        <section className="craft-card p-4">
          <h2 className="section-title mb-3">Estoque atual</h2>
          {products?.length ? (
            <ul className="grid gap-2 text-sm">
              {products.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">{p.name}</span>
                  <Badge variant={p.stock_quantity <= p.minimum_stock ? "destructive" : "secondary"}>
                    {p.stock_quantity} un
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum produto cadastrado ainda.</p>
          )}
        </section>

        <section className="craft-card p-4">
          <h2 className="section-title mb-3">Histórico de movimentações</h2>
          {movements?.length ? (
            <ul className="grid gap-2 text-sm">
              {movements.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <strong className="block truncate">
                      {(m.products as unknown as { name: string } | null)?.name ?? "Produto"}
                    </strong>
                    <span className="text-xs text-muted-foreground">
                      {MOVEMENT_LABEL[m.type]} · {formatDate(m.created_at)}
                      {m.reason ? ` · ${m.reason}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0">{m.quantity}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sem movimentações registradas.</p>
          )}
        </section>
      </div>
    </div>
  );
}
