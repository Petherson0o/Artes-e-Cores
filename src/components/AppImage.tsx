import { useQuery } from "@tanstack/react-query";
import { ImageIcon } from "lucide-react";
import { resolveImageUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

export function AppImage({
  src,
  alt,
  className,
  fallbackClassName,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}) {
  const { data } = useQuery({
    queryKey: ["image", src],
    queryFn: () => resolveImageUrl(src),
    enabled: !!src,
    staleTime: 1000 * 60 * 30,
  });

  if (!data) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-sand text-muted-foreground",
          className,
          fallbackClassName,
        )}
        aria-label={alt}
      >
        <ImageIcon className="h-6 w-6 opacity-60" />
      </div>
    );
  }

  return <img src={data} alt={alt} loading="lazy" className={className} />;
}
