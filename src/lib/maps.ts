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

/** One line of the address search: what to show, and the place it stands for. */
export interface PlaceSuggestion {
  placePrediction: {
    text: { text: string };
    mainText?: { text: string } | null;
    secondaryText?: { text: string } | null;
    toPlace(): Place;
  };
}

interface PlacesLibrary {
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions(request: {
      input: string;
      sessionToken?: unknown;
      includedRegionCodes?: string[];
    }): Promise<{ suggestions: PlaceSuggestion[] }>;
  };
  AutocompleteSessionToken: new () => unknown;
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
    // With loading=async the script's own load event fires before google.maps.importLibrary exists (the first
    // open of a form would fail with "importLibrary is not a function"); Google's callback fires when it is ready.
    const callback = "__tentvaaleMapsReady";
    (window as unknown as Record<string, () => void>)[callback] = () => resolve();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_KEY)}&loading=async&v=weekly&callback=${callback}`;
    script.async = true;
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
