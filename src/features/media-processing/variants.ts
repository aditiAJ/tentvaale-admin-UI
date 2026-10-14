import sharp from "sharp";

/** Standard tiers always generated; 2000 only when the (already-validated, square) source is large enough not to need upscaling. */
export const STANDARD_SIZES = [300, 600, 1200] as const;
export const ZOOM_SIZE = 2000;

const WEBP_QUALITY = 80;
const WEBP_ALPHA_QUALITY = 95;

export interface Variant {
  size: number;
  buffer: Buffer;
}

/**
 * One WebP per tier the source can support without upscaling, plus the 2000px
 * zoom tier when the source is big enough for it. Colour space is normalised to
 * sRGB explicitly (a source tagged Display P3/Adobe RGB must not just keep that
 * profile's raw numbers reinterpreted as sRGB). Metadata (EXIF/ICC/XMP) is
 * stripped by simply never calling .withMetadata() — sharp's output omits it by
 * default.
 */
export async function generateVariants(bytes: Buffer, sourceWidth: number): Promise<Variant[]> {
  const sizes: number[] = STANDARD_SIZES.filter((s) => s <= sourceWidth);
  if (sourceWidth >= ZOOM_SIZE) {
    sizes.push(ZOOM_SIZE);
  }

  const variants: Variant[] = [];
  for (const size of sizes) {
    const buffer = await sharp(bytes)
      .resize(size, size, { fit: "fill" })
      .toColorspace("srgb")
      .webp({ quality: WEBP_QUALITY, alphaQuality: WEBP_ALPHA_QUALITY })
      .toBuffer();
    variants.push({ size, buffer });
  }
  return variants;
}
