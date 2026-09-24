import type { ProductMedia } from "@/features/master-data/types";

/**
 * Turns a file the admin picked into a ProductMedia the product can carry.
 *
 * This is the one place a real upload API would slot in: today it validates
 * the file and makes a browser-local URL for it; with a backend it would send
 * the file and return the server's ProductMedia instead, and nothing that
 * consumes the result would change.
 *
 * The mock's state lives in one localStorage entry with a quota of a few
 * megabytes, which decides how each kind is kept:
 *
 * - An image is downscaled to at most IMAGE_MAX_EDGE px and re-encoded, then
 *   kept as a data URL. That is typically 50–150 KB, small enough to be saved
 *   with the product and survive a reload.
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

/** A refusal written for the admin, shown under the media field. */
export class MediaError extends Error {}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

/** Throws MediaError when the file is the wrong kind or too large. */
export function checkMediaFile(file: File, kind: ProductMedia["kind"]): void {
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

export async function readProductMedia(
  file: File,
  kind: ProductMedia["kind"],
): Promise<ProductMedia> {
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
