"use client";

import { useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { uploadMedia } from "@/features/master-data/api/backend";
import {
  MAX_PRODUCT_IMAGE_PICK_BYTES,
  PRODUCT_IMAGE_TARGET_BYTES,
  compressProductImage,
  formatBytes,
} from "@/features/master-data/media";
import type { VariantStepValues } from "@/features/master-data/components/ProductVariantsStep";
import { Button } from "@/components/ui/button";
import { FadeImg } from "@/components/ui/fade-img";

/**
 * One variant's own picture (the gold chair, the silver chair). The storefront shows it in place of the product's pictures
 * when a customer picks this variant; a variant without one keeps showing the product's. Uploaded straight away like a
 * product photo (PNG or JPEG, compressed to the 2 MB limit first) and kept in the form until the product is saved.
 */
export function VariantPicture({ index }: { index: number }) {
  const { control, setValue } = useFormContext<VariantStepValues>();
  const imageUrl = useWatch({ control, name: `variants.${index}.imageUrl` });
  const thumbnailUrl = useWatch({ control, name: `variants.${index}.thumbnailUrl` });
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const shown = thumbnailUrl || imageUrl || "";

  async function pick(file: File | undefined) {
    if (!file) return;
    setProblem(null);
    if (file.type !== "image/jpeg" && file.type !== "image/png") {
      setProblem("Choose a PNG or JPEG picture.");
      return;
    }
    if (file.size > MAX_PRODUCT_IMAGE_PICK_BYTES) {
      setProblem(`Over ${formatBytes(MAX_PRODUCT_IMAGE_PICK_BYTES)}; choose a smaller picture.`);
      return;
    }
    setBusy(true);
    try {
      const [result] = await uploadMedia([await compressProductImage(file, PRODUCT_IMAGE_TARGET_BYTES)], "product");
      if (result?.ok && result.url) {
        setValue(`variants.${index}.imageUrl`, result.url, { shouldDirty: true });
        setValue(`variants.${index}.thumbnailUrl`, result.thumbnailUrl ?? "", { shouldDirty: true });
        if (result.warning) setProblem(result.warning);
      } else {
        setProblem(result?.error ?? "The picture could not be stored.");
      }
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : "The upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted text-muted-foreground">
        {busy ? (
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        ) : shown ? (
          <FadeImg src={shown} alt="" className="size-full object-cover" />
        ) : (
          <ImagePlus className="size-5" aria-hidden="true" />
        )}
      </span>
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-medium">Picture</p>
        <p className="text-xs text-muted-foreground">
          {shown ? "Shown on the storefront when a customer picks this variant." : "Optional. Without one, the product's pictures show."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg"
            className="sr-only"
            aria-label="Variant picture"
            onChange={(event) => void pick(event.target.files?.[0])}
          />
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
            <ImagePlus />
            {shown ? "Change picture" : "Upload picture"}
          </Button>
          {shown ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                setValue(`variants.${index}.imageUrl`, "", { shouldDirty: true });
                setValue(`variants.${index}.thumbnailUrl`, "", { shouldDirty: true });
              }}
            >
              <Trash2 />
              Remove
            </Button>
          ) : null}
        </div>
        {problem ? <p className="text-xs text-destructive">{problem}</p> : null}
      </div>
    </div>
  );
}
