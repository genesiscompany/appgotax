import { Router } from "express";

const router = Router();

// ── Nominatim (OpenStreetMap) — free, no billing required ──────────────────
async function nominatimAutocomplete(input: string): Promise<any[]> {
  const params = new URLSearchParams({
    q: input,
    format: "json",
    addressdetails: "1",
    countrycodes: "br",
    limit: "7",
    "accept-language": "pt-BR",
  });

  const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { "User-Agent": `GoTaxi-App/1.0 (${process.env.PUBLIC_DOMAIN ?? "gotaxi.com.br"})` },
  });

  if (!r.ok) return [];
  const data = await r.json() as any[];

  return data.map((item: any) => {
    const addr = item.address ?? {};
    const road = addr.road ?? addr.pedestrian ?? addr.path ?? "";
    const num = addr.house_number ? `, ${addr.house_number}` : "";
    const district = addr.suburb ?? addr.neighbourhood ?? addr.district ?? "";
    const city = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? "";
    const state = addr.state ?? "";

    const mainText = road ? `${road}${num}` : (item.name || item.display_name.split(",")[0]);
    const secondaryParts = [district, city, state].filter(Boolean);
    const secondaryText = secondaryParts.join(", ");

    return {
      placeId: `osm:${item.osm_id}`,
      description: item.display_name,
      mainText: mainText || item.display_name.split(",")[0],
      secondaryText: secondaryText || item.display_name.split(",").slice(1).join(",").trim(),
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    };
  });
}

// ── Google Places (requires billing) ───────────────────────────────────────
async function googleAutocomplete(input: string, types: string, key: string): Promise<{ predictions: any[]; ok: boolean }> {
  const params = new URLSearchParams({
    input,
    key,
    components: "country:br",
    language: "pt-BR",
    types,
  });

  const r = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`);
  if (!r.ok) return { predictions: [], ok: false };

  const data = await r.json() as any;
  if (data.status === "REQUEST_DENIED" || data.status === "OVER_QUERY_LIMIT") {
    console.warn("Google Places not available:", data.status, data.error_message ?? "");
    return { predictions: [], ok: false };
  }

  const predictions = (data.predictions ?? []).map((p: any) => ({
    placeId: p.place_id,
    description: p.description,
    mainText: p.structured_formatting?.main_text ?? p.description,
    secondaryText: p.structured_formatting?.secondary_text ?? "",
    lat: null,
    lng: null,
  }));

  return { predictions, ok: data.status === "OK" || data.status === "ZERO_RESULTS" };
}

// GET /api/places/autocomplete?input=...&types=address
router.get("/autocomplete", async (req, res) => {
  const input = String(req.query.input ?? "").trim();
  const types = String(req.query.types ?? "address");

  if (!input || input.length < 3) return res.json([]);

  const key = process.env.GOOGLE_MAPS_KEY ?? "";

  try {
    // Try Google first if key is available
    if (key) {
      const { predictions, ok } = await googleAutocomplete(input, types, key);
      if (ok && predictions.length > 0) return res.json(predictions);
    }

    // Fallback to Nominatim (free, always works)
    const results = await nominatimAutocomplete(input);
    return res.json(results);
  } catch (err) {
    console.error("Places autocomplete error:", err);
    // Last resort: try Nominatim
    try {
      const fallback = await nominatimAutocomplete(input);
      return res.json(fallback);
    } catch {
      return res.json([]);
    }
  }
});

// GET /api/places/details?placeId=...
router.get("/details", async (req, res) => {
  const placeId = String(req.query.placeId ?? "").trim();
  if (!placeId) return res.status(400).json({ error: "placeId required" });

  // OSM place IDs — lat/lng already embedded during autocomplete
  if (placeId.startsWith("osm:")) {
    return res.json({ lat: null, lng: null, address: null });
  }

  const key = process.env.GOOGLE_MAPS_KEY ?? "";
  if (!key) return res.json({ lat: null, lng: null, address: null });

  try {
    const params = new URLSearchParams({
      place_id: placeId,
      key,
      fields: "geometry,formatted_address",
      language: "pt-BR",
    });

    const r = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`);
    if (!r.ok) return res.json(null);

    const data = await r.json() as any;
    if (data.status !== "OK") return res.json(null);

    const loc = data.result?.geometry?.location;
    return res.json({
      lat: loc?.lat ?? null,
      lng: loc?.lng ?? null,
      address: data.result?.formatted_address ?? null,
    });
  } catch (err) {
    console.error("Places details error:", err);
    return res.json(null);
  }
});

// GET /api/places/geocode?address=...
// Converts an address string to lat/lng using Nominatim (free) with Google fallback
router.get("/geocode", async (req, res) => {
  const address = String(req.query.address ?? "").trim();
  if (!address) return res.status(400).json({ error: "address required" });

  // Try Google Geocoding first if key available
  const key = process.env.GOOGLE_MAPS_KEY ?? "";
  if (key) {
    try {
      const params = new URLSearchParams({ address, key, language: "pt-BR", region: "BR" });
      const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
      if (r.ok) {
        const data = await r.json() as any;
        if (data.status === "OK" && data.results?.length > 0) {
          const loc = data.results[0].geometry.location;
          return res.json({ lat: loc.lat, lng: loc.lng });
        }
      }
    } catch {}
  }

  // Fallback: Nominatim (free)
  try {
    const params = new URLSearchParams({ q: address, format: "json", limit: "1", countrycodes: "br", "accept-language": "pt-BR" });
    const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { "User-Agent": `GoTaxi-App/1.0 (${process.env.PUBLIC_DOMAIN ?? "gotaxi.com.br"})` },
    });
    if (r.ok) {
      const data = await r.json() as any[];
      if (data.length > 0) return res.json({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
    }
  } catch {}

  return res.json(null);
});

// GET /api/places/route?fromLat=&fromLng=&toLat=&toLng=
// Returns array of {latitude, longitude} for a driving route
router.get("/route", async (req, res) => {
  const fromLat = parseFloat(String(req.query.fromLat ?? ""));
  const fromLng = parseFloat(String(req.query.fromLng ?? ""));
  const toLat = parseFloat(String(req.query.toLat ?? ""));
  const toLng = parseFloat(String(req.query.toLng ?? ""));

  if (isNaN(fromLat) || isNaN(fromLng) || isNaN(toLat) || isNaN(toLng)) {
    return res.status(400).json({ error: "fromLat, fromLng, toLat, toLng required" });
  }

  function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
    let index = 0, lat = 0, lng = 0;
    const coords: { latitude: number; longitude: number }[] = [];
    while (index < encoded.length) {
      let b, shift = 0, result = 0;
      do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lat += (result & 1) ? ~(result >> 1) : result >> 1;
      shift = 0; result = 0;
      do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lng += (result & 1) ? ~(result >> 1) : result >> 1;
      coords.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return coords;
  }

  // Try Google Directions first
  const key = process.env.GOOGLE_MAPS_KEY ?? "";
  if (key) {
    try {
      const params = new URLSearchParams({
        origin: `${fromLat},${fromLng}`,
        destination: `${toLat},${toLng}`,
        key,
        language: "pt-BR",
        region: "BR",
        mode: "driving",
      });
      const r = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params}`);
      if (r.ok) {
        const data = await r.json() as any;
        if (data.status === "OK" && data.routes?.length > 0) {
          const coords = decodePolyline(data.routes[0].overview_polyline.points);
          return res.json(coords);
        }
      }
    } catch {}
  }

  // Fallback: OSRM (free, open source routing)
  try {
    const r = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`
    );
    if (r.ok) {
      const data = await r.json() as any;
      if (data.routes?.length > 0) {
        const coords = data.routes[0].geometry.coordinates.map((c: number[]) => ({ latitude: c[1], longitude: c[0] }));
        return res.json(coords);
      }
    }
  } catch {}

  return res.json([]);
});

export default router;
