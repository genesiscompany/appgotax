import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { Colors, PRO_TYPE_COLORS, PRO_JOB_LABEL } from "@/constants/colors";
import { apiFetch } from "@/constants/api";

function fmtBRL(v: number) { return `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`; }
function fmtDate(s: string) { return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }); }

export default function GanhosScreen() {
  const { user, token } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const cor = user ? PRO_TYPE_COLORS[user.tipo_profissional] || Colors.primary : Colors.primary;
  const repasse = user?.percentual_repasse || 20;
  const meuPct = 100 - repasse;
  const jobLabel = user ? PRO_JOB_LABEL[user.tipo_profissional] || "Serviços" : "Serviços";

  const load = async () => {
    if (!token) return;
    try {
      const [sRes, hRes] = await Promise.all([
        apiFetch("/api/motorista-app/stats", {}, token),
        apiFetch("/api/motorista-app/ganhos", {}, token),
      ]);
      if (sRes.ok) setStats(await sRes.json());
      if (hRes.ok) {
        const data = await hRes.json();
        setHistory(Array.isArray(data) ? data : (data.ganhos || []));
      }
    } catch (_) {}
  };

  useEffect(() => { load(); }, [token]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!user) return null;

  const periodos = [
    { label: "Hoje",     bruto: Number(stats?.hoje || 0),    liquido: +(Number(stats?.hoje || 0) * meuPct / 100).toFixed(2) },
    { label: "Semana",   bruto: Number(stats?.semana || 0),   liquido: +(Number(stats?.semana || 0) * meuPct / 100).toFixed(2) },
    { label: "Mês",      bruto: Number(stats?.mes || 0),      liquido: +(Number(stats?.mes || 0) * meuPct / 100).toFixed(2) },
    { label: "Total",    bruto: Number(user.total_ganhos || 0), liquido: +(Number(user.total_ganhos || 0) * meuPct / 100).toFixed(2) },
  ];

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cor} />}
      >
        <Text style={styles.title}>💰 Ganhos</Text>

        {/* Saldo disponível */}
        <View style={[styles.saldoCard, { backgroundColor: cor + "18", borderColor: cor + "44" }]}>
          <Text style={styles.saldoLabel}>Saldo disponível para saque</Text>
          <Text style={[styles.saldoValue, { color: cor }]}>{fmtBRL(user.saldo || 0)}</Text>
          <Text style={styles.saldoSub}>Repasse automático toda sexta-feira</Text>
        </View>

        {/* Períodos */}
        <View style={styles.periodosGrid}>
          {periodos.map((p, i) => (
            <View key={i} style={styles.periodoCard}>
              <Text style={styles.periodoLabel}>{p.label}</Text>
              <Text style={[styles.periodoLiquido, { color: cor }]}>{fmtBRL(p.liquido)}</Text>
              <Text style={styles.periodoBruto}>Bruto: {fmtBRL(p.bruto)}</Text>
              <Text style={styles.periodoRepasse}>GoTaxi: {fmtBRL(+(p.bruto * repasse / 100).toFixed(2))}</Text>
            </View>
          ))}
        </View>

        {/* Breakdown */}
        <View style={styles.breakdownCard}>
          <Text style={styles.breakdownTitle}>Como funciona</Text>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Valor bruto do serviço</Text>
            <Text style={styles.breakdownVal}>100%</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={[styles.breakdownLabel, { color: Colors.danger }]}>(-) Repasse GoTaxi</Text>
            <Text style={[styles.breakdownVal, { color: Colors.danger }]}>-{repasse}%</Text>
          </View>
          <View style={[styles.breakdownRow, styles.breakdownTotal]}>
            <Text style={[styles.breakdownLabel, { color: cor, fontWeight: "700" }]}>= Você recebe</Text>
            <Text style={[styles.breakdownVal, { color: cor, fontWeight: "800" }]}>{meuPct}%</Text>
          </View>
        </View>

        {/* Histórico */}
        {history.length > 0 && (
          <>
            <Text style={styles.histTitle}>Histórico de {jobLabel.toLowerCase()}</Text>
            {history.slice(0, 20).map((item: any, i: number) => {
              const bruto = Number(item.valor || item.valor_bruto || 0);
              const liquido = +(bruto * meuPct / 100).toFixed(2);
              return (
                <View key={i} style={styles.histItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.histDesc}>{item.descricao || `${jobLabel} #${item.id || i + 1}`}</Text>
                    <Text style={styles.histDate}>{item.criado_em ? fmtDate(item.criado_em) : ""}</Text>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, gap: 16 },
  title: { fontSize: 22, fontWeight: "800", color: Colors.text },
  saldoCard: { borderRadius: 20, padding: 24, borderWidth: 1, alignItems: "center", gap: 6 },
  saldoLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: "600" },
  saldoValue: { fontSize: 40, fontWeight: "900" },
  saldoSub: { fontSize: 12, color: Colors.textSecondary },
  periodosGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  periodoCard: { flex: 1, minWidth: "45%", backgroundColor: Colors.surface, borderRadius: 16, padding: 14, gap: 3 },
  periodoLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: "600" },
  periodoLiquido: { fontSize: 20, fontWeight: "800" },
  periodoBruto: { fontSize: 11, color: Colors.textMuted },
  periodoRepasse: { fontSize: 11, color: Colors.textMuted },
  breakdownCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, gap: 10 },
  breakdownTitle: { fontSize: 13, fontWeight: "700", color: Colors.textSecondary, marginBottom: 4 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between" },
  breakdownTotal: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10, marginTop: 4 },
  breakdownLabel: { fontSize: 14, color: Colors.text },
  breakdownVal: { fontSize: 14, color: Colors.text },
  histTitle: { fontSize: 16, fontWeight: "700", color: Colors.text },
  histItem: { flexDirection: "row", backgroundColor: Colors.surface, borderRadius: 12, padding: 14, gap: 10 },
  histDesc: { fontSize: 14, color: Colors.text, fontWeight: "600" },
  histDate: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  histLiquido: { fontSize: 16, fontWeight: "800" },
  histBruto: { fontSize: 12, color: Colors.textMuted },
});
