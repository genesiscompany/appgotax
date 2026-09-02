import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput,
  useColorScheme, KeyboardAvoidingView, Platform,
  ActivityIndicator, Animated, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Colors from "@/constants/colors";
import { useCustomerAuth } from "@/context/CustomerAuthContext";

const BRAND_GREEN = "#22C55E";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "http://localhost:8080/api";

export default function CadastroScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const { register, login } = useCustomerAuth();
  const params = useLocalSearchParams<{ redirect?: string; modo?: string; codigo?: string }>();

  const [modo, setModo] = useState<"cadastro" | "login">(params.modo === "login" ? "login" : "cadastro");
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [senha, setSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [codigoAfiliado, setCodigoAfiliado] = useState(params.codigo ?? "");

  const slideAnim = useRef(new Animated.Value(0)).current;

  const formatWhatsapp = (val: string) => {
    const nums = val.replace(/\D/g, "").slice(0, 11);
    if (nums.length <= 2) return nums;
    if (nums.length <= 7) return `(${nums.slice(0,2)}) ${nums.slice(2)}`;
    return `(${nums.slice(0,2)}) ${nums.slice(2,7)}-${nums.slice(7)}`;
  };

  const handleSubmit = async () => {
    setErro(null);
    setLoading(true);
    let result: { ok: boolean; error?: string };
    if (modo === "cadastro") {
      result = await register(nome, whatsapp, senha, codigoAfiliado.trim() || undefined);
    } else {
      result = await login(whatsapp, senha);
    }
    setLoading(false);
    if (!result.ok) { setErro(result.error || "Erro desconhecido"); return; }
    // Se veio com código de afiliado, registra indicação (estatística)
    if (modo === "cadastro" && codigoAfiliado.trim()) {
      try {
        await fetch(`${API_BASE}/cliente/afiliados/usar-codigo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codigo: codigoAfiliado.trim(), nome_indicado: nome }),
        });
      } catch {}
    }
    const redirect = params.redirect;
    if (redirect) router.replace(redirect as any);
    else router.replace("/cliente" as any);
  };

  const switchModo = (m: "cadastro" | "login") => {
    setModo(m); setErro(null);
    Animated.spring(slideAnim, { toValue: m === "login" ? 1 : 0, useNativeDriver: false, friction: 8 }).start();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* HEADER GRADIENTE */}
        <LinearGradient colors={["#0F172A", "#1a2744"]} style={[styles.hero, { paddingTop: insets.top + 20 }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="x" size={22} color="rgba(255,255,255,0.7)" />
          </Pressable>
          <View style={[styles.heroBrand, { backgroundColor: BRAND_GREEN }]}>
            <Feather name="grid" size={22} color="#fff" />
          </View>
          <Text style={[styles.heroTitulo, { fontFamily: "Inter_700Bold" }]}>
            {modo === "cadastro" ? "Criar conta" : "Bem-vindo de volta"}
          </Text>
          <Text style={[styles.heroSub, { fontFamily: "Inter_400Regular" }]}>
            {modo === "cadastro"
              ? "Cadastro rápido para fazer seus pedidos"
              : "Entre para continuar"}
          </Text>
        </LinearGradient>

        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={styles.formContainer}>
            {/* TABS */}
            <View style={[styles.modeTabs, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              {(["cadastro", "login"] as const).map(m => (
                <Pressable key={m} onPress={() => switchModo(m)} style={[styles.modeTab, { backgroundColor: modo === m ? BRAND_GREEN : "transparent" }]}>
                  <Text style={[styles.modeTabText, {
                    color: modo === m ? "#fff" : colors.textSecondary,
                    fontFamily: modo === m ? "Inter_600SemiBold" : "Inter_400Regular",
                  }]}>
                    {m === "cadastro" ? "Cadastrar" : "Entrar"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* CAMPOS */}
            <View style={styles.fields}>
              {modo === "cadastro" && (
                <View>
                  <Text style={[styles.fieldLabel, { color: colors.text, fontFamily: "Inter_500Medium" }]}>Nome completo</Text>
                  <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
                    <Feather name="user" size={16} color={colors.textMuted} />
                    <TextInput
                      style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]}
                      placeholder="Seu nome"
                      placeholderTextColor={colors.textMuted}
                      value={nome}
                      onChangeText={setNome}
                      autoComplete="name"
                      returnKeyType="next"
                    />
                  </View>
                </View>
              )}

              <View>
                <Text style={[styles.fieldLabel, { color: colors.text, fontFamily: "Inter_500Medium" }]}>WhatsApp</Text>
                <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
                  <Feather name="message-circle" size={16} color={colors.textMuted} />
                  <TextInput
                    style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]}
                    placeholder="(11) 99999-9999"
                    placeholderTextColor={colors.textMuted}
                    value={whatsapp}
                    onChangeText={v => setWhatsapp(formatWhatsapp(v))}
                    keyboardType="phone-pad"
                    returnKeyType="next"
                  />
                </View>
              </View>

              <View>
                <Text style={[styles.fieldLabel, { color: colors.text, fontFamily: "Inter_500Medium" }]}>Senha</Text>
                <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
                  <Feather name="lock" size={16} color={colors.textMuted} />
                  <TextInput
                    style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]}
                    placeholder={modo === "cadastro" ? "Crie uma senha" : "Sua senha"}
                    placeholderTextColor={colors.textMuted}
                    value={senha}
                    onChangeText={setSenha}
                    secureTextEntry={!showSenha}
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                  />
                  <Pressable onPress={() => setShowSenha(!showSenha)}>
                    <Feather name={showSenha ? "eye-off" : "eye"} size={16} color={colors.textMuted} />
                  </Pressable>
                </View>
              </View>

              {/* Código de afiliado (opcional) */}
              {modo === "cadastro" && (
                <View>
                  <Text style={[styles.fieldLabel, { color: colors.text, fontFamily: "Inter_500Medium" }]}>
                    Código de indicação <Text style={{ color: colors.textMuted }}>(opcional)</Text>
                  </Text>
                  <View style={[styles.inputWrap, { borderColor: codigoAfiliado ? "#22C55E" : colors.border, backgroundColor: colors.backgroundSecondary }]}>
                    <Feather name="gift" size={16} color={codigoAfiliado ? "#22C55E" : colors.textMuted} />
                    <TextInput
                      style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]}
                      placeholder="Ex: JOAO0042"
                      placeholderTextColor={colors.textMuted}
                      value={codigoAfiliado}
                      onChangeText={v => setCodigoAfiliado(v.toUpperCase())}
                      autoCapitalize="characters"
                      returnKeyType="done"
                    />
                    {codigoAfiliado.length > 0 && (
                      <Feather name="check-circle" size={16} color="#22C55E" />
                    )}
                  </View>
                </View>
              )}
            </View>

            {/* ERRO */}
            {erro && (
              <View style={[styles.erroBox, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
                <Feather name="alert-circle" size={15} color="#EF4444" />
                <Text style={[styles.erroText, { fontFamily: "Inter_500Medium" }]}>{erro}</Text>
              </View>
            )}

            {/* BOTÃO */}
            <Pressable style={[styles.submitBtn, { backgroundColor: BRAND_GREEN }]} onPress={handleSubmit} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={[styles.submitBtnText, { fontFamily: "Inter_700Bold" }]}>
                    {modo === "cadastro" ? "Criar conta e continuar" : "Entrar"}
                  </Text>}
            </Pressable>

            {/* BENEFÍCIOS (só no cadastro) */}
            {modo === "cadastro" && (
              <View style={styles.beneficios}>
                {[
                  { icone: "shield" as const, texto: "Seus dados protegidos" },
                  { icone: "zap" as const, texto: "Cadastro em 30 segundos" },
                  { icone: "check-circle" as const, texto: "Sem anúncios ou spam" },
                ].map(b => (
                  <View key={b.texto} style={styles.beneficioRow}>
                    <Feather name={b.icone} size={14} color={BRAND_GREEN} />
                    <Text style={[styles.beneficioText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{b.texto}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={{ height: insets.bottom + 20 }} />
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { paddingHorizontal: 24, paddingBottom: 32 },
  backBtn: { alignSelf: "flex-end", marginBottom: 20, padding: 4 },
  heroBrand: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  heroTitulo: { fontSize: 28, color: "#fff", marginBottom: 8 },
  heroSub: { fontSize: 15, color: "rgba(255,255,255,0.65)", lineHeight: 22 },
  formContainer: { padding: 24, gap: 20 },
  modeTabs: { flexDirection: "row", borderRadius: 12, borderWidth: 1, padding: 4, gap: 4 },
  modeTab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center" },
  modeTabText: { fontSize: 14 },
  fields: { gap: 16 },
  fieldLabel: { fontSize: 14, marginBottom: 8 },
  inputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 52, gap: 10 },
  input: { flex: 1, fontSize: 15 },
  erroBox: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, padding: 12 },
  erroText: { color: "#EF4444", fontSize: 13, flex: 1 },
  submitBtn: { height: 56, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  submitBtnText: { color: "#fff", fontSize: 17 },
  beneficios: { gap: 10, paddingTop: 4 },
  beneficioRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  beneficioText: { fontSize: 13 },
});
