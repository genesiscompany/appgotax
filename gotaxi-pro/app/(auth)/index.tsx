import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { Colors, PRO_TYPE_COLORS, PRO_TYPE_LABELS, PRO_TYPE_ICONS } from "@/constants/colors";

type Mode = "login" | "cadastro";
type TipoPro = "motorista" | "delivery" | "entregas";

const TIPOS: TipoPro[] = ["motorista", "delivery", "entregas"];

export default function AuthScreen() {
  const router = useRouter();
  const { login, cadastro } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [tipo, setTipo] = useState<TipoPro>("motorista");
  const [telefone, setTelefone] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);

  const cor = PRO_TYPE_COLORS[tipo];

  const handleLogin = async () => {
    if (!telefone || !pin) return Alert.alert("Atenção", "Preencha telefone e PIN.");
    setLoading(true);
    const result = await login(telefone.replace(/\D/g, ""), pin);
    setLoading(false);
    if (!result.ok) return Alert.alert("Erro", result.error || "Credenciais inválidas");
    router.replace("/");
  };

  const handleCadastro = async () => {
    if (!nome || !telefone || !pin) return Alert.alert("Atenção", "Preencha todos os campos.");
    if (pin.length < 4) return Alert.alert("PIN inválido", "O PIN deve ter 4 dígitos.");
    if (pin !== pinConfirm) return Alert.alert("PIN inválido", "Os PINs não coincidem.");
    setLoading(true);
    const result = await cadastro({ nome, telefone: telefone.replace(/\D/g, ""), pin, cpf, tipo_profissional: tipo });
    setLoading(false);
    if (!result.ok) return Alert.alert("Erro", result.error || "Não foi possível cadastrar");
    router.replace("/");
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={[styles.logoBadge, { borderColor: cor }]}>
            <Text style={[styles.logoText, { color: cor }]}>G</Text>
          </View>
          <Text style={styles.logoTitle}>GoTaxi <Text style={{ color: cor }}>Pro</Text></Text>
          <Text style={styles.logoSub}>Painel do Profissional</Text>
        </View>

        {/* Mode toggle */}
        <View style={styles.modeRow}>
          {(["login", "cadastro"] as Mode[]).map(m => (
            <TouchableOpacity key={m} style={[styles.modeBtn, mode === m && { borderBottomColor: cor, borderBottomWidth: 2 }]}
              onPress={() => setMode(m)}>
              <Text style={[styles.modeTxt, mode === m && { color: cor }]}>
                {m === "login" ? "Entrar" : "Cadastrar"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tipo seleção (só no cadastro) */}
        {mode === "cadastro" && (
          <View style={styles.section}>
            <Text style={styles.label}>Sou profissional de:</Text>
            <View style={styles.tipoRow}>
              {TIPOS.map(t => (
                <TouchableOpacity key={t} onPress={() => setTipo(t)}
                  style={[styles.tipoCard, tipo === t && { borderColor: PRO_TYPE_COLORS[t], backgroundColor: PRO_TYPE_COLORS[t] + "22" }]}>
                  <Text style={styles.tipoIcon}>{PRO_TYPE_ICONS[t]}</Text>
                  <Text style={[styles.tipoLabel, tipo === t && { color: PRO_TYPE_COLORS[t] }]}>
                    {PRO_TYPE_LABELS[t]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Form */}
        <View style={styles.form}>
          {mode === "cadastro" && (
            <>
              <Text style={styles.label}>Nome completo</Text>
              <TextInput style={styles.input} placeholder="Seu nome" placeholderTextColor={Colors.textMuted}
                value={nome} onChangeText={setNome} autoCapitalize="words" />
              <Text style={styles.label}>CPF (opcional)</Text>
              <TextInput style={styles.input} placeholder="000.000.000-00" placeholderTextColor={Colors.textMuted}
                value={cpf} onChangeText={setCpf} keyboardType="number-pad" maxLength={14} />
            </>
          )}

          <Text style={styles.label}>Telefone</Text>
          <TextInput style={styles.input} placeholder="(11) 99999-0000" placeholderTextColor={Colors.textMuted}
            value={telefone} onChangeText={setTelefone} keyboardType="phone-pad" />

          <Text style={styles.label}>PIN (4 dígitos)</Text>
          <TextInput style={styles.input} placeholder="••••" placeholderTextColor={Colors.textMuted}
            value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={4} />

          {mode === "cadastro" && (
            <>
              <Text style={styles.label}>Confirmar PIN</Text>
              <TextInput style={styles.input} placeholder="••••" placeholderTextColor={Colors.textMuted}
                value={pinConfirm} onChangeText={setPinConfirm} keyboardType="number-pad" secureTextEntry maxLength={4} />
            </>
          )}

          <TouchableOpacity style={[styles.btn, { backgroundColor: cor }]} onPress={mode === "login" ? handleLogin : handleCadastro} disabled={loading}>
            {loading ? <ActivityIndicator color="#000" /> : (
              <Text style={styles.btnTxt}>{mode === "login" ? "Entrar" : "Criar conta"}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setMode(mode === "login" ? "cadastro" : "login")}>
            <Text style={styles.switchTxt}>
              {mode === "login" ? "Não tem conta? " : "Já tem conta? "}
              <Text style={{ color: cor }}>{mode === "login" ? "Cadastre-se" : "Entrar"}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 60 },
  logoArea: { alignItems: "center", marginBottom: 36 },
  logoBadge: { width: 72, height: 72, borderRadius: 20, borderWidth: 2.5, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  logoText: { fontSize: 36, fontWeight: "900" },
  logoTitle: { fontSize: 28, fontWeight: "800", color: Colors.text },
  logoSub: { fontSize: 14, color: Colors.textSecondary, marginTop: 4 },
  modeRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: Colors.border, marginBottom: 24 },
  modeBtn: { flex: 1, paddingBottom: 12, alignItems: "center" },
  modeTxt: { fontSize: 15, fontWeight: "600", color: Colors.textSecondary },
  section: { marginBottom: 20 },
  label: { fontSize: 13, color: Colors.textSecondary, marginBottom: 8, marginTop: 12 },
  tipoRow: { flexDirection: "row", gap: 10 },
  tipoCard: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, padding: 12, alignItems: "center", gap: 6 },
  tipoIcon: { fontSize: 24 },
  tipoLabel: { fontSize: 11, fontWeight: "600", color: Colors.textSecondary, textAlign: "center" },
  form: { gap: 4 },
  input: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, color: Colors.text, fontSize: 16, marginBottom: 4,
  },
  btn: { borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 20 },
  btnTxt: { fontSize: 16, fontWeight: "700", color: "#000" },
  switchTxt: { textAlign: "center", color: Colors.textSecondary, marginTop: 16, fontSize: 14 },
});
