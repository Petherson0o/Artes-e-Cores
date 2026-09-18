/** Cálculos de precificação em centavos inteiros (sem ponto flutuante inseguro). */
export type PricingInput = {
  materialsCents: number;
  laborCents: number;
  variableCents: number;
  fixedCents: number;
  marginPercent: number;
};

export type PricingResult = {
  totalCostCents: number;
  marginCents: number;
  suggestedPriceCents: number;
};

export function computePricing(input: PricingInput): PricingResult {
  const totalCostCents =
    Math.round(input.materialsCents) +
    Math.round(input.laborCents) +
    Math.round(input.variableCents) +
    Math.round(input.fixedCents);
  const marginCents = Math.round((totalCostCents * input.marginPercent) / 100);
  return {
    totalCostCents,
    marginCents,
    suggestedPriceCents: totalCostCents + marginCents,
  };
}
