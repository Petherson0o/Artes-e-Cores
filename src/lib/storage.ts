import { supabase } from "@/integrations/supabase/client";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export async function uploadImage(
  bucket: "product-images" | "avatars",
  userId: string,
  file: File,
): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Formato inválido. Use JPG, PNG ou WebP.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Imagem muito grande (máximo 5MB).");
  }
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;
  return `${bucket}:${path}`;
}

/** Converte a referência salva no banco em uma URL exibível. */
export async function resolveImageUrl(ref: string | null | undefined): Promise<string | null> {
  if (!ref) return null;
  if (ref.startsWith("http")) return ref;
  const [bucket, ...rest] = ref.split(":");
  const path = rest.join(":");
  if (!bucket || !path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}
