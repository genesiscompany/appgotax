import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, useColorScheme,
  TextInput, ActivityIndicator, Alert, Modal, KeyboardAvoidingView,
  Platform, TouchableOpacity, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";

const MOD = "#A78BFA";
const MOD_DIM = "#A78BFA22";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "http://localhost:8080/api";

// ── Types ────────────────────────────────────────────────────────────────────
interface Parada { id: number; cidade: string; hora_prevista: string; aceita_embarque: boolean; aceita_desembarque: boolean; ordem: number; }
interface Carona {
  id: number; origem: string; destino: string; distancia_km: number;
  data_viagem: string; hora_partida: string; vagas_total: number; vagas_ocupadas: number;
  valor_por_vaga: string; tipo: string; observacoes: string;
  empresa_nome: string; empresa_id: number; empresa_telefone?: string;
  veiculo_modelo?: string; veiculo_placa?: string; veiculo_cor?: string;
  paradas?: Parada[];
}
interface Reserva {
  id: number; carona_id: number; passageiro_nome: string; passageiro_telefone: string;
  parada_embarque: string; parada_desembarque: string; valor: string;
  forma_pagamento: string; status: string;
  origem: string; destino: string; data_viagem: string; hora_partida: string;
  empresa_nome: string; veiculo_modelo?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtBRL  = (v: string | number) => `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`;
const fmtDate = (d: string) => {
  if (!d) return "";
  const [y, m, dd] = (d.split("T")[0]).split("-");
  return `${dd}/${m}/${y}`;
};
const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  confirmada: { label: "Confirmada", color: "#10B981" },
  pendente:   { label: "Pendente",   color: "#F59E0B" },
  cancelada:  { label: "Cancelada",  color: "#EF4444" },
};
const PAGAMENTOS = ["pix", "dinheiro", "cartão de crédito", "cartão de débito", "transferência"];

// ── Main Component ────────────────────────────────────────────────────────────
export default function TurViagensScreen() {
  const insets = useSafeAreaInsets();
  const isDark  = useColorScheme() === "dark";
  const C       = isDark ? Colors.dark : Colors.light;

  const [tab, setTab]           = useState<"busca" | "reservas">("busca");
  const [step, setStep]         = useState<"busca" | "lista" | "detalhe">("busca");
  const [caronas, setCaronas]   = useState<Carona[]>([]);
  const [detalhe, setDetalhe]   = useState<Carona | null>(null);
  const [loading, setLoading]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Busca
  const [origem, setOrigem]     = useState("");
  const [destino, setDestino]   = useState("");
  const [dataBusca, setDataBusca] = useState("");

  // Minhas reservas
  const [telefone, setTelefone] = useState("");
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loadingRes, setLoadingRes] = useState(false);

  // Booking modal
  const [booking, setBooking]   = useState(false);
  const [bNome, setBNome]       = useState("");
  const [bTel, setBTel]         = useState("");
  const [bCpf, setBCpf]         = useState("");
  const [bEmbarque, setBEmbarque] = useState("");
  const [bDesembarque, setBDesembarque] = useState("");
  const [bPag, setBPag]         = useState("pix");
  const [savingBook, setSavingBook] = useState(false);

  // ── API calls ────────────────────────────────────────────────────────────
  async function buscarCaronas() {
    if (!origem.trim() && !destino.trim()) {
      Alert.alert("Informe a origem ou destino");
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (origem.trim())   params.set("origem", origem.trim());
      if (destino.trim())  params.set("destino", destino.trim());
      if (dataBusca.trim()) params.set("data", dataBusca.trim());
      const r = await fetch(`${API_BASE}/public/caronas?${params}`);
      const d = await r.json();
      setCaronas(Array.isArray(d) ? d : []);
      setStep("lista");
    } catch { Alert.alert("Erro ao buscar caronas. Tente novamente."); }
    finally { setLoading(false); }
  }

  async function verDetalhe(c: Carona) {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/public/caronas/${c.id}`);
      const d = await r.json();
      setDetalhe(d);
      setBEmbarque(d.origem);
      setBDesembarque(d.destino);
      setStep("detalhe");
    } catch { Alert.alert("Erro ao carregar detalhes."); }
    finally { setLoading(false); }
  }

  async function confirmarReserva() {
    if (!bNome.trim() || !bTel.trim()) {
      Alert.alert("Preencha nome e telefone");
      return;
    }
    setSavingBook(true);
    try {
      const r = await fetch(`${API_BASE}/public/caronas/${detalhe!.id}/reservas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passageiro_nome: bNome.trim(),
          passageiro_telefone: bTel.trim(),
          passageiro_cpf: bCpf.trim(),
          parada_embarque: bEmbarque,
          parada_desembarque: bDesembarque,
          forma_pagamento: bPag,
        }),
      });
      const d = await r.json();
      if (!r.ok) { Alert.alert("Erro", d.error || "Não foi possível reservar"); return; }
      setBooking(false);
      Alert.alert(
        "Reserva confirmada! ✅",
        `Sua vaga de ${detalhe!.origem.split(",")[0]} → ${detalhe!.destino.split(",")[0]} foi reservada.\n\nGuarde seu telefone para consultar suas reservas.`,
        [{ text: "OK", onPress: () => {
          setBNome(""); setBTel(""); setBCpf(""); setBPag("pix");
          setStep("lista");
        }}]
      );
    } catch { Alert.alert("Falha na conexão. Tente novamente."); }
    finally { setSavingBook(false); }
  }

  async function carregarReservas() {
    const tel = telefone.replace(/\D/g, "");
    if (tel.length < 8) { Alert.alert("Informe um telefone válido"); return; }
    setLoadingRes(true);
    try {
      const r = await fetch(`${API_BASE}/public/reservas?telefone=${tel}`);
      const d = await r.json();
      setReservas(Array.isArray(d) ? d : []);
    } catch { Alert.alert("Erro ao buscar reservas."); }
    finally { setLoadingRes(false); }
  }

  const vagas = detalhe ? detalhe.vagas_total - detalhe.vagas_ocupadas : 0;
  const todasParadas = detalhe
    ? [{ cidade: detalhe.origem, hora_prevista: detalhe.hora_partida, id: -1, aceita_embarque: true, aceita_desembarque: false, ordem: -1 },
       ...(detalhe.paradas ?? []),
       { cidade: detalhe.destino, hora_prevista: "", id: -2, aceita_embarque: false, aceita_desembarque: true, ordem: 999 }]
    : [];

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: C.background, paddingTop: insets.top }]}>

      {/* Header */}
      <View style={[s.header, { borderBottomColor: C.border }]}>
        <Pressable onPress={() => {
          if (step !== "busca") { setStep(step === "detalhe" ? "lista" : "busca"); return; }
          router.back();
        }} style={s.backBtn} hitSlop={12}>
          <Feather name="arrow-left" size={22} color={C.text} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: MOD }]}>✈ Tur Viagens</Text>
          <Text style={[s.headerSub, { color: C.textSecondary }]}>
            {step === "busca"  ? "Encontre sua carona" :
             step === "lista"  ? `${caronas.length} carona(s) encontrada(s)` :
             `${detalhe?.origem.split(",")[0]} → ${detalhe?.destino.split(",")[0]}`}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Tabs */}
      <View style={[s.tabs, { borderBottomColor: C.border, backgroundColor: C.card }]}>
        {(["busca", "reservas"] as const).map(t => (
          <Pressable key={t} style={[s.tab, tab === t && { borderBottomColor: MOD, borderBottomWidth: 2.5 }]}
            onPress={() => { setTab(t); if (t === "busca") setStep("busca"); }}>
            <Text style={[s.tabText, { color: tab === t ? MOD : C.textMuted }]}>
              {t === "busca" ? "🔍 Buscar Caronas" : "🎫 Minhas Reservas"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── TAB: BUSCA ──────────────────────────────────────────────────────── */}
      {tab === "busca" && (
        <>
          {/* STEP: Formulário */}
          {step === "busca" && (
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
              <ScrollView style={{ flex: 1 }} contentContainerStyle={s.searchContainer} keyboardShouldPersistTaps="handled">
                <View style={[s.searchCard, { backgroundColor: C.card, borderColor: C.border }]}>
                  <Text style={[s.searchTitle, { color: C.text }]}>Para onde você vai?</Text>

                  {[
                    { label: "Partindo de", icon: "map-pin" as const, val: origem, set: setOrigem, ph: "Ex: São Paulo, SP" },
                    { label: "Indo para", icon: "navigation" as const, val: destino, set: setDestino, ph: "Ex: Rio de Janeiro, RJ" },
                  ].map(f => (
                    <View key={f.label} style={s.fieldGroup}>
                      <Text style={[s.fieldLabel, { color: C.textSecondary }]}>{f.label}</Text>
                      <View style={[s.inputRow, { backgroundColor: C.backgroundSecondary, borderColor: C.border }]}>
                        <Feather name={f.icon} size={16} color={MOD} style={{ marginRight: 8 }} />
                        <TextInput
                          value={f.val} onChangeText={f.set} placeholder={f.ph}
                          placeholderTextColor={C.textMuted}
                          style={[s.input, { color: C.text }]}
                        />
                        {f.val.length > 0 && (
                          <Pressable onPress={() => f.set("")} hitSlop={8}>
                            <Feather name="x" size={14} color={C.textMuted} />
                          </Pressable>
                        )}
                      </View>
                    </View>
                  ))}

                  <View style={s.fieldGroup}>
                    <Text style={[s.fieldLabel, { color: C.textSecondary }]}>Data (opcional)</Text>
                    <View style={[s.inputRow, { backgroundColor: C.backgroundSecondary, borderColor: C.border }]}>
                      <Feather name="calendar" size={16} color={MOD} style={{ marginRight: 8 }} />
                      <TextInput
                        value={dataBusca} onChangeText={setDataBusca}
                        placeholder="AAAA-MM-DD" placeholderTextColor={C.textMuted}
                        style={[s.input, { color: C.text }]}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <Pressable onPress={buscarCaronas} disabled={loading}
                    style={[s.btnPrimary, { backgroundColor: MOD, opacity: loading ? 0.7 : 1 }]}>
                    {loading
                      ? <ActivityIndicator color="#fff" />
                      : <><Feather name="search" size={18} color="#fff" /><Text style={s.btnPrimaryText}>Buscar Caronas</Text></>}
                  </Pressable>
                </View>

                {/* Dica */}
                <View style={[s.tipCard, { backgroundColor: MOD_DIM, borderColor: MOD + "44" }]}>
                  <Text style={{ color: MOD, fontSize: 13, lineHeight: 20 }}>
                    💡 Pesquise pelo nome da cidade (ex: "Brasília", "Campinas") para encontrar caronas disponíveis na sua rota.
                  </Text>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          )}

          {/* STEP: Lista de caronas */}
          {step === "lista" && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={buscarCaronas} tintColor={MOD} />}>
              {loading && <ActivityIndicator color={MOD} style={{ marginTop: 40 }} />}
              {!loading && caronas.length === 0 && (
                <View style={s.emptyState}>
                  <Text style={{ fontSize: 48 }}>✈️</Text>
                  <Text style={[s.emptyTitle, { color: C.text }]}>Nenhuma carona encontrada</Text>
                  <Text style={[s.emptyDesc, { color: C.textSecondary }]}>
                    Tente buscar por outra rota ou data diferente.
                  </Text>
                  <Pressable onPress={() => setStep("busca")} style={[s.btnOutline, { borderColor: MOD }]}>
                    <Text style={{ color: MOD, fontWeight: "700" }}>← Nova busca</Text>
                  </Pressable>
                </View>
              )}
              {!loading && caronas.map(c => {
                const livres = c.vagas_total - c.vagas_ocupadas;
                return (
                  <Pressable key={c.id} onPress={() => verDetalhe(c)}
                    style={[s.caronaCard, { backgroundColor: C.card, borderColor: C.border }]}>
                    <View style={s.caronaTop}>
                      <View style={[s.caronaIconBox, { backgroundColor: MOD_DIM }]}>
                        <Text style={{ fontSize: 22 }}>🚐</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={s.caronaRoute}>
                          <Text style={[s.caronaCity, { color: C.text }]} numberOfLines={1}>
                            {c.origem.split(",")[0]}
                          </Text>
                          <Feather name="arrow-right" size={14} color={C.textMuted} style={{ marginHorizontal: 6 }} />
                          <Text style={[s.caronaCity, { color: C.text }]} numberOfLines={1}>
                            {c.destino.split(",")[0]}
                          </Text>
                        </View>
                        <Text style={[s.caronaOperator, { color: C.textSecondary }]} numberOfLines={1}>
                          {c.empresa_nome} {c.veiculo_modelo ? `• ${c.veiculo_modelo}` : ""}
                        </Text>
                      </View>
                      <Feather name="chevron-right" size={18} color={C.textMuted} />
                    </View>

                    <View style={[s.caronaDivider, { backgroundColor: C.border }]} />

                    <View style={s.caronaInfo}>
                      <InfoChip icon="calendar" label={fmtDate(c.data_viagem)} color={C.textSecondary} />
                      <InfoChip icon="clock" label={c.hora_partida} color={C.textSecondary} />
                      {c.distancia_km && <InfoChip icon="map" label={`${c.distancia_km}km`} color={C.textSecondary} />}
                    </View>

                    <View style={s.caronaBottom}>
                      <View style={[s.vagasTag, { backgroundColor: livres <= 2 ? "#EF444422" : "#10B98122" }]}>
                        <Text style={{ color: livres <= 2 ? "#EF4444" : "#10B981", fontSize: 12, fontWeight: "700" }}>
                          {livres} vaga{livres !== 1 ? "s" : ""} livre{livres !== 1 ? "s" : ""}
                        </Text>
                      </View>
                      <Text style={[s.caronaPreco, { color: MOD }]}>{fmtBRL(c.valor_por_vaga)}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {/* STEP: Detalhe */}
          {step === "detalhe" && detalhe && (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
              {loading && <ActivityIndicator color={MOD} style={{ marginTop: 40 }} />}
              {!loading && (
                <>
                  {/* Operadora */}
                  <View style={[s.sectionCard, { backgroundColor: C.card, borderColor: C.border }]}>
                    <View style={s.detalheTopo}>
                      <View style={[s.detalheIconBox, { backgroundColor: MOD_DIM }]}>
                        <Text style={{ fontSize: 30 }}>🚐</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.detalheEmpresa, { color: MOD }]}>{detalhe.empresa_nome}</Text>
                        {detalhe.veiculo_modelo && (
                          <Text style={[s.detalheVeiculo, { color: C.textSecondary }]}>
                            {detalhe.veiculo_modelo} {detalhe.veiculo_cor ? `· ${detalhe.veiculo_cor}` : ""} {detalhe.veiculo_placa ? `· ${detalhe.veiculo_placa}` : ""}
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={[s.statsRow, { backgroundColor: C.backgroundSecondary }]}>
                      {[
                        { icon: "calendar", val: fmtDate(detalhe.data_viagem) },
                        { icon: "clock", val: detalhe.hora_partida },
                        { icon: "users", val: `${vagas} vagas` },
                        { icon: "dollar-sign", val: fmtBRL(detalhe.valor_por_vaga) },
                      ].map(s2 => (
                        <View key={s2.icon} style={s.statItem}>
                          <Feather name={s2.icon as any} size={14} color={MOD} />
                          <Text style={[s.statText, { color: C.text }]}>{s2.val}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Rota */}
                  <Text style={[s.sectionTitle, { color: C.text }]}>📍 Rota da viagem</Text>
                  <View style={[s.sectionCard, { backgroundColor: C.card, borderColor: C.border }]}>
                    {todasParadas.map((p, i) => {
                      const isFirst = i === 0;
                      const isLast  = i === todasParadas.length - 1;
                      return (
                        <View key={p.id} style={s.paradaRow}>
                          <View style={s.paradaLine}>
                            <View style={[s.paradaDot, { backgroundColor: isFirst || isLast ? MOD : C.border }]} />
                            {!isLast && <View style={[s.paradaConnector, { backgroundColor: C.border }]} />}
                          </View>
                          <View style={s.paradaInfo}>
                            <Text style={[s.paradaCidade, { color: isFirst || isLast ? C.text : C.textSecondary }]}>
                              {p.cidade.split(",")[0]}
                            </Text>
                            {p.hora_prevista && (
                              <Text style={[s.paradaHora, { color: C.textMuted }]}>
                                {p.hora_prevista}
                                {p.aceita_embarque   && "  ↑ Embarque"}
                                {p.aceita_desembarque && "  ↓ Desembarque"}
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  {/* Observações */}
                  {detalhe.observacoes && (
                    <>
                      <Text style={[s.sectionTitle, { color: C.text }]}>📋 Observações</Text>
                      <View style={[s.sectionCard, { backgroundColor: C.card, borderColor: C.border }]}>
                        <Text style={[{ color: C.textSecondary, fontSize: 14, lineHeight: 21 }]}>{detalhe.observacoes}</Text>
                      </View>
                    </>
                  )}
                </>
              )}
            </ScrollView>
          )}
        </>
      )}

      {/* ── TAB: MINHAS RESERVAS ──────────────────────────────────────────── */}
      {tab === "reservas" && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled">
          <View style={[s.sectionCard, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[s.searchTitle, { color: C.text, marginBottom: 12 }]}>Consultar pelo telefone</Text>
            <View style={[s.inputRow, { backgroundColor: C.backgroundSecondary, borderColor: C.border }]}>
              <Feather name="phone" size={16} color={MOD} style={{ marginRight: 8 }} />
              <TextInput
                value={telefone} onChangeText={setTelefone}
                placeholder="(11) 99999-9999" placeholderTextColor={C.textMuted}
                style={[s.input, { color: C.text }]}
                keyboardType="phone-pad"
              />
            </View>
            <Pressable onPress={carregarReservas} disabled={loadingRes}
              style={[s.btnPrimary, { backgroundColor: MOD, marginTop: 12, opacity: loadingRes ? 0.7 : 1 }]}>
              {loadingRes
                ? <ActivityIndicator color="#fff" />
                : <><Feather name="search" size={16} color="#fff" /><Text style={s.btnPrimaryText}>Buscar Reservas</Text></>}
            </Pressable>
          </View>

          {reservas.length === 0 && !loadingRes && telefone.length > 3 && (
            <View style={s.emptyState}>
              <Text style={{ fontSize: 40 }}>🎫</Text>
              <Text style={[s.emptyTitle, { color: C.text }]}>Nenhuma reserva encontrada</Text>
              <Text style={[s.emptyDesc, { color: C.textSecondary }]}>Não há reservas para este número.</Text>
            </View>
          )}

          {reservas.map(r => {
            const st = STATUS_LABEL[r.status] ?? STATUS_LABEL.confirmada;
            return (
              <View key={r.id} style={[s.reservaCard, { backgroundColor: C.card, borderColor: C.border }]}>
                <View style={s.reservaTopo}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Text style={[s.reservaRota, { color: C.text }]}>
                        {r.origem?.split(",")[0]} → {r.destino?.split(",")[0]}
                      </Text>
                      <View style={[s.statusTag, { backgroundColor: st.color + "22" }]}>
                        <Text style={{ color: st.color, fontSize: 11, fontWeight: "700" }}>{st.label}</Text>
                      </View>
                    </View>
                    <Text style={[s.reservaEmpresa, { color: C.textSecondary }]}>
                      {r.empresa_nome} {r.veiculo_modelo ? `· ${r.veiculo_modelo}` : ""}
                    </Text>
                  </View>
                </View>
                <View style={[s.reservaInfo, { backgroundColor: C.backgroundSecondary }]}>
                  <InfoChip icon="calendar" label={fmtDate(r.data_viagem)} color={C.textSecondary} small />
                  <InfoChip icon="clock" label={r.hora_partida} color={C.textSecondary} small />
                  <InfoChip icon="dollar-sign" label={fmtBRL(r.valor)} color={MOD} small />
                </View>
                <Text style={[{ fontSize: 12, color: C.textMuted, marginTop: 6 }]}>
                  Embarque: {r.parada_embarque?.split(",")[0]}  →  Desembarque: {r.parada_desembarque?.split(",")[0]}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ── Botão fixo "Reservar Vaga" ──────────────────────────────────── */}
      {tab === "busca" && step === "detalhe" && detalhe && vagas > 0 && (
        <View style={[s.fixedBottom, { paddingBottom: insets.bottom + 12, borderTopColor: C.border }]}>
          <View style={s.precoRow}>
            <Text style={[s.precoLabel, { color: C.textSecondary }]}>Valor por vaga</Text>
            <Text style={[s.precoValor, { color: MOD }]}>{fmtBRL(detalhe.valor_por_vaga)}</Text>
          </View>
          <Pressable onPress={() => setBooking(true)} style={[s.btnPrimary, { backgroundColor: MOD, flex: 0 }]}>
            <Feather name="check-circle" size={18} color="#fff" />
            <Text style={s.btnPrimaryText}>Reservar Vaga</Text>
          </Pressable>
        </View>
      )}

      {tab === "busca" && step === "detalhe" && detalhe && vagas === 0 && (
        <View style={[s.fixedBottom, { paddingBottom: insets.bottom + 12, borderTopColor: C.border }]}>
          <View style={[s.semVagas, { backgroundColor: "#EF444422", borderColor: "#EF444444" }]}>
            <Feather name="alert-circle" size={16} color="#EF4444" />
            <Text style={{ color: "#EF4444", fontWeight: "700", marginLeft: 8 }}>Sem vagas disponíveis</Text>
          </View>
        </View>
      )}

      {/* ── Modal Reserva ───────────────────────────────────────────────── */}
      <Modal visible={booking} animationType="slide" transparent onRequestClose={() => setBooking(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setBooking(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.modalSheet}>
          <View style={[s.modalContent, { backgroundColor: C.card }]}>
            <View style={s.modalHandle} />
            <Text style={[s.modalTitle, { color: C.text }]}>Reservar Vaga</Text>
            <Text style={[s.modalSub, { color: C.textSecondary }]}>
              {detalhe?.origem.split(",")[0]} → {detalhe?.destino.split(",")[0]}  •  {fmtDate(detalhe?.data_viagem ?? "")}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {[
                { label: "Nome completo *", val: bNome, set: setBNome, ph: "Seu nome", kbt: "default" as const },
                { label: "Telefone *", val: bTel, set: setBTel, ph: "(11) 99999-9999", kbt: "phone-pad" as const },
                { label: "CPF", val: bCpf, set: setBCpf, ph: "000.000.000-00", kbt: "numeric" as const },
              ].map(f => (
                <View key={f.label} style={{ marginBottom: 14 }}>
                  <Text style={[s.fieldLabel, { color: C.textSecondary }]}>{f.label}</Text>
                  <TextInput
                    value={f.val} onChangeText={f.set} placeholder={f.ph}
                    placeholderTextColor={C.textMuted} keyboardType={f.kbt}
                    style={[s.modalInput, { backgroundColor: C.backgroundSecondary, borderColor: C.border, color: C.text }]}
                  />
                </View>
              ))}

              {/* Embarque / Desembarque */}
              <Text style={[s.fieldLabel, { color: C.textSecondary }]}>Embarque em</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {todasParadas.filter((_, i) => i < todasParadas.length - 1).map(p => (
                    <Pressable key={p.id} onPress={() => setBEmbarque(p.cidade)}
                      style={[s.stopChip, { backgroundColor: bEmbarque === p.cidade ? MOD : C.backgroundSecondary, borderColor: bEmbarque === p.cidade ? MOD : C.border }]}>
                      <Text style={{ color: bEmbarque === p.cidade ? "#fff" : C.textSecondary, fontSize: 12, fontWeight: "600" }}>
                        {p.cidade.split(",")[0]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              <Text style={[s.fieldLabel, { color: C.textSecondary }]}>Desembarque em</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {todasParadas.filter((_, i) => i > 0).map(p => (
                    <Pressable key={p.id} onPress={() => setBDesembarque(p.cidade)}
                      style={[s.stopChip, { backgroundColor: bDesembarque === p.cidade ? MOD : C.backgroundSecondary, borderColor: bDesembarque === p.cidade ? MOD : C.border }]}>
                      <Text style={{ color: bDesembarque === p.cidade ? "#fff" : C.textSecondary, fontSize: 12, fontWeight: "600" }}>
                        {p.cidade.split(",")[0]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              {/* Pagamento */}
              <Text style={[s.fieldLabel, { color: C.textSecondary }]}>Forma de pagamento</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {PAGAMENTOS.map(p => (
                    <Pressable key={p} onPress={() => setBPag(p)}
                      style={[s.stopChip, { backgroundColor: bPag === p ? MOD : C.backgroundSecondary, borderColor: bPag === p ? MOD : C.border }]}>
                      <Text style={{ color: bPag === p ? "#fff" : C.textSecondary, fontSize: 12, fontWeight: "600", textTransform: "capitalize" }}>
                        {p}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              <Pressable onPress={confirmarReserva} disabled={savingBook}
                style={[s.btnPrimary, { backgroundColor: MOD, opacity: savingBook ? 0.7 : 1 }]}>
                {savingBook
                  ? <ActivityIndicator color="#fff" />
                  : <><Feather name="check" size={18} color="#fff" /><Text style={s.btnPrimaryText}>Confirmar Reserva</Text></>}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── InfoChip helper ───────────────────────────────────────────────────────────
function InfoChip({ icon, label, color, small }: { icon: string; label: string; color: string; small?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Feather name={icon as any} size={small ? 11 : 13} color={color} />
      <Text style={{ color, fontSize: small ? 11 : 12 }}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:            { flex: 1 },
  header:          { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn:         { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerCenter:    { flex: 1, alignItems: "center" },
  headerTitle:     { fontSize: 17, fontWeight: "800" },
  headerSub:       { fontSize: 12, marginTop: 1 },
  tabs:            { flexDirection: "row", borderBottomWidth: 1 },
  tab:             { flex: 1, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  tabText:         { fontSize: 13, fontWeight: "600" },
  searchContainer: { padding: 16, paddingBottom: 40 },
  searchCard:      { borderRadius: 16, padding: 20, borderWidth: 1, gap: 16 },
  searchTitle:     { fontSize: 18, fontWeight: "800" },
  fieldGroup:      { gap: 6 },
  fieldLabel:      { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  inputRow:        { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  input:           { flex: 1, fontSize: 15 },
  btnPrimary:      { borderRadius: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnPrimaryText:  { color: "#fff", fontSize: 15, fontWeight: "700" },
  btnOutline:      { borderRadius: 12, borderWidth: 2, paddingVertical: 12, paddingHorizontal: 24, alignItems: "center", marginTop: 12 },
  tipCard:         { borderRadius: 14, padding: 14, borderWidth: 1, marginTop: 16 },
  caronaCard:      { borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 12, gap: 12 },
  caronaTop:       { flexDirection: "row", alignItems: "center", gap: 12 },
  caronaIconBox:   { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  caronaRoute:     { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  caronaCity:      { fontSize: 15, fontWeight: "700", maxWidth: 120 },
  caronaOperator:  { fontSize: 12, marginTop: 2 },
  caronaDivider:   { height: 1 },
  caronaInfo:      { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  caronaBottom:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  caronaPreco:     { fontSize: 20, fontWeight: "800" },
  vagasTag:        { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  emptyState:      { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 },
  emptyTitle:      { fontSize: 18, fontWeight: "700" },
  emptyDesc:       { fontSize: 14, textAlign: "center", opacity: 0.7 },
  sectionCard:     { borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 14 },
  sectionTitle:    { fontSize: 15, fontWeight: "700", marginBottom: 10, marginTop: 4 },
  detalheTopo:     { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  detalheIconBox:  { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  detalheEmpresa:  { fontSize: 17, fontWeight: "800" },
  detalheVeiculo:  { fontSize: 13, marginTop: 2 },
  statsRow:        { flexDirection: "row", flexWrap: "wrap", gap: 12, borderRadius: 12, padding: 12 },
  statItem:        { flexDirection: "row", alignItems: "center", gap: 5 },
  statText:        { fontSize: 13, fontWeight: "600" },
  paradaRow:       { flexDirection: "row", minHeight: 44 },
  paradaLine:      { width: 20, alignItems: "center" },
  paradaDot:       { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  paradaConnector: { width: 2, flex: 1, marginTop: 2 },
  paradaInfo:      { flex: 1, paddingBottom: 14, paddingLeft: 10 },
  paradaCidade:    { fontSize: 14, fontWeight: "700" },
  paradaHora:      { fontSize: 12, marginTop: 2, opacity: 0.7 },
  fixedBottom:     { borderTopWidth: 1, paddingTop: 14, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 16 },
  precoRow:        { gap: 2 },
  precoLabel:      { fontSize: 11, fontWeight: "600" },
  precoValor:      { fontSize: 22, fontWeight: "900" },
  semVagas:        { flex: 1, borderRadius: 12, borderWidth: 1, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  reservaCard:     { borderRadius: 16, padding: 14, borderWidth: 1, marginBottom: 12 },
  reservaTopo:     { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  reservaRota:     { fontSize: 15, fontWeight: "700" },
  reservaEmpresa:  { fontSize: 12, marginTop: 3 },
  reservaInfo:     { flexDirection: "row", gap: 14, borderRadius: 10, padding: 10, flexWrap: "wrap" },
  statusTag:       { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  modalOverlay:    { flex: 1, backgroundColor: "#00000060" },
  modalSheet:      { position: "absolute", bottom: 0, left: 0, right: 0 },
  modalContent:    { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "90%" },
  modalHandle:     { width: 40, height: 4, backgroundColor: "#ccc", borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalTitle:      { fontSize: 20, fontWeight: "800", marginBottom: 4 },
  modalSub:        { fontSize: 13, marginBottom: 20 },
  modalInput:      { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  stopChip:        { borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 7 },
});
