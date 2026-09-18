import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
  Image as ImageIcon,
  Instagram,
  Loader2,
  MapPin,
  MessageCircle,
  Save,
  Store,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/minha-loja")({
  head: () => ({
    meta: [
      { title: "Personalizar minha loja — Arte & Cores" },
      {
        name: "description",
        content: "Personalize a aparência e as informações da sua loja.",
      },
    ],
  }),
  component: MinhaLoja,
});

type Category = {
  id: string;
  name: string;
  slug: string;
};

type Subcategory = {
  id: string;
  category_id: string;
  name: string;
  slug: string;
};

type ProfileCategory = {
  category_id: string;
  subcategory_id: string | null;
};

function MinhaLoja() {
  const { user, roles } = useAuth();
  const queryClient = useQueryClient();

  const [storeName, setStoreName] = useState("");
  const [bio, setBio] = useState("");
  const [workDescription, setWorkDescription] = useState("");
  const [story, setStory] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [instagram, setInstagram] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedSubcategoryIds, setSelectedSubcategoryIds] = useState<string[]>([]);
  const [openCategoryIds, setOpenCategoryIds] = useState<string[]>([]);

  const [uploadingImage, setUploadingImage] = useState<"avatar" | "cover" | null>(null);

  const { data: artisan, isLoading } = useQuery({
    queryKey: ["my-artisan-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("artisan_profiles")
        .select(
          "id,user_id,store_name,bio,story,city,state,specialties,avatar_url,cover_url,instagram,whatsapp,featured,work_description",
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      return data;
    },
  });

  // As tabelas novas ainda podem não estar nos tipos gerados localmente do Supabase.
  // O cast mantém esta página compatível até os tipos serem regenerados.
  const db = supabase as any;

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["artisan-categories"],
    queryFn: async () => {
      const { data, error } = await db
        .from("artisan_categories")
        .select("id,name,slug")
        .order("name");

      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  const { data: subcategories = [], isLoading: subcategoriesLoading } = useQuery<Subcategory[]>({
    queryKey: ["artisan-subcategories"],
    queryFn: async () => {
      const { data, error } = await db
        .from("artisan_subcategories")
        .select("id,category_id,name,slug")
        .order("name");

      if (error) throw error;
      return (data ?? []) as Subcategory[];
    },
  });

  const { data: profileCategories = [], isLoading: profileCategoriesLoading } = useQuery<ProfileCategory[]>({
    queryKey: ["my-artisan-profile-categories", artisan?.id],
    enabled: !!artisan?.id,
    queryFn: async () => {
      if (!artisan) return [];

      const { data, error } = await db
        .from("artisan_profile_categories")
        .select("category_id,subcategory_id")
        .eq("artisan_profile_id", artisan.id);

      if (error) throw error;
      return (data ?? []) as ProfileCategory[];
    },
  });

  useEffect(() => {
    if (!artisan) return;

    setStoreName(artisan.store_name ?? "");
    setBio(artisan.bio ?? "");
    setWorkDescription(artisan.work_description ?? "");
    setStory(artisan.story ?? "");
    setCity(artisan.city ?? "");
    setState(artisan.state ?? "");
    setInstagram(artisan.instagram ?? "");
    setWhatsapp(artisan.whatsapp ?? "");
    setAvatarUrl(artisan.avatar_url ?? "");
    setCoverUrl(artisan.cover_url ?? "");
  }, [artisan]);

  useEffect(() => {
    if (!artisan || !profileCategories) return;

    if (profileCategories.length > 0) {
      const categoryIds = Array.from(
        new Set(profileCategories.map((item) => item.category_id)),
      );

      const subcategoryIds = profileCategories
        .map((item) => item.subcategory_id)
        .filter((id): id is string => !!id);

      setSelectedCategoryIds(categoryIds);
      setSelectedSubcategoryIds(subcategoryIds);
      return;
    }

    // Compatibilidade com lojas antigas que ainda usam apenas specialties (text[]).
    const legacySpecialties = artisan.specialties ?? [];
    const legacyCategoryIds = categories
      .filter((category) => legacySpecialties.includes(category.name))
      .map((category) => category.id);
    const legacySubcategoryIds = subcategories
      .filter((subcategory) => legacySpecialties.includes(subcategory.name))
      .map((subcategory) => subcategory.id);

    const categoriesFromSubcategories = subcategories
      .filter((subcategory) => legacySubcategoryIds.includes(subcategory.id))
      .map((subcategory) => subcategory.category_id);

    setSelectedCategoryIds(
      Array.from(new Set([...legacyCategoryIds, ...categoriesFromSubcategories])),
    );
    setSelectedSubcategoryIds(legacySubcategoryIds);
  }, [artisan, categories, subcategories, profileCategories]);

  function toggleCategory(categoryId: string) {
    setSelectedCategoryIds((current) => {
      if (current.includes(categoryId)) {
        setSelectedSubcategoryIds((subcategoriesCurrent) => {
          const idsToRemove = subcategories
            .filter((item) => item.category_id === categoryId)
            .map((item) => item.id);

          return subcategoriesCurrent.filter(
            (id) => !idsToRemove.includes(id),
          );
        });

        return current.filter((id) => id !== categoryId);
      }

      return [...current, categoryId];
    });
  }

  function toggleSubcategory(subcategory: Subcategory) {
    setSelectedSubcategoryIds((current) => {
      if (current.includes(subcategory.id)) {
        return current.filter((id) => id !== subcategory.id);
      }

      if (!selectedCategoryIds.includes(subcategory.category_id)) {
        setSelectedCategoryIds((currentCategories) => [
          ...currentCategories,
          subcategory.category_id,
        ]);
      }

      return [...current, subcategory.id];
    });
  }

  function toggleCategoryOpen(categoryId: string) {
    setOpenCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    );
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user || !artisan) {
        throw new Error("Perfil de artesão não encontrado.");
      }

      const selectedCategoryNames = categories
        .filter((category) => selectedCategoryIds.includes(category.id))
        .map((category) => category.name);

      const selectedSubcategoryNames = subcategories
        .filter((subcategory) => selectedSubcategoryIds.includes(subcategory.id))
        .map((subcategory) => subcategory.name);

      const specialtiesArray = Array.from(
        new Set([...selectedCategoryNames, ...selectedSubcategoryNames]),
      );

      const { error } = await supabase
        .from("artisan_profiles")
        .update({
          store_name: storeName.trim(),
          bio: bio.trim() || null,
          work_description: workDescription.trim() || null,
          story: story.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          specialties: specialtiesArray,
          instagram: instagram.trim() || null,
          whatsapp: whatsapp.trim() || null,
          avatar_url: avatarUrl.trim() || null,
          cover_url: coverUrl.trim() || null,
        })
        .eq("id", artisan.id)
        .eq("user_id", user.id);

      if (error) throw error;

      const { error: deleteError } = await db
        .from("artisan_profile_categories")
        .delete()
        .eq("artisan_profile_id", artisan.id);

      if (deleteError) throw deleteError;

      const rows = selectedCategoryIds.flatMap((categoryId) => {
        const categorySubcategories = subcategories.filter(
          (subcategory) =>
            subcategory.category_id === categoryId &&
            selectedSubcategoryIds.includes(subcategory.id),
        );

        if (categorySubcategories.length === 0) {
          return [
            {
              artisan_profile_id: artisan.id,
              category_id: categoryId,
              subcategory_id: null,
            },
          ];
        }

        return categorySubcategories.map((subcategory) => ({
          artisan_profile_id: artisan.id,
          category_id: categoryId,
          subcategory_id: subcategory.id,
        }));
      });

      if (rows.length > 0) {
        const { error: categoryError } = await db
          .from("artisan_profile_categories")
          // A subcategoria é opcional no banco. O tipo gerado localmente
          // ainda a considera obrigatória, então mantemos a inserção
          // válida no banco e isolamos a diferença de tipagem neste ponto.
          .insert(rows as any);

        if (categoryError) throw categoryError;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["my-artisan-profile", user?.id],
      });

      await queryClient.invalidateQueries({
        queryKey: ["my-artisan-profile-categories", artisan?.id],
      });

      await queryClient.invalidateQueries({
        queryKey: ["artisan"],
      });

      await queryClient.invalidateQueries({
        queryKey: ["artisans"],
      });

      toast.success("Loja atualizada com sucesso!");
    },
    onError: (error) => {
      console.error(error);
      toast.error("Não foi possível salvar as alterações.");
    },
  });

  async function uploadImage(file: File, type: "avatar" | "cover") {
    if (!user || !artisan) {
      toast.error("Você precisa estar logado.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Escolha uma imagem válida.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem precisa ter no máximo 5 MB.");
      return;
    }

    setUploadingImage(type);

    try {
      const extension =
        file.name.split(".").pop()?.toLowerCase() || "jpg";

      const path = `${user.id}/store-${type}-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);

      const newUrl = data.publicUrl;

      if (type === "avatar") {
        setAvatarUrl(newUrl);
      } else {
        setCoverUrl(newUrl);
      }

      const updateData =
        type === "avatar"
          ? { avatar_url: newUrl }
          : { cover_url: newUrl };

      const { error: updateError } = await supabase
        .from("artisan_profiles")
        .update(updateData)
        .eq("id", artisan.id)
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      await queryClient.invalidateQueries({
        queryKey: ["my-artisan-profile", user.id],
      });

      await queryClient.invalidateQueries({
        queryKey: ["artisan"],
      });

      await queryClient.invalidateQueries({
        queryKey: ["artisans"],
      });

      toast.success(
        type === "avatar"
          ? "Logo atualizada com sucesso!"
          : "Capa atualizada com sucesso!",
      );
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível enviar a imagem.");
    } finally {
      setUploadingImage(null);
    }
  }

  function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (file) {
      void uploadImage(file, "avatar");
    }

    event.target.value = "";
  }

  function handleCoverChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (file) {
      void uploadImage(file, "cover");
    }

    event.target.value = "";
  }

  if (!user) {
    return (
      <AppShell>
        <div className="craft-card p-8 text-center">
          <h1 className="text-xl font-semibold">Faça login para continuar</h1>

          <Button asChild className="mt-4">
            <Link to="/auth">Entrar</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  if (!roles.includes("artisan") && !roles.includes("admin")) {
    return (
      <AppShell>
        <div className="craft-card p-8 text-center">
          <Store className="mx-auto h-10 w-10 text-muted-foreground" />

          <h1 className="mt-3 text-xl font-semibold">Área do artesão</h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Essa área é destinada aos artesãos da plataforma.
          </p>

          <Button asChild className="mt-4">
            <Link to="/">Voltar para o início</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  if (isLoading || profileCategoriesLoading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">
          Carregando sua loja...
        </p>
      </AppShell>
    );
  }

  if (!artisan) {
    return (
      <AppShell>
        <div className="craft-card p-8 text-center">
          <Store className="mx-auto h-10 w-10 text-muted-foreground" />

          <h1 className="mt-3 text-xl font-semibold">Loja não encontrada</h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Sua conta ainda não possui uma loja de artesão cadastrada.
          </p>

          <Button asChild className="mt-4">
            <Link to="/painel">Voltar ao painel</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-5">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/painel" aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>

          <div>
            <h1 className="text-2xl font-semibold">Personalizar minha loja</h1>
            <p className="text-sm text-muted-foreground">
              Deixe sua vitrine com a cara do seu trabalho.
            </p>
          </div>
        </div>

        {/* Capa + logo */}
        <section className="craft-card overflow-hidden">
          <div className="relative h-48 bg-muted sm:h-64">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt="Capa da loja"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                <ImageIcon className="h-10 w-10" />
                <p className="mt-2 text-sm">Sua capa aparecerá aqui</p>
              </div>
            )}

            <div className="absolute bottom-3 right-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={uploadingImage === "cover"}
                className="relative z-0 shadow"
              >
                {uploadingImage === "cover" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="mr-2 h-4 w-4" />
                )}
                {uploadingImage === "cover" ? "Enviando..." : "Alterar capa"}
              </Button>

              <input
                type="file"
                accept="image/*"
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                onChange={handleCoverChange}
                disabled={uploadingImage !== null}
                aria-label="Escolher imagem da capa"
              />
            </div>
          </div>

          <div className="relative px-5 pb-5">
            <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-background bg-accent shadow">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={storeName ? `Logo da ${storeName}` : "Logo da loja"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-accent-foreground">
                    <Store className="h-9 w-9" />
                  </div>
                )}
              </div>

              <div className="flex-1">
                <p className="text-xl font-semibold leading-tight">
                  {storeName || "Nome da sua loja"}
                </p>
                <div className="relative mt-2 inline-block">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingImage === "avatar"}
                    className="relative z-0"
                  >
                    {uploadingImage === "avatar" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="mr-2 h-4 w-4" />
                    )}
                    {uploadingImage === "avatar" ? "Enviando..." : "Alterar logo"}
                  </Button>

                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                    onChange={handleAvatarChange}
                    disabled={uploadingImage !== null}
                    aria-label="Escolher logo da loja"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Informações principais */}
        <section className="craft-card p-5">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Informações da loja</h2>
            <p className="text-sm text-muted-foreground">
              Essas informações serão exibidas para os clientes.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="store-name">Nome da loja</Label>
              <Input
                id="store-name"
                value={storeName}
                onChange={(event) => setStoreName(event.target.value)}
                placeholder="Ex.: Artes da Maria"
                maxLength={80}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="bio">Descrição curta</Label>
              <textarea
                id="bio"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                placeholder="Conte em poucas palavras o que sua loja produz..."
                maxLength={300}
                rows={4}
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                {bio.length}/300 caracteres
              </p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="work-description">O que você faz?</Label>
              <textarea
                id="work-description"
                value={workDescription}
                onChange={(event) => setWorkDescription(event.target.value)}
                placeholder="Ex.: Produzo vasos e peças decorativas em cerâmica, todos feitos à mão e personalizados sob encomenda."
                maxLength={1000}
                rows={5}
                className="flex min-h-[130px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                {workDescription.length}/1000 caracteres. Use este espaço para explicar com detalhes o seu trabalho.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="city"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="Ex.: Maracanaú"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">Estado</Label>
              <Input
                id="state"
                value={state}
                onChange={(event) => setState(event.target.value.toUpperCase())}
                placeholder="Ex.: CE"
                maxLength={2}
              />
            </div>
          </div>
        </section>

        {/* Categorias */}
        <section className="craft-card p-5">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Categorias e especialidades</h2>
            <p className="text-sm text-muted-foreground">
              Escolha as áreas que representam seu trabalho. Você pode marcar mais de uma categoria e mais de uma subcategoria.
            </p>
          </div>

          {categoriesLoading || subcategoriesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando categorias...
            </div>
          ) : categories.length === 0 ? (
            <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
              Nenhuma categoria foi cadastrada ainda. Execute a migração de categorias no Supabase.
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((category) => {
                const categorySelected = selectedCategoryIds.includes(category.id);
                const categoryOpen = openCategoryIds.includes(category.id);
                const categorySubcategories = subcategories.filter(
                  (subcategory) => subcategory.category_id === category.id,
                );
                const selectedCount = categorySubcategories.filter((subcategory) =>
                  selectedSubcategoryIds.includes(subcategory.id),
                ).length;

                return (
                  <div
                    key={category.id}
                    className={`overflow-hidden rounded-xl border transition-colors ${
                      categorySelected ? "border-primary/40 bg-primary/5" : "bg-background"
                    }`}
                  >
                    <div className="flex items-center gap-2 p-3">
                      <button
                        type="button"
                        onClick={() => toggleCategory(category.id)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <span
                          className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${
                            categorySelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input bg-background"
                          }`}
                        >
                          {categorySelected && <Check className="h-3.5 w-3.5" />}
                        </span>

                        <span className="font-medium">{category.name}</span>

                        {selectedCount > 0 && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {selectedCount} selecionada{selectedCount > 1 ? "s" : ""}
                          </span>
                        )}
                      </button>

                      {categorySubcategories.length > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleCategoryOpen(category.id)}
                          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-label={`${categoryOpen ? "Fechar" : "Abrir"} subcategorias de ${category.name}`}
                        >
                          <ChevronDown
                            className={`h-5 w-5 transition-transform ${
                              categoryOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                      )}
                    </div>

                    {categoryOpen && categorySubcategories.length > 0 && (
                      <div className="grid gap-2 border-t bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-3">
                        {categorySubcategories.map((subcategory) => {
                          const selected = selectedSubcategoryIds.includes(subcategory.id);

                          return (
                            <button
                              key={subcategory.id}
                              type="button"
                              onClick={() => toggleSubcategory(subcategory)}
                              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                                selected
                                  ? "border-primary/40 bg-background"
                                  : "border-transparent bg-background/60 hover:border-border"
                              }`}
                            >
                              <span
                                className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
                                  selected
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-input bg-background"
                                }`}
                              >
                                {selected && <Check className="h-3 w-3" />}
                              </span>
                              {subcategory.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-4 text-xs text-muted-foreground">
            Dica: escolha as categorias para facilitar a descoberta da sua loja e use o campo “O que você faz?” acima para explicar os detalhes do seu trabalho.
          </p>
        </section>

        {/* História */}
        <section className="craft-card p-5">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Nossa história</h2>
            <p className="text-sm text-muted-foreground">
              Conte a história da sua arte e da sua loja.
            </p>
          </div>

          <textarea
            value={story}
            onChange={(event) => setStory(event.target.value)}
            placeholder="Como sua história com o artesanato começou? O que torna seu trabalho especial?"
            rows={8}
            className="flex min-h-[180px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </section>

        {/* Contato */}
        <section className="craft-card p-5">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Contato e redes sociais</h2>
            <p className="text-sm text-muted-foreground">
              Facilite o contato dos clientes com sua loja.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="instagram">Instagram</Label>
              <div className="relative">
                <Instagram className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="instagram"
                  value={instagram}
                  onChange={(event) => setInstagram(event.target.value)}
                  placeholder="@minhaloja"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <div className="relative">
                <MessageCircle className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="whatsapp"
                  value={whatsapp}
                  onChange={(event) => setWhatsapp(event.target.value)}
                  placeholder="(85) 99999-9999"
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Salvar */}
        <div className="sticky bottom-4 z-10 flex justify-end">
          <Button
            type="button"
            size="lg"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !storeName.trim()}
            className="shadow-lg"
          >
            <Save className="mr-2 h-4 w-4" />
            {saveMutation.isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
