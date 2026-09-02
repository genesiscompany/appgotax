import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, useColorScheme, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";

const MOD_COLOR = Colors.modules.food;

const DEMO_RESTAURANTES = [
  { id: 1, nome: "Sabor Caseiro", categoria: "Brasileira", tempoEntregaMin: 30, avaliacaoMedia: 4.8, taxaEntrega: 4.90, aberto: true, descricao: "Comida caseira com amor" },
  { id: 2, nome: "Pizza Artesanal", categoria: "Italiana", tempoEntregaMin: 45, avaliacaoMedia: 4.5, taxaEntrega: 0, aberto: true, descricao: "Pizzas no forno a lenha" },
  { id: 3, nome: "Burger Bros", categoria: "Americana", tempoEntregaMin: 25, avaliacaoMedia: 4.3, taxaEntrega: 3.50, aberto: false, descricao: "Hambúrgueres artesanais" },
  { id: 4, nome: "Sushi Master", categoria: "Japonesa", tempoEntregaMin: 50, avaliacaoMedia: 4.9, taxaEntrega: 6.00, aberto: true, descricao: "Sushi fresco todo dia" },
];

const CARDAPIO_DEMO: Record<number, Array<{ id: number; nome: string; descricao: string; preco: number; categoria: string }>> = {
  1: [
    { id: 1, nome: "Frango Grelhado", descricao: "Com arroz, feijão e salada", preco: 28.90, categoria: "Pratos" },
    { id: 2, nome: "Feijoada Completa", descricao: "Com acompanhamentos tradicionais", preco: 38.90, categoria: "Pratos" },
    { id: 3, nome: "Suco Natural", descricao: "Laranja, limão ou maracujá", preco: 8.00, categoria: "Bebidas" },
  ],
  2: [
    { id: 4, nome: "Margherita", descricao: "Molho, mussarela e manjericão", preco: 45.00, categoria: "Pizzas" },
    { id: 5, nome: "Calabresa", descricao: "Calabresa e cebola ao alho", preco: 48.00, categoria: "Pizzas" },
  ],
};

function StarRating({ rating, color }: { rating: number; color: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
      <Feather name="star" size={12} color={color} />
      <Text style={{ fontSize: 12, color, fontFamily: "Inter_500Medium" }}>{rating.toFixed(1)}</Text>
    </View>
  );
}

export default function FoodScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const [selectedRest, setSelectedRest] = useState<typeof DEMO_RESTAURANTES[0] | null>(null);

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        {selectedRest ? (
          <Pressable onPress={() => setSelectedRest(null)} style={styles.backBtn}><Feather name="arrow-left" size={22} color={colors.text} /></Pressable>
        ) : (
          <Pressable onPress={() => router.back()} style={styles.backBtn}><Feather name="arrow-left" size={22} color={colors.text} /></Pressable>
        )}
        <View style={styles.headerTitle}>
          <View style={[styles.headerIcon, { backgroundColor: MOD_COLOR + "20" }]}><Feather name="coffee" size={18} color={MOD_COLOR} /></View>
          <Text style={[styles.title, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{selectedRest ? selectedRest.nome : "Food"}</Text>
        </View>
      </View>

      {!selectedRest ? (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }} showsVerticalScrollIndicator={false}>
          <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="search" size={16} color={colors.textMuted} />
            <Text style={[styles.searchPlaceholder, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Buscar restaurantes...</Text>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Restaurantes</Text>

          {DEMO_RESTAURANTES.map(r => (
            <Pressable key={r.id} onPress={() => r.aberto && setSelectedRest(r)} style={({ pressed }) => [styles.restCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 }]}>
              <View style={[styles.restImagePlaceholder, { backgroundColor: MOD_COLOR + "20" }]}>
                <Feather name="coffee" size={28} color={MOD_COLOR} />
              </View>
              <View style={styles.restInfo}>
                <View style={styles.restTopRow}>
                  <Text style={[styles.restNome, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{r.nome}</Text>
                  {r.aberto ? (
                    <View style={[styles.abertoBadge, { backgroundColor: "#10B98120" }]}>
                      <Text style={[styles.abertoText, { color: "#10B981", fontFamily: "Inter_500Medium" }]}>Aberto</Text>
                    </View>
                  ) : (
                    <View style={[styles.abertoBadge, { backgroundColor: "#EF444420" }]}>
                      <Text style={[styles.abertoText, { color: "#EF4444", fontFamily: "Inter_500Medium" }]}>Fechado</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.restCategoria, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{r.categoria} · {r.descricao}</Text>
                <View style={styles.restMeta}>
                  {r.avaliacaoMedia && <StarRating rating={r.avaliacaoMedia} color={MOD_COLOR} />}
                  <View style={styles.metaDivider} />
                  <Feather name="clock" size={12} color={colors.textMuted} />
                  <Text style={[styles.metaText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{r.tempoEntregaMin} min</Text>
                  <View style={styles.metaDivider} />
                  <Feather name="truck" size={12} color={colors.textMuted} />
                  <Text style={[styles.metaText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                    {r.taxaEntrega === 0 ? "Grátis" : `R$ ${r.taxaEntrega.toFixed(2)}`}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }} showsVerticalScrollIndicator={false}>
          <View style={[styles.restDetails, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.restMetaFull}>
              {selectedRest.avaliacaoMedia && <StarRating rating={selectedRest.avaliacaoMedia} color={MOD_COLOR} />}
              <Text style={[styles.metaText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                {selectedRest.tempoEntregaMin} min · Taxa: {selectedRest.taxaEntrega === 0 ? "Grátis" : `R$ ${selectedRest.taxaEntrega.toFixed(2)}`}
              </Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Cardápio</Text>

          {(CARDAPIO_DEMO[selectedRest.id] || []).map(item => (
            <View key={item.id} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.itemInfo}>
                <Text style={[styles.itemCategoria, { color: MOD_COLOR, fontFamily: "Inter_500Medium" }]}>{item.categoria}</Text>
                <Text style={[styles.itemNome, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{item.nome}</Text>
                <Text style={[styles.itemDesc, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{item.descricao}</Text>
              </View>
              <View style={styles.itemRight}>
                <Text style={[styles.itemPreco, { color: MOD_COLOR, fontFamily: "Inter_700Bold" }]}>R$ {item.preco.toFixed(2)}</Text>
                <Pressable style={[styles.addItemBtn, { backgroundColor: MOD_COLOR }]}>
                  <Feather name="plus" size={16} color="#fff" />
                </Pressable>
              </View>
            </View>
          ))}

          {!(CARDAPIO_DEMO[selectedRest.id]) && (
            <View style={styles.emptyState}>
              <Feather name="coffee" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Cardápio em breve</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 20 },
  searchPlaceholder: { fontSize: 14 },
  sectionTitle: { fontSize: 17, marginBottom: 14 },
  restCard: { borderRadius: 16, borderWidth: 1, marginBottom: 12, overflow: "hidden", flexDirection: "row" },
  restImagePlaceholder: { width: 90, height: 100, alignItems: "center", justifyContent: "center" },
  restInfo: { flex: 1, padding: 14, gap: 4 },
  restTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  restNome: { fontSize: 15 },
  abertoBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  abertoText: { fontSize: 11 },
  restCategoria: { fontSize: 12 },
  restMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  metaDivider: { width: 1, height: 10, backgroundColor: "#E2E8F0" },
  metaText: { fontSize: 12 },
  restDetails: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 16 },
  restMetaFull: { flexDirection: "row", gap: 12, alignItems: "center", flexWrap: "wrap" },
  itemCard: { borderRadius: 12, borderWidth: 1, marginBottom: 10, padding: 14, flexDirection: "row", gap: 12 },
  itemInfo: { flex: 1 },
  itemCategoria: { fontSize: 11, marginBottom: 2 },
  itemNome: { fontSize: 15, marginBottom: 2 },
  itemDesc: { fontSize: 12 },
  itemRight: { alignItems: "center", justifyContent: "space-between" },
  itemPreco: { fontSize: 15 },
  addItemBtn: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  emptyState: { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 14 },
});
