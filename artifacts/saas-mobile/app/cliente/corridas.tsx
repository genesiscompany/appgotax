import React, { useState, useEffect, useCallback } from "react";
import { fmtDataCurtaHora } from "@/utils/dateFormat";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  useColorScheme, ActivityIndicator, RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import ClienteBottomNav from "@/components/ClienteBottomNav";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api` : "/api";
const EMPRESA_ID = 2;
const MOD_COLOR = "#3B82F6";

interface Corrida {
  id: number;
  passageiro_nome: string;
  origem_endereco: string;
  destino_endereco: string;
  tipo_veiculo: string;
  forma_pagamento: string;
  status: string;
  valor: number;
  distancia_km?: number;
  motorista_nome?: string;
  avaliacao?: number;
  criado_em: string;
}

const STATUS_LABEL: Record<string, string> = {
  aguardando: "Aguardando", aceita: "Aceita", a_caminho: "A Caminho",
  em_andamento: "Em Andamento", concluida: "Concluída", cancelada: "Cancelada",
};

const STATUS_COLOR: Record<string, string> = {
  aguardando: "#F59E0B", aceita: "#3B82F6", a_caminho: "#8B5CF6",
  em_andamento: "#0EA5E9", concluida: "#10B981", cancelada: "#EF4444",
};

const TIPO_LABEL: Record<string, string> = { economico: "Econômico", conforto: "Conforto", premium: "Premium" };

function StarRating({ value, onRate }: { value?: number; onRate?: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <TouchableOpacity key={i} onPress={() => onRate?.(i)}>
          <Feather name="star" size={20} color={(hover || value || 0) >= i ? "#F59E0B" : "#D1D5DB"} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function MinhasCorridas() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const { customer } = useCustomerAuth();

  const [corridas, setCorridas] = useState<Corrida[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ratingMap, setRatingMap] = useState<Record<number, number>>({});
  const [ratedIds, setRatedIds] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    try {
      // history for all rides (API filters by empresa)
    const _nome = customer?.nome || "";
      const res = await fetch(`${API_BASE}/motorista/historico?empresa_id=${EMPRESA_ID}`);
      const data = await res.json();
      if (Array.isArray(data)) setCorridas(data);
    } catch (_) {}
    setLoading(false);
    setRefreshing(false);
  }, [customer]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleRate = async (corridaId: number, nota: number) => {
    setRatingMap(m => ({ ...m, [corridaId]: nota }));
    try {
      await fetch(`${API_BASE}/motorista/corridas/${corridaId}/avaliar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avaliacao: nota }),
      });
      setRatedIds(s => new Set(s).add(corridaId));
    } catch (_) {}
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.headerIcon, { backgroundColor: MOD_COLOR }]}>
            <Feather name="clock" size={15} color="#fff" />
          </View>
          <Text style={[styles.headerTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Histórico de Corridas</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={MOD_COLOR} size="large" />
        </View>
      ) : corridas.length === 0 ? (
        <View style={styles.centered}>
          <View style={[styles.emptyIcon, { backgroundColor: MOD_COLOR + "20" }]}>
            <Feather name="navigation" size={36} color={MOD_COLOR} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Sem corridas ainda</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
            Suas corridas concluídas e canceladas aparecerão aqui.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/cliente/motorista" as any)}
            style={[styles.chamarBtn, { backgroundColor: MOD_COLOR }]}
          >
            <Feather name="navigation" size={16} color="#fff" />
            <Text style={[styles.chamarBtnText, { fontFamily: "Inter_600SemiBold" }]}>Chamar um carro</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MOD_COLOR} />}
        >
          <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
            {corridas.length} {corridas.length === 1 ? "corrida" : "corridas"} no histórico
          </Text>

          {corridas.map(corrida => {
            const cor = STATUS_COLOR[corrida.status] || MOD_COLOR;
            const rated = ratedIds.has(corrida.id) || corrida.avaliacao;

            return (
              <View key={corrida.id} style={[styles.card, { backgroundColor: isDark ? "#1e293b" : "#fff", borderColor: isDark ? "#334155" : "#e2e8f0" }]}>
                <View style={[styles.cardTop, { borderBottomColor: isDark ? "#334155" : "#f1f5f9" }]}>
                  <View style={[styles.statusBadge, { backgroundColor: cor + "22" }]}>
                    <View style={[styles.statusDot, { backgroundColor: cor }]} />
                    <Text style={[styles.statusText, { color: cor, fontFamily: "Inter_600SemiBold" }]}>
                      {STATUS_LABEL[corrida.status] || corrida.status}
                    </Text>
                  </View>
                  <Text style={[styles.data, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                    {fmtDataCurtaHora(corrida.criado_em)}
                  </Text>
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.routeRow}>
                    <View style={styles.routeDots}>
                      <View style={[styles.dot, { backgroundColor: "#10B981" }]} />
                      <View style={[styles.routeLineV, { backgroundColor: isDark ? "#334155" : "#e2e8f0" }]} />
                      <View style={[styles.dot, { backgroundColor: cor }]} />
                    </View>
                    <View style={{ flex: 1, gap: 10 }}>
                      <Text style={[styles.routeText, { color: colors.text, fontFamily: "Inter_400Regular" }]}>{corrida.origem_endereco}</Text>
                      <Text style={[styles.routeText, { color: colors.text, fontFamily: "Inter_400Regular" }]}>{corrida.destino_endereco}</Text>
                    </View>
                  </View>

                  <View style={styles.infoRow}>
                    <View style={[styles.chip, { backgroundColor: isDark ? "#0f172a" : "#f1f5f9" }]}>
                      <Text style={[styles.chipText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                        {TIPO_LABEL[corrida.tipo_veiculo] || corrida.tipo_veiculo}
                      </Text>
                    </View>
                    {corrida.distancia_km && (
                      <View style={[styles.chip, { backgroundColor: isDark ? "#0f172a" : "#f1f5f9" }]}>
                        <Text style={[styles.chipText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                          {Number(corrida.distancia_km).toFixed(1)} km
                        </Text>
                      </View>
                    )}
                    <View style={[styles.chip, { backgroundColor: isDark ? "#0f172a" : "#f1f5f9" }]}>
                      <Text style={[styles.chipText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                        {corrida.forma_pagamento}
                      </Text>
                    </View>
                  </View>

                  {corrida.motorista_nome && (
                    <View style={styles.motoristaRow}>
                      <Feather name="user" size={13} color={colors.textSecondary} />
                      <Text style={[styles.motoristaNome, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                        {corrida.motorista_nome}
                      </Text>
                    </View>
                  )}

                  <View style={styles.bottomRow}>
                    <Text style={[styles.valor, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
                      R$ {Number(corrida.valor).toFixed(2)}
                    </Text>
                    {corrida.status === "concluida" && !rated && (
                      <View style={styles.rateBox}>
                        <Text style={[styles.rateLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Avaliar:</Text>
                        <StarRating
                          value={ratingMap[corrida.id]}
                          onRate={v => handleRate(corrida.id, v)}
                        />
                      </View>
                    )}
                    {corrida.status === "concluida" && rated && (
                      <View style={styles.ratedRow}>
                        <Feather name="star" size={14} color="#F59E0B" />
                        <Text style={[styles.ratedText, { color: "#F59E0B", fontFamily: "Inter_600SemiBold" }]}>
                          {corrida.avaliacao || ratingMap[corrida.id]}/5
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <ClienteBottomNav activeTab="inicio" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18 },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18, textAlign: "center" },
  emptyDesc: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  chamarBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, marginTop: 8 },
  chamarBtnText: { color: "#fff", fontSize: 15 },
  subtitle: { fontSize: 13, marginBottom: 4 },

  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderBottomWidth: 1 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusText: { fontSize: 12 },
  data: { fontSize: 11 },
  cardBody: { padding: 14, gap: 10 },
  routeRow: { flexDirection: "row", gap: 12 },
  routeDots: { alignItems: "center", paddingTop: 3, gap: 0 },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  routeLineV: { width: 1, flex: 1, marginVertical: 3 },
  routeText: { fontSize: 13, lineHeight: 20 },
  infoRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  chipText: { fontSize: 11 },
  motoristaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  motoristaNome: { fontSize: 12 },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  valor: { fontSize: 20 },
  rateBox: { flexDirection: "row", alignItems: "center", gap: 8 },
  rateLabel: { fontSize: 12 },
  ratedRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratedText: { fontSize: 13 },
});
