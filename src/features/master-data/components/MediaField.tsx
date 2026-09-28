"use client";

import { useRef, useState } from "react";
import { Film, Loader2, Upload, X } from "lucide-react";
import type { MediaAsset, MediaLimits } from "@/features/master-data/types";
import {
  formatBytes,
  IMAGE_TYPES,
  MediaError,
  readMedia,
  VIDEO_TYPES,
} from "@/features/master-data/media";
import { Button } from "@/components/ui/button";

/**
 * Picks, previews and removes a catalogue record's images and video — a
 * product's gallery, or the single image of a category, bundle or collection.
 *
 * Controlled rather than registered with react-hook-form: the value is a list
 * of records built asynchronously from files, not text a resolver can parse,
 * and every rule it has (type, size, count) is checked as a file is added, so
 * there is nothing left for a schema to say at submit time. Nothing leaves the
 * browser until the record itself is saved.
 *
 * Where only one image is allowed, picking another replaces it rather than
 * being refused, since that is what the admin means by picking again.
 */
export function MediaField({
  media,
  limits,
  onChange,
  onBusyChange,
  disabled,
}: {
  media: MediaAsset[];
  limits: MediaLimits;
  onChange: (media: MediaAsset[]) => void;
  /** True while picked files are still being read, so the form can wait. */
  onBusyChange: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const images = media.filter((item) => item.kind === "IMAGE");
  const videos = media.filter((item) => item.kind === "VIDEO");
  const replacesImage = limits.images === 1;
  const imagesLeft = replacesImage ? 1 : limits.images - images.length;
  const videosLeft = limits.videos - videos.length;
  const acceptsVideo = limits.videos > 0;
  const types = acceptsVideo ? [...IMAGE_TYPES, ...VIDEO_TYPES] : [...IMAGE_TYPES];

  /**
   * One picker takes both kinds, so each file is sorted by its type first and
   * the per-kind limits are applied to what is left. A file that is neither is
   * handed to readMedia as an image, whose type check then refuses it with the
   * message the admin should see.
   */
  const add = async (files: File[]) => {
    const pickedVideos = files.filter((file) => file.type.startsWith("video/"));
    const pickedImages = files.filter((file) => !file.type.startsWith("video/"));
    const problems: string[] = [];

    const imageRoom = Math.max(imagesLeft, 0);
    const videoRoom = Math.max(videosLeft, 0);
    if (pickedImages.length > imageRoom) {
      problems.push(
        limits.images === 1
          ? "Only one image is allowed."
          : `Only ${limits.images} images are allowed; ${pickedImages.length - imageRoom} not added.`,
      );
    }
    if (pickedVideos.length > videoRoom) {
      problems.push(acceptsVideo ? "Only one video is allowed." : "Only an image can be added here.");
    }

    const accepted: [File, MediaAsset["kind"]][] = [
      ...pickedImages.slice(0, imageRoom).map((file) => [file, "IMAGE"] as [File, "IMAGE"]),
      ...pickedVideos.slice(0, videoRoom).map((file) => [file, "VIDEO"] as [File, "VIDEO"]),
    ];

    setError(null);
    setBusy(true);
    onBusyChange(true);
    const added: MediaAsset[] = [];
    // One at a time: each image is decoded onto a canvas, and a batch of
    // large photos decoded at once can briefly hold a lot of memory.
    for (const [file, kind] of accepted) {
      try {
        added.push(await readMedia(file, kind));
      } catch (caught) {
        problems.push(
          caught instanceof MediaError ? caught.message : `${file.name} could not be added.`,
        );
      }
    }
    setBusy(false);
    onBusyChange(false);

    if (added.length) {
      const replaced = replacesImage && added.some((item) => item.kind === "IMAGE");
      onChange([...(replaced ? videos : media), ...added]);
    }
    if (problems.length) setError(problems.join(" "));
  };

  const remove = (item: MediaAsset) => {
    setError(null);
    onChange(media.filter((candidate) => candidate.id !== item.id));
  };

  const locked = disabled || busy;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium">{acceptsVideo ? "Media" : "Image"}</p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-full px-5 shadow-md"
          disabled={locked || (imagesLeft <= 0 && videosLeft <= 0)}
          onClick={() => input.current?.click()}
        >
          <Upload />
          {replacesImage && images.length ? "Replace" : "Upload"}
        </Button>
        {busy ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Preparing…
          </span>
        ) : null}

        <input
          ref={input}
          type="file"
          accept={types.join(",")}
          multiple={limits.images + limits.videos > 1}
          hidden
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            // Cleared so picking the same file again still fires a change.
            event.target.value = "";
            if (files.length) void add(files);
          }}
        />
      </div>

      {media.length ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {media.map((item) => (
            <li key={item.id} className="min-w-0">
              <div className="relative aspect-video overflow-hidden rounded-md border border-border bg-muted">
                {item.kind === "IMAGE" && item.url ? (
                  // A plain <img>: the source is a local file or a data URL
                  // made in this browser, which next/image has nothing to
                  // optimise.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt={item.fileName} className="size-full object-cover" />
                ) : item.url ? (
                  <video
                    src={item.url}
                    controls
                    muted
                    preload="metadata"
                    className="size-full bg-black object-contain"
                    aria-label={item.fileName}
                  />
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-1 px-2 text-center text-muted-foreground">
                    <Film className="size-5" />
                    <span className="text-[0.7rem]">Preview not kept after reload</span>
                  </div>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="absolute top-1 right-1 size-7 bg-card/90"
                  disabled={locked}
                  onClick={() => remove(item)}
                  aria-label={`Remove ${item.fileName}`}
                  title="Remove"
                >
                  <X />
                </Button>
              </div>
              <p className="mt-1 truncate text-xs" title={item.fileName}>
                {item.fileName}
              </p>
              <p className="text-[0.7rem] text-muted-foreground tabular">
                {item.kind === "VIDEO" ? "Video · " : ""}
                {formatBytes(item.sizeBytes)}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
