import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AppImage } from "@/components/AppImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { formatBRL, parseBRLToCents } from "@/lib/format";
import { computePricing } from "@/lib/pricing";
import { uploadImage } from "@/lib/storage";

export const Route = createFileRoute("/painel/produtos")({
  component: Produtos,
});

const schema = z.object({
  name: z.string().trim().min(3, "Nome com ao menos 3 caracteres").max(100),
  description: z.string().trim().min(10, "Descreva a peça (mín. 10 caracteres)").max(2000),
  category_id: z.string().uuid("Escolha uma categoria"),
  price_cents: z.number().min(100, "Preço mínimo de R$ 1,00"),
  stock_quantity: z.number().int().min(0, "Estoque inválido"),
  minimum_stock: z.number().int().min(0, "Valor inválido"),
  main_material: z.string().trim().max(60).optional(),
  origin_city: z.string().trim().max(60).optional(),
  production_days: z.number().int().min(0).max(365).optional(),
  status: z.enum(["draft", "published", "inactive"]),
});

type FormState = {
  id: string | null;
  name: string;
  description: string;
  category_id: string;
  price: string;
  stock_quantity: string;
  minimum_stock: string;
  main_material: string;
  origin_city: string;
  production_days: string;
  status: "draft" | "published" | "inactive";
  image_url: string | null;
  labor: string;
  materials: string;
  variable: string;
  fixed: string;
  margin: string;
};

const EMPTY: FormState = {
  id: null,
  name: "",
  description: "",
  category_id: "",
  price: "",
  stock_quantity: "1",
  minimum_stock: "1",
  main_material: "",
  origin_city: "",
  production_days: "",
  status: "published",
  image_url: null,
  labor: "",
  materials: "",
  variable: "",
  fixed: "",
  margin: "30",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicado",
  inactive: "Inativo",
};

function Produtos() {
  const { artisanId, user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id,name")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: products, isLoading, isError, error } = useQuery({
    queryKey: ["panel-products", artisanId],
    enabled: !!artisanId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("artisan_id", artisanId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const pricing = computePricing({
    materialsCents: parseBRLToCents(form.materials),
    laborCents: parseBRLToCents(form.labor),
    variableCents: parseBRLToCents(form.variable),
    fixedCents: parseBRLToCents(form.fixed),
    marginPercent: Number(form.margin || 0),
  });

  const save = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({
        name: form.name,
        description: form.description,
        category_id: form.category_id,
        price_cents: parseBRLToCents(form.price),
        stock_quantity: Number(form.stock_quantity || 0),
        minimum_stock: Number(form.minimum_stock || 0),
        main_material: form.main_material || undefined,
        origin_city: form.origin_city || undefined,
        production_days: form.production_days ? Number(form.production_days) : undefined,
        status: form.status,
      });
      if (!parsed.success) {
        const errs: Record<string, string> = {};
        parsed.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
        setErrors(errs);
        throw new Error("validation");
      }
      setErrors({});
      const payload = {
        ...parsed.data,
        main_material: parsed.data.main_material ?? null,
        origin_city: parsed.data.origin_city ?? null,
        production_days: parsed.data.production_days ?? null,
        image_url: form.image_url,
        labor_cents: parseBRLToCents(form.labor),
        variable_cost_cents: parseBRLToCents(form.variable),
        fixed_cost_cents: parseBRLToCents(form.fixed),
        cost_cents: pricing.totalCostCents,
        profit_margin: Number(form.margin || 0),
        artisan_id: artisanId!,
      };
      if (form.id) {
        const { error } = await supabase.from("products").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setForm(EMPTY);
      void qc.invalidateQueries({ queryKey: ["panel-products"] });
      toast.success("Produto salvo");
    },
    onError: (e: Error) => {
      if (e.message !== "validation") toast.error("Não foi possível salvar o produto.");
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("products")
        .update({ status: "inactive" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["panel-products"] });
      toast.success("Produto desativado e removido da vitrine.");
    },
  });

  async function handleUpload(file: File) {
    if (!user) return;
    setUploading(true);
    try {
      const ref = await uploadImage("product-images", user.id, file);
      setForm((f) => ({ ...f, image_url: ref }));
      toast.success("Imagem enviada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio da imagem.");
    } finally {
      setUploading(false);
    }
  }

  function edit(p: NonNullable<typeof products>[number]) {
    setForm({
      id: p.id,
      name: p.name,
      description: p.description ?? "",
      category_id: p.category_id ?? "",
      price: (p.price_cents / 100).toFixed(2).replace(".", ","),
      stock_quantity: String(p.stock_quantity),
      minimum_stock: String(p.minimum_stock),
      main_material: p.main_material ?? "",
      origin_city: p.origin_city ?? "",
      production_days: p.production_days ? String(p.production_days) : "",
      status: p.status,
      image_url: p.image_url,
      labor: (p.labor_cents / 100).toFixed(2).replace(".", ","),
      materials: "",
      variable: (p.variable_cost_cents / 100).toFixed(2).replace(".", ","),
      fixed: (p.fixed_cost_cents / 100).toFixed(2).replace(".", ","),
      margin: String(p.profit_margin),
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <section className="craft-card h-fit p-4">
        <h2 className="section-title mb-3">{form.id ? "Editar produto" : "Novo produto"}</h2>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="p-name">Nome da peça</Label>
            <Input
              id="p-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            {errors["name"] && <p className="mt-1 text-xs text-destructive">{errors["name"]}</p>}
          </div>

          <div>
            <Label htmlFor="p-desc">Descrição e história da peça</Label>
            <Textarea
              id="p-desc"
              rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
            {errors["description"] && (
              <p className="mt-1 text-xs text-destructive">{errors["description"]}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select
                value={form.category_id}
                onValueChange={(v) => setForm((f) => ({ ...f, category_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolher" />
                </SelectTrigger>
                <SelectContent>
                  {(categories ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors["category_id"] && (
                <p className="mt-1 text-xs text-destructive">{errors["category_id"]}</p>
              )}
            </div>
            <div>
              <Label>Situação</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, status: v as FormState["status"] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="published">Publicado</SelectItem>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Imagem principal</Label>
            <div className="mt-1 flex items-center gap-3">
              <AppImage
                src={form.image_url}
                alt="Prévia da peça"
                className="h-16 w-16 rounded-lg object-cover"
              />
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-3 py-2 text-sm">
                <ImagePlus className="h-4 w-4" />
                {uploading ? "Enviando..." : "Escolher imagem"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleUpload(file);
                  }}
                />
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-border p-3">
            <h3 className="mb-2 text-sm font-semibold">Calculadora de preço justo</h3>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["materials", "Materiais (R$)"],
                  ["labor", "Mão de obra (R$)"],
                  ["variable", "Custos variáveis (R$)"],
                  ["fixed", "Custos fixos (R$)"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <Label htmlFor={`p-${key}`}>{label}</Label>
                  <Input
                    id={`p-${key}`}
                    placeholder="R$ 0,00"
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div>
                <Label htmlFor="p-margin">Margem de lucro (%)</Label>
                <Input
                  id="p-margin"
                  type="number"
                  min={0}
                  value={form.margin}
                  onChange={(e) => setForm((f) => ({ ...f, margin: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">
                Custo total {formatBRL(pricing.totalCostCents)} · lucro{" "}
                {formatBRL(pricing.marginCents)}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    price: (pricing.suggestedPriceCents / 100).toFixed(2).replace(".", ","),
                  }))
                }
              >
                Usar {formatBRL(pricing.suggestedPriceCents)}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="p-price">Preço de venda</Label>
              <Input
                id="p-price"
                placeholder="R$ 0,00"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
              {errors["price_cents"] && (
                <p className="mt-1 text-xs text-destructive">{errors["price_cents"]}</p>
              )}
            </div>
            <div>
              <Label htmlFor="p-stock">Estoque</Label>
              <Input
                id="p-stock"
                type="number"
                min={0}
                value={form.stock_quantity}
                onChange={(e) => setForm((f) => ({ ...f, stock_quantity: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="p-min">Estoque mínimo</Label>
              <Input
                id="p-min"
                type="number"
                min={0}
                value={form.minimum_stock}
                onChange={(e) => setForm((f) => ({ ...f, minimum_stock: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="p-mat">Material principal</Label>
              <Input
                id="p-mat"
                value={form.main_material}
                onChange={(e) => setForm((f) => ({ ...f, main_material: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="p-city">Cidade de origem</Label>
              <Input
                id="p-city"
                value={form.origin_city}
                onChange={(e) => setForm((f) => ({ ...f, origin_city: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="p-days">Prazo (dias)</Label>
              <Input
                id="p-days"
                type="number"
                min={0}
                value={form.production_days}
                onChange={(e) => setForm((f) => ({ ...f, production_days: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" disabled={save.isPending} onClick={() => save.mutate()}>
              <Plus className="mr-1 h-4 w-4" />
              {form.id ? "Salvar alterações" : "Cadastrar produto"}
            </Button>
            {form.id && (
              <Button variant="outline" onClick={() => setForm(EMPTY)}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="craft-card p-4">
        <h2 className="section-title mb-3">Meus produtos</h2>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <p className="font-medium text-destructive">Não foi possível carregar seus produtos.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {error instanceof Error ? error.message : "Verifique a conexão com o Supabase e as permissões do banco."}
            </p>
          </div>
        ) : products?.length ? (
          <ul className="grid gap-2">
            {products.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <AppImage
                  src={p.image_url}
                  alt={p.name}
                  className="h-14 w-14 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBRL(p.price_cents)} · {p.stock_quantity} em estoque
                  </p>
                  <Badge variant="secondary" className="mt-1">
                    {STATUS_LABEL[p.status]}
                  </Badge>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" onClick={() => edit(p)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove.mutate(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Cadastre sua primeira peça no formulário ao lado.
          </p>
        )}
      </section>
    </div>
  );
}
