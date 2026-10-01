/** One line of a bundle as the form and the request carry it. */
export interface BundleComponentInput {
  productId: string;
  /** Set for a product that has variants. */
  variantId?: string;
  quantity: number;
}

/**
 * Adds `quantity` of a product to a bundle's component list.
 *
 * A bundle holds each product (and variant) at most once, so adding one it already
 * contains raises that component's quantity in place rather than appending a second
 * line; anything else is appended at the end. The list passed in is not
 * changed. Kept apart from the dialog so the rule is one function, not a
 * detail of a click handler.
 */
export function addBundleComponent(
  components: BundleComponentInput[],
  productId: string,
  quantity: number,
  variantId?: string,
): BundleComponentInput[] {
  const index = components.findIndex(
    (component) => component.productId === productId && (component.variantId ?? "") === (variantId ?? ""),
  );
  if (index === -1) return [...components, { productId, variantId, quantity }];
  return components.map((component, i) =>
    i === index ? { ...component, quantity: component.quantity + quantity } : component,
  );
}
