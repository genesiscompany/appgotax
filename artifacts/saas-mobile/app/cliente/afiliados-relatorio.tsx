import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  ActivityIndicator, useColorScheme, Share, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import { useCustomerAuth } from "@/context/CustomerAuthContext";

const GREEN = "#22C55E";
const GREEN_DARK = "#16A34A";
const EMERALD = "#10B981";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "http://localhost:8080/api";

function fmt(v: number) {
  return `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`;
}
function fmtDate(d: string) {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  return `${dt.getDate().toString().padStart(2,"0")}/${(dt.getMonth()+1).toString().padStart(2,"0")}/${dt.getFullYear()}`;
}

export default function AfiliadosRelatorio() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const { customer } = useCustomerAuth();
  const token = customer?.token;

  const [loading, setLoading] = useState(true);
  const [comissoes, setComissoes] = useState<any[]>([]);
  const [resgates, setResgates] = useState<any[]>([]);
  const [indicados, setIndicados] = useState<any[]>([]);
  const [tab, setTab] = useState<"comissoes" | "indicados" | "resgates">("comissoes");

  const bg = isDark ? "#0f172a" : "#f8fafc";
  const card = isDark ? "#1e293b" : "#ffffff";
  const border = isDark ? "#334155" : "#e2e8f0";
  const text = isDark ? "#f1f5f9" : "#1e293b";
  const sub = isDark ? "#94a3b8" : "#64748b";

  const authHeader = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch(`${API_BASE}/cliente/afiliados/indicados`, { headers: authHeader }),
      fetch(`${API_BASE}/cliente/afiliados/resgates`, { headers: authHeader }),
      fetch(`${API_BASE}/cliente/afiliados/comissoes`, { headers: authHeader }),
    ])
      .then(async ([iRes, rRes, cRes]) => {
        if (iRes.ok) setIndicados(await iRes.json());
        if (rRes.ok) setResgates(await rRes.json());
        if (cRes.ok) setComissoes(await cRes.json());
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const totalGanho = comissoes.reduce((s, c) => s + Number(c.valor_comissao ?? 0), 0);
  const totalSacado = resgates.filter(r => r.status === "pago").reduce((s, r) => s + Number(r.valor ?? 0), 0);
  const totalPendente = resgates.filter(r => r.status === "pendente").reduce((s, r) => s + Number(r.valor ?? 0), 0);

  function handleCompartilhar() {
    const linhas = [
      `📊 Meu Relatório GoTaxi Afiliados`,
      ``,
      `✅ Indicados: ${indicados.length}`,
      `💰 Total ganho: ${fmt(totalGanho)}`,
      `💸 Total sacado: ${fmt(totalSacado)}`,
      `⏳ Saques pendentes: ${fmt(totalPendente)}`,
    ];
    Share.share({ message: linhas.join("\n"), title: "Relatório GoTaxi Afiliados" });
  }

  const TABS = [
    { id: "comissoes" as const, label: "Comissões" },
    { id: "indicados" as const, label: "Indicados" },
    { id: "resgates" as const, label: "Saques" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <LinearGradient colors={[GREEN_DARK, GREEN, EMERALD]} style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={s.headerTitle}>Relatório de Afiliados</Text>
          <Text style={s.headerSub}>Histórico completo</Text>
        </View>
        <Pressable onPress={handleCompartilhar} style={s.shareBtn} hitSlop={8}>
          <Feather name="share-2" size={20} color="#fff" />
        </Pressable>
      </LinearGradient>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={GREEN} size="large" />
        </View>
      ) : (
        <>
          {/* Summary cards */}
          <View style={s.summaryRow}>
            <View style={[s.summaryCard, { backgroundColor: card, borderColor: border }]}>
              <Text style={[s.summaryVal, { color: GREEN }]}>{indicados.length}</Text>
              <Text style={[s.summaryLabel, { color: sub }]}>Indicados</Text>
            </View>
            <View style={[s.summaryCard, { backgroundColor: card, borderColor: border }]}>
              <Text style={[s.summaryVal, { color: EMERALD }]}>{fmt(totalSacado)}</Text>
              <Text style={[s.summaryLabel, { color: sub }]}>Sacado</Text>
            </View>
            <View style={[s.summaryCard, { backgroundColor: card, borderColor: border }]}>
              <Text style={[s.summaryVal, { color: "#F59E0B" }]}>{fmt(totalPendente)}</Text>
              <Text style={[s.summaryLabel, { color: sub }]}>Pendente</Text>
            </View>
          </View>

          {/* Tabs */}
          <View style={[s.tabRow, { borderBottomColor: border }]}>
            {TABS.map(t => (
              <Pressable key={t.id} onPress={() => setTab(t.id)}
                style={[s.tabBtn, tab === t.id && { borderBottomColor: GREEN, borderBottomWidth: 2 }]}>
                <Text style={[s.tabLabel, { color: tab === t.id ? GREEN : sub }]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, paddingTop: 12 }}>
            {tab === "comissoes" && (
              comissoes.length === 0 ? (
                <View style={[s.emptyBox, { backgroundColor: card, borderColor: border }]}>
                  <Feather name="bar-chart-2" size={32} color={sub} />
                  <Text style={[s.emptyTitle, { color: text }]}>Sem comissões ainda</Text>
                  <Text style={[s.emptyDesc, { color: sub }]}>As comissões aparecem quando seus indicados fazem transações.</Text>
                </View>
              ) : comissoes.map((c, i) => (
                <View key={i} style={[s.row, { backgroundColor: card, borderColor: border }]}>
                  <View style={[s.iconCircle, { backgroundColor: EMERALD + "20" }]}>
                    <Feather name="trending-up" size={16} color={EMERALD} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.rowTitle, { color: text }]}>{c.descricao ?? c.tipo_evento ?? "Comissão"}</Text>
                    <Text style={[s.rowSub, { color: sub }]}>{fmtDate(c.criado_em)} · {c.percentual ?? 10}%</Text>
                  </View>
                  <Text style={[s.rowVal, { color: EMERALD }]}>+{fmt(Number(c.valor_comissao ?? 0))}</Text>
                </View>
              ))
            )}

            {tab === "indicados" && (
              indicados.length === 0 ? (
                <View style={[s.emptyBox, { backgroundColor: card, borderColor: border }]}>
                  <Feather name="users" size={32} color={sub} />
                  <Text style={[s.emptyTitle, { color: text }]}>Nenhum indicado</Text>
                  <Text style={[s.emptyDesc, { color: sub }]}>Compartilhe seu código para começar a indicar.</Text>
                </View>
              ) : indicados.map((ind: any) => (
                <View key={ind.id} style={[s.row, { backgroundColor: card, borderColor: border }]}>
                  <View style={[s.iconCircle, { backgroundColor: GREEN + "20" }]}>
                    <Feather name="user-check" size={16} color={GREEN} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.rowTitle, { color: text }]}>{ind.nome_indicado_real ?? ind.nome_indicado ?? "Usuário"}</Text>
                    <Text style={[s.rowSub, { color: sub }]}>{fmtDate(ind.criado_em)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <View style={{ backgroundColor: ind.status === "qualificado" ? GREEN + "20" : "#F59E0B20", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 10, fontWeight: "700", color: ind.status === "qualificado" ? GREEN : "#F59E0B" }}>
                        {ind.status === "qualificado" ? "QUALIFICADO" : "PENDENTE"}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}

            {tab === "resgates" && (
              resgates.length === 0 ? (
                <View style={[s.emptyBox, { backgroundColor: card, borderColor: border }]}>
                  <Feather name="credit-card" size={32} color={sub} />
                  <Text style={[s.emptyTitle, { color: text }]}>Nenhum saque</Text>
                  <Text style={[s.emptyDesc, { color: sub }]}>Seus saques aparecerão aqui.</Text>
                </View>
              ) : resgates.map((r: any) => (
                <View key={r.id} style={[s.row, { backgroundColor: card, borderColor: border }]}>
                  <View style={[s.iconCircle, { backgroundColor: "#8B5CF620" }]}>
                    <Feather name="zap" size={16} color="#8B5CF6" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.rowTitle, { color: text }]}>Pix · {r.chave_pix || "—"}</Text>
                    <Text style={[s.rowSub, { color: sub }]}>{fmtDate(r.criado_em)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={[s.rowVal, { color: r.status === "pago" ? GREEN : "#F59E0B" }]}>{fmt(Number(r.valor))}</Text>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: r.status === "pago" ? GREEN : "#F59E0B" }}>
                      {r.status === "pago" ? "PAGO" : r.status === "pendente" ? "PENDENTE" : r.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 16, flexDirection: "row", alignItems: "center", gap: 8 },
  backBtn: { padding: 4 },
  shareBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  summaryRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  summaryCard: { flex: 1, borderRadius: 12, padding: 12, alignItems: "center", borderWidth: 1 },
  summaryVal: { fontSize: 15, fontWeight: "800" },
  summaryLabel: { fontSize: 11, marginTop: 2 },
  tabRow: { flexDirection: "row", borderBottomWidth: 1, marginHorizontal: 16 },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 10, marginBottom: -1 },
  tabLabel: { fontSize: 13, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 13, fontWeight: "600" },
  rowSub: { fontSize: 11, marginTop: 2 },
  rowVal: { fontSize: 14, fontWeight: "700" },
  emptyBox: { borderRadius: 12, borderWidth: 1, padding: 32, alignItems: "center", gap: 8, marginTop: 16 },
  emptyTitle: { fontSize: 15, fontWeight: "700" },
  emptyDesc: { fontSize: 12, textAlign: "center" },
});
