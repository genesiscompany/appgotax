import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { Colors, PRO_TYPE_COLORS, PRO_JOB_LABEL } from "@/constants/colors";

function TabIcon({ label, icon, focused, color }: { label: string; icon: string; focused: boolean; color: string }) {
  return (
    <View style={styles.iconWrap}>
      <Text style={[styles.iconText, focused && { transform: [{ scale: 1.1 }] }]}>{icon}</Text>
      <Text style={[styles.iconLabel, { color }]}>{label}</Text>
    </View>
  );
}

export default function ProLayout() {
  const { user } = useAuth();
  const cor = user ? PRO_TYPE_COLORS[user.tipo_profissional] || Colors.primary : Colors.primary;
  const jobLabel = user ? PRO_JOB_LABEL[user.tipo_profissional] || "Trabalho" : "Trabalho";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: cor,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon label="Início" icon="🏠" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon label={jobLabel} icon={user?.tipo_profissional === "motorista" ? "🚗" : user?.tipo_profissional === "delivery" ? "🍔" : "📦"} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ganhos"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon label="Ganhos" icon="💰" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          tabBarIcon: ({ focused, color }) => (
            <TabIcon label="Perfil" icon="👤" focused={focused} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    height: 70,
    paddingBottom: 10,
    paddingTop: 6,
  },
  iconWrap: { alignItems: "center", gap: 3 },
  iconText: { fontSize: 22 },
  iconLabel: { fontSize: 10, fontWeight: "600" },
});
