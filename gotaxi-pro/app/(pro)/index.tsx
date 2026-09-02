import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { Colors, PRO_TYPE_COLORS, PRO_TYPE_LABELS, PRO_TYPE_ICONS, PRO_JOB_LABEL } from "@/constants/colors";
import { apiFetch } from "@/constants/api";

function fmtBRL(v: number) { return `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`; }

export default function HomeScreen() {
  const { user, token, refreshPerfil } = useAuth();
  const [online, setOnline] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const cor = user ? PRO_TYPE_COLORS[user.tipo_profissional] || Colors.primary : Colors.primary;

  const load = async () => {
    if (!token) return;
    try {
      const res = await apiFetch("/api/motorista-app/stats", {}, token);
      if (res.ok) setStats(await res.json());
    } catch (_) {}
  };

  useEffect(() => { load(); }, [token]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), refreshPerfil()]);
    setRefreshing(false);
  };

  if (!user) return null;

  const repasse = user.percentual_repasse || 20;
  const meuPct = 100 - repasse;
  const hoje = Number(stats?.hoje || 0);
  const hojeL = +(hoje * meuPct / 100).toFixed(2);

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cor} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Olá, {user.nome.split(" ")[0]} 👋</Text>
            <Text style={[styles.tipo, { color: cor }]}>
              {PRO_TYPE_ICONS[user.tipo_profissional]} {PRO_TYPE_LABELS[user.tipo_profissional]}
            </Text>
          </View>
          {user.avaliacao_media > 0 && (
            <View style={styles.rating}>
              <Text style={styles.ratingStar}>★</Text>
              <Text style={styles.ratingVal}>{Number(user.avaliacao_media).toFixed(1)}</Text>
            </View>
          )}
        </View>

        {/* Online toggle */}
        <View style={[styles.onlineCard, { borderColor: online ? cor : Colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.onlineLabel, { color: online ? cor : Colors.textSecondary }]}>
              {online ? `🟢 Online — recebendo ${PRO_JOB_LABEL[user.tipo_profissional].toLowerCase()}` : "⚫ Offline — parado no momento"}
            </Text>
            <Text style={styles.onlineDesc}>{online ? "Toque para ficar offline" : "Toque para ficar online"}</Text>
          </View>
          <Switch
            value={online}
            onValueChange={setOnline}
            trackColor={{ false: Colors.border, true: cor + "66" }}
            thumbColor={online ? cor : Colors.textMuted}
          />
        </View>

        {/* Ganhos do dia */}
        <View style={[styles.bigCard, { backgroundColor: cor + "18", borderColor: cor + "44" }]}>
          <Text style={styles.bigCardLabel}>Ganhos de hoje</Text>
          <Text style={[styles.bigCardValue, { color: cor }]}>{fmtBRL(hojeL)}</Text>
          <Text style={styles.bigCardSub}>
            Bruto: {fmtBRL(hoje)} · Repasse GoTaxi: {fmtBRL(+(hoje * repasse / 100).toFixed(2))} ({repasse}%)
          </Text>
        </View>

        {/* Stats grid */}
        <View style={styles.grid}>
          {[
            { label: "Esta semana", value: fmtBRL(+(Number(stats?.semana || 0) * meuPct / 100).toFixed(2)), icon: "📅" },
            { label: "Total ganhos", value: fmtBRL(+(Number(user.total_ganhos || 0) * meuPct / 100).toFixed(2)), icon: "💰" },
            { label: `Total ${PRO_JOB_LABEL[user.tipo_profissional].toLowerCase()}`, value: String(user.total_corridas || 0), icon: PRO_TYPE_ICONS[user.tipo_profissional] },
            { label: "Saldo disponível", value: fmtBRL(user.saldo || 0), icon: "🏦" },
          ].map((item, i) => (
            <View key={i} style={styles.statCard}>
              <Text style={styles.statIcon}>{item.icon}</Text>
              <Text style={styles.statValue}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Repasse info */}
        <View style={styles.repasseCard}>
          <Text style={styles.repasseTitle}>Divisão de ganhos</Text>
          <View style={styles.repasseRow}>
            <View style={[styles.repasseBar, { flex: meuPct, backgroundColor: cor }]} />
            <View style={[styles.repasseBar, { flex: repasse, backgroundColor: Colors.border }]} />
          </View>
          <View style={styles.repasseLegend}>
            <Text style={[styles.repasseLbl, { color: cor }]}>Você {meuPct}%</Text>
            <Text style={[styles.repasseLbl, { color: Colors.textSecondary }]}>GoTaxi {repasse}%</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 20, gap: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  greeting: { fontSize: 22, fontWeight: "800", color: Colors.text },
  tipo: { fontSize: 14, fontWeight: "600", marginTop: 2 },
  rating: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  ratingStar: { color: "#F59E0B", fontSize: 16 },
  ratingVal: { color: Colors.text, fontWeight: "700", fontSize: 15 },
  onlineCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1.5 },
  onlineLabel: { fontSize: 14, fontWeight: "600" },
  onlineDesc: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  bigCard: { borderRadius: 20, padding: 24, borderWidth: 1, alignItems: "center", gap: 6 },
  bigCardLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: "600" },
  bigCardValue: { fontSize: 40, fontWeight: "900" },
  bigCardSub: { fontSize: 12, color: Colors.textSecondary, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { flex: 1, minWidth: "45%", backgroundColor: Colors.surface, borderRadius: 16, padding: 16, gap: 4 },
  statIcon: { fontSize: 24 },
  statValue: { fontSize: 18, fontWeight: "800", color: Colors.text },
  statLabel: { fontSize: 11, color: Colors.textSecondary },
  repasseCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, gap: 10 },
  repasseTitle: { fontSize: 13, fontWeight: "700", color: Colors.textSecondary },
  repasseRow: { flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", gap: 2 },
  repasseBar: { borderRadius: 5 },
  repasseLegend: { flexDirection: "row", justifyContent: "space-between" },
  repasseLbl: { fontSize: 13, fontWeight: "700" },
});
