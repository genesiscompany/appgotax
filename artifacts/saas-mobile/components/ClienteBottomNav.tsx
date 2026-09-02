import React from "react";
import { View, Text, Pressable, StyleSheet, useColorScheme } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useCustomerAuth } from "@/context/CustomerAuthContext";

type Tab = {
  id: string;
  label: string;
  icone: keyof typeof Feather.glyphMap;
  rota: string;
};

const TABS: Tab[] = [
  { id: "inicio", label: "Início", icone: "home", rota: "/cliente" },
  { id: "comida", label: "Comida", icone: "coffee", rota: "/cliente/food" },
  { id: "viagens", label: "Viagens", icone: "navigation", rota: "/cliente/motorista" },
  { id: "loja", label: "Loja", icone: "shopping-bag", rota: "/cliente/lojistas?modulo=ecommerce" },
  { id: "servicos", label: "Serviços", icone: "tool", rota: "/cliente/lojistas?modulo=servicos" },
  { id: "entregas", label: "Entregas", icone: "package", rota: "/cliente/entrega" },
  { id: "perfil", label: "Perfil", icone: "user", rota: "/cliente/perfil" },
];

type Props = {
  activeTab?: string;
};

const BRAND_GREEN = "#22C55E";

export default function ClienteBottomNav({ activeTab = "inicio" }: Props) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const { isLoggedIn } = useCustomerAuth();

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 4 }]}>
      {TABS.map(tab => {
        const isActive = tab.id === activeTab;
        const isPerfilLoggedIn = tab.id === "perfil" && isLoggedIn;
        const activeColor = isPerfilLoggedIn ? BRAND_GREEN : (isActive ? BRAND_GREEN : colors.tabIconDefault);

        return (
          <Pressable key={tab.id} onPress={() => router.push(tab.rota as any)} style={styles.tab}>
            <View style={styles.iconWrapper}>
              <Feather name={tab.icone} size={20} color={activeColor} />
              {tab.id === "perfil" && isLoggedIn && (
                <View style={[styles.activeDot, { backgroundColor: BRAND_GREEN }]} />
              )}
            </View>
            <Text style={[styles.tabLabel, {
              color: activeColor,
              fontFamily: (isActive || isPerfilLoggedIn) ? "Inter_600SemiBold" : "Inter_400Regular",
            }]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingVertical: 4,
  },
  iconWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  activeDot: {
    position: "absolute",
    top: -2,
    right: -4,
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  tabLabel: {
    fontSize: 9,
    textAlign: "center",
  },
});
