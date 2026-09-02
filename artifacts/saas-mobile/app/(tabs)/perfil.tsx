import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useColorScheme,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

type MenuItemType = {
  icone: keyof typeof Feather.glyphMap;
  label: string;
  sublabel?: string;
  onPress: () => void;
  danger?: boolean;
};

function MenuItem({ item, colors }: { item: MenuItemType; colors: typeof Colors.light }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, { opacity: pressed ? 0.7 : 1 }]}
      onPress={item.onPress}
    >
      <View style={[styles.menuIcon, { backgroundColor: item.danger ? "#EF444420" : colors.backgroundSecondary }]}>
        <Feather name={item.icone} size={18} color={item.danger ? "#EF4444" : colors.textSecondary} />
      </View>
      <View style={styles.menuContent}>
        <Text style={[styles.menuLabel, { color: item.danger ? "#EF4444" : colors.text, fontFamily: "Inter_500Medium" }]}>
          {item.label}
        </Text>
        {item.sublabel && (
          <Text style={[styles.menuSublabel, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
            {item.sublabel}
          </Text>
        )}
      </View>
      {!item.danger && <Feather name="chevron-right" size={18} color={colors.textMuted} />}
    </Pressable>
  );
}

export default function PerfilScreen() {
  const { auth, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0) + 16;

  const papelLabels: Record<string, string> = {
    admin: "Administrador",
    operador: "Operador",
    cliente: "Cliente",
    motorista: "Motorista",
    entregador: "Entregador",
  };

  const menuItems: MenuItemType[] = [
    {
      icone: "user",
      label: "Dados pessoais",
      sublabel: "Nome, email, telefone",
      onPress: () => {},
    },
    {
      icone: "bell",
      label: "Notificações",
      sublabel: "Gerencie seus alertas",
      onPress: () => {},
    },
    {
      icone: "shield",
      label: "Segurança",
      sublabel: "Senha e autenticação",
      onPress: () => {},
    },
    {
      icone: "globe",
      label: "Idioma",
      sublabel: "Português (Brasil)",
      onPress: () => {},
    },
    {
      icone: "help-circle",
      label: "Suporte",
      sublabel: "Central de ajuda",
      onPress: () => {},
    },
    {
      icone: "log-out",
      label: "Sair",
      danger: true,
      onPress: async () => {
        router.replace("/login");
        await logout();
      },
    },
  ];

  const inicial = auth.usuario?.nome?.charAt(0).toUpperCase() || "A";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topPadding, paddingBottom: insets.bottom + 100, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <Text style={[styles.pageTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Perfil</Text>

        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.tint }]}>
            <Text style={[styles.avatarText, { fontFamily: "Inter_700Bold" }]}>{inicial}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
              {auth.usuario?.nome || "Usuário"}
            </Text>
            <Text style={[styles.profileEmail, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
              {auth.usuario?.email || ""}
            </Text>
            <View style={[styles.roleBadge, { backgroundColor: colors.tint + "20" }]}>
              <Text style={[styles.roleText, { color: colors.tint, fontFamily: "Inter_500Medium" }]}>
                {papelLabels[auth.usuario?.papel || "admin"] || "Admin"}
              </Text>
            </View>
          </View>
        </View>

        {auth.empresa && (
          <View style={[styles.empresaCard, { backgroundColor: colors.tint + "15", borderColor: colors.tint + "30" }]}>
            <Feather name="briefcase" size={16} color={colors.tint} />
            <View style={styles.empresaInfo}>
              <Text style={[styles.empresaNome, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>
                {auth.empresa.nome}
              </Text>
              <Text style={[styles.empresaDetails, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                {auth.empresa.codigo} · Plano {auth.empresa.plano}
              </Text>
            </View>
          </View>
        )}

        <View style={[styles.menuSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {menuItems.map((item, index) => (
            <View key={item.label}>
              <MenuItem item={item} colors={colors} />
              {index < menuItems.length - 1 && (
                <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
              )}
            </View>
          ))}
        </View>

        <Text style={[styles.version, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
          Versão 1.0.0 · SaaS Multi-Empresas
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pageTitle: { fontSize: 26, marginBottom: 20 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    gap: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 26, color: "#fff" },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, marginBottom: 4 },
  profileEmail: { fontSize: 13, marginBottom: 8 },
  roleBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  roleText: { fontSize: 12 },
  empresaCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 20,
  },
  empresaInfo: { flex: 1 },
  empresaNome: { fontSize: 14, marginBottom: 2 },
  empresaDetails: { fontSize: 12 },
  menuSection: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuContent: { flex: 1 },
  menuLabel: { fontSize: 15, marginBottom: 1 },
  menuSublabel: { fontSize: 12 },
  menuDivider: { height: 1, marginHorizontal: 16 },
  version: { textAlign: "center", fontSize: 12 },
});
