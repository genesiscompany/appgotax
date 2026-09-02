import React, { useEffect, useRef, useState } from "react";
import {
  Animated, Dimensions, Modal, StyleSheet, Text,
  TouchableOpacity, View, Vibration,
} from "react-native";
import { Audio } from "expo-av";

const { width } = Dimensions.get("window");
const COUNTDOWN = 30;

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "http://localhost:8080";
const ALERT_SOUND_URI = `${API_BASE}/api/sounds/corrida_alert.mp3`;

type Corrida = {
  id: number;
  tipo_servico: string;
  categoria_nome: string;
  valor_estimado: number;
  origem_endereco: string;
  destino_endereco: string;
  distancia_motorista_km: number;
  tempo_motorista_min: number;
  distancia_viagem_km: number;
  tempo_viagem_min: number;
  cliente_nome: string;
  cliente_rating: number;
  cliente_avaliacoes: number;
};

const TIPO_LABEL: Record<string, string> = {
  corrida: "Corrida",
  entrega: "Entrega",
  delivery: "Delivery",
};

const TIPO_ICON: Record<string, string> = {
  corrida: "🚗",
  entrega: "📦",
  delivery: "🛵",
};

export default function RideRequestOverlay({
  corrida,
  onAceitar,
  onRecusar,
}: {
  corrida: Corrida | null;
  onAceitar: (id: number) => void;
  onRecusar: (id: number) => void;
}) {
  const slideAnim = useRef(new Animated.Value(600)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;
  const [timer, setTimer] = useState(COUNTDOWN);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<Animated.CompositeAnimation | null>(null);

  const vibIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const playAlertSound = async () => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: ALERT_SOUND_URI },
        { shouldPlay: true, volume: 1.0 }
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate(status => {
        if ("didJustFinish" in status && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (e) {
      console.log("Sound error:", e);
    }
  };

  const stopSound = async () => {
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
  };

  const startVibration = () => {
    playAlertSound();
    Vibration.vibrate([0, 600, 200, 600, 200, 600]);
    vibIntervalRef.current = setInterval(() => {
      playAlertSound();
      Vibration.vibrate([0, 600, 200, 600, 200, 600]);
    }, 2500);
  };

  const stopVibration = () => {
    stopSound();
    Vibration.cancel();
    if (vibIntervalRef.current) {
      clearInterval(vibIntervalRef.current);
      vibIntervalRef.current = null;
    }
  };

  const startCountdown = (id: number) => {
    setTimer(COUNTDOWN);
    progressAnim.setValue(1);

    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          stopVibration();
          onRecusar(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    progressRef.current = Animated.timing(progressAnim, {
      toValue: 0,
      duration: COUNTDOWN * 1000,
      useNativeDriver: false,
    });
    progressRef.current.start();
  };

  const stopCountdown = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (progressRef.current) progressRef.current.stop();
    stopVibration();
  };

  useEffect(() => {
    if (corrida) {
      startVibration();
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
      startCountdown(corrida.id);
    } else {
      stopCountdown();
      slideAnim.setValue(600);
    }
    return () => stopCountdown();
  }, [corrida?.id]);

  if (!corrida) return null;

  const fmtMoney = (v: number) =>
    `R$ ${Number(v).toFixed(2).replace(".", ",")}`;

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const timerColor = timer <= 10 ? "#EF4444" : "#1DB954";
  const icon = TIPO_ICON[corrida.tipo_servico] || "🚗";
  const tipoLabel = TIPO_LABEL[corrida.tipo_servico] || "Corrida";

  return (
    <Modal transparent animationType="none" visible={!!corrida} onRequestClose={() => {}}>
      <View style={s.backdrop}>
        <Animated.View style={[s.card, { transform: [{ translateY: slideAnim }] }]}>

          {/* Header */}
          <View style={s.header}>
            <View style={s.tagRow}>
              <View style={s.catTag}>
                <Text style={s.catTagText}>{corrida.categoria_nome}</Text>
              </View>
              <View style={s.tipoTag}>
                <Text style={s.tipoTagIcon}>{icon}</Text>
                <Text style={s.tipoTagText}>{tipoLabel}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={s.xBtn}
              onPress={() => { stopCountdown(); onRecusar(corrida.id); }}
            >
              <Text style={s.xBtnTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Price */}
          <Text style={s.price}>{fmtMoney(corrida.valor_estimado)}</Text>

          {/* Client info */}
          <View style={s.clientRow}>
            <View style={s.ratingPill}>
              <Text style={s.ratingStar}>★</Text>
              <Text style={s.ratingVal}>
                {Number(corrida.cliente_rating).toFixed(2)} ({corrida.cliente_avaliacoes})
              </Text>
            </View>
            {corrida.cliente_nome && (
              <View style={s.verifiedPill}>
                <Text style={s.verifiedIcon}>✓</Text>
                <Text style={s.verifiedTxt}>Verificado</Text>
              </View>
            )}
          </View>

          {/* Route */}
          <View style={s.route}>
            {/* To pickup */}
            <View style={s.routeRow}>
              <View style={s.routeDots}>
                <View style={s.dotTop} />
                <View style={s.routeLine} />
              </View>
              <View style={s.routeInfo}>
                <Text style={s.routeTime}>
                  {corrida.tempo_motorista_min} min ({corrida.distancia_motorista_km} km) de distância
                </Text>
                <Text style={s.routeAddr} numberOfLines={2}>{corrida.origem_endereco}</Text>
              </View>
            </View>
            {/* To destination */}
            <View style={s.routeRow}>
              <View style={s.routeDots}>
                <View style={s.dotBottom} />
              </View>
              <View style={s.routeInfo}>
                <Text style={s.routeTime}>
                  Viagem de {corrida.tempo_viagem_min} min ({corrida.distancia_viagem_km} km)
                </Text>
                <Text style={s.routeAddr} numberOfLines={2}>{corrida.destino_endereco}</Text>
              </View>
            </View>
          </View>

          {/* Countdown bar */}
          <View style={s.progressTrack}>
            <Animated.View style={[s.progressFill, { width: progressWidth, backgroundColor: timerColor }]} />
          </View>

          {/* Buttons */}
          <View style={s.btnRow}>
            <TouchableOpacity
              style={s.recusarBtn}
              onPress={() => { stopCountdown(); onRecusar(corrida.id); }}
            >
              <Text style={s.recusarTxt}>Recusar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.aceitarBtn}
              onPress={() => { stopCountdown(); onAceitar(corrida.id); }}
            >
              <Text style={s.aceitarTxt}>Aceitar</Text>
              <View style={[s.timerBadge, { backgroundColor: timerColor }]}>
                <Text style={s.timerNum}>{timer}s</Text>
              </View>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: "#141414",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tagRow: { flexDirection: "row", gap: 8 },
  catTag: { backgroundColor: "#1DB954", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  catTagText: { color: "#000", fontWeight: "800", fontSize: 13 },
  tipoTag: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#2A2A2A", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  tipoTagIcon: { fontSize: 13 },
  tipoTagText: { color: "#CCC", fontWeight: "600", fontSize: 13 },
  xBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#2A2A2A", justifyContent: "center", alignItems: "center" },
  xBtnTxt: { color: "#888", fontSize: 14, fontWeight: "700" },
  price: { fontSize: 46, fontWeight: "900", color: "#FFF", letterSpacing: -1 },
  clientRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  ratingPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#2A2A2A", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  ratingStar: { color: "#F5C518", fontSize: 14 },
  ratingVal: { color: "#FFF", fontWeight: "700", fontSize: 13 },
  verifiedPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#1A3A52", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  verifiedIcon: { color: "#3B9EFF", fontSize: 13, fontWeight: "900" },
  verifiedTxt: { color: "#3B9EFF", fontWeight: "700", fontSize: 13 },
  route: { backgroundColor: "#1E1E1E", borderRadius: 16, padding: 16, gap: 10 },
  routeRow: { flexDirection: "row", gap: 12 },
  routeDots: { alignItems: "center", width: 14 },
  dotTop: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#888", marginTop: 3 },
  routeLine: { width: 2, flex: 1, backgroundColor: "#333", marginVertical: 4 },
  dotBottom: { width: 12, height: 12, borderRadius: 2, backgroundColor: "#1DB954", marginTop: 3 },
  routeInfo: { flex: 1, gap: 2 },
  routeTime: { fontSize: 13, fontWeight: "700", color: "#FFF" },
  routeAddr: { fontSize: 12, color: "#888", lineHeight: 17 },
  progressTrack: { height: 4, backgroundColor: "#2A2A2A", borderRadius: 2, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 2 },
  btnRow: { flexDirection: "row", gap: 12 },
  recusarBtn: { flex: 1, backgroundColor: "#2A2A2A", borderRadius: 16, paddingVertical: 18, alignItems: "center" },
  recusarTxt: { color: "#888", fontWeight: "700", fontSize: 15 },
  aceitarBtn: { flex: 2, backgroundColor: "#1DB954", borderRadius: 16, paddingVertical: 18, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 },
  aceitarTxt: { color: "#000", fontWeight: "900", fontSize: 16 },
  timerBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  timerNum: { color: "#000", fontWeight: "900", fontSize: 12 },
});
