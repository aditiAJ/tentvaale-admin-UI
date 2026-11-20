"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listProducts } from "@/features/master-data/api";
import { unitLabel, type RateType } from "@/features/master-data/storefront";

/**
 * What a quantity counts depends on how the product is charged: pieces, square feet or running feet. A product charged
 * per sq ft is held in the warehouse, placed, ordered and dispatched in sq ft, so every number for it is that.
 * Returns what to write after a number: "" for pieces (the norm, left unsaid), "sq ft" or "rft" otherwise.
 */
export const unitSuffix = (rateType: RateType | null | undefined) => (rateType && rateType !== "Qty" ? unitLabel(rateType) : "");

/** The same from the backend's own spelling of the rate type (QTY, SQFT, RFT). */
export const unitFromWire = (rateType: string | null | undefined) => (rateType === "SQFT" ? "sq ft" : rateType === "RFT" ? "rft" : "");

/** The unit of each product by id, for screens that list stock or order lines and only know a product id. */
export function useProductUnits() {
  const products = useQuery({
    queryKey: ["master-data", "product-units"],
    queryFn: ({ signal }) => listProducts(signal, { includeInactive: true }),
    staleTime: 5 * 60_000,
  });
  const rates = useMemo(() => new Map((products.data ?? []).map((p) => [p.id, p.rateType] as const)), [products.data]);
  return {
    rateOf: (productId: string | number): RateType => rates.get(String(productId)) ?? "Qty",
    unitOf: (productId: string | number): string => unitSuffix(rates.get(String(productId))),
  };
}

/** A small unit after a number ("120" then "sq ft"); nothing for pieces. */
export function UnitTag({ unit }: { unit: string }) {
  return unit ? <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span> : null;
}
