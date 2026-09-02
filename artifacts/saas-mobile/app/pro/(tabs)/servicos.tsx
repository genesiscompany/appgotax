import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, StatusBar, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useProAuth, PRO_COLORS, PRO_JOB, PRO_ICONS } from "@/context/ProAuthContext";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const POLL_MS = 5000;

function fmtBRL(v: number) { return `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`; }
function fmtHora(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
}
function fmtData(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const hoje = new Date();
  const MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  if (d.toDateString() === hoje.toDateString()) return `Hoje ${fmtHora(iso)}`;
  return `${d.getDate().toString().padStart(2,"0")} ${MESES[d.getMonth()]} ${fmtHora(iso)}`;
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  aceita:       { text: "A caminho do cliente", color: "#F59E0B" },
  em_andamento: { text: "Em andamento",          color: "#3B82F6" },
};

type Ativa = {
  id: number;
  corrida_id?: number;
  status: string;
  categoria_nome?: string;
  valor_estimado: number;
  cliente_nome?: string;
  // Corrida
  origem_endereco?: string;
  destino_endereco?: string;
  // Entrega
  coleta_endereco?: string;
  entrega_endereco?: string;
  descricao_item?: string;
  tipo_servico?: string;
};

type HistItem = {
  id: number;
  cliente_nome?: string;
  origem_endereco?: string;
  destino_endereco?: string;
  coleta_endereco?: string;
  entrega_endereco?: string;
  valor: number;
  criado_em: string;
  categoria_nome?: string;
};

export default function ProServicos() {
  const { proUser, online } = useProAuth();
  const [ativa, setAtiva] = useState<Ativa | null>(null);
  const [historico, setHistorico] = useState<HistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tipo = proUser?.tipo_profissional || "motorista";
  const cor = PRO_COLORS[tipo];
  const jobLabel = PRO_JOB[tipo];
  const icon = PRO_ICONS[tipo];
  const isEntregador = tipo === "entregador" || tipo === "delivery";

  const loadAtiva = useCallback(async () => {
    if (!proUser?.token) return;
    try {
      const endpoint = isEntregador ? "entrega-ativa" : "corrida-ativa";
      const res = await fetch(`${API_BASE}/motorista-app/${endpoint}`, {
        headers: { Authorization: `Bearer ${proUser.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAtiva(data);
      }
    } catch {}
  }, [proUser?.token, isEntregador]);

  const loadHistorico = useCallback(async () => {
    if (!proUser?.token) return;
    try {
      const res = await fetch(`${API_BASE}/motorista-app/ganhos`, {
        headers: { Authorization: `Bearer ${proUser.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const corridas = Array.isArray(data) ? data : (data.corridas || []);
        setHistorico(corridas.slice(0, 5));
      }
    } catch {}
  }, [proUser?.token]);

  const load = useCallback(async () => {
    await Promise.all([loadAtiva(), loadHistorico()]);
  }, [loadAtiva, loadHistorico]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  useEffect(() => {
    if (!online) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    pollRef.current = setInterval(loadAtiva, POLL_MS);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [online, loadAtiva]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleContinuar = () => {
    if (!ativa) return;
    if (isEntregador) {
      router.push({
        pathname: "/pro/entrega-ativa",
        params: {
          entregaId: String(ativa.id),
          fase: ativa.status === "aceita" ? "coleta" : "destino",
          coletaEndereco: ativa.coleta_endereco ?? "",
          entregaEndereco: ativa.entrega_endereco ?? "",
          categoriaName: ativa.categoria_nome ?? jobLabel,
          valorEstimado: String(ativa.valor_estimado),
          clienteNome: ativa.cliente_nome ?? "Cliente",
          descricaoItem: ativa.descricao_item ?? "",
          tipoServico: ativa.tipo_servico ?? tipo,
        },
      });
    } else {
      router.push({
        pathname: "/pro/corrida-ativa",
        params: {
          corridaId: String(ativa.id),
          mainCorridaId: String(ativa.corrida_id ?? ativa.id),
          fase: ativa.status === "aceita" ? "embarque" : "destino",
          origemEndereco: ativa.origem_endereco ?? "",
          destinoEndereco: ativa.destino_endereco ?? "",
          categoriaName: ativa.categoria_nome ?? "GoTaxi",
          valorEstimado: String(ativa.valor_estimado),
          clienteNome: ativa.cliente_nome ?? "Cliente",
        },
      });
    }
  };

  if (!proUser) return null;

  const origemAtiva = isEntregador ? ativa?.coleta_endereco : ativa?.origem_endereco;
  const destinoAtiva = isEntregador ? ativa?.entrega_endereco : ativa?.destino_endereco;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cor} />}
      >
        <Text style={styles.title}>{icon} {jobLabel}</Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={cor} size="large" />
          </View>
        ) : ativa ? (
          <>
            {/* Corrida/Entrega ativa */}
            <View style={[styles.ativaCard, { borderColor: cor + "55" }]}>
              <View style={styles.ativaHeader}>
                <View style={styles.atBadge}>
                  <View style={[styles.atDot, { backgroundColor: cor }]} />
                  <Text style={[styles.atBadgeTxt, { color: cor }]}>
                    {STATUS_LABEL[ativa.status]?.text ?? "Em andamento"}
                  </Text>
                </View>
                <Text style={[styles.ativaValor, { color: cor }]}>
                  {fmtBRL(ativa.valor_estimado)}
                </Text>
              </View>

              {ativa.cliente_nome && (
                <View style={styles.clienteRow}>
                  <Text style={styles.clienteIcon}>👤</Text>
                  <Text style={styles.clienteNome}>{ativa.cliente_nome}</Text>
                  {ativa.categoria_nome && (
                    <View style={styles.catBadge}>
                      <Text style={styles.catBadgeTxt}>{ativa.categoria_nome}</Text>
                    </View>
                  )}
                </View>
              )}

              <View style={styles.rota}>
                <View style={styles.rotaRow}>
                  <View style={[styles.rotaDot, { backgroundColor: "#10B981" }]} />
                  <Text style={styles.rotaAddr} numberOfLines={2}>
                    {isEntregador ? "Coleta: " : "Origem: "}{origemAtiva || "—"}
                  </Text>
                </View>
                <View style={[styles.rotaLine, { borderColor: cor + "44" }]} />
                <View style={styles.rotaRow}>
                  <View style={[styles.rotaDot, { backgroundColor: "#EF4444" }]} />
                  <Text style={styles.rotaAddr} numberOfLines={2}>
                    {isEntregador ? "Entrega: " : "Destino: "}{destinoAtiva || "—"}
                  </Text>
                </View>
              </View>

              {ativa.descricao_item && (
                <View style={styles.descBox}>
                  <Text style={styles.descTxt}>📦 {ativa.descricao_item}</Text>
                </View>
              )}

              <TouchableOpacity style={[styles.btnContinuar, { backgroundColor: cor }]} onPress={handleContinuar}>
                <Text style={styles.btnContinuarTxt}>
                  {icon} Continuar {isEntregador ? "entrega" : "corrida"}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : !online ? (
          <View style={styles.offlineBox}>
            <Text style={styles.offlineIcon}>🔴</Text>
            <Text style={styles.offlineTxt}>Você está offline</Text>
            <Text style={styles.offlineSub}>Fique online na tela Início para receber {jobLabel.toLowerCase()}</Text>
          </View>
        ) : (
          <View style={styles.waitBox}>
            <View style={[styles.waitPulse, { borderColor: cor + "55", backgroundColor: cor + "11" }]}>
              <Text style={styles.waitIcon}>{icon}</Text>
            </View>
            <Text style={styles.waitTxt}>Aguardando {jobLabel.toLowerCase()}s</Text>
            <Text style={styles.waitSub}>Você receberá uma notificação quando houver uma nova solicitação</Text>
          </View>
        )}

        {/* Histórico recente */}
        {historico.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionDot} />
              <Text style={styles.sectionLabel}>Recentes</Text>
            </View>
            {historico.map((h) => {
              const origem = isEntregador ? h.coleta_endereco : h.origem_endereco;
              const destino = isEntregador ? h.entrega_endereco : h.destino_endereco;
              return (
                <View key={h.id} style={styles.histCard}>
                  <View style={styles.histTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.histData}>{fmtData(h.criado_em)}</Text>
                      {h.cliente_nome && <Text style={styles.histCliente}>{h.cliente_nome}</Text>}
                    </View>
                    <Text style={[styles.histValor, { color: cor }]}>{fmtBRL(h.valor)}</Text>
                  </View>
                  {origem && (
                    <View style={styles.histRota}>
                      <Text style={styles.histAddr} numberOfLines={1}>📍 {origem}</Text>
                      {destino && <Text style={styles.histAddr} numberOfLines={1}>🏁 {destino}</Text>}
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}

        {!ativa && historico.length === 0 && !loading && (
          <View style={styles.emptyHist}>
            <Text style={styles.emptyHistTxt}>Nenhum serviço concluído ainda</Text>
            <Text style={styles.emptyHistSub}>Seu histórico aparecerá aqui</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0D0D0D" },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "900", color: "#FFF" },
  center: { paddingVertical: 60, alignItems: "center" },

  ativaCard: {
    backgroundColor: "#141414", borderRadius: 20, borderWidth: 1.5,
    padding: 18, gap: 14,
  },
  ativaHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  atBadge: { flexDirection: "row", alignItems: "center", gap: 7 },
  atDot: { width: 8, height: 8, borderRadius: 4 },
  atBadgeTxt: { fontSize: 13, fontWeight: "700" },
  ativaValor: { fontSize: 24, fontWeight: "900" },
  clienteRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  clienteIcon: { fontSize: 14 },
  clienteNome: { flex: 1, fontSize: 14, fontWeight: "700", color: "#FFF" },
  catBadge: { backgroundColor: "#2A2A2A", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  catBadgeTxt: { fontSize: 11, fontWeight: "700", color: "#8896B0" },
  rota: { backgroundColor: "#0D0D0D", borderRadius: 14, padding: 14, gap: 6 },
  rotaRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  rotaDot: { width: 10, height: 10, borderRadius: 5, marginTop: 3 },
  rotaLine: { marginLeft: 4, height: 14, width: 1.5, borderLeftWidth: 1.5, borderStyle: "dashed", marginVertical: 2 },
  rotaAddr: { flex: 1, fontSize: 13, color: "#CCC", lineHeight: 19 },
  descBox: { backgroundColor: "#1A1500", borderRadius: 10, padding: 10 },
  descTxt: { fontSize: 13, color: "#D4A800" },
  btnContinuar: {
    borderRadius: 16, paddingVertical: 16, alignItems: "center",
  },
  btnContinuarTxt: { fontSize: 16, fontWeight: "900", color: "#000" },

  offlineBox: { alignItems: "center", paddingVertical: 60, gap: 10 },
  offlineIcon: { fontSize: 48 },
  offlineTxt: { fontSize: 18, fontWeight: "700", color: "#555" },
  offlineSub: { fontSize: 13, color: "#333", textAlign: "center", lineHeight: 20 },

  waitBox: { alignItems: "center", paddingVertical: 50, gap: 16 },
  waitPulse: {
    width: 100, height: 100, borderRadius: 50, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  waitIcon: { fontSize: 42 },
  waitTxt: { fontSize: 16, fontWeight: "700", color: "#FFF" },
  waitSub: { fontSize: 13, color: "#555", textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },

  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  sectionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#333" },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: "#555", textTransform: "uppercase", letterSpacing: 0.5 },

  histCard: { backgroundColor: "#141414", borderRadius: 16, padding: 14, gap: 8 },
  histTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  histData: { fontSize: 12, color: "#555", marginBottom: 2 },
  histCliente: { fontSize: 14, fontWeight: "700", color: "#CCC" },
  histValor: { fontSize: 18, fontWeight: "900" },
  histRota: { gap: 3 },
  histAddr: { fontSize: 12, color: "#444" },

  emptyHist: { alignItems: "center", paddingTop: 20, gap: 6 },
  emptyHistTxt: { fontSize: 14, color: "#333", fontWeight: "600" },
  emptyHistSub: { fontSize: 12, color: "#282828" },
});
