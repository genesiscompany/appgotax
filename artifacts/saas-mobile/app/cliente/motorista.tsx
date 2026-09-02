import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, Pressable, useColorScheme, Platform,
  TextInput, ScrollView, ActivityIndicator, TouchableOpacity, Alert,
  Modal, FlatList, KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Location from "expo-location";
import Colors from "@/constants/colors";
import GoogleMap from "@/components/GoogleMap";
import type { LatLng } from "@/components/GoogleMap";
import { useAuthGate } from "@/components/AuthGate";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import PaymentSelector from "@/components/PaymentSelector";
import { getWallet, checkoutPayment } from "@/api/payments";
import * as Linking from "expo-linking";

const MOD_COLOR = Colors.modules.motorista;
const API_BASE = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api` : "/api";
const EMPRESA_ID = 2;

const PAGAMENTOS = [
  { id: "dinheiro", label: "Dinheiro", icone: "dollar-sign" as const },
  { id: "pix", label: "Pix", icone: "smartphone" as const },
  { id: "cartao", label: "Cartão", icone: "credit-card" as const },
];

interface Categoria {
  id: number;
  nome: string;
  taxa_minima: number;
  taxa_por_km: number;
  dist_chamada_km: number;
}

interface PlaceSugestao {
  place_id: string;
  main_text: string;
  secondary_text: string;
  description: string;
  lat?: number;
  lng?: number;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function calcPrecoCategoria(cat: Categoria, km: number): number {
  return Math.max(cat.taxa_minima, Math.round((cat.taxa_minima + cat.taxa_por_km * km) * 100) / 100);
}

const CATEGORIA_ICONES: Record<string, "navigation" | "star" | "award"> = {
  default: "navigation",
};
function getCatIcon(nome: string): "navigation" | "star" | "award" {
  const n = nome.toLowerCase();
  if (n.includes("black") || n.includes("premium")) return "award";
  if (n.includes("plus") || n.includes("confort")) return "star";
  return "navigation";
}

const FALLBACK_CATEGORIAS: Categoria[] = [
  { id: 1, nome: "GoTaxi X",    taxa_minima: 10, taxa_por_km: 2.5, dist_chamada_km: 5 },
  { id: 2, nome: "GoTaxi Plus", taxa_minima: 10, taxa_por_km: 3.5, dist_chamada_km: 5 },
  { id: 3, nome: "GoTaxi Black",taxa_minima: 15, taxa_por_km: 5.0, dist_chamada_km: 5 },
];

const LOCATIONS = {
  origem: { lat: -23.5630, lng: -46.6543 },
  destino: { lat: -23.5489, lng: -46.6388 },
  motorista_start: { lat: -23.5601, lng: -46.6510 },
};

export default function ClienteMotorista() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const { customer } = useCustomerAuth();

  const [origemText, setOrigemText] = useState("");
  const [destinoText, setDestinoText] = useState("");
  const [origemLatLng, setOrigemLatLng] = useState<LatLng>(LOCATIONS.origem);
  const [destinoLatLng, setDestinoLatLng] = useState<LatLng>(LOCATIONS.destino);
  const [geoLoading, setGeoLoading] = useState(false);
  const [destGeoLoading, setDestGeoLoading] = useState(false);
  const [origemSugestoes, setOrigemSugestoes] = useState<PlaceSugestao[]>([]);
  const [destinoSugestoes, setDestinoSugestoes] = useState<PlaceSugestao[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catSel, setCatSel] = useState<number | null>(null);
  const [distanciaKm, setDistanciaKm] = useState(0);
  const [pagamento, setPagamento] = useState("dinheiro");
  const [paymentSource, setPaymentSource] = useState<"direto" | "mercado_pago" | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    if (customer?.token) {
      getWallet(customer.token).then(d => setWalletBalance(d.balanceCents)).catch(() => {});
    }
  }, [customer?.token]);
  
  const [creditoDisponivel, setCreditoDisponivel] = useState(0);
  const [estado, setEstado] = useState<"idle" | "buscando" | "aguardando" | "caminho" | "chegou">("idle");
  const [corridaId, setCorridaId] = useState<number | null>(null);
  const [corridaData, setCorridaData] = useState<any>(null);
  const [eta, setEta] = useState(4);
  const [driverPos, setDriverPos] = useState<LatLng>(LOCATIONS.motorista_start);
  const [motoristasDisponiveis, setMotoristasDisponiveis] = useState<Array<{ id: number; nome: string; lat: number; lng: number; veiculo_modelo?: string; veiculo_cor?: string }>>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Chat state ────────────────────────────────────────────────────────────────
  const [chatVisible, setChatVisible] = useState(false);
  const [mensagens, setMensagens] = useState<Array<{ id: number; remetente: string; texto: string; criado_em: string }>>([]);
  const [msgTexto, setMsgTexto] = useState("");
  const [msgSending, setMsgSending] = useState(false);
  const chatPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // ── Load credit balance ────────────────────────────────────────────────────
  useEffect(() => {
    if (!customer?.token) return;
    fetch(`${API_BASE}/cliente/afiliados/credito`, {
      headers: { Authorization: `Bearer ${customer.token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.saldo > 0) setCreditoDisponivel(Number(d.saldo)); })
      .catch(() => {});
  }, [customer?.token]);

  const fetchMensagens = useCallback(async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/motorista/corridas/${id}/mensagens`);
      if (res.ok) {
        const data = await res.json();
        setMensagens(data);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (chatVisible && corridaId) {
      fetchMensagens(corridaId);
      chatPollRef.current = setInterval(() => fetchMensagens(corridaId), 3000);
    } else {
      if (chatPollRef.current) clearInterval(chatPollRef.current);
    }
    return () => { if (chatPollRef.current) clearInterval(chatPollRef.current); };
  }, [chatVisible, corridaId, fetchMensagens]);

  const handleEnviarMensagem = async () => {
    if (!msgTexto.trim() || !corridaId || msgSending) return;
    setMsgSending(true);
    try {
      const res = await fetch(`${API_BASE}/motorista/corridas/${corridaId}/mensagens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remetente: "passageiro", texto: msgTexto.trim() }),
      });
      if (res.ok) {
        setMsgTexto("");
        await fetchMensagens(corridaId);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch (_) {}
    setMsgSending(false);
  };
  const topPadding = insets.top;

  const catSelecionada = categorias.find(c => c.id === catSel) ?? null;
  const preco = catSelecionada && distanciaKm > 0
    ? calcPrecoCategoria(catSelecionada, distanciaKm)
    : catSelecionada?.taxa_minima ?? 0;
  const tipoNome = catSelecionada?.nome ?? "Selecione o tipo";

  // ── Fetch categorias from API ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/motorista/categorias`);
        if (res.ok) {
          const data: Categoria[] = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setCategorias(data);
            setCatSel(data[0].id);
          } else {
            setCategorias(FALLBACK_CATEGORIAS);
            setCatSel(FALLBACK_CATEGORIAS[0].id);
          }
        } else {
          setCategorias(FALLBACK_CATEGORIAS);
          setCatSel(FALLBACK_CATEGORIAS[0].id);
        }
      } catch {
        setCategorias(FALLBACK_CATEGORIAS);
        setCatSel(FALLBACK_CATEGORIAS[0].id);
      } finally {
        setCatLoading(false);
      }
    })();
  }, []);

  // ── Poll available drivers every 12s (idle only) ─────────────────────────────
  const fetchDisponiveis = useCallback(async () => {
    try {
      const catNome = categorias.find(c => c.id === catSel)?.nome;
      const url = catNome
        ? `${API_BASE}/motorista/disponiveis?categoria=${encodeURIComponent(catNome)}`
        : `${API_BASE}/motorista/disponiveis`;
      const res = await fetch(url);
      if (res.ok) setMotoristasDisponiveis(await res.json());
    } catch {}
  }, [catSel, categorias]);

  useEffect(() => {
    if (estado !== "idle") return;
    fetchDisponiveis();
    const t = setInterval(fetchDisponiveis, 12_000);
    return () => clearInterval(t);
  }, [estado, fetchDisponiveis]);

  // ── Geolocation on mount ─────────────────────────────────────────────────────
  const getLocation = useCallback(async () => {
    setGeoLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setOrigemText("Rua das Flores, 123");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      setOrigemLatLng({ lat: latitude, lng: longitude });
      // Reverse geocode
      const geocoded = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geocoded.length > 0) {
        const g = geocoded[0];
        const parts = [g.street, g.streetNumber, g.district || g.subregion, g.city].filter(Boolean);
        setOrigemText(parts.join(", ") || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      } else {
        setOrigemText(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      }
    } catch {
      setOrigemText("Rua das Flores, 123");
      setOrigemLatLng(LOCATIONS.origem);
    } finally {
      setGeoLoading(false);
    }
  }, []);

  useEffect(() => { getLocation(); }, [getLocation]);

  // ── Places Autocomplete (via server proxy — sem expor API key no client) ───────
  const fetchSugestoes = useCallback(async (text: string): Promise<PlaceSugestao[]> => {
    if (!text.trim() || text.length < 2) return [];
    try {
      const encoded = encodeURIComponent(text);
      const url = `${API_BASE}/places/autocomplete?input=${encoded}&language=pt-BR&region=BR`;
      const res = await fetch(url);
      const data = await res.json();
      const list: any[] = Array.isArray(data) ? data : (data.predictions ?? []);
      if (list.length === 0) return [];
      return list.slice(0, 5).map((p: any) => ({
        place_id: p.placeId ?? p.place_id ?? "",
        main_text: p.mainText ?? p.structured_formatting?.main_text ?? p.description ?? "",
        secondary_text: p.secondaryText ?? p.structured_formatting?.secondary_text ?? "",
        description: p.description ?? p.mainText ?? "",
        lat: p.lat ?? undefined,
        lng: p.lng ?? undefined,
      }));
    } catch {}
    return [];
  }, []);

  const fetchPlaceCoords = useCallback(async (placeId: string): Promise<LatLng | null> => {
    if (!placeId) return null;
    try {
      const url = `${API_BASE}/places/details?placeId=${encodeURIComponent(placeId)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data) return null;
      if (data.lat != null && data.lng != null) return { lat: data.lat, lng: data.lng };
    } catch {}
    return null;
  }, []);

  // ── Debounced autocomplete for origin ────────────────────────────────────────
  const origDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeOrigem = useCallback((text: string) => {
    if (origDebounceRef.current) clearTimeout(origDebounceRef.current);
    setOrigemSugestoes([]);
    if (!text.trim() || text.length < 2) return;
    origDebounceRef.current = setTimeout(async () => {
      const sugs = await fetchSugestoes(text);
      setOrigemSugestoes(sugs);
    }, 350);
  }, [fetchSugestoes]);

  const selectOrigemSugestao = useCallback(async (s: PlaceSugestao) => {
    setOrigemText(s.description);
    setOrigemSugestoes([]);
    if (s.lat != null && s.lng != null) {
      setOrigemLatLng({ lat: s.lat, lng: s.lng });
    } else {
      const coords = await fetchPlaceCoords(s.place_id);
      if (coords) setOrigemLatLng(coords);
    }
  }, [fetchPlaceCoords]);

  // ── Debounced autocomplete for destination ────────────────────────────────────
  const destDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeDestino = useCallback((text: string) => {
    if (destDebounceRef.current) clearTimeout(destDebounceRef.current);
    setDestinoSugestoes([]);
    if (!text.trim()) { setDistanciaKm(0); return; }
    if (text.length < 2) return;
    setDestGeoLoading(true);
    destDebounceRef.current = setTimeout(async () => {
      const sugs = await fetchSugestoes(text);
      setDestinoSugestoes(sugs);
      setDestGeoLoading(false);
    }, 350);
  }, [fetchSugestoes]);

  const selectDestinoSugestao = useCallback(async (s: PlaceSugestao) => {
    setDestinoText(s.description);
    setDestinoSugestoes([]);
    if (s.lat != null && s.lng != null) {
      setDestinoLatLng({ lat: s.lat, lng: s.lng });
    } else {
      setDestGeoLoading(true);
      const coords = await fetchPlaceCoords(s.place_id);
      if (coords) setDestinoLatLng(coords);
      setDestGeoLoading(false);
    }
  }, [fetchPlaceCoords]);

  // ── Recalculate distance when coordinates change ───────────────────────────────
  useEffect(() => {
    if (destinoText) {
      const km = haversineKm(origemLatLng.lat, origemLatLng.lng, destinoLatLng.lat, destinoLatLng.lng);
      setDistanciaKm(Math.max(0.5, km));
    } else {
      setDistanciaKm(0);
    }
  }, [origemLatLng, destinoLatLng, destinoText]);

  const { requireAuth } = useAuthGate("/cliente/motorista");

  // Driver position is updated from the real GPS poll (pollStatus), not via fake animation

  // Poll ride status
  const pollStatus = useCallback(async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/motorista/corridas/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setCorridaData(data);
      if (data.status === "aceita" || data.status === "a_caminho" || data.status === "em_andamento") {
        // Update driver position from real GPS every poll (every 4s)
        if (data.motorista_lat && data.motorista_lng) {
          setDriverPos({ lat: Number(data.motorista_lat), lng: Number(data.motorista_lng) });
        }
        if (data.tempo_espera_min != null) setEta(Number(data.tempo_espera_min));
        setEstado("caminho");
      } else if (data.status === "chegou_destino") {
        // Driver arrived at destination — show arrival card
        if (data.motorista_lat && data.motorista_lng) {
          setDriverPos({ lat: Number(data.motorista_lat), lng: Number(data.motorista_lng) });
        }
        setEstado("chegou");
      } else if (data.status === "concluida" || data.status === "cancelada") {
        if (pollRef.current) clearInterval(pollRef.current);
        setEstado("idle");
        setCorridaId(null);
        setCorridaData(null);
        if (data.status === "concluida") {
          Alert.alert("Corrida concluída!", "Sua corrida foi concluída. Avalie o motorista em Minhas Corridas.", [
            { text: "Ver Histórico", onPress: () => router.push("/cliente/corridas" as any) },
            { text: "OK" },
          ]);
        }
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (!corridaId) return;
    pollRef.current = setInterval(() => pollStatus(corridaId), 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [corridaId, pollStatus]);

  const handleChamar = () => {
    if (!destinoText || !catSel) return;
    requireAuth(async () => {
      setEstado("buscando");
      try {
        if (pagamento === "credito_gotaxi" && creditoDisponivel < preco) {
          setEstado("idle");
          Alert.alert("Crédito insuficiente", `Seu saldo GoTaxi é R$ ${creditoDisponivel.toFixed(2)}. A corrida custa R$ ${preco.toFixed(2)}.`);
          return;
        }
        const body = {
          empresa_id: EMPRESA_ID,
          passageiro_nome: customer?.nome || "Cliente",
          passageiro_telefone: customer?.whatsapp || undefined,
          origem_endereco: origemText,
          destino_endereco: destinoText,
          tipo_veiculo: catSelecionada?.nome || "GoTaxi X",
          forma_pagamento: pagamento,
          distancia_km: distanciaKm,
          valor: preco,
          lat_origem: origemLatLng.lat,
          lng_origem: origemLatLng.lng,
          lat_destino: destinoLatLng.lat,
          lng_destino: destinoLatLng.lng,
        };
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (customer?.token) headers["Authorization"] = `Bearer ${customer.token}`;
        const res = await fetch(`${API_BASE}/motorista/solicitar`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const corrida = await res.json();
          
          if (paymentSource === "mercado_pago") {
            try {
              const checkout = await checkoutPayment(customer?.token || "", {
                module: "motorista",
                referenceId: corrida.id,
                paymentSource: "mercado_pago",
                mercadoPagoMethod: pagamento as any
              });
              if (checkout.sandboxInitPoint) {
                Linking.openURL(checkout.sandboxInitPoint);
              } else if (checkout.initPoint) {
                Linking.openURL(checkout.initPoint);
              }
            } catch (e: any) {
              Alert.alert("Aviso", "Corrida solicitada, mas houve falha ao iniciar o Mercado Pago.");
            }
          }

          if (pagamento === "credito_gotaxi") {
            setCreditoDisponivel(prev => Math.max(0, prev - preco));
          }
          setCorridaId(corrida.id);
          setTimeout(() => setEstado("aguardando"), 1500);
        } else {
          setEstado("idle");
          const err = await res.json().catch(() => ({}));
          Alert.alert("Erro", err.message || "Não foi possível solicitar a corrida. Tente novamente.");
        }
      } catch (e) {
        // Fallback to demo mode
        setCorridaId(9999);
        setCorridaData({
          motorista_nome: "Carlos Silva",
          motorista_nome_real: "Carlos Silva",
          motorista_veiculo: "Honda Civic",
          motorista_placa: "ABC-1234",
          motorista_cor: "Prata",
          motorista_avaliacao: "4.9",
        });
        setTimeout(() => { setEstado("caminho"); setDriverPos(LOCATIONS.motorista_start); setEta(4); }, 2500);
      }
    });
  };

  const handleCancelar = async () => {
    if (corridaId) {
      try {
        await fetch(`${API_BASE}/motorista/corridas/${corridaId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "cancelada" }),
        });
      } catch (_) {}
      if (pollRef.current) clearInterval(pollRef.current);
    }
    setEstado("idle");
    setCorridaId(null);
    setCorridaData(null);
  };

  const origemLatLngMap = { ...origemLatLng, label: origemText };
  const destinoLatLngMap = { ...destinoLatLng, label: destinoText };
  const motoristaNome = corridaData?.motorista_nome_real || corridaData?.motorista_app_nome || corridaData?.motorista_nome || "Motorista";
  const motoristaVeiculo = corridaData?.motorista_veiculo || corridaData?.ma_veiculo || "Veículo";
  const motoristaPlaca = corridaData?.motorista_placa || corridaData?.ma_placa || "---";
  const motoristaCor = corridaData?.motorista_cor || corridaData?.veiculo_cor || "";
  const motoristaRating = corridaData?.motorista_avaliacao ?? corridaData?.ma_avaliacao ?? "4.9";
  const motoristaIniciais = motoristaNome.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();
  if (estado === "caminho") {
    return (
      <>
      <View style={styles.container}>
        <GoogleMap
          style={styles.mapFull}
          origin={origemLatLngMap}
          destination={destinoLatLngMap}
          driverLocation={driverPos}
          showRoute
          zoom={15}
        />

        {/* ETA badge - topo direito */}
        <View style={[styles.etaBadge, { top: topPadding + 16, backgroundColor: MOD_COLOR }]}>
          <Feather name="clock" size={14} color="#fff" />
          <Text style={[styles.etaBadgeText, { fontFamily: "Inter_700Bold" }]}>
            {eta > 0 ? `${eta} min` : "Chegando!"}
          </Text>
        </View>

        {/* Botão fechar */}
        <Pressable style={[styles.closeBtnFloat, { top: topPadding + 16, backgroundColor: colors.card }]} onPress={handleCancelar}>
          <Feather name="x" size={20} color={colors.text} />
        </Pressable>

        {/* Bottom sheet */}
        <View style={[styles.bottomSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.sheetHandle} />

          {/* Título + corrida */}
          <View style={styles.sheetTitleRow}>
            <View>
              <Text style={[styles.sheetTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
                Motorista a caminho
              </Text>
              <Text style={[styles.sheetSub, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                Corrida #{corridaId || "---"} · R$ {preco.toFixed(2)}
              </Text>
            </View>
            <View style={[styles.etaMiniBadge, { backgroundColor: MOD_COLOR + "18", borderColor: MOD_COLOR + "40" }]}>
              <Text style={[styles.etaMiniNum, { color: MOD_COLOR, fontFamily: "Inter_700Bold" }]}>
                {eta > 0 ? eta : "~"}
              </Text>
              <Text style={[styles.etaMiniLabel, { color: MOD_COLOR, fontFamily: "Inter_400Regular" }]}>min</Text>
            </View>
          </View>

          {/* Card do motorista */}
          <View style={[styles.driverCard, { backgroundColor: isDark ? "#1e293b" : "#f8fafc", borderColor: isDark ? "#334155" : "#e2e8f0" }]}>
            {/* Avatar */}
            <View style={[styles.driverAvatarWrap, { backgroundColor: MOD_COLOR }]}>
              <Text style={[styles.driverInitials, { fontFamily: "Inter_700Bold" }]}>{motoristaIniciais}</Text>
            </View>

            {/* Info */}
            <View style={styles.driverInfo}>
              <Text style={[styles.driverName, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{motoristaNome}</Text>
              <View style={styles.starsRow}>
                {[1,2,3,4,5].map(i => (
                  <Feather key={i} name="star" size={11} color={i <= Math.round(parseFloat(motoristaRating)) ? "#F59E0B" : "#D1D5DB"} />
                ))}
                <Text style={[styles.ratingNum, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}> {motoristaRating}</Text>
              </View>

              {/* Carro badges */}
              <View style={styles.carBadgesRow}>
                <View style={[styles.carBadge, { backgroundColor: isDark ? "#0f172a" : "#f1f5f9" }]}>
                  <Feather name="circle" size={9} color={colors.textMuted} />
                  <Text style={[styles.carBadgeText, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>{motoristaCor}</Text>
                </View>
                <View style={[styles.carBadge, { backgroundColor: isDark ? "#0f172a" : "#f1f5f9" }]}>
                  <Feather name="truck" size={9} color={colors.textMuted} />
                  <Text style={[styles.carBadgeText, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>{motoristaVeiculo}</Text>
                </View>
                <View style={[styles.carBadge, { backgroundColor: MOD_COLOR + "15" }]}>
                  <Text style={[styles.carBadgeText, { color: MOD_COLOR, fontFamily: "Inter_700Bold" }]}>{motoristaPlaca}</Text>
                </View>
              </View>
            </View>

            {/* Ligar */}
            <Pressable style={[styles.ligBtn, { backgroundColor: MOD_COLOR }]}>
              <Feather name="phone" size={18} color="#fff" />
            </Pressable>
          </View>

          {/* Rota */}
          <View style={[styles.routeRow, { borderTopColor: colors.border }]}>
            <View style={styles.routeDotsCol}>
              <View style={[styles.dot, { backgroundColor: "#10B981" }]} />
              <View style={[styles.routeLineV, { backgroundColor: colors.border }]} />
              <View style={[styles.dot, { backgroundColor: MOD_COLOR }]} />
            </View>
            <View style={styles.routeTextsCol}>
              <Text style={[styles.routeTextItem, { color: colors.text, fontFamily: "Inter_500Medium" }]}>{origemText}</Text>
              <Text style={[styles.routeTextItem, { color: colors.text, fontFamily: "Inter_500Medium" }]}>{destinoText}</Text>
            </View>
          </View>

          {/* Ações */}
          <View style={styles.actionRow}>
            <Pressable style={[styles.msgBtn, { borderColor: colors.border }]} onPress={() => setChatVisible(true)}>
              <Feather name="message-circle" size={18} color={colors.text} />
              <Text style={[styles.msgBtnText, { color: colors.text, fontFamily: "Inter_500Medium" }]}>Mensagem</Text>
            </Pressable>
            <Pressable style={[styles.cancelRideBtn, { borderColor: "#EF4444" }]} onPress={handleCancelar}>
              <Text style={[styles.cancelRideBtnText, { fontFamily: "Inter_600SemiBold" }]}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* ── Chat Modal ──────────────────────────────────────────────────── */}
      <Modal visible={chatVisible} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.chatOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.chatSheet}>
            {/* Header */}
            <View style={[styles.chatHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
              <View style={styles.sheetHandle} />
              <View style={styles.chatHeaderRow}>
                <Feather name="message-circle" size={20} color={MOD_COLOR} />
                <Text style={[styles.chatHeaderTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
                  Chat com {motoristaNome.split(" ")[0]}
                </Text>
                <Pressable onPress={() => setChatVisible(false)} style={styles.chatCloseBtn}>
                  <Feather name="x" size={22} color={colors.textSecondary} />
                </Pressable>
              </View>
            </View>

            {/* Messages */}
            <FlatList
              ref={flatListRef}
              data={mensagens}
              keyExtractor={item => String(item.id)}
              contentContainerStyle={[styles.chatList, { backgroundColor: colors.background }]}
              ListEmptyComponent={
                <View style={styles.chatEmpty}>
                  <Feather name="message-circle" size={36} color={colors.border} />
                  <Text style={[styles.chatEmptyText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                    Nenhuma mensagem ainda
                  </Text>
                </View>
              }
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
              renderItem={({ item }) => {
                const isMe = item.remetente === "passageiro";
                return (
                  <View style={[styles.msgBubbleRow, isMe && styles.msgBubbleRowMe]}>
                    <View style={[styles.msgBubble, { backgroundColor: isMe ? MOD_COLOR : colors.card }]}>
                      <Text style={[styles.msgBubbleText, { color: isMe ? "#fff" : colors.text, fontFamily: "Inter_400Regular" }]}>
                        {item.texto}
                      </Text>
                    </View>
                  </View>
                );
              }}
            />

            {/* Input */}
            <View style={[styles.chatInputRow, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
              <TextInput
                style={[styles.chatInput, { backgroundColor: colors.background, color: colors.text, fontFamily: "Inter_400Regular" }]}
                placeholder="Digite uma mensagem..."
                placeholderTextColor={colors.textSecondary}
                value={msgTexto}
                onChangeText={setMsgTexto}
                multiline
                returnKeyType="send"
                onSubmitEditing={handleEnviarMensagem}
              />
              <Pressable
                style={[styles.chatSendBtn, { backgroundColor: MOD_COLOR, opacity: msgTexto.trim() ? 1 : 0.4 }]}
                onPress={handleEnviarMensagem}
                disabled={!msgTexto.trim() || msgSending}
              >
                {msgSending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Feather name="send" size={18} color="#fff" />}
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      </>
    );
  }

  if (estado === "chegou") {
    return (
      <View style={styles.container}>
        <GoogleMap
          style={styles.mapFull}
          origin={origemLatLngMap}
          destination={destinoLatLngMap}
          driverLocation={driverPos}
          showRoute
          zoom={15}
        />

        {/* Badge topo */}
        <View style={[styles.etaBadge, { top: topPadding + 16, backgroundColor: "#10B981" }]}>
          <Feather name="check-circle" size={14} color="#fff" />
          <Text style={[styles.etaBadgeText, { fontFamily: "Inter_700Bold" }]}>Você chegou!</Text>
        </View>

        {/* Bottom sheet */}
        <View style={[styles.bottomSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetTitleRow}>
            <View>
              <Text style={[styles.sheetTitle, { color: "#10B981", fontFamily: "Inter_700Bold" }]}>
                Você chegou! 🎉
              </Text>
              <Text style={[styles.sheetSub, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                Aguardando finalização do motorista
              </Text>
            </View>
            <View style={[styles.etaMiniBadge, { backgroundColor: "#10B98118", borderColor: "#10B98140" }]}>
              <Text style={[styles.etaMiniNum, { color: "#10B981", fontFamily: "Inter_700Bold" }]}>
                {preco.toFixed(2).replace(".", ",")}
              </Text>
              <Text style={[styles.etaMiniLabel, { color: "#10B981", fontFamily: "Inter_400Regular" }]}>R$</Text>
            </View>
          </View>

          {/* Destino card */}
          <View style={[styles.routeRow, { borderTopColor: colors.border }]}>
            <View style={styles.routeDotsCol}>
              <View style={[styles.dot, { backgroundColor: "#10B981" }]} />
              <View style={[styles.routeLineV, { backgroundColor: colors.border }]} />
              <View style={[styles.dot, { backgroundColor: "#10B981" }]} />
            </View>
            <View style={styles.routeTextsCol}>
              <Text style={[styles.routeTextItem, { color: colors.text, fontFamily: "Inter_500Medium" }]}>{origemText}</Text>
              <Text style={[styles.routeTextItem, { color: "#10B981", fontFamily: "Inter_700Bold" }]}>{destinoText}</Text>
            </View>
          </View>

          {/* Pagamento info */}
          <View style={[styles.driverCard, { backgroundColor: isDark ? "#0d2018" : "#f0fdf4", borderColor: "#10B98140" }]}>
            <View style={[styles.driverAvatarWrap, { backgroundColor: "#10B981" }]}>
              <Feather name="dollar-sign" size={22} color="#fff" />
            </View>
            <View style={styles.driverInfo}>
              <Text style={[styles.driverName, { color: "#10B981", fontFamily: "Inter_700Bold" }]}>
                R$ {preco.toFixed(2).replace(".", ",")}
              </Text>
              <Text style={[styles.ratingNum, { color: colors.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2 }]}>
                Pagamento em dinheiro • Aguardando motorista
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (estado === "buscando" || estado === "aguardando") {
    return (
      <View style={styles.container}>
        <GoogleMap style={styles.mapFull} origin={origemLatLngMap} destination={destinoLatLngMap} showRoute={false} zoom={14} />
        <View style={[styles.buscandoOverlay, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.sheetHandle} />
          <ActivityIndicator size="large" color={MOD_COLOR} style={{ marginBottom: 16 }} />
          <Text style={[styles.buscandoTitulo, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Buscando motoristas...</Text>
          <Text style={[styles.buscandoSub, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Procurando o melhor motorista perto de você</Text>
          {corridaId && (
            <View style={[styles.corridaBadge, { backgroundColor: MOD_COLOR + "15", borderColor: MOD_COLOR + "30" }]}>
              <Text style={[styles.corridaBadgeText, { color: MOD_COLOR, fontFamily: "Inter_400Regular" }]}>
                Corrida #{corridaId} · R$ {preco.toFixed(2)}
              </Text>
            </View>
          )}
          <Pressable style={[styles.cancelBtnSm, { borderColor: colors.border, marginTop: 20 }]} onPress={handleCancelar}>
            <Text style={[styles.cancelBtnSmText, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const canChamar = !!destinoText && !!catSel;

  const driverMarkers = motoristasDisponiveis.map(m => ({
    lat: m.lat, lng: m.lng,
    label: m.nome.split(" ")[0],
    color: "#F59E0B",
    icon: "🚗",
  }));

  return (
    <View style={styles.container}>
      <GoogleMap style={styles.mapTop} origin={origemLatLngMap} destination={destinoLatLngMap} showRoute={!!destinoText} zoom={13} markers={driverMarkers} />

      {/* Available drivers badge */}
      {motoristasDisponiveis.length > 0 && estado === "idle" && (
        <View style={[styles.driversCountBadge, { top: topPadding + 12, backgroundColor: "#F59E0B" }]}>
          <Text style={styles.driversCountText}>🚗 {motoristasDisponiveis.length} disponível{motoristasDisponiveis.length > 1 ? "is" : ""}</Text>
        </View>
      )}

      {/* Header buttons */}
      <Pressable style={[styles.floatBackBtn, { top: topPadding + 12, backgroundColor: colors.card }]} onPress={() => router.back()}>
        <Feather name="arrow-left" size={20} color={colors.text} />
      </Pressable>
      <Pressable style={[styles.floatAction, { top: topPadding + 12, right: 16, position: "absolute", backgroundColor: colors.card }]} onPress={() => router.push("/cliente/corridas" as any)}>
        <Feather name="clock" size={16} color={colors.textSecondary} />
      </Pressable>

      {/* Bottom panel */}
      <ScrollView style={[styles.bottomPanel, { backgroundColor: colors.card }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.sheetHandle} />
        <Text style={[styles.panelTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Para onde vamos?</Text>

        {/* Inputs */}
        <View style={{ zIndex: 20 }}>
          <View style={[styles.inputsContainer, { borderColor: colors.border }]}>
            {/* Origem com GPS */}
            <View style={[styles.inputGroup, { backgroundColor: colors.backgroundSecondary }]}>
              <View style={[styles.inputDot, { backgroundColor: "#10B981" }]} />
              <TextInput
                style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]}
                placeholder="De onde? (detectando...)"
                placeholderTextColor={colors.textMuted}
                value={origemText}
                onChangeText={text => { setOrigemText(text); geocodeOrigem(text); }}
              />
              {geoLoading
                ? <ActivityIndicator size="small" color={MOD_COLOR} />
                : <Pressable onPress={getLocation} hitSlop={10}>
                    <Feather name="crosshair" size={16} color={MOD_COLOR} />
                  </Pressable>
              }
            </View>
            <View style={[styles.separatorH, { backgroundColor: colors.border }]} />
            {/* Destino */}
            <View style={[styles.inputGroup, { backgroundColor: colors.backgroundSecondary }]}>
              <View style={[styles.inputDot, { backgroundColor: MOD_COLOR }]} />
              <TextInput
                style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]}
                placeholder="Para onde?"
                placeholderTextColor={colors.textMuted}
                value={destinoText}
                onChangeText={text => { setDestinoText(text); geocodeDestino(text); }}
              />
              {destGeoLoading
                ? <ActivityIndicator size="small" color={MOD_COLOR} />
                : <Feather name="search" size={14} color={colors.textMuted} />
              }
            </View>
          </View>

          {/* Sugestões de origem */}
          {origemSugestoes.length > 0 && (
            <View style={[styles.sugestoesBox, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              {origemSugestoes.map((s, i) => (
                <Pressable
                  key={s.place_id}
                  style={[styles.sugestaoItem, i < origemSugestoes.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                  onPress={() => selectOrigemSugestao(s)}
                >
                  <Feather name="map-pin" size={14} color={colors.textMuted} style={{ marginRight: 10, marginTop: 1 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sugestaoMain, { color: colors.text, fontFamily: "Inter_500Medium" }]} numberOfLines={1}>{s.main_text}</Text>
                    {!!s.secondary_text && (
                      <Text style={[styles.sugestaoSec, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>{s.secondary_text}</Text>
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {/* Sugestões de destino */}
          {destinoSugestoes.length > 0 && (
            <View style={[styles.sugestoesBox, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              {destinoSugestoes.map((s, i) => (
                <Pressable
                  key={s.place_id}
                  style={[styles.sugestaoItem, i < destinoSugestoes.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                  onPress={() => selectDestinoSugestao(s)}
                >
                  <Feather name="map-pin" size={14} color={MOD_COLOR} style={{ marginRight: 10, marginTop: 1 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sugestaoMain, { color: colors.text, fontFamily: "Inter_500Medium" }]} numberOfLines={1}>{s.main_text}</Text>
                    {!!s.secondary_text && (
                      <Text style={[styles.sugestaoSec, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>{s.secondary_text}</Text>
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Distância badge */}
        {distanciaKm > 0 && (
          <View style={[styles.distBadge, { backgroundColor: MOD_COLOR + "15" }]}>
            <Feather name="map" size={12} color={MOD_COLOR} />
            <Text style={[styles.distText, { color: MOD_COLOR, fontFamily: "Inter_500Medium" }]}>
              {distanciaKm.toFixed(1)} km estimados
            </Text>
          </View>
        )}

        {/* Tipo de serviço */}
        <Text style={[styles.tipoLabel, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Tipo de serviço</Text>
        {catLoading ? (
          <View style={{ alignItems: "center", paddingVertical: 20 }}>
            <ActivityIndicator color={MOD_COLOR} />
          </View>
        ) : !destinoText ? (
          <View style={[styles.noCatHint, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            <Feather name="map-pin" size={16} color={colors.textMuted} />
            <Text style={[styles.noCatText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
              Informe o destino para ver as opções e preços
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }} style={{ marginBottom: 14 }}>
            {categorias.map(cat => {
              const p = calcPrecoCategoria(cat, distanciaKm);
              const sel = catSel === cat.id;
              const icon = getCatIcon(cat.nome);
              return (
                <Pressable key={cat.id} onPress={() => setCatSel(cat.id)}
                  style={[styles.tipoCard, {
                    backgroundColor: sel ? MOD_COLOR : colors.backgroundSecondary,
                    borderColor: sel ? MOD_COLOR : colors.border,
                    minWidth: 130,
                  }]}>
                  <Feather name={icon} size={18} color={sel ? "#fff" : MOD_COLOR} />
                  <Text style={[styles.tipoNome, { color: sel ? "#fff" : colors.text, fontFamily: "Inter_700Bold" }]}>{cat.nome}</Text>
                  <Text style={[styles.tipoPreco, { color: sel ? "rgba(255,255,255,0.95)" : MOD_COLOR, fontFamily: "Inter_700Bold" }]}>
                    R$ {p.toFixed(2)}
                  </Text>
                  <Text style={[styles.tipoTempo, { color: sel ? "rgba(255,255,255,0.7)" : colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                    R$ {cat.taxa_por_km.toFixed(2)}/km · mín R$ {cat.taxa_minima.toFixed(0)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Pagamento */}
        <Text style={[styles.tipoLabel, { color: colors.text, fontFamily: "Inter_600SemiBold", marginBottom: 10 }]}>Pagamento</Text>
        <PaymentSelector
          empresaId={EMPRESA_ID}
          token={customer?.token}
          colors={colors}
          accentColor={MOD_COLOR}
          directMethods={[
            ...PAGAMENTOS,
            ...(creditoDisponivel > 0
              ? [{ id: "credito_gotaxi", label: `Crédito GoTaxi\nR$ ${creditoDisponivel.toFixed(2)}`, icone: "award" as const }]
              : [])
          ].map(p => ({
            id: p.id,
            label: p.label,
            icon: p.icone,
            color: p.id === "credito_gotaxi" ? "#7C3AED" : MOD_COLOR
          }))}
          selectedSource={paymentSource}
          onSourceSelect={(src) => setPaymentSource(src)}
          selectedMethod={pagamento}
          onMethodSelect={(m) => setPagamento(m)}
          walletBalanceCents={walletBalance}
        />

        {/* Botão chamar */}
        <Pressable
          style={[styles.chamarBtn, { backgroundColor: canChamar ? MOD_COLOR : colors.backgroundSecondary }]}
          onPress={handleChamar}
          disabled={!canChamar}
        >
          <Feather name="navigation" size={20} color={canChamar ? "#fff" : colors.textMuted} />
          <Text style={[styles.chamarBtnText, { color: canChamar ? "#fff" : colors.textMuted, fontFamily: "Inter_700Bold" }]}>
            {canChamar ? `Chamar ${tipoNome} · R$ ${preco.toFixed(2)}` : "Informe o destino"}
          </Text>
        </Pressable>

        {/* Quick links */}
        <View style={styles.quickLinks}>
          <TouchableOpacity onPress={() => router.push("/cliente/corridas" as any)} style={styles.quickLink}>
            <Feather name="clock" size={14} color={MOD_COLOR} />
            <Text style={[styles.quickLinkText, { color: MOD_COLOR, fontFamily: "Inter_400Regular" }]}>Minhas corridas</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapFull: { ...StyleSheet.absoluteFillObject },
  mapTop: { height: "42%" },
  floatBackBtn: { position: "absolute", left: 16, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  floatActionsRow: { position: "absolute", right: 16, flexDirection: "row", gap: 8 },
  floatAction: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  etaBadge: { position: "absolute", right: 16, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  etaBadgeText: { color: "#fff", fontSize: 14 },
  closeBtnFloat: { position: "absolute", left: 16, width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  bottomPanel: { flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingTop: 12 },
  bottomSheet: { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingTop: 12, shadowColor: "#000", shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  buscandoOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#D1D5DB", alignSelf: "center", marginBottom: 16 },
  panelTitle: { fontSize: 20, marginBottom: 14 },
  inputsContainer: { borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "transparent", marginBottom: 16 },
  inputGroup: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, height: 50, gap: 12 },
  separatorH: { height: 1 },
  inputDot: { width: 10, height: 10, borderRadius: 5 },
  input: { flex: 1, fontSize: 14 },
  tipoLabel: { fontSize: 15, marginBottom: 10 },
  tipoCard: { borderRadius: 14, borderWidth: 1.5, padding: 14, minWidth: 110, gap: 4 },
  tipoNome: { fontSize: 14 },
  tipoPreco: { fontSize: 15 },
  tipoTempo: { fontSize: 11 },
  distBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 14, alignSelf: "flex-start" },
  distText: { fontSize: 12 },
  noCatHint: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 14 },
  noCatText: { fontSize: 13, flex: 1 },
  sugestoesBox: { borderRadius: 12, borderWidth: 1, marginTop: 4, marginBottom: 10, overflow: "hidden", elevation: 6, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  sugestaoItem: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 14, paddingVertical: 12 },
  sugestaoMain: { fontSize: 14, lineHeight: 18 },
  sugestaoSec: { fontSize: 12, lineHeight: 16, marginTop: 1 },
  pagamentosRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  pagChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  pagText: { fontSize: 13 },
  chamarBtn: { height: 54, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  chamarBtnText: { fontSize: 16 },
  quickLinks: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 12, gap: 12 },
  quickLink: { flexDirection: "row", alignItems: "center", gap: 5 },
  quickLinkText: { fontSize: 12 },
  quickDivider: { width: 1, height: 16 },
  corridaBadge: { marginTop: 12, borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  corridaBadgeText: { fontSize: 13 },
  driversCountBadge: { position: "absolute", alignSelf: "center", left: "50%", transform: [{ translateX: -60 }], borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, flexDirection: "row", alignItems: "center" },
  driversCountText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  sheetTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  sheetTitle: { fontSize: 18, marginBottom: 2 },
  sheetSub: { fontSize: 12 },
  etaMiniBadge: { alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, minWidth: 56 },
  etaMiniNum: { fontSize: 22, lineHeight: 26 },
  etaMiniLabel: { fontSize: 11 },

  driverCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 14 },
  driverAvatarWrap: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  driverInitials: { color: "#fff", fontSize: 20 },
  driverInfo: { flex: 1, gap: 4 },
  driverName: { fontSize: 16 },
  starsRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  ratingNum: { fontSize: 12 },
  carBadgesRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 2 },
  carBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  carBadgeText: { fontSize: 11 },

  ligBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  routeRow: { flexDirection: "row", borderTopWidth: 1, paddingTop: 14, gap: 12, marginBottom: 14 },
  routeDotsCol: { alignItems: "center", paddingTop: 2, gap: 0 },
  routeLineV: { width: 1, flex: 1, marginVertical: 3 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  routeTextsCol: { flex: 1, gap: 14 },
  routeTextItem: { fontSize: 13, lineHeight: 18 },
  actionRow: { flexDirection: "row", gap: 12 },
  msgBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderRadius: 12, height: 44 },
  msgBtnText: { fontSize: 14 },
  cancelRideBtn: { flex: 1, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 12, height: 44 },
  cancelRideBtnText: { color: "#EF4444", fontSize: 14 },
  buscandoTitulo: { fontSize: 20, textAlign: "center" },
  buscandoSub: { fontSize: 14, textAlign: "center", marginTop: 8 },
  cancelBtnSm: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 28, paddingVertical: 10 },
  cancelBtnSmText: { fontSize: 14 },

  // Chat
  chatOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  chatSheet: { maxHeight: "75%", borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" },
  chatHeader: { paddingTop: 10, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
  chatHeaderRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  chatHeaderTitle: { flex: 1, fontSize: 16 },
  chatCloseBtn: { padding: 4 },
  chatList: { flexGrow: 1, padding: 16, gap: 10, minHeight: 200 },
  chatEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 40 },
  chatEmptyText: { fontSize: 14 },
  msgBubbleRow: { flexDirection: "row", justifyContent: "flex-start" },
  msgBubbleRowMe: { justifyContent: "flex-end" },
  msgBubble: { maxWidth: "75%", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  msgBubbleText: { fontSize: 15, lineHeight: 20 },
  chatInputRow: { flexDirection: "row", alignItems: "flex-end", gap: 10, padding: 12, borderTopWidth: 1 },
  chatInput: { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100 },
  chatSendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
