"use client";

import { useRef, useState } from "react";
import { Film, ImagePlus, Loader2, Star, Upload, X } from "lucide-react";
import type { MediaAsset, MediaLimits } from "@/features/master-data/types";
import {
  formatBytes,
  IMAGE_TYPES,
  MediaError,
  readMedia,
  VIDEO_TYPES,
} from "@/features/master-data/media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { IS_MOCK } from "@/services/data-source";
import { mediaFromUrl, uploadMedia } from "@/features/master-data/api/backend";

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
  allowUrl = true,
  expressive = false,
}: {
  media: MediaAsset[];
  limits: MediaLimits;
  onChange: (media: MediaAsset[]) => void;
  /** True while picked files are still being read, so the form can wait. */
  onBusyChange: (busy: boolean) => void;
  disabled?: boolean;
  /** Show the "paste an image URL" row (live backend). Off where only uploading is wanted. */
  allowUrl?: boolean;
  /** A large drop zone and a photo-first gallery instead of the compact picker. */
  expressive?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlText, setUrlText] = useState("");
  const [notes, setNotes] = useState<string | null>(null);

  const images = media.filter((item) => item.kind === "IMAGE");
  const videos = media.filter((item) => item.kind === "VIDEO");
  const replacesImage = limits.images === 1;
  const imagesLeft = replacesImage ? 1 : limits.images - images.length;
  const videosLeft = limits.videos - videos.length;
  const acceptsVideo = limits.videos > 0;
  // Live product media: PNG or JPEG and one MP4, exactly what the backend accepts for products.
  const types: string[] = !IS_MOCK && acceptsVideo
    ? ["image/png", "image/jpeg", "video/mp4"]
    : acceptsVideo
      ? [...IMAGE_TYPES, ...VIDEO_TYPES]
      : [...IMAGE_TYPES];

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
    if (!IS_MOCK) {
      // Live backend: images go to storage in one request, each file with its own outcome.
      const toSend = accepted.map(([file]) => file);
      const warnings: string[] = [];
      try {
        for (const result of toSend.length ? await uploadMedia(toSend, acceptsVideo ? "product" : "general") : []) {
          if (result.ok && result.url) {
            if (result.warning) warnings.push(`${result.fileName}: ${result.warning}`);
            added.push({
              id: crypto.randomUUID(),
              kind: result.contentType?.startsWith("video/") ? "VIDEO" : "IMAGE",
              fileName: result.fileName,
              contentType: result.contentType ?? "",
              sizeBytes: result.sizeBytes,
              url: result.url,
              thumbnailUrl: result.thumbnailUrl,
              width: result.width,
              height: result.height,
            });
          } else {
            problems.push(`${result.fileName}: ${result.error ?? "could not be stored"}`);
          }
        }
      } catch (caught) {
        problems.push(caught instanceof Error ? caught.message : "The upload failed.");
      }
      accepted.length = 0;
      setNotes(warnings.length ? warnings.join(" ") : null);
    }
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

  /** The first image is the primary one (shown on cards and lists); move another to the front. */
  const makePrimary = (item: MediaAsset) => {
    const first = media.findIndex((candidate) => candidate.kind === "IMAGE");
    const at = media.findIndex((candidate) => candidate.id === item.id);
    if (first < 0 || at <= first) return;
    const next = media.filter((candidate) => candidate.id !== item.id);
    next.splice(first, 0, item);
    onChange(next);
  };

  /** api mode: the backend stores image URLs only, so the admin pastes one instead of uploading. */
  const addUrl = () => {
    const text = urlText.trim();
    if (!/^https?:\/\/\S+$/i.test(text)) {
      setError("Enter a full image URL starting with http:// or https://");
      return;
    }
    const item = mediaFromUrl(text);
    if (item.kind === "VIDEO" ? videosLeft <= 0 : imagesLeft <= 0) {
      setError(item.kind === "VIDEO" ? "Only one video is allowed." : `Only ${limits.images} image(s) allowed.`);
      return;
    }
    setError(null);
    setUrlText("");
    const replaced = replacesImage && item.kind === "IMAGE";
    onChange([...(replaced ? videos : media), item]);
  };

  if (expressive) {
    const full = imagesLeft <= 0 && videosLeft <= 0;
    const dropDisabled = locked || full;
    return (
      <div className="flex flex-col gap-4">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            if (!dropDisabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const files = Array.from(event.dataTransfer.files ?? []);
            if (!dropDisabled && files.length) void add(files);
          }}
          className={cn(
            "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
            dragging
              ? "border-primary bg-primary/10"
              : "border-border bg-linear-to-b from-primary/5 to-transparent",
            dropDisabled && "opacity-70",
          )}
        >
          <span
            className={cn(
              "flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform",
              dragging && "scale-110",
            )}
          >
            {busy ? <Loader2 className="size-7 animate-spin" /> : <ImagePlus className="size-7" />}
          </span>
          <div className="space-y-1">
            <p className="text-sm font-semibold">
              {busy ? "Uploading…" : dragging ? "Drop to upload" : "Drag photos and a video here"}
            </p>
            <p className="text-xs text-muted-foreground">
              {full ? "The gallery is full. Remove one to add another." : "or choose them from your device"}
            </p>
          </div>
          <Button
            type="button"
            className="h-10 rounded-full px-6 shadow-md"
            disabled={dropDisabled}
            onClick={() => input.current?.click()}
          >
            <Upload />
            Upload
          </Button>
          <div className="flex flex-wrap justify-center gap-1.5 text-[0.7rem] text-muted-foreground">
            <span className="rounded-full border border-border bg-card px-2.5 py-0.5">
              {images.length} of {limits.images} images
            </span>
            {acceptsVideo ? (
              <span className="rounded-full border border-border bg-card px-2.5 py-0.5">
                {videos.length} of {limits.videos} video
              </span>
            ) : null}
            <span className="rounded-full border border-border bg-card px-2.5 py-0.5">PNG or JPEG, under 2 MB</span>
            {acceptsVideo ? (
              <span className="rounded-full border border-border bg-card px-2.5 py-0.5">MP4, under 10 MB</span>
            ) : null}
            <span className="rounded-full border border-border bg-card px-2.5 py-0.5">Square, 1200 × 1200 is best</span>
          </div>
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

        {notes ? <p className="text-xs text-[var(--warning)]">{notes}</p> : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        {media.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {media.map((item) => {
              const primary = item.kind === "IMAGE" && item.id === images[0]?.id;
              return (
                <li
                  key={item.id}
                  className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted shadow-sm"
                >
                  {item.kind === "IMAGE" && item.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.thumbnailUrl ?? item.url} alt={item.fileName} className="size-full object-cover" />
                  ) : item.url ? (
                    <video
                      src={item.url}
                      muted
                      preload="metadata"
                      controls
                      className="size-full bg-black object-contain"
                      aria-label={item.fileName}
                    />
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-1 px-2 text-center text-muted-foreground">
                      <Film className="size-5" />
                      <span className="text-[0.7rem]">Preview not kept after reload</span>
                    </div>
                  )}
                  <div className="pointer-events-none absolute top-2 left-2">
                    {primary ? (
                      <span className="flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[0.65rem] font-semibold text-primary-foreground shadow">
                        <Star className="size-3" /> Primary
                      </span>
                    ) : item.kind === "VIDEO" ? (
                      <span className="flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[0.65rem] font-semibold text-white">
                        <Film className="size-3" /> Video
                      </span>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="absolute top-2 right-2 size-7 rounded-full bg-card/95 shadow"
                    disabled={locked}
                    onClick={() => remove(item)}
                    aria-label={`Remove ${item.fileName}`}
                    title="Remove"
                  >
                    <X />
                  </Button>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-2.5 pt-6 pb-2 text-white">
                    <p className="truncate text-xs font-medium" title={item.fileName}>
                      {item.fileName}
                    </p>
                    <div className="flex items-center justify-between gap-2 text-[0.65rem] text-white/80">
                      <span className="tabular">{item.sizeBytes ? formatBytes(item.sizeBytes) : "Linked URL"}</span>
                      {item.kind === "IMAGE" && !primary && images.length > 1 ? (
                        <button
                          type="button"
                          className="pointer-events-auto rounded-full bg-white/20 px-2 py-0.5 font-medium hover:bg-white/30 disabled:opacity-50"
                          disabled={locked}
                          onClick={() => makePrimary(item)}
                        >
                          Make primary
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            No photos yet. The first image you add becomes the cover shown on cards and lists.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium">{acceptsVideo ? "Media" : "Image"}</p>

      {!IS_MOCK && allowUrl ? (
        <div className="flex items-center gap-2">
          <Input
            value={urlText}
            onChange={(event) => setUrlText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addUrl();
              }
            }}
            placeholder="https://… image URL"
            disabled={locked}
            aria-label="Image URL"
          />
          <Button type="button" variant="outline" className="h-10 rounded-full px-5 shadow-md" disabled={locked || !urlText.trim()} onClick={addUrl}>
            {replacesImage && images.length ? "Replace" : "Add URL"}
          </Button>
        </div>
      ) : null}

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
        {acceptsVideo && !IS_MOCK ? (
          <p className="basis-full text-xs text-muted-foreground">
            Up to {limits.images} images (PNG or JPEG, square, 1200 x 1200 recommended, 800 to 3000 pixels, under 2 MB each)
            and one MP4 video (under 10 MB, 30 seconds, up to 1080p).
          </p>
        ) : null}
        {notes ? <p className="basis-full text-xs text-[var(--warning)]">{notes}</p> : null}
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
                  <img src={item.thumbnailUrl ?? item.url} alt={item.fileName} className="size-full object-cover" />
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
                {item.kind === "IMAGE" && item.id === images[0]?.id && images.length > 1 ? " · Primary" : ""}
              </p>
              {item.kind === "IMAGE" && images.length > 1 && item.id !== images[0]?.id ? (
                <button
                  type="button"
                  className="text-[0.7rem] text-primary hover:underline disabled:opacity-50"
                  disabled={locked}
                  onClick={() => makePrimary(item)}
                >
                  Make primary
                </button>
              ) : null}
              <p className="text-[0.7rem] text-muted-foreground tabular">
                {item.kind === "VIDEO" ? "Video · " : ""}
                {item.sizeBytes ? formatBytes(item.sizeBytes) : "Linked URL"}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
