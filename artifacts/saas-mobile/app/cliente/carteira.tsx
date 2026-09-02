import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, useColorScheme, ActivityIndicator, TextInput, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import Colors from "@/constants/colors";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { getWallet, getWalletLedger, topupWallet, type WalletData, type WalletLedgerItem } from "@/api/payments";
import ClienteBottomNav from "@/components/ClienteBottomNav";
import { LinearGradient } from "expo-linear-gradient";

const BRAND_COLOR = "#00B1EA"; // Mercado Pago blue or similar, but let's stick to GoTaxi identity for wallet. 
// "GoTaxi Mercado Pago beta... payment clarity and trust come first."
const WALLET_COLOR = "#0F172A"; 

export default function CarteiraScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  
  const { customer, isLoggedIn } = useCustomerAuth();
  
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [ledger, setLedger] = useState<WalletLedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [topupAmount, setTopupAmount] = useState("");
  const [isToppingUp, setIsToppingUp] = useState(false);

  const loadData = async () => {
    if (!customer?.token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [w, l] = await Promise.all([
        getWallet(customer.token),
        getWalletLedger(customer.token)
      ]);
      setWallet(w);
      setLedger(l);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) loadData();
    else setLoading(false);
  }, [isLoggedIn, customer?.token]);

  const handleTopup = async () => {
    if (!customer?.token) return;
    const amountCents = parseInt((topupAmount || "").replace(/\D/g, ""), 10);
    if (isNaN(amountCents) || amountCents < 500) {
      Alert.alert("Aviso", "O valor mínimo para recarga é de R$ 5,00");
      return;
    }

    setIsToppingUp(true);
    try {
      const res = await topupWallet(customer.token, amountCents);
      if (res.sandboxInitPoint) {
        Linking.openURL(res.sandboxInitPoint);
      } else if (res.initPoint) {
        Linking.openURL(res.initPoint);
      }
      // reset field after flow
      setTopupAmount("");
    } catch (e: any) {
      Alert.alert("Erro", e.message || "Não foi possível iniciar a recarga.");
    } finally {
      setIsToppingUp(false);
    }
  };

  const formatCents = (cents: number) => {
    return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const topPadding = insets.top + 20;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={BRAND_COLOR} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding, backgroundColor: isDark ? "#1E293B" : "#F8FAFC" }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Minha Carteira</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 90 }}>
        
        <LinearGradient
          colors={["#00B1EA", "#0083B0"]}
          style={styles.balanceCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.balanceLabel}>Saldo disponível</Text>
          <Text style={styles.balanceValue}>{wallet ? formatCents(wallet.balanceCents) : "R$ 0,00"}</Text>
          
          <View style={styles.mpBadge}>
            <Feather name="shield" size={14} color="#fff" />
            <Text style={styles.mpBadgeText}>Powered by Mercado Pago</Text>
          </View>
        </LinearGradient>

        <View style={[styles.topupSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Adicionar Saldo</Text>
          <Text style={[styles.sectionSub, { color: colors.textMuted }]}>
            Recarregue sua carteira com Pix, Boleto ou Cartão
          </Text>
          
          <View style={styles.topupRow}>
            <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
              <Text style={[styles.currencyPrefix, { color: colors.textMuted }]}>R$</Text>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                keyboardType="numeric"
                placeholder="0,00"
                placeholderTextColor={colors.textMuted}
                value={topupAmount}
                onChangeText={(val) => {
                  const num = val.replace(/\D/g, "");
                  if (!num) setTopupAmount("");
                  else setTopupAmount((parseInt(num, 10) / 100).toFixed(2).replace(".", ","));
                }}
              />
            </View>
            <Pressable 
              style={[styles.topupBtn, { backgroundColor: BRAND_COLOR }]}
              onPress={handleTopup}
              disabled={isToppingUp}
            >
              {isToppingUp ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Feather name="plus" size={18} color="#fff" />
                  <Text style={styles.topupBtnText}>Recarregar</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        <View style={{ marginTop: 24 }}>
          <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 12 }]}>Movimentações</Text>
          
          {ledger.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="list" size={32} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>Nenhuma movimentação recente</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {ledger.map(item => (
                <View key={item.id} style={[styles.ledgerItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.ledgerIcon, { backgroundColor: item.type === "topup" ? "#10B98120" : "#EF444420" }]}>
                    <Feather 
                      name={item.type === "topup" ? "arrow-down-left" : "arrow-up-right"} 
                      size={20} 
                      color={item.type === "topup" ? "#10B981" : "#EF4444"} 
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.ledgerDesc, { color: colors.text }]}>{item.description}</Text>
                    <Text style={[styles.ledgerDate, { color: colors.textMuted }]}>
                      {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                    </Text>
                  </View>
                  <Text style={[styles.ledgerAmount, { color: item.type === "topup" ? "#10B981" : colors.text }]}>
                    {item.type === "topup" ? "+" : "-"} {formatCents(item.amountCents)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <ClienteBottomNav activeTab="perfil" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: { width: 40, height: 40, alignItems: "flex-start", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  balanceCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: "#00B1EA",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  balanceLabel: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontFamily: "Inter_500Medium" },
  balanceValue: { color: "#fff", fontSize: 32, fontFamily: "Inter_700Bold", marginTop: 4 },
  mpBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(0,0,0,0.15)",
    alignSelf: "flex-start",
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, marginTop: 16,
  },
  mpBadgeText: { color: "#fff", fontSize: 11, fontFamily: "Inter_500Medium" },
  topupSection: {
    borderRadius: 16, borderWidth: 1, padding: 16, gap: 12,
  },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  sectionSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  topupRow: { flexDirection: "row", gap: 12 },
  inputContainer: {
    flex: 1, flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14,
  },
  currencyPrefix: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginRight: 6 },
  input: { flex: 1, fontSize: 16, fontFamily: "Inter_600SemiBold", height: 50 },
  topupBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingHorizontal: 20, borderRadius: 12,
  },
  topupBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  ledgerItem: {
    flexDirection: "row", alignItems: "center", gap: 14,
    padding: 16, borderRadius: 14, borderWidth: 1,
  },
  ledgerIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  ledgerDesc: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  ledgerDate: { fontSize: 12, fontFamily: "Inter_400Regular" },
  ledgerAmount: { fontSize: 16, fontFamily: "Inter_700Bold" },
  emptyBox: { alignItems: "center", justifyContent: "center", padding: 32, borderRadius: 16, borderWidth: 1, borderStyle: "dashed" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 12 },
});