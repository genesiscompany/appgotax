import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, Platform, StatusBar, Image,
  Modal, FlatList, KeyboardAvoidingView, TextInput, Pressable,
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

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ── Main Component ────────────────────────────────────────────────────────────
export default function CorridaAtiva() {
  const { proUser } = useProAuth();
  const params = useLocalSearchParams<{
    corridaId: string;
    mainCorridaId: string;
    fase: string;
    origemEndereco: string;
    destinoEndereco: string;
    categoriaName: string;
    valorEstimado: string;
    clienteNome: string;
  }>();

  const corridaId = Number(params.corridaId);
  const mainCorridaId = Number(params.mainCorridaId || params.corridaId);
  const [fase, setFase] = useState<"embarque" | "destino">(
    (params.fase as any) || "embarque"
  );

  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [destinoCoords, setDestinoCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [chegouDestino, setChegouDestino] = useState(false);
  const [mostrarPix, setMostrarPix] = useState(false);

  const mapRef = useRef<MapView>(null);
  const locationSub = useRef<Location.LocationSubscription | null>(null);

  // ── Chat state ────────────────────────────────────────────────────────────────
  const [chatVisible, setChatVisible] = useState(false);
  const [mensagens, setMensagens] = useState<Array<{ id: number; remetente: string; texto: string; criado_em: string }>>([]);
  const [msgTexto, setMsgTexto] = useState("");
  const [msgSending, setMsgSending] = useState(false);
  const chatPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const [msgNaoLidas, setMsgNaoLidas] = useState(0);
  const lastMsgCountRef = useRef(0);

  // ── Cancel state ───────────────────────────────────────────────────────────
  const [cancelVisible, setCancelVisible] = useState(false);
  const [motivosList, setMotivosList] = useState<Array<{ id: number; texto: string }>>([]);
  const [motivoSel, setMotivoSel] = useState<number | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const fetchMensagens = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/motorista/corridas/${mainCorridaId}/mensagens`);
      if (res.ok) {
        const data = await res.json();
        setMensagens(data);
        if (!chatVisible) {
          const novas = data.length - lastMsgCountRef.current;
          if (novas > 0) setMsgNaoLidas(prev => prev + novas);
        }
        lastMsgCountRef.current = data.length;
      }
    } catch (_) {}
  }, [mainCorridaId, chatVisible]);

  useEffect(() => {
    fetchMensagens();
    chatPollRef.current = setInterval(fetchMensagens, 4000);
    return () => { if (chatPollRef.current) clearInterval(chatPollRef.current); };
  }, [fetchMensagens]);

  useEffect(() => {
    if (chatVisible) {
      setMsgNaoLidas(0);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [chatVisible]);

  const handleEnviarMensagem = async () => {
    if (!msgTexto.trim() || msgSending) return;
    setMsgSending(true);
    try {
      const res = await fetch(`${API_BASE}/motorista/corridas/${mainCorridaId}/mensagens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remetente: "motorista", texto: msgTexto.trim() }),
      });
      if (res.ok) {
        setMsgTexto("");
        await fetchMensagens();
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch (_) {}
    setMsgSending(false);
  };

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${proUser?.token}`,
  };

  // Fetch cancel reasons on mount
  useEffect(() => {
    fetch(`${API_BASE}/motorista-app/motivos-cancelamento`, {
      headers: { Authorization: `Bearer ${proUser?.token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(setMotivosList)
      .catch(() => {});
  }, [proUser?.token]);

  // Poll ride status — detect passenger cancellation
  useEffect(() => {
    const statusPollRef = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/motorista-app/corrida-ativa`, {
          headers: { Authorization: `Bearer ${proUser?.token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data === null || data?.status === "cancelada") {
          clearInterval(statusPollRef);
          Alert.alert(
            "Corrida cancelada",
            "O passageiro cancelou a corrida.",
            [{ text: "OK", onPress: () => router.replace("/pro/(tabs)/inicio") }]
          );
        }
      } catch (_) {}
    }, 5000);
    return () => clearInterval(statusPollRef);
  }, [proUser?.token]);

  const handleCancelar = async () => {
    if (motivoSel === null) return;
    const motivo = motivosList.find(m => m.id === motivoSel);
    if (!motivo) return;
    setCancelLoading(true);
    try {
      const res = await fetch(`${API_BASE}/motorista-app/corrida/${corridaId}/cancelar`, {
        method: "POST",
        headers,
        body: JSON.stringify({ motivo_texto: motivo.texto }),
      });
      if (res.ok) {
        setCancelVisible(false);
        router.replace("/pro/(tabs)/inicio");
      } else {
        Alert.alert("Erro", "Não foi possível cancelar a corrida.");
      }
    } catch {
      Alert.alert("Erro", "Falha de conexão.");
    }
    setCancelLoading(false);
  };

  // Fit map to show route — clamp zoom so distant routes don't zoom too far out
  const fitMap = useCallback((coords: { latitude: number; longitude: number }[]) => {
    if (coords.length === 0 || !mapRef.current) return;
    const lats = coords.map(c => c.latitude);
    const lngs = coords.map(c => c.longitude);
    const latSpan = Math.max(...lats) - Math.min(...lats);
    const lngSpan = Math.max(...lngs) - Math.min(...lngs);
    // If route spans more than ~15 km, center on driver (first point) with fixed zoom
    if (latSpan > 0.14 || lngSpan > 0.14) {
      mapRef.current.animateToRegion({
        latitude: coords[0].latitude,
        longitude: coords[0].longitude,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
      }, 500);
    } else {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 80, right: 60, bottom: 280, left: 60 },
        animated: true,
      });
    }
  }, []);

  // Update route when location or phase changes
  const updateRoute = useCallback(async (
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ) => {
    const pts = await fetchRoute(origin, destination);
    setRouteCoords(pts);
    if (pts.length > 0) {
      fitMap(pts);
    } else {
      // Fallback: fit to just the two points
      fitMap([
        { latitude: origin.lat, longitude: origin.lng },
        { latitude: destination.lat, longitude: destination.lng },
      ]);
    }
  }, [fitMap]);

  // Initialize: request location + geocode addresses
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permissão necessária", "Precisamos da sua localização para navegar.");
          setLoading(false);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const curr = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        if (!mounted) return;
        setCurrentLocation(curr);

        // Geocode addresses in parallel
        const [pickup, destino] = await Promise.all([
          geocodeAddress(params.origemEndereco || ""),
          geocodeAddress(params.destinoEndereco || ""),
        ]);

        if (!mounted) return;
        setPickupCoords(pickup);
        setDestinoCoords(destino);

        const dest = fase === "embarque" ? pickup : destino;
        if (dest) await updateRoute(curr, dest);
      } catch (err) {
        console.log("Location init error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    // Subscribe to location updates
    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 30 },
      (loc) => {
        if (!mounted) return;
        setCurrentLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      }
    ).then(sub => { locationSub.current = sub; }).catch(console.log);

    return () => {
      mounted = false;
      locationSub.current?.remove();
    };
  }, []);

  // Update route when fase changes
  useEffect(() => {
    if (!currentLocation) return;
    const dest = fase === "embarque" ? pickupCoords : destinoCoords;
    if (dest) updateRoute(currentLocation, dest);
  }, [fase, pickupCoords, destinoCoords]);

  const handleChegouEmbarque = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/motorista-app/corrida/${corridaId}/chegou-embarque`, {
        method: "POST", headers,
      });
      if (res.ok) {
        setFase("destino");
      } else {
        Alert.alert("Erro", "Não foi possível confirmar chegada.");
      }
    } catch {
      Alert.alert("Erro", "Falha de conexão.");
    }
    setActionLoading(false);
  };

  const handleChegouDestino = async () => {
    setActionLoading(true);
    try {
      await fetch(`${API_BASE}/motorista-app/corrida/${corridaId}/chegou-destino`, {
        method: "POST", headers,
      });
    } catch (_) {}
    setChegouDestino(true);
    setActionLoading(false);
  };

  const handleFinalizar = async () => {
    Alert.alert(
      "Finalizar corrida",
      "Confirma que chegou ao destino e a corrida foi concluída?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Finalizar",
          style: "default",
          onPress: async () => {
            setActionLoading(true);
            try {
              const res = await fetch(`${API_BASE}/motorista-app/corrida/${corridaId}/finalizar`, {
                method: "POST", headers,
              });
              if (res.ok) {
                router.replace("/pro/(tabs)/inicio");
              } else {
                Alert.alert("Erro", "Não foi possível finalizar.");
              }
            } catch {
              Alert.alert("Erro", "Falha de conexão.");
            }
            setActionLoading(false);
          },
        },
      ]
    );
  };

  const destCoords = fase === "embarque" ? pickupCoords : destinoCoords;
  const destAddress = fase === "embarque" ? params.origemEndereco : params.destinoEndereco;

  const initialRegion: Region = currentLocation
    ? {
        latitude: currentLocation.lat,
        longitude: currentLocation.lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }
    : {
        latitude: -23.5505,
        longitude: -46.6333,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" />

      {/* Map */}
      <MapView
        ref={mapRef}
        style={s.map}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {/* Pickup marker */}
        {pickupCoords && (
          <Marker
            coordinate={{ latitude: pickupCoords.lat, longitude: pickupCoords.lng }}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={s.markerEmbarque}>
              <Text style={s.markerIcon}>📍</Text>
              <Text style={s.markerLabel}>Embarque</Text>
            </View>
          </Marker>
        )}

        {/* Destination marker */}
        {destinoCoords && fase === "destino" && (
          <Marker
            coordinate={{ latitude: destinoCoords.lat, longitude: destinoCoords.lng }}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={s.markerDestino}>
              <Text style={s.markerIcon}>🏁</Text>
              <Text style={s.markerLabelDestino}>Destino</Text>
            </View>
          </Marker>
        )}

        {/* Route polyline */}
        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeWidth={5}
            strokeColor={fase === "embarque" ? "#1DB954" : "#3B9EFF"}
          />
        )}
      </MapView>

      {/* Loading overlay */}
      {loading && (
        <View style={s.loadingOverlay}>
          <ActivityIndicator size="large" color="#1DB954" />
          <Text style={s.loadingText}>Carregando mapa...</Text>
        </View>
      )}

      {/* Top pill — fase indicator */}
      <View style={s.topPill}>
        <View style={[s.pilDot, { backgroundColor: fase === "embarque" ? "#1DB954" : "#3B9EFF" }]} />
        <Text style={s.pilText}>
          {fase === "embarque" ? "Indo ao embarque" : "Viagem em andamento"}
        </Text>
      </View>

      {/* Bottom card */}
      <View style={s.card}>
        {/* Ride info */}
        <View style={s.cardHeader}>
          <View style={[s.categoryBadge, { backgroundColor: fase === "embarque" ? "#1DB95420" : "#3B9EFF20" }]}>
            <Text style={[s.categoryText, { color: fase === "embarque" ? "#1DB954" : "#3B9EFF" }]}>
              {params.categoriaName}
            </Text>
          </View>
          <Text style={s.clienteNome}>{params.clienteNome}</Text>
          <Text style={s.valorText}>R$ {Number(params.valorEstimado).toFixed(2).replace(".", ",")}</Text>
          <TouchableOpacity style={s.chatBtn} onPress={() => setChatVisible(true)}>
            <Text style={s.chatBtnIcon}>💬</Text>
            {msgNaoLidas > 0 && (
              <View style={s.chatBadge}>
                <Text style={s.chatBadgeText}>{msgNaoLidas}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Destination address */}
        <View style={s.addrRow}>
          <Text style={s.addrIcon}>{fase === "embarque" ? "📍" : "🏁"}</Text>
          <View style={s.addrInfo}>
            <Text style={s.addrLabel}>{fase === "embarque" ? "Ponto de embarque" : "Destino"}</Text>
            <Text style={s.addrText} numberOfLines={2}>{destAddress}</Text>
          </View>
        </View>

        {/* Progress steps */}
        <View style={s.steps}>
          <View style={s.step}>
            <View style={[s.stepDot, fase !== "embarque" && s.stepDotDone]} />
            <Text style={[s.stepLabel, fase !== "embarque" && s.stepLabelDone]}>Embarque</Text>
          </View>
          <View style={[s.stepLine, fase !== "embarque" && s.stepLineDone]} />
          <View style={s.step}>
            <View style={[s.stepDot, fase === "destino" && s.stepDotActive]} />
            <Text style={[s.stepLabel, fase === "destino" && s.stepLabelActive]}>Destino</Text>
          </View>
        </View>

        {/* Toggle PIX (only after arrival at destination) */}
        {fase === "destino" && chegouDestino && (
          <TouchableOpacity
            style={s.pixToggleBtn}
            onPress={() => setMostrarPix(v => !v)}
            activeOpacity={0.7}
          >
            <Text style={s.pixToggleTxt}>
              {mostrarPix ? "▲ Esconder PIX" : "💸 Mostrar PIX para o passageiro"}
            </Text>
          </TouchableOpacity>
        )}

        {/* PIX card — visible only after arrival + when expanded */}
        {fase === "destino" && chegouDestino && mostrarPix && (() => {
          const pix = proUser?.pix_chave;
          const img = proUser?.pix_imagem_url
            ? `${API_BASE.replace("/api", "")}${proUser.pix_imagem_url}`
            : null;
          return (
            <View style={s.pixCard}>
              <View style={s.pixCardHeader}>
                <Text style={s.pixCardTitle}>💸 Pagamento PIX</Text>
                <Text style={s.pixCardSub}>Mostre para o passageiro pagar</Text>
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
        {fase === "embarque" ? (
          <TouchableOpacity
            style={[s.btn, s.btnGreen, actionLoading && s.btnDisabled]}
            onPress={handleChegouEmbarque}
            disabled={actionLoading}
          >
            {actionLoading
              ? <ActivityIndicator color="#000" size="small" />
              : <Text style={s.btnText}>✅ Cheguei no embarque</Text>
            }
          </TouchableOpacity>
        ) : !chegouDestino ? (
          <TouchableOpacity
            style={[s.btn, { backgroundColor: "#F59E0B" }, actionLoading && s.btnDisabled]}
            onPress={handleChegouDestino}
            disabled={actionLoading}
          >
            {actionLoading
              ? <ActivityIndicator color="#000" size="small" />
              : <Text style={s.btnText}>📍 Cheguei ao destino</Text>
            }
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.btn, s.btnBlue, actionLoading && s.btnDisabled]}
            onPress={handleFinalizar}
            disabled={actionLoading}
          >
            {actionLoading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={[s.btnText, { color: "#fff" }]}>🏁 Finalizar corrida</Text>
            }
          </TouchableOpacity>
        )}

        {/* Cancel link */}
        <TouchableOpacity style={s.cancelLink} onPress={() => { setMotivoSel(null); setCancelVisible(true); }}>
          <Text style={s.cancelLinkText}>Cancelar corrida</Text>
        </TouchableOpacity>
      </View>

      {/* ── Cancel Modal ───────────────────────────────────────────────── */}
      <Modal visible={cancelVisible} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={s.chatOverlay}>
          <View style={s.cancelSheet}>
            <View style={s.cancelHeader}>
              <Text style={s.cancelTitle}>⚠️ Cancelar corrida</Text>
              <Pressable onPress={() => setCancelVisible(false)} style={s.chatCloseBtn}>
                <Text style={s.chatCloseTxt}>✕</Text>
              </Pressable>
            </View>
            <Text style={s.cancelSubtitle}>Selecione o motivo do cancelamento:</Text>

            <FlatList
              data={motivosList}
              keyExtractor={item => String(item.id)}
              style={s.cancelList}
              ListEmptyComponent={
                <Text style={s.cancelEmpty}>Nenhum motivo disponível no momento.</Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={[s.cancelItem, motivoSel === item.id && s.cancelItemSel]}
                  onPress={() => setMotivoSel(item.id)}
                >
                  <View style={[s.cancelRadio, motivoSel === item.id && s.cancelRadioSel]}>
                    {motivoSel === item.id && <View style={s.cancelRadioDot} />}
                  </View>
                  <Text style={[s.cancelItemText, motivoSel === item.id && s.cancelItemTextSel]}>{item.texto}</Text>
                </Pressable>
              )}
            />

            <TouchableOpacity
              style={[s.cancelConfirmBtn, (motivoSel === null || cancelLoading) && s.btnDisabled]}
              onPress={handleCancelar}
              disabled={motivoSel === null || cancelLoading}
            >
              {cancelLoading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.cancelConfirmTxt}>Confirmar cancelamento</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Chat Modal ──────────────────────────────────────────────────── */}
      <Modal visible={chatVisible} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={s.chatOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.chatSheet}>
            {/* Header */}
            <View style={s.chatHeader}>
              <View style={s.chatHeaderRow}>
                <Text style={s.chatHeaderTitle}>💬 Chat com {params.clienteNome?.split(" ")[0] || "Passageiro"}</Text>
                <Pressable onPress={() => setChatVisible(false)} style={s.chatCloseBtn}>
                  <Text style={s.chatCloseTxt}>✕</Text>
                </Pressable>
              </View>
            </View>

            {/* Messages */}
            <FlatList
              ref={flatListRef}
              data={mensagens}
              keyExtractor={item => String(item.id)}
              contentContainerStyle={s.chatList}
              ListEmptyComponent={
                <View style={s.chatEmpty}>
                  <Text style={s.chatEmptyText}>Nenhuma mensagem ainda</Text>
                </View>
              }
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
              renderItem={({ item }) => {
                const isMe = item.remetente === "motorista";
                return (
                  <View style={[s.msgBubbleRow, isMe && s.msgBubbleRowMe]}>
                    <View style={[s.msgBubble, isMe ? s.msgBubbleMe : s.msgBubbleThem]}>
                      <Text style={[s.msgBubbleText, { color: isMe ? "#000" : "#fff" }]}>{item.texto}</Text>
                    </View>
                  </View>
                );
              }}
            />

            {/* Input */}
            <View style={s.chatInputRow}>
              <TextInput
                style={s.chatInput}
                placeholder="Digite uma mensagem..."
                placeholderTextColor="#666"
                value={msgTexto}
                onChangeText={setMsgTexto}
                multiline
                returnKeyType="send"
                onSubmitEditing={handleEnviarMensagem}
              />
              <Pressable
                style={[s.chatSendBtn, { opacity: msgTexto.trim() ? 1 : 0.4 }]}
                onPress={handleEnviarMensagem}
                disabled={!msgTexto.trim() || msgSending}
              >
                {msgSending
                  ? <ActivityIndicator size="small" color="#000" />
                  : <Text style={s.chatSendTxt}>➤</Text>}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  map: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  topPill: {
    position: "absolute",
    top: Platform.OS === "ios" ? 54 : 40,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  pilDot: { width: 8, height: 8, borderRadius: 4 },
  pilText: { fontSize: 13, fontWeight: "700", color: "#111" },

  // Markers
  markerEmbarque: { alignItems: "center", gap: 2 },
  markerDestino: { alignItems: "center", gap: 2 },
  markerIcon: { fontSize: 28 },
  markerLabel: {
    fontSize: 11, fontWeight: "800", color: "#fff",
    backgroundColor: "#1DB954", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  markerLabelDestino: {
    fontSize: 11, fontWeight: "800", color: "#fff",
    backgroundColor: "#3B9EFF", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },

  // Bottom card
  card: {
    backgroundColor: "#141414",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 16,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  categoryBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  categoryText: { fontSize: 12, fontWeight: "800" },
  clienteNome: { flex: 1, fontSize: 14, fontWeight: "700", color: "#fff" },
  valorText: { fontSize: 20, fontWeight: "900", color: "#fff" },

  addrRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
    padding: 12,
  },
  addrIcon: { fontSize: 20, marginTop: 1 },
  addrInfo: { flex: 1, gap: 3 },
  addrLabel: { fontSize: 11, fontWeight: "700", color: "#666", textTransform: "uppercase", letterSpacing: 0.5 },
  addrText: { fontSize: 13, color: "#fff", fontWeight: "600", lineHeight: 18 },

  // Steps
  steps: { flexDirection: "row", alignItems: "center", gap: 0, paddingHorizontal: 4 },
  step: { alignItems: "center", gap: 4 },
  stepDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#333", borderWidth: 2, borderColor: "#555" },
  stepDotDone: { backgroundColor: "#1DB954", borderColor: "#1DB954" },
  stepDotActive: { backgroundColor: "#3B9EFF", borderColor: "#3B9EFF" },
  stepLine: { flex: 1, height: 2, backgroundColor: "#333" },
  stepLineDone: { backgroundColor: "#1DB954" },
  stepLabel: { fontSize: 11, color: "#555", fontWeight: "600" },
  stepLabelDone: { color: "#1DB954" },
  stepLabelActive: { color: "#3B9EFF" },

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
  pixQrWrap: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 6,
  },
  pixCardInfo: { flex: 1, gap: 6 },
  pixTipoLabel: { fontSize: 10, fontWeight: "800", color: "#7C3AED", letterSpacing: 1 },
  pixChaveText: { fontSize: 12, color: "#ddd", fontWeight: "600", lineHeight: 16 },
  pixCopyBtn: {
    backgroundColor: "#7C3AED",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: "flex-start",
  },
  pixCopyTxt: { fontSize: 12, fontWeight: "700", color: "#fff" },
  pixBankImg: { width: "100%", height: 80, borderRadius: 8 },
  pixBankBadge: { width: 80, height: 28, marginTop: 4, alignSelf: "flex-start" },
  pixToggleBtn: {
    backgroundColor: "#1F1F1F", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16,
    alignItems: "center", borderWidth: 1, borderColor: "#7C3AED55",
  },
  pixToggleTxt: { fontSize: 13, fontWeight: "700", color: "#A78BFA" },
  pixBankImgSmall: { width: "100%", height: 60, borderRadius: 8, marginTop: 4 },
  pixNone: { fontSize: 12, color: "#F59E0B", fontStyle: "italic" },

  // Buttons
  btn: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  btnGreen: { backgroundColor: "#1DB954" },
  btnBlue: { backgroundColor: "#3B9EFF" },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 16, fontWeight: "900", color: "#000" },

  // Chat button in card header
  chatBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#1E1E1E", alignItems: "center", justifyContent: "center" },
  chatBtnIcon: { fontSize: 18 },
  chatBadge: {
    position: "absolute", top: -4, right: -4,
    backgroundColor: "#EF4444", borderRadius: 8, minWidth: 16, height: 16,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 3,
  },
  chatBadgeText: { fontSize: 10, fontWeight: "800", color: "#fff" },

  // Chat modal
  chatOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.7)" },
  chatSheet: { maxHeight: "70%", backgroundColor: "#141414", borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" },
  chatHeader: { backgroundColor: "#1E1E1E", padding: 16, borderBottomWidth: 1, borderBottomColor: "#2a2a2a" },
  chatHeaderRow: { flexDirection: "row", alignItems: "center" },
  chatHeaderTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: "#fff" },
  chatCloseBtn: { padding: 6 },
  chatCloseTxt: { fontSize: 18, color: "#999" },
  chatList: { flexGrow: 1, padding: 16, gap: 10, minHeight: 180 },
  chatEmpty: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  chatEmptyText: { fontSize: 14, color: "#666" },
  msgBubbleRow: { flexDirection: "row", justifyContent: "flex-start" },
  msgBubbleRowMe: { justifyContent: "flex-end" },
  msgBubble: { maxWidth: "75%", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  msgBubbleMe: { backgroundColor: "#1DB954" },
  msgBubbleThem: { backgroundColor: "#2a2a2a" },
  msgBubbleText: { fontSize: 15, lineHeight: 20, fontWeight: "400" },
  chatInputRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, padding: 12, backgroundColor: "#1E1E1E", borderTopWidth: 1, borderTopColor: "#2a2a2a" },
  chatInput: { flex: 1, backgroundColor: "#2a2a2a", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: "#fff", maxHeight: 100 },
  chatSendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#1DB954", alignItems: "center", justifyContent: "center" },
  chatSendTxt: { fontSize: 18, color: "#000", fontWeight: "900" },

  // Cancel link
  cancelLink: { alignItems: "center", paddingVertical: 4 },
  cancelLinkText: { fontSize: 13, color: "#EF4444", fontWeight: "600", textDecorationLine: "underline" },

  // Cancel modal
  cancelSheet: {
    backgroundColor: "#141414",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    gap: 14,
    maxHeight: "70%",
  },
  cancelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cancelTitle: { fontSize: 17, fontWeight: "800", color: "#EF4444" },
  cancelSubtitle: { fontSize: 13, color: "#999", marginTop: -4 },
  cancelList: { flexGrow: 0 },
  cancelEmpty: { fontSize: 13, color: "#666", textAlign: "center", paddingVertical: 20 },
  cancelItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#1E1E1E",
  },
  cancelItemSel: { borderBottomColor: "#EF444430" },
  cancelRadio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: "#555",
    alignItems: "center", justifyContent: "center",
  },
  cancelRadioSel: { borderColor: "#EF4444" },
  cancelRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#EF4444" },
  cancelItemText: { flex: 1, fontSize: 14, color: "#ccc", fontWeight: "500" },
  cancelItemTextSel: { color: "#fff", fontWeight: "700" },
  cancelConfirmBtn: {
    backgroundColor: "#EF4444",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  cancelConfirmTxt: { fontSize: 15, fontWeight: "800", color: "#fff" },
});
