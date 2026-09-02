import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, StatusBar, ActivityIndicator, Alert, Linking, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import { useProAuth } from "@/context/ProAuthContext";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const POLL_MS = 15000;
const COR = "#10B981"; // verde delivery

type Item = { nome: string; qtd: number; observacoes?: string | null };
type Entrega = {
  id: number;
  empresa_id: number;
  empresa_nome: string;
  empresa_telefone?: string | null;
  cliente_nome: string;
  cliente_whatsapp?: string | null;
  cliente_endereco: string;
  total: number | string;
  taxa_entrega?: number | string | null;
  forma_pagamento?: string | null;
  observacoes?: string | null;
  status: string;
  criado_em: string;
  pronto_em?: string | null;
  saiu_em?: string | null;
  endereco_restaurante?: string | null;
  lat_restaurante?: number | string | null;
  lng_restaurante?: number | string | null;
  itens: Item[];
};

function fmtBRL(v: number | string | undefined | null) {
  const n = Number(v ?? 0);
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

function statusLabel(s: string) {
  const map: Record<string, { label: string; bg: string; fg: string }> = {
    pendente:      { label: "Aguardando preparar", bg: "#3B2F0E", fg: "#FCD34D" },
    novo:          { label: "Novo",                bg: "#3B2F0E", fg: "#FCD34D" },
    preparando:    { label: "Preparando",          bg: "#3B2F0E", fg: "#FCD34D" },
    pronto:        { label: "Pronto p/ retirar",   bg: "#0F2A1E", fg: "#34D399" },
    saiu_entrega:  { label: "Em rota",             bg: "#0E2A3B", fg: "#60A5FA" },
  };
  return map[s] ?? { label: s, bg: "#222", fg: "#999" };
}

function openInMaps(endereco: string, lat?: number | string | null, lng?: number | string | null) {
  const hasCoords = lat && lng;
  const q = hasCoords ? `${lat},${lng}` : encodeURIComponent(endereco);
  const url = Platform.OS === "ios"
    ? `maps://?q=${q}`
    : `geo:0,0?q=${q}`;
  const fallback = `https://www.google.com/maps/search/?api=1&query=${q}`;
  Linking.canOpenURL(url).then(ok => Linking.openURL(ok ? url : fallback)).catch(() => Linking.openURL(fallback));
}

function callPhone(num: string | null | undefined) {
  if (!num) return;
  const clean = num.replace(/\D/g, "");
  if (!clean) return;
  Linking.openURL(`tel:${clean}`).catch(() => {});
}

function whatsapp(num: string | null | undefined) {
  if (!num) return;
  const clean = num.replace(/\D/g, "");
  if (!clean) return;
  Linking.openURL(`https://wa.me/55${clean}`).catch(() => {});
}

export default function EntregasPdv() {
  const { proUser } = useProAuth();
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEntregas = useCallback(async () => {
    if (!proUser?.token) return;
    try {
      const res = await fetch(`${API_BASE}/motorista-app/pdv/minhas-entregas`, {
        headers: { Authorization: `Bearer ${proUser.token}` },
      });
      if (res.ok) setEntregas(await res.json());
    } catch {}
    setLoading(false);
  }, [proUser?.token]);

  // Initial + polling
  useEffect(() => {
    fetchEntregas();
    pollRef.current = setInterval(fetchEntregas, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchEntregas]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEntregas();
    setRefreshing(false);
  };

  const action = async (id: number, kind: "saiu" | "entregue" | "recusar") => {
    setBusy(id);
    try {
      const res = await fetch(`${API_BASE}/motorista-app/pdv/entrega/${id}/${kind}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${proUser!.token}` },
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "falhou");
      }
      await fetchEntregas();
    } catch (e: any) {
      Alert.alert("Erro", e?.message ?? "Não foi possível atualizar.");
    } finally {
      setBusy(null);
    }
  };

  const confirmRecusar = (e: Entrega) => {
    Alert.alert(
      "Recusar entrega?",
      `Você quer recusar a entrega do pedido #${e.id} (${e.empresa_nome})? O pedido voltará pra fila.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Recusar", style: "destructive", onPress: () => action(e.id, "recusar") },
      ]
    );
  };

  const confirmEntregue = (e: Entrega) => {
    Alert.alert(
      "Marcar como entregue?",
      `Confirma que entregou o pedido #${e.id} para ${e.cliente_nome}?`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Entreguei", onPress: () => action(e.id, "entregue") },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Minhas entregas</Text>
          <Text style={styles.subtitle}>
            {entregas.length === 0 ? "Nenhuma entrega no momento" :
              `${entregas.length} entrega${entregas.length > 1 ? "s" : ""} ativa${entregas.length > 1 ? "s" : ""}`}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COR} />}
      >
        {loading && entregas.length === 0 ? (
          <View style={styles.empty}>
            <ActivityIndicator color={COR} size="large" />
          </View>
        ) : entregas.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🛵</Text>
            <Text style={styles.emptyTitle}>Sem entregas no momento</Text>
            <Text style={styles.emptyMsg}>Quando o restaurante te atribuir uma entrega, ela vai aparecer aqui automaticamente.</Text>
          </View>
        ) : (
          entregas.map(e => {
            const st = statusLabel(e.status);
            const isSaiu = e.status === "saiu_entrega";
            const podeAceitar = !isSaiu;
            return (
              <View key={e.id} style={styles.card}>
                {/* Header card: empresa + status */}
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.empresaNome}>{e.empresa_nome}</Text>
                    <Text style={styles.pedidoId}>Pedido #{e.id}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.badgeTxt, { color: st.fg }]}>{st.label}</Text>
                  </View>
                </View>

                {/* Retirada */}
                {e.endereco_restaurante && (
                  <TouchableOpacity
                    style={styles.addrRow}
                    onPress={() => openInMaps(e.endereco_restaurante!, e.lat_restaurante, e.lng_restaurante)}
                  >
                    <Text style={styles.addrIcon}>🍕</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.addrLabel}>Retirar em</Text>
                      <Text style={styles.addrTxt} numberOfLines={2}>{e.endereco_restaurante}</Text>
                    </View>
                    <Text style={styles.addrArrow}>›</Text>
                  </TouchableOpacity>
                )}

                {/* Entrega */}
                <TouchableOpacity
                  style={styles.addrRow}
                  onPress={() => openInMaps(e.cliente_endereco)}
                >
                  <Text style={styles.addrIcon}>📍</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.addrLabel}>Entregar para {e.cliente_nome}</Text>
                    <Text style={styles.addrTxt} numberOfLines={2}>{e.cliente_endereco}</Text>
                  </View>
                  <Text style={styles.addrArrow}>›</Text>
                </TouchableOpacity>

                {/* Itens */}
                {e.itens && e.itens.length > 0 && (
                  <View style={styles.itensBox}>
                    {e.itens.map((it, i) => (
                      <Text key={i} style={styles.itemTxt}>
                        <Text style={{ fontWeight: "800", color: COR }}>{it.qtd}× </Text>
                        {it.nome}
                        {it.observacoes ? <Text style={styles.itemObs}> ({it.observacoes})</Text> : null}
                      </Text>
                    ))}
                  </View>
                )}

                {/* Pagamento + total */}
                <View style={styles.payRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.payLabel}>Pagamento</Text>
                    <Text style={styles.payVal}>
                      {(e.forma_pagamento || "—").replace(/_/g, " ")}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.payLabel}>Total</Text>
                    <Text style={styles.totalVal}>{fmtBRL(e.total)}</Text>
                    {e.taxa_entrega ? (
                      <Text style={styles.taxaTxt}>Taxa entrega: {fmtBRL(e.taxa_entrega)}</Text>
                    ) : null}
                  </View>
                </View>

                {e.observacoes ? (
                  <View style={styles.obsBox}>
                    <Text style={styles.obsTitle}>Observação</Text>
                    <Text style={styles.obsTxt}>{e.observacoes}</Text>
                  </View>
                ) : null}

                {/* Contato */}
                <View style={styles.contactRow}>
                  {e.cliente_whatsapp ? (
                    <TouchableOpacity
                      style={[styles.contactBtn, { backgroundColor: "#0F2A1E" }]}
                      onPress={() => whatsapp(e.cliente_whatsapp)}
                    >
                      <Text style={styles.contactTxt}>💬  WhatsApp cliente</Text>
                    </TouchableOpacity>
                  ) : null}
                  {e.cliente_whatsapp ? (
                    <TouchableOpacity
                      style={[styles.contactBtn, { backgroundColor: "#1A1A1A" }]}
                      onPress={() => callPhone(e.cliente_whatsapp)}
                    >
                      <Text style={styles.contactTxt}>📞</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Actions */}
                <View style={styles.actions}>
                  {podeAceitar ? (
                    <>
                      <TouchableOpacity
                        style={[styles.actBtn, { backgroundColor: COR }]}
                        disabled={busy === e.id}
                        onPress={() => action(e.id, "saiu")}
                      >
                        {busy === e.id ? (
                          <ActivityIndicator color="#FFF" />
                        ) : (
                          <Text style={styles.actTxtPrim}>🛵  Saí pra entrega</Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actBtnSec}
                        disabled={busy === e.id}
                        onPress={() => confirmRecusar(e)}
                      >
                        <Text style={styles.actTxtSec}>Recusar</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={[styles.actBtn, { backgroundColor: COR, flex: 1 }]}
                      disabled={busy === e.id}
                      onPress={() => confirmEntregue(e)}
                    >
                      {busy === e.id ? (
                        <ActivityIndicator color="#FFF" />
                      ) : (
                        <Text style={styles.actTxtPrim}>✓  Marcar como entregue</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0D0D0D" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: "#1A1A1A" },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#1A1A1A", alignItems: "center", justifyContent: "center" },
  backTxt: { color: "#FFF", fontSize: 28, fontWeight: "300", marginTop: -4 },
  title: { color: "#FFF", fontSize: 20, fontWeight: "900" },
  subtitle: { color: "#888", fontSize: 12, fontWeight: "600", marginTop: 2 },
  scroll: { padding: 16, gap: 14, paddingBottom: 30 },
  empty: { padding: 40, alignItems: "center", gap: 10, marginTop: 40 },
  emptyIcon: { fontSize: 60 },
  emptyTitle: { color: "#FFF", fontSize: 18, fontWeight: "800" },
  emptyMsg: { color: "#888", fontSize: 13, textAlign: "center", lineHeight: 19 },

  card: { backgroundColor: "#161616", borderRadius: 18, borderWidth: 1, borderColor: "#262626", overflow: "hidden" },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 16, paddingBottom: 8 },
  empresaNome: { color: "#FFF", fontSize: 17, fontWeight: "900" },
  pedidoId: { color: "#888", fontSize: 12, fontWeight: "600", marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  badgeTxt: { fontSize: 11, fontWeight: "800" },

  addrRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 11, borderTopWidth: 1, borderTopColor: "#222" },
  addrIcon: { fontSize: 22 },
  addrLabel: { color: "#888", fontSize: 11, fontWeight: "700" },
  addrTxt: { color: "#FFF", fontSize: 14, fontWeight: "600", marginTop: 2 },
  addrArrow: { color: "#666", fontSize: 24, fontWeight: "300" },

  itensBox: { paddingHorizontal: 16, paddingVertical: 11, borderTopWidth: 1, borderTopColor: "#222", gap: 4 },
  itemTxt: { color: "#DDD", fontSize: 13, fontWeight: "600" },
  itemObs: { color: "#888", fontStyle: "italic", fontSize: 12 },

  payRow: { flexDirection: "row", padding: 16, borderTopWidth: 1, borderTopColor: "#222", alignItems: "flex-start" },
  payLabel: { color: "#888", fontSize: 11, fontWeight: "700" },
  payVal: { color: "#FFF", fontSize: 14, fontWeight: "700", marginTop: 3, textTransform: "capitalize" },
  totalVal: { color: COR, fontSize: 22, fontWeight: "900", marginTop: 2 },
  taxaTxt: { color: "#888", fontSize: 11, marginTop: 2 },

  obsBox: { backgroundColor: "#1A1A1A", marginHorizontal: 16, marginBottom: 12, padding: 10, borderRadius: 10, borderLeftWidth: 3, borderLeftColor: "#FCD34D" },
  obsTitle: { color: "#FCD34D", fontSize: 11, fontWeight: "800" },
  obsTxt: { color: "#DDD", fontSize: 13, marginTop: 3 },

  contactRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  contactBtn: { flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: "center" },
  contactTxt: { color: "#FFF", fontSize: 13, fontWeight: "700" },

  actions: { flexDirection: "row", gap: 8, padding: 12, paddingTop: 0 },
  actBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  actBtnSec: { paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: "#2A1818", borderWidth: 1, borderColor: "#5A2222" },
  actTxtPrim: { color: "#FFF", fontSize: 15, fontWeight: "900" },
  actTxtSec: { color: "#F87171", fontSize: 13, fontWeight: "700" },
});
