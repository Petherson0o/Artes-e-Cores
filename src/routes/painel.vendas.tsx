import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { formatBRL, formatDate, ORDER_FLOW, ORDER_STATUS_LABEL } from "@/lib/format";

export const Route = createFileRoute("/painel/vendas")({
  component: Vendas,
});

type Sale = {
  id: string;
  quantity: number;
  subtotal_cents: number;
  product_name_snapshot: string;
  order_id: string;
  orders: {
    id: string;
    order_number: number;
    status: string;
    created_at: string;
    address_snapshot: { city?: string; state?: string } | null;
  } | null;
};

function Vendas() {
  const { artisanId } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["panel-sales", artisanId],
    enabled: !!artisanId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select(
          "id,quantity,subtotal_cents,product_name_snapshot,order_id,orders(id,order_number,status,created_at,address_snapshot)",
        )
        .eq("artisan_id", artisanId!);
      if (error) throw error;
      return (data as unknown as Sale[]).sort((a, b) =>
        (b.orders?.created_at ?? "").localeCompare(a.orders?.created_at ?? ""),
      );
    },
  });

  const advance = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const { error } = await supabase
        .from("orders")
        .update({ status: status as never })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["panel-sales"] });
      toast.success("Situação do pedido atualizada");
    },
    onError: () => toast.error("Não foi possível atualizar o pedido."),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando vendas...</p>;

  if (!data?.length) {
    return (
      <div className="craft-card p-10 text-center">
        <h2 className="text-lg">Ainda não há vendas</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Quando alguém comprar suas peças, os pedidos aparecem aqui.
        </p>
      </div>
    );
  }

  const active = data.filter((s) => s.orders?.status !== "cancelled");
  const total = active.reduce((s, i) => s + i.subtotal_cents, 0);

  return (
    <div className="grid gap-4">
      <div className="craft-card p-4">
        <p className="text-xs text-muted-foreground">Total faturado</p>
        <p className="font-display text-2xl">{formatBRL(total)}</p>
      </div>

      <ul className="grid gap-3">
        {data.map((sale) => {
          const order = sale.orders;
          const idx = order ? ORDER_FLOW.indexOf(order.status as (typeof ORDER_FLOW)[number]) : -1;
          const next = idx >= 0 && idx < ORDER_FLOW.length - 1 ? ORDER_FLOW[idx + 1] : null;
          return (
            <li key={sale.id} className="craft-card p-4">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {sale.quantity}× {sale.product_name_snapshot}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pedido #{String(order?.order_number ?? 0).padStart(5, "0")} ·{" "}
                    {order ? formatDate(order.created_at) : ""}
                    {order?.address_snapshot?.city
                      ? ` · ${order.address_snapshot.city}/${order.address_snapshot.state}`
                      : ""}
                  </p>
                </div>
                <Badge variant={order?.status === "cancelled" ? "destructive" : "secondary"}>
                  {ORDER_STATUS_LABEL[order?.status ?? ""] ?? "—"}
                </Badge>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="font-display text-primary">{formatBRL(sale.subtotal_cents)}</span>
                {next && order && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={advance.isPending}
                    onClick={() => advance.mutate({ orderId: order.id, status: next })}
                  >
                    Marcar como {ORDER_STATUS_LABEL[next]}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
