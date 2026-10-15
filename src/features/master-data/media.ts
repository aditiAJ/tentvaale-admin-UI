import type { MediaAsset } from "@/features/master-data/types";

/**
 * Turns a file the admin picked into a MediaAsset a catalogue record can carry.
 *
 * This is the one place a real upload API would slot in: today it validates
 * the file and makes a browser-local URL for it; with a backend it would send
 * the file and return the server's MediaAsset instead, and nothing that
 * consumes the result would change.
 *
 * The mock's state lives in one localStorage entry with a quota of a few
 * megabytes, which decides how each kind is kept:
 *
 * - An image is downscaled to at most IMAGE_MAX_EDGE px and re-encoded, then
 *   kept as a data URL. That is typically 50–150 KB, small enough to be saved
 *   with the record and survive a reload.
 * - A video cannot be shrunk in the browser and would not fit, so it gets an
 *   object URL that lasts as long as the page. Its name, type and size are
 *   saved; the preview is not.
 */

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const VIDEO_TYPES = ["video/mp4", "video/webm"] as const;

const MB = 1024 * 1024;
/** Limits on the file as picked, before any downscaling. */
export const MAX_IMAGE_BYTES = 10 * MB;
export const MAX_VIDEO_BYTES = 50 * MB;

const IMAGE_MAX_EDGE = 1024;
const IMAGE_QUALITY = 0.8;

/** What the admin may pick for a product photo; the backend's hard cap it must land under. */
export const MAX_PRODUCT_IMAGE_PICK_BYTES = 5 * MB;
export const PRODUCT_IMAGE_TARGET_BYTES = 2 * MB;

/** A refusal written for the admin, shown under the media field. */
export class MediaError extends Error {}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

/** Throws MediaError when the file is the wrong kind or too large. */
export function checkMediaFile(file: File, kind: MediaAsset["kind"]): void {
  if (kind === "IMAGE") {
    if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
      throw new MediaError(`${file.name} is not a JPEG, PNG or WebP image.`);
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new MediaError(`${file.name} is over ${formatBytes(MAX_IMAGE_BYTES)}.`);
    }
  } else {
    if (!(VIDEO_TYPES as readonly string[]).includes(file.type)) {
      throw new MediaError(`${file.name} is not an MP4 or WebM video.`);
    }
    if (file.size > MAX_VIDEO_BYTES) {
      throw new MediaError(`${file.name} is over ${formatBytes(MAX_VIDEO_BYTES)}.`);
    }
  }
}

async function downscaleImage(file: File): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new MediaError(`${file.name} could not be read as an image.`);
  }

  const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // WebP keeps transparency and is small; a browser that cannot encode it
  // hands back PNG instead, which is larger but still correct.
  return canvas.toDataURL("image/webp", IMAGE_QUALITY);
}

/**
 * Re-encodes a product photo under `targetBytes` before it reaches the backend's hard cap
 * (MediaUploadService.MAX_PRODUCT_IMAGE_BYTES) — a no-op if it already fits. JPEGs step down
 * quality first (lossless to the eye at these sizes); PNGs step down dimensions instead, since
 * canvas has no quality knob for PNG and a product cutout's transparency must survive. Gives up
 * after a few steps and returns the original file, letting the backend's own check reject it
 * with its usual message rather than silently shipping something unreadable.
 */
export async function compressProductImage(file: File, targetBytes: number): Promise<File> {
  if (file.size <= targetBytes) return file;
  if (file.type !== "image/jpeg" && file.type !== "image/png") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }

  const draw = (width: number, height: number) => {
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
  };
  const toBlob = (type: string, quality?: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

  let best: Blob | null = null;
  if (file.type === "image/jpeg") {
    draw(bitmap.width, bitmap.height);
    for (const quality of [0.85, 0.7, 0.55, 0.4]) {
      const blob = await toBlob("image/jpeg", quality);
      if (blob) best = blob;
      if (blob && blob.size <= targetBytes) break;
    }
    if (best && best.size > targetBytes) {
      for (const scale of [0.8, 0.6, 0.45]) {
        draw(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
        const blob = await toBlob("image/jpeg", 0.6);
        if (blob) best = blob;
        if (blob && blob.size <= targetBytes) break;
      }
    }
  } else {
    // PNG: no quality parameter, and transparency must survive — shrink dimensions instead.
    for (const scale of [0.85, 0.65, 0.5, 0.35]) {
      draw(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
      const blob = await toBlob("image/png");
      if (blob) best = blob;
      if (blob && blob.size <= targetBytes) break;
    }
  }

  bitmap.close();
  if (!best || best.size >= file.size) return file;
  return new File([best], file.name, { type: file.type });
}

export async function readMedia(
  file: File,
  kind: MediaAsset["kind"],
): Promise<MediaAsset> {
  checkMediaFile(file, kind);

  if (kind === "IMAGE") {
    const url = await downscaleImage(file);
    return {
      id: crypto.randomUUID(),
      kind,
      fileName: file.name,
      contentType: url.slice("data:".length, url.indexOf(";")),
      sizeBytes: file.size,
      url,
    };
  }

  return {
    id: crypto.randomUUID(),
    kind,
    fileName: file.name,
    contentType: file.type,
    sizeBytes: file.size,
    url: URL.createObjectURL(file),
  };
}
