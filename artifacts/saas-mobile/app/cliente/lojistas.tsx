import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, useColorScheme, Platform, TextInput, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import Colors from "@/constants/colors";
import ClienteBottomNav from "@/components/ClienteBottomNav";
import { useCart } from "@/context/CartContext";

const BRAND_GREEN = "#22C55E";
const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const MODULOS_FILTROS = [
  { id: "todos", nome: "Todos", icone: "grid" as const, cor: "#64748B" },
  { id: "food", nome: "Comida", icone: "coffee" as const, cor: "#F97316" },
  { id: "motorista", nome: "Viagens", icone: "navigation" as const, cor: "#3B82F6" },
  { id: "ecommerce", nome: "Loja", icone: "shopping-bag" as const, cor: "#8B5CF6" },
  { id: "servicos", nome: "Serviços", icone: "tool" as const, cor: "#06B6D4" },
  { id: "entrega", nome: "Entregas", icone: "package" as const, cor: "#F59E0B" },
  { id: "passagens", nome: "Ônibus", icone: "map-pin" as const, cor: BRAND_GREEN },
];

const MODULO_ROUTES: Record<string, string> = {
  food: "/cliente/food",
  ecommerce: "/cliente/ecommerce",
  motorista: "/cliente/motorista",
  servicos: "/cliente/servicos",
  passagens: "/cliente/passagens",
  entrega: "/cliente/entrega",
};

type Parceiro = {
  id: number;
  nome: string;
  cor: string;
  modulos: string[];
  destaque: boolean;
  categoria: string;
  total_produtos: number;
};

export default function LojistasScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const params = useLocalSearchParams<{ modulo?: string }>();
  const initialMod = typeof params.modulo === "string" && MODULOS_FILTROS.some(m => m.id === params.modulo) ? params.modulo : "todos";
  const [modSel, setModSel] = useState(initialMod);
  useEffect(() => {
    if (typeof params.modulo === "string" && MODULOS_FILTROS.some(m => m.id === params.modulo)) {
      setModSel(params.modulo);
    }
  }, [params.modulo]);
  const [busca, setBusca] = useState("");
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [loading, setLoading] = useState(true);
  const topPadding = insets.top + (Platform.OS === "web" ? 0 : 0);

  const { vendor, totalQtd } = useCart();

  useEffect(() => {
    fetch(`${API_BASE}/public/parceiros`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setParceiros(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getModulo = (p: Parceiro): string => {
    const prioridade = ["food", "ecommerce", "motorista", "passagens", "servicos", "entrega", "encomendas"];
    for (const m of prioridade) {
      if (p.modulos.includes(m)) return m;
    }
    return p.modulos[0] ?? "ecommerce";
  };

  const lojFiltrados = parceiros
    .filter(p => {
      if (modSel === "todos") return true;
      return p.modulos.includes(modSel);
    })
    .filter(p => !busca || p.nome.toLowerCase().includes(busca.toLowerCase()) || p.categoria.toLowerCase().includes(busca.toLowerCase()));

  const modAtivo = MODULOS_FILTROS.find(m => m.id === modSel)!;

  const handleTap = (p: Parceiro) => {
    const modulo = getModulo(p);
    const route = MODULO_ROUTES[modulo] ?? "/cliente/ecommerce";
    router.push({ pathname: route as any, params: { empresaId: p.id, nomeEmpresa: p.nome, corEmpresa: p.cor } });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={modSel === "todos" ? ["#0F172A", "#1E293B"] : [modAtivo.cor + "DD", modAtivo.cor + "AA"]}
        style={[styles.header, { paddingTop: topPadding + 16 }]}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </Pressable>
          <Text style={[styles.headerTitle, { fontFamily: "Inter_700Bold", color: "#fff" }]}>
            {modSel === "todos" ? "Todos os parceiros" : modAtivo.nome}
          </Text>
          <Pressable onPress={() => router.push("/cliente/ecommerce" as any)} style={styles.cartBtn}>
            <Feather name="shopping-cart" size={20} color="#fff" />
            {totalQtd > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{totalQtd}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {vendor && totalQtd > 0 && (
          <View style={styles.cartBanner}>
            <Feather name="shopping-bag" size={12} color="#F59E0B" />
            <Text style={styles.cartBannerText}>{totalQtd} item(s) de {vendor.nome} no carrinho</Text>
          </View>
        )}

        <View style={[styles.buscaBar, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
          <Feather name="search" size={16} color="rgba(255,255,255,0.7)" />
          <TextInput
            style={[styles.buscaInput, { color: "#fff", fontFamily: "Inter_400Regular" }]}
            placeholder="Buscar parceiros..."
            placeholderTextColor="rgba(255,255,255,0.6)"
            value={busca}
            onChangeText={setBusca}
          />
        </View>
      </LinearGradient>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filtrosScroll, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}
      >
        {MODULOS_FILTROS.map(mod => {
          const sel = modSel === mod.id;
          return (
            <Pressable key={mod.id} onPress={() => setModSel(mod.id)}
              style={[styles.filtroChip, { backgroundColor: sel ? mod.cor : colors.backgroundSecondary, borderColor: sel ? mod.cor : colors.border }]}>
              <Feather name={mod.icone} size={13} color={sel ? "#fff" : colors.textMuted} />
              <Text style={[styles.filtroText, { color: sel ? "#fff" : colors.textSecondary, fontFamily: sel ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
                {mod.nome}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={BRAND_GREEN} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>
          <Text style={[styles.countText, { color: colors.textMuted, fontFamily: "Inter_400Regular", marginBottom: 14 }]}>
            {lojFiltrados.length} parceiro(s) encontrado(s)
          </Text>

          {lojFiltrados.map(loj => {
            const modulo = getModulo(loj);
            const modInfo = MODULOS_FILTROS.find(m => m.id === modulo) ?? MODULOS_FILTROS[0];
            const isVendorCart = vendor?.id === loj.id;
            return (
              <Pressable key={loj.id} onPress={() => handleTap(loj)}
                style={[styles.lojCard, { backgroundColor: colors.card, borderColor: isVendorCart ? modInfo.cor : colors.border,
                  borderWidth: isVendorCart ? 2 : 1 }]}>
                <View style={[styles.lojImagem, { backgroundColor: loj.cor + "20" }]}>
                  <Feather name={(modInfo?.icone ?? "briefcase") as any} size={28} color={loj.cor} />
                  {loj.destaque && (
                    <View style={[styles.destaqueTag, { backgroundColor: "#FEF3C7" }]}>
                      <Feather name="star" size={10} color="#F59E0B" />
                    </View>
                  )}
                </View>
                <View style={styles.lojInfo}>
                  <View style={styles.lojTopRow}>
                    <Text style={[styles.lojNome, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{loj.nome}</Text>
                    {isVendorCart && (
                      <View style={[styles.abertoTag, { backgroundColor: modInfo.cor + "20" }]}>
                        <Feather name="shopping-cart" size={10} color={modInfo.cor} />
                        <Text style={[styles.abertoText, { color: modInfo.cor, fontFamily: "Inter_500Medium" }]}>No carrinho</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.lojCat, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{loj.categoria}</Text>
                  <View style={styles.lojMeta}>
                    {loj.modulos.filter(m => !m.startsWith("destaque:")).slice(0, 3).map(m => {
                      const mInfo = MODULOS_FILTROS.find(f => f.id === m);
                      if (!mInfo) return null;
                      return (
                        <View key={m} style={[styles.moduloTag, { backgroundColor: mInfo.cor + "20" }]}>
                          <Feather name={mInfo.icone} size={10} color={mInfo.cor} />
                          <Text style={[styles.moduloText, { color: mInfo.cor }]}>{mInfo.nome}</Text>
                        </View>
                      );
                    })}
                    {loj.total_produtos > 0 && (
                      <Text style={[styles.lojMetaText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                        {loj.total_produtos} produto(s)
                      </Text>
                    )}
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              </Pressable>
            );
          })}

          {lojFiltrados.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Feather name="search" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                Nenhum parceiro encontrado
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      <ClienteBottomNav activeTab="inicio" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  backBtn: { padding: 4 },
  cartBtn: { position: "relative", padding: 4 },
  cartBadge: { position: "absolute", top: 0, right: 0, backgroundColor: "#F59E0B", borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center" },
  cartBadgeText: { fontSize: 10, color: "#fff", fontFamily: "Inter_700Bold" },
  cartBanner: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(245,158,11,0.15)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 10 },
  cartBannerText: { fontSize: 12, color: "#F59E0B", fontFamily: "Inter_500Medium" },
  headerTitle: { fontSize: 18 },
  buscaBar: { flexDirection: "row", alignItems: "center", borderRadius: 12, paddingHorizontal: 14, height: 44, gap: 10 },
  buscaInput: { flex: 1, fontSize: 14 },
  filtrosScroll: { borderBottomWidth: 1, maxHeight: 58, minHeight: 58 },
  filtroChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, height: 34, borderRadius: 20, borderWidth: 1, alignSelf: "center" },
  filtroText: { fontSize: 13 },
  countText: { fontSize: 13 },
  lojCard: { flexDirection: "row", alignItems: "center", borderRadius: 14, marginBottom: 12, padding: 12, gap: 12 },
  lojImagem: { width: 64, height: 64, borderRadius: 14, alignItems: "center", justifyContent: "center", position: "relative" },
  destaqueTag: { position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  lojInfo: { flex: 1 },
  lojTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  lojNome: { fontSize: 15, flex: 1 },
  abertoTag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  abertoText: { fontSize: 11 },
  lojCat: { fontSize: 12, marginBottom: 5 },
  lojMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  lojMetaText: { fontSize: 12 },
  moduloTag: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  moduloText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  emptyState: { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 14 },
});
