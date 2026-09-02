import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useColorScheme,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

const STATS = [
  { label: "Corridas Hoje", value: "24", icone: "navigation" as const, cor: Colors.modules.motorista, delta: "+12%" },
  { label: "Pedidos", value: "87", icone: "shopping-bag" as const, cor: Colors.modules.ecommerce, delta: "+8%" },
  { label: "Agendamentos", value: "15", icone: "calendar" as const, cor: Colors.modules.servicos, delta: "+3%" },
  { label: "Passagens", value: "42", icone: "map-pin" as const, cor: Colors.modules.passagens, delta: "+5%" },
  { label: "Entregas", value: "33", icone: "package" as const, cor: Colors.modules.entrega, delta: "+19%" },
  { label: "Food Orders", value: "61", icone: "coffee" as const, cor: Colors.modules.food, delta: "+22%" },
];

const RECENT_ACTIVITY = [
  { id: "1", desc: "Nova corrida solicitada", modulo: "Motorista", tempo: "há 2 min", cor: Colors.modules.motorista, icone: "navigation" as const },
  { id: "2", desc: "Pedido #1234 confirmado", modulo: "E-commerce", tempo: "há 5 min", cor: Colors.modules.ecommerce, icone: "shopping-bag" as const },
  { id: "3", desc: "Agendamento para amanhã", modulo: "Serviços", tempo: "há 12 min", cor: Colors.modules.servicos, icone: "calendar" as const },
  { id: "4", desc: "Entrega concluída - João", modulo: "Entrega", tempo: "há 18 min", cor: Colors.modules.entrega, icone: "check-circle" as const },
  { id: "5", desc: "Novo restaurante cadastrado", modulo: "Food", tempo: "há 25 min", cor: Colors.modules.food, icone: "coffee" as const },
];

function StatCard({ item, colors }: { item: typeof STATS[0]; colors: typeof Colors.light }) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: item.cor + "20" }]}>
        <Feather name={item.icone} size={20} color={item.cor} />
      </View>
      <Text style={[styles.statValue, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{item.value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{item.label}</Text>
      <View style={[styles.statDelta, { backgroundColor: "#10B98120" }]}>
        <Feather name="trending-up" size={11} color="#10B981" />
        <Text style={[styles.statDeltaText, { fontFamily: "Inter_500Medium" }]}>{item.delta}</Text>
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0) + 16;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topPadding, paddingBottom: insets.bottom + 100, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Dashboard</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
            Visão geral de hoje
          </Text>
        </View>

        <View style={[styles.revenueCard, { backgroundColor: colors.tint, shadowColor: colors.tint }]}>
          <Text style={[styles.revenueLabel, { fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)" }]}>
            Receita Total Hoje
          </Text>
          <Text style={[styles.revenueValue, { fontFamily: "Inter_700Bold", color: "#fff" }]}>
            R$ 12.847,00
          </Text>
          <View style={styles.revenueRow}>
            <Feather name="trending-up" size={14} color="rgba(255,255,255,0.85)" />
            <Text style={[styles.revenueDelta, { fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.85)" }]}>
              {" "}+18.3% vs ontem
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>
          Por Módulo
        </Text>

        <View style={styles.statsGrid}>
          {STATS.map(item => (
            <StatCard key={item.label} item={item} colors={colors} />
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>
          Atividade Recente
        </Text>

        <View style={[styles.activityList, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {RECENT_ACTIVITY.map((item, index) => (
            <View key={item.id}>
              <View style={styles.activityItem}>
                <View style={[styles.activityIcon, { backgroundColor: item.cor + "20" }]}>
                  <Feather name={item.icone} size={16} color={item.cor} />
                </View>
                <View style={styles.activityContent}>
                  <Text style={[styles.activityDesc, { color: colors.text, fontFamily: "Inter_500Medium" }]}>
                    {item.desc}
                  </Text>
                  <Text style={[styles.activityMeta, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                    {item.modulo} · {item.tempo}
                  </Text>
                </View>
              </View>
              {index < RECENT_ACTIVITY.length - 1 && (
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { marginBottom: 20 },
  title: { fontSize: 26, marginBottom: 4 },
  subtitle: { fontSize: 14 },
  revenueCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  revenueLabel: { fontSize: 13, marginBottom: 8 },
  revenueValue: { fontSize: 32, marginBottom: 8 },
  revenueRow: { flexDirection: "row", alignItems: "center" },
  revenueDelta: { fontSize: 13 },
  sectionTitle: { fontSize: 17, marginBottom: 14 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    width: "47%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  statValue: { fontSize: 24, marginBottom: 2 },
  statLabel: { fontSize: 12, marginBottom: 8 },
  statDelta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  statDeltaText: { fontSize: 11, color: "#10B981" },
  activityList: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  activityContent: { flex: 1 },
  activityDesc: { fontSize: 14, marginBottom: 2 },
  activityMeta: { fontSize: 12 },
  divider: { height: 1, marginHorizontal: 14 },
});
