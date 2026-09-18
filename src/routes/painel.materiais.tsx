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
import { useAuth } from "@/lib/auth";
import { formatBRL, parseBRLToCents } from "@/lib/format";

export const Route = createFileRoute("/painel/materiais")({
  component: Materiais,
});

const schema = z.object({
  name: z.string().trim().min(2, "Informe o nome do material").max(80),
  unit: z.string().trim().min(1, "Informe a unidade").max(12),
  quantity: z.number().min(0, "Quantidade inválida"),
  minimum_quantity: z.number().min(0, "Valor inválido"),
  unit_cost_cents: z.number().min(0, "Custo inválido"),
});

const EMPTY = { name: "", unit: "un", quantity: "0", minimum_quantity: "0", cost: "" };

function Materiais() {
  const { artisanId } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: materials, isLoading } = useQuery({
    queryKey: ["materials", artisanId],
    enabled: !!artisanId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("*")
        .eq("artisan_id", artisanId!)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({
        name: form.name,
        unit: form.unit,
        quantity: Number(form.quantity || 0),
        minimum_quantity: Number(form.minimum_quantity || 0),
        unit_cost_cents: parseBRLToCents(form.cost),
      });
      if (!parsed.success) {
        const errs: Record<string, string> = {};
        parsed.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
        setErrors(errs);
        throw new Error("validation");
      }
      setErrors({});
      const { error } = await supabase
        .from("materials")
        .insert({ ...parsed.data, artisan_id: artisanId! });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm(EMPTY);
      void qc.invalidateQueries({ queryKey: ["materials"] });
      toast.success("Material cadastrado");
    },
    onError: (e: Error) => {
      if (e.message !== "validation") toast.error("Não foi possível salvar o material.");
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const { error } = await supabase.from("materials").update({ quantity }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["materials"] }),
    onError: () => toast.error("Não foi possível atualizar a quantidade."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("materials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["materials"] });
      toast.success("Material removido");
    },
    onError: () => toast.error("Este material está vinculado a um produto."),
  });

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
      <section className="craft-card h-fit p-4">
        <h2 className="section-title mb-3">Novo material</h2>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="m-name">Nome</Label>
            <Input
              id="m-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            {errors["name"] && <p className="mt-1 text-xs text-destructive">{errors["name"]}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="m-unit">Unidade</Label>
              <Input
                id="m-unit"
                placeholder="un, kg, m"
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="m-cost">Custo por unidade</Label>
              <Input
                id="m-cost"
                placeholder="R$ 0,00"
                value={form.cost}
                onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="m-qty">Quantidade</Label>
              <Input
                id="m-qty"
                type="number"
                min={0}
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="m-min">Estoque mínimo</Label>
              <Input
                id="m-min"
                type="number"
                min={0}
                value={form.minimum_quantity}
                onChange={(e) => setForm((f) => ({ ...f, minimum_quantity: e.target.value }))}
              />
            </div>
          </div>
          <Button disabled={create.isPending} onClick={() => create.mutate()}>
            <Plus className="mr-1 h-4 w-4" /> Cadastrar material
          </Button>
        </div>
      </section>

      <section className="craft-card p-4">
        <h2 className="section-title mb-3">Meus materiais</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : materials?.length ? (
          <ul className="grid gap-2">
            {materials.map((m) => (
              <li
                key={m.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border p-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{m.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBRL(m.unit_cost_cents)} / {m.unit} · mínimo {m.minimum_quantity}
                    {m.quantity <= m.minimum_quantity && (
                      <span className="ml-1 text-destructive">estoque baixo</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    className="w-20"
                    defaultValue={m.quantity}
                    onBlur={(e) => {
                      const q = Number(e.target.value);
                      if (q !== m.quantity) update.mutate({ id: m.id, quantity: q });
                    }}
                  />
                  <Button variant="ghost" size="icon" onClick={() => remove.mutate(m.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Cadastre os materiais que você usa para calcular o custo das peças.
          </p>
        )}
      </section>
    </div>
  );
}
