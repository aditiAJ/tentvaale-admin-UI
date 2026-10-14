import sharp from "sharp";

/**
 * Product image rules (Release 2.0): strict 1:1, 1200-3000px a side, under 5 MB,
 * and real transparency — not just a PNG that happens to carry an (unused) alpha
 * channel. Reject, never auto-crop/trim/pad/cover: a wrong-shaped image is the
 * uploader's to fix, not ours to silently reinterpret.
 */
export const MIN_EDGE = 1200;
export const MAX_EDGE = 3000;
export const MAX_SOURCE_BYTES = 5 * 1024 * 1024;

export type ValidationResult =
  | { ok: true; width: number; height: number }
  | { ok: false; error: string };

/**
 * `sharp(...).stats().isOpaque` is true both for images with no alpha channel
 * and for ones whose alpha channel is present but every pixel is fully opaque
 * (min alpha === 255) — exactly the "nominal alpha, no real transparency" trap
 * the spec calls out. hasAlpha from metadata alone can't tell these apart.
 */
async function hasRealTransparency(image: ReturnType<typeof sharp>): Promise<boolean> {
  const stats = await image.stats();
  return stats.isOpaque === false;
}

export async function validateProductImage(bytes: Buffer): Promise<ValidationResult> {
  if (bytes.byteLength === 0) {
    return { ok: false, error: "The file is empty" };
  }
  if (bytes.byteLength > MAX_SOURCE_BYTES) {
    return { ok: false, error: `The file is ${(bytes.byteLength / 1048576).toFixed(1)} MB; it must be under 5 MB` };
  }

  const image = sharp(bytes, { failOn: "error" });
  let metadata: Awaited<ReturnType<typeof image.metadata>>;
  try {
    metadata = await image.metadata();
  } catch {
    return { ok: false, error: "The file is not a readable image" };
  }

  const { width, height, hasAlpha } = metadata;
  if (!width || !height) {
    return { ok: false, error: "The file is not a readable image" };
  }
  if (width !== height) {
    return { ok: false, error: `The image is ${width} x ${height}; it must be exactly square (1:1)` };
  }
  if (width < MIN_EDGE) {
    return { ok: false, error: `The image is ${width} x ${height}; it must be at least ${MIN_EDGE} x ${MIN_EDGE}` };
  }
  if (width > MAX_EDGE) {
    return { ok: false, error: `The image is ${width} x ${height}; it may be at most ${MAX_EDGE} x ${MAX_EDGE}` };
  }
  if (!hasAlpha) {
    return { ok: false, error: "The image has no transparent background — export as a PNG with a transparent background" };
  }
  if (!(await hasRealTransparency(image))) {
    return { ok: false, error: "The image carries an alpha channel but no pixel is actually transparent — flatten it onto the real background and re-export with true transparency" };
  }

  return { ok: true, width, height };
}
