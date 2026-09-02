import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert, StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useProAuth, TipoPro, PRO_COLORS, PRO_LABELS, PRO_ICONS } from "@/context/ProAuthContext";

const TIPOS: TipoPro[] = ["motorista", "entregador", "delivery"];

const TIPO_DESC: Record<TipoPro, string> = {
  motorista:  "Transporte de passageiros — como Uber",
  entregador: "Entrega de pacotes e encomendas",
  delivery:   "Entrega de comida — como iFood",
};

export default function ProCadastro() {
  const { cadastro } = useProAuth();
  const [tipo, setTipo] = useState<TipoPro>("motorista");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const formatTel = (v: string) => {
    const n = v.replace(/\D/g, "").slice(0, 11);
    if (n.length <= 2) return n;
    if (n.length <= 7) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
    return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  };

  const handleCadastro = async () => {
    if (!nome.trim() || nome.trim().length < 3) return Alert.alert("Atenção", "Nome deve ter ao menos 3 letras.");
    if (!telefone) return Alert.alert("Atenção", "Informe seu telefone.");
    if (pin.length < 4) return Alert.alert("PIN inválido", "O PIN deve ter exatamente 4 dígitos.");
    if (pin !== pinConfirm) return Alert.alert("PIN inválido", "Os PINs não coincidem.");
    setLoading(true);
    const result = await cadastro({ nome: nome.trim(), telefone, cpf, pin, tipo_profissional: tipo });
    setLoading(false);
    if (!result.ok) return Alert.alert("Erro no cadastro", result.error || "Tente novamente.");
    router.replace("/pro" as any);
  };

  const cor = PRO_COLORS[tipo];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          <TouchableOpacity style={styles.back} onPress={() => router.back()}>
            <Text style={styles.backTxt}>← Voltar</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Criar conta no{"\n"}<Text style={styles.titlePro}>GoTaxi Pro</Text></Text>
          <Text style={styles.sub}>Preencha seus dados para se cadastrar</Text>

          {/* Tipo de profissional */}
          <Text style={styles.sectionLabel}>Quero trabalhar como:</Text>
          {TIPOS.map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tipoCard, tipo === t && { borderColor: PRO_COLORS[t], backgroundColor: PRO_COLORS[t] + "18" }]}
              onPress={() => setTipo(t)}
            >
              <Text style={styles.tipoIcon}>{PRO_ICONS[t]}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.tipoLabel, tipo === t && { color: PRO_COLORS[t] }]}>{PRO_LABELS[t]}</Text>
                <Text style={styles.tipoDesc}>{TIPO_DESC[t]}</Text>
              </View>
              <View style={[styles.radio, tipo === t && { borderColor: PRO_COLORS[t] }]}>
                {tipo === t && <View style={[styles.radioInner, { backgroundColor: PRO_COLORS[t] }]} />}
              </View>
            </TouchableOpacity>
          ))}

          {/* Dados pessoais */}
          <Text style={styles.sectionLabel}>Seus dados</Text>

          <Text style={styles.label}>Nome completo *</Text>
          <TextInput style={styles.input} placeholder="Seu nome completo" placeholderTextColor="#444"
            value={nome} onChangeText={setNome} autoCapitalize="words" />

          <Text style={styles.label}>Telefone *</Text>
          <TextInput style={styles.input} placeholder="(11) 99999-0000" placeholderTextColor="#444"
            value={telefone} onChangeText={v => setTelefone(formatTel(v))} keyboardType="phone-pad" />

          <Text style={styles.label}>CPF (opcional)</Text>
          <TextInput style={styles.input} placeholder="000.000.000-00" placeholderTextColor="#444"
            value={cpf} onChangeText={setCpf} keyboardType="number-pad" maxLength={14} />

          <Text style={styles.label}>Criar PIN de acesso (4 dígitos) *</Text>
          <TextInput style={styles.input} placeholder="••••" placeholderTextColor="#444"
            value={pin} onChangeText={setPin} keyboardType="number-pad" secureTextEntry maxLength={4} />

          <Text style={styles.label}>Confirmar PIN *</Text>
          <TextInput style={styles.input} placeholder="••••" placeholderTextColor="#444"
            value={pinConfirm} onChangeText={setPinConfirm} keyboardType="number-pad" secureTextEntry maxLength={4} />

          <TouchableOpacity style={[styles.btn, { backgroundColor: cor }]} onPress={handleCadastro} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.btnTxt}>Criar minha conta</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace("/pro/login" as any)}>
            <Text style={styles.link}>Já tem conta? <Text style={[styles.linkHl, { color: cor }]}>Entrar</Text></Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0D0D0D" },
  scroll: { paddingHorizontal: 24, paddingBottom: 40 },
  back: { marginTop: 12, marginBottom: 24 },
  backTxt: { color: "#8896B0", fontSize: 15 },
  title: { fontSize: 28, fontWeight: "900", color: "#FFF", lineHeight: 34 },
  titlePro: { color: "#F5C518" },
  sub: { fontSize: 14, color: "#8896B0", marginTop: 8, marginBottom: 24 },
  sectionLabel: { fontSize: 13, color: "#8896B0", fontWeight: "700", marginTop: 20, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  tipoCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#1A1A1A", borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1.5, borderColor: "#2A2A2A" },
  tipoIcon: { fontSize: 28 },
  tipoLabel: { fontSize: 15, fontWeight: "700", color: "#FFF" },
  tipoDesc: { fontSize: 12, color: "#8896B0", marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#444", justifyContent: "center", alignItems: "center" },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  label: { fontSize: 13, color: "#8896B0", fontWeight: "600", marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: "#1A1A1A", borderWidth: 1.5, borderColor: "#2A2A2A",
    borderRadius: 14, paddingHorizontal: 18, paddingVertical: 15, color: "#FFF", fontSize: 16,
  },
  btn: { borderRadius: 16, paddingVertical: 17, alignItems: "center", marginTop: 28 },
  btnTxt: { fontSize: 17, fontWeight: "800", color: "#000" },
  link: { textAlign: "center", color: "#8896B0", marginTop: 20, fontSize: 14 },
  linkHl: { fontWeight: "700" },
});
