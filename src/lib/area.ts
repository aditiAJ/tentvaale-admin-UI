/**
 * Area as length by width. An area product is charged by the square foot, but staff know the floor as two sides,
 * so the quotation line has a length box, a width box and the area, each filling the others in.
 */

/** Whole square feet from two sides typed as text ("20" and "12.5" give 250); null until both are positive numbers. */
export function areaOf(length: string, width: string): number | null {
  const l = Number(length);
  const w = Number(width);
  if (!length.trim() || !width.trim() || !Number.isFinite(l) || !Number.isFinite(w) || l <= 0 || w <= 0) return null;
  const area = Math.round(l * w);
  return area >= 1 ? area : null;
}

/**
 * The whole-number length and width nearest to a square that make this area: 400 → 20 × 20, 300 → 15 × 20.
 * Null when it only factors as 1 × n (a prime area), where the suggestion would say nothing useful.
 */
export function bestFit(area: number): [number, number] | null {
  if (!Number.isInteger(area) || area < 4) return null;
  for (let side = Math.floor(Math.sqrt(area)); side > 1; side--) {
    if (area % side === 0) return [side, area / side];
  }
  return null;
}
