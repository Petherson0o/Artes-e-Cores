import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
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
import { useAuth } from "@/lib/auth";
import { formatBRL, parseBRLToCents } from "@/lib/format";

export const Route = createFileRoute("/painel/custos")({
  component: Custos,
});

const schema = z.object({
  name: z.string().trim().min(2, "Informe o nome do custo").max(80),
  amount_cents: z.number().min(1, "Informe um valor maior que zero"),
  type: z.enum(["fixed", "variable"]),
  recurrence: z.string().trim().max(20),
});

const EMPTY = { name: "", amount: "", type: "fixed", recurrence: "monthly" };

const RECURRENCE_LABEL: Record<string, string> = {
  monthly: "Mensal",
  weekly: "Semanal",
  per_product: "Por peça",
  once: "Pontual",
};

function Custos() {
  const { artisanId } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: costs, isLoading } = useQuery({
    queryKey: ["costs", artisanId],
    enabled: !!artisanId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("costs")
        .select("*")
        .eq("artisan_id", artisanId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({
        name: form.name,
        amount_cents: parseBRLToCents(form.amount),
        type: form.type,
        recurrence: form.recurrence,
      });
      if (!parsed.success) {
        const errs: Record<string, string> = {};
        parsed.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
        setErrors(errs);
        throw new Error("validation");
      }
      setErrors({});
      const { error } = await supabase
        .from("costs")
        .insert({ ...parsed.data, artisan_id: artisanId! });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm(EMPTY);
      void qc.invalidateQueries({ queryKey: ["costs"] });
      toast.success("Custo cadastrado");
    },
    onError: (e: Error) => {
      if (e.message !== "validation") toast.error("Não foi possível salvar o custo.");
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("costs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["costs"] });
      toast.success("Custo removido");
    },
  });

  const fixed = (costs ?? []).filter((c) => c.type === "fixed");
  const variable = (costs ?? []).filter((c) => c.type === "variable");
  const sum = (list: typeof fixed) => list.reduce((s, c) => s + c.amount_cents, 0);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
      <section className="craft-card h-fit p-4">
        <h2 className="section-title mb-3">Novo custo</h2>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="c-name">Descrição</Label>
            <Input
              id="c-name"
              placeholder="Energia do ateliê, embalagem..."
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            {errors["name"] && <p className="mt-1 text-xs text-destructive">{errors["name"]}</p>}
          </div>
          <div>
            <Label htmlFor="c-amount">Valor</Label>
            <Input
              id="c-amount"
              placeholder="R$ 0,00"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
            {errors["amount_cents"] && (
              <p className="mt-1 text-xs text-destructive">{errors["amount_cents"]}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixo</SelectItem>
                  <SelectItem value="variable">Variável</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Recorrência</Label>
              <Select
                value={form.recurrence}
                onValueChange={(v) => setForm((f) => ({ ...f, recurrence: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RECURRENCE_LABEL).map(([v, label]) => (
                    <SelectItem key={v} value={v}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button disabled={create.isPending} onClick={() => create.mutate()}>
            <Plus className="mr-1 h-4 w-4" /> Cadastrar custo
          </Button>
        </div>
      </section>

      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="craft-card p-4">
            <p className="text-xs text-muted-foreground">Custos fixos</p>
            <p className="font-display text-xl">{formatBRL(sum(fixed))}</p>
          </div>
          <div className="craft-card p-4">
            <p className="text-xs text-muted-foreground">Custos variáveis</p>
            <p className="font-display text-xl">{formatBRL(sum(variable))}</p>
          </div>
        </div>

        <section className="craft-card p-4">
          <h2 className="section-title mb-3">Meus custos</h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : costs?.length ? (
            <ul className="grid gap-2 text-sm">
              {costs.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <span className="min-w-0">
                    <strong className="block truncate">{c.name}</strong>
                    <span className="text-xs text-muted-foreground">
                      {c.type === "fixed" ? "Fixo" : "Variável"} ·{" "}
                      {RECURRENCE_LABEL[c.recurrence] ?? c.recurrence}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {formatBRL(c.amount_cents)}
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Cadastre seus custos para precificar com margem justa.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
