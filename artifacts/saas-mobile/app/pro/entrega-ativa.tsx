import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, StatusBar, Image,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from "react-native-maps";
import * as Location from "expo-location";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import { router, useLocalSearchParams } from "expo-router";
import { useProAuth } from "@/context/ProAuthContext";
import { gerarPixQRCode } from "@/utils/pixQrCode";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "http://localhost:8080/api";

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `${API_BASE}/places/geocode?address=${encodeURIComponent(address)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data?.lat != null && data?.lng != null) return { lat: data.lat, lng: data.lng };
    return null;
  } catch { return null; }
}

async function fetchRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<{ latitude: number; longitude: number }[]> {
  try {
    const url = `${API_BASE}/places/route?fromLat=${origin.lat}&fromLng=${origin.lng}&toLat=${destination.lat}&toLng=${destination.lng}`;
    const res = await fetch(url);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) return data;
    return [];
  } catch { return []; }
}

type Fase = "coleta" | "destino";

export default function EntregaAtivaScreen() {
  const { proUser } = useProAuth();
  const params = useLocalSearchParams<{
    entregaId: string;
    fase: string;
    coletaEndereco: string;
    entregaEndereco: string;
    categoriaName: string;
    valorEstimado: string;
    clienteNome: string;
    descricaoItem: string;
    tipoServico: string;
  }>();

  const [fase, setFase] = useState<Fase>((params.fase as Fase) || "coleta");
  const [myLocation, setMyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [coletaCoords, setColetaCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [entregaCoords, setEntregaCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [loadingRoute, setLoadingRoute] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [mostrarPix, setMostrarPix] = useState(false);
  const mapRef = useRef<MapView>(null);
  const locationSub = useRef<Location.LocationSubscription | null>(null);

  const entregaId = Number(params.entregaId);
  const tipoServico = params.tipoServico || "entrega";
  const tipoIcon = tipoServico === "delivery" ? "🛵" : "📦";
  const tipoLabel = tipoServico === "delivery" ? "Delivery" : "Entrega";

  // Location tracking
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permissão negada", "Ative a localização para usar o mapa.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setMyLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });

      locationSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 30 },
        (pos) => setMyLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
      );
    })();
    return () => { locationSub.current?.remove(); };
  }, []);

  // Geocode addresses and draw route
  useEffect(() => {
    const load = async () => {
      setLoadingRoute(true);
      const [coleta, entrega] = await Promise.all([
        geocodeAddress(params.coletaEndereco || ""),
        geocodeAddress(params.entregaEndereco || ""),
      ]);
      if (coleta) setColetaCoords({ latitude: coleta.lat, longitude: coleta.lng });
      if (entrega) setEntregaCoords({ latitude: entrega.lat, longitude: entrega.lng });

      const origin = fase === "coleta" ? myLocation : coleta;
      const dest = fase === "coleta" ? coleta : entrega;
      if (origin && dest) {
        const originCoords = "latitude" in origin
          ? { lat: origin.latitude, lng: origin.longitude }
          : origin;
        const route = await fetchRoute(originCoords, dest);
        setRouteCoords(route);
      }
      setLoadingRoute(false);
    };
    load();
  }, [fase, params.coletaEndereco, params.entregaEndereco]);

  // Fit map to route
  const fitMap = useCallback(() => {
    const points: { latitude: number; longitude: number }[] = [];
    if (myLocation) points.push(myLocation);
    if (coletaCoords) points.push(coletaCoords);
    if (fase === "destino" && entregaCoords) points.push(entregaCoords);
    if (routeCoords.length > 0) points.push(...routeCoords.slice(0, 5).concat(routeCoords.slice(-5)));
    if (points.length >= 2) {
      mapRef.current?.fitToCoordinates(points, { edgePadding: { top: 120, right: 60, bottom: 280, left: 60 }, animated: true });
    }
  }, [myLocation, coletaCoords, entregaCoords, routeCoords, fase]);

  useEffect(() => { if (!loadingRoute) setTimeout(fitMap, 500); }, [loadingRoute]);

  const handleChegueiColeta = async () => {
    setActionLoading(true);
    try {
      await fetch(`${API_BASE}/motorista-app/entrega/${entregaId}/chegou-coleta`, {
        method: "POST",
        headers: { Authorization: `Bearer ${proUser!.token}` },
      });
      setFase("destino");
    } catch { Alert.alert("Erro", "Tente novamente."); }
    setActionLoading(false);
  };

  const handleFinalizar = async () => {
    Alert.alert("Confirmar entrega", "Confirmar que a entrega foi concluída?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Confirmar", style: "default",
        onPress: async () => {
          setActionLoading(true);
          try {
            const res = await fetch(`${API_BASE}/motorista-app/entrega/${entregaId}/finalizar`, {
              method: "POST",
              headers: { Authorization: `Bearer ${proUser!.token}` },
            });
            if (res.ok) {
              router.replace("/pro/(tabs)/inicio");
            } else {
              Alert.alert("Erro", "Não foi possível finalizar.");
            }
          } catch { Alert.alert("Erro", "Tente novamente."); }
          setActionLoading(false);
        },
      },
    ]);
  };

  const faseColor = fase === "coleta" ? "#10B981" : "#3B82F6";
  const faseLabel = fase === "coleta" ? "Ir buscar" : "Entregar";
  const destActual = fase === "coleta" ? coletaCoords : entregaCoords;
  const destLabel = fase === "coleta" ? params.coletaEndereco : params.entregaEndereco;

  const initialRegion: Region = myLocation
    ? { latitude: myLocation.latitude, longitude: myLocation.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }
    : { latitude: -23.5505, longitude: -46.6333, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <MapView
        ref={mapRef}
        style={s.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        showsTraffic
      >
        {coletaCoords && (
          <Marker coordinate={coletaCoords} title="Coleta" pinColor="#10B981" />
        )}
        {entregaCoords && fase === "destino" && (
          <Marker coordinate={entregaCoords} title="Entrega" pinColor="#3B82F6" />
        )}
        {routeCoords.length > 0 && (
          <Polyline coordinates={routeCoords} strokeColor={faseColor} strokeWidth={4} lineDashPattern={[0]} />
        )}
      </MapView>

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerBadge}>
          <Text style={s.headerIcon}>{tipoIcon}</Text>
          <Text style={s.headerLabel}>{tipoLabel} em andamento</Text>
        </View>
        {loadingRoute && <ActivityIndicator color="#fff" size="small" />}
      </View>

      {/* Bottom card */}
      <View style={s.card}>
        {/* Phase indicator */}
        <View style={s.phaseRow}>
          <View style={[s.phaseDot, { backgroundColor: fase === "coleta" ? "#10B981" : "#333" }]} />
          <View style={[s.phaseLine, { backgroundColor: fase === "destino" ? "#3B82F6" : "#333" }]} />
          <View style={[s.phaseDot, { backgroundColor: fase === "destino" ? "#3B82F6" : "#333" }]} />
        </View>
        <View style={s.phaseLabels}>
          <Text style={[s.phaseTxt, fase === "coleta" && { color: "#10B981" }]}>Coleta</Text>
          <Text style={[s.phaseTxt, fase === "destino" && { color: "#3B82F6" }]}>Entrega</Text>
        </View>

        {/* Destination */}
        <View style={s.destBox}>
          <View style={[s.destDot, { backgroundColor: faseColor }]} />
          <View style={s.destInfo}>
            <Text style={s.destLabel}>{faseLabel}</Text>
            <Text style={s.destAddr} numberOfLines={2}>{destLabel}</Text>
          </View>
        </View>

        {/* Item + value */}
        <View style={s.metaRow}>
          {params.descricaoItem ? (
            <View style={s.metaPill}>
              <Text style={s.metaTxt}>📦 {params.descricaoItem}</Text>
            </View>
          ) : null}
          <View style={s.metaPill}>
            <Text style={s.metaTxt}>
              💰 R$ {Number(params.valorEstimado).toFixed(2).replace(".", ",")}
            </Text>
          </View>
        </View>

        {/* Toggle PIX (only on destino) */}
        {fase === "destino" && (
          <TouchableOpacity
            style={s.pixToggle}
            onPress={() => setMostrarPix((v) => !v)}
            activeOpacity={0.8}
          >
            <Text style={s.pixToggleTxt}>
              {mostrarPix ? "▲ Esconder PIX" : "💸 Mostrar PIX para o cliente"}
            </Text>
          </TouchableOpacity>
        )}

        {/* PIX card — visible only on destino phase + when expanded */}
        {fase === "destino" && mostrarPix && (() => {
          const pix = proUser?.pix_chave;
          const img = proUser?.pix_imagem_url
            ? `${API_BASE.replace("/api", "")}${proUser.pix_imagem_url}`
            : null;
          return (
            <View style={s.pixCard}>
              <View style={s.pixCardHeader}>
                <Text style={s.pixCardTitle}>💸 Pagamento PIX</Text>
                <Text style={s.pixCardSub}>Mostre para o cliente pagar</Text>
              </View>
              {pix ? (
                <View style={s.pixCardBody}>
                  <View style={s.pixQrWrap}>
                    <QRCode
                      value={gerarPixQRCode(pix, proUser?.nome || "GoTaxi Pro", proUser?.cidade || "Brasil", Number(params.valorEstimado) || undefined)}
                      size={110}
                      backgroundColor="#fff"
                    />
                  </View>
                  <View style={s.pixCardInfo}>
                    <Text style={s.pixTipoLabel}>{proUser?.pix_tipo?.toUpperCase() ?? "CHAVE PIX"}</Text>
                    <Text style={s.pixChaveText} numberOfLines={2}>{pix}</Text>
                    <TouchableOpacity
                      style={s.pixCopyBtn}
                      onPress={() => { Clipboard.setStringAsync(pix); Alert.alert("Copiado!", "Chave PIX copiada."); }}
                    >
                      <Text style={s.pixCopyTxt}>📋 Copiar chave</Text>
                    </TouchableOpacity>
                    {img && (
                      <Image source={{ uri: img }} style={s.pixBankBadge} resizeMode="contain" />
                    )}
                  </View>
                </View>
              ) : img ? (
                <Image source={{ uri: img }} style={s.pixBankImg} resizeMode="contain" />
              ) : (
                <Text style={s.pixNone}>⚠️ Configure seu PIX no Perfil para receber pagamentos.</Text>
              )}
            </View>
          );
        })()}

        {/* Action button */}
        {fase === "coleta" ? (
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: "#10B981" }]}
            onPress={handleChegueiColeta}
            disabled={actionLoading}
          >
            {actionLoading
              ? <ActivityIndicator color="#000" />
              : <Text style={s.actionTxt}>Cheguei ao local de coleta</Text>
            }
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: "#3B82F6" }]}
            onPress={handleFinalizar}
            disabled={actionLoading}
          >
            {actionLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={[s.actionTxt, { color: "#fff" }]}>Confirmar Entrega</Text>
            }
          </TouchableOpacity>
        )}

        {/* Client info */}
        <View style={s.clientRow}>
          <Text style={s.clientName}>{params.clienteNome}</Text>
          <Text style={s.clientCat}>{params.categoriaName}</Text>
        </View>
      </View>

    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111" },
  map: { flex: 1 },
  header: {
    position: "absolute", top: 50, left: 16, right: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  headerBadge: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  headerIcon: { fontSize: 18 },
  headerLabel: { color: "#fff", fontWeight: "700", fontSize: 14 },
  card: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#141414",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 16, paddingBottom: 20, gap: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 16,
  },
  pixToggle: {
    backgroundColor: "#1a1a2e", borderRadius: 12, paddingVertical: 10,
    alignItems: "center", borderWidth: 1, borderColor: "#7C3AED40",
  },
  pixToggleTxt: { color: "#A78BFA", fontSize: 13, fontWeight: "700" },
  phaseRow: { flexDirection: "row", alignItems: "center", gap: 0 },
  phaseDot: { width: 14, height: 14, borderRadius: 7 },
  phaseLine: { flex: 1, height: 3, marginHorizontal: 6 },
  phaseLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: -6 },
  phaseTxt: { color: "#555", fontSize: 12, fontWeight: "700" },
  destBox: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#1E1E1E", borderRadius: 14, padding: 14,
  },
  destDot: { width: 12, height: 12, borderRadius: 6 },
  destInfo: { flex: 1 },
  destLabel: { color: "#888", fontSize: 11, fontWeight: "600", marginBottom: 2 },
  destAddr: { color: "#fff", fontSize: 14, fontWeight: "700", lineHeight: 20 },
  metaRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  metaPill: {
    backgroundColor: "#1E1E1E", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  metaTxt: { color: "#CCC", fontSize: 13, fontWeight: "600" },
  actionBtn: {
    borderRadius: 16, paddingVertical: 18,
    alignItems: "center", justifyContent: "center",
  },
  actionTxt: { color: "#000", fontWeight: "900", fontSize: 16 },
  clientRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  clientName: { color: "#888", fontSize: 13, fontWeight: "600" },
  clientCat: { color: "#555", fontSize: 12 },

  // PIX inline card
  pixCard: {
    backgroundColor: "#1a1a2e",
    borderRadius: 16,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "#7C3AED40",
  },
  pixCardHeader: { gap: 2 },
  pixCardTitle: { fontSize: 14, fontWeight: "800", color: "#A78BFA" },
  pixCardSub: { fontSize: 11, color: "#888" },
  pixCardBody: { flexDirection: "row", gap: 14, alignItems: "center" },
  pixQrWrap: { backgroundColor: "#fff", borderRadius: 10, padding: 6 },
  pixCardInfo: { flex: 1, gap: 6 },
  pixTipoLabel: { fontSize: 10, fontWeight: "800", color: "#7C3AED", letterSpacing: 1 },
  pixChaveText: { fontSize: 12, color: "#ddd", fontWeight: "600", lineHeight: 16 },
  pixCopyBtn: {
    backgroundColor: "#7C3AED", borderRadius: 8,
    paddingVertical: 6, paddingHorizontal: 10, alignSelf: "flex-start",
  },
  pixCopyTxt: { fontSize: 12, fontWeight: "700", color: "#fff" },
  pixBankImg: { width: "100%", height: 80, borderRadius: 8 },
  pixBankBadge: { width: 80, height: 28, marginTop: 4, alignSelf: "flex-start" },
  pixBankImgSmall: { width: "100%", height: 60, borderRadius: 8, marginTop: 4 },
  pixNone: { fontSize: 12, color: "#F59E0B", fontStyle: "italic" },
});
