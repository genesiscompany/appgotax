import React, { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useColorScheme,
  Platform,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

type ModuleItem = {
  id: string;
  nome: string;
  descricao: string;
  icone: keyof typeof Feather.glyphMap;
  cor: string;
  rota: string;
};

const MODULOS: ModuleItem[] = [
  { id: "motorista", nome: "Motorista App", descricao: "Gerencie corridas e motoristas", icone: "navigation", cor: Colors.modules.motorista, rota: "/modulo/motorista" },
  { id: "ecommerce", nome: "E-commerce", descricao: "Loja virtual e produtos", icone: "shopping-bag", cor: Colors.modules.ecommerce, rota: "/modulo/ecommerce" },
  { id: "servicos", nome: "Serviços", descricao: "Agendamentos e prestadores", icone: "tool", cor: Colors.modules.servicos, rota: "/modulo/servicos" },
  { id: "passagens", nome: "Passagens", descricao: "Rotas e reservas de viagens", icone: "map-pin", cor: Colors.modules.passagens, rota: "/modulo/passagens" },
  { id: "entrega", nome: "Entrega", descricao: "Logística e rastreamento", icone: "package", cor: Colors.modules.entrega, rota: "/modulo/entrega" },
  { id: "food", nome: "Food", descricao: "Delivery de alimentação", icone: "coffee", cor: Colors.modules.food, rota: "/cliente/food" },
];

function ModuleCard({ modulo, colors, isDark }: { modulo: ModuleItem; colors: typeof Colors.light; isDark: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }], flex: 1 }}>
      <Pressable
        onPress={() => router.push(modulo.rota as any)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.moduleCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={[styles.moduleIcon, { backgroundColor: modulo.cor + "20" }]}>
          <Feather name={modulo.icone} size={26} color={modulo.cor} />
        </View>
        <Text style={[styles.moduleName, { color: colors.text, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>
          {modulo.nome}
        </Text>
        <Text style={[styles.moduleDesc, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]} numberOfLines={2}>
          {modulo.descricao}
        </Text>
        <View style={[styles.moduleArrow, { backgroundColor: modulo.cor + "15" }]}>
          <Feather name="arrow-right" size={14} color={modulo.cor} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function ModulosScreen() {
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const modulosAtivos = auth.empresa?.modulosAtivos || MODULOS.map(m => m.id);
  const modulosFiltrados = MODULOS.filter(m => modulosAtivos.includes(m.id));

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0) + 16;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topPadding, paddingBottom: insets.bottom + 100, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.headerSection}>
          <View>
            <Text style={[styles.greeting, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
              Bem-vindo de volta
            </Text>
            <Text style={[styles.userName, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
              {auth.usuario?.nome?.split(" ")[0] || "Admin"}
            </Text>
          </View>
          <View style={[styles.avatarContainer, { backgroundColor: colors.tint + "20" }]}>
            <Feather name="user" size={22} color={colors.tint} />
          </View>
        </View>

        {auth.empresa && (
          <View style={[styles.empresaCard, { backgroundColor: colors.tint, shadowColor: colors.tint }]}>
            <View>
              <Text style={[styles.empresaLabel, { fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)" }]}>
                Empresa ativa
              </Text>
              <Text style={[styles.empresaNome, { fontFamily: "Inter_700Bold", color: "#fff" }]}>
                {auth.empresa.nome}
              </Text>
              <Text style={[styles.empresaPlano, { fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.85)" }]}>
                Plano {auth.empresa.plano.charAt(0).toUpperCase() + auth.empresa.plano.slice(1)}
              </Text>
            </View>
            <View style={styles.empresaStats}>
              <Text style={[styles.empresaStatNum, { fontFamily: "Inter_700Bold", color: "#fff" }]}>
                {modulosFiltrados.length}
              </Text>
              <Text style={[styles.empresaStatLabel, { fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)" }]}>
                Módulos
              </Text>
            </View>
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>
          Módulos Ativos
        </Text>

        <View style={styles.modulesGrid}>
          {modulosFiltrados.map((modulo, index) => (
            <ModuleCard key={modulo.id} modulo={modulo} colors={colors} isDark={isDark} />
          ))}
        </View>

        <Pressable
          onPress={() => router.push("/cliente" as any)}
          style={[styles.clienteBtn, { backgroundColor: colors.card, borderColor: colors.tint + "40" }]}
        >
          <View style={[styles.clienteBtnIcon, { backgroundColor: colors.tint + "15" }]}>
            <Feather name="smartphone" size={20} color={colors.tint} />
          </View>
          <View style={styles.clienteBtnInfo}>
            <Text style={[styles.clienteBtnTitulo, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>
              Ver como Cliente
            </Text>
            <Text style={[styles.clienteBtnSub, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
              Interface do usuário final
            </Text>
          </View>
          <Feather name="arrow-right" size={18} color={colors.tint} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  greeting: {
    fontSize: 13,
    marginBottom: 2,
  },
  userName: {
    fontSize: 26,
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  empresaCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  empresaLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  empresaNome: {
    fontSize: 18,
    marginBottom: 4,
  },
  empresaPlano: {
    fontSize: 13,
  },
  empresaStats: {
    alignItems: "center",
  },
  empresaStatNum: {
    fontSize: 32,
  },
  empresaStatLabel: {
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 16,
  },
  modulesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },
  moduleCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    minWidth: 150,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  moduleIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  moduleName: {
    fontSize: 14,
    marginBottom: 4,
  },
  moduleDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  moduleArrow: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  clienteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 16,
    marginTop: 8,
  },
  clienteBtnIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  clienteBtnInfo: { flex: 1 },
  clienteBtnTitulo: { fontSize: 15, marginBottom: 2 },
  clienteBtnSub: { fontSize: 12 },
});
