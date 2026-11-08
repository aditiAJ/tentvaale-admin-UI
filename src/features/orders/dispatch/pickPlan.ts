import { apiFetch } from "@/services/api-client";
import { IS_MOCK } from "@/services/data-source";

/** Mirrors LocationViews.PickSource: what one warehouse hands over for an order line, and where it sits there. */
export interface PickSource {
  warehouseId: number;
  warehouseName: string;
  warehouseCode: string;
  quantity: number;
  locations: { code: string; path: string; quantity: number }[];
  /** Units the warehouse owns for this line that are not placed at any location. */
  unplaced: number;
}

/** Mirrors LocationViews.PickLine. `unassigned` is what no warehouse can cover (all of `quantity` when none holds it). */
export interface PickLine {
  productId: number;
  variantId: number | null;
  quantity: number;
  sources: PickSource[];
  unassigned: number;
}

/** Where each of these lines would be picked from. Reads only; the mock data has no warehouses, so nothing is assigned. */
export async function pickPlan(
  lines: { productId: number; variantId: number | null; quantity: number }[],
  signal?: AbortSignal,
): Promise<PickLine[]> {
  if (lines.length === 0) return [];
  if (IS_MOCK) return lines.map((l) => ({ ...l, sources: [], unassigned: l.quantity }));
  return apiFetch<PickLine[]>("/admin/master-data/pick-plan", { method: "POST", body: { lines }, signal });
}
