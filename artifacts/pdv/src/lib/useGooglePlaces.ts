export interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
  lat?: number | null;
  lng?: number | null;
}

export interface PlaceDetails {
  lat: number | null;
  lng: number | null;
  address: string | null;
}

const PLACES_BASE = "/api/places";

export async function fetchAddressPredictions(
  input: string,
  types: string = "address"
): Promise<PlacePrediction[]> {
  if (!input || input.length < 3) return [];
  try {
    const params = new URLSearchParams({ input, types });
    const r = await fetch(`${PLACES_BASE}/autocomplete?${params}`);
    if (!r.ok) return [];
    return r.json();
  } catch {
    return [];
  }
}

export async function fetchCityPredictions(input: string): Promise<PlacePrediction[]> {
  return fetchAddressPredictions(input, "(cities)");
}

export async function fetchPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  if (!placeId) return null;
  try {
    const r = await fetch(`${PLACES_BASE}/details?placeId=${encodeURIComponent(placeId)}`);
    if (!r.ok) return null;
    return r.json();
  } catch {
    return null;
  }
}

// Legacy compat — no-op since we proxy through backend
export function loadGoogleMaps(): Promise<void> {
  return Promise.resolve();
}
