import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

declare global {
  interface Window {
    google: any;
    __googleMapsLoaded: boolean;
  }
}

export type LatLng = { lat: number; lng: number; label?: string };

type Props = {
  style?: any;
  origin?: LatLng;
  destination?: LatLng;
  driverLocation?: LatLng;
  zoom?: number;
  showRoute?: boolean;
  markers?: Array<LatLng & { color?: string; icon?: string }>;
};

const DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ec5fc" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#16213e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1e3a5f" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#0f3460" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1a1a4e" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3f4f6" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a0a1a" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4b6cb7" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#11143c" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#0d2137" }] },
];

const LIGHT_STYLE = [
  { featureType: "all", elementType: "labels.text.fill", stylers: [{ color: "#1e293b" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#e2e8f0" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#bfdbfe" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#dcfce7" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#f8fafc" }] },
];

let scriptLoaded = false;
let scriptLoading = false;
const loadCallbacks: Array<() => void> = [];

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") { resolve(); return; }
    if (window.google?.maps) { resolve(); return; }
    if (scriptLoaded) { resolve(); return; }
    loadCallbacks.push(resolve);
    if (scriptLoading) return;
    scriptLoading = true;
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      scriptLoaded = true;
      scriptLoading = false;
      loadCallbacks.forEach(cb => cb());
      loadCallbacks.length = 0;
    };
    document.head.appendChild(script);
  });
}

function createMarkerIcon(color: string, letter: string): string {
  const svg = `<svg width="36" height="48" viewBox="0 0 36 48" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 0C8.059 0 0 8.059 0 18c0 13.5 18 30 18 30S36 31.5 36 18C36 8.059 27.941 0 18 0z" fill="${color}"/>
    <circle cx="18" cy="18" r="10" fill="white" opacity="0.3"/>
    <text x="18" y="23" text-anchor="middle" fill="white" font-size="13" font-weight="bold" font-family="Arial">${letter}</text>
  </svg>`;
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

function createCarIcon(color: string): string {
  const svg = `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="19" fill="${color}" stroke="white" stroke-width="2"/>
    <path d="M28 22h-1l-1.5-5H14.5L13 22h-1a1 1 0 000 2h1v1.5a.5.5 0 001 0V24h12v1.5a.5.5 0 001 0V24h1a1 1 0 000-2zm-13.5-4h11l1.2 4H13.3L14.5 18zm1.5 6.5a1 1 0 110-2 1 1 0 010 2zm8 0a1 1 0 110-2 1 1 0 010 2z" fill="white"/>
  </svg>`;
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

export default function GoogleMap({ style, origin, destination, driverLocation, zoom = 15, showRoute = true, markers = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const staticMarkersRef = useRef<any[]>([]);
  const driverMarkerRef = useRef<any>(null);
  const routeRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || "";

  // Initialize map once
  useEffect(() => {
    if (!API_KEY) { setError("Google Maps API key não configurada"); return; }

    loadGoogleMapsScript(API_KEY).then(() => {
      if (!containerRef.current || !window.google?.maps) return;
      const center = driverLocation || origin || { lat: -23.5505, lng: -46.6333 };
      const isDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;

      mapRef.current = new window.google.maps.Map(containerRef.current, {
        center,
        zoom,
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: "cooperative",
        styles: isDark ? DARK_STYLE : LIGHT_STYLE,
      });
      setMapReady(true);
    }).catch(() => setError("Erro ao carregar mapa"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_KEY]);

  // Update static markers and route (origin, destination, extra markers) — NOT when driverLocation changes
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const g = window.google.maps;

    staticMarkersRef.current.forEach(m => m.setMap(null));
    staticMarkersRef.current = [];
    if (routeRef.current) { routeRef.current.setMap(null); routeRef.current = null; }

    if (origin) {
      const m = new g.Marker({
        position: origin, map: mapRef.current,
        icon: { url: createMarkerIcon("#22C55E", "A"), scaledSize: new g.Size(36, 48), anchor: new g.Point(18, 48) },
        title: origin.label || "Origem",
      });
      staticMarkersRef.current.push(m);
    }

    if (destination) {
      const m = new g.Marker({
        position: destination, map: mapRef.current,
        icon: { url: createMarkerIcon("#EF4444", "B"), scaledSize: new g.Size(36, 48), anchor: new g.Point(18, 48) },
        title: destination.label || "Destino",
      });
      staticMarkersRef.current.push(m);
    }

    markers.forEach((mk, i) => {
      const m = new g.Marker({
        position: { lat: mk.lat, lng: mk.lng }, map: mapRef.current,
        icon: { url: createMarkerIcon(mk.color || "#3B82F6", mk.icon || String(i + 1)), scaledSize: new g.Size(32, 44), anchor: new g.Point(16, 44) },
        title: mk.label,
      });
      staticMarkersRef.current.push(m);
    });

    if (showRoute && origin && destination) {
      const ds = new g.DirectionsService();
      const dr = new g.DirectionsRenderer({
        map: mapRef.current,
        suppressMarkers: true,
        polylineOptions: { strokeColor: "#3B82F6", strokeWeight: 5, strokeOpacity: 0.85 },
      });
      routeRef.current = dr;
      ds.route(
        { origin: { lat: origin.lat, lng: origin.lng }, destination: { lat: destination.lat, lng: destination.lng }, travelMode: g.TravelMode.DRIVING },
        (result: any, status: string) => {
          if (status === "OK") {
            dr.setDirections(result);
            const bounds = new g.LatLngBounds();
            bounds.extend({ lat: origin.lat, lng: origin.lng });
            bounds.extend({ lat: destination.lat, lng: destination.lng });
            mapRef.current?.fitBounds(bounds, { top: 60, bottom: 60, left: 40, right: 40 });
          }
        }
      );
    } else if (origin) {
      mapRef.current.panTo({ lat: origin.lat, lng: origin.lng });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, JSON.stringify(origin), JSON.stringify(destination), showRoute, JSON.stringify(markers)]);

  // Update ONLY the driver marker smoothly — no route recalc, no full re-render
  useEffect(() => {
    if (!mapReady || !mapRef.current || !driverLocation) return;
    const g = window.google.maps;
    const pos = { lat: driverLocation.lat, lng: driverLocation.lng };
    if (driverMarkerRef.current) {
      driverMarkerRef.current.setPosition(pos);
    } else {
      driverMarkerRef.current = new g.Marker({
        position: pos, map: mapRef.current,
        icon: { url: createCarIcon("#FF6B35"), scaledSize: new g.Size(40, 40), anchor: new g.Point(20, 20) },
        title: "Motorista",
        zIndex: 99,
      });
    }
  }, [mapReady, driverLocation?.lat, driverLocation?.lng]);

  const containerStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    borderRadius: "inherit",
    overflow: "hidden",
    position: "relative",
  };

  return (
    <View style={[styles.container, style]}>
      {error ? (
        <View style={styles.errorBox}>
        </View>
      ) : (
        <div ref={containerRef} style={containerStyle} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: "hidden", backgroundColor: "#1a1a2e" },
  errorBox: { flex: 1, alignItems: "center", justifyContent: "center" },
});
