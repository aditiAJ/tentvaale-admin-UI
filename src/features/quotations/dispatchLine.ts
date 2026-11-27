import type { DispatchLine } from "@/features/quotations/types";

/** Keeps only what dispatch needs from a quotation line, so no price travels any further. */
export function dispatchLine(line: DispatchLine): DispatchLine {
  const {
    id, productId, variantId, productName, rateType, quantity, rentalDays, oneTime,
    imageUrl, functionName, functionDate, functionStartTime, functionVenue, remark,
  } = line;
  return {
    id, productId, variantId, productName, rateType, quantity, rentalDays, oneTime,
    imageUrl, functionName, functionDate, functionStartTime, functionVenue, remark,
  };
}
