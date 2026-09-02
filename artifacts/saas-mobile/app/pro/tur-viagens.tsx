import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Alert, StatusBar, Modal, Share,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";

const MOD = "#22C55E";
const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "http://localhost:8080/api";

const TOKEN_KEY = "tur_viagens_pdv_token";
const EMPRESA_KEY = "tur_viagens_empresa";
const USUARIO_KEY = "tur_viagens_usuario";
const REFERRAL_DOMAIN = "gotaxi.com.br";

function ReferralShareCard({ codigo }: { codigo: string }) {
  const link = `https://${REFERRAL_DOMAIN}/afiliados/r/${codigo}`;
  const copiar = async () => {
    await Clipboard.setStringAsync(link);
    Alert.alert("✅ Copiado!", "Link de indicação copiado.");
  };
  const compartilhar = async () => {
    try {
      await Share.share({
        message: `🚖 Cadastre-se no GoTaxi usando meu link e ganhe benefícios!\n\n${link}`,
        url: link,
        title: "GoTaxi — Meu link de indicação",
      });
    } catch (_) {}
  };
  return (
    <View style={refStyles.card}>
      <View style={refStyles.header}>
        <Text style={refStyles.icon}>🔗</Text>
        <View style={{ flex: 1 }}>
          <Text style={refStyles.title}>Seu link de indicação</Text>
          <Text style={refStyles.subtitle}>Indique amigos e ganhe benefícios</Text>
        </View>
        <View style={refStyles.codeBadge}>
          <Text style={refStyles.codeText}>{codigo}</Text>
        </View>
      </View>
      <View style={refStyles.linkBox}>
        <Text style={refStyles.linkText} numberOfLines={1} ellipsizeMode="middle">{link}</Text>
      </View>
      <View style={refStyles.row}>
        <TouchableOpacity style={[refStyles.btn, refStyles.copyBtn]} onPress={copiar} activeOpacity={0.8}>
          <Text style={refStyles.copyBtnTxt}>📋 Copiar link</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[refStyles.btn, refStyles.shareBtn]} onPress={compartilhar} activeOpacity={0.8}>
          <Text style={refStyles.shareBtnTxt}>🚀 Compartilhar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const refStyles = StyleSheet.create({
  card:        { backgroundColor: "#1A1A1A", borderRadius: 16, padding: 16, marginTop: 24, borderWidth: 1, borderColor: "#2A2A2A" },
  header:      { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  icon:        { fontSize: 26 },
  title:       { fontSize: 14, fontWeight: "800", color: "#FFF" },
  subtitle:    { fontSize: 12, color: "#666", marginTop: 2 },
  codeBadge:   { backgroundColor: MOD + "22", borderColor: MOD + "55", borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  codeText:    { fontSize: 13, fontWeight: "900", color: MOD, letterSpacing: 0.5 },
  linkBox:     { backgroundColor: "#111", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
  linkText:    { fontSize: 12, color: "#888", fontFamily: "monospace" },
  row:         { flexDirection: "row", gap: 10 },
  btn:         { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  copyBtn:     { backgroundColor: "#252525" },
  copyBtnTxt:  { fontSize: 13, fontWeight: "700", color: "#FFF" },
  shareBtn:    { backgroundColor: MOD },
  shareBtnTxt: { fontSize: 13, fontWeight: "800", color: "#000" },
});

interface Dashboard {
  vendas_hoje: number;
  faturamento_hoje: number;
  clientes_hoje: number;
  pendentes: number;
  recentes: {
    id: number;
    cliente_nome: string;
    destino: string;
    valor: number;
    hora_partida: string;
    status: string;
    vendido_em: string;
  }[];
}

interface Rota {
  id: number;
  origem: string;
  destino: string;
  tipo: string;
  ativo: boolean;
}

interface Carona {
  id: number;
  origem: string;
  destino: string;
  distancia_km: number | null;
  data_viagem: string;
  hora_partida: string;
  vagas_total: number;
  vagas_ocupadas: number;
  valor_por_vaga: number;
  status: string;
}

const STATUS_MAP: Record<string, { bg: string; text: string; label: string }> = {
  confirmado: { bg: "#10B98120", text: "#10B981", label: "Confirmado" },
  pendente:   { bg: "#F59E0B20", text: "#F59E0B", label: "Pendente" },
  cancelado:  { bg: "#EF444420", text: "#EF4444", label: "Cancelado" },
  embarcado:  { bg: "#3B82F620", text: "#3B82F6", label: "Embarcado" },
};

const fmtBRL = (v: number) => `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`;

export default function TurViagensOperador() {
  const [tab, setTab]             = useState<"login" | "painel">("login");
  const [email, setEmail]         = useState("");
  const [senha, setSenha]         = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);

  const [empresa, setEmpresa]         = useState<any>(null);
  const [usuario, setUsuario]         = useState<any>(null);
  const [token, setToken]             = useState<string | null>(null);
  const [dashboard, setDashboard]     = useState<Dashboard | null>(null);
  const [rotas, setRotas]             = useState<Rota[]>([]);
  const [caronas, setCaronas]         = useState<Carona[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // ── Modal de nova viagem compartilhada ─────────────────────────────────────
  const [modalCarona, setModalCarona] = useState(false);
  const [cOrigem, setCOrigem]         = useState("");
  const [cDestino, setCDestino]       = useState("");
  const [cData, setCData]             = useState("");
  const [cHora, setCHora]             = useState("");
  const [cVagas, setCVagas]           = useState("3");
  const [cValor, setCValor]           = useState("");
  const [cVeiculo, setCVeiculo]       = useState("");
  const [cObs, setCObs]               = useState("");
  const [cDistancia, setCDistancia]   = useState<number | null>(null);
  const [cValorPorKm, setCValorPorKm] = useState<number>(0.8);
  const [calculando, setCalculando]   = useState(false);
  const [salvandoCarona, setSalvandoCarona] = useState(false);

  useEffect(() => {
    (async () => {
      const t = await AsyncStorage.getItem(TOKEN_KEY);
      const e = await AsyncStorage.getItem(EMPRESA_KEY);
      const u = await AsyncStorage.getItem(USUARIO_KEY);
      if (t && e) {
        setToken(t);
        setEmpresa(JSON.parse(e));
        if (u) { try { setUsuario(JSON.parse(u)); } catch {} }
        setTab("painel");
        carregarDados(t);
      }
      setCheckingToken(false);
    })();
  }, []);

  async function handleLogin() {
    if (!email.trim() || !senha) { Alert.alert("Preencha e-mail e senha"); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/pdv/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), senha }),
      });
      const d = await r.json();
      if (!r.ok) {
        Alert.alert("Erro ao entrar", d.message || "Credenciais inválidas");
        return;
      }
      await AsyncStorage.setItem(TOKEN_KEY, d.token);
      await AsyncStorage.setItem(EMPRESA_KEY, JSON.stringify(d.empresa));
      if (d.usuario) await AsyncStorage.setItem(USUARIO_KEY, JSON.stringify(d.usuario));
      setToken(d.token);
      setEmpresa(d.empresa);
      setUsuario(d.usuario ?? null);
      setTab("painel");
      carregarDados(d.token);
    } catch { Alert.alert("Falha de conexão. Tente novamente."); }
    finally { setLoading(false); }
  }

  async function carregarDados(t: string) {
    setLoadingData(true);
    try {
      const [dashRes, rotasRes, caronasRes, cfgRes] = await Promise.all([
        fetch(`${API_BASE}/pdv/viagens/dashboard`, { headers: { Authorization: `Bearer ${t}` } }),
        fetch(`${API_BASE}/pdv/viagens/rotas`, { headers: { Authorization: `Bearer ${t}` } }),
        fetch(`${API_BASE}/pdv/viagens/caronas`, { headers: { Authorization: `Bearer ${t}` } }),
        fetch(`${API_BASE}/public/caronas/config`),
      ]);
      if (dashRes.ok) setDashboard(await dashRes.json());
      if (rotasRes.ok) setRotas(await rotasRes.json());
      if (caronasRes.ok) setCaronas(await caronasRes.json());
      if (cfgRes.ok) {
        const cfg = await cfgRes.json();
        setCValorPorKm(Number(cfg.valor_por_km ?? 0.8));
      }
    } catch {}
    setLoadingData(false);
  }

  function abrirModalCarona() {
    setCOrigem(""); setCDestino(""); setCData(""); setCHora("");
    setCVagas("3"); setCValor(""); setCVeiculo(""); setCObs("");
    setCDistancia(null);
    setModalCarona(true);
  }

  async function calcularDistanciaEValor() {
    if (!cOrigem.trim() || !cDestino.trim()) {
      Alert.alert("Informe origem e destino", "Digite as cidades antes de calcular.");
      return;
    }
    setCalculando(true);
    try {
      const r = await fetch(`${API_BASE}/public/distancia?origem=${encodeURIComponent(cOrigem.trim())}&destino=${encodeURIComponent(cDestino.trim())}`);
      const data = await r.json();
      if (!r.ok || !data.distancia_km) {
        Alert.alert("Não consegui calcular", data?.detail || "Tente refinar as cidades (ex.: 'São Paulo, SP').");
        return;
      }
      const km = Number(data.distancia_km);
      setCDistancia(km);
      const valorSugerido = (km * cValorPorKm).toFixed(2);
      setCValor(valorSugerido);
      Alert.alert(
        "Distância calculada",
        `${data.distancia_texto} (≈ ${data.duracao_texto}).\n\nValor sugerido: R$ ${valorSugerido} por vaga (${km} km × R$ ${cValorPorKm.toFixed(2)}/km).\n\nVocê pode ajustar.`
      );
    } catch (e: any) {
      Alert.alert("Erro de conexão", e?.message || "Tente novamente.");
    } finally {
      setCalculando(false);
    }
  }

  async function salvarCarona() {
    if (!cOrigem.trim() || !cDestino.trim()) { Alert.alert("Preencha origem e destino"); return; }
    if (!cData.trim()) { Alert.alert("Informe a data (AAAA-MM-DD)"); return; }
    if (!cHora.trim()) { Alert.alert("Informe a hora de partida (HH:MM)"); return; }
    const vagas = Number(cVagas);
    if (!vagas || vagas < 1) { Alert.alert("Informe vagas válidas"); return; }
    const valor = Number(cValor.replace(",", "."));
    if (!valor || valor <= 0) { Alert.alert("Informe o valor por vaga"); return; }
    setSalvandoCarona(true);
    try {
      const r = await fetch(`${API_BASE}/pdv/viagens/caronas`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          origem: cOrigem.trim(),
          destino: cDestino.trim(),
          distancia_km: cDistancia,
          data_viagem: cData.trim(),
          hora_partida: cHora.trim(),
          vagas_total: vagas,
          valor_por_vaga: valor,
          tipo: "direta",
          observacoes: cObs.trim() + (cVeiculo.trim() ? `\nVeículo: ${cVeiculo.trim()}` : ""),
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        Alert.alert("Erro ao publicar", err?.error || "Verifique os dados e tente novamente.");
        return;
      }
      setModalCarona(false);
      Alert.alert("Viagem publicada!", "Sua viagem compartilhada já aparece para os passageiros no app.");
      carregarDados(token!);
    } catch (e: any) {
      Alert.alert("Erro de conexão", e?.message || "Tente novamente.");
    } finally {
      setSalvandoCarona(false);
    }
  }

  async function handleSair() {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(EMPRESA_KEY);
    await AsyncStorage.removeItem(USUARIO_KEY);
    setToken(null); setEmpresa(null); setUsuario(null); setDashboard(null); setRotas([]);
    setEmail(""); setSenha("");
    setCaronas([]);
    setTab("login");
  }

  if (checkingToken) {
    return (
      <View style={[s.root, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={MOD} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <SafeAreaView style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Text style={s.backTxt}>← Voltar</Text>
          </TouchableOpacity>
          {tab === "painel" && (
            <TouchableOpacity onPress={handleSair}>
              <Text style={{ color: "#555", fontSize: 13 }}>Sair</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── LOGIN ────────────────────────────────────────────────── */}
        {tab === "login" && (
          <ScrollView contentContainerStyle={s.loginScroll} keyboardShouldPersistTaps="handled">
            <View style={s.logoBadge}>
              <Text style={{ fontSize: 32 }}>🎟️</Text>
            </View>
            <Text style={s.loginTitle}>Tur Viagens{"\n"}<Text style={{ color: MOD }}>Operador</Text></Text>
            <Text style={s.loginSub}>Acesse seu painel para gerenciar rotas, horários e passagens</Text>

            <Text style={s.label}>E-mail</Text>
            <TextInput
              style={s.input} value={email} onChangeText={setEmail}
              placeholder="operador@exemplo.com" placeholderTextColor="#444"
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            />

            <Text style={s.label}>Senha</Text>
            <View style={{ position: "relative" }}>
              <TextInput
                style={[s.input, { paddingRight: 48 }]} value={senha} onChangeText={setSenha}
                placeholder="••••••••" placeholderTextColor="#444"
                secureTextEntry={!showSenha}
              />
              <TouchableOpacity onPress={() => setShowSenha(!showSenha)} style={s.eyeBtn}>
                <Feather name={showSenha ? "eye-off" : "eye"} size={18} color="#555" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[s.btnPrimary, { backgroundColor: MOD }]} onPress={handleLogin} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimaryTxt}>Entrar no painel</Text>}
            </TouchableOpacity>

            <View style={s.separador}>
              <View style={s.separadorLinha} /><Text style={s.separadorTxt}>Novo operador?</Text><View style={s.separadorLinha} />
            </View>

            <TouchableOpacity style={s.btnSecondary} onPress={() => router.push("/pro/tur-viagens-cadastro" as any)}>
              <Text style={s.btnSecondaryTxt}>Cadastrar minha empresa</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ── PAINEL ───────────────────────────────────────────────── */}
        {tab === "painel" && empresa && (
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            {/* Empresa */}
            <View style={s.empresaCard}>
              <View style={s.empresaIcon}>
                <Text style={{ fontSize: 24 }}>🎟️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.empresaNome}>{empresa.nome}</Text>
                <Text style={s.empresaCity}>{empresa.cidade ?? empresa.responsavel ?? "Operador Tur Viagens"}</Text>
              </View>
              <View style={[s.badgeAtivo, { backgroundColor: MOD + "22" }]}>
                <Text style={{ color: MOD, fontSize: 11, fontWeight: "700" }}>ATIVO</Text>
              </View>
            </View>

            {/* Stats do dia */}
            {loadingData && <ActivityIndicator color={MOD} style={{ marginVertical: 16 }} />}
            {!loadingData && dashboard && (
              <>
                <Text style={s.sectionTitle}>Hoje</Text>
                <View style={s.statsRow}>
                  <View style={[s.statCard, { borderColor: MOD + "44" }]}>
                    <Text style={[s.statNum, { color: MOD }]}>{dashboard.vendas_hoje}</Text>
                    <Text style={s.statLabel}>Passagens vendidas</Text>
                  </View>
                  <View style={[s.statCard, { borderColor: "#10B98144" }]}>
                    <Text style={[s.statNum, { color: "#10B981", fontSize: 18 }]}>{fmtBRL(dashboard.faturamento_hoje)}</Text>
                    <Text style={s.statLabel}>Faturamento</Text>
                  </View>
                </View>
                <View style={s.statsRow}>
                  <View style={[s.statCard, { borderColor: "#F59E0B44" }]}>
                    <Text style={[s.statNum, { color: "#F59E0B" }]}>{dashboard.pendentes}</Text>
                    <Text style={s.statLabel}>Pendentes</Text>
                  </View>
                  <View style={[s.statCard, { borderColor: "#3B82F644" }]}>
                    <Text style={[s.statNum, { color: "#3B82F6" }]}>{rotas.filter(r => r.ativo !== false).length}</Text>
                    <Text style={s.statLabel}>Rotas ativas</Text>
                  </View>
                </View>

                {/* Rotas cadastradas */}
                {rotas.length > 0 && (
                  <>
                    <Text style={s.sectionTitle}>Suas Rotas</Text>
                    {rotas.slice(0, 6).map(r => (
                      <View key={r.id} style={s.rotaCard}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.rotaRota}>{r.origem?.split(",")[0]} → {r.destino?.split(",")[0]}</Text>
                          <Text style={s.rotaTipo}>{r.tipo === "onibus" ? "🚌 Ônibus" : r.tipo === "van" ? "🚐 Van" : r.tipo === "aviao" ? "✈️ Avião" : "🚢 Barco"}</Text>
                        </View>
                        <View style={[s.statusTag, { backgroundColor: r.ativo !== false ? MOD + "22" : "#EF444422" }]}>
                          <Text style={{ color: r.ativo !== false ? MOD : "#EF4444", fontSize: 11, fontWeight: "700" }}>
                            {r.ativo !== false ? "ATIVA" : "INATIVA"}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </>
                )}

                {/* Passagens recentes */}
                {dashboard.recentes?.length > 0 && (
                  <>
                    <Text style={s.sectionTitle}>Passagens Recentes</Text>
                    {dashboard.recentes.map(p => {
                      const st = STATUS_MAP[p.status] ?? { bg: "#64748B20", text: "#64748B", label: p.status };
                      return (
                        <View key={p.id} style={s.rotaCard}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.rotaRota}>{p.cliente_nome ?? "Cliente"} → {p.destino ?? "—"}</Text>
                            <Text style={s.rotaTipo}>{p.hora_partida ? `Partida: ${p.hora_partida}` : "Sem horário"}</Text>
                          </View>
                          <View style={{ alignItems: "flex-end", gap: 4 }}>
                            <Text style={{ color: MOD, fontSize: 14, fontWeight: "800" }}>{fmtBRL(p.valor)}</Text>
                            <View style={[s.statusTag, { backgroundColor: st.bg }]}>
                              <Text style={{ color: st.text, fontSize: 10, fontWeight: "700" }}>{st.label}</Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </>
                )}

                {rotas.length === 0 && dashboard.recentes?.length === 0 && (
                  <View style={s.emptyState}>
                    <Text style={{ fontSize: 36 }}>🗺️</Text>
                    <Text style={s.emptyTxt}>Nenhuma rota cadastrada</Text>
                    <Text style={s.emptyDesc}>Acesse o painel web para adicionar rotas, horários e começar a vender passagens.</Text>
                  </View>
                )}

                {/* ── Viagens compartilhadas (BlaBlaCar) ─────────────────── */}
                <View style={{ marginTop: 24 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <Text style={[s.sectionTitle, { marginTop: 0, marginBottom: 0 }]}>Viagens Compartilhadas</Text>
                    <TouchableOpacity onPress={abrirModalCarona} style={s.novaCaronaBtn}>
                      <Feather name="plus" size={14} color="#fff" />
                      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Nova</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={{ color: "#666", fontSize: 12, marginBottom: 12, lineHeight: 17 }}>
                    Publique uma viagem que você vai fazer e divida o valor com passageiros (estilo BlaBlaCar). Tarifa sugerida: R$ {cValorPorKm.toFixed(2)}/km.
                  </Text>

                  {caronas.length === 0 ? (
                    <View style={[s.emptyState, { paddingVertical: 18 }]}>
                      <Text style={{ fontSize: 30 }}>🚗</Text>
                      <Text style={s.emptyTxt}>Nenhuma viagem compartilhada</Text>
                      <Text style={s.emptyDesc}>Toque em "Nova" para publicar sua primeira.</Text>
                    </View>
                  ) : (
                    caronas.slice(0, 8).map(c => (
                      <View key={c.id} style={s.rotaCard}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.rotaRota}>{c.origem?.split(",")[0]} → {c.destino?.split(",")[0]}</Text>
                          <Text style={s.rotaTipo}>
                            {c.data_viagem?.slice(0, 10)} • {String(c.hora_partida).slice(0, 5)} • {c.vagas_ocupadas}/{c.vagas_total} vagas
                            {c.distancia_km ? ` • ${c.distancia_km} km` : ""}
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 4 }}>
                          <Text style={{ color: MOD, fontSize: 14, fontWeight: "800" }}>{fmtBRL(Number(c.valor_por_vaga))}</Text>
                          <View style={[s.statusTag, { backgroundColor: c.status === "ativa" ? MOD + "22" : "#64748B22" }]}>
                            <Text style={{ color: c.status === "ativa" ? MOD : "#64748B", fontSize: 10, fontWeight: "700" }}>
                              {(c.status || "ativa").toUpperCase()}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </>
            )}

            {/* Card de compartilhamento de afiliado */}
            {usuario?.codigo_referral ? (
              <ReferralShareCard codigo={usuario.codigo_referral} />
            ) : null}

            {/* Link painel web */}
            <View style={s.painelWebCard}>
              <Feather name="monitor" size={20} color={MOD} />
              <View style={{ flex: 1 }}>
                <Text style={s.painelWebTitle}>Painel completo</Text>
                <Text style={s.painelWebDesc}>Acesse o PDV web para gerenciar rotas, horários, passageiros e relatórios completos.</Text>
              </View>
              <Feather name="external-link" size={16} color="#555" />
            </View>
          </ScrollView>
        )}

        {/* ── MODAL: Nova viagem compartilhada ─────────────────────── */}
        <Modal visible={modalCarona} animationType="slide" transparent onRequestClose={() => setModalCarona(false)}>
          <View style={s.modalOverlay}>
            <View style={s.modalSheet}>
              <View style={s.modalHandle} />
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>🚗 Nova viagem compartilhada</Text>
                <TouchableOpacity onPress={() => setModalCarona(false)}>
                  <Feather name="x" size={22} color="#888" />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
                <Text style={s.modalDesc}>
                  O app calcula a distância entre as cidades (Google Maps) e sugere o valor por vaga (R$ {cValorPorKm.toFixed(2)}/km — definido pelo super admin).
                </Text>

                <Text style={s.label}>Origem (cidade)</Text>
                <TextInput style={s.input} value={cOrigem} onChangeText={setCOrigem} placeholder="Ex.: São Paulo, SP" placeholderTextColor="#444" />

                <Text style={s.label}>Destino (cidade)</Text>
                <TextInput style={s.input} value={cDestino} onChangeText={setCDestino} placeholder="Ex.: Campinas, SP" placeholderTextColor="#444" />

                <TouchableOpacity onPress={calcularDistanciaEValor} disabled={calculando} style={s.calcBtn}>
                  {calculando ? (
                    <ActivityIndicator color={MOD} />
                  ) : (
                    <>
                      <Feather name="map" size={16} color={MOD} />
                      <Text style={{ color: MOD, fontWeight: "700", fontSize: 14 }}>Calcular distância e valor sugerido</Text>
                    </>
                  )}
                </TouchableOpacity>

                {cDistancia !== null && (
                  <View style={s.distInfo}>
                    <Text style={{ color: "#10B981", fontWeight: "700", fontSize: 13 }}>
                      📍 {cDistancia} km — valor sugerido: R$ {(cDistancia * cValorPorKm).toFixed(2)} por vaga
                    </Text>
                  </View>
                )}

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>Data (AAAA-MM-DD)</Text>
                    <TextInput style={s.input} value={cData} onChangeText={setCData} placeholder="2026-04-25" placeholderTextColor="#444" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>Hora (HH:MM)</Text>
                    <TextInput style={s.input} value={cHora} onChangeText={setCHora} placeholder="08:30" placeholderTextColor="#444" />
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>Vagas</Text>
                    <TextInput style={s.input} value={cVagas} onChangeText={setCVagas} keyboardType="number-pad" placeholder="3" placeholderTextColor="#444" />
                  </View>
                  <View style={{ flex: 1.5 }}>
                    <Text style={s.label}>Valor por vaga (R$)</Text>
                    <TextInput style={s.input} value={cValor} onChangeText={setCValor} keyboardType="decimal-pad" placeholder="80,00" placeholderTextColor="#444" />
                  </View>
                </View>

                <Text style={s.label}>Veículo (opcional)</Text>
                <TextInput style={s.input} value={cVeiculo} onChangeText={setCVeiculo} placeholder="Ex.: Onix prata 2022 — ABC1D23" placeholderTextColor="#444" />

                <Text style={s.label}>Observações (opcional)</Text>
                <TextInput
                  style={[s.input, { height: 70, textAlignVertical: "top" }]}
                  value={cObs}
                  onChangeText={setCObs}
                  placeholder="Ex.: Saída do terminal, espaço para 1 mala por pessoa..."
                  placeholderTextColor="#444"
                  multiline
                />

                <TouchableOpacity onPress={salvarCarona} disabled={salvandoCarona} style={[s.btnPrimary, { backgroundColor: MOD, marginTop: 18 }]}>
                  {salvandoCarona ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimaryTxt}>Publicar viagem</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: "#0D0D0D" },
  header:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  backTxt:        { color: MOD, fontSize: 14, fontWeight: "600" },
  loginScroll:    { paddingHorizontal: 24, paddingBottom: 40, paddingTop: 20 },
  logoBadge:      { width: 80, height: 80, borderRadius: 24, borderWidth: 2.5, borderColor: MOD + "44", backgroundColor: "#071810", justifyContent: "center", alignItems: "center", marginBottom: 20 },
  loginTitle:     { fontSize: 28, fontWeight: "900", color: "#FFF", lineHeight: 34, marginBottom: 8 },
  loginSub:       { fontSize: 14, color: "#8896B0", marginBottom: 28, lineHeight: 20 },
  label:          { fontSize: 12, color: "#8896B0", fontWeight: "700", marginBottom: 6, marginTop: 14, textTransform: "uppercase", letterSpacing: 0.5 },
  input:          { backgroundColor: "#1A1A1A", borderWidth: 1.5, borderColor: "#2A2A2A", borderRadius: 14, paddingHorizontal: 18, paddingVertical: 15, color: "#FFF", fontSize: 16 },
  eyeBtn:         { position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" },
  btnPrimary:     { borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 24 },
  btnPrimaryTxt:  { fontSize: 16, fontWeight: "800", color: "#fff" },
  btnSecondary:   { borderRadius: 16, paddingVertical: 14, alignItems: "center", borderWidth: 1.5, borderColor: MOD + "44" },
  btnSecondaryTxt:{ fontSize: 15, fontWeight: "700", color: MOD },
  separador:      { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 20 },
  separadorLinha: { flex: 1, height: 1, backgroundColor: "#1E1E1E" },
  separadorTxt:   { fontSize: 12, color: "#555", fontWeight: "600" },
  empresaCard:    { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#071810", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: MOD + "33", marginBottom: 16 },
  empresaIcon:    { width: 48, height: 48, borderRadius: 14, backgroundColor: MOD + "22", alignItems: "center", justifyContent: "center" },
  empresaNome:    { fontSize: 17, fontWeight: "800", color: "#FFF" },
  empresaCity:    { fontSize: 12, color: "#8896B0", marginTop: 2 },
  badgeAtivo:     { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statsRow:       { flexDirection: "row", gap: 12, marginBottom: 12 },
  statCard:       { flex: 1, backgroundColor: "#1A1A1A", borderRadius: 14, padding: 16, alignItems: "center", borderWidth: 1 },
  statNum:        { fontSize: 26, fontWeight: "900" },
  statLabel:      { fontSize: 11, color: "#666", marginTop: 4, textAlign: "center" },
  sectionTitle:   { fontSize: 15, fontWeight: "700", color: "#FFF", marginBottom: 10, marginTop: 16 },
  rotaCard:       { backgroundColor: "#1A1A1A", borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#2A2A2A", flexDirection: "row", alignItems: "center", gap: 10 },
  rotaRota:       { fontSize: 14, fontWeight: "700", color: "#FFF" },
  rotaTipo:       { fontSize: 12, color: "#666", marginTop: 3 },
  statusTag:      { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  emptyState:     { alignItems: "center", gap: 8, paddingVertical: 30 },
  emptyTxt:       { fontSize: 16, fontWeight: "700", color: "#FFF" },
  emptyDesc:      { fontSize: 13, color: "#666", textAlign: "center", lineHeight: 18 },
  painelWebCard:  { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#1A1A1A", borderRadius: 14, padding: 16, marginTop: 20, borderWidth: 1, borderColor: "#2A2A2A" },
  painelWebTitle: { fontSize: 14, fontWeight: "700", color: "#FFF" },
  painelWebDesc:  { fontSize: 12, color: "#666", marginTop: 2, lineHeight: 17 },
  novaCaronaBtn:  { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: MOD, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  modalOverlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalSheet:     { backgroundColor: "#0D0D0D", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "92%", borderWidth: 1, borderColor: "#1F1F1F" },
  modalHandle:    { width: 40, height: 4, backgroundColor: "#333", borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  modalHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  modalTitle:     { fontSize: 18, fontWeight: "800", color: "#FFF" },
  modalDesc:      { fontSize: 13, color: "#8896B0", lineHeight: 18, marginBottom: 8 },
  calcBtn:        { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 12, marginTop: 14, borderWidth: 1.5, borderColor: MOD + "55", backgroundColor: MOD + "11" },
  distInfo:       { backgroundColor: "#10B98115", borderColor: "#10B98144", borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 12 },
});
