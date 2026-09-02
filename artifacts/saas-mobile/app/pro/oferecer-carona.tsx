import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, StatusBar, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useProAuth } from "@/context/ProAuthContext";

const COLOR = "#A78BFA";
const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "http://localhost:8080/api";

interface Carona {
  id: number;
  origem: string;
  destino: string;
  distancia_km: number | null;
  data_viagem: string;
  hora_partida: string;
  vagas_total: number;
  vagas_ocupadas: number;
  valor_por_vaga: number | string;
  status: string;
}

const fmtBRL = (v: any) => `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`;

function todayYMD() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function OferecerCarona() {
  const { proUser } = useProAuth();
  const token = proUser?.token;

  const [caronas, setCaronas] = useState<Carona[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [data, setData] = useState(todayYMD());
  const [hora, setHora] = useState("08:00");
  const [vagas, setVagas] = useState("2");
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");
  const [distancia, setDistancia] = useState<number | null>(null);
  const [valorPorKm, setValorPorKm] = useState(0.8);

  const [calculando, setCalculando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function loadCfg() {
    try {
      const r = await fetch(`${API_BASE}/public/caronas/config`);
      if (r.ok) { const cfg = await r.json(); setValorPorKm(Number(cfg.valor_por_km ?? 0.8)); }
    } catch {}
  }

  async function loadCaronas() {
    if (!token) return;
    try {
      const r = await fetch(`${API_BASE}/motorista-app/caronas`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setCaronas(await r.json());
    } catch {}
  }

  useEffect(() => { loadCfg(); loadCaronas(); }, [token]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadCfg(), loadCaronas()]);
    setRefreshing(false);
  };

  function resetForm() {
    setOrigem(""); setDestino(""); setData(todayYMD()); setHora("08:00");
    setVagas("2"); setValor(""); setObs(""); setDistancia(null);
  }

  async function calcularDistancia() {
    if (!origem.trim() || !destino.trim()) {
      Alert.alert("Informe as cidades", "Preencha origem e destino antes de calcular.");
      return;
    }
    setCalculando(true);
    try {
      const r = await fetch(`${API_BASE}/public/distancia?origem=${encodeURIComponent(origem.trim())}&destino=${encodeURIComponent(destino.trim())}`);
      const d = await r.json();
      if (!r.ok || !d.distancia_km) {
        Alert.alert("Não consegui calcular", d?.detail || "Tente ser mais específico (ex.: 'São Paulo, SP').");
        return;
      }
      const km = Number(d.distancia_km);
      setDistancia(km);
      const sugestao = (km * valorPorKm).toFixed(2);
      setValor(sugestao);
      Alert.alert("Distância calculada",
        `${d.distancia_texto} (≈ ${d.duracao_texto}).\n\nValor sugerido: R$ ${sugestao} por passageiro (${km} km × R$ ${valorPorKm.toFixed(2)}/km).\n\nVocê pode ajustar.`);
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Tente novamente.");
    } finally { setCalculando(false); }
  }

  async function publicar() {
    if (!origem.trim() || !destino.trim()) { Alert.alert("Preencha origem e destino"); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) { Alert.alert("Data inválida", "Formato: AAAA-MM-DD"); return; }
    if (!/^\d{2}:\d{2}$/.test(hora)) { Alert.alert("Hora inválida", "Formato: HH:MM"); return; }
    const v = Number(valor.replace(",", "."));
    if (!v || v <= 0) { Alert.alert("Informe o valor por vaga"); return; }
    const nv = Number(vagas);
    if (!nv || nv < 1) { Alert.alert("Informe vagas válidas (1 a 8)"); return; }

    setSalvando(true);
    try {
      const r = await fetch(`${API_BASE}/motorista-app/caronas`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          origem: origem.trim(), destino: destino.trim(),
          distancia_km: distancia,
          data_viagem: data, hora_partida: hora,
          vagas_total: nv, valor_por_vaga: v,
          observacoes: obs.trim() || null,
        }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        Alert.alert("Não foi possível publicar", body?.message || body?.error || "Verifique os dados e tente novamente.");
        return;
      }
      Alert.alert("Viagem publicada!", "Sua carona já aparece para passageiros no app.");
      setShowForm(false);
      resetForm();
      loadCaronas();
    } catch (e: any) {
      Alert.alert("Erro de conexão", e?.message || "Tente novamente.");
    } finally { setSalvando(false); }
  }

  async function cancelar(id: number) {
    Alert.alert("Cancelar carona?", "Os passageiros que já reservaram serão afetados.", [
      { text: "Voltar", style: "cancel" },
      {
        text: "Cancelar viagem", style: "destructive",
        onPress: async () => {
          try {
            await fetch(`${API_BASE}/motorista-app/caronas/${id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            loadCaronas();
          } catch {}
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />

      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Text style={s.backTxt}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Oferecer carona</Text>
          <Text style={s.sub}>Publique trechos de viagens suas</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: 40, gap: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLOR} />}
      >
        {!showForm && (
          <TouchableOpacity style={s.ctaBtn} onPress={() => setShowForm(true)} activeOpacity={0.85}>
            <Text style={s.ctaTxt}>+ Publicar nova viagem</Text>
          </TouchableOpacity>
        )}

        {showForm && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Nova viagem compartilhada</Text>

            <Text style={s.label}>De onde sai (cidade)</Text>
            <TextInput style={s.input} value={origem} onChangeText={setOrigem} placeholder="Ex.: Campinas, SP" placeholderTextColor="#555" />

            <Text style={s.label}>Para onde vai (cidade)</Text>
            <TextInput style={s.input} value={destino} onChangeText={setDestino} placeholder="Ex.: Belo Horizonte, MG" placeholderTextColor="#555" />

            <TouchableOpacity style={s.calcBtn} onPress={calcularDistancia} disabled={calculando}>
              {calculando ? <ActivityIndicator color={COLOR} /> : <Text style={s.calcTxt}>Calcular distância e sugerir valor</Text>}
            </TouchableOpacity>
            {distancia != null && (
              <Text style={s.hint}>📍 Distância: {distancia} km · sugerido R$ {(distancia * valorPorKm).toFixed(2)} por vaga</Text>
            )}

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Data</Text>
                <TextInput style={s.input} value={data} onChangeText={setData} placeholder="AAAA-MM-DD" placeholderTextColor="#555" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Hora</Text>
                <TextInput style={s.input} value={hora} onChangeText={setHora} placeholder="HH:MM" placeholderTextColor="#555" />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Vagas</Text>
                <TextInput style={s.input} value={vagas} onChangeText={setVagas} keyboardType="numeric" placeholder="2" placeholderTextColor="#555" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Valor por vaga (R$)</Text>
                <TextInput style={s.input} value={valor} onChangeText={setValor} keyboardType="decimal-pad" placeholder="50.00" placeholderTextColor="#555" />
              </View>
            </View>

            <Text style={s.label}>Observações (opcional)</Text>
            <TextInput style={[s.input, { height: 80 }]} value={obs} onChangeText={setObs}
              placeholder="Ex.: saída do centro, bagagem média, só pets pequenos..." placeholderTextColor="#555" multiline />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <TouchableOpacity style={s.btnCancel} onPress={() => { setShowForm(false); resetForm(); }}>
                <Text style={s.btnCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnSave} onPress={publicar} disabled={salvando}>
                {salvando ? <ActivityIndicator color="#000" /> : <Text style={s.btnSaveTxt}>Publicar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Text style={s.sectionLbl}>Minhas caronas</Text>

        {caronas.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>🗺️</Text>
            <Text style={s.emptyTitle}>Nenhuma viagem publicada</Text>
            <Text style={s.emptyDesc}>Toque em “Publicar nova viagem” para oferecer vagas do seu próximo trecho.</Text>
          </View>
        )}

        {caronas.map(c => (
          <View key={c.id} style={s.caronaCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={s.caronaRoute}>{c.origem} → {c.destino}</Text>
              <Text style={[s.caronaStatus, { color: c.status === "ativa" ? "#10B981" : "#EF4444" }]}>
                {c.status === "ativa" ? "Ativa" : c.status}
              </Text>
            </View>
            <Text style={s.caronaMeta}>{c.data_viagem} · {String(c.hora_partida).slice(0, 5)}{c.distancia_km ? ` · ${c.distancia_km} km` : ""}</Text>
            <View style={s.caronaFoot}>
              <Text style={s.caronaValor}>{fmtBRL(c.valor_por_vaga)}/vaga</Text>
              <Text style={s.caronaVagas}>{c.vagas_ocupadas}/{c.vagas_total} ocupadas</Text>
            </View>
            {c.status === "ativa" && (
              <TouchableOpacity onPress={() => cancelar(c.id)} style={s.cancelBtn}>
                <Text style={s.cancelTxt}>Cancelar viagem</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0D0D0D" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#1A1A1A" },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#1A1A1A", alignItems: "center", justifyContent: "center" },
  backTxt: { color: "#FFF", fontSize: 22, fontWeight: "700", marginTop: -2 },
  title: { color: "#FFF", fontSize: 18, fontWeight: "800" },
  sub: { color: "#8896B0", fontSize: 12 },
  ctaBtn: { backgroundColor: COLOR, borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  ctaTxt: { color: "#FFF", fontSize: 15, fontWeight: "800" },
  card: { backgroundColor: "#141421", borderRadius: 18, padding: 18, gap: 4, borderWidth: 1, borderColor: "#2A2340" },
  cardTitle: { color: "#FFF", fontSize: 16, fontWeight: "800", marginBottom: 8 },
  label: { color: "#8896B0", fontSize: 12, fontWeight: "700", marginTop: 8, marginBottom: 6 },
  input: { backgroundColor: "#0D0D0D", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: "#FFF", borderWidth: 1, borderColor: "#2A2340", fontSize: 14 },
  calcBtn: { marginTop: 10, borderRadius: 12, paddingVertical: 12, alignItems: "center", borderWidth: 1.5, borderColor: COLOR, backgroundColor: COLOR + "15" },
  calcTxt: { color: COLOR, fontSize: 13, fontWeight: "700" },
  hint: { color: "#A78BFA", fontSize: 12, marginTop: 6 },
  btnCancel: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "#333" },
  btnCancelTxt: { color: "#FFF", fontWeight: "700" },
  btnSave: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: "center", backgroundColor: "#F5C518" },
  btnSaveTxt: { color: "#000", fontWeight: "800" },
  sectionLbl: { color: "#8896B0", fontSize: 12, fontWeight: "800", letterSpacing: 1, marginTop: 6, textTransform: "uppercase" },
  empty: { alignItems: "center", gap: 8, paddingVertical: 32 },
  emptyIcon: { fontSize: 38 },
  emptyTitle: { color: "#FFF", fontWeight: "800" },
  emptyDesc: { color: "#8896B0", fontSize: 12, textAlign: "center", paddingHorizontal: 24 },
  caronaCard: { backgroundColor: "#1A1A1A", borderRadius: 14, padding: 14, gap: 6 },
  caronaRoute: { color: "#FFF", fontWeight: "800", flex: 1, fontSize: 14 },
  caronaStatus: { fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  caronaMeta: { color: "#8896B0", fontSize: 12 },
  caronaFoot: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  caronaValor: { color: COLOR, fontWeight: "800" },
  caronaVagas: { color: "#8896B0", fontSize: 12 },
  cancelBtn: { marginTop: 10, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: "#EF444420" },
  cancelTxt: { color: "#EF4444", fontSize: 12, fontWeight: "700" },
});
