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
import * as Clipboard from "expo-clipboard";
import Colors from "@/constants/colors";
import GoogleMap from "@/components/GoogleMap";
import type { LatLng } from "@/components/GoogleMap";
import { useAuthGate } from "@/components/AuthGate";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { checkoutPayment, getPaymentOptions, getSavedCard, getServicePaymentStatus, type PaymentOptions, type SavedCard } from "@/api/payments";
import MercadoPagoCardTokenizer from "@/components/MercadoPagoCardTokenizer";
import { getSavedCardConfig, type SavedCardConfig } from "@/api/payments";

const MOD_COLOR = Colors.modules.motorista;
const API_BASE = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api` : "/api";
const EMPRESA_ID = 2;

type PaymentChoice = "dinheiro" | "pix_direto" | "maquininha" | "pix_app" | "card_app" | "wallet";

const PAYMENT_LABELS: Record<PaymentChoice, string> = {
  dinheiro: "Dinheiro",
  pix_direto: "Pix direto",
  maquininha: "Maquininha",
  pix_app: "Pix pelo app",
  card_app: "Cartão salvo",
  wallet: "Carteira",
};

function paymentPayload(choice: PaymentChoice) {
  if (choice === "pix_app") return { forma_pagamento: "pix", payment_source: "mercado_pago" as const, checkoutMethod: "pix" as const };
  if (choice === "card_app") return { forma_pagamento: "cartao", payment_source: "mercado_pago" as const, checkoutMethod: "cartao" as const };
  if (choice === "wallet") return { forma_pagamento: "credito", payment_source: "wallet" as const, checkoutMethod: "wallet" as const };
  return {
    forma_pagamento: choice === "pix_direto" ? "pix" : choice,
    payment_source: "direto" as const,
    checkoutMethod: null,
  };
}

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

function calcPrecoCategoria(cat: Categoria, km: number): number {
  if (km <= 3) return Number(cat.taxa_minima);
  return Math.round(cat.taxa_por_km * km * 100) / 100;
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
  const [distanciaCobradaKm, setDistanciaCobradaKm] = useState(0);
  const [estimativaValor, setEstimativaValor] = useState<number | null>(null);
  const [estimativaIndisponivel, setEstimativaIndisponivel] = useState(false);
  const [estimativaLoading, setEstimativaLoading] = useState(false);
  const [pagamento, setPagamento] = useState<PaymentChoice>("dinheiro");
  const [paymentOptions, setPaymentOptions] = useState<PaymentOptions>({
    receber_direto: true, mercado_pago: false, carteira: false, beta: false, sandbox: false,
  });
  const [savedCard, setSavedCard] = useState<SavedCard | null>(null);
  const [savedCardConfig, setSavedCardConfig] = useState<SavedCardConfig | null>(null);
  const [savedCardTokenizerVisible, setSavedCardTokenizerVisible] = useState(false);
  
  const [estado, setEstado] = useState<"idle" | "buscando" | "aguardando" | "caminho" | "chegou">("idle");
  const [corridaId, setCorridaId] = useState<number | null>(null);
  const [corridaData, setCorridaData] = useState<any>(null);
  const [servicePaymentReferenceId, setServicePaymentReferenceId] = useState<number | null>(null);
  const [pixCopiaECola, setPixCopiaECola] = useState("");
  const servicePaymentReferenceRef = useRef<number | null>(null);
  const cardPaymentReferenceRef = useRef<number | null>(null);
  const cardRetryReferenceRef = useRef<number | null>(null);
  const cardRetryPromptedRef = useRef<Set<number>>(new Set());
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

  useEffect(() => {
    if (customer?.formaPagamento) {
      setPagamento(
        customer.formaPagamento === "pix" || customer.formaPagamento === "pix_direto"
          ? "pix_direto"
          : customer.formaPagamento === "pix_app"
            ? "pix_app"
            : customer.formaPagamento === "cartao"
              ? "card_app"
              : customer.formaPagamento === "wallet"
                ? "wallet"
                : customer.formaPagamento,
      );
    }
  }, [customer?.formaPagamento]);

  useEffect(() => {
    if (!customer?.token) { setSavedCard(null); return; }
    getSavedCard(customer.token).then(setSavedCard).catch(() => setSavedCard(null));
  }, [customer?.token]);

  useEffect(() => {
    getPaymentOptions(EMPRESA_ID, customer?.token)
      .then(options => {
        setPaymentOptions(options);
        setPagamento(current => {
          const isDirect = current === "dinheiro" || current === "pix_direto" || current === "maquininha";
          if ((isDirect && options.receber_direto) || ((current === "pix_app" || current === "card_app") && options.mercado_pago) || (current === "wallet" && options.carteira)) return current;
          if (options.mercado_pago) return "pix_app";
          if (options.carteira) return "wallet";
          return "dinheiro";
        });
      })
      .catch(() => setPaymentOptions(prev => ({ ...prev, mercado_pago: false, carteira: false })));
  }, [customer?.token]);

  const catSelecionada = categorias.find(c => c.id === catSel) ?? null;
  const precoEstimado = estimativaValor
    ?? (catSelecionada && distanciaCobradaKm > 0
      ? calcPrecoCategoria(catSelecionada, distanciaCobradaKm)
      : catSelecionada?.taxa_minima ?? 0);
  const preco = corridaData?.valor != null ? Number(corridaData.valor) : precoEstimado;
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
      const params = new URLSearchParams();
      if (catNome) params.set("categoria", catNome);
      params.set("payment_source", paymentPayload(pagamento).payment_source);
      const url = `${API_BASE}/motorista/disponiveis?${params.toString()}`;
      const res = await fetch(url);
      if (res.ok) setMotoristasDisponiveis(await res.json());
    } catch {}
  }, [catSel, categorias, pagamento]);

  useEffect(() => {
    if (estado !== "idle") return;
    fetchDisponiveis();
    const t = setInterval(fetchDisponiveis, 12_000);
    return () => clearInterval(t);
  }, [estado, fetchDisponiveis]);

  useEffect(() => {
    setMotoristasDisponiveis([]);
  }, [catSel, pagamento]);

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

  // ── Fetch the same server-side road quote used when the ride is created ────────
  useEffect(() => {
    if (!destinoText || !catSelecionada) {
      setDistanciaKm(0);
      setDistanciaCobradaKm(0);
      setEstimativaValor(null);
      setEstimativaIndisponivel(false);
      return;
    }
    if (!customer?.token) {
      setDistanciaKm(0);
      setDistanciaCobradaKm(0);
      setEstimativaValor(null);
      setEstimativaIndisponivel(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setEstimativaLoading(true);
      try {
        const response = await fetch(`${API_BASE}/motorista/estimativa`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${customer.token}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            lat_origem: origemLatLng.lat,
            lng_origem: origemLatLng.lng,
            lat_destino: destinoLatLng.lat,
            lng_destino: destinoLatLng.lng,
            categoria_nome: catSelecionada.nome,
            payment_source: paymentPayload(pagamento).payment_source,
          }),
        });
        if (!response.ok) throw new Error("quote_unavailable");
        const quote = await response.json();
        setDistanciaKm(Number(quote.distancia_viagem_km));
        setDistanciaCobradaKm(Number(quote.distancia_cobrada_km));
        setEstimativaValor(Number(quote.valor));
        setEstimativaIndisponivel(false);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setDistanciaKm(0);
          setDistanciaCobradaKm(0);
          setEstimativaValor(null);
          setEstimativaIndisponivel(true);
        }
      } finally {
        if (!controller.signal.aborted) setEstimativaLoading(false);
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [origemLatLng, destinoLatLng, destinoText, catSelecionada, pagamento, customer?.token]);

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
        if (data.status === "concluida" && servicePaymentReferenceRef.current === id) {
          cardPaymentReferenceRef.current = null;
          cardRetryReferenceRef.current = null;
          cardRetryPromptedRef.current.delete(id);
          setEstado("chegou");
          return;
        }
        servicePaymentReferenceRef.current = null;
        cardPaymentReferenceRef.current = null;
        cardRetryReferenceRef.current = null;
        cardRetryPromptedRef.current.delete(id);
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

  useEffect(() => {
    servicePaymentReferenceRef.current = servicePaymentReferenceId;
    if (!servicePaymentReferenceId || !customer?.token) return;
    let active = true;
    const pollPayment = async () => {
      try {
        const payment = await getServicePaymentStatus(customer.token, "motorista", servicePaymentReferenceId);
        if (!active) return;
        if (payment.pix?.copyPaste) setPixCopiaECola(payment.pix.copyPaste);
        setCorridaData((current: any) => ({
          ...(current ?? {}),
          paymentSource: payment.paymentSource ?? current?.paymentSource ?? "mercado_pago",
          paymentStatus: payment.paymentStatus,
        }));
        if (payment.paymentStatus === "pago") {
          cardPaymentReferenceRef.current = null;
          cardRetryReferenceRef.current = null;
          cardRetryPromptedRef.current.delete(servicePaymentReferenceId);
          clearInterval(timer);
        } else if (
          payment.paymentStatus === "rejeitado"
          && cardPaymentReferenceRef.current === servicePaymentReferenceId
          && !cardRetryPromptedRef.current.has(servicePaymentReferenceId)
        ) {
          cardRetryPromptedRef.current.add(servicePaymentReferenceId);
          Alert.alert(
            "Pagamento recusado",
            "Confirme novamente o CVV do cartão salvo para tentar o pagamento desta mesma corrida.",
            [
              { text: "Agora não", style: "cancel" },
              {
                text: "Tentar novamente",
                onPress: async () => {
                  try {
                    const config = await getSavedCardConfig(customer.token);
                    if (!active) return;
                    setSavedCardConfig(config);
                    cardRetryReferenceRef.current = servicePaymentReferenceId;
                    setSavedCardTokenizerVisible(true);
                  } catch (error) {
                    Alert.alert("Cartão indisponível", error instanceof Error ? error.message : "Não foi possível abrir a confirmação segura.");
                  }
                },
              },
            ],
          );
        }
      } catch {}
    };
    const timer = setInterval(pollPayment, 4000);
    pollPayment();
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [servicePaymentReferenceId, customer?.token]);

  const handleChamar = (paymentToken?: string) => {
    if (!destinoText || !catSel) return;
    requireAuth(async () => {
      if (pagamento === "card_app" && !paymentToken) {
        if (!customer?.token || !savedCard) {
          Alert.alert("Cartão necessário", "Cadastre um cartão em Perfil > Pagamento antes de continuar.");
          return;
        }
        try {
          setSavedCardConfig(await getSavedCardConfig(customer.token));
          setSavedCardTokenizerVisible(true);
        } catch (error) {
          Alert.alert("Cartão indisponível", error instanceof Error ? error.message : "Não foi possível abrir a confirmação segura.");
        }
        return;
      }
      cardRetryReferenceRef.current = null;
      cardRetryPromptedRef.current.clear();
      setEstado("buscando");
      try {
        if (!customer?.token) {
          setEstado("idle");
          Alert.alert("Login necessário", "Entre na sua conta para solicitar a corrida.");
          return;
        }
        const selectedPayment = paymentPayload(pagamento);
        const body = {
          empresa_id: EMPRESA_ID,
          passageiro_nome: customer?.nome || "Cliente",
          passageiro_telefone: customer?.whatsapp || undefined,
          origem_endereco: origemText,
          destino_endereco: destinoText,
          tipo_veiculo: catSelecionada?.nome || "GoTaxi X",
          forma_pagamento: selectedPayment.forma_pagamento,
          payment_source: selectedPayment.payment_source,
          lat_origem: origemLatLng.lat,
          lng_origem: origemLatLng.lng,
          lat_destino: destinoLatLng.lat,
          lng_destino: destinoLatLng.lng,
        };
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${customer.token}`,
        };
        const res = await fetch(`${API_BASE}/motorista/solicitar`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const corrida = await res.json();
          setCorridaData(corrida);
          let cardCheckoutRejected = false;
          if (selectedPayment.checkoutMethod) {
            try {
              const checkout = await checkoutPayment(customer.token, {
                module: "motorista",
                referenceId: corrida.id,
                paymentSource: selectedPayment.payment_source,
                mercadoPagoMethod: selectedPayment.checkoutMethod,
                ...(selectedPayment.checkoutMethod === "cartao" && paymentToken ? { paymentToken } : {}),
              });
              if (checkout.status === "rejected") {
                if (selectedPayment.checkoutMethod === "cartao") {
                  cardCheckoutRejected = true;
                } else {
                  throw new Error(checkout.message || "Pagamento não autorizado");
                }
              }
            } catch (checkoutError) {
              const stagingMessage = checkoutError instanceof Error ? checkoutError.message : "Falha ao preparar pagamento";
              try {
                const cancelResponse = await fetch(`${API_BASE}/payments/services/motorista/${corrida.id}/cancel`, {
                  method: "POST",
                  headers,
                });
                if (!cancelResponse.ok) {
                  throw new Error("cancel_failed");
                }
              } catch {
                throw new Error(`${stagingMessage}. O cancelamento automático também falhou; esta corrida não será apresentada como pronta.`);
              }
              throw new Error(stagingMessage);
            }
          }
          if (pagamento === "pix_app" || pagamento === "card_app") {
            setPixCopiaECola("");
            setServicePaymentReferenceId(corrida.id);
            servicePaymentReferenceRef.current = corrida.id;
            if (pagamento === "card_app") {
              cardPaymentReferenceRef.current = corrida.id;
              cardRetryPromptedRef.current.delete(corrida.id);
              if (cardCheckoutRejected) {
                setCorridaData({ ...corrida, paymentSource: "mercado_pago", paymentStatus: "rejeitado" });
              }
            } else {
              cardPaymentReferenceRef.current = null;
            }
          } else {
            setServicePaymentReferenceId(null);
            servicePaymentReferenceRef.current = null;
            cardPaymentReferenceRef.current = null;
            setPixCopiaECola("");
          }
          setCorridaId(corrida.id);
          setTimeout(() => setEstado("aguardando"), 1500);
        } else {
          setEstado("idle");
          const err = await res.json().catch(() => ({}));
          Alert.alert("Erro", err.message || "Não foi possível solicitar a corrida. Tente novamente.");
        }
      } catch (e) {
        setEstado("idle");
        setCorridaId(null);
        Alert.alert("Não foi possível solicitar", e instanceof Error ? e.message : "Verifique sua conexão e tente novamente.");
      }
    });
  };

  const handleCancelar = async () => {
    if (corridaId) {
      try {
        if (!customer?.token) throw new Error("unauthorized");
        const response = await fetch(`${API_BASE}/payments/services/motorista/${corridaId}/cancel`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${customer.token}`,
          },
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          Alert.alert("Não foi possível cancelar", error.message || "A corrida já está sendo finalizada.");
          return;
        }
      } catch (_) {
        Alert.alert("Não foi possível cancelar", "Verifique sua conexão e tente novamente.");
        return;
      }
      if (pollRef.current) clearInterval(pollRef.current);
    }
    setEstado("idle");
    setCorridaId(null);
    setCorridaData(null);
    setServicePaymentReferenceId(null);
    servicePaymentReferenceRef.current = null;
    cardPaymentReferenceRef.current = null;
    cardRetryReferenceRef.current = null;
    if (corridaId) cardRetryPromptedRef.current.delete(corridaId);
    setPixCopiaECola("");
  };

  const handleSavedCardToken = async (token: string) => {
    setSavedCardTokenizerVisible(false);
    const retryReferenceId = cardRetryReferenceRef.current;
    cardRetryReferenceRef.current = null;
    if (!retryReferenceId) {
      handleChamar(token);
      return;
    }
    if (!customer?.token) return;
    try {
      setCorridaData((current: any) => ({ ...(current ?? {}), paymentStatus: "pendente" }));
      const checkout = await checkoutPayment(customer.token, {
        module: "motorista",
        referenceId: retryReferenceId,
        paymentSource: "mercado_pago",
        mercadoPagoMethod: "cartao",
        paymentToken: token,
      });
      if (checkout.status === "rejected") {
        setCorridaData((current: any) => ({ ...(current ?? {}), paymentStatus: "rejeitado" }));
        Alert.alert("Pagamento recusado", checkout.message || "Não foi possível autorizar o cartão.");
      } else {
        setCorridaData((current: any) => ({ ...(current ?? {}), paymentStatus: "pendente" }));
      }
    } catch (error) {
      setCorridaData((current: any) => ({ ...(current ?? {}), paymentStatus: "rejeitado" }));
      Alert.alert("Não foi possível tentar novamente", error instanceof Error ? error.message : "Confira o CVV e tente mais tarde.");
    }
  };

  const savedCardTokenizer = (
    <MercadoPagoCardTokenizer
      visible={savedCardTokenizerVisible}
      publicKey={savedCardConfig?.publicKey ?? ""}
      sandbox={savedCardConfig?.sandbox ?? false}
      mode="saved"
      cardId={savedCard?.cardId}
      onClose={() => {
        cardRetryReferenceRef.current = null;
        setSavedCardTokenizerVisible(false);
      }}
      onToken={handleSavedCardToken}
    />
  );

  const origemLatLngMap = { ...origemLatLng, label: origemText };
  const destinoLatLngMap = { ...destinoLatLng, label: destinoText };
  const motoristaNome = corridaData?.motorista_nome_real || corridaData?.motorista_app_nome || corridaData?.motorista_nome || "Motorista";
  const motoristaVeiculo = corridaData?.motorista_veiculo || corridaData?.ma_veiculo || "Veículo";
  const motoristaPlaca = corridaData?.motorista_placa || corridaData?.ma_placa || "---";
  const motoristaCor = corridaData?.motorista_cor || corridaData?.veiculo_cor || "";
  const pagamentoAtual = corridaData?.forma_pagamento || pagamento;
  const rawPaymentSourceAtual = corridaData?.paymentSource ?? corridaData?.source ?? corridaData?.payment_source;
  const paymentSourceAtual = rawPaymentSourceAtual === "carteira" ? "wallet" : rawPaymentSourceAtual;
  const rawPaymentStatusAtual = corridaData?.paymentStatus ?? corridaData?.payment_status ?? corridaData?.pagamento_status ?? "";
  const paymentStatusAtual = rawPaymentStatusAtual === "approved" ? "pago"
    : ["pending", "in_process"].includes(rawPaymentStatusAtual)
      ? "pendente"
      : corridaData?.paymentStatus ?? corridaData?.payment_status ?? corridaData?.pagamento_status;
  const pagamentoNoApp = paymentSourceAtual === "mercado_pago" || paymentSourceAtual === "wallet";
  const pagamentoAprovado = pagamentoNoApp && paymentStatusAtual === "pago";
  const corridaConcluida = corridaData?.status === "concluida";
  const resumoPagamento = pagamentoAprovado
    ? "Pago pelo app"
    : pagamentoNoApp
      ? `Pagamento pendente${pagamentoAtual ? ` • ${String(pagamentoAtual).toUpperCase()}` : ""}`
      : `Pagamento direto${pagamentoAtual ? ` • ${String(pagamentoAtual).toUpperCase()}` : ""}`;
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
      {savedCardTokenizer}
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
                {corridaConcluida ? "Corrida concluída" : "Você chegou! 🎉"}
              </Text>
              <Text style={[styles.sheetSub, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                {corridaConcluida ? (pagamentoAprovado ? "Pagamento confirmado" : "Finalize o pagamento abaixo") : "Aguardando finalização do motorista"}
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
                 {resumoPagamento}{pagamentoNoApp && !pagamentoAprovado && !corridaConcluida ? " • será confirmado ao concluir" : !corridaConcluida ? " • Aguardando motorista" : ""}
              </Text>
            </View>
          </View>
          {servicePaymentReferenceId && pixCopiaECola && !pagamentoAprovado && (
            <View style={[styles.pixPaymentCard, { backgroundColor: isDark ? "#172033" : "#EFF6FF", borderColor: "#3B82F640" }]}>
              <View style={styles.pixPaymentTitleRow}>
                <Feather name="smartphone" size={18} color="#2563EB" />
                <Text style={[styles.pixPaymentTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Pague o Pix pelo app</Text>
              </View>
              <Text style={[styles.pixPaymentHint, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                Copie o código abaixo e pague no aplicativo do seu banco. A confirmação será automática.
              </Text>
              <Text style={[styles.pixPaymentCode, { color: colors.text, fontFamily: "Inter_400Regular" }]} numberOfLines={2}>
                {pixCopiaECola}
              </Text>
              <Pressable
                style={styles.pixCopyButton}
                onPress={async () => {
                  await Clipboard.setStringAsync(pixCopiaECola);
                  Alert.alert("Código copiado", "Cole o Pix copia e cola no aplicativo do seu banco.");
                }}
              >
                <Feather name="copy" size={15} color="#fff" />
                <Text style={[styles.pixCopyButtonText, { fontFamily: "Inter_600SemiBold" }]}>Copiar código Pix</Text>
              </Pressable>
            </View>
          )}
        </View>
        {savedCardTokenizer}
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
        {savedCardTokenizer}
      </View>
    );
  }

  const pagamentoDisponivel = pagamento === "pix_app" || pagamento === "card_app"
    ? paymentOptions.mercado_pago
    : pagamento === "wallet"
      ? paymentOptions.carteira
      : paymentOptions.receber_direto;
  const canChamar = !!destinoText
    && !!catSel
    && pagamentoDisponivel
    && !estimativaLoading
    && !estimativaIndisponivel
    && estimativaValor != null;
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
        {(distanciaKm > 0 || estimativaLoading || estimativaIndisponivel) && (
          <View style={[styles.distBadge, { backgroundColor: MOD_COLOR + "15" }]}>
            {estimativaLoading
              ? <ActivityIndicator size="small" color={MOD_COLOR} />
              : <Feather name="map" size={12} color={MOD_COLOR} />}
            <Text style={[styles.distText, { color: MOD_COLOR, fontFamily: "Inter_500Medium" }]}>
              {estimativaLoading
                ? "Calculando rota..."
                : estimativaIndisponivel
                  ? "Rota pelas ruas indisponível. Nenhuma corrida será criada."
                  : `${distanciaCobradaKm.toFixed(1)} km cobrados (aproximação + viagem)`}
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
              const p = cat.id === catSel ? preco : calcPrecoCategoria(cat, distanciaCobradaKm);
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
                    {distanciaCobradaKm <= 3
                      ? `Tarifa mínima: R$ ${cat.taxa_minima.toFixed(2)} total`
                      : `R$ ${cat.taxa_por_km.toFixed(2)}/km`}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Pagamento */}
        <View style={styles.paymentHeader}>
          <Text style={[styles.tipoLabel, { color: colors.text, fontFamily: "Inter_600SemiBold", marginBottom: 0 }]}>Pagamento</Text>
          <Pressable onPress={() => router.push("/cliente/perfil" as any)}>
            <Text style={[styles.changePaymentText, { color: MOD_COLOR, fontFamily: "Inter_600SemiBold" }]}>Alterar</Text>
          </Pressable>
        </View>
        <Pressable
          onPress={() => router.push("/cliente/perfil" as any)}
          style={[styles.selectedPaymentCard, { borderColor: MOD_COLOR, backgroundColor: MOD_COLOR + "12" }]}
        >
          <View style={[styles.selectedPaymentIcon, { backgroundColor: MOD_COLOR + "20" }]}>
            <Feather
              name={pagamento === "wallet" || pagamento === "card_app" ? "credit-card" : pagamento.includes("pix") ? "smartphone" : "dollar-sign"}
              size={18}
              color={MOD_COLOR}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.selectedPaymentLabel, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
              {pagamento === "card_app" && savedCard ? `Cartão •••• ${savedCard.lastFour}` : PAYMENT_LABELS[pagamento]}
            </Text>
            <Text style={[styles.selectedPaymentHint, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
              {pagamento === "dinheiro" || pagamento === "pix_direto" || pagamento === "maquininha"
                ? "Pagamento direto ao motorista"
                : pagamento === "wallet"
                  ? "Pago com o saldo da Carteira GoTaxi"
                  : "Pagamento processado pelo Mercado Pago"}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={MOD_COLOR} />
        </Pressable>

        {/* Botão chamar */}
        <Pressable
          style={[styles.chamarBtn, { backgroundColor: canChamar ? MOD_COLOR : colors.backgroundSecondary }]}
          onPress={() => handleChamar()}
          disabled={!canChamar}
        >
          <Feather name="navigation" size={20} color={canChamar ? "#fff" : colors.textMuted} />
          <Text style={[styles.chamarBtnText, { color: canChamar ? "#fff" : colors.textMuted, fontFamily: "Inter_700Bold" }]}>
            {canChamar
              ? `Chamar ${tipoNome} · R$ ${preco.toFixed(2)}`
              : estimativaIndisponivel
                ? "Rota indisponível"
                : estimativaLoading
                  ? "Calculando rota..."
                  : "Informe o destino"}
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
      {savedCardTokenizer}
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
  paymentSummary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 14 },
  paymentSummaryInfo: { flexDirection: "row", alignItems: "center", gap: 9 },
  paymentSummaryText: { fontSize: 14 },
  paymentChangeText: { fontSize: 14 },
  paymentHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  changePaymentText: { fontSize: 13 },
  selectedPaymentCard: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 14, padding: 13, marginBottom: 14 },
  selectedPaymentIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  selectedPaymentLabel: { fontSize: 14 },
  selectedPaymentHint: { fontSize: 12, marginTop: 2 },
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
  pixPaymentCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  pixPaymentTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pixPaymentTitle: { fontSize: 15 },
  pixPaymentHint: { fontSize: 12, lineHeight: 17 },
  pixPaymentCode: { fontSize: 11, lineHeight: 16 },
  pixCopyButton: { minHeight: 42, borderRadius: 10, backgroundColor: "#2563EB", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  pixCopyButtonText: { color: "#fff", fontSize: 14 },
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