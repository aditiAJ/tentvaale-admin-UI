/**
 * The landing page's hero picture runs edge to edge, 440 px tall on a phone and 560 px on a desktop, cropped to fill
 * ("cover"): wide screens show the whole width and a slice of the height, a phone shows only the middle. The guidance
 * below is written for that, and shown to the person uploading it.
 */
export const HERO_GUIDE = {
  /** What to aim for: wide enough to stay sharp on a large desktop screen and on a high-density phone. */
  recommended: { width: 2400, height: 1000 },
  /** Below this the picture looks soft on a desktop; the upload still works, with a warning. */
  softBelowWidth: 1600,
  /** Below this it is refused: stretched across a desktop it would be blurry. */
  minWidth: 1200,
  /** Re-encoded under this, so the first screen of the site stays quick. */
  targetBytes: 1_200_000,
  maxPickBytes: 10 * 1024 * 1024,
  types: ["image/jpeg", "image/png", "image/webp"],
} as const;

export interface PreparedHero {
  file: File;
  width: number;
  height: number;
  /** Stored, but short of the guideline; shown beside the picture. */
  warning: string | null;
}

/**
 * Checks a chosen picture and makes it fit the page: at most 2400 px wide and about 1.2 MB, as a JPEG (it is a photo,
 * so any transparency is flattened onto white). A JPEG already inside both limits is sent as it is. Throws an Error
 * with a plain sentence when the file cannot be used.
 */
export async function prepareHeroImage(file: File): Promise<PreparedHero> {
  if (!(HERO_GUIDE.types as readonly string[]).includes(file.type)) throw new Error("Use a JPEG, PNG or WebP picture.");
  if (file.size > HERO_GUIDE.maxPickBytes) throw new Error("That file is over 10 MB. Choose a smaller one.");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That file could not be read as a picture.");
  }
  const { width, height } = bitmap;
  if (width < HERO_GUIDE.minWidth) {
    bitmap.close();
    throw new Error(`That picture is only ${width} px wide. Use one at least ${HERO_GUIDE.minWidth} px wide, ideally ${HERO_GUIDE.recommended.width}.`);
  }
  const warning =
    width < HERO_GUIDE.softBelowWidth
      ? `${width} px wide is a little small and may look soft on large screens. ${HERO_GUIDE.recommended.width} px is best.`
      : null;

  if (file.type === "image/jpeg" && width <= HERO_GUIDE.recommended.width && file.size <= HERO_GUIDE.targetBytes) {
    bitmap.close();
    return { file, width, height, warning };
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("This browser cannot prepare the picture.");
  }
  const draw = (scale: number) => {
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  };
  const toBlob = (quality: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));

  const scale = Math.min(1, HERO_GUIDE.recommended.width / width);
  let best: Blob | null = null;
  // Quality first, then size, until it is small enough (or the steps run out: the smallest try is used).
  for (const step of [1, 0.85, 0.7]) {
    draw(scale * step);
    for (const quality of [0.88, 0.8, 0.7, 0.6]) {
      const blob = await toBlob(quality);
      if (blob) best = blob;
      if (blob && blob.size <= HERO_GUIDE.targetBytes) {
        bitmap.close();
        const out = new File([blob], "hero.jpg", { type: "image/jpeg" });
        return { file: out, width: canvas.width, height: canvas.height, warning };
      }
    }
  }
  bitmap.close();
  if (!best) throw new Error("This browser could not prepare the picture.");
  return { file: new File([best], "hero.jpg", { type: "image/jpeg" }), width: canvas.width, height: canvas.height, warning };
}
