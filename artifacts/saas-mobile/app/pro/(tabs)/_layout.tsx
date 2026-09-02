import React, { useEffect, useRef, useState } from "react";
import { Tabs, router } from "expo-router";
import { Text, View, StyleSheet, Alert, Platform } from "react-native";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProAuth, PRO_COLORS, PRO_JOB, PRO_ICONS } from "@/context/ProAuthContext";
import RideRequestOverlay from "@/components/RideRequestOverlay";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const POLL_INTERVAL = 3000;

// Push notifications are only available in native (standalone/dev-build) — NOT Expo Go SDK 53+
const isExpoGo = Constants.appOwnership === "expo";

// Lazy-load expo-notifications only in native builds to avoid Expo Go crash
let Notifications: any = null;
if (!isExpoGo) {
  try {
    Notifications = require("expo-notifications");
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (e) {
    console.log("expo-notifications not available:", e);
  }
}

function TabIcon({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <View style={styles.iconWrap}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const EXPO_PROJECT_ID = "4109488b-2deb-4686-afb7-5c3e46b57319";

async function registerForPushNotifications(): Promise<string | null> {
  if (!Notifications) return null;
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("corrida_channel", {
        name: "Corridas GoTaxi",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 300, 500, 300, 500, 300, 500],
        lightColor: "#1DB954",
        sound: "default",
        enableVibrate: true,
        bypassDnd: true,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;

    // FCM native token — used for ride alerts via Firebase
    const tokenData = await Notifications.getDevicePushTokenAsync();
    return tokenData.data;
  } catch (err) {
    console.log("Push registration error:", err);
    return null;
  }
}

// Expo push token — registered in push_tokens so admin broadcasts reach drivers
async function registerExpoBroadcastToken(proToken: string): Promise<void> {
  if (!Notifications || Platform.OS === "web") return;
  try {
    const expoToken = await Notifications.getExpoPushTokenAsync({ projectId: EXPO_PROJECT_ID });
    if (!expoToken?.data) return;
    await fetch(`${API_BASE}/cliente/push-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: proToken, pushToken: expoToken.data, modulo: "motorista" }),
    });
  } catch (e) {
    console.log("Expo broadcast token error:", e);
  }
}

export default function ProTabsLayout() {
  const { proUser, online } = useProAuth();
  const tipo = proUser?.tipo_profissional || "motorista";
  const insets = useSafeAreaInsets();
  const cor = PRO_COLORS[tipo];

  const [corridaPendente, setCorridaPendente] = useState<any>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentCorridaId = useRef<number | null>(null);
  const notifListener = useRef<any>(null);

  // Register push tokens once on login
  useEffect(() => {
    if (!proUser?.token) return;

    // 1. FCM native token → ride alerts via Firebase
    registerForPushNotifications().then(async (pushToken) => {
      if (!pushToken) return;
      try {
        await fetch(`${API_BASE}/motorista-app/fcm-token`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${proUser.token}`,
          },
          body: JSON.stringify({ token: pushToken }),
        });
      } catch {}
    });

    // 2. Expo push token → admin broadcast notifications
    registerExpoBroadcastToken(proUser.token);

    // Listen for notifications tapped while app is background/killed (native builds only)
    if (Notifications) {
      notifListener.current = Notifications.addNotificationResponseReceivedListener(() => {
        fetchCorrida();
      });
    }

    return () => {
      if (notifListener.current) {
        try {
          // expo-notifications v55+: subscription.remove() (Notifications.removeNotificationSubscription was removed)
          if (typeof notifListener.current.remove === "function") {
            notifListener.current.remove();
          } else if (Notifications && typeof Notifications.removeNotificationSubscription === "function") {
            Notifications.removeNotificationSubscription(notifListener.current);
          }
        } catch (e) {
          console.log("notif cleanup error:", e);
        }
        notifListener.current = null;
      }
    };
  }, [proUser?.token]);

  const isEntregador = tipo === "entregador" || tipo === "delivery";
  const pendingEndpoint = isEntregador ? "entrega-pendente" : "corrida-pendente";

  const fetchCorrida = async () => {
    if (!proUser?.token) return;
    try {
      const res = await fetch(`${API_BASE}/motorista-app/${pendingEndpoint}`, {
        headers: { Authorization: `Bearer ${proUser.token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const newId = data?.id ?? null;
      if (newId !== currentCorridaId.current) {
        currentCorridaId.current = newId;
        setCorridaPendente(data);
      }
    } catch {}
  };

  useEffect(() => {
    if (!proUser?.token || !online) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      setCorridaPendente(null);
      currentCorridaId.current = null;
      return;
    }
    fetchCorrida();
    pollRef.current = setInterval(fetchCorrida, POLL_INTERVAL);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [proUser?.token, online]);

  const handleAceitar = async (id: number) => {
    try {
      const endpoint = isEntregador
        ? `${API_BASE}/motorista-app/entrega/${id}/aceitar`
        : `${API_BASE}/motorista-app/corrida/${id}/aceitar`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${proUser!.token}` },
      });
      if (!res.ok) throw new Error("aceitar failed");

      const resData = await res.json();
      const mainCorridaId = resData?.corrida_id ?? id;

      const pendente = corridaPendente;
      setCorridaPendente(null);
      currentCorridaId.current = null;

      if (isEntregador) {
        // Se a entrega aceita é um pedido de delivery do PDV (alimentação),
        // o pedido_pdv_id volta no resData. Manda direto pra lista de entregas
        // do PDV (que já mostra detalhes, mapa e fluxo "saiu"/"entregue").
        if (resData?.pedido_pdv_id) {
          router.push("/pro/entregas-pdv" as any);
          return;
        }
        router.push({
          pathname: "/pro/entrega-ativa",
          params: {
            entregaId: String(id),
            fase: "coleta",
            coletaEndereco: pendente?.coleta_endereco ?? pendente?.origem_endereco ?? "",
            entregaEndereco: pendente?.entrega_endereco ?? pendente?.destino_endereco ?? "",
            categoriaName: pendente?.categoria_nome ?? "",
            valorEstimado: String(pendente?.valor_estimado ?? "0"),
            clienteNome: pendente?.cliente_nome ?? "Cliente",
            descricaoItem: pendente?.descricao_item ?? "",
            tipoServico: pendente?.tipo_servico ?? "entrega",
          },
        });
      } else {
        router.push({
          pathname: "/pro/corrida-ativa",
          params: {
            corridaId: String(id),
            mainCorridaId: String(mainCorridaId),
            fase: "embarque",
            origemEndereco: pendente?.origem_endereco ?? "",
            destinoEndereco: pendente?.destino_endereco ?? "",
            categoriaName: pendente?.categoria_nome ?? "",
            valorEstimado: String(pendente?.valor_estimado ?? "0"),
            clienteNome: pendente?.cliente_nome ?? "Cliente",
          },
        });
      }
    } catch {
      Alert.alert("Erro", "Não foi possível aceitar.");
    }
  };

  const handleRecusar = async (id: number) => {
    try {
      const endpoint = isEntregador
        ? `${API_BASE}/motorista-app/entrega/${id}/recusar`
        : `${API_BASE}/motorista-app/corrida/${id}/recusar`;
      await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${proUser!.token}` } });
    } catch {}
    setCorridaPendente(null);
    currentCorridaId.current = null;
  };

  return (
    <>
      <Tabs screenOptions={{
        headerShown: false,
        tabBarStyle: {
          ...styles.bar,
          height: 62 + insets.bottom,
          paddingBottom: insets.bottom + 8,
        },
        tabBarActiveTintColor: cor,
        tabBarInactiveTintColor: "#444",
        tabBarShowLabel: false,
      }}>
        <Tabs.Screen name="inicio"
          options={{ tabBarIcon: ({ color }) => <TabIcon icon="🏠" label="Início" color={color} /> }} />
        <Tabs.Screen name="servicos"
          options={{ tabBarIcon: ({ color }) => <TabIcon icon={PRO_ICONS[tipo]} label={PRO_JOB[tipo]} color={color} /> }} />
        <Tabs.Screen name="agenda"
          options={{ tabBarIcon: ({ color }) => <TabIcon icon="📅" label="Agenda" color={color} /> }} />
        <Tabs.Screen name="ganhos"
          options={{ tabBarIcon: ({ color }) => <TabIcon icon="💰" label="Ganhos" color={color} /> }} />
        <Tabs.Screen name="perfil"
          options={{ tabBarIcon: ({ color }) => <TabIcon icon="👤" label="Perfil" color={color} /> }} />
      </Tabs>

      <RideRequestOverlay
        corrida={corridaPendente}
        onAceitar={handleAceitar}
        onRecusar={handleRecusar}
      />
    </>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: "#111", borderTopColor: "#1E1E1E", borderTopWidth: 1, paddingTop: 8 },
  iconWrap: { alignItems: "center", gap: 3 },
  icon: { fontSize: 22 },
  label: { fontSize: 10, fontWeight: "700" },
});
