import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, StatusBar, TouchableOpacity, Alert, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useProAuth, PRO_COLORS, PRO_JOB } from "@/context/ProAuthContext";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

function fmtBRL(v: number) { return `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`; }
const MESES_G = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
function fmtData(s: string) {
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return `${d.getDate().toString().padStart(2,"0")} ${MESES_G[d.getMonth()]}`;
}
function fmtDtCurta(s: string) {
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return `${d.getDate().toString().padStart(2,"0")}/${(d.getMonth()+1).toString().padStart(2,"0")}/${d.getFullYear().toString().slice(-2)}`;
}

type RepasseSemana = {
  id: number; semana_inicio: string; semana_fim: string;
  total_ganhos: number; percentual: number; valor_repasse: number;
  status: string; comprovante?: string; pago_em?: string;
  proximo_vencimento: string; status_repasse: string;
};

const STATUS_REP: Record<string, { label: string; color: string; bg: string }> = {
  pendente:   { label: "Pendente",      color: "#F59E0B", bg: "#1C1700" },
  aguardando: { label: "Em análise",    color: "#60A5FA", bg: "#0D1A2E" },
  pago:       { label: "✓ Pago",        color: "#10B981", bg: "#071A11" },
  bloqueado:  { label: "Bloqueado",     color: "#EF4444", bg: "#1A0707" },
};

export default function ProGanhos() {
  const { proUser, refreshPerfil } = useProAuth();
  const [stats, setStats] = useState<any>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const [repasse, setRepasse] = useState<RepasseSemana | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [enviandoComprovante, setEnviandoComprovante] = useState(false);

  const tipo = proUser?.tipo_profissional || "motorista";
  const cor = PRO_COLORS[tipo];
  const taxaPct = proUser?.percentual_repasse || 3;
  const meuPct = 100 - taxaPct;
  const jobLabel = PRO_JOB[tipo];

  const load = async () => {
    if (!proUser?.token) return;
    try {
      const [sRes, hRes, rRes] = await Promise.all([
        globalThis.fetch(`${API_BASE}/motorista-app/stats`, { headers: { Authorization: `Bearer ${proUser.token}` } }),
        globalThis.fetch(`${API_BASE}/motorista-app/ganhos`, { headers: { Authorization: `Bearer ${proUser.token}` } }),
        globalThis.fetch(`${API_BASE}/motorista-app/repasse/semana`, { headers: { Authorization: `Bearer ${proUser.token}` } }),
      ]);
      if (sRes.ok) setStats(await sRes.json());
      if (hRes.ok) {
        const data = await hRes.json();
        setHistorico(Array.isArray(data) ? data : (data.ganhos || []));
      }
      if (rRes.ok) setRepasse(await rRes.json());
    } catch {}
  };

  useEffect(() => { load(); }, [proUser?.token]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    await refreshPerfil();
    setRefreshing(false);
  };

  const handleEnviarComprovante = () => {
    if (Platform.OS === "web") {
      pickAndUploadComprovante("library");
    } else {
      Alert.alert("Enviar Comprovante", "Como deseja enviar o comprovante?", [
        { text: "📷 Câmera", onPress: () => pickAndUploadComprovante("camera") },
        { text: "🖼 Galeria", onPress: () => pickAndUploadComprovante("library") },
        { text: "Cancelar", style: "cancel" },
      ]);
    }
  };

  const pickAndUploadComprovante = async (source: "camera" | "library") => {
    setEnviandoComprovante(true);
    try {
      let result: ImagePicker.ImagePickerResult;
      if (source === "camera") {
        if (Platform.OS !== "web") {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) { Alert.alert("Permissão necessária", "Permita o acesso à câmera."); setEnviandoComprovante(false); return; }
        }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
      } else {
        if (Platform.OS !== "web") {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) { Alert.alert("Permissão necessária", "Permita o acesso à galeria."); setEnviandoComprovante(false); return; }
        }
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
      }

      if (result.canceled || !result.assets?.[0]) { setEnviandoComprovante(false); return; }
      const asset = result.assets[0];

      const formData = new FormData();
      if (Platform.OS === "web") {
        const blobRes = await globalThis.fetch(asset.uri);
        const blob = await blobRes.blob();
        formData.append("file", blob, "comprovante.jpg");
      } else {
        formData.append("file", { uri: asset.uri, name: "comprovante.jpg", type: asset.mimeType || "image/jpeg" } as any);
      }

      const res = await globalThis.fetch(`${API_BASE}/motorista-app/repasse/comprovante`, {
        method: "POST",
        headers: { Authorization: `Bearer ${proUser!.token}` },
        body: formData,
      });

      if (res.ok) {
        Alert.alert("✅ Comprovante enviado!", "Nossa equipe irá confirmar o pagamento em breve.");
        await load();
      } else {
        Alert.alert("Erro", "Não foi possível enviar o comprovante. Tente novamente.");
      }
    } catch {
      Alert.alert("Erro", "Não foi possível enviar o comprovante. Tente novamente.");
    }
    setEnviandoComprovante(false);
  };

  if (!proUser) return null;

  // Use server-calculated liquid values (already account for food/PDV isenção).
  // Fallback to percentage calculation when server field absent (old API).
  const periodos = [
    {
      label: "Hoje",
      bruto: Number(stats?.hoje || 0),
      liquido: stats?.ganhos_hoje_liquido   != null ? Number(stats.ganhos_hoje_liquido)   : +(Number(stats?.hoje   || 0) * meuPct / 100),
    },
    {
      label: "Semana",
      bruto: Number(stats?.semana || 0),
      liquido: stats?.ganhos_semana_liquido != null ? Number(stats.ganhos_semana_liquido) : +(Number(stats?.semana || 0) * meuPct / 100),
    },
    {
      label: "Mês",
      bruto: Number(stats?.mes || 0),
      liquido: stats?.ganhos_mes_liquido    != null ? Number(stats.ganhos_mes_liquido)    : +(Number(stats?.mes    || 0) * meuPct / 100),
    },
    {
      label: "Total",
      bruto: Number(proUser.total_ganhos || 0),
      liquido: stats?.ganhos_total_liquido  != null ? Number(stats.ganhos_total_liquido)  : +(Number(proUser.total_ganhos || 0) * meuPct / 100),
    },
  ].map(p => ({ ...p, goTaxi: +(p.bruto - p.liquido).toFixed(2) }));

  const repStatus = repasse?.status || "pendente";
  const repCfg = STATUS_REP[repStatus] || STATUS_REP.pendente;
  const proximaSegunda = repasse?.proximo_vencimento ? new Date(repasse.proximo_vencimento) : null;
  const diasParaVencer = proximaSegunda ? Math.ceil((proximaSegunda.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const urgente = diasParaVencer !== null && diasParaVencer <= 2 && repStatus === "pendente";

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cor} />}
      >
        <Text style={styles.title}>💰 Seus Ganhos</Text>

        {/* Saldo */}
        <View style={[styles.saldoCard, { borderColor: cor + "44" }]}>
          <Text style={styles.saldoLabel}>Saldo disponível para saque</Text>
          <Text style={[styles.saldoVal, { color: cor }]}>{fmtBRL(proUser.saldo || 0)}</Text>
          <Text style={styles.saldoSub}>Você fica com {meuPct}% dos seus ganhos</Text>
        </View>

        {/* Grid períodos */}
        <View style={styles.grid}>
          {periodos.map((p, i) => (
            <View key={i} style={styles.periodoCard}>
              <Text style={styles.periodoLabel}>{p.label}</Text>
              <Text style={[styles.periodoLiquido, { color: cor }]}>{fmtBRL(p.liquido)}</Text>
              <Text style={styles.periodoBruto}>Bruto {fmtBRL(p.bruto)}</Text>
              <Text style={styles.periodoGotaxi}>GoTaxi -{fmtBRL(p.goTaxi)}</Text>
            </View>
          ))}
        </View>

        {/* Card de Repasse Semanal */}
        <View style={[styles.repasseCard, { borderColor: urgente ? "#EF4444" : repCfg.color + "55", backgroundColor: repCfg.bg }]}>
          <View style={styles.repasseHeader}>
            <Text style={styles.repasseTitle}>📋 Repasse desta semana</Text>
            <View style={[styles.repBadge, { backgroundColor: repCfg.color + "22" }]}>
              <Text style={[styles.repBadgeText, { color: repCfg.color }]}>{repCfg.label}</Text>
            </View>
          </View>

          {repasse ? (
            <>
              <View style={styles.repRow}>
                <Text style={styles.repLabel}>Semana</Text>
                <Text style={styles.repVal}>{fmtDtCurta(repasse.semana_inicio)} – {fmtDtCurta(repasse.semana_fim)}</Text>
              </View>
              <View style={styles.repRow}>
                <Text style={styles.repLabel}>Seus ganhos na semana</Text>
                <Text style={styles.repVal}>{fmtBRL(repasse.total_ganhos)}</Text>
              </View>
              <View style={styles.repRow}>
                <Text style={styles.repLabel}>Taxa GoTaxi ({repasse.percentual}%)</Text>
                <Text style={[styles.repVal, { color: "#EF4444", fontWeight: "700" }]}>{fmtBRL(repasse.valor_repasse)}</Text>
              </View>
              {proximaSegunda && repStatus === "pendente" && (
                <View style={[styles.repRow, { borderTopWidth: 1, borderTopColor: "#2A2A2A", marginTop: 4, paddingTop: 10 }]}>
                  <Text style={styles.repLabel}>Prazo de pagamento</Text>
                  <Text style={[styles.repVal, { color: urgente ? "#EF4444" : "#F59E0B", fontWeight: "700" }]}>
                    {diasParaVencer !== null && diasParaVencer <= 0 ? "Hoje!" : diasParaVencer === 1 ? "Amanhã!" : `${diasParaVencer} dias`}
                  </Text>
                </View>
              )}
              {repasse.pago_em && (
                <View style={styles.repRow}>
                  <Text style={styles.repLabel}>Pago em</Text>
                  <Text style={[styles.repVal, { color: "#10B981" }]}>{fmtDtCurta(repasse.pago_em)}</Text>
                </View>
              )}

              {/* Botão de pagar */}
              {(repStatus === "pendente") && (
                <TouchableOpacity
                  style={[styles.pagarBtn, urgente && { backgroundColor: "#7F1D1D", borderColor: "#EF4444" }]}
                  onPress={handleEnviarComprovante}
                  disabled={enviandoComprovante}
                >
                  {enviandoComprovante ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.pagarBtnText}>📎 Enviar comprovante de pagamento</Text>
                  )}
                </TouchableOpacity>
              )}
              {repStatus === "aguardando" && (
                <View style={styles.aguardandoBox}>
                  <Text style={styles.aguardandoText}>⏳ Comprovante enviado — aguardando confirmação da GoTaxi</Text>
                </View>
              )}
              {repStatus === "bloqueado" && (
                <View style={[styles.aguardandoBox, { backgroundColor: "#1A0707" }]}>
                  <Text style={[styles.aguardandoText, { color: "#EF4444" }]}>🔒 Conta bloqueada por repasse em atraso</Text>
                  <TouchableOpacity style={[styles.pagarBtn, { marginTop: 10 }]} onPress={handleEnviarComprovante} disabled={enviandoComprovante}>
                    {enviandoComprovante ? <ActivityIndicator color="#FFF" /> : <Text style={styles.pagarBtnText}>📎 Enviar comprovante para desbloquear</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </>
          ) : (
            <View style={{ alignItems: "center", paddingVertical: 12 }}>
              <ActivityIndicator color={cor} />
            </View>
          )}

          <Text style={styles.repasseInfo}>
            Pague via PIX ou transferência e envie o comprovante. Vencimento toda segunda-feira.
          </Text>
        </View>

        {/* Como funciona */}
        <View style={styles.comoFuncCard}>
          <Text style={styles.comoFuncTitle}>Como funciona seu repasse</Text>
          {[
            { label: "Valor total do serviço", val: "100%", color: "#FFF" },
            { label: `(-) Taxa GoTaxi`, val: `-${taxaPct}%`, color: "#EF4444" },
            { label: "= Você recebe", val: `${meuPct}%`, color: cor, bold: true },
          ].map((row, i) => (
            <View key={i} style={[styles.repasseRow, row.bold && styles.repasseRowTotal]}>
              <Text style={[styles.repasseRowLabel, row.bold && { fontWeight: "700", color: row.color }]}>{row.label}</Text>
              <Text style={[styles.repasseRowVal, { color: row.color }]}>{row.val}</Text>
            </View>
          ))}
        </View>

        {/* Histórico */}
        {historico.length > 0 && (
          <>
            <Text style={styles.histTitle}>Histórico de {jobLabel.toLowerCase()}</Text>
            {historico.slice(0, 30).map((item: any, i: number) => {
              const bruto = Number(item.valor || item.valor_bruto || 0);
              const liquido = +(bruto * meuPct / 100).toFixed(2);
              return (
                <View key={i} style={styles.histItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.histDesc}>{item.descricao || `${jobLabel} #${item.id || i + 1}`}</Text>
                    <Text style={styles.histData}>{item.criado_em ? fmtData(item.criado_em) : ""}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.histLiquido, { color: cor }]}>{fmtBRL(liquido)}</Text>
                    <Text style={styles.histBruto}>{fmtBRL(bruto)} bruto</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {historico.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTxt}>Nenhum ganho registrado ainda</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0D0D0D" },
  scroll: { padding: 20, gap: 16, paddingBottom: 30 },
  title: { fontSize: 22, fontWeight: "900", color: "#FFF" },
  saldoCard: { backgroundColor: "#1A1A1A", borderRadius: 20, padding: 24, borderWidth: 1, alignItems: "center", gap: 6 },
  saldoLabel: { fontSize: 13, color: "#8896B0", fontWeight: "600" },
  saldoVal: { fontSize: 42, fontWeight: "900" },
  saldoSub: { fontSize: 12, color: "#555" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  periodoCard: { flex: 1, minWidth: "45%", backgroundColor: "#1A1A1A", borderRadius: 16, padding: 14, gap: 3 },
  periodoLabel: { fontSize: 11, color: "#8896B0", fontWeight: "700", textTransform: "uppercase" },
  periodoLiquido: { fontSize: 20, fontWeight: "900" },
  periodoBruto: { fontSize: 11, color: "#555" },
  periodoGotaxi: { fontSize: 11, color: "#EF4444" },
  repasseCard: { borderRadius: 16, padding: 16, gap: 8, borderWidth: 1 },
  repasseHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  repasseTitle: { fontSize: 14, fontWeight: "700", color: "#FFF" },
  repBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  repBadgeText: { fontSize: 12, fontWeight: "700" },
  repRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  repLabel: { fontSize: 13, color: "#8896B0" },
  repVal: { fontSize: 13, color: "#FFF" },
  pagarBtn: { marginTop: 8, backgroundColor: "#1E3A2F", borderWidth: 1, borderColor: "#10B981", borderRadius: 12, padding: 14, alignItems: "center" },
  pagarBtnText: { color: "#10B981", fontSize: 14, fontWeight: "700" },
  aguardandoBox: { marginTop: 8, backgroundColor: "#0D1A2E", borderRadius: 12, padding: 12 },
  aguardandoText: { color: "#60A5FA", fontSize: 13, textAlign: "center" },
  repasseInfo: { fontSize: 11, color: "#555", marginTop: 4, textAlign: "center" },
  comoFuncCard: { backgroundColor: "#1A1A1A", borderRadius: 16, padding: 16, gap: 10 },
  comoFuncTitle: { fontSize: 13, fontWeight: "700", color: "#8896B0", marginBottom: 4 },
  repasseRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  repasseRowTotal: { borderTopWidth: 1, borderTopColor: "#2A2A2A", marginTop: 4, paddingTop: 10 },
  repasseRowLabel: { fontSize: 14, color: "#8896B0" },
  repasseRowVal: { fontSize: 14, fontWeight: "700" },
  histTitle: { fontSize: 16, fontWeight: "700", color: "#FFF" },
  histItem: { flexDirection: "row", backgroundColor: "#1A1A1A", borderRadius: 12, padding: 14, gap: 10 },
  histDesc: { fontSize: 14, color: "#FFF", fontWeight: "600" },
  histData: { fontSize: 12, color: "#555", marginTop: 2 },
  histLiquido: { fontSize: 16, fontWeight: "800" },
  histBruto: { fontSize: 12, color: "#555" },
  empty: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyIcon: { fontSize: 48 },
  emptyTxt: { fontSize: 15, color: "#555", fontWeight: "600" },
});
