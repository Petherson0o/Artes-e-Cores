import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { AppImage } from "@/components/AppImage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import {
  formatBRL,
  formatDate,
  ORDER_FLOW,
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
} from "@/lib/format";

export const Route = createFileRoute("/pedidos")({
  head: () => ({
    meta: [
      { title: "Meus pedidos — Arte & Cores" },
      { name: "description", content: "Acompanhe o andamento e o histórico dos seus pedidos." },
      { property: "og:title", content: "Meus pedidos — Arte & Cores" },
      { property: "og:description", content: "Acompanhe seus pedidos artesanais." },
    ],
  }),
  component: Pedidos,
});

type OrderStatus = keyof typeof ORDER_STATUS_LABEL;

type OrderRow = {
  id: string;
  order_number: number;
  created_at: string;
  status: OrderStatus;
  payment_status: keyof typeof PAYMENT_STATUS_LABEL;
  payment_method: string;
  total_cents: number;
  address_snapshot: {
    recipient_name?: string;
    street?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  } | null;
  order_items: {
    id: string;
    product_name_snapshot: string;
    quantity: number;
    unit_price_cents: number;
    image_url: string | null;
    product_id: string | null;
  }[];
};

function Pedidos() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id,order_number,created_at,status,payment_status,payment_method,total_cents,address_snapshot,order_items(id,product_name_snapshot,quantity,unit_price_cents,image_url,product_id)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as OrderRow[];
    },
  });

  const cancel = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase.rpc("cancel_order", { _order_id: orderId });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Pedido cancelado e estoque devolvido.");
    },
    onError: () => toast.error("Não foi possível cancelar este pedido."),
  });

  if (!loading && !user) {
    return (
      <AppShell>
        <div className="craft-card flex flex-col items-center gap-2 p-10 text-center">
          <Package className="h-8 w-8 text-muted-foreground" />
          <h1 className="text-lg">Entre para ver seus pedidos</h1>
          <Button asChild>
            <Link to="/auth">Entrar</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="mb-4 text-2xl">Meus pedidos</h1>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : data?.length ? (
        <ul className="grid gap-4">
          {data.map((order) => {
            const flowIndex = (ORDER_FLOW as readonly string[]).indexOf(order.status);
            const addr = order.address_snapshot;
            return (
              <li key={order.id} className="craft-card p-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold">
                      Pedido #{String(order.order_number).padStart(5, "0")}
                    </h2>
                    <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                  </div>
                  <Badge variant={order.status === "cancelled" ? "destructive" : "secondary"}>
                    {ORDER_STATUS_LABEL[order.status]}
                  </Badge>
                </div>

                {order.status !== "cancelled" && (
                  <div className="mt-3 flex gap-1">
                    {ORDER_FLOW.map((step, i) => (
                      <span
                        key={step}
                        title={ORDER_STATUS_LABEL[step]}
                        className={`h-1.5 flex-1 rounded-full ${
                          i <= flowIndex ? "bg-primary" : "bg-border"
                        }`}
                      />
                    ))}
                  </div>
                )}

                <ul className="mt-3 grid gap-2">
                  {order.order_items.map((item) => (
                    <li key={item.id} className="flex items-center gap-3">
                      <AppImage
                        src={item.image_url}
                        alt={item.product_name_snapshot}
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{item.product_name_snapshot}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} × {formatBRL(item.unit_price_cents)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>

                {addr?.street && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Entrega: {addr.street}, {addr.number} — {addr.neighborhood}, {addr.city}/
                    {addr.state}
                  </p>
                )}

                <div className="hairline my-3" />
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method} ·{" "}
                    {PAYMENT_STATUS_LABEL[order.payment_status]}
                  </span>
                  <span className="font-display text-primary">{formatBRL(order.total_cents)}</span>
                </div>

                {(order.status === "placed" || order.status === "paid") && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    disabled={cancel.isPending}
                    onClick={() => cancel.mutate(order.id)}
                  >
                    Cancelar pedido
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="craft-card flex flex-col items-center gap-2 p-10 text-center">
          <Package className="h-8 w-8 text-muted-foreground" />
          <h2 className="text-lg">Você ainda não fez pedidos</h2>
          <Button asChild>
            <Link to="/explorar">Explorar peças</Link>
          </Button>
        </div>
      )}
    </AppShell>
  );
}
