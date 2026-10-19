"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import type { MediaAsset } from "@/features/master-data/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** The product's video, if it has one with a playable address. */
export function videoOf(media: MediaAsset[] | null | undefined): MediaAsset | undefined {
  return media?.find((item) => item.kind === "VIDEO" && item.url);
}

/** Plays a product video in a dialog; nothing loads or plays until the dialog opens and the viewer presses play. */
export function VideoPlayerDialog({ video, title, onClose }: { video: MediaAsset; title: string; onClose: () => void }) {
  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      description="Product video"
      className="max-w-3xl"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <video
        src={video.url ?? undefined}
        controls
        playsInline
        preload="metadata"
        aria-label={title}
        className="max-h-[65vh] w-full rounded-lg bg-black object-contain"
      />
    </Dialog>
  );
}

/** A "Play video" button for a product that has one; renders nothing otherwise. */
export function ProductVideoButton({
  media,
  title,
  className,
}: {
  media: MediaAsset[] | null | undefined;
  title: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const video = videoOf(media);
  if (!video) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Play video of ${title}`}
        className={cn(
          "flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[0.7rem] font-semibold text-white shadow outline-none transition-colors hover:bg-black/85 focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <Play className="size-3" fill="currentColor" />
        Video
      </button>
      {open ? <VideoPlayerDialog video={video} title={title} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
