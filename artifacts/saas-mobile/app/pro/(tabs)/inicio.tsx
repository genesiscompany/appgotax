import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, StatusBar, Animated, Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useProAuth, PRO_COLORS, PRO_LABELS, PRO_ICONS, PRO_JOB } from "@/context/ProAuthContext";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

function fmtBRL(v: number) {
  return `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`;
}

export default function ProInicio() {
  const { proUser, refreshPerfil, online, setOnline } = useProAuth();
  const [stats, setStats] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pdvCount, setPdvCount] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const entregasPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tipo = proUser?.tipo_profissional || "motorista";
  const cor = PRO_COLORS[tipo];
  const repasse = Number(proUser?.percentual_repasse) || 3;
  const meuPct = 100 - repasse;

  // Pulse animation when online
  useEffect(() => {
    if (online) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation(); pulseAnim.setValue(1);
      glowAnim.stopAnimation(); glowAnim.setValue(0);
    }
  }, [online]);

  const loadStats = async () => {
    if (!proUser?.token) return;
    try {
      const res = await fetch(`${API_BASE}/motorista-app/stats`, {
        headers: { Authorization: `Bearer ${proUser.token}` },
      });
      if (res.ok) setStats(await res.json());
    } catch {}
  };

  const loadEntregasPdv = async () => {
    if (!proUser?.token) return;
    try {
      const res = await fetch(`${API_BASE}/motorista-app/pdv/minhas-entregas`, {
        headers: { Authorization: `Bearer ${proUser.token}` },
      });
      if (res.ok) {
        const list = await res.json();
        setPdvCount(Array.isArray(list) ? list.length : 0);
      }
    } catch {}
  };

  useEffect(() => { loadStats(); }, [proUser?.token]);

  // Poll PDV deliveries every 20s so motoboy sees new assignments without push
  useEffect(() => {
    if (!proUser?.token) return;
    loadEntregasPdv();
    entregasPollRef.current = setInterval(loadEntregasPdv, 20000);
    return () => { if (entregasPollRef.current) clearInterval(entregasPollRef.current); };
  }, [proUser?.token]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), refreshPerfil()]);
    setRefreshing(false);
  };

  if (!proUser) return null;

  const hojeB  = Number(stats?.hoje  || 0);
  // Use server-calculated liquid (already respects food/PDV isenção). Fallback for old API.
  const hojeL  = stats?.ganhos_hoje_liquido   != null
    ? Number(stats.ganhos_hoje_liquido)
    : +(hojeB * meuPct / 100).toFixed(2);
  const semanaB = Number(stats?.semana || 0);
  const semanaL = stats?.ganhos_semana_liquido != null
    ? Number(stats.ganhos_semana_liquido)
    : +(semanaB * meuPct / 100).toFixed(2);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={cor} />}
      >
        {/* Saudação */}
        <View style={styles.greeting}>
          <View>
            <Text style={styles.greetHi}>Olá, {proUser.nome.split(" ")[0]} 👋</Text>
            <Text style={[styles.greetTipo, { color: cor }]}>
              {PRO_ICONS[tipo]}  {PRO_LABELS[tipo]}
            </Text>
          </View>
          {proUser.avaliacao_media > 0 && (
            <View style={styles.rating}>
              <Text style={styles.ratingStar}>★</Text>
              <Text style={styles.ratingVal}>{Number(proUser.avaliacao_media).toFixed(1)}</Text>
            </View>
          )}
        </View>

        {/* Card de entregas PDV — só aparece quando há atribuições */}
        {pdvCount > 0 && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push("/pro/entregas-pdv" as any)}
            style={styles.pdvCard}
          >
            <View style={styles.pdvIconBox}>
              <Text style={{ fontSize: 26 }}>🛵</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pdvLabel}>
                {pdvCount === 1 ? "Você tem 1 entrega ativa" : `Você tem ${pdvCount} entregas ativas`}
              </Text>
              <Text style={styles.pdvDesc}>Toque para ver os pedidos do restaurante</Text>
            </View>
            <View style={styles.pdvBadge}>
              <Text style={styles.pdvBadgeTxt}>{pdvCount}</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Toggle online — botão grande central */}
        <View style={styles.onlineWrapper}>
          {/* Anel de glow animado */}
          {online && (
            <Animated.View style={[
              styles.onlineGlow,
              { borderColor: cor, opacity: glowAnim },
            ]} />
          )}
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Pressable
              onPress={() => setOnline(v => !v)}
              style={({ pressed }) => [
                styles.onlineBtn,
                { backgroundColor: online ? cor : "#1A1A1A", borderColor: online ? cor : "#333" },
                pressed && { opacity: 0.85 },
              ]}
            >
              {/* Ícone de energia */}
              <Text style={[styles.onlinePower, { color: online ? "#FFF" : "#444" }]}>⏻</Text>
              <Text style={[styles.onlineMainLabel, { color: online ? "#FFF" : "#555" }]}>
                {online ? "ONLINE" : "OFFLINE"}
              </Text>
            </Pressable>
          </Animated.View>

          <Text style={[styles.onlineSubLabel, { color: online ? cor : "#555" }]}>
            {online
              ? `Recebendo ${PRO_JOB[tipo].toLowerCase()} • Toque para parar`
              : "Toque para começar a receber"}
          </Text>

          {/* Indicador de status */}
          <View style={styles.onlineStatusRow}>
            <View style={[styles.onlineStatusDot, { backgroundColor: online ? "#10B981" : "#EF4444" }]} />
            <Text style={[styles.onlineStatusTxt, { color: online ? "#10B981" : "#EF4444" }]}>
              {online ? "Disponível para novos pedidos" : "Não está recebendo pedidos"}
            </Text>
          </View>
        </View>

        {/* Ganho do dia */}
        <View style={[styles.bigCard, { borderColor: cor + "44" }]}>
          <Text style={styles.bigCardLabel}>Seus ganhos hoje</Text>
          <Text style={[styles.bigValue, { color: cor }]}>{fmtBRL(hojeL)}</Text>
          <View style={styles.bigRow}>
            <View style={styles.bigItem}>
              <Text style={styles.bigItemLabel}>Bruto</Text>
              <Text style={styles.bigItemVal}>{fmtBRL(hojeB)}</Text>
            </View>
            <View style={styles.bigDivider} />
            <View style={styles.bigItem}>
              <Text style={styles.bigItemLabel}>Repasse GoTaxi</Text>
              <Text style={[styles.bigItemVal, { color: "#EF4444" }]}>-{fmtBRL(+(hojeB - hojeL).toFixed(2))}</Text>
            </View>
          </View>
        </View>

        {/* Stats grid */}
        <View style={styles.grid}>
          {[
            { label: "Esta semana",          value: fmtBRL(semanaL),                           icon: "📅" },
            { label: "Total acumulado",       value: fmtBRL(+(Number(proUser.total_ganhos) * meuPct / 100).toFixed(2)), icon: "💰" },
            { label: PRO_JOB[tipo] + " feitas", value: String(proUser.total_corridas || 0),    icon: PRO_ICONS[tipo] },
            { label: "Saldo p/ saque",        value: fmtBRL(proUser.saldo || 0),               icon: "🏦" },
          ].map((item, i) => (
            <View key={i} style={styles.statCard}>
              <Text style={styles.statIcon}>{item.icon}</Text>
              <Text style={styles.statVal}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Viagem compartilhada (só motoristas) */}
        {tipo === "motorista" && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push("/pro/oferecer-carona" as any)}
            style={styles.caronaCard}
          >
            <View style={styles.caronaIconBox}>
              <Text style={{ fontSize: 22 }}>🚗</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.caronaLabel}>Oferecer carona</Text>
              <Text style={styles.caronaDesc}>Vai viajar? Ofereça vagas no seu carro e ganhe extra.</Text>
            </View>
            <Text style={styles.caronaArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* Divisão */}
        <View style={styles.divCard}>
          <Text style={styles.divTitle}>Divisão dos seus ganhos</Text>
          <View style={styles.divBar}>
            <View style={[styles.divSegment, { flex: meuPct, backgroundColor: cor }]} />
            <View style={[styles.divSegment, { flex: repasse, backgroundColor: "#2A2A2A" }]} />
          </View>
          <View style={styles.divLegend}>
            <Text style={[styles.divLegTxt, { color: cor }]}>Você {meuPct}%</Text>
            <Text style={styles.divLegTxt}>GoTaxi {repasse}%</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0D0D0D" },
  scroll: { padding: 20, gap: 16, paddingBottom: 30 },
  greeting: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  greetHi: { fontSize: 24, fontWeight: "900", color: "#FFF" },
  greetTipo: { fontSize: 14, fontWeight: "600", marginTop: 3 },
  rating: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#1A1A1A", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  ratingStar: { color: "#F5C518", fontSize: 16 },
  ratingVal: { color: "#FFF", fontWeight: "800", fontSize: 15 },
  onlineWrapper: { alignItems: "center", gap: 14, paddingVertical: 8 },
  onlineGlow: { position: "absolute", width: 126, height: 126, borderRadius: 63, borderWidth: 16, borderColor: "transparent", top: -10 },
  onlineBtn: { width: 106, height: 106, borderRadius: 53, borderWidth: 3, alignItems: "center", justifyContent: "center", gap: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
  onlinePower: { fontSize: 36, lineHeight: 42 },
  onlineMainLabel: { fontSize: 12, fontWeight: "900", letterSpacing: 2 },
  onlineSubLabel: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  onlineStatusRow: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "#1A1A1A", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  onlineStatusDot: { width: 8, height: 8, borderRadius: 4 },
  onlineStatusTxt: { fontSize: 12, fontWeight: "700" },
  bigCard: { backgroundColor: "#1A1A1A", borderRadius: 20, padding: 24, borderWidth: 1, gap: 12 },
  bigCardLabel: { fontSize: 13, color: "#8896B0", fontWeight: "600" },
  bigValue: { fontSize: 44, fontWeight: "900" },
  bigRow: { flexDirection: "row", gap: 16 },
  bigItem: { flex: 1, gap: 3 },
  bigItemLabel: { fontSize: 11, color: "#555" },
  bigItemVal: { fontSize: 16, fontWeight: "700", color: "#FFF" },
  bigDivider: { width: 1, backgroundColor: "#2A2A2A" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { flex: 1, minWidth: "45%", backgroundColor: "#1A1A1A", borderRadius: 16, padding: 16, gap: 5 },
  statIcon: { fontSize: 22 },
  statVal: { fontSize: 18, fontWeight: "800", color: "#FFF" },
  statLabel: { fontSize: 11, color: "#8896B0" },
  divCard: { backgroundColor: "#1A1A1A", borderRadius: 16, padding: 18, gap: 10 },
  divTitle: { fontSize: 13, fontWeight: "700", color: "#8896B0" },
  divBar: { flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", gap: 2 },
  divSegment: { borderRadius: 5 },
  divLegend: { flexDirection: "row", justifyContent: "space-between" },
  divLegTxt: { fontSize: 13, fontWeight: "700", color: "#8896B0" },
  pdvCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#0F2A1E", borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: "#10B98166" },
  pdvIconBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: "#10B98122", alignItems: "center", justifyContent: "center" },
  pdvLabel: { fontSize: 15, fontWeight: "900", color: "#10B981" },
  pdvDesc: { fontSize: 12, color: "#6EE7B7", marginTop: 2 },
  pdvBadge: { minWidth: 28, height: 28, borderRadius: 14, backgroundColor: "#10B981", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  pdvBadgeTxt: { color: "#FFF", fontSize: 14, fontWeight: "900" },
  caronaCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#150D25", borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: "#A78BFA44" },
  caronaIconBox: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#A78BFA22", alignItems: "center", justifyContent: "center" },
  caronaLabel: { fontSize: 15, fontWeight: "800", color: "#A78BFA" },
  caronaDesc: { fontSize: 11, color: "#7B6FA0", marginTop: 2, lineHeight: 16 },
  caronaArrow: { fontSize: 26, color: "#A78BFA", fontWeight: "300" },
});
