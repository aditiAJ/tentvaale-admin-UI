/**
 * Small pure helpers for the Trucks screens: the kinds of vehicle and a truck's status. Nothing here touches React or
 * the "@/" alias, so `npm test` can run it straight from the TypeScript.
 */

/** The kinds the backend accepts (`VehicleType`), with the names people use for them. */
export const VEHICLE_TYPES = [
  { code: "TEMPO", label: "Tempo" },
  { code: "PICKUP", label: "Pickup" },
  { code: "MINI_TRUCK", label: "Mini truck" },
  { code: "TRUCK_407", label: "Medium truck (407)" },
  { code: "HEAVY_TRUCK", label: "Heavy truck" },
  { code: "CONTAINER", label: "Container" },
  { code: "OTHER", label: "Other" },
] as const;

/** The name to show for a stored code; an unknown code is shown as it is rather than hidden. */
export function vehicleTypeLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return VEHICLE_TYPES.find((type) => type.code === code)?.label ?? code;
}

export type TruckStatus = "available" | "maintenance" | "inactive";

/**
 * Where a truck stands: inactive wins (off the fleet), then in the workshop, otherwise available. A truck in
 * maintenance is still active; it is on the fleet but not available to send out.
 */
export function truckStatus(truck: { active?: boolean; inMaintenance?: boolean }): TruckStatus {
  if (truck.active === false) return "inactive";
  return truck.inMaintenance ? "maintenance" : "available";
}

/** "Tata Ace", "Tata", "Ace", or null when neither is recorded. */
export function makeAndModel(truck: { make?: string | null; model?: string | null }): string | null {
  const text = [truck.make, truck.model].filter((part) => part && part.trim()).join(" ");
  return text || null;
}
