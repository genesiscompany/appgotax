import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, useColorScheme, TextInput,
  ActivityIndicator, Alert, Platform,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import * as Clipboard from "expo-clipboard";
import SegmentoBottomNav, { SEGMENTO_NAV_HEIGHT } from "@/components/SegmentoBottomNav";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import Colors from "@/constants/colors";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { useAuthGate } from "@/components/AuthGate";
import { checkoutPayment, getPaymentOptions, getSavedCard, getServicePaymentStatus, type PaymentOptions, type SavedCard } from "@/api/payments";
import MercadoPagoCardTokenizer from "@/components/MercadoPagoCardTokenizer";
import { getSavedCardConfig, type SavedCardConfig } from "@/api/payments";

const MOD_COLOR = Colors.modules.entrega;

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "http://localhost:8080/api";

type PaymentChoice = "dinheiro" | "pix_direto" | "maquininha" | "pix_app" | "card_app" | "wallet";

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

const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
  pendente:       { label: "Aguardando coleta",  color: "#F59E0B", icon: "clock" },
  coletado:       { label: "Coletado",           color: "#3B82F6", icon: "package" },
  em_transporte:  { label: "Em transporte",      color: MOD_COLOR, icon: "truck" },
  saiu_entrega:   { label: "Saiu para entrega",  color: "#8B5CF6", icon: "navigation" },
  entregue:       { label: "Entregue",           color: "#10B981", icon: "check-circle" },
  cancelado:      { label: "Cancelado",          color: "#EF4444", icon: "x-circle" },
};

const CATEGORIAS = [
  { slug: "padrao",   label: "Padrão",   icon: "package" as const,  desc: "Pacotes pequenos e médios" },
  { slug: "expressa", label: "Expressa", icon: "zap" as const,      desc: "Entrega prioritária e rápida" },
  { slug: "grande",   label: "Grande",   icon: "box" as const,      desc: "Pacotes volumosos ou pesados" },
];

const DEFAULT_TAXAS: Record<string, { taxa_minima: number; distancia_km: number; taxa_km: number }> = {
  padrao:   { taxa_minima: 10, distancia_km: 3, taxa_km: 2 },
  expressa: { taxa_minima: 15, distancia_km: 3, taxa_km: 3 },
  grande:   { taxa_minima: 20, distancia_km: 3, taxa_km: 4 },
};

type Historico = { status: string; descricao: string; operador_nome: string | null; registrado_em: string };
type Encomenda = {
  id: number; codigo: string; cliente_nome: string; cliente_telefone: string;
  origem_endereco: string; destino_endereco: string; destino_bairro: string; destino_cidade: string;
  tipo_pacote: string; valor_frete: number; status: string; data_previsao: string | null;
  empresa_nome: string; historico: Historico[];
};

type Coords = { latitude: number; longitude: number };
type Suggestion = { placeId: string; description: string; mainText: string; secondaryText: string; lat: number | null; lng: number | null };
type ViewMode = "inicio" | "rastrear" | "solicitar" | "ativa";

function haversineKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLng = (b.longitude - a.longitude) * Math.PI / 180;
  const lat1 = a.latitude * Math.PI / 180;
  const lat2 = b.latitude * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function routeDistanceKm(coords: Coords[]): number {
  if (coords.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < coords.length; i++) sum += haversineKm(coords[i - 1], coords[i]);
  return Math.round(sum * 10) / 10;
}

export default function ClienteEntrega() {
  const { requireAuth } = useAuthGate("/cliente/entrega");
  const { customer } = useCustomerAuth();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const { empresaId } = useLocalSearchParams<{ empresaId?: string }>();
  const [view, setView] = useState<ViewMode>("inicio");
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const [encomenda, setEncomenda] = useState<Encomenda | null>(null);
  const [erro, setErro] = useState("");

  const paymentEmpresaId = Number(empresaId || 1);
  const [formaPagamento, setFormaPagamento] = useState<PaymentChoice>("pix_direto");
  const [paymentOptions, setPaymentOptions] = useState<PaymentOptions>({
    receber_direto: true, mercado_pago: false, carteira: false, beta: false, sandbox: false,
  });
  const [savedCard, setSavedCard] = useState<SavedCard | null>(null);
  const [savedCardConfig, setSavedCardConfig] = useState<SavedCardConfig | null>(null);
  const [savedCardTokenizerVisible, setSavedCardTokenizerVisible] = useState(false);

  useEffect(() => {
    if (customer?.formaPagamento) {
      setFormaPagamento(customer.formaPagamento === "pix" ? "pix_direto" : customer.formaPagamento === "cartao" ? "card_app" : customer.formaPagamento);
    }
  }, [customer?.formaPagamento]);

  useEffect(() => {
    if (!customer?.token) { setSavedCard(null); return; }
    getSavedCard(customer.token).then(setSavedCard).catch(() => setSavedCard(null));
  }, [customer?.token]);

  useEffect(() => {
    getPaymentOptions(paymentEmpresaId, customer?.token)
      .then(options => {
        setPaymentOptions(options);
        setFormaPagamento(current => {
          const isDirect = current === "dinheiro" || current === "pix_direto" || current === "maquininha";
          if ((isDirect && options.receber_direto) || ((current === "pix_app" || current === "card_app") && options.mercado_pago) || (current === "wallet" && options.carteira)) return current;
          if (options.mercado_pago) return "pix_app";
          if (options.carteira) return "wallet";
          return "dinheiro";
        });
      })
      .catch(() => setPaymentOptions(prev => ({ ...prev, mercado_pago: false, carteira: false })));
  }, [customer?.token, paymentEmpresaId]);

  // ─── Solicitar form ──────────────────────────────────────────────
  const [form, setForm] = useState({
    remetente_nome: "", remetente_telefone: "",
    destinatario_nome: "", destinatario_telefone: "",
    endereco_coleta: "", endereco_entrega: "",
    descricao_pacote: "",
  });
  const [enviando, setEnviando] = useState(false);
  const [servicePaymentReferenceId, setServicePaymentReferenceId] = useState<number | null>(null);
  const [servicePaymentValue, setServicePaymentValue] = useState(0);
  const [servicePaymentStatus, setServicePaymentStatus] = useState("pendente");
  const [servicePaymentMethod, setServicePaymentMethod] = useState<"pix" | "cartao" | null>(null);
  const [pixCopiaECola, setPixCopiaECola] = useState("");
  const cardRetryReferenceRef = useRef<number | null>(null);
  const cardRetryPromptedRef = useRef<Set<number>>(new Set());

  const [coletaCoords, setColetaCoords] = useState<Coords | null>(null);
  const [entregaCoords, setEntregaCoords] = useState<Coords | null>(null);
  const [routeCoords, setRouteCoords] = useState<Coords[]>([]);
  const [distanciaKm, setDistanciaKm] = useState<number>(0);
  const [carregandoRota, setCarregandoRota] = useState(false);
  const [carregandoLocal, setCarregandoLocal] = useState(false);

  const [taxas, setTaxas] = useState(DEFAULT_TAXAS);
  const [categoria, setCategoria] = useState<string>("padrao");

  useEffect(() => {
    if (!servicePaymentReferenceId || !customer?.token) return;
    let active = true;
    const pollPayment = async () => {
      try {
        const payment = await getServicePaymentStatus(customer.token, "entrega", servicePaymentReferenceId);
        if (!active) return;
        setServicePaymentStatus(payment.paymentStatus);
        if (payment.pix?.copyPaste) setPixCopiaECola(payment.pix.copyPaste);
        if (payment.paymentStatus === "pago") {
          cardRetryReferenceRef.current = null;
          cardRetryPromptedRef.current.delete(servicePaymentReferenceId);
          clearInterval(timer);
        } else if (
          payment.paymentStatus === "rejeitado"
          && servicePaymentMethod === "cartao"
          && !cardRetryPromptedRef.current.has(servicePaymentReferenceId)
        ) {
          cardRetryPromptedRef.current.add(servicePaymentReferenceId);
          Alert.alert(
            "Pagamento recusado",
            "Confirme novamente o CVV do cartão salvo para tentar o pagamento desta mesma entrega.",
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
  }, [servicePaymentReferenceId, servicePaymentMethod, customer?.token]);

  const [sugestoesEntrega, setSugestoesEntrega] = useState<Suggestion[]>([]);
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [buscandoSugestoes, setBuscandoSugestoes] = useState(false);

  const mapRef = useRef<MapView>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sugestoesReqId = useRef(0);
  const rotaReqId = useRef(0);
  const coletaGeocodeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load taxas from sistema configs
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/configuracoes/sistema`);
        if (!r.ok) return;
        const data = await r.json();
        const next = { ...DEFAULT_TAXAS };
        for (const cat of CATEGORIAS) {
          const tm = parseFloat(data[`entrega_${cat.slug}_taxa_minima`]);
          const dk = parseFloat(data[`entrega_${cat.slug}_distancia_km`]);
          const tk = parseFloat(data[`entrega_${cat.slug}_taxa_km`]);
          next[cat.slug] = {
            taxa_minima: isFinite(tm) ? tm : DEFAULT_TAXAS[cat.slug].taxa_minima,
            distancia_km: isFinite(dk) ? dk : DEFAULT_TAXAS[cat.slug].distancia_km,
            taxa_km: isFinite(tk) ? tk : DEFAULT_TAXAS[cat.slug].taxa_km,
          };
        }
        setTaxas(next);
      } catch {}
    })();
  }, []);

  // When entering solicitar view, get user location
  useEffect(() => {
    if (view !== "solicitar") return;
    if (coletaCoords) return;
    if (Platform.OS === "web") return;
    (async () => {
      setCarregandoLocal(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permissão de localização",
            "Para preencher seu endereço de coleta automaticamente, ative a localização nas configurações."
          );
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const c = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setColetaCoords(c);
        // Reverse geocode for friendly address
        try {
          const places = await Location.reverseGeocodeAsync(c);
          const p = places?.[0];
          if (p) {
            const partes = [
              p.street ? `${p.street}${p.streetNumber ? `, ${p.streetNumber}` : ""}` : null,
              p.district || p.subregion,
              p.city,
              p.region,
            ].filter(Boolean);
            const endereco = partes.join(", ");
            if (endereco) setForm(prev => ({ ...prev, endereco_coleta: endereco }));
          }
        } catch {}
      } catch (e) {
        console.warn("[location]", e);
      } finally {
        setCarregandoLocal(false);
      }
    })();
  }, [view]);

  // Address autocomplete for entrega (debounced + race-safe)
  const buscarSugestoes = useCallback((texto: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!texto || texto.trim().length < 3) {
      setSugestoesEntrega([]);
      return;
    }
    const reqId = ++sugestoesReqId.current;
    debounceRef.current = setTimeout(async () => {
      setBuscandoSugestoes(true);
      try {
        const r = await fetch(`${API_BASE}/places/autocomplete?input=${encodeURIComponent(texto)}&types=address`);
        const data = await r.json();
        if (reqId !== sugestoesReqId.current) return; // stale response
        if (Array.isArray(data)) setSugestoesEntrega(data);
      } catch {} finally {
        if (reqId === sugestoesReqId.current) setBuscandoSugestoes(false);
      }
    }, 350);
  }, []);

  // Geocode the typed coleta address (fallback when GPS denied or user edits manually)
  const geocodeColeta = useCallback((texto: string) => {
    if (coletaGeocodeRef.current) clearTimeout(coletaGeocodeRef.current);
    const t = texto.trim();
    if (t.length < 6) return;
    coletaGeocodeRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`${API_BASE}/places/geocode?address=${encodeURIComponent(t)}`);
        const d = await r.json();
        if (d?.lat != null && d?.lng != null) {
          setColetaCoords({ latitude: d.lat, longitude: d.lng });
        }
      } catch {}
    }, 700);
  }, []);

  async function escolherSugestao(s: Suggestion) {
    setForm(prev => ({ ...prev, endereco_entrega: s.description }));
    setShowSugestoes(false);
    setSugestoesEntrega([]);

    let lat = s.lat, lng = s.lng;
    if (lat == null || lng == null) {
      try {
        const r = await fetch(`${API_BASE}/places/details?placeId=${encodeURIComponent(s.placeId)}`);
        const d = await r.json();
        lat = d?.lat; lng = d?.lng;
      } catch {}
    }
    if (lat == null || lng == null) {
      // Fallback geocode the description text
      try {
        const r = await fetch(`${API_BASE}/places/geocode?address=${encodeURIComponent(s.description)}`);
        const d = await r.json();
        lat = d?.lat; lng = d?.lng;
      } catch {}
    }
    if (lat != null && lng != null) {
      setEntregaCoords({ latitude: lat, longitude: lng });
    }
  }

  // When both coords are set, fetch route + distance (race-safe)
  useEffect(() => {
    if (!coletaCoords || !entregaCoords) {
      setRouteCoords([]);
      setDistanciaKm(0);
      return;
    }
    const reqId = ++rotaReqId.current;
    setCarregandoRota(true);
    (async () => {
      try {
        const url = `${API_BASE}/places/route?fromLat=${coletaCoords.latitude}&fromLng=${coletaCoords.longitude}&toLat=${entregaCoords.latitude}&toLng=${entregaCoords.longitude}`;
        const r = await fetch(url);
        const data = await r.json();
        if (reqId !== rotaReqId.current) return; // stale
        if (Array.isArray(data) && data.length > 1) {
          setRouteCoords(data);
          setDistanciaKm(routeDistanceKm(data));
        } else {
          const km = Math.round(haversineKm(coletaCoords, entregaCoords) * 10) / 10;
          setRouteCoords([coletaCoords, entregaCoords]);
          setDistanciaKm(km);
        }
        setTimeout(() => {
          if (reqId !== rotaReqId.current) return;
          mapRef.current?.fitToCoordinates([coletaCoords, entregaCoords], {
            edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
            animated: true,
          });
        }, 200);
      } catch {
        if (reqId !== rotaReqId.current) return;
        const km = Math.round(haversineKm(coletaCoords, entregaCoords) * 10) / 10;
        setRouteCoords([coletaCoords, entregaCoords]);
        setDistanciaKm(km);
      } finally {
        if (reqId === rotaReqId.current) setCarregandoRota(false);
      }
    })();
  }, [coletaCoords, entregaCoords]);

  // Calculate price
  const taxa = taxas[categoria] ?? DEFAULT_TAXAS[categoria];
  const valorEstimado = distanciaKm > 0
    ? Math.round((taxa.taxa_minima + Math.max(0, distanciaKm - taxa.distancia_km) * taxa.taxa_km) * 100) / 100
    : 0;

  async function rastrear() {
    const c = codigo.trim().toUpperCase();
    if (!c) return;
    setLoading(true);
    setErro("");
    setEncomenda(null);
    try {
      const r = await fetch(`${API_BASE}/public/entrega/rastrear/${encodeURIComponent(c)}`);
      if (r.status === 404) { setErro("Código não encontrado. Verifique e tente novamente."); return; }
      if (!r.ok) { setErro("Erro ao rastrear. Tente novamente."); return; }
      const data = await r.json();
      setEncomenda(data);
    } catch {
      setErro("Sem conexão. Verifique sua internet.");
    } finally { setLoading(false); }
  }

  async function solicitar(paymentToken?: string) {
    if (!form.remetente_nome.trim() || !form.endereco_coleta.trim() || !form.endereco_entrega.trim()) {
      Alert.alert("Campos obrigatórios", "Nome, endereço de coleta e entrega são necessários.");
      return;
    }
    if (valorEstimado <= 0) {
      Alert.alert("Calcule a rota", "Confirme o endereço de entrega para calcular o valor.");
      return;
    }
    if (!formaPagamento) {
      Alert.alert("Pagamento", "Selecione uma forma de pagamento.");
      return;
    }
    if (formaPagamento === "card_app" && !paymentToken) {
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
    setServicePaymentReferenceId(null);
    setServicePaymentMethod(null);
    cardRetryReferenceRef.current = null;
    cardRetryPromptedRef.current.clear();
    setEnviando(true);
    try {
      if (!customer?.token) throw new Error("Entre na sua conta para solicitar a entrega.");
      const selectedPayment = paymentPayload(formaPagamento);
      const r = await fetch(`${API_BASE}/public/entrega/solicitar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${customer.token}`,
        },
        body: JSON.stringify({
          ...form,
          empresa_id: paymentEmpresaId,
          valor: valorEstimado,
          forma_pagamento: selectedPayment.forma_pagamento,
          payment_source: selectedPayment.payment_source,
          categoria,
          distancia_km: distanciaKm,
          coleta_lat: coletaCoords?.latitude,
          coleta_lng: coletaCoords?.longitude,
          entrega_lat: entregaCoords?.latitude,
          entrega_lng: entregaCoords?.longitude,
        }),
      });
      if (!r.ok) {
        const error = await r.json().catch(() => ({}));
        throw new Error(error.message || error.error || "Não foi possível criar a entrega.");
      }
      const created = await r.json();
      if (!created?.id) throw new Error("A entrega foi criada sem um identificador válido.");

      let cardCheckoutRejected = false;
      if (selectedPayment.checkoutMethod) {
        try {
          const checkout = await checkoutPayment(customer.token, {
            module: "entrega",
            referenceId: created.id,
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
            const cancelResponse = await fetch(`${API_BASE}/payments/services/entrega/${created.id}/cancel`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${customer.token}`,
              },
            });
            if (!cancelResponse.ok) {
              throw new Error("cancel_failed");
            }
          } catch {
            throw new Error(`${stagingMessage}. O cancelamento automático também falhou; esta entrega não será apresentada como pronta.`);
          }
          throw new Error(stagingMessage);
        }
      }

      if (formaPagamento === "pix_app" || formaPagamento === "card_app") {
        const referenceId = Number(created.id);
        setServicePaymentReferenceId(referenceId);
        setServicePaymentValue(valorEstimado);
        setServicePaymentMethod(formaPagamento === "card_app" ? "cartao" : "pix");
        setServicePaymentStatus(cardCheckoutRejected ? "rejeitado" : "pendente");
        cardRetryReferenceRef.current = null;
        cardRetryPromptedRef.current.delete(referenceId);
        setPixCopiaECola("");
        setView("ativa");
        return;
      }

      Alert.alert(
        "Solicitação enviada!",
        `Valor estimado: R$ ${valorEstimado.toFixed(2).replace(".", ",")}\nEm breve um entregador entrará em contato para combinar a coleta.`,
        [{ text: "OK", onPress: () => {
          setView("inicio");
          setForm({ remetente_nome: "", remetente_telefone: "", destinatario_nome: "", destinatario_telefone: "", endereco_coleta: "", endereco_entrega: "", descricao_pacote: "" });
          setEntregaCoords(null);
          setRouteCoords([]);
          setDistanciaKm(0);
        } }],
      );
    } catch (error) {
      Alert.alert("Erro", error instanceof Error ? error.message : "Não foi possível enviar a solicitação. Tente novamente.");
    } finally { setEnviando(false); }
  }

  const statusInfo = encomenda ? (STATUS_MAP[encomenda.status] ?? { label: encomenda.status, color: "#64748B", icon: "package" }) : null;
  const pagamentoDisponivel = formaPagamento === "pix_app" || formaPagamento === "card_app"
    ? paymentOptions.mercado_pago
    : formaPagamento === "wallet"
      ? paymentOptions.carteira
      : paymentOptions.receber_direto;
  const handleSavedCardToken = async (token: string) => {
    setSavedCardTokenizerVisible(false);
    const retryReferenceId = cardRetryReferenceRef.current;
    cardRetryReferenceRef.current = null;
    if (retryReferenceId) {
      if (!customer?.token) return;
      try {
        setServicePaymentStatus("pendente");
        const checkout = await checkoutPayment(customer.token, {
          module: "entrega",
          referenceId: retryReferenceId,
          paymentSource: "mercado_pago",
          mercadoPagoMethod: "cartao",
          paymentToken: token,
        });
        if (checkout.status === "rejected") {
          setServicePaymentStatus("rejeitado");
          Alert.alert("Pagamento recusado", checkout.message || "Não foi possível autorizar o cartão.");
        } else {
          setServicePaymentStatus("pendente");
        }
      } catch (error) {
        setServicePaymentStatus("rejeitado");
        Alert.alert("Não foi possível tentar novamente", error instanceof Error ? error.message : "Confira o CVV e tente mais tarde.");
      }
      return;
    }
    await solicitar(token);
  };
  const clearServicePayment = () => {
    setServicePaymentReferenceId(null);
    setServicePaymentMethod(null);
    setServicePaymentStatus("pendente");
    setPixCopiaECola("");
    cardRetryReferenceRef.current = null;
    cardRetryPromptedRef.current.clear();
  };

  const initialRegion = coletaCoords
    ? { latitude: coletaCoords.latitude, longitude: coletaCoords.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 }
    : { latitude: -15.78, longitude: -47.93, latitudeDelta: 0.6, longitudeDelta: 0.6 };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (view !== "inicio" || encomenda) {
              setView("inicio");
              setEncomenda(null);
              setCodigo("");
              setErro("");
              clearServicePayment();
            } else {
              router.back();
            }
          }}
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Entregas</Text>
        <View style={{ width: 30 }} />
      </View>

      {view === "inicio" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + SEGMENTO_NAV_HEIGHT + 16 }} showsVerticalScrollIndicator={false}>
          <Text style={[styles.welcomeTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Olá! Como podemos ajudar?</Text>
          <Text style={[styles.welcomeSub, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Rastreie sua encomenda pelo código ou solicite uma nova entrega</Text>

          <Pressable style={[styles.actionCard, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]} onPress={() => setView("rastrear")}>
            <View style={[styles.actionIcon, { backgroundColor: MOD_COLOR + "20" }]}><Feather name="search" size={24} color={MOD_COLOR} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Rastrear encomenda</Text>
              <Text style={[styles.actionSub, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Acompanhe o status pelo código</Text>
            </View>
            <Feather name="chevron-right" size={22} color={colors.textMuted} />
          </Pressable>

          <Pressable style={[styles.actionCard, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]} onPress={() => setView("solicitar")}>
            <View style={[styles.actionIcon, { backgroundColor: MOD_COLOR + "20" }]}><Feather name="plus-circle" size={24} color={MOD_COLOR} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Solicitar entrega</Text>
              <Text style={[styles.actionSub, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Escolha no mapa e calcule o valor</Text>
            </View>
            <Feather name="chevron-right" size={22} color={colors.textMuted} />
          </Pressable>

          <View style={[styles.infoCard, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
            <Feather name="info" size={16} color={MOD_COLOR} />
            <Text style={[styles.infoText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>O valor é calculado automaticamente pela distância e categoria escolhida.</Text>
          </View>
        </ScrollView>
      )}

      {view === "ativa" && servicePaymentReferenceId && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + SEGMENTO_NAV_HEIGHT + 16 }} showsVerticalScrollIndicator={false}>
          <View style={[styles.activePaymentHeader, { backgroundColor: servicePaymentStatus === "pago" ? "#10B981" : servicePaymentStatus === "rejeitado" ? "#EF4444" : MOD_COLOR }]}>
            <Feather name={servicePaymentStatus === "pago" ? "check-circle" : servicePaymentStatus === "rejeitado" ? "alert-circle" : "clock"} size={28} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.activePaymentEyebrow, { fontFamily: "Inter_500Medium" }]}>Entrega #{servicePaymentReferenceId}</Text>
              <Text style={[styles.activePaymentTitle, { fontFamily: "Inter_700Bold" }]}>
                {servicePaymentStatus === "pago" ? "Pago pelo app" : servicePaymentStatus === "rejeitado" ? "Pagamento recusado" : "Pagamento pendente"}
              </Text>
            </View>
            <Text style={[styles.activePaymentValue, { fontFamily: "Inter_700Bold" }]}>
              R$ {servicePaymentValue.toFixed(2).replace(".", ",")}
            </Text>
          </View>

          {servicePaymentMethod === "pix" && servicePaymentStatus !== "pago" && (
            <View style={[styles.pixPaymentCard, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
              <View style={styles.pixPaymentTitleRow}>
                <Feather name="smartphone" size={20} color={MOD_COLOR} />
                <Text style={[styles.pixPaymentCardTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Pague com Pix</Text>
              </View>
              {pixCopiaECola ? (
                <>
                  <Text style={[styles.pixPaymentHint, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                    Copie o código e pague no aplicativo do seu banco. Continuaremos acompanhando a confirmação automaticamente.
                  </Text>
                  <Text style={[styles.pixPaymentCode, { color: colors.text, fontFamily: "Inter_400Regular" }]} numberOfLines={3}>
                    {pixCopiaECola}
                  </Text>
                  <Pressable
                    style={[styles.pixCopyButton, { backgroundColor: MOD_COLOR }]}
                    onPress={async () => {
                      await Clipboard.setStringAsync(pixCopiaECola);
                      Alert.alert("Código copiado", "Cole o Pix copia e cola no aplicativo do seu banco.");
                    }}
                  >
                    <Feather name="copy" size={16} color="#fff" />
                    <Text style={[styles.pixCopyButtonText, { fontFamily: "Inter_600SemiBold" }]}>Copiar código Pix</Text>
                  </Pressable>
                </>
              ) : (
                <View style={styles.pixWaitingRow}>
                  <ActivityIndicator size="small" color={MOD_COLOR} />
                  <Text style={[styles.pixPaymentHint, { color: colors.textMuted, fontFamily: "Inter_400Regular", flex: 1 }]}>
                    O Pix será gerado quando o entregador finalizar o serviço.
                  </Text>
                </View>
              )}
            </View>
          )}

          {servicePaymentMethod === "cartao" && servicePaymentStatus !== "pago" && (
            <View style={[styles.paidInfoCard, { borderColor: servicePaymentStatus === "rejeitado" ? "#EF444440" : colors.border, backgroundColor: colors.backgroundSecondary }]}>
              <Feather name="credit-card" size={20} color={servicePaymentStatus === "rejeitado" ? "#EF4444" : MOD_COLOR} />
              <Text style={[styles.paidInfoText, { color: colors.text, fontFamily: "Inter_500Medium" }]}>
                {servicePaymentStatus === "rejeitado"
                  ? "A cobrança não foi autorizada. Use a confirmação de CVV para tentar novamente nesta entrega."
                  : "A confirmação do pagamento com cartão está sendo processada."}
              </Text>
            </View>
          )}

          {servicePaymentStatus === "pago" && (
            <View style={[styles.paidInfoCard, { borderColor: "#10B98140", backgroundColor: isDark ? "#0d2018" : "#F0FDF4" }]}>
              <Feather name="shield" size={20} color="#10B981" />
              <Text style={[styles.paidInfoText, { color: colors.text, fontFamily: "Inter_500Medium" }]}>
                Pagamento confirmado. Você não precisa pagar ao entregador.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {view === "rastrear" && !encomenda && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + SEGMENTO_NAV_HEIGHT + 16 }} showsVerticalScrollIndicator={false}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted, fontFamily: "Inter_400Regular", marginBottom: 12 }]}>
            Insira o código de rastreamento da encomenda
          </Text>
          <View style={[styles.searchRow, { gap: 8 }]}>
            <View style={[styles.inputGroup, { flex: 1, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
              <Feather name="hash" size={16} color={colors.textMuted} />
              <TextInput
                style={[styles.input, { color: colors.text, fontFamily: "Inter_500Medium" }]}
                placeholder="ENK-00001"
                placeholderTextColor={colors.textMuted}
                value={codigo}
                onChangeText={setCodigo}
                autoCapitalize="characters"
                onSubmitEditing={rastrear}
              />
            </View>
            <Pressable style={[styles.buscaBtn, { backgroundColor: MOD_COLOR }]} onPress={rastrear} disabled={loading}>
              {loading ? <ActivityIndicator size="small" color="#fff" /> : <Feather name="search" size={20} color="#fff" />}
            </Pressable>
          </View>
          {erro ? (
            <View style={[styles.erroCard, { borderColor: "#FCA5A5", backgroundColor: "#FEF2F2" }]}>
              <Feather name="alert-circle" size={16} color="#EF4444" />
              <Text style={styles.erroText}>{erro}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      {view === "rastrear" && encomenda && statusInfo && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + SEGMENTO_NAV_HEIGHT + 16 }} showsVerticalScrollIndicator={false}>
          <View style={[styles.statusBanner, { backgroundColor: statusInfo.color }]}>
            <Feather name={statusInfo.icon as any} size={28} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusBannerCode, { fontFamily: "Inter_700Bold", color: "rgba(255,255,255,0.8)" }]}>{encomenda.codigo}</Text>
              <Text style={[styles.statusBannerLabel, { fontFamily: "Inter_700Bold", color: "#fff" }]}>{statusInfo.label}</Text>
            </View>
            {encomenda.empresa_nome && (
              <Text style={[styles.statusBannerEmp, { fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" }]}>{encomenda.empresa_nome}</Text>
            )}
          </View>

          {encomenda.data_previsao && encomenda.status !== "entregue" && encomenda.status !== "cancelado" && (
            <View style={[styles.previsaoCard, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
              <Feather name="calendar" size={18} color={MOD_COLOR} />
              <Text style={[styles.previsaoText, { color: colors.text, fontFamily: "Inter_500Medium" }]}>
                Previsão: {(() => { const d = new Date(encomenda.data_previsao); return `${d.getDate().toString().padStart(2,"0")}/${(d.getMonth()+1).toString().padStart(2,"0")}/${d.getFullYear()}`; })()}
              </Text>
            </View>
          )}

          <View style={[styles.timelineCard, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
            <Text style={[styles.timelineTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Histórico</Text>
            {encomenda.historico.length === 0 && (
              <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Sem registros ainda.</Text>
            )}
            {encomenda.historico.map((h, i) => {
              const info = STATUS_MAP[h.status] ?? { label: h.status, color: "#64748B", icon: "circle" };
              const isLast = i === encomenda.historico.length - 1;
              return (
                <View key={i} style={styles.timelineItem}>
                  <View style={styles.timelineLeft}>
                    <View style={[styles.timelineDot, { borderColor: info.color, backgroundColor: isLast ? info.color : "transparent" }]}>
                      {isLast && <Feather name={info.icon as any} size={10} color="#fff" />}
                    </View>
                    {i < encomenda.historico.length - 1 && <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={[styles.timelineEvento, { color: colors.text, fontFamily: "Inter_500Medium" }]}>{h.descricao || info.label}</Text>
                    <Text style={[styles.timelineHora, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                      {(() => { const d = new Date(h.registrado_em); if (isNaN(d.getTime())) return ""; return `${d.getDate().toString().padStart(2,"0")}/${(d.getMonth()+1).toString().padStart(2,"0")} ${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`; })()}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={[styles.detalhesCard, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
            <Text style={[styles.detalhesTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Detalhes</Text>
            {[
              { icon: "circle" as const, color: "#10B981", label: "Origem", val: encomenda.origem_endereco || "—" },
              { icon: "map-pin" as const, color: MOD_COLOR, label: "Destino", val: [encomenda.destino_endereco, encomenda.destino_bairro, encomenda.destino_cidade].filter(Boolean).join(", ") || "—" },
              { icon: "box" as const, color: "#F59E0B", label: "Tipo", val: encomenda.tipo_pacote || "—" },
            ].map((d, i) => (
              <View key={i} style={styles.detalheItem}>
                <Feather name={d.icon} size={14} color={d.color} style={{ marginTop: 4 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.detalheLabel, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>{d.label}</Text>
                  <Text style={[styles.detalheVal, { color: colors.text, fontFamily: "Inter_500Medium" }]}>{d.val}</Text>
                </View>
              </View>
            ))}
          </View>

          <Pressable style={[styles.novaBuscaBtn, { borderColor: MOD_COLOR }]} onPress={() => { setEncomenda(null); setCodigo(""); setErro(""); }}>
            <Feather name="search" size={16} color={MOD_COLOR} />
            <Text style={[styles.novaBuscaText, { color: MOD_COLOR, fontFamily: "Inter_600SemiBold" }]}>Rastrear outro código</Text>
          </Pressable>
        </ScrollView>
      )}

      {view === "solicitar" && (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + SEGMENTO_NAV_HEIGHT + 16 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Map */}
          <View style={styles.mapWrap}>
            {Platform.OS === "web" ? (
              <View style={[styles.mapPlaceholder, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                <Feather name="map" size={32} color={colors.textMuted} />
                <Text style={[styles.mapPlaceholderText, { color: colors.textMuted, fontFamily: "Inter_500Medium" }]}>
                  Mapa disponível no app mobile
                </Text>
              </View>
            ) : (
              <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                initialRegion={initialRegion}
                showsUserLocation
                showsMyLocationButton={false}
              >
                {coletaCoords && (
                  <Marker coordinate={coletaCoords} title="Coleta" pinColor="#10B981" />
                )}
                {entregaCoords && (
                  <Marker coordinate={entregaCoords} title="Entrega" pinColor={MOD_COLOR} />
                )}
                {routeCoords.length > 1 && (
                  <Polyline coordinates={routeCoords} strokeWidth={4} strokeColor={MOD_COLOR} />
                )}
              </MapView>
            )}
            {carregandoLocal && (
              <View style={styles.mapBadge}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.mapBadgeText}>Buscando sua localização…</Text>
              </View>
            )}
          </View>

          <View style={{ padding: 16, gap: 12 }}>
            {/* Endereco coleta */}
            <View>
              <Text style={[styles.fieldLabel, { color: colors.text, fontFamily: "Inter_500Medium" }]}>Endereço de coleta *</Text>
              <View style={[styles.inputGroup, { borderColor: "#10B981", backgroundColor: colors.backgroundSecondary }]}>
                <Feather name="circle" size={16} color="#10B981" />
                <TextInput
                  style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]}
                  placeholder="Onde o entregador vai buscar"
                  placeholderTextColor={colors.textMuted}
                  value={form.endereco_coleta}
                  onChangeText={v => {
                    setForm(p => ({ ...p, endereco_coleta: v }));
                    setColetaCoords(null);
                    geocodeColeta(v);
                  }}
                />
              </View>
              <Pressable
                onPress={async () => {
                  setCarregandoLocal(true);
                  try {
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    if (status !== "granted") { Alert.alert("Permissão", "Ative a localização."); return; }
                    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
                    const c = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
                    setColetaCoords(c);
                    try {
                      const places = await Location.reverseGeocodeAsync(c);
                      const p = places?.[0];
                      if (p) {
                        const partes = [
                          p.street ? `${p.street}${p.streetNumber ? `, ${p.streetNumber}` : ""}` : null,
                          p.district || p.subregion, p.city, p.region,
                        ].filter(Boolean);
                        const endereco = partes.join(", ");
                        if (endereco) setForm(prev => ({ ...prev, endereco_coleta: endereco }));
                      }
                    } catch {}
                  } finally { setCarregandoLocal(false); }
                }}
                style={styles.gpsBtn}
              >
                <Feather name="crosshair" size={13} color={MOD_COLOR} />
                <Text style={[styles.gpsBtnText, { color: MOD_COLOR, fontFamily: "Inter_500Medium" }]}>Usar minha localização</Text>
              </Pressable>
            </View>

            {/* Endereco entrega + autocomplete */}
            <View>
              <Text style={[styles.fieldLabel, { color: colors.text, fontFamily: "Inter_500Medium" }]}>Endereço de entrega *</Text>
              <View style={[styles.inputGroup, { borderColor: MOD_COLOR, backgroundColor: colors.backgroundSecondary }]}>
                <Feather name="map-pin" size={16} color={MOD_COLOR} />
                <TextInput
                  style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]}
                  placeholder="Digite o endereço de destino"
                  placeholderTextColor={colors.textMuted}
                  value={form.endereco_entrega}
                  onChangeText={v => {
                    setForm(p => ({ ...p, endereco_entrega: v }));
                    setEntregaCoords(null);
                    setShowSugestoes(true);
                    buscarSugestoes(v);
                  }}
                  onFocus={() => setShowSugestoes(true)}
                />
                {buscandoSugestoes && <ActivityIndicator size="small" color={colors.textMuted} />}
              </View>

              {showSugestoes && sugestoesEntrega.length > 0 && (
                <View style={[styles.sugestoesBox, { borderColor: colors.border, backgroundColor: colors.card ?? colors.backgroundSecondary }]}>
                  {sugestoesEntrega.slice(0, 5).map((s) => (
                    <Pressable key={s.placeId} style={styles.sugestaoItem} onPress={() => escolherSugestao(s)}>
                      <Feather name="map-pin" size={14} color={MOD_COLOR} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.sugestaoMain, { color: colors.text, fontFamily: "Inter_500Medium" }]} numberOfLines={1}>{s.mainText}</Text>
                        <Text style={[styles.sugestaoSec, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>{s.secondaryText}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Categoria selector */}
            <View>
              <Text style={[styles.fieldLabel, { color: colors.text, fontFamily: "Inter_500Medium", marginTop: 4 }]}>Categoria da entrega</Text>
              <View style={{ gap: 8 }}>
                {CATEGORIAS.map(cat => {
                  const ativo = categoria === cat.slug;
                  const t = taxas[cat.slug] ?? DEFAULT_TAXAS[cat.slug];
                  return (
                    <Pressable
                      key={cat.slug}
                      onPress={() => setCategoria(cat.slug)}
                      style={[
                        styles.catCard,
                        { borderColor: ativo ? MOD_COLOR : colors.border, backgroundColor: ativo ? MOD_COLOR + "12" : colors.backgroundSecondary },
                      ]}
                    >
                      <View style={[styles.catIcon, { backgroundColor: ativo ? MOD_COLOR : colors.border + "60" }]}>
                        <Feather name={cat.icon} size={16} color={ativo ? "#fff" : colors.textMuted} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.catName, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{cat.label}</Text>
                        <Text style={[styles.catDesc, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>{cat.desc}</Text>
                        <Text style={[styles.catRate, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                          R$ {t.taxa_minima.toFixed(2).replace(".", ",")} até {t.distancia_km}km · +R$ {t.taxa_km.toFixed(2).replace(".", ",")}/km
                        </Text>
                      </View>
                      {ativo && <Feather name="check-circle" size={20} color={MOD_COLOR} />}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Price summary */}
            <View style={[styles.precoCard, { borderColor: MOD_COLOR + "40", backgroundColor: MOD_COLOR + "10" }]}>
              {carregandoRota ? (
                <View style={styles.precoRow}>
                  <ActivityIndicator size="small" color={MOD_COLOR} />
                  <Text style={[styles.precoCalc, { color: colors.textMuted, fontFamily: "Inter_500Medium" }]}>Calculando rota…</Text>
                </View>
              ) : distanciaKm > 0 ? (
                <>
                  <View style={styles.precoRow}>
                    <Feather name="navigation-2" size={16} color={MOD_COLOR} />
                    <Text style={[styles.precoLabel, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Distância</Text>
                    <Text style={[styles.precoVal, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>
                      {distanciaKm.toFixed(1).replace(".", ",")} km
                    </Text>
                  </View>
                  <View style={[styles.precoDiv, { backgroundColor: MOD_COLOR + "30" }]} />
                  <View style={styles.precoRow}>
                    <Feather name="dollar-sign" size={18} color={MOD_COLOR} />
                    <Text style={[styles.precoLabel, { color: colors.text, fontFamily: "Inter_500Medium" }]}>Valor total</Text>
                    <Text style={[styles.precoTotal, { color: MOD_COLOR, fontFamily: "Inter_700Bold" }]}>
                      R$ {valorEstimado.toFixed(2).replace(".", ",")}
                    </Text>
                  </View>
                </>
              ) : (
                <View style={styles.precoRow}>
                  <Feather name="info" size={16} color={MOD_COLOR} />
                  <Text style={[styles.precoCalc, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                    Selecione o endereço de entrega para calcular o valor
                  </Text>
                </View>
              )}
            </View>

            {/* Contact info */}
            {[
              { key: "remetente_nome", label: "Seu nome *", icon: "user" as const, placeholder: "Nome do remetente" },
              { key: "remetente_telefone", label: "Seu telefone", icon: "phone" as const, placeholder: "(00) 00000-0000" },
              { key: "destinatario_nome", label: "Nome do destinatário", icon: "user" as const, placeholder: "Quem vai receber" },
              { key: "destinatario_telefone", label: "Telefone do destinatário", icon: "phone" as const, placeholder: "(00) 00000-0000" },
              { key: "descricao_pacote", label: "Descrição do pacote", icon: "box" as const, placeholder: "O que será entregue?" },
            ].map(field => (
              <View key={field.key}>
                <Text style={[styles.fieldLabel, { color: colors.text, fontFamily: "Inter_500Medium" }]}>{field.label}</Text>
                <View style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
                  <Feather name={field.icon} size={16} color={colors.textMuted} />
                  <TextInput
                    style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]}
                    placeholder={field.placeholder}
                    placeholderTextColor={colors.textMuted}
                    value={(form as any)[field.key]}
                    onChangeText={v => setForm(p => ({ ...p, [field.key]: v }))}
                  />
                </View>
              </View>
            ))}

            <View style={{ marginTop: 8 }}>
              <Text style={[styles.fieldLabel, { color: colors.text, fontFamily: "Inter_500Medium" }]}>Pagamento</Text>
              <View style={styles.paymentChoices}>
                {([
                  ...(paymentOptions.receber_direto ? [
                    { id: "dinheiro", label: "Dinheiro" },
                    { id: "pix_direto", label: "Pix direto" },
                    { id: "maquininha", label: "Maquininha" },
                  ] : []),
                  ...(paymentOptions.mercado_pago ? [{ id: "pix_app", label: "Pix pelo app" }] : []),
                  ...(paymentOptions.mercado_pago && savedCard ? [{ id: "card_app", label: `Cartão •••• ${savedCard.lastFour}` }] : []),
                  ...(paymentOptions.carteira ? [{ id: "wallet", label: "Carteira" }] : []),
                ] as { id: PaymentChoice; label: string }[]).map(option => (
                  <Pressable
                    key={option.id}
                    onPress={() => setFormaPagamento(option.id)}
                    style={[styles.paymentChoice, { borderColor: formaPagamento === option.id ? MOD_COLOR : colors.border, backgroundColor: formaPagamento === option.id ? MOD_COLOR + "18" : colors.backgroundSecondary }]}
                  >
                    <Feather name={option.id === "wallet" || option.id === "card_app" ? "credit-card" : option.id.includes("pix") ? "smartphone" : "dollar-sign"} size={15} color={formaPagamento === option.id ? MOD_COLOR : colors.textMuted} />
                    <Text style={[styles.paymentChoiceText, { color: formaPagamento === option.id ? MOD_COLOR : colors.text, fontFamily: "Inter_500Medium" }]}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Pressable
              style={[styles.submitBtn, { backgroundColor: MOD_COLOR, opacity: enviando || valorEstimado <= 0 || !pagamentoDisponivel ? 0.6 : 1 }]}
              onPress={() => requireAuth(() => solicitar())}
              disabled={enviando || valorEstimado <= 0 || !pagamentoDisponivel}
            >
              {enviando
                ? <ActivityIndicator color="#fff" size="small" />
                : <><Feather name="send" size={18} color="#fff" /><Text style={[styles.submitText, { fontFamily: "Inter_700Bold" }]}>Solicitar Entrega</Text></>
              }
            </Pressable>
          </View>
        </ScrollView>
      )}

      <SegmentoBottomNav
        ativo="inicio"
        corAtivo={MOD_COLOR}
        onInicio={() => {
          setView("inicio");
          setEncomenda(null);
          setCodigo("");
          setErro("");
          clearServicePayment();
        }}
        onCarrinho={() => setView("rastrear")}
        onFinalizar={() => setView("solicitar")}
        empresaId={empresaId ? Number(empresaId) : null}
      />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 16, justifyContent: "space-between" },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, flex: 1, textAlign: "center" },
  welcomeTitle: { fontSize: 22, marginBottom: 6 },
  welcomeSub: { fontSize: 14, marginBottom: 24, lineHeight: 20 },
  activePaymentHeader: { borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  activePaymentEyebrow: { color: "rgba(255,255,255,0.8)", fontSize: 12 },
  activePaymentTitle: { color: "#fff", fontSize: 18, marginTop: 2 },
  activePaymentValue: { color: "#fff", fontSize: 15 },
  pixPaymentCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  pixPaymentTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pixPaymentCardTitle: { fontSize: 16 },
  pixPaymentHint: { fontSize: 13, lineHeight: 19 },
  pixPaymentCode: { fontSize: 11, lineHeight: 16 },
  pixCopyButton: { minHeight: 46, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  pixCopyButtonText: { color: "#fff", fontSize: 14 },
  pixWaitingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  paidInfoCard: { borderWidth: 1, borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", gap: 10 },
  paidInfoText: { flex: 1, fontSize: 14, lineHeight: 20 },
  actionCard: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14 },
  actionIcon: { width: 54, height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  actionTitle: { fontSize: 16, marginBottom: 4 },
  actionSub: { fontSize: 13, lineHeight: 18 },
  infoCard: { flexDirection: "row", gap: 10, alignItems: "flex-start", borderRadius: 12, borderWidth: 1, padding: 14, marginTop: 8 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },
  sectionLabel: { fontSize: 14, lineHeight: 20 },
  searchRow: { flexDirection: "row" },
  inputGroup: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 50, gap: 10 },
  input: { flex: 1, fontSize: 15 },
  paymentSummary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13 },
  paymentSummaryInfo: { flexDirection: "row", alignItems: "center", gap: 9 },
  paymentSummaryText: { fontSize: 14 },
  paymentChangeText: { fontSize: 14 },
  paymentChoices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  paymentChoice: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 9 },
  paymentChoiceText: { fontSize: 13 },
  buscaBtn: { width: 50, height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  erroCard: { flexDirection: "row", gap: 8, alignItems: "center", borderRadius: 10, borderWidth: 1, padding: 12, marginTop: 14 },
  erroText: { flex: 1, fontSize: 13, color: "#EF4444" },
  statusBanner: { borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 12 },
  statusBannerCode: { fontSize: 12, marginBottom: 2 },
  statusBannerLabel: { fontSize: 17 },
  statusBannerEmp: { fontSize: 11, textAlign: "right" },
  previsaoCard: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 12 },
  previsaoText: { fontSize: 14 },
  timelineCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 12 },
  timelineTitle: { fontSize: 16, marginBottom: 16 },
  timelineItem: { flexDirection: "row", gap: 14 },
  timelineLeft: { alignItems: "center", width: 20 },
  timelineDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  timelineLine: { width: 2, flex: 1, minHeight: 24, marginVertical: 4 },
  timelineContent: { flex: 1, paddingBottom: 20 },
  timelineEvento: { fontSize: 14, marginBottom: 2 },
  timelineHora: { fontSize: 12 },
  emptyText: { fontSize: 14, textAlign: "center", paddingVertical: 12 },
  detalhesCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 14, marginBottom: 12 },
  detalhesTitle: { fontSize: 16, marginBottom: 4 },
  detalheItem: { flexDirection: "row", gap: 12 },
  detalheLabel: { fontSize: 11, marginBottom: 2 },
  detalheVal: { fontSize: 14 },
  novaBuscaBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, marginTop: 4 },
  novaBuscaText: { fontSize: 15 },
  fieldLabel: { fontSize: 13, marginBottom: 6 },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 14, paddingVertical: 16, marginTop: 8 },
  submitText: { color: "#fff", fontSize: 16 },
  // Map
  mapWrap: { height: 240, position: "relative" },
  map: { ...StyleSheet.absoluteFillObject },
  mapPlaceholder: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", borderWidth: 1, gap: 8 },
  mapPlaceholderText: { fontSize: 13 },
  mapBadge: { position: "absolute", top: 12, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  mapBadgeText: { color: "#fff", fontSize: 12, fontWeight: "500" },
  // GPS button under coleta
  gpsBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 6, paddingVertical: 4 },
  gpsBtnText: { fontSize: 12 },
  // Suggestions dropdown
  sugestoesBox: { marginTop: 4, borderWidth: 1, borderRadius: 10, overflow: "hidden" },
  sugestaoItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#00000010" },
  sugestaoMain: { fontSize: 14 },
  sugestaoSec: { fontSize: 11, marginTop: 1 },
  // Categoria cards
  catCard: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderRadius: 14, padding: 12 },
  catIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  catName: { fontSize: 14, marginBottom: 2 },
  catDesc: { fontSize: 12, marginBottom: 2 },
  catRate: { fontSize: 11 },
  // Preço card
  precoCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  precoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  precoLabel: { fontSize: 13, flex: 1 },
  precoVal: { fontSize: 14 },
  precoTotal: { fontSize: 20 },
  precoCalc: { fontSize: 13, flex: 1 },
  precoDiv: { height: 1, marginVertical: 2 },
});
