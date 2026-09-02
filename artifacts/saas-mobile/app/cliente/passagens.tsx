import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, useColorScheme,
  Platform, TextInput, ActivityIndicator, Alert, Clipboard, Modal,
} from "react-native";
import SegmentoBottomNav, { SEGMENTO_NAV_HEIGHT } from "@/components/SegmentoBottomNav";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import Colors from "@/constants/colors";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { useAuthGate } from "@/components/AuthGate";
import PaymentSelector from "@/components/PaymentSelector";
import { getWallet, checkoutPayment } from "@/api/payments";
import * as Linking from "expo-linking";

const MOD_COLOR = Colors.modules.passagens;

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "http://localhost:8080/api";

type Rota = {
  id: number;
  origem: string;
  destino: string;
  tipo: string;
  empresa_id: number;
  empresa_nome: string;
  preco_min: number;
  preco_max: number;
  vagas_disponiveis: number;
  total_horarios: number;
};

type Horario = {
  id: number;
  rota_id: number;
  data_partida: string;
  hora_partida: string;
  hora_chegada: string;
  vagas_total: number;
  vagas_livres: number;
  preco: number;
  veiculo: string;
  origem: string;
  destino: string;
  empresa_nome: string;
  empresa_id: number;
};

type Passagem = {
  id: number;
  codigo: string;
  status: string;
  valor: number;
  forma_pagamento: string;
  origem: string;
  destino: string;
  data_partida: string;
  hora_partida: string;
  hora_chegada: string;
  empresa_nome: string;
  passageiro_nome: string;
  assento: string;
  vendido_em: string;
};

type PixInfo = {
  chave_pix: string;
  tipo_chave_pix: string;
  beneficiario: string;
};

type Tab = "busca" | "minhas" | "compartilhada";

type Carona = {
  id: number;
  origem: string;
  destino: string;
  distancia_km: number | null;
  data_viagem: string;
  hora_partida: string;
  vagas_total: number;
  vagas_ocupadas: number;
  valor_por_vaga: number;
  empresa_nome: string;
  empresa_id: number;
  veiculo_modelo: string | null;
  veiculo_cor: string | null;
  observacoes: string | null;
};
type Step = "busca" | "rotas" | "horarios" | "pagamento" | "confirmado";

const TIPO_LABEL: Record<string, string> = {
  onibus: "🚌 Ônibus", van: "🚐 Van", aviao: "✈️ Avião", barco: "🚢 Barco",
};

const MESES_P = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const MESES_L = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const DIAS_P  = ["dom","seg","ter","qua","qui","sex","sáb"];

function formatDate(d: string) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt.getTime())) return "";
  return `${dt.getDate().toString().padStart(2,"0")} ${MESES_P[dt.getMonth()]}`;
}

function formatDateLong(d: string) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt.getTime())) return "";
  return `${DIAS_P[dt.getDay()]}, ${dt.getDate().toString().padStart(2,"0")} de ${MESES_L[dt.getMonth()]}`;
}

function StatusBadge({ status, colors }: { status: string; colors: any }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    confirmado:  { bg: "#10B98120", text: "#10B981", label: "Confirmado" },
    pendente:    { bg: "#F59E0B20", text: "#F59E0B", label: "Pendente" },
    cancelado:   { bg: "#EF444420", text: "#EF4444", label: "Cancelado" },
    embarcado:   { bg: "#3B82F620", text: "#3B82F6", label: "Embarcado" },
  };
  const s = map[status] ?? { bg: "#64748B20", text: "#64748B", label: status };
  return (
    <View style={{ backgroundColor: s.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: "flex-start" }}>
      <Text style={{ fontSize: 11, color: s.text, fontFamily: "Inter_600SemiBold" }}>{s.label}</Text>
    </View>
  );
}

export default function ClientePassagens() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const { customer, isLoggedIn } = useCustomerAuth();
  const { requireAuth } = useAuthGate("/cliente/passagens");
  const params = useLocalSearchParams<{ empresaId?: string; nomeEmpresa?: string; corEmpresa?: string }>();
  const empresaId = params.empresaId ? Number(params.empresaId) : null;
  const nomeEmpresa = params.nomeEmpresa ?? null;

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  // ── Tab ────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>("busca");

  // ── Busca state ────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("busca");
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [loading, setLoading] = useState(false);
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [rotaSel, setRotaSel] = useState<Rota | null>(null);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [horarioSel, setHorarioSel] = useState<Horario | null>(null);
  const [assento, setAssento] = useState("");
  const [passageiroNome, setPassageiroNome] = useState(customer?.nome ?? "");
  const [passageiroCpf, setPassageiroCpf] = useState("");
  const [formaPag, setFormaPag] = useState<string>("pix");
  const [paymentSource, setPaymentSource] = useState<"direto" | "mercado_pago" | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    if (customer?.token) {
      getWallet(customer.token).then(d => setWalletBalance(d.balanceCents)).catch(() => {});
    }
  }, [customer?.token]);

  const [pixInfo, setPixInfo] = useState<PixInfo | null>(null);
  const [pixCopiado, setPixCopiado] = useState(false);
  const [confirmadoId, setConfirmadoId] = useState<{ id: number; codigo: string } | null>(null);
  const [comprando, setComprando] = useState(false);
  const [erroCompra, setErroCompra] = useState("");

  // ── Minhas passagens ───────────────────────────────────────────────────────
  const [minhas, setMinhas] = useState<Passagem[]>([]);
  const [loadingMinhas, setLoadingMinhas] = useState(false);
  const [passagemDetalhe, setPassagemDetalhe] = useState<Passagem | null>(null);
  const [cancelando, setCancelando] = useState(false);

  // ── Caronas (viagens compartilhadas) ───────────────────────────────────────
  const [caronas, setCaronas] = useState<Carona[]>([]);
  const [loadingCaronas, setLoadingCaronas] = useState(false);
  const [caronaFiltroOrigem, setCaronaFiltroOrigem] = useState("");
  const [caronaFiltroDestino, setCaronaFiltroDestino] = useState("");
  const [caronaSel, setCaronaSel] = useState<Carona | null>(null);
  const [reservaNome, setReservaNome] = useState(customer?.nome ?? "");
  const [reservaTelefone, setReservaTelefone] = useState("");
  const [reservaCpf, setReservaCpf] = useState("");
  const [reservando, setReservando] = useState(false);
  const [reservaConfirmada, setReservaConfirmada] = useState<{ id: number; valor: number } | null>(null);

  const fetchCaronas = useCallback(async () => {
    setLoadingCaronas(true);
    try {
      const sp = new URLSearchParams();
      if (caronaFiltroOrigem.trim()) sp.set("origem", caronaFiltroOrigem.trim());
      if (caronaFiltroDestino.trim()) sp.set("destino", caronaFiltroDestino.trim());
      const r = await fetch(`${API_BASE}/public/caronas${sp.toString() ? `?${sp}` : ""}`);
      if (r.ok) setCaronas(await r.json());
    } catch {}
    setLoadingCaronas(false);
  }, [caronaFiltroOrigem, caronaFiltroDestino]);

  useEffect(() => {
    if (activeTab === "compartilhada") fetchCaronas();
  }, [activeTab]);

  const reservarCarona = async () => {
    if (!caronaSel) return;
    if (!reservaNome.trim()) { Alert.alert("Informe seu nome"); return; }
    if (!reservaTelefone.replace(/\D/g, "")) { Alert.alert("Informe seu telefone"); return; }
    setReservando(true);
    try {
      const r = await fetch(`${API_BASE}/public/caronas/${caronaSel.id}/reservas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passageiro_nome: reservaNome.trim(),
          passageiro_telefone: reservaTelefone.replace(/\D/g, ""),
          passageiro_cpf: reservaCpf.replace(/\D/g, ""),
          valor: caronaSel.valor_por_vaga,
          forma_pagamento: "pix",
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        Alert.alert("Não foi possível reservar", data?.error || "Tente novamente.");
        return;
      }
      setReservaConfirmada({ id: data.id, valor: Number(data.valor ?? caronaSel.valor_por_vaga) });
      fetchCaronas();
    } catch (e: any) {
      Alert.alert("Erro de conexão", e?.message || "Tente novamente.");
    } finally {
      setReservando(false);
    }
  };

  // ── Fetch minhas passagens ─────────────────────────────────────────────────
  const fetchMinhas = useCallback(async () => {
    if (!isLoggedIn || !customer?.token) return;
    setLoadingMinhas(true);
    try {
      const r = await fetch(`${API_BASE}/cliente/passagens`, {
        headers: { Authorization: `Bearer ${customer.token}` },
      });
      if (r.ok) setMinhas(await r.json());
    } catch {}
    setLoadingMinhas(false);
  }, [isLoggedIn, customer?.token]);

  useEffect(() => {
    if (activeTab === "minhas") fetchMinhas();
  }, [activeTab]);

  // ── Buscar rotas ───────────────────────────────────────────────────────────
  const handleBuscar = async () => {
    if (!destino.trim() && !empresaId) return;
    setLoading(true);
    try {
      const searchParams = new URLSearchParams();
      if (origem.trim()) searchParams.set("origem", origem.trim());
      if (destino.trim()) searchParams.set("destino", destino.trim());
      if (empresaId) searchParams.set("empresa_id", String(empresaId));
      const r = await fetch(`${API_BASE}/public/viagens/rotas?${searchParams}`);
      const data = r.ok ? await r.json() : [];
      setRotas(data);
      setStep("rotas");
    } catch {
      setRotas([]);
      setStep("rotas");
    }
    setLoading(false);
  };

  // Carregar rotas automaticamente quando vier de uma empresa específica
  useEffect(() => {
    if (empresaId && step === "busca") {
      handleBuscar();
    }
  }, [empresaId]);

  // ── Buscar horarios ────────────────────────────────────────────────────────
  const handleSelecionarRota = async (rota: Rota) => {
    setRotaSel(rota);
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/public/viagens/horarios?rota_id=${rota.id}`);
      const data = r.ok ? await r.json() : [];
      setHorarios(data);
    } catch { setHorarios([]); }
    setLoading(false);
    setStep("horarios");
  };

  // ── Fetch PIX of empresa ───────────────────────────────────────────────────
  const fetchPixEmpresa = async (empresaId: number) => {
    try {
      const r = await fetch(`${API_BASE}/public/empresa/${empresaId}/pix`);
      if (r.ok) setPixInfo(await r.json());
      else setPixInfo(null);
    } catch { setPixInfo(null); }
  };

  const handleSelecionarHorario = async (h: Horario) => {
    setHorarioSel(h);
    setAssento("");
    setErroCompra("");
    await fetchPixEmpresa(h.empresa_id);
    setStep("pagamento");
  };

  // ── Comprar passagem ───────────────────────────────────────────────────────
  const handleComprar = async () => {
    if (!assento.trim()) { setErroCompra("Informe o número do assento"); return; }
    if (!passageiroNome.trim()) { setErroCompra("Informe o nome do passageiro"); return; }
    if (!isLoggedIn || !customer?.token) {
      Alert.alert("Login necessário", "Faça login para comprar uma passagem.", [
        { text: "Cancelar", style: "cancel" },
        { text: "Entrar", onPress: () => router.push("/cliente/cadastro" as any) },
      ]);
      return;
    }
    setComprando(true);
    setErroCompra("");
    try {
      const r = await fetch(`${API_BASE}/cliente/passagens`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${customer.token}` },
        body: JSON.stringify({
          horario_id: horarioSel!.id,
          assento: assento.trim(),
          valor: horarioSel!.preco,
          forma_pagamento: formaPag,
          passageiro_nome: passageiroNome.trim(),
          passageiro_cpf: passageiroCpf.replace(/\D/g, ""),
        }),
      });
      if (r.ok) {
        const data = await r.json();
        
        if (paymentSource === "mercado_pago") {
          try {
            const checkout = await checkoutPayment(customer?.token || "", {
              module: "passagens",
              referenceId: data.id,
              paymentSource: "mercado_pago",
              mercadoPagoMethod: formaPag as any
            });
            if (checkout.sandboxInitPoint) {
              Linking.openURL(checkout.sandboxInitPoint);
            } else if (checkout.initPoint) {
              Linking.openURL(checkout.initPoint);
            }
          } catch (e: any) {
            Alert.alert("Aviso", "Passagem comprada, mas falha ao iniciar o Mercado Pago.");
          }
        }
        
        setConfirmadoId({ id: data.id, codigo: data.codigo });
        setStep("confirmado");
      } else {
        const err = await r.json();
        setErroCompra(err.error || "Erro ao comprar passagem.");
      }
    } catch {
      setErroCompra("Erro de conexão. Tente novamente.");
    }
    setComprando(false);
  };

  // ── Cancelar passagem ──────────────────────────────────────────────────────
  const handleCancelar = (p: Passagem) => {
    Alert.alert(
      "Cancelar passagem",
      `Deseja cancelar a passagem ${p.codigo}?\nEsta ação não pode ser desfeita.`,
      [
        { text: "Não", style: "cancel" },
        {
          text: "Sim, cancelar", style: "destructive",
          onPress: async () => {
            if (!customer?.token) return;
            setCancelando(true);
            try {
              const r = await fetch(`${API_BASE}/cliente/passagens/${p.id}/cancelar`, {
                method: "PUT",
                headers: { Authorization: `Bearer ${customer.token}` },
              });
              if (r.ok) {
                setPassagemDetalhe(null);
                fetchMinhas();
              } else {
                Alert.alert("Erro", "Não foi possível cancelar. Tente novamente.");
              }
            } catch {
              Alert.alert("Erro", "Falha de conexão. Tente novamente.");
            }
            setCancelando(false);
          },
        },
      ]
    );
  };

  // ── Reset ──────────────────────────────────────────────────────────────────
  const resetBusca = () => {
    setStep("busca");
    setRotas([]); setRotaSel(null);
    setHorarios([]); setHorarioSel(null);
    setAssento(""); setConfirmadoId(null); setErroCompra("");
    setPixInfo(null);
  };

  const goBack = () => {
    if (step === "rotas") { setStep("busca"); setRotaSel(null); }
    else if (step === "horarios") { setStep("rotas"); setHorarioSel(null); }
    else if (step === "pagamento") { setStep("horarios"); }
    else if (step === "confirmado") resetBusca();
    else router.back();
  };

  const titles: Record<Step, string> = {
    busca: "Comprar Passagem", rotas: "Rotas disponíveis",
    horarios: "Escolher horário", pagamento: "Pagamento", confirmado: "Passagem confirmada",
  };

  // ── TELA CONFIRMADO ────────────────────────────────────────────────────────
  if (step === "confirmado" && confirmadoId) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: MOD_COLOR }]}>
          <View style={{ width: 30 }} />
          <Text style={[styles.headerTitle, { fontFamily: "Inter_700Bold", color: "#fff" }]}>Passagem confirmada</Text>
          <View style={{ width: 30 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + SEGMENTO_NAV_HEIGHT + 24, alignItems: "center" }}>
          <View style={[styles.ticketCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.ticketTop, { backgroundColor: MOD_COLOR }]}>
              <Feather name="check-circle" size={40} color="#fff" />
              <Text style={[styles.ticketOk, { fontFamily: "Inter_700Bold", color: "#fff" }]}>Passagem Emitida!</Text>
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontFamily: "Inter_400Regular" }}>
                {confirmadoId.codigo}
              </Text>
            </View>
            <View style={styles.ticketBody}>
              <View style={styles.ticketRoute}>
                <View style={styles.ticketCity}>
                  <Text style={[styles.cityLabel, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Saída</Text>
                  <Text style={[styles.cityName, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{horarioSel?.origem.split(" ")[0]}</Text>
                  <Text style={[styles.cityHora, { color: MOD_COLOR, fontFamily: "Inter_600SemiBold" }]}>{horarioSel?.hora_partida?.slice(0,5)}</Text>
                </View>
                <Feather name="arrow-right" size={24} color={MOD_COLOR} />
                <View style={styles.ticketCity}>
                  <Text style={[styles.cityLabel, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Chegada</Text>
                  <Text style={[styles.cityName, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{horarioSel?.destino.split(" ")[0]}</Text>
                  <Text style={[styles.cityHora, { color: MOD_COLOR, fontFamily: "Inter_600SemiBold" }]}>{horarioSel?.hora_chegada?.slice(0,5)}</Text>
                </View>
              </View>
              <View style={[styles.ticketDivider, { backgroundColor: colors.border }]} />
              <View style={styles.ticketInfoRow}>
                <View style={styles.ticketInfo}>
                  <Text style={[styles.infoLabel, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Data</Text>
                  <Text style={[styles.infoVal, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{formatDate(horarioSel?.data_partida ?? "")}</Text>
                </View>
                <View style={styles.ticketInfo}>
                  <Text style={[styles.infoLabel, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Assento</Text>
                  <Text style={[styles.infoVal, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{assento}</Text>
                </View>
                <View style={styles.ticketInfo}>
                  <Text style={[styles.infoLabel, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Empresa</Text>
                  <Text style={[styles.infoVal, { color: colors.text, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>{horarioSel?.empresa_nome}</Text>
                </View>
              </View>
              <View style={[styles.ticketTotal, { backgroundColor: MOD_COLOR + "15" }]}>
                <Text style={[styles.totalLabel, { color: MOD_COLOR, fontFamily: "Inter_600SemiBold" }]}>Valor</Text>
                <Text style={[styles.totalVal, { color: MOD_COLOR, fontFamily: "Inter_700Bold" }]}>R$ {Number(horarioSel?.preco ?? 0).toFixed(2)}</Text>
              </View>
            </View>
          </View>

          <Pressable style={[styles.novaBtn, { backgroundColor: MOD_COLOR }]} onPress={() => { resetBusca(); setActiveTab("minhas"); }}>
            <Feather name="list" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 }}>Ver minhas passagens</Text>
          </Pressable>
          <Pressable style={[styles.novaBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginTop: 8 }]} onPress={resetBusca}>
            <Feather name="plus" size={18} color={colors.text} />
            <Text style={{ color: colors.text, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Nova compra</Text>
          </Pressable>
        </ScrollView>
        <SegmentoBottomNav ativo="finalizar" corAtivo={MOD_COLOR} onInicio={resetBusca} onCarrinho={() => {}} onFinalizar={() => {}} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: MOD_COLOR }]}>
        <Pressable onPress={activeTab === "busca" ? goBack : () => setActiveTab("busca")} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={[styles.headerTitle, { fontFamily: "Inter_700Bold", color: "#fff" }]}>
            {activeTab === "minhas" ? "Minhas Passagens" : titles[step]}
          </Text>
          {nomeEmpresa && activeTab === "busca" && (
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 }}>
              {nomeEmpresa}
            </Text>
          )}
        </View>
        <View style={{ width: 30 }} />
      </View>

      {/* TABS */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {(["busca", "compartilhada", "minhas"] as Tab[]).map(t => {
          const tabIcon = t === "busca" ? "search" : t === "compartilhada" ? "users" : "bookmark";
          const tabLabel = t === "busca" ? "Buscar" : t === "compartilhada" ? "Compartilhada" : "Minhas";
          return (
            <Pressable
              key={t}
              style={[styles.tabBtn, activeTab === t && { borderBottomColor: MOD_COLOR, borderBottomWidth: 2 }]}
              onPress={() => { setActiveTab(t); if (t === "busca") resetBusca(); if (t === "compartilhada") { setCaronaSel(null); setReservaConfirmada(null); } }}
            >
              <Feather name={tabIcon as any} size={15} color={activeTab === t ? MOD_COLOR : colors.textMuted} />
              <Text style={[styles.tabLabel, { color: activeTab === t ? MOD_COLOR : colors.textMuted, fontFamily: activeTab === t ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
                {tabLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── COMPARTILHADA (BlaBlaCar) ── */}
      {activeTab === "compartilhada" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + SEGMENTO_NAV_HEIGHT + 16 }}>
          {/* Sucesso da reserva */}
          {reservaConfirmada ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border, padding: 24 }]}>
              <Feather name="check-circle" size={48} color="#10B981" />
              <Text style={[{ color: colors.text, fontFamily: "Inter_700Bold", fontSize: 18, marginTop: 12 }]}>Reserva confirmada!</Text>
              <Text style={[{ color: colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center", marginTop: 6 }]}>
                Sua vaga na viagem {caronaSel?.origem?.split(",")[0]} → {caronaSel?.destino?.split(",")[0]} foi reservada por R$ {Number(reservaConfirmada.valor).toFixed(2)}.
                {"\n\n"}O motorista entrará em contato em breve.
              </Text>
              <Pressable
                style={[styles.emptyBtn, { backgroundColor: MOD_COLOR, marginTop: 16 }]}
                onPress={() => { setReservaConfirmada(null); setCaronaSel(null); fetchCaronas(); }}
              >
                <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }}>Ver outras viagens</Text>
              </Pressable>
            </View>
          ) : caronaSel ? (
            // Detalhe + reserva
            <>
              <Pressable onPress={() => setCaronaSel(null)} style={[styles.backChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="arrow-left" size={14} color={colors.textMuted} />
                <Text style={[{ color: colors.textMuted, fontSize: 13, fontFamily: "Inter_400Regular" }]}>Voltar para a lista</Text>
              </Pressable>

              <View style={[styles.passagemCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 12 }]}>
                <View style={styles.passagemRoute}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.passagemCidade, { color: colors.text, fontFamily: "Inter_700Bold" }]} numberOfLines={1}>{caronaSel.origem}</Text>
                  </View>
                  <Feather name="arrow-right" size={16} color={MOD_COLOR} />
                  <View style={{ flex: 1, alignItems: "flex-end" }}>
                    <Text style={[styles.passagemCidade, { color: colors.text, fontFamily: "Inter_700Bold" }]} numberOfLines={1}>{caronaSel.destino}</Text>
                  </View>
                </View>
                <Text style={[{ color: colors.textMuted, fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 8 }]}>
                  {formatDateLong(caronaSel.data_viagem?.slice(0, 10))} às {String(caronaSel.hora_partida).slice(0, 5)}
                  {caronaSel.distancia_km ? ` • ${caronaSel.distancia_km} km` : ""}
                </Text>
                <Text style={[{ color: colors.textMuted, fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4 }]}>
                  Motorista: {caronaSel.empresa_nome}
                  {caronaSel.veiculo_modelo ? ` • ${caronaSel.veiculo_modelo}${caronaSel.veiculo_cor ? ` (${caronaSel.veiculo_cor})` : ""}` : ""}
                </Text>
                {caronaSel.observacoes ? (
                  <Text style={[{ color: colors.textMuted, fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 6, fontStyle: "italic" }]}>
                    "{caronaSel.observacoes}"
                  </Text>
                ) : null}
                <View style={[styles.passagemFooter, { borderTopColor: colors.border }]}>
                  <Text style={[{ color: colors.textMuted, fontSize: 12, fontFamily: "Inter_400Regular" }]}>
                    {caronaSel.vagas_total - caronaSel.vagas_ocupadas} vaga(s) livre(s)
                  </Text>
                  <Text style={[{ color: MOD_COLOR, fontSize: 18, fontFamily: "Inter_700Bold" }]}>R$ {Number(caronaSel.valor_por_vaga).toFixed(2)}</Text>
                </View>
              </View>

              <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_700Bold", marginTop: 18, marginBottom: 10 }]}>Seus dados</Text>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, marginBottom: 10, fontFamily: "Inter_400Regular" }]}
                placeholder="Nome completo" placeholderTextColor={colors.textMuted}
                value={reservaNome} onChangeText={setReservaNome}
              />
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, marginBottom: 10, fontFamily: "Inter_400Regular" }]}
                placeholder="Telefone com DDD" placeholderTextColor={colors.textMuted}
                value={reservaTelefone} onChangeText={setReservaTelefone} keyboardType="phone-pad"
              />
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, marginBottom: 14, fontFamily: "Inter_400Regular" }]}
                placeholder="CPF (opcional)" placeholderTextColor={colors.textMuted}
                value={reservaCpf} onChangeText={setReservaCpf} keyboardType="number-pad"
              />

              <Pressable
                onPress={reservarCarona} disabled={reservando}
                style={[styles.buscarBtn, { backgroundColor: MOD_COLOR }]}
              >
                {reservando ? <ActivityIndicator color="#fff" /> : (
                  <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 }}>Reservar por R$ {Number(caronaSel.valor_por_vaga).toFixed(2)}</Text>
                )}
              </Pressable>
            </>
          ) : (
            // Lista
            <>
              <View style={[styles.buscaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
                  <View style={[styles.inputDot, { backgroundColor: "#10B981" }]} />
                  <TextInput
                    style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]}
                    placeholder="Origem (opcional)" placeholderTextColor={colors.textMuted}
                    value={caronaFiltroOrigem} onChangeText={setCaronaFiltroOrigem}
                  />
                </View>
                <View style={[styles.swapBtn, { borderColor: colors.border }]}>
                  <Feather name="arrow-down" size={16} color={colors.textMuted} />
                </View>
                <View style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
                  <View style={[styles.inputDot, { backgroundColor: MOD_COLOR }]} />
                  <TextInput
                    style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]}
                    placeholder="Destino (opcional)" placeholderTextColor={colors.textMuted}
                    value={caronaFiltroDestino} onChangeText={setCaronaFiltroDestino}
                  />
                </View>
              </View>

              <Pressable style={[styles.buscarBtn, { backgroundColor: MOD_COLOR, marginTop: 12, marginBottom: 8 }]} onPress={fetchCaronas} disabled={loadingCaronas}>
                {loadingCaronas ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Feather name="refresh-cw" size={18} color="#fff" />
                    <Text style={[styles.buscarBtnText, { color: "#fff", fontFamily: "Inter_700Bold" }]}>Atualizar lista</Text>
                  </>
                )}
              </Pressable>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4, paddingVertical: 10 }}>
                <Feather name="info" size={14} color={MOD_COLOR} />
                <Text style={[{ color: colors.textMuted, fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 }]}>
                  Viagens compartilhadas (estilo BlaBlaCar) — divida o trajeto com outros passageiros e pague uma fração do custo.
                </Text>
              </View>

              {loadingCaronas ? (
                <ActivityIndicator color={MOD_COLOR} style={{ marginTop: 30 }} size="large" />
              ) : caronas.length === 0 ? (
                <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 12 }]}>
                  <Feather name="users" size={36} color={colors.textMuted} />
                  <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                    Nenhuma viagem compartilhada disponível no momento
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_700Bold", marginVertical: 10 }]}>
                    {caronas.length} viage{caronas.length !== 1 ? "ns" : "m"} disponível{caronas.length !== 1 ? "is" : ""}
                  </Text>
                  {caronas.map(c => (
                    <Pressable
                      key={c.id}
                      onPress={() => setCaronaSel(c)}
                      style={[styles.passagemCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <View style={styles.passagemRoute}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.passagemCidade, { color: colors.text, fontFamily: "Inter_700Bold" }]} numberOfLines={1}>{c.origem?.split(",")[0]}</Text>
                          <Text style={[{ color: colors.textMuted, fontSize: 11, fontFamily: "Inter_400Regular" }]}>{String(c.hora_partida).slice(0, 5)}</Text>
                        </View>
                        <Feather name="arrow-right" size={16} color={MOD_COLOR} />
                        <View style={{ flex: 1, alignItems: "flex-end" }}>
                          <Text style={[styles.passagemCidade, { color: colors.text, fontFamily: "Inter_700Bold" }]} numberOfLines={1}>{c.destino?.split(",")[0]}</Text>
                          {c.distancia_km ? <Text style={[{ color: colors.textMuted, fontSize: 11, fontFamily: "Inter_400Regular" }]}>{c.distancia_km} km</Text> : null}
                        </View>
                      </View>
                      <View style={[styles.passagemFooter, { borderTopColor: colors.border }]}>
                        <Text style={[{ color: colors.textMuted, fontSize: 12, fontFamily: "Inter_400Regular" }]}>
                          {formatDate(c.data_viagem?.slice(0, 10))} • {c.vagas_total - c.vagas_ocupadas} vaga(s)
                        </Text>
                        <Text style={[{ color: MOD_COLOR, fontSize: 15, fontFamily: "Inter_700Bold" }]}>R$ {Number(c.valor_por_vaga).toFixed(2)}</Text>
                      </View>
                    </Pressable>
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
      )}

      {/* ── MINHAS PASSAGENS ── */}
      {activeTab === "minhas" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + SEGMENTO_NAV_HEIGHT + 16 }}>
          {!isLoggedIn ? (
            <View style={[styles.loginPrompt, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="user" size={36} color={MOD_COLOR} />
              <Text style={[styles.loginTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Faça login para ver suas passagens</Text>
              <Pressable style={[styles.loginBtn, { backgroundColor: MOD_COLOR }]} onPress={() => router.push("/cliente/cadastro" as any)}>
                <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }}>Entrar na conta</Text>
              </Pressable>
            </View>
          ) : loadingMinhas ? (
            <ActivityIndicator color={MOD_COLOR} style={{ marginTop: 40 }} size="large" />
          ) : minhas.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="inbox" size={36} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                Você ainda não tem passagens
              </Text>
              <Pressable style={[styles.emptyBtn, { backgroundColor: MOD_COLOR }]} onPress={() => setActiveTab("busca")}>
                <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 }}>Comprar passagem</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_700Bold", marginBottom: 12 }]}>
                {minhas.length} passagen{minhas.length !== 1 ? "s" : ""}
              </Text>
              {minhas.map(p => (
                <Pressable
                  key={p.id}
                  onPress={() => setPassagemDetalhe(p)}
                  style={[styles.passagemCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.passagemHeader}>
                    <Text style={[styles.passagemCodigo, { color: MOD_COLOR, fontFamily: "Inter_700Bold" }]}>{p.codigo}</Text>
                    <StatusBadge status={p.status} colors={colors} />
                  </View>
                  <View style={styles.passagemRoute}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.passagemCidade, { color: colors.text, fontFamily: "Inter_700Bold" }]} numberOfLines={1}>{p.origem}</Text>
                      <Text style={[{ color: colors.textMuted, fontSize: 11, fontFamily: "Inter_400Regular" }]}>{p.hora_partida?.slice(0,5)}</Text>
                    </View>
                    <Feather name="arrow-right" size={16} color={MOD_COLOR} />
                    <View style={{ flex: 1, alignItems: "flex-end" }}>
                      <Text style={[styles.passagemCidade, { color: colors.text, fontFamily: "Inter_700Bold" }]} numberOfLines={1}>{p.destino}</Text>
                      <Text style={[{ color: colors.textMuted, fontSize: 11, fontFamily: "Inter_400Regular" }]}>{p.hora_chegada?.slice(0,5)}</Text>
                    </View>
                  </View>
                  <View style={[styles.passagemFooter, { borderTopColor: colors.border }]}>
                    <Text style={[{ color: colors.textMuted, fontSize: 12, fontFamily: "Inter_400Regular" }]}>
                      {formatDateLong(p.data_partida)} · Assento {p.assento}
                    </Text>
                    <Text style={[{ color: MOD_COLOR, fontSize: 15, fontFamily: "Inter_700Bold" }]}>R$ {Number(p.valor).toFixed(2)}</Text>
                  </View>
                </Pressable>
              ))}
            </>
          )}
        </ScrollView>
      )}

      {/* ── BUSCA ── */}
      {activeTab === "busca" && step === "busca" && (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + SEGMENTO_NAV_HEIGHT + 16, gap: 16 }}>
          <View style={[styles.buscaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
              <View style={[styles.inputDot, { backgroundColor: "#10B981" }]} />
              <TextInput style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]} placeholder="Cidade de origem (opcional)" placeholderTextColor={colors.textMuted} value={origem} onChangeText={setOrigem} />
            </View>
            <View style={[styles.swapBtn, { borderColor: colors.border }]}>
              <Feather name="arrow-down" size={16} color={colors.textMuted} />
            </View>
            <View style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
              <View style={[styles.inputDot, { backgroundColor: MOD_COLOR }]} />
              <TextInput style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]} placeholder="Cidade de destino *" placeholderTextColor={colors.textMuted} value={destino} onChangeText={setDestino} />
            </View>
          </View>

          <Pressable style={[styles.buscarBtn, { backgroundColor: destino ? MOD_COLOR : colors.backgroundSecondary }]} onPress={handleBuscar} disabled={!destino || loading}>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Feather name="search" size={20} color={destino ? "#fff" : colors.textMuted} />
                <Text style={[styles.buscarBtnText, { color: destino ? "#fff" : colors.textMuted, fontFamily: "Inter_700Bold" }]}>Buscar passagens</Text>
              </>
            )}
          </Pressable>

          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Destinos populares</Text>
          {["Rio de Janeiro", "Curitiba", "Florianópolis", "Belo Horizonte"].map(dest => (
            <Pressable key={dest} onPress={() => setDestino(dest)} style={[styles.destCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="map-pin" size={16} color={MOD_COLOR} />
              <Text style={[styles.destText, { color: colors.text, fontFamily: "Inter_500Medium" }]}>{dest}</Text>
              <Feather name="chevron-right" size={16} color={colors.textMuted} />
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* ── ROTAS ── */}
      {activeTab === "busca" && step === "rotas" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + SEGMENTO_NAV_HEIGHT + 16 }}>
          <Pressable onPress={() => setStep("busca")} style={[styles.backChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="arrow-left" size={14} color={colors.textMuted} />
            <Text style={[{ color: colors.textMuted, fontSize: 13, fontFamily: "Inter_400Regular" }]}>
              {origem || "Qualquer origem"} → {destino}
            </Text>
          </Pressable>

          {loading ? (
            <ActivityIndicator color={MOD_COLOR} style={{ marginTop: 40 }} size="large" />
          ) : rotas.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 20 }]}>
              <Feather name="map" size={36} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                Nenhuma rota encontrada para esse destino
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_600SemiBold", marginBottom: 12 }]}>
                {rotas.length} rota{rotas.length !== 1 ? "s" : ""} disponível{rotas.length !== 1 ? "is" : ""}
              </Text>
              {rotas.map(rota => (
                <Pressable key={rota.id} onPress={() => handleSelecionarRota(rota)}
                  style={[styles.rotaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.rotaCities}>
                    <Text style={[styles.rotaCidade, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{rota.origem}</Text>
                    <Feather name="arrow-right" size={14} color={MOD_COLOR} style={{ marginHorizontal: 6 }} />
                    <Text style={[styles.rotaCidade, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{rota.destino}</Text>
                  </View>
                  <View style={styles.rotaInfo}>
                    <Text style={[{ color: colors.textMuted, fontSize: 12, fontFamily: "Inter_400Regular" }]}>{rota.empresa_nome}</Text>
                    <Text style={[{ color: colors.textMuted, fontSize: 12, fontFamily: "Inter_400Regular" }]}>{TIPO_LABEL[rota.tipo] ?? rota.tipo}</Text>
                  </View>
                  <View style={styles.rotaFooter}>
                    <View style={[styles.rotaVagas, { backgroundColor: rota.vagas_disponiveis > 0 ? "#10B98120" : "#EF444420" }]}>
                      <Text style={{ fontSize: 11, color: rota.vagas_disponiveis > 0 ? "#10B981" : "#EF4444", fontFamily: "Inter_500Medium" }}>
                        {rota.vagas_disponiveis > 0 ? `${rota.vagas_disponiveis} vagas` : "Sem vagas"}
                      </Text>
                    </View>
                    <Text style={[styles.rotaPreco, { color: MOD_COLOR, fontFamily: "Inter_700Bold" }]}>
                      {rota.preco_min === rota.preco_max
                        ? `R$ ${Number(rota.preco_min).toFixed(2)}`
                        : `R$ ${Number(rota.preco_min).toFixed(2)} – ${Number(rota.preco_max).toFixed(2)}`}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </>
          )}
        </ScrollView>
      )}

      {/* ── HORARIOS ── */}
      {activeTab === "busca" && step === "horarios" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + SEGMENTO_NAV_HEIGHT + 16 }}>
          <Pressable onPress={() => setStep("rotas")} style={[styles.backChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="arrow-left" size={14} color={colors.textMuted} />
            <Text style={[{ color: colors.textMuted, fontSize: 13, fontFamily: "Inter_400Regular" }]}>
              {rotaSel?.origem} → {rotaSel?.destino}
            </Text>
          </Pressable>

          {loading ? (
            <ActivityIndicator color={MOD_COLOR} style={{ marginTop: 40 }} size="large" />
          ) : horarios.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 20 }]}>
              <Feather name="calendar" size={36} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                Sem horários disponíveis para esta rota
              </Text>
            </View>
          ) : (
            horarios.map(h => (
              <Pressable key={h.id} onPress={() => handleSelecionarHorario(h)}
                style={[styles.horarioCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.horarioTopo}>
                  <View>
                    <Text style={[styles.horarioHora, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
                      {h.hora_partida?.slice(0,5)} → {h.hora_chegada?.slice(0,5)}
                    </Text>
                    <Text style={[{ color: colors.textMuted, fontSize: 12, fontFamily: "Inter_400Regular" }]}>
                      {formatDateLong(h.data_partida)} · {h.veiculo || h.empresa_nome}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.horarioPreco, { color: MOD_COLOR, fontFamily: "Inter_700Bold" }]}>R$ {Number(h.preco).toFixed(2)}</Text>
                    <Text style={[{ fontSize: 11, fontFamily: "Inter_400Regular", color: h.vagas_livres <= 3 ? "#EF4444" : "#10B981" }]}>
                      {h.vagas_livres} vaga{h.vagas_livres !== 1 ? "s" : ""}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      {/* ── PAGAMENTO ── */}
      {activeTab === "busca" && step === "pagamento" && horarioSel && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + SEGMENTO_NAV_HEIGHT + 24, gap: 12 }}>
          {/* Resumo do horário */}
          <View style={[styles.resumoCard, { backgroundColor: MOD_COLOR + "18", borderColor: MOD_COLOR + "40" }]}>
            <View style={styles.resumoRow}>
              <Text style={[styles.resumoCidade, { color: MOD_COLOR, fontFamily: "Inter_700Bold" }]}>{horarioSel.origem}</Text>
              <Feather name="arrow-right" size={18} color={MOD_COLOR} />
              <Text style={[styles.resumoCidade, { color: MOD_COLOR, fontFamily: "Inter_700Bold" }]}>{horarioSel.destino}</Text>
            </View>
            <Text style={[{ color: MOD_COLOR, fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" }]}>
              {formatDateLong(horarioSel.data_partida)} · {horarioSel.hora_partida?.slice(0,5)} → {horarioSel.hora_chegada?.slice(0,5)}
            </Text>
            <Text style={[{ color: MOD_COLOR, fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center" }]}>
              R$ {Number(horarioSel.preco).toFixed(2)}
            </Text>
          </View>

          {/* Assento */}
          <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.formLabel, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Assento</Text>
            <TextInput
              style={[styles.formInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSecondary, fontFamily: "Inter_400Regular" }]}
              value={assento}
              onChangeText={setAssento}
              placeholder="Número do assento"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
            />
          </View>

          {/* Passageiro */}
          <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.formLabel, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Passageiro</Text>
            <TextInput
              style={[styles.formInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSecondary, fontFamily: "Inter_400Regular" }]}
              value={passageiroNome}
              onChangeText={setPassageiroNome}
              placeholder="Nome completo"
              placeholderTextColor={colors.textMuted}
            />
            <TextInput
              style={[styles.formInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSecondary, fontFamily: "Inter_400Regular", marginTop: 8 }]}
              value={passageiroCpf}
              onChangeText={setPassageiroCpf}
              placeholder="CPF (opcional)"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
            />
          </View>

          {/* Forma de pagamento */}
          <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.formLabel, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Pagamento</Text>
            <View style={{ gap: 8, marginTop: 8 }}>
              <PaymentSelector
                empresaId={horarioSel?.empresa_id || null}
                token={customer?.token}
                colors={colors}
                accentColor={MOD_COLOR}
                directMethods={[
                  { id: "pix", icon: "zap", label: "PIX GoTaxi", desc: "Pague via PIX pela plataforma", color: "#22C55E" },
                  ...(pixInfo ? [{ id: "pix_direto", icon: "send", label: "PIX Direto à Empresa", desc: `Pague direto para ${pixInfo.beneficiario}`, color: "#10B981" }] : []),
                  { id: "credito", icon: "credit-card", label: "Cartão de Crédito", desc: "Débito ou crédito", color: "#3B82F6" },
                  { id: "dinheiro", icon: "dollar-sign", label: "Dinheiro", desc: "Pagamento presencial", color: "#F59E0B" },
                ]}
                selectedSource={paymentSource}
                onSourceSelect={(src) => setPaymentSource(src)}
                selectedMethod={formaPag}
                onMethodSelect={(m) => setFormaPag(m)}
                walletBalanceCents={walletBalance}
              />
            </View>

            {/* PIX Direto — mostrar chave */}
            {formaPag === "pix_direto" && pixInfo && (
              <View style={[styles.pixBox, { backgroundColor: "#10B98115", borderColor: "#10B98140" }]}>
                <Text style={[{ color: "#10B981", fontFamily: "Inter_700Bold", fontSize: 14, marginBottom: 4 }]}>Chave PIX da empresa</Text>
                <Text style={[{ color: "#10B981", fontFamily: "Inter_400Regular", fontSize: 12, marginBottom: 2 }]}>
                  Tipo: {pixInfo.tipo_chave_pix?.replace("aleatoria", "Chave Aleatória")}
                </Text>
                <View style={styles.pixChaveRow}>
                  <Text style={[{ color: "#10B981", fontFamily: "Inter_600SemiBold", fontSize: 13, flex: 1 }]} numberOfLines={2} selectable>
                    {pixInfo.chave_pix}
                  </Text>
                  <Pressable
                    style={[styles.copiarBtn, { backgroundColor: pixCopiado ? "#10B981" : "#10B98120" }]}
                    onPress={() => {
                      Clipboard.setString(pixInfo.chave_pix);
                      setPixCopiado(true);
                      setTimeout(() => setPixCopiado(false), 2000);
                    }}
                  >
                    <Feather name={pixCopiado ? "check" : "copy"} size={14} color={pixCopiado ? "#fff" : "#10B981"} />
                    <Text style={{ color: pixCopiado ? "#fff" : "#10B981", fontSize: 12, fontFamily: "Inter_600SemiBold" }}>
                      {pixCopiado ? "Copiado!" : "Copiar"}
                    </Text>
                  </Pressable>
                </View>
                <Text style={[{ color: "#10B981", fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 4, opacity: 0.8 }]}>
                  Transfira R$ {Number(horarioSel.preco).toFixed(2)} para esta chave e envie o comprovante para a empresa.
                </Text>
              </View>
            )}
          </View>

          {erroCompra ? (
            <View style={[styles.erroBox, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
              <Feather name="alert-circle" size={14} color="#EF4444" />
              <Text style={[{ color: "#EF4444", fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 }]}>{erroCompra}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.comprarBtn, { backgroundColor: comprando ? MOD_COLOR + "80" : MOD_COLOR }]}
            onPress={() => requireAuth(() => handleComprar())}
            disabled={comprando}
          >
            {comprando
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Feather name="check" size={20} color="#fff" />
                  <Text style={[{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 }]}>
                    Confirmar · R$ {Number(horarioSel.preco).toFixed(2)}
                  </Text>
                </>
            }
          </Pressable>
        </ScrollView>
      )}

      <SegmentoBottomNav
        ativo={activeTab === "minhas" ? "carrinho" : step === "busca" ? "inicio" : "carrinho"}
        corAtivo={MOD_COLOR}
        onInicio={() => { setActiveTab("busca"); resetBusca(); }}
        onCarrinho={() => setActiveTab("minhas")}
        onFinalizar={() => { if (step === "pagamento") requireAuth(() => handleComprar()); }}
        empresaId={empresaId}
        empresaNome={nomeEmpresa}
      />

      {/* ── MODAL DETALHE PASSAGEM ── */}
      <Modal visible={!!passagemDetalhe} transparent animationType="slide" onRequestClose={() => setPassagemDetalhe(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPassagemDetalhe(null)} />
        {passagemDetalhe && (
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />
            <ScrollView>
              <View style={{ padding: 20, gap: 14 }}>
                <View style={styles.detalheHeader}>
                  <Text style={[styles.detalheCodigo, { color: MOD_COLOR, fontFamily: "Inter_700Bold" }]}>{passagemDetalhe.codigo}</Text>
                  <StatusBadge status={passagemDetalhe.status} colors={colors} />
                </View>

                <View style={[styles.detalheRoute, { backgroundColor: MOD_COLOR + "10", borderRadius: 12, padding: 16 }]}>
                  <View style={{ alignItems: "center" }}>
                    <Text style={[{ color: colors.textMuted, fontSize: 11, fontFamily: "Inter_400Regular" }]}>Origem</Text>
                    <Text style={[{ color: colors.text, fontSize: 16, fontFamily: "Inter_700Bold" }]}>{passagemDetalhe.origem}</Text>
                    <Text style={[{ color: MOD_COLOR, fontFamily: "Inter_600SemiBold" }]}>{passagemDetalhe.hora_partida?.slice(0,5)}</Text>
                  </View>
                  <Feather name="arrow-right" size={20} color={MOD_COLOR} />
                  <View style={{ alignItems: "center" }}>
                    <Text style={[{ color: colors.textMuted, fontSize: 11, fontFamily: "Inter_400Regular" }]}>Destino</Text>
                    <Text style={[{ color: colors.text, fontSize: 16, fontFamily: "Inter_700Bold" }]}>{passagemDetalhe.destino}</Text>
                    <Text style={[{ color: MOD_COLOR, fontFamily: "Inter_600SemiBold" }]}>{passagemDetalhe.hora_chegada?.slice(0,5)}</Text>
                  </View>
                </View>

                {[
                  { label: "Data", value: formatDateLong(passagemDetalhe.data_partida) },
                  { label: "Assento", value: passagemDetalhe.assento },
                  { label: "Passageiro", value: passagemDetalhe.passageiro_nome },
                  { label: "Empresa", value: passagemDetalhe.empresa_nome },
                  { label: "Pagamento", value: passagemDetalhe.forma_pagamento?.replace("pix_direto", "PIX Direto").replace("pix", "PIX").replace("credito", "Crédito").replace("dinheiro", "Dinheiro") },
                  { label: "Valor", value: `R$ ${Number(passagemDetalhe.valor).toFixed(2)}` },
                ].map(item => (
                  <View key={item.label} style={[styles.detalheRow, { borderBottomColor: colors.border }]}>
                    <Text style={[{ color: colors.textMuted, fontSize: 13, fontFamily: "Inter_400Regular" }]}>{item.label}</Text>
                    <Text style={[{ color: colors.text, fontSize: 14, fontFamily: "Inter_600SemiBold" }]}>{item.value || "—"}</Text>
                  </View>
                ))}

                {passagemDetalhe.status !== "cancelado" && (
                  <Pressable
                    style={[styles.cancelarBtn, { borderColor: "#EF4444" }]}
                    onPress={() => handleCancelar(passagemDetalhe)}
                    disabled={cancelando}
                  >
                    {cancelando
                      ? <ActivityIndicator color="#EF4444" size="small" />
                      : <>
                          <Feather name="x-circle" size={16} color="#EF4444" />
                          <Text style={[{ color: "#EF4444", fontFamily: "Inter_600SemiBold", fontSize: 14 }]}>Cancelar passagem</Text>
                        </>
                    }
                  </Pressable>
                )}

                <Pressable style={[styles.fecharBtn, { backgroundColor: colors.backgroundSecondary }]} onPress={() => setPassagemDetalhe(null)}>
                  <Text style={[{ color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Fechar</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 16, justifyContent: "space-between" },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18 },
  tabBar: { flexDirection: "row", borderBottomWidth: 1 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabLabel: { fontSize: 13 },
  buscaCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  inputGroup: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, height: 48, gap: 12 },
  inputDot: { width: 10, height: 10, borderRadius: 5 },
  input: { flex: 1, fontSize: 15 },
  swapBtn: { alignSelf: "center", borderWidth: 1, borderRadius: 8, padding: 6 },
  buscarBtn: { height: 54, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  buscarBtnText: { fontSize: 17 },
  sectionTitle: { fontSize: 17 },
  destCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  destText: { flex: 1, fontSize: 15 },
  backChip: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 16, alignSelf: "flex-start" },
  rotaCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  rotaCities: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  rotaCidade: { fontSize: 15, flexShrink: 1 },
  rotaInfo: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  rotaFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rotaVagas: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  rotaPreco: { fontSize: 17 },
  horarioCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  horarioTopo: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  horarioHora: { fontSize: 20, marginBottom: 2 },
  horarioPreco: { fontSize: 19 },
  resumoCard: { borderRadius: 16, borderWidth: 1, padding: 16, alignItems: "center", gap: 8 },
  resumoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  resumoCidade: { fontSize: 18 },
  formCard: { borderRadius: 14, borderWidth: 1, padding: 16 },
  formLabel: { fontSize: 15, marginBottom: 8 },
  formInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, height: 46, fontSize: 15 },
  fpOption: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, borderWidth: 1.5, padding: 12 },
  fpIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  pixBox: { borderRadius: 12, borderWidth: 1, padding: 14, marginTop: 12 },
  pixChaveRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  copiarBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  comprarBtn: { height: 56, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  erroBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 10, borderWidth: 1, padding: 12 },
  emptyBox: { borderRadius: 16, borderWidth: 1, padding: 32, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 14, textAlign: "center" },
  emptyBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  loginPrompt: { borderRadius: 16, borderWidth: 1, padding: 32, alignItems: "center", gap: 12, marginTop: 20 },
  loginTitle: { fontSize: 16, textAlign: "center" },
  loginBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  passagemCard: { borderRadius: 14, borderWidth: 1, marginBottom: 12, overflow: "hidden" },
  passagemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, paddingBottom: 10 },
  passagemCodigo: { fontSize: 13 },
  passagemRoute: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 8, gap: 8 },
  passagemCidade: { fontSize: 15 },
  passagemFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1 },
  novaBtn: { height: 50, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 12, width: "100%" },
  ticketCard: { borderRadius: 20, borderWidth: 1, overflow: "hidden", width: "100%" },
  ticketTop: { padding: 24, alignItems: "center", gap: 10 },
  ticketOk: { fontSize: 20 },
  ticketBody: { padding: 20, gap: 16 },
  ticketRoute: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  ticketCity: { alignItems: "center", gap: 4 },
  cityLabel: { fontSize: 12 },
  cityName: { fontSize: 22 },
  cityHora: { fontSize: 16 },
  ticketDivider: { height: 1 },
  ticketInfoRow: { flexDirection: "row", justifyContent: "space-around" },
  ticketInfo: { alignItems: "center", gap: 4 },
  infoLabel: { fontSize: 11 },
  infoVal: { fontSize: 13 },
  ticketTotal: { flexDirection: "row", justifyContent: "space-between", padding: 12, borderRadius: 10 },
  totalLabel: { fontSize: 14 },
  totalVal: { fontSize: 20 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40, maxHeight: "85%" },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#ccc", alignSelf: "center", marginTop: 10, marginBottom: 4 },
  detalheHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  detalheCodigo: { fontSize: 18 },
  detalheRoute: { flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  detalheRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1 },
  cancelarBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 12 },
  fecharBtn: { alignItems: "center", paddingVertical: 12, borderRadius: 12 },
});
