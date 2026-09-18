export function formatBRL(cents: number | null | undefined): string {
  const value = (cents ?? 0) / 100;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function parseBRLToCents(input: string): number {
  const normalized = input.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

export function formatDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  placed: "Pedido realizado",
  paid: "Pagamento confirmado",
  preparing: "Em preparação",
  shipping: "Em transporte",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

export const ORDER_FLOW = ["placed", "paid", "preparing", "shipping", "delivered"] as const;

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  awaiting: "Aguardando pagamento",
  confirmed: "Pagamento confirmado",
  refused: "Pagamento recusado",
  cancelled: "Cancelado",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  pix: "Pix",
  card: "Cartão",
  on_delivery: "Pagamento na entrega",
};

export const MOVEMENT_LABEL: Record<string, string> = {
  in: "Entrada",
  out: "Saída",
  adjust: "Ajuste",
  sale: "Venda",
  cancellation: "Cancelamento",
};
