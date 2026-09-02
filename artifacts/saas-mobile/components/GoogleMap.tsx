import React, { useEffect, useMemo, useRef } from "react";
import { View, Text, StyleSheet, useColorScheme } from "react-native";
import WebView from "react-native-webview";

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

function svgPin(color: string, letter: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    `<svg width="36" height="48" viewBox="0 0 36 48" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 0C8.059 0 0 8.059 0 18c0 13.5 18 30 18 30S36 31.5 36 18C36 8.059 27.941 0 18 0z" fill="${color}"/>
      <circle cx="18" cy="18" r="10" fill="white" opacity="0.3"/>
      <text x="18" y="23" text-anchor="middle" fill="white" font-size="13" font-weight="bold" font-family="Arial">${letter}</text>
    </svg>`
  )}`;
}

function svgCar(color: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="19" fill="${color}" stroke="white" stroke-width="2"/>
      <path d="M28 22h-1l-1.5-5H14.5L13 22h-1a1 1 0 000 2h1v1.5a.5.5 0 001 0V24h12v1.5a.5.5 0 001 0V24h1a1 1 0 000-2zm-13.5-4h11l1.2 4H13.3L14.5 18zm1.5 6.5a1 1 0 110-2 1 1 0 010 2zm8 0a1 1 0 110-2 1 1 0 010 2z" fill="white"/>
    </svg>`
  )}`;
}

function buildHtml(opts: {
  isDark: boolean;
  origin?: LatLng;
  destination?: LatLng;
  driverLocation?: LatLng;
  zoom: number;
  showRoute: boolean;
  extraMarkers: Array<LatLng & { color?: string; icon?: string }>;
}): string {
  const center = opts.driverLocation || opts.origin || { lat: -23.5505, lng: -46.6333 };
  const tileUrl = opts.isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const attribution = opts.isDark
    ? "© OpenStreetMap © CARTO"
    : "© OpenStreetMap";

  const markersJson = JSON.stringify([
    ...(opts.origin ? [{ lat: opts.origin.lat, lng: opts.origin.lng, color: "#22C55E", letter: "A", label: opts.origin.label || "Origem" }] : []),
    ...(opts.destination ? [{ lat: opts.destination.lat, lng: opts.destination.lng, color: "#EF4444", letter: "B", label: opts.destination.label || "Destino" }] : []),
    ...opts.extraMarkers.map((mk, i) => ({ lat: mk.lat, lng: mk.lng, color: mk.color || "#3B82F6", letter: mk.icon || String(i + 1), label: mk.label || "" })),
  ]);

  const driverJson = opts.driverLocation
    ? JSON.stringify({ lat: opts.driverLocation.lat, lng: opts.driverLocation.lng })
    : "null";

  const routeJson = opts.showRoute && opts.origin && opts.destination
    ? JSON.stringify({ from: [opts.origin.lat, opts.origin.lng], to: [opts.destination.lat, opts.destination.lng] })
    : "null";

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
html, body, #map { width:100%; height:100%; overflow:hidden; background:${opts.isDark ? "#1a1a2e" : "#e8e8e8"}; }
.leaflet-control-attribution { display:none; }
.leaflet-control-zoom { display:none; }
</style>
</head>
<body>
<div id="map"></div>
<script>
var map = L.map('map', {
  center: [${center.lat}, ${center.lng}],
  zoom: ${opts.zoom},
  zoomControl: false,
  attributionControl: false
});
L.tileLayer('${tileUrl}', { attribution: '${attribution}', maxZoom: 19 }).addTo(map);

function makeIcon(color, letter) {
  var svg = '<svg width="36" height="48" viewBox="0 0 36 48" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M18 0C8.059 0 0 8.059 0 18c0 13.5 18 30 18 30S36 31.5 36 18C36 8.059 27.941 0 18 0z" fill="' + color + '"/>' +
    '<circle cx="18" cy="18" r="10" fill="white" opacity="0.3"/>' +
    '<text x="18" y="23" text-anchor="middle" fill="white" font-size="13" font-weight="bold" font-family="Arial">' + letter + '</text>' +
    '</svg>';
  return L.icon({ iconUrl: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg), iconSize: [36, 48], iconAnchor: [18, 48] });
}
function makeCarIcon(color) {
  var svg = '<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">' +
    '<circle cx="20" cy="20" r="19" fill="' + color + '" stroke="white" stroke-width="2"/>' +
    '<path d="M28 22h-1l-1.5-5H14.5L13 22h-1a1 1 0 000 2h1v1.5a.5.5 0 001 0V24h12v1.5a.5.5 0 001 0V24h1a1 1 0 000-2zm-13.5-4h11l1.2 4H13.3L14.5 18zm1.5 6.5a1 1 0 110-2 1 1 0 010 2zm8 0a1 1 0 110-2 1 1 0 010 2z" fill="white"/>' +
    '</svg>';
  return L.icon({ iconUrl: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg), iconSize: [40, 40], iconAnchor: [20, 20] });
}

var markers = ${markersJson};
markers.forEach(function(m) {
  L.marker([m.lat, m.lng], { icon: makeIcon(m.color, m.letter) }).bindPopup(m.label).addTo(map);
});

var driverData = ${driverJson};
window._driverMarker = null;
if (driverData) {
  window._driverMarker = L.marker([driverData.lat, driverData.lng], { icon: makeCarIcon('#FF6B35'), zIndexOffset: 1000 }).addTo(map);
}

var routeData = ${routeJson};
if (routeData) {
  var fromPt = routeData.from;
  var toPt = routeData.to;
  fetch('https://router.project-osrm.org/route/v1/driving/' + fromPt[1] + ',' + fromPt[0] + ';' + toPt[1] + ',' + toPt[0] + '?overview=full&geometries=geojson')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.routes && data.routes.length > 0) {
        var coords = data.routes[0].geometry.coordinates.map(function(c) { return [c[1], c[0]]; });
        L.polyline(coords, { color: '#3B82F6', weight: 5, opacity: 0.85 }).addTo(map);
        var bounds = L.latLngBounds(coords);
        if (driverData) bounds.extend([driverData.lat, driverData.lng]);
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    })
    .catch(function() {
      var b = L.latLngBounds([fromPt, toPt]);
      map.fitBounds(b, { padding: [40, 40] });
    });
}

window._map = map;
window._updateDriver = function(lat, lng) {
  var pos = [lat, lng];
  if (window._driverMarker) {
    window._driverMarker.setLatLng(pos);
  } else {
    window._driverMarker = L.marker(pos, { icon: makeCarIcon('#FF6B35'), zIndexOffset: 1000 }).addTo(map);
  }
};
</script>
</body>
</html>`;
}

export default function GoogleMap({ style, origin, destination, driverLocation, zoom = 15, showRoute = true, markers = [] }: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const webViewRef = useRef<WebView>(null);

  const html = useMemo(() => buildHtml({
    isDark,
    origin,
    destination,
    driverLocation,
    zoom,
    showRoute,
    extraMarkers: markers,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    isDark,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(origin),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(destination),
    zoom,
    showRoute,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(markers),
    // driverLocation intentionally NOT in deps — updates via injectJavaScript
  ]);

  useEffect(() => {
    if (!driverLocation) return;
    const js = `window._updateDriver(${driverLocation.lat}, ${driverLocation.lng}); true;`;
    webViewRef.current?.injectJavaScript(js);
  }, [driverLocation?.lat, driverLocation?.lng]);

  return (
    <WebView
      ref={webViewRef}
      style={[styles.map, style]}
      source={{ html, baseUrl: "https://gotaxi.com.br" }}
      originWhitelist={["*"]}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
      bounces={false}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  fallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#1a1a2e" },
  fallbackText: { color: "#8ec5fc", fontSize: 13 },
});
