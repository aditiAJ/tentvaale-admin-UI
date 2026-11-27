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

/** What the admin may pick for a product photo. */
export const MAX_PRODUCT_IMAGE_PICK_BYTES = 5 * MB;
/**
 * What an image is shrunk to before it is sent. Under 1 MB with room for the form around it, because that is all a
 * web server in front of the app (nginx) accepts unless it is told otherwise; well under the backend's own 2 MB.
 */
export const UPLOAD_TARGET_BYTES = 900 * 1024;
/** The backend's product photo rules: no side under 800 pixels or over 3000. */
const UPLOAD_MIN_EDGE = 800;
const UPLOAD_START_EDGE = 2000;

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
 * Makes an image small enough to send (see UPLOAD_TARGET_BYTES); anything already small enough, and anything that is
 * not a PNG, JPEG or WebP, is returned as it is. A picture with no transparency becomes a JPEG, which is many times
 * smaller than a PNG of the same photo; a cut-out stays a PNG, so it can only get smaller by getting fewer pixels.
 * The shorter side never goes under 800 pixels (or its own size when it is smaller), so a product photo stays
 * acceptable. When even that is not small enough, the smallest version made is sent.
 */
export async function shrinkImageForUpload(file: File, targetBytes = UPLOAD_TARGET_BYTES): Promise<File> {
  if (file.size <= targetBytes) return file;
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    return file;
  }

  const long = Math.max(bitmap.width, bitmap.height);
  const short = Math.min(bitmap.width, bitmap.height);
  const floor = Math.min(1, UPLOAD_MIN_EDGE / short);
  const draw = (wanted: number, background?: string) => {
    // The 3000 pixel ceiling wins over the floor (it only matters for a very long, thin picture).
    const scale = Math.min(Math.max(wanted, floor), 3000 / long);
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  };
  const toBlob = (type: string, quality?: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

  const start = Math.min(1, UPLOAD_START_EDGE / long);
  let transparent = false;
  if (file.type !== "image/jpeg") {
    draw(start);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] < 250) {
        transparent = true;
        break;
      }
    }
  }
  const type = transparent ? "image/png" : "image/jpeg";

  let best: Blob | null = null;
  search: for (const step of [1, 0.8, 0.65, 0.5, 0.35]) {
    draw(start * step, transparent ? undefined : "#ffffff");
    for (const quality of transparent ? [undefined] : [0.85, 0.72, 0.6]) {
      const blob = await toBlob(type, quality);
      if (blob && (!best || blob.size < best.size)) best = blob;
      if (blob && blob.size <= targetBytes) break search;
    }
  }

  bitmap.close();
  if (!best || best.size >= file.size) return file;
  const name = file.name.replace(/\.[^.]+$/, "") + (transparent ? ".png" : ".jpg");
  return new File([best], name, { type });
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
