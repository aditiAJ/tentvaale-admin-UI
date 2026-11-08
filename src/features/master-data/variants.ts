import type { ProductVariantView, ProductView } from "@/features/master-data/types";

/** The product itself ("Standard"): its default variant, with no type. Never a variant someone added. */
export const isPlainDefault = (variant: ProductVariantView) => Boolean(variant.isDefault && !variant.hasAttributes);

/**
 * The variants staff can pick for a line or a bundle, as the storefront offers them: every active variant, but the
 * plain default only when it is the product's only variant or holds stock of its own (100 plain chairs beside 20
 * Gold). A "Standard" with nothing in stock beside real variants is not a choice. `keepId` stays listed whatever it
 * is, so a line that already names a variant still shows it.
 */
export function choosableVariants(product: ProductView, keepId?: string): ProductVariantView[] {
  const active = product.variants.filter((variant) => variant.active !== false || variant.id === keepId);
  return active.filter(
    (variant) => !isPlainDefault(variant) || variant.id === keepId || active.length === 1 || variant.stock > 0,
  );
}
