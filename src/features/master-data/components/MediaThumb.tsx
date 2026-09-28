"use client";

import { useState } from "react";
import { Film } from "lucide-react";
import { FALLBACK_IMAGE, type MediaAsset } from "@/features/master-data/types";
import { cn } from "@/lib/utils";

/**
 * A catalogue record's first image, cropped to the box. A record with only a
 * video shows a film icon; one with no media at all — which is every product
 * in api mode — or whose image fails to load shows FALLBACK_IMAGE. Sized by
 * `className`; a small square by default, for a table cell.
 */
export function MediaThumb({
  media,
  className,
}: {
  media: MediaAsset[] | null | undefined;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const image = media?.find((item) => item.kind === "IMAGE" && item.url);
  const onlyVideo = !image && media?.some((item) => item.kind === "VIDEO");
  const src = image?.url && image.url !== failedUrl ? image.url : FALLBACK_IMAGE;

  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted text-muted-foreground",
        className,
      )}
    >
      {onlyVideo ? (
        <Film className="size-4" aria-hidden="true" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- a local or data URL; nothing to optimise
        <img
          src={src}
          alt=""
          className="size-full object-cover"
          onError={() => setFailedUrl(image?.url ?? null)}
        />
      )}
    </div>
  );
}
