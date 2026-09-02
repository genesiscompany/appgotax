import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useProAuth } from "@/context/ProAuthContext";

export default function ProLogin() {
  const { login } = useProAuth();
  const [telefone, setTelefone] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const formatTel = (v: string) => {
    const n = v.replace(/\D/g, "").slice(0, 11);
    if (n.length <= 2) return n;
    if (n.length <= 7) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
    return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  };

  const handleLogin = async () => {
    if (!telefone || !pin) return Alert.alert("Atenção", "Preencha telefone e PIN.");
    if (pin.length < 4) return Alert.alert("PIN inválido", "O PIN deve ter 4 dígitos.");
    setLoading(true);
    const result = await login(telefone, pin);
    setLoading(false);
    if (!result.ok) return Alert.alert("Erro ao entrar", result.error || "Verifique seus dados.");
    router.replace("/pro" as any);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />

        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backTxt}>← Voltar</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Entrar no{"\n"}<Text style={styles.titlePro}>GoTaxi Pro</Text></Text>
          <Text style={styles.sub}>Acesse sua conta de profissional</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Telefone</Text>
          <TextInput
            style={styles.input}
            placeholder="(11) 99999-0000"
            placeholderTextColor="#444"
            value={telefone}
            onChangeText={v => setTelefone(formatTel(v))}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>PIN (4 dígitos)</Text>
          <TextInput
            style={styles.input}
            placeholder="••••"
            placeholderTextColor="#444"
            value={pin}
            onChangeText={setPin}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
          />

          <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.btnTxt}>Entrar</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace("/pro/cadastro" as any)}>
            <Text style={styles.link}>Não tem conta? <Text style={styles.linkHl}>Cadastre-se</Text></Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0D0D0D", paddingHorizontal: 24 },
  back: { marginTop: 12, marginBottom: 32 },
  backTxt: { color: "#8896B0", fontSize: 15 },
  header: { marginBottom: 40 },
  title: { fontSize: 32, fontWeight: "900", color: "#FFF", lineHeight: 38 },
  titlePro: { color: "#F5C518" },
  sub: { fontSize: 15, color: "#8896B0", marginTop: 8 },
  form: { gap: 8 },
  label: { fontSize: 13, color: "#8896B0", fontWeight: "600", marginTop: 12 },
  input: {
    backgroundColor: "#1A1A1A", borderWidth: 1.5, borderColor: "#2A2A2A",
    borderRadius: 14, paddingHorizontal: 18, paddingVertical: 16,
    color: "#FFF", fontSize: 17,
  },
  btn: { backgroundColor: "#F5C518", borderRadius: 16, paddingVertical: 17, alignItems: "center", marginTop: 24 },
  btnTxt: { fontSize: 17, fontWeight: "800", color: "#000" },
  link: { textAlign: "center", color: "#8896B0", marginTop: 20, fontSize: 14 },
  linkHl: { color: "#F5C518", fontWeight: "700" },
});
