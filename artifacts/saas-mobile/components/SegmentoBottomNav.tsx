import React, { useEffect, useRef, useState, useCallback } from "react";
import { fmtHora } from "@/utils/dateFormat";
import {
  View, Text, Pressable, StyleSheet, useColorScheme,
  Modal, KeyboardAvoidingView, Platform, TextInput,
  FlatList, ActivityIndicator, SafeAreaView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Colors from "@/constants/colors";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "http://localhost:8080/api";

export const SEGMENTO_NAV_HEIGHT = 60;

type Tab = "inicio" | "carrinho" | "finalizar";

type Props = {
  ativo?: Tab;
  onInicio?: () => void;
  onCarrinho?: () => void;
  onFinalizar?: () => void;
  qtdCarrinho?: number;
  corAtivo?: string;
  empresaId?: number | null;
  empresaNome?: string | null;
  clienteNome?: string | null;
};

type Msg = { id: number; remetente: "cliente" | "loja"; mensagem: string; created_at: string };

export default function SegmentoBottomNav({
  ativo = "inicio",
  onInicio,
  onCarrinho,
  onFinalizar,
  qtdCarrinho = 0,
  corAtivo = "#22C55E",
  empresaId,
  empresaNome,
  clienteNome,
}: Props) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const [chatOpen, setChatOpen] = useState(false);
  const [conversaId, setConversaId] = useState<number | null>(null);
  const [mensagens, setMensagens] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [naoLidas, setNaoLidas] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flatRef = useRef<FlatList>(null);

  const getClienteToken = async (): Promise<string> => {
    let token = await AsyncStorage.getItem("chat_cliente_token");
    if (!token) {
      token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      await AsyncStorage.setItem("chat_cliente_token", token);
    }
    return token;
  };

  const abrirChat = async () => {
    if (!empresaId) return;
    setChatOpen(true);
    setLoadingChat(true);
    try {
      const clienteToken = await getClienteToken();
      const r = await fetch(`${API_BASE}/chat/conversa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresa_id: empresaId, cliente_nome: clienteNome || "Cliente", cliente_token: clienteToken }),
      });
      const data = await r.json();
      setConversaId(data.id);
      await buscarMensagens(data.id);
    } catch {}
    setLoadingChat(false);
  };

  const buscarMensagens = useCallback(async (cid: number) => {
    try {
      const r = await fetch(`${API_BASE}/chat/conversa/${cid}/mensagens`);
      if (r.ok) {
        const data: Msg[] = await r.json();
        setMensagens(data);
        const novas = data.filter(m => m.remetente === "loja").length;
        setNaoLidas(prev => {
          const diff = data.filter(m => m.remetente === "loja").length - prev;
          return diff > 0 ? novas : prev;
        });
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 100);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (chatOpen && conversaId) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => buscarMensagens(conversaId), 3500);
      // reset unread when chat opens
      setNaoLidas(0);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [chatOpen, conversaId, buscarMensagens]);

  const enviar = async () => {
    if (!texto.trim() || !conversaId || enviando) return;
    const msg = texto.trim();
    setTexto("");
    setEnviando(true);
    try {
      const r = await fetch(`${API_BASE}/chat/conversa/${conversaId}/mensagem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remetente: "cliente", mensagem: msg }),
      });
      if (r.ok) {
        const nova = await r.json();
        setMensagens(prev => [...prev, nova]);
        setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch {}
    setEnviando(false);
  };

  const TABS = [
    { id: "inicio" as Tab, label: "Inicial", icone: "home" as const, onPress: onInicio },
    { id: "carrinho" as Tab, label: "Carrinho", icone: "shopping-cart" as const, onPress: onCarrinho, badge: qtdCarrinho },
    { id: "finalizar" as Tab, label: "Finalizar", icone: "check-circle" as const, onPress: onFinalizar },
    { id: "suporte" as const, label: "Suporte", icone: "message-circle" as const, onPress: empresaId ? abrirChat : undefined },
  ];

  const formatTime = (iso: string) => fmtHora(iso);

  return (
    <>
      {/* ── Chat Modal ─────────────────────────────────────────────── */}
      <Modal visible={chatOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setChatOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
            {/* Header */}
            <View style={[s.chatHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
              <Pressable onPress={() => setChatOpen(false)} style={s.chatBack}>
                <Feather name="x" size={20} color={colors.text} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={[s.chatHeaderTitle, { color: colors.text }]} numberOfLines={1}>
                  {empresaNome ?? "Suporte"}
                </Text>
                <Text style={[s.chatHeaderSub, { color: colors.textMuted }]}>Chat com a loja</Text>
              </View>
              <View style={[s.chatOnline, { backgroundColor: corAtivo + "22" }]}>
                <View style={[s.chatOnlineDot, { backgroundColor: corAtivo }]} />
                <Text style={[s.chatOnlineText, { color: corAtivo }]}>Online</Text>
              </View>
            </View>

            {/* Messages */}
            {loadingChat ? (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator color={corAtivo} />
              </View>
            ) : (
              <FlatList
                ref={flatRef}
                data={mensagens}
                keyExtractor={m => String(m.id)}
                contentContainerStyle={{ padding: 16, gap: 8, flexGrow: 1, justifyContent: mensagens.length === 0 ? "center" : "flex-start" }}
                ListEmptyComponent={
                  <View style={{ alignItems: "center", gap: 12 }}>
                    <Feather name="message-circle" size={48} color={colors.border} />
                    <Text style={[s.emptyText, { color: colors.textMuted }]}>Olá! Como podemos ajudar?</Text>
                    <Text style={[s.emptySubText, { color: colors.textMuted }]}>Digite sua mensagem abaixo.</Text>
                  </View>
                }
                renderItem={({ item: m }) => (
                  <View style={{ alignItems: m.remetente === "cliente" ? "flex-end" : "flex-start" }}>
                    <View style={[
                      s.bubble,
                      m.remetente === "cliente"
                        ? { backgroundColor: corAtivo, borderBottomRightRadius: 4 }
                        : { backgroundColor: colors.card, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
                    ]}>
                      <Text style={[s.bubbleText, { color: m.remetente === "cliente" ? "#fff" : colors.text }]}>
                        {m.mensagem}
                      </Text>
                      <Text style={[s.bubbleTime, { color: m.remetente === "cliente" ? "#fff8" : colors.textMuted }]}>
                        {formatTime(m.created_at)}
                      </Text>
                    </View>
                  </View>
                )}
              />
            )}

            {/* Input */}
            <View style={[s.chatInputRow, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
              <TextInput
                style={[s.chatInput, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                placeholder="Digite sua mensagem..."
                placeholderTextColor={colors.textMuted}
                value={texto}
                onChangeText={setTexto}
                multiline
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={enviar}
              />
              <Pressable
                onPress={enviar}
                disabled={!texto.trim() || enviando}
                style={[s.sendBtn, { backgroundColor: texto.trim() ? corAtivo : colors.border }]}
              >
                {enviando
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Feather name="send" size={18} color="#fff" />
                }
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ── Bottom Tab Bar ─────────────────────────────────────────── */}
      <View style={[
        styles.container,
        { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 4 },
      ]}>
        {TABS.map(tab => {
          const isActive = tab.id !== "suporte" && tab.id === ativo;
          const isSuporte = tab.id === "suporte";
          const color = isSuporte ? corAtivo : isActive ? corAtivo : colors.tabIconDefault;

          return (
            <Pressable key={tab.id} style={styles.tab} onPress={tab.onPress}>
              <View style={styles.iconWrap}>
                <Feather name={tab.icone} size={21} color={color} />
                {tab.id === "carrinho" && (tab.badge ?? 0) > 0 && (
                  <View style={[styles.badge, { backgroundColor: corAtivo }]}>
                    <Text style={styles.badgeText}>{tab.badge}</Text>
                  </View>
                )}
                {isSuporte && naoLidas > 0 && (
                  <View style={[styles.badge, { backgroundColor: "#EF4444" }]}>
                    <Text style={styles.badgeText}>{naoLidas}</Text>
                  </View>
                )}
              </View>
              <Text style={[
                styles.label,
                { color, fontFamily: isActive ? "Inter_600SemiBold" : "Inter_400Regular" },
              ]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  chatHeader: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  chatBack: { padding: 4 },
  chatHeaderTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  chatHeaderSub: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 1 },
  chatOnline: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  chatOnlineDot: { width: 7, height: 7, borderRadius: 4 },
  chatOnlineText: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
  bubble: { maxWidth: "78%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, marginBottom: 2 },
  bubbleText: { fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20 },
  bubbleTime: { fontFamily: "Inter_400Regular", fontSize: 10, marginTop: 4, textAlign: "right" },
  emptyText: { fontFamily: "Inter_600SemiBold", fontSize: 15 },
  emptySubText: { fontFamily: "Inter_400Regular", fontSize: 13 },
  chatInputRow: {
    flexDirection: "row", alignItems: "flex-end", gap: 10,
    paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1,
  },
  chatInput: {
    flex: 1, borderWidth: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
    fontFamily: "Inter_400Regular", fontSize: 14, maxHeight: 100,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});

const styles = StyleSheet.create({
  container: { flexDirection: "row", borderTopWidth: 1, paddingTop: 8 },
  tab: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 4 },
  iconWrap: { position: "relative", alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute", top: -5, right: -8,
    minWidth: 16, height: 16, borderRadius: 8,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 3,
  },
  badgeText: { fontSize: 9, color: "#fff", fontFamily: "Inter_700Bold" },
  label: { fontSize: 10, textAlign: "center" },
});
