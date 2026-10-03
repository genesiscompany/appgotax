// Distância real pelas ruas (Google Directions → OSRM). Linha reta só como último recurso.
export type RoadRoute = { km: number; minutos: number; fonte: "google" | "osrm" | "linha_reta" };

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = Math.PI / 180;
  const h = Math.sin(((lat2 - lat1) * r) / 2) ** 2
    + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

async function fetchJson(url: string, timeoutMs = 6000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: controller.signal });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function roadRoute(lat1: number, lng1: number, lat2: number, lng2: number): Promise<RoadRoute> {
  const key = process.env.GOOGLE_MAPS_KEY;
  if (key) {
    const params = new URLSearchParams({
      origin: `${lat1},${lng1}`, destination: `${lat2},${lng2}`,
      mode: "driving", language: "pt-BR", region: "BR", key,
    });
    const data = await fetchJson(`https://maps.googleapis.com/maps/api/directions/json?${params}`);
    const leg = data?.status === "OK" ? data.routes?.[0]?.legs?.[0] : null;
    if (leg?.distance?.value) {
      return { km: leg.distance.value / 1000, minutos: Math.round((leg.duration?.value ?? 0) / 60), fonte: "google" };
    }
  }
  const osrm = await fetchJson(`https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=false`);
  const route = osrm?.routes?.[0];
  if (route?.distance) {
    return { km: route.distance / 1000, minutos: Math.round(route.duration / 60), fonte: "osrm" };
  }
  console.warn("[roadRoute] rota indisponível, usando linha reta");
  const km = haversineKm(lat1, lng1, lat2, lng2);
  return { km, minutos: Math.round((km / 30) * 60), fonte: "linha_reta" };
}
