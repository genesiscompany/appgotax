import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

const { height } = Dimensions.get("window");

const TIPOS = [
  { icon: "🚗", label: "Motorista de App", desc: "Transporte de passageiros", color: "#3B82F6" },
  { icon: "📦", label: "Entregadores e Encomendas", desc: "Entregas de pacotes",  color: "#10B981" },
  { icon: "🍔", label: "Delivery",          desc: "Entrega de comida",         color: "#F97316" },
];

export default function BemVindo() {
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />

      <TouchableOpacity style={styles.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace("/" as any)} activeOpacity={0.7}>
        <Text style={styles.backTxt}>← Início</Text>
      </TouchableOpacity>

      <View style={styles.top}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoG}>G</Text>
        </View>
        <Text style={styles.logoTitle}>GoTaxi <Text style={styles.logoPro}>Pro</Text></Text>
        <Text style={styles.logoSub}>O app dos profissionais GoTaxi</Text>
      </View>

      {/* Cards de perfil */}
      <View style={styles.cards}>
        {TIPOS.map(t => (
          <View key={t.label} style={[styles.card, { borderLeftColor: t.color }]}>
            <Text style={styles.cardIcon}>{t.icon}</Text>
            <View>
              <Text style={[styles.cardLabel, { color: t.color }]}>{t.label}</Text>
              <Text style={styles.cardDesc}>{t.desc}</Text>
            </View>
          </View>
        ))}

        {/* Card Tur Viagens — logo abaixo do Delivery */}
        <TouchableOpacity
          style={styles.cardViagens}
          activeOpacity={0.8}
          onPress={() => router.push("/pro/tur-viagens" as any)}
        >
          <View style={styles.cardViagemIconBox}>
            <Text style={{ fontSize: 22 }}>✈️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardViagemLabel}>Tur Viagens</Text>
            <Text style={styles.cardViagemDesc}>Operadores de caronas e transporte rodoviário</Text>
          </View>
          <Text style={styles.cardViagemArrow}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottom}>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => router.push("/pro/cadastro" as any)}>
          <Text style={styles.btnPrimaryTxt}>Criar conta grátis</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={() => router.push("/pro/login" as any)}>
          <Text style={styles.btnSecondaryTxt}>Já tenho conta — Entrar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:              { flex: 1, backgroundColor: "#0D0D0D", justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 20 },
  top:               { alignItems: "center", marginTop: height * 0.02 },
  logoBadge:         { width: 72, height: 72, borderRadius: 22, borderWidth: 3, borderColor: "#F5C518", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  logoG:             { fontSize: 38, fontWeight: "900", color: "#F5C518" },
  logoTitle:         { fontSize: 30, fontWeight: "900", color: "#FFF" },
  logoPro:           { color: "#F5C518" },
  logoSub:           { fontSize: 14, color: "#8896B0", marginTop: 4 },
  cards:             { gap: 10 },
  card:              { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#1A1A1A", borderRadius: 14, padding: 14, borderLeftWidth: 4 },
  cardIcon:          { fontSize: 26 },
  cardLabel:         { fontSize: 14, fontWeight: "700" },
  cardDesc:          { fontSize: 12, color: "#8896B0", marginTop: 2 },
  backBtn:           { alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 2 },
  backTxt:           { color: "#F5C518", fontSize: 14, fontWeight: "600" },
  bottom:            { gap: 10 },
  btnPrimary:        { backgroundColor: "#F5C518", borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  btnPrimaryTxt:     { fontSize: 16, fontWeight: "800", color: "#000" },
  btnSecondary:      { borderRadius: 16, paddingVertical: 14, alignItems: "center", borderWidth: 1.5, borderColor: "#333" },
  btnSecondaryTxt:   { fontSize: 15, fontWeight: "600", color: "#FFF" },
  separador:         { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  separadorLinha:    { flex: 1, height: 1, backgroundColor: "#2A2A2A" },
  separadorTxt:      { fontSize: 11, color: "#555", fontWeight: "600" },
  cardViagens:       { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#150D25", borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: "#A78BFA44" },
  cardViagemIconBox: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#A78BFA22", alignItems: "center", justifyContent: "center" },
  cardViagemLabel:   { fontSize: 15, fontWeight: "800", color: "#A78BFA" },
  cardViagemDesc:    { fontSize: 11, color: "#7B6FA0", marginTop: 2, lineHeight: 16 },
  cardViagemArrow:   { fontSize: 26, color: "#A78BFA", fontWeight: "300" },
});
