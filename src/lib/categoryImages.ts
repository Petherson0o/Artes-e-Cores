import ceramica from "@/assets/cat-ceramica.jpg";
import textil from "@/assets/cat-textil.jpg";
import madeira from "@/assets/cat-madeira.jpg";
import palha from "@/assets/cat-palha.jpg";
import decoracao from "@/assets/cat-decoracao.jpg";

export const categoryImages: Record<string, string> = {
  ceramica,
  textil,
  madeira,
  palha,
  decoracao,
};

export function categoryImage(slug: string | null | undefined, fallbackUrl?: string | null) {
  if (slug && categoryImages[slug]) return categoryImages[slug];
  return fallbackUrl ?? ceramica;
}
