/**
 * Google Places (New), loaded only when a key is configured (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY). Without
 * one, forms that use it stay plain text. Only the calls the address search needs are typed here.
 */
interface AddressComponent {
  longText: string | null;
  types: string[];
}

export interface Place {
  id?: string | null;
  location?: { lat(): number; lng(): number } | null;
  formattedAddress?: string | null;
  displayName?: string | null;
  addressComponents?: AddressComponent[] | null;
  fetchFields(options: { fields: string[] }): Promise<unknown>;
}

export interface PlaceSelectEvent extends Event {
  placePrediction: { toPlace(): Place };
}

interface PlacesLibrary {
  PlaceAutocompleteElement: new (options?: { includedRegionCodes?: string[] }) => HTMLElement;
}

declare global {
  interface Window {
    google?: { maps?: { importLibrary(name: "places"): Promise<PlacesLibrary> } };
  }
}

export const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

let loading: Promise<PlacesLibrary> | null = null;

export function loadPlaces(): Promise<PlacesLibrary> {
  if (typeof window === "undefined" || !MAPS_KEY) return Promise.reject(new Error("Maps is not configured"));
  loading ??= new Promise<void>((resolve, reject) => {
    if (window.google?.maps?.importLibrary) return resolve();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_KEY)}&loading=async&v=weekly`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Maps could not be loaded"));
    document.head.appendChild(script);
  })
    .then(() => window.google!.maps!.importLibrary("places"))
    .catch((error) => {
      loading = null;
      throw error;
    });
  return loading;
}

/** The city of a place: its locality, else the district, else the state. */
export function cityOf(place: Place): string {
  const find = (type: string) => place.addressComponents?.find((c) => c.types.includes(type))?.longText ?? undefined;
  return find("locality") ?? find("administrative_area_level_2") ?? find("administrative_area_level_1") ?? "";
}

/** Everything worth keeping from a picked place, for the backend to store. */
export function detailsOf(place: Place) {
  const find = (type: string) => place.addressComponents?.find((c) => c.types.includes(type))?.longText ?? undefined;
  return {
    placeId: place.id ?? undefined,
    latitude: place.location?.lat(),
    longitude: place.location?.lng(),
    postalCode: find("postal_code"),
    state: find("administrative_area_level_1"),
    country: find("country"),
  };
}
