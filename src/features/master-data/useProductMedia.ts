"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listProducts, masterDataKeys } from "@/features/master-data/api";
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
