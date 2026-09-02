import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Image,
} from "react-native";
import { router } from "expo-router";

export default function LauncherScreen() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />

      <View style={styles.header}>
        <Image
          source={require("../assets/images/logo-gotaxi.png")}
          style={styles.logoImg}
          resizeMode="contain"
        />
        <Text style={styles.brand}>GoTaxi</Text>
        <Text style={styles.subtitle}>Escolha seu perfil para continuar</Text>
      </View>

      <View style={styles.cards}>
        <TouchableOpacity
          style={[styles.card, styles.cardCliente]}
          activeOpacity={0.85}
          onPress={() => router.push("/cliente" as any)}
        >
          <View style={[styles.iconBox, { backgroundColor: "#22C55E22" }]}>
            <Text style={styles.cardEmoji}>🛵</Text>
          </View>
          <View style={styles.cardText}>
            <Text style={[styles.cardTitle, { color: "#22C55E" }]}>GoTaxi Clientes</Text>
            <Text style={styles.cardDesc}>Peça corridas, entregas e serviços</Text>
          </View>
          <Text style={[styles.cardArrow, { color: "#22C55E" }]}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, styles.cardPro]}
          activeOpacity={0.85}
          onPress={() => router.push("/pro/bem-vindo" as any)}
        >
          <View style={[styles.iconBox, { backgroundColor: "#F5C51822" }]}>
            <Text style={styles.cardEmoji}>⚡</Text>
          </View>
          <View style={styles.cardText}>
            <Text style={[styles.cardTitle, { color: "#F5C518" }]}>GoTaxi Pro</Text>
            <Text style={styles.cardDesc}>Motoristas, Entregadores e Delivery</Text>
          </View>
          <Text style={[styles.cardArrow, { color: "#F5C518" }]}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, styles.cardEmpresa]}
          activeOpacity={0.85}
          onPress={() => router.push("/cliente/parceiros" as any)}
        >
          <View style={[styles.iconBox, { backgroundColor: "#3B82F622" }]}>
            <Text style={styles.cardEmoji}>🏢</Text>
          </View>
          <View style={styles.cardText}>
            <Text style={[styles.cardTitle, { color: "#60A5FA" }]}>GoTaxi Empresa</Text>
            <Text style={styles.cardDesc}>Seja parceiro · Restaurantes, lojas e mais</Text>
          </View>
          <Text style={[styles.cardArrow, { color: "#60A5FA" }]}>›</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>GoTaxi © 2025 — Todos os direitos reservados</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0D",
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoImg: {
    width: 110,
    height: 90,
    marginBottom: 12,
    marginTop: 24,
  },
  brand: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: "#888",
    marginTop: 6,
  },
  cards: {
    gap: 14,
  },
  card: {
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    gap: 14,
  },
  cardCliente: {
    backgroundColor: "#0F1F0F",
    borderColor: "#22C55E33",
  },
  cardPro: {
    backgroundColor: "#1A1A0D",
    borderColor: "#F5C51833",
  },
  cardEmpresa: {
    backgroundColor: "#0D1525",
    borderColor: "#3B82F633",
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardEmoji: {
    fontSize: 26,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 3,
  },
  cardDesc: {
    fontSize: 12,
    color: "#666",
    lineHeight: 17,
  },
  cardArrow: {
    fontSize: 28,
    fontWeight: "300",
  },
  footer: {
    textAlign: "center",
    color: "#444",
    fontSize: 12,
    marginTop: 40,
  },
});
