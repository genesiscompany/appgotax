import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  StatusBar, TouchableOpacity, Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useProAuth, PRO_COLORS, PRO_JOB } from "@/context/ProAuthContext";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

type Agendamento = {
  id: number;
  tipo: string;
  data_hora: string;
  local_embarque: string;
  local_destino?: string;
  valor: number;
  cliente_nome?: string;
  cliente_whatsapp?: string;
  observacoes?: string;
  status: string;
};

function fmtBRL(v: number) { return `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`; }

function fmtDataHora(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const hoje = new Date();
  const amanha = new Date(hoje); amanha.setDate(amanha.getDate() + 1);
  const isHoje = d.toDateString() === hoje.toDateString();
  const isAmanha = d.toDateString() === amanha.toDateString();
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  const hora = `${h}:${m}`;
  const MESES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  const dataCurta = `${d.getDate().toString().padStart(2,"0")} ${MESES[d.getMonth()]}`;
  if (isHoje)   return `Hoje às ${hora}`;
  if (isAmanha) return `Amanhã às ${hora}`;
  return `${dataCurta} às ${hora}`;
}

function tempoRestante(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Agora";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `em ${h}h ${m}min`;
  return `em ${m}min`;
}

const TIPO_ICON: Record<string, string> = {
  corrida:  "🚗",
  entrega:  "📦",
  delivery: "🍔",
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  pendente: { label: "Aguardando confirmação", color: "#F59E0B", bg: "#1C1700" },
  aceito:   { label: "Confirmado",             color: "#10B981", bg: "#071A11" },
};

export default function ProAgenda() {
  const { proUser } = useProAuth();
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [atualizando, setAtualizando] = useState<number | null>(null);

  const tipo = proUser?.tipo_profissional || "motorista";
  const cor = PRO_COLORS[tipo];

  const load = useCallback(async () => {
    if (!proUser?.token) { setLoading(false); return; }
    try {
      const res = await fetch(`${API_BASE}/motorista-app/agenda`, {
        headers: { Authorization: `Bearer ${proUser.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAgendamentos(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.log("[Agenda] fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [proUser?.token]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const handleAceitar = async (item: Agendamento) => {
    Alert.alert(
      "Confirmar agendamento",
      `Aceitar ${item.tipo === "corrida" ? "corrida" : "entrega"} agendada para ${fmtDataHora(item.data_hora)}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Aceitar",
          onPress: async () => {
            setAtualizando(item.id);
            try {
              await globalThis.fetch(`${API_BASE}/motorista-app/agenda/${item.id}/aceitar`, {
                method: "POST",
                headers: { Authorization: `Bearer ${proUser!.token}` },
              });
              setAgendamentos(prev => prev.map(a => a.id === item.id ? { ...a, status: "aceito" } : a));
            } catch { Alert.alert("Erro", "Não foi possível aceitar."); }
            setAtualizando(null);
          },
        },
      ]
    );
  };

  const handleRecusar = async (item: Agendamento) => {
    Alert.alert(
      "Recusar agendamento",
      "Tem certeza que deseja recusar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Recusar",
          style: "destructive",
          onPress: async () => {
            setAtualizando(item.id);
            try {
              await globalThis.fetch(`${API_BASE}/motorista-app/agenda/${item.id}/recusar`, {
                method: "POST",
                headers: { Authorization: `Bearer ${proUser!.token}` },
              });
              setAgendamentos(prev => prev.filter(a => a.id !== item.id));
            } catch { Alert.alert("Erro", "Não foi possível recusar."); }
            setAtualizando(null);
          },
        },
      ]
    );
  };

  const pendentes = agendamentos.filter(a => a.status === "pendente");
  const aceitos   = agendamentos.filter(a => a.status === "aceito");

  if (!proUser) return null;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cor} />}
      >
        <Text style={styles.title}>📅 Agenda</Text>
        <Text style={styles.subtitle}>{PRO_JOB[tipo]} agendadas para você</Text>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={cor} size="large" /></View>
        ) : agendamentos.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyTitle}>Nenhum agendamento</Text>
            <Text style={styles.emptySub}>Quando o admin criar agendamentos para você, eles aparecerão aqui.</Text>
          </View>
        ) : (
          <>
            {/* Pendentes — precisa responder */}
            {pendentes.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionDot} />
                  <Text style={styles.sectionLabel}>Aguardando sua resposta ({pendentes.length})</Text>
                </View>
                {pendentes.map(item => (
                  <View key={item.id} style={[styles.card, { borderColor: "#F59E0B44" }]}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardIcon}>{TIPO_ICON[item.tipo] || "📋"}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.cardDataHora, { color: cor }]}>{fmtDataHora(item.data_hora)}</Text>
                        <Text style={styles.cardTempo}>{tempoRestante(item.data_hora)}</Text>
                      </View>
                      <Text style={styles.cardValor}>{fmtBRL(item.valor)}</Text>
                    </View>

                    <View style={styles.cardBody}>
                      <View style={styles.rota}>
                        <View style={styles.rotaRow}>
                          <View style={[styles.rotaDot, { backgroundColor: "#10B981" }]} />
                          <Text style={styles.rotaTxt} numberOfLines={1}>{item.local_embarque}</Text>
                        </View>
                        {item.local_destino && (
                          <View style={styles.rotaRow}>
                            <View style={[styles.rotaDot, { backgroundColor: "#EF4444" }]} />
                            <Text style={styles.rotaTxt} numberOfLines={1}>{item.local_destino}</Text>
                          </View>
                        )}
                      </View>

                      {item.cliente_nome && (
                        <View style={styles.clienteRow}>
                          <Text style={styles.clienteLabel}>Cliente</Text>
                          <Text style={styles.clienteNome}>{item.cliente_nome}</Text>
                        </View>
                      )}
                      {item.observacoes && (
                        <View style={[styles.obsBox]}>
                          <Text style={styles.obsText}>📝 {item.observacoes}</Text>
                        </View>
                      )}
                    </View>

                    {/* Botões de ação */}
                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={styles.btnRecusar}
                        onPress={() => handleRecusar(item)}
                        disabled={atualizando === item.id}
                      >
                        {atualizando === item.id
                          ? <ActivityIndicator color="#EF4444" size="small" />
                          : <Text style={styles.btnRecusarTxt}>Recusar</Text>
                        }
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.btnAceitar, { backgroundColor: cor }]}
                        onPress={() => handleAceitar(item)}
                        disabled={atualizando === item.id}
                      >
                        {atualizando === item.id
                          ? <ActivityIndicator color="#FFF" size="small" />
                          : <Text style={styles.btnAceitarTxt}>✓ Aceitar</Text>
                        }
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* Aceitos — confirmados */}
            {aceitos.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <View style={[styles.sectionDot, { backgroundColor: "#10B981" }]} />
                  <Text style={styles.sectionLabel}>Confirmados ({aceitos.length})</Text>
                </View>
                {aceitos.map(item => (
                  <View key={item.id} style={[styles.card, { borderColor: "#10B98144" }]}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardIcon}>{TIPO_ICON[item.tipo] || "📋"}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.cardDataHora, { color: "#10B981" }]}>{fmtDataHora(item.data_hora)}</Text>
                        <Text style={styles.cardTempo}>{tempoRestante(item.data_hora)}</Text>
                      </View>
                      <Text style={styles.cardValor}>{fmtBRL(item.valor)}</Text>
                    </View>
                    <View style={styles.cardBody}>
                      <View style={styles.rota}>
                        <View style={styles.rotaRow}>
                          <View style={[styles.rotaDot, { backgroundColor: "#10B981" }]} />
                          <Text style={styles.rotaTxt} numberOfLines={1}>{item.local_embarque}</Text>
                        </View>
                        {item.local_destino && (
                          <View style={styles.rotaRow}>
                            <View style={[styles.rotaDot, { backgroundColor: "#EF4444" }]} />
                            <Text style={styles.rotaTxt} numberOfLines={1}>{item.local_destino}</Text>
                          </View>
                        )}
                      </View>
                      {item.cliente_nome && (
                        <View style={styles.clienteRow}>
                          <Text style={styles.clienteLabel}>Cliente</Text>
                          <Text style={styles.clienteNome}>{item.cliente_nome}</Text>
                        </View>
                      )}
                      <View style={[styles.confirmedBadge]}>
                        <Text style={styles.confirmedTxt}>✓ Você confirmou este agendamento</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0D0D0D" },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "900", color: "#FFF" },
  subtitle: { fontSize: 13, color: "#555", marginTop: -8 },
  center: { paddingVertical: 60, alignItems: "center" },
  emptyBox: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyIcon: { fontSize: 52 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#FFF" },
  emptySub: { fontSize: 13, color: "#555", textAlign: "center", lineHeight: 20 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  sectionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#F59E0B" },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: "#8896B0", textTransform: "uppercase", letterSpacing: 0.5 },
  card: { backgroundColor: "#1A1A1A", borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, paddingBottom: 12 },
  cardIcon: { fontSize: 28 },
  cardDataHora: { fontSize: 16, fontWeight: "800" },
  cardTempo: { fontSize: 12, color: "#555", marginTop: 2 },
  cardValor: { fontSize: 20, fontWeight: "900", color: "#FFF" },
  cardBody: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  rota: { backgroundColor: "#111", borderRadius: 12, padding: 12, gap: 8 },
  rotaRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  rotaDot: { width: 10, height: 10, borderRadius: 5 },
  rotaTxt: { flex: 1, fontSize: 13, color: "#DDD", fontWeight: "500" },
  clienteRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  clienteLabel: { fontSize: 12, color: "#555" },
  clienteNome: { fontSize: 13, fontWeight: "700", color: "#FFF" },
  obsBox: { backgroundColor: "#111", borderRadius: 10, padding: 10 },
  obsText: { fontSize: 12, color: "#8896B0", lineHeight: 18 },
  actions: { flexDirection: "row", gap: 10, padding: 16, paddingTop: 0 },
  btnRecusar: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: "#EF444444", backgroundColor: "#1A0707", alignItems: "center" },
  btnRecusarTxt: { color: "#EF4444", fontWeight: "700", fontSize: 14 },
  btnAceitar: { flex: 2, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  btnAceitarTxt: { color: "#FFF", fontWeight: "800", fontSize: 15 },
  confirmedBadge: { backgroundColor: "#071A11", borderRadius: 10, padding: 10, alignItems: "center" },
  confirmedTxt: { color: "#10B981", fontSize: 13, fontWeight: "700" },
});
