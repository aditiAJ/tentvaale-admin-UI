"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listProducts, listVariantImages, masterDataKeys } from "@/features/master-data/api";
import { useCan } from "@/features/auth";
import type { MediaAsset } from "@/features/master-data/types";

/**
 * Each product's media by product id, for surfaces that show a product without
 * carrying it — availability rows, quotation and order lines, bundle
 * components. They name a product by id, and its image is the product's own,
 * so it is read from the products list those screens share a cache entry with
 * rather than copied onto the line.
 *
 * Empty while loading, for a role that cannot read master data, or if the list
 * is refused; in api mode every entry is undefined. MediaThumb falls back in
 * each case.
 */
export function useProductMedia(): Map<string, MediaAsset[] | undefined> {
  const canRead = useCan("MASTER_DATA_READ");
  const { data } = useQuery({
    queryKey: masterDataKeys.products,
    queryFn: ({ signal }) => listProducts(signal),
    enabled: canRead,
  });
  return useMemo(
    () => new Map((data ?? []).map((product) => [product.id, product.media])),
    [data],
  );
}

/**
 * The picture set for a line: its variant's own picture when the variant has one, otherwise its product's pictures.
 * Variant pictures come from one small list shared by every screen that shows lines.
 */
export function useLineMedia(): (productId: string, variantId?: string | null) => MediaAsset[] | undefined {
  const byProduct = useProductMedia();
  const canRead = useCan("MASTER_DATA_READ");
  const { data } = useQuery({
    queryKey: masterDataKeys.variantImages,
    queryFn: ({ signal }) => listVariantImages(signal),
    enabled: canRead,
  });
  const byVariant = useMemo(
    () =>
      new Map(
        (data ?? []).map((v): [string, MediaAsset[]] => [
          String(v.variantId),
          [{ id: `variant-${v.variantId}`, kind: "IMAGE", fileName: "variant", contentType: "image/*", sizeBytes: 0, url: v.imageUrl, thumbnailUrl: v.thumbnailUrl ?? null }],
        ]),
      ),
    [data],
  );
  return (productId, variantId) => (variantId ? byVariant.get(variantId) : undefined) ?? byProduct.get(productId);
}
