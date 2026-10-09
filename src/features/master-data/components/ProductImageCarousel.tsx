"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FALLBACK_IMAGE, type MediaAsset } from "@/features/master-data/types";
import { MediaThumb } from "@/features/master-data/components/MediaThumb";
import { cn } from "@/lib/utils";

/**
 * A product card's picture. One image (or none, or only a video) is exactly what MediaThumb shows. Two or more get
 * previous/next arrows that wrap round, so the set can be paged through endlessly, plus dots and arrow-key support.
 */
export function ProductImageCarousel({
  media,
  alt,
  className,
}: {
  media: MediaAsset[] | null | undefined;
  alt: string;
  className?: string;
}) {
  const images = (media ?? []).filter((item) => item.kind === "IMAGE" && item.url);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Set<string>>(new Set());

  if (images.length < 2) {
    return <MediaThumb media={media} className={cn("aspect-[4/3] h-auto w-full rounded-none border-0", className)} />;
  }

  const current = index % images.length;
  const go = (step: number) => setIndex((current + step + images.length) % images.length);
  const url = images[current].url as string;

  const arrow =
    "absolute top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white outline-none transition-opacity hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-ring sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100";

  return (
    <div
      className={cn("group relative aspect-[4/3] w-full overflow-hidden bg-muted", className)}
      role="group"
      aria-roledescription="carousel"
      aria-label={`${alt} pictures`}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") go(-1);
        if (event.key === "ArrowRight") go(1);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a local or data URL; nothing to optimise */}
      <img
        src={failed.has(url) ? FALLBACK_IMAGE : url}
        alt={`${alt}, picture ${current + 1} of ${images.length}`}
        className="size-full object-cover"
        onError={() => setFailed((set) => new Set(set).add(url))}
      />

      <button type="button" className={cn(arrow, "left-2")} onClick={() => go(-1)} aria-label="Previous picture">
        <ChevronLeft className="size-5" />
      </button>
      <button type="button" className={cn(arrow, "right-2")} onClick={() => go(1)} aria-label="Next picture">
        <ChevronRight className="size-5" />
      </button>

      <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5" aria-hidden="true">
        {images.map((image, dot) => (
          <span
            key={image.id}
            className={cn("size-1.5 rounded-full bg-white/60 shadow", dot === current && "w-4 bg-white")}
          />
        ))}
      </div>
    </div>
  );
}
