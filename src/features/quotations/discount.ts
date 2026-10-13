import type { DiscountType } from "./types";

/** "Discount (10%)" for a percentage discount, plain "Discount" for a flat one (MOM-14). */
export function discountLabel(type?: DiscountType, percent?: number | null): string {
  return type === "PERCENT" && percent != null ? `Discount (${Number(percent)}%)` : "Discount";
}

/** The percentage in brackets for a line such as "− ₹100.00 (10%)", or nothing for a flat discount. */
export function discountSuffix(type?: DiscountType, percent?: number | null): string {
  return type === "PERCENT" && percent != null ? ` (${Number(percent)}%)` : "";
}
