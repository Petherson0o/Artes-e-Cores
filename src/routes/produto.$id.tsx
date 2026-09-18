import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Minus,
  Plus,
  MapPin,
  Star,
  Hammer,
  Clock,
  ShoppingBag,
  Camera,
  CheckCircle2,
  Image as ImageIcon,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { AppImage } from "@/components/AppImage";
import { FavoriteButton } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/produto/$id")({
  head: () => ({
    meta: [
      { title: "Produto artesanal — Arte & Cores" },
      {
        name: "description",
        content:
          "Detalhes da peça artesanal, artesão, materiais e disponibilidade.",
      },
      {
        property: "og:title",
        content: "Produto artesanal — Arte & Cores",
      },
      {
        property: "og:description",
        content: "Detalhes da peça artesanal e do artesão.",
      },
    ],
  }),
  component: Produto,
});

type Review = {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  profiles:
    | {
        name: string | null;
        avatar_url: string | null;
      }
    | null;
};

function StarRating({
  value,
  onChange,
  interactive = false,
  size = "normal",
}: {
  value: number;
  onChange?: (value: number) => void;
  interactive?: boolean;
  size?: "small" | "normal" | "large";
}) {
  const sizeClass =
    size === "small"
      ? "h-3.5 w-3.5"
      : size === "large"
        ? "h-7 w-7"
        : "h-5 w-5";

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= value;

        if (interactive) {
          return (
            <button
              key={star}
              type="button"
              onClick={() => onChange?.(star)}
              className="transition-transform hover:scale-110"
              aria-label={`${star} estrela${star > 1 ? "s" : ""}`}
            >
              <Star
                className={`${sizeClass} ${
                  active
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground"
                }`}
              />
            </button>
          );
        }

        return (
          <Star
            key={star}
            className={`${sizeClass} ${
              active
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/40"
            }`}
          />
        );
      })}
    </div>
  );
}

function formatReviewDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

function Produto() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState<string | null>(null);

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewImage, setReviewImage] = useState<File | null>(null);
  const [reviewImagePreview, setReviewImagePreview] = useState<string | null>(
    null,
  );

  const [ratingFilter, setRatingFilter] = useState<number | "all">("all");
  const [mediaOnly, setMediaOnly] = useState(false);

  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [editRating, setEditRating] = useState(5);
  const [editComment, setEditComment] = useState("");
  const [editImage, setEditImage] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(
    null,
  );
  const [removeEditImage, setRemoveEditImage] = useState(false);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "*,categories(name,slug),artisan_profiles(id,store_name,city,state,bio),product_images(id,image_url,sort_order)",
        )
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;

      return data;
    },
  });

  const { data: reviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ["product-reviews", id],
    enabled: !!product,
    queryFn: async () => {
      const { data: reviewData, error: reviewError } = await supabase
        .from("product_reviews")
        .select(
          "id,product_id,user_id,rating,comment,image_url,created_at,updated_at",
        )
        .eq("product_id", id)
        .order("created_at", { ascending: false });

      if (reviewError) throw reviewError;

      const rawReviews = reviewData ?? [];

      if (rawReviews.length === 0) {
        return [];
      }

      const userIds = [
        ...new Set(rawReviews.map((review) => review.user_id)),
      ];

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id,name,avatar_url")
        .in("id", userIds);

      if (profileError) {
        console.warn(
          "Não foi possível carregar os perfis das avaliações:",
          profileError,
        );
      }

      const profilesMap = new Map(
        (profileData ?? []).map((profile) => [
          profile.id,
          {
            name: profile.name,
            avatar_url: profile.avatar_url,
          },
        ]),
      );

      return rawReviews.map((review) => ({
        ...review,
        profiles: profilesMap.get(review.user_id) ?? null,
      })) as Review[];
    },
  });

  const { data: existingReview } = useQuery({
    queryKey: ["my-review", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_reviews")
        .select("id")
        .eq("product_id", id)
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) throw error;

      return data;
    },
  });

  const { data: hasPurchased = false, isLoading: purchaseLoading } = useQuery({
    queryKey: ["has-purchased-product", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("product_id,orders!inner(user_id,status)")
        .eq("product_id", id)
        .eq("orders.user_id", user!.id)
        .eq("orders.status", "delivered")
        .limit(1);

      if (error) throw error;

      return (data?.length ?? 0) > 0;
    },
  });

  const addToCart = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("Entre na sua conta para comprar.");
      }

      if (!product) {
        throw new Error("Produto indisponível.");
      }

      if (qty > product.stock_quantity) {
        throw new Error("Quantidade maior que o estoque.");
      }

      const { data: existing } = await supabase
        .from("cart_items")
        .select("id,quantity")
        .eq("user_id", user.id)
        .eq("product_id", product.id)
        .maybeSingle();

      if (existing) {
        const newQty = Math.min(
          existing.quantity + qty,
          product.stock_quantity,
        );

        const { error } = await supabase
          .from("cart_items")
          .update({ quantity: newQty })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("cart_items").insert({
          user_id: user.id,
          product_id: product.id,
          quantity: qty,
        });

        if (error) throw error;
      }
    },

    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cart-count"] });
      void qc.invalidateQueries({ queryKey: ["cart"] });

      toast.success("Adicionado ao carrinho");
    },

    onError: (e: Error) => {
      toast.error(e.message);

      if (!user) {
        void navigate({ to: "/auth" });
      }
    },
  });

  const submitReview = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("Entre na sua conta para avaliar.");
      }

      if (!hasPurchased) {
        throw new Error(
          "Você precisa ter recebido este produto para avaliá-lo.",
        );
      }

      if (existingReview) {
        throw new Error("Você já avaliou este produto.");
      }

      if (!reviewComment.trim()) {
        throw new Error("Escreva um comentário sobre sua experiência.");
      }

      let imageUrl: string | null = null;

      if (reviewImage) {
        if (reviewImage.size > 5 * 1024 * 1024) {
          throw new Error("A foto deve ter no máximo 5 MB.");
        }

        const extension =
          reviewImage.name.split(".").pop()?.toLowerCase() || "jpg";

        const filePath = `${user.id}/${id}-${Date.now()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("review-images")
          .upload(filePath, reviewImage, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data: publicUrl } = supabase.storage
          .from("review-images")
          .getPublicUrl(filePath);

        imageUrl = publicUrl.publicUrl;
      }

      const { error } = await supabase.from("product_reviews").insert({
        product_id: id,
        user_id: user.id,
        rating: reviewRating,
        comment: reviewComment.trim(),
        image_url: imageUrl,
      });

      if (error) throw error;
    },

    onSuccess: () => {
      toast.success("Avaliação publicada!");

      setReviewComment("");
      setReviewRating(5);
      setReviewImage(null);
      setReviewImagePreview(null);

      void qc.invalidateQueries({
        queryKey: ["product-reviews", id],
      });

      void qc.invalidateQueries({
        queryKey: ["my-review", id, user?.id],
      });

      void qc.invalidateQueries({
        queryKey: ["product", id],
      });
    },

    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  const updateReview = useMutation({
    mutationFn: async () => {
      if (!user || !editingReview) {
        throw new Error("Avaliação inválida.");
      }

      if (!editComment.trim()) {
        throw new Error("Escreva um comentário.");
      }

      let imageUrl = editingReview.image_url;

      if (removeEditImage) {
        imageUrl = null;
      }

      if (editImage) {
        if (editImage.size > 5 * 1024 * 1024) {
          throw new Error("A foto deve ter no máximo 5 MB.");
        }

        const extension =
          editImage.name.split(".").pop()?.toLowerCase() || "jpg";

        const filePath = `${user.id}/${id}-${Date.now()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("review-images")
          .upload(filePath, editImage, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data: publicUrl } = supabase.storage
          .from("review-images")
          .getPublicUrl(filePath);

        imageUrl = publicUrl.publicUrl;
      }

      const { error } = await supabase
        .from("product_reviews")
        .update({
          rating: editRating,
          comment: editComment.trim(),
          image_url: imageUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingReview.id)
        .eq("user_id", user.id);

      if (error) throw error;
    },

    onSuccess: () => {
      toast.success("Avaliação atualizada!");

      setEditingReview(null);
      setEditImage(null);
      setEditImagePreview(null);
      setRemoveEditImage(false);

      void qc.invalidateQueries({
        queryKey: ["product-reviews", id],
      });

      void qc.invalidateQueries({
        queryKey: ["product", id],
      });
    },

    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  const deleteReview = useMutation({
    mutationFn: async (review: Review) => {
      if (!user) {
        throw new Error("Você precisa estar logado.");
      }

      const { error } = await supabase
        .from("product_reviews")
        .delete()
        .eq("id", review.id)
        .eq("user_id", user.id);

      if (error) throw error;
    },

    onSuccess: () => {
      toast.success("Avaliação excluída.");

      void qc.invalidateQueries({
        queryKey: ["product-reviews", id],
      });

      void qc.invalidateQueries({
        queryKey: ["my-review", id, user?.id],
      });

      void qc.invalidateQueries({
        queryKey: ["product", id],
      });
    },

    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  const distribution = useMemo(() => {
    return [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: reviews.filter((review) => review.rating === rating).length,
    }));
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    return [...reviews]
      .filter((review) => {
        if (ratingFilter !== "all" && review.rating !== ratingFilter) {
          return false;
        }

        if (mediaOnly && !review.image_url) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (b.rating !== a.rating) {
          return b.rating - a.rating;
        }

        return (
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
        );
      });
  }, [reviews, ratingFilter, mediaOnly]);

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) /
        reviews.length
      : Number(product?.rating ?? 0);

  const totalReviews = reviews.length || product?.rating_count || 0;

  const startEditing = (review: Review) => {
    setEditingReview(review);
    setEditRating(review.rating);
    setEditComment(review.comment ?? "");
    setEditImage(null);
    setEditImagePreview(review.image_url);
    setRemoveEditImage(false);
  };

  const handleEditImage = (file: File | null) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem válida.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("A foto deve ter no máximo 5 MB.");
      return;
    }

    setEditImage(file);
    setRemoveEditImage(false);

    const previewUrl = URL.createObjectURL(file);
    setEditImagePreview(previewUrl);
  };

  const handleReviewImage = (file: File | null) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem válida.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("A foto deve ter no máximo 5 MB.");
      return;
    }

    setReviewImage(file);

    const previewUrl = URL.createObjectURL(file);
    setReviewImagePreview(previewUrl);
  };

  if (isLoading) {
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </AppShell>
    );
  }

  if (!product) {
    return (
      <AppShell>
        <div className="craft-card p-10 text-center">
          <h1 className="text-xl">Produto não encontrado</h1>

          <Button asChild className="mt-4">
            <Link to="/explorar">Ver outras peças</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const gallery = [
    product.image_url,
    ...(product.product_images ?? []).map(
      (image: { image_url: string }) => image.image_url,
    ),
  ].filter(Boolean) as string[];

  const cover = activeImage ?? gallery[0] ?? null;

  const available =
    product.stock_quantity > 0 && product.status === "published";

  return (
    <AppShell>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <div className="craft-card aspect-square overflow-hidden">
            <AppImage
              src={cover}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          </div>

          {gallery.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {gallery.map((image) => (
                <button
                  key={image}
                  type="button"
                  onClick={() => setActiveImage(image)}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border ${
                    activeImage === image
                      ? "border-primary"
                      : "border-border"
                  }`}
                >
                  <AppImage
                    src={image}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl leading-tight">{product.name}</h1>

            <FavoriteButton productId={product.id} />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />

              {averageRating > 0
                ? averageRating.toFixed(1).replace(".", ",")
                : "Sem avaliações"}

              {totalReviews > 0 && ` (${totalReviews} avaliações)`}
            </span>

            {product.categories && (
              <Badge variant="secondary">
                {product.categories.name}
              </Badge>
            )}
          </div>

          <p className="font-display mt-4 text-3xl text-primary">
            {formatBRL(product.price_cents)}
          </p>

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Produção artesanal</Badge>

            {product.origin_city && (
              <Badge variant="outline">
                Feito em {product.origin_city}
              </Badge>
            )}

            {product.main_material && (
              <Badge variant="outline">
                Material: {product.main_material}
              </Badge>
            )}
          </div>

          <p className="mt-4 whitespace-pre-line text-sm text-muted-foreground">
            {product.description}
          </p>

          <div className="mt-4 grid gap-2 text-sm">
            <p className="flex items-center gap-2">
              <Hammer className="h-4 w-4 text-primary" />

              {available
                ? `${product.stock_quantity} disponível(is)`
                : "No momento indisponível"}
            </p>

            {product.production_days && (
              <p className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />

                Prazo de produção: {product.production_days} dia(s)
              </p>
            )}

            {product.artisan_profiles && (
              <Link
                to="/artesao/$id"
                params={{ id: product.artisan_profiles.id }}
                className="flex items-center gap-2 text-primary hover:underline"
              >
                <MapPin className="h-4 w-4" />

                {product.artisan_profiles.store_name}

                {product.artisan_profiles.city
                  ? ` · ${product.artisan_profiles.city}`
                  : ""}
              </Link>
            )}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <div className="flex items-center rounded-lg border border-border">
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setQty((current) => Math.max(1, current - 1))
                }
              >
                <Minus className="h-4 w-4" />
              </Button>

              <span className="w-10 text-center">{qty}</span>

              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setQty((current) =>
                    Math.min(product.stock_quantity, current + 1),
                  )
                }
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <Button
              className="flex-1"
              size="lg"
              disabled={!available || addToCart.isPending}
              onClick={() => addToCart.mutate()}
            >
              <ShoppingBag className="mr-2 h-4 w-4" />

              {available ? "Adicionar ao carrinho" : "Indisponível"}
            </Button>
          </div>
        </div>
      </div>

      {/* AVALIAÇÕES */}
      <section className="mt-10 border-t border-border pt-8">
        <div className="mb-6">
          <h2 className="text-2xl">Avaliações dos compradores</h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Veja o que quem comprou e recebeu esta peça achou.
          </p>
        </div>

        <div className="craft-card p-5">
          <div className="grid gap-6 md:grid-cols-[180px_1fr] md:items-center">
            <div className="text-center md:border-r md:border-border">
              <div className="text-4xl font-semibold">
                {averageRating > 0
                  ? averageRating.toFixed(1).replace(".", ",")
                  : "0,0"}
              </div>

              <div className="mt-2 flex justify-center">
                <StarRating value={Math.round(averageRating)} />
              </div>

              <p className="mt-2 text-sm text-muted-foreground">
                {totalReviews} avaliação
                {totalReviews !== 1 ? "ões" : ""}
              </p>
            </div>

            <div className="grid gap-2">
              {distribution.map(({ rating, count }) => {
                const percentage =
                  totalReviews > 0 ? (count / totalReviews) * 100 : 0;

                return (
                  <button
                    key={rating}
                    type="button"
                    onClick={() =>
                      setRatingFilter((current) =>
                        current === rating ? "all" : rating,
                      )
                    }
                    className={`grid grid-cols-[55px_1fr_45px] items-center gap-2 rounded-md p-1 text-left transition-colors hover:bg-muted ${
                      ratingFilter === rating ? "bg-muted" : ""
                    }`}
                  >
                    <span className="flex items-center gap-1 text-sm">
                      {rating}

                      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    </span>

                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-yellow-400 transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    <span className="text-right text-sm text-muted-foreground">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* FILTROS */}
        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={ratingFilter === "all" ? "default" : "outline"}
            onClick={() => setRatingFilter("all")}
          >
            Todas
          </Button>

          <Button
            type="button"
            size="sm"
            variant={mediaOnly ? "default" : "outline"}
            onClick={() => setMediaOnly((current) => !current)}
          >
            <Camera className="mr-2 h-4 w-4" />
            Com fotos
          </Button>
        </div>

        {/* FORMULÁRIO DE AVALIAÇÃO */}
        <div className="mt-6">
          {!user ? (
            <div className="craft-card p-6 text-center">
              <h3 className="text-lg font-medium">
                Quer avaliar este produto?
              </h3>

              <p className="mt-2 text-sm text-muted-foreground">
                Entre na sua conta e, depois de receber o produto, você poderá
                deixar sua avaliação.
              </p>

              <Button asChild className="mt-4">
                <Link to="/auth">Entrar</Link>
              </Button>
            </div>
          ) : purchaseLoading ? (
            <div className="craft-card p-6">
              <p className="text-sm text-muted-foreground">
                Verificando sua compra...
              </p>
            </div>
          ) : existingReview ? (
            <div className="craft-card p-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />

                <h3 className="font-medium">
                  Você já avaliou este produto
                </h3>
              </div>

              <p className="mt-2 text-sm text-muted-foreground">
                Você pode editar ou excluir sua avaliação abaixo.
              </p>
            </div>
          ) : hasPurchased ? (
            <div className="craft-card p-6">
              <div className="mb-5">
                <h3 className="text-lg font-medium">
                  Avalie sua compra
                </h3>

                <div className="mt-1 flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Compra verificada
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">
                  Sua nota
                </p>

                <StarRating
                  value={reviewRating}
                  onChange={setReviewRating}
                  interactive
                  size="large"
                />
              </div>

              <div className="mt-5">
                <label
                  htmlFor="review-comment"
                  className="mb-2 block text-sm font-medium"
                >
                  Seu comentário
                </label>

                <textarea
                  id="review-comment"
                  value={reviewComment}
                  onChange={(event) =>
                    setReviewComment(event.target.value)
                  }
                  placeholder="Conte como foi sua experiência com o produto..."
                  className="min-h-28 w-full resize-y rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-primary"
                  maxLength={1000}
                />

                <p className="mt-1 text-right text-xs text-muted-foreground">
                  {reviewComment.length}/1000
                </p>
              </div>

              <div className="mt-5">
                <p className="mb-2 text-sm font-medium">
                  Foto da compra{" "}
                  <span className="font-normal text-muted-foreground">
                    (opcional)
                  </span>
                </p>

                <div className="flex flex-wrap items-start gap-3">
                  <label className="flex h-28 w-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border transition-colors hover:bg-muted">
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />

                    <span className="mt-2 text-xs text-muted-foreground">
                      Adicionar foto
                    </span>

                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        handleReviewImage(
                          event.target.files?.[0] ?? null,
                        );

                        event.currentTarget.value = "";
                      }}
                    />
                  </label>

                  {reviewImagePreview && (
                    <div className="relative h-28 w-28 overflow-hidden rounded-lg border border-border">
                      <img
                        src={reviewImagePreview}
                        alt="Prévia da avaliação"
                        className="h-full w-full object-cover"
                      />

                      <button
                        type="button"
                        onClick={() => {
                          setReviewImage(null);
                          setReviewImagePreview(null);
                        }}
                        className="absolute right-1 top-1 rounded-full bg-black/70 px-2 py-1 text-xs text-white"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  JPG, PNG ou WEBP · máximo 5 MB
                </p>
              </div>

              <Button
                className="mt-6"
                disabled={
                  submitReview.isPending || !reviewComment.trim()
                }
                onClick={() => submitReview.mutate()}
              >
                {submitReview.isPending
                  ? "Publicando..."
                  : "Publicar avaliação"}
              </Button>
            </div>
          ) : (
            <div className="craft-card p-6">
              <h3 className="font-medium">
                Receba o produto para avaliá-lo
              </h3>

              <p className="mt-2 text-sm text-muted-foreground">
                Apenas clientes que compraram e receberam esta peça podem
                publicar uma avaliação.
              </p>
            </div>
          )}
        </div>

        {/* LISTA DE AVALIAÇÕES */}
        <div className="mt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-medium">
              {ratingFilter === "all"
                ? "Todas as avaliações"
                : `Avaliações com ${ratingFilter} estrela${
                    ratingFilter > 1 ? "s" : ""
                  }`}
            </h3>

            {mediaOnly && (
              <Badge variant="secondary">
                Apenas avaliações com fotos
              </Badge>
            )}
          </div>

          {reviewsLoading ? (
            <div className="craft-card p-6">
              <p className="text-sm text-muted-foreground">
                Carregando avaliações...
              </p>
            </div>
          ) : filteredReviews.length === 0 ? (
            <div className="craft-card p-8 text-center">
              <Camera className="mx-auto h-8 w-8 text-muted-foreground" />

              <h3 className="mt-3 font-medium">
                Nenhuma avaliação encontrada
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Tente alterar os filtros.
              </p>

              {(ratingFilter !== "all" || mediaOnly) && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setRatingFilter("all");
                    setMediaOnly(false);
                  }}
                >
                  Limpar filtros
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredReviews.map((review) => {
                const isMine = user?.id === review.user_id;

                return (
                  <article
                    key={review.id}
                    className="craft-card p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {review.profiles?.avatar_url ? (
                          <img
                            src={review.profiles.avatar_url}
                            alt={review.profiles.name ?? "Cliente"}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium">
                            {(review.profiles?.name ?? "C")
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                        )}

                        <div>
                          <p className="font-medium">
                            {review.profiles?.name || "Cliente"}
                          </p>

                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <StarRating
                              value={review.rating}
                              size="small"
                            />

                            <Badge
                              variant="secondary"
                              className="gap-1 text-[11px]"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Compra verificada
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatReviewDate(review.created_at)}
                        </span>

                        {isMine && (
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => startEditing(review)}
                            >
                              <Pencil className="mr-1.5 h-3.5 w-3.5" />
                              Editar
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={deleteReview.isPending}
                              onClick={() => {
                                const confirmed = window.confirm(
                                  "Tem certeza que deseja excluir sua avaliação?",
                                );

                                if (confirmed) {
                                  deleteReview.mutate(review);
                                }
                              }}
                            >
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                              Excluir
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {review.comment && (
                      <p className="mt-4 whitespace-pre-line text-sm leading-relaxed">
                        {review.comment}
                      </p>
                    )}

                    {review.image_url && (
                      <div className="mt-4">
                        <a
                          href={review.image_url}
                          target="_blank"
                          rel="noreferrer"
                          className="block h-32 w-32 overflow-hidden rounded-lg border border-border"
                        >
                          <img
                            src={review.image_url}
                            alt="Foto enviada pelo comprador"
                            className="h-full w-full object-cover transition-transform hover:scale-105"
                          />
                        </a>
                      </div>
                    )}

                    {review.updated_at !== review.created_at && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Editada em {formatReviewDate(review.updated_at)}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* MODAL DE EDIÇÃO */}
        {editingReview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-background p-6 shadow-xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-medium">
                    Editar avaliação
                  </h3>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Altere sua nota, comentário ou foto.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditingReview(null)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="mt-6">
                <p className="mb-2 text-sm font-medium">
                  Sua nota
                </p>

                <StarRating
                  value={editRating}
                  onChange={setEditRating}
                  interactive
                  size="large"
                />
              </div>

              <div className="mt-5">
                <label
                  htmlFor="edit-review-comment"
                  className="mb-2 block text-sm font-medium"
                >
                  Seu comentário
                </label>

                <textarea
                  id="edit-review-comment"
                  value={editComment}
                  onChange={(event) =>
                    setEditComment(event.target.value)
                  }
                  className="min-h-28 w-full resize-y rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-primary"
                  maxLength={1000}
                />

                <p className="mt-1 text-right text-xs text-muted-foreground">
                  {editComment.length}/1000
                </p>
              </div>

              <div className="mt-5">
                <p className="mb-2 text-sm font-medium">
                  Foto da compra
                </p>

                <div className="flex flex-wrap items-start gap-3">
                  <label className="flex h-28 w-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border transition-colors hover:bg-muted">
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />

                    <span className="mt-2 text-xs text-muted-foreground">
                      Alterar foto
                    </span>

                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        handleEditImage(
                          event.target.files?.[0] ?? null,
                        );

                        event.currentTarget.value = "";
                      }}
                    />
                  </label>

                  {editImagePreview && !removeEditImage && (
                    <div className="relative h-28 w-28 overflow-hidden rounded-lg border border-border">
                      <img
                        src={editImagePreview}
                        alt="Foto da avaliação"
                        className="h-full w-full object-cover"
                      />

                      <button
                        type="button"
                        onClick={() => {
                          setEditImage(null);
                          setEditImagePreview(null);
                          setRemoveEditImage(true);
                        }}
                        className="absolute right-1 top-1 rounded-full bg-black/70 px-2 py-1 text-xs text-white"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  JPG, PNG ou WEBP · máximo 5 MB
                </p>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingReview(null)}
                >
                  Cancelar
                </Button>

                <Button
                  type="button"
                  disabled={
                    updateReview.isPending || !editComment.trim()
                  }
                  onClick={() => updateReview.mutate()}
                >
                  {updateReview.isPending
                    ? "Salvando..."
                    : "Salvar alterações"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}