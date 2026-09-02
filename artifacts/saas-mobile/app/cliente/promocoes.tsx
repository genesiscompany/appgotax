import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useColorScheme,
  Dimensions,
  Animated,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import ClienteBottomNav from "@/components/ClienteBottomNav";

const { width } = Dimensions.get("window");
const API_BASE = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api` : "/api";

interface Promocao {
  id: number;
  empresa_id: number;
  nome: string;
  descricao?: string;
  tipo: "percentual" | "fixo";
  valor: number;
  codigo_cupom?: string;
  min_pedido: number;
  validade?: string;
  empresa_nome: string;
  empresa_cor: string;
  produto_id?: number | null;
  produto_nome?: string | null;
  produto_preco?: number | null;
  preco_promocional?: number | null;
  quantidade_disponivel?: number | null;
}

function PromoRow({ promo, isDark, colors }: { promo: Promocao; isDark: boolean; colors: any }) {
  const [copied, setCopied] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const cor = promo.empresa_cor || "#22C55E";
  const isExpiring = promo.validade
    ? new Date(promo.validade).getTime() - Date.now() < 1000 * 60 * 60 * 24 * 3
    : false;

  const hasProduto = !!promo.produto_id;
  const precoAntigo = promo.produto_preco != null ? Number(promo.produto_preco) : null;
  const precoNovo = promo.preco_promocional != null ? Number(promo.preco_promocional) : null;
  const descontoPct = precoAntigo && precoNovo && precoAntigo > precoNovo
    ? Math.round(((precoAntigo - precoNovo) / precoAntigo) * 100)
    : (promo.tipo === "percentual" ? promo.valor : null);

  const onPressCard = () => {
    if (hasProduto) {
      router.push({
        pathname: "/cliente/food" as any,
        params: {
          empresaId: String(promo.empresa_id),
          produtoId: String(promo.produto_id),
          precoPromocional: promo.preco_promocional != null ? String(promo.preco_promocional) : "",
        },
      });
    }
  };

  const onPressCopiar = (e?: any) => {
    e?.stopPropagation?.();
    if (!promo.codigo_cupom) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPressCard}
        onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start()}
        style={[styles.card, { backgroundColor: isDark ? "#1e293b" : "#fff", borderColor: isDark ? "#334155" : "#e2e8f0" }]}
      >
        {/* left accent */}
        <View style={[styles.cardAccent, { backgroundColor: cor }]} />

        <View style={styles.cardInner}>
          {/* top row */}
          <View style={styles.topRow}>
            {descontoPct != null && (
              <View style={[styles.discBadge, { backgroundColor: cor + "22" }]}>
                <Text style={[styles.discText, { color: cor, fontFamily: "Inter_700Bold" }]}>
                  {descontoPct}% OFF
                </Text>
              </View>
            )}
            <View style={styles.topRowRight}>
              <Text style={[styles.empresaNome, { color: cor, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>
                {promo.empresa_nome}
              </Text>
              {isExpiring && promo.validade && (
                <View style={[styles.expireBadge, { backgroundColor: "#EF4444" }]}>
                  <Feather name="clock" size={9} color="#fff" />
                  <Text style={[styles.expireText, { fontFamily: "Inter_600SemiBold" }]}>Expirando</Text>
                </View>
              )}
            </View>
          </View>

          {/* nome */}
          <Text style={[styles.promoNome, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{promo.nome}</Text>
          {promo.produto_nome ? (
            <Text style={[styles.promoDesc, { color: colors.text, fontFamily: "Inter_500Medium" }]}>
              {promo.produto_nome}
            </Text>
          ) : promo.descricao ? (
            <Text style={[styles.promoDesc, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{promo.descricao}</Text>
          ) : null}

          {/* preço de/por */}
          {precoNovo != null && (
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 6 }}>
              {precoAntigo != null && precoAntigo > precoNovo && (
                <Text style={{ color: colors.textSecondary, fontSize: 13, textDecorationLine: "line-through", fontFamily: "Inter_400Regular" }}>
                  R$ {precoAntigo.toFixed(2)}
                </Text>
              )}
              <Text style={{ color: cor, fontSize: 22, fontFamily: "Inter_700Bold" }}>
                R$ {precoNovo.toFixed(2)}
              </Text>
            </View>
          )}

          {/* details */}
          <View style={styles.detailsRow}>
            {promo.quantidade_disponivel != null && promo.quantidade_disponivel > 0 && (
              <View style={[styles.chip, { backgroundColor: "#F9731620" }]}>
                <Feather name="zap" size={11} color="#F97316" />
                <Text style={[styles.chipText, { color: "#F97316", fontFamily: "Inter_600SemiBold" }]}>
                  Apenas {promo.quantidade_disponivel} restantes
                </Text>
              </View>
            )}
            {promo.min_pedido > 0 && (
              <View style={[styles.chip, { backgroundColor: isDark ? "#0f172a" : "#f1f5f9" }]}>
                <Feather name="shopping-bag" size={11} color={colors.textSecondary} />
                <Text style={[styles.chipText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                  Mín R$ {Number(promo.min_pedido).toFixed(2)}
                </Text>
              </View>
            )}
            {promo.validade && (
              <View style={[styles.chip, { backgroundColor: isDark ? "#0f172a" : "#f1f5f9" }]}>
                <Feather name="calendar" size={11} color={colors.textSecondary} />
                <Text style={[styles.chipText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                  Até {(() => { const d = new Date(promo.validade + "T00:00:00"); return `${d.getDate().toString().padStart(2,"0")}/${(d.getMonth()+1).toString().padStart(2,"0")}/${d.getFullYear()}`; })()}
                </Text>
              </View>
            )}
          </View>

          {/* CTA Comprar */}
          {hasProduto && (
            <View style={{
              marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
              backgroundColor: cor, paddingVertical: 11, borderRadius: 12,
            }}>
              <Feather name="shopping-bag" size={15} color="#fff" />
              <Text style={{ color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" }}>Comprar agora</Text>
            </View>
          )}

          {/* cupom (se não tiver produto vinculado) */}
          {!hasProduto && promo.codigo_cupom && (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={onPressCopiar}
              style={[styles.cupomRow, { backgroundColor: isDark ? "#0f172a" : "#f8fafc", borderColor: cor + "40" }]}
            >
              <Feather name="tag" size={13} color={cor} />
              <Text style={[styles.cupomCode, { color: cor, fontFamily: "Inter_700Bold" }]}>{promo.codigo_cupom}</Text>
              <View style={[styles.copiarBtn, { backgroundColor: cor }]}>
                <Feather name={copied ? "check" : "copy"} size={12} color="#fff" />
                <Text style={[styles.copiarText, { fontFamily: "Inter_600SemiBold" }]}>{copied ? "Copiado!" : "Copiar"}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function ClientePromocoes() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const [items, setItems] = useState<Promocao[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/food/promocoes`);
      const data = await res.json();
      if (Array.isArray(data)) setItems(data);
    } catch (_) {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = () => { setRefreshing(true); load(); };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.headerIcon, { backgroundColor: "#F97316" }]}>
            <Feather name="tag" size={15} color="#fff" />
          </View>
          <Text style={[styles.headerTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Promoções</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#22C55E" size="large" />
          <Text style={[styles.loadingText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Buscando promoções...</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centered}>
          <View style={[styles.emptyIcon, { backgroundColor: "#F9731620" }]}>
            <Feather name="tag" size={36} color="#F97316" />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Nenhuma promoção ativa</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
            Volte mais tarde, os parceiros publicam promoções e cupons com frequência!
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22C55E" />}
        >
          <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
            {items.length} {items.length === 1 ? "promoção disponível" : "promoções disponíveis"} — toque para comprar
          </Text>
          {items.map(p => (
            <PromoRow key={p.id} promo={p} isDark={isDark} colors={colors} />
          ))}
        </ScrollView>
      )}

      <ClienteBottomNav activeTab="inicio" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18 },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  loadingText: { fontSize: 14, marginTop: 8 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  emptyTitle: { fontSize: 18, textAlign: "center" },
  emptyDesc: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  subtitle: { fontSize: 13, marginBottom: 4 },

  /* Card */
  card: { borderRadius: 16, borderWidth: 1, flexDirection: "row", overflow: "hidden" },
  cardAccent: { width: 4 },
  cardInner: { flex: 1, padding: 14, gap: 8 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  discBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  discText: { fontSize: 15 },
  topRowRight: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1, justifyContent: "flex-end" },
  empresaNome: { fontSize: 13 },
  expireBadge: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  expireText: { color: "#fff", fontSize: 9 },
  promoNome: { fontSize: 16, lineHeight: 22 },
  promoDesc: { fontSize: 13, lineHeight: 19 },
  detailsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  chipText: { fontSize: 11 },
  cupomRow: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 10 },
  cupomCode: { fontSize: 15, flex: 1, letterSpacing: 1 },
  copiarBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  copiarText: { color: "#fff", fontSize: 12 },
});
