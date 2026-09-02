import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Alert, StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";

const MOD = "#A78BFA";
const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "http://localhost:8080/api";

const TOKEN_KEY = "tur_viagens_pdv_token";
const EMPRESA_KEY = "tur_viagens_empresa";

type Tipo = "pf" | "pj";

export default function TurViagensCadastro() {
  const [tipo, setTipo]             = useState<Tipo>("pj");
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [email, setEmail]           = useState("");
  const [telefone, setTelefone]     = useState("");
  const [cidade, setCidade]         = useState("");
  const [estado, setEstado]         = useState("");
  const [cnpj, setCnpj]             = useState("");
  const [senha, setSenha]           = useState("");
  const [senhaConf, setSenhaConf]   = useState("");
  const [showSenha, setShowSenha]   = useState(false);
  const [loading, setLoading]       = useState(false);

  const formatTel = (v: string) => {
    const n = v.replace(/\D/g, "").slice(0, 11);
    if (n.length <= 2) return n;
    if (n.length <= 7) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
    return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  };

  async function handleCadastro() {
    const nome = nomeEmpresa.trim();
    if (!nome || nome.length < 2) { Alert.alert("Informe o nome da empresa ou do operador"); return; }
    if (!email.includes("@")) { Alert.alert("Informe um e-mail válido"); return; }
    if (!telefone) { Alert.alert("Informe seu telefone"); return; }
    if (!cidade.trim()) { Alert.alert("Informe a cidade de operação"); return; }
    if (senha.length < 6) { Alert.alert("A senha deve ter pelo menos 6 caracteres"); return; }
    if (senha !== senhaConf) { Alert.alert("As senhas não coincidem"); return; }

    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/public/tur-viagens/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          responsavel: responsavel.trim() || nome,
          email: email.trim().toLowerCase(),
          senha,
          telefone,
          cidade: cidade.trim(),
          estado: estado.trim(),
          cnpj: cnpj.trim(),
          tipo,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        Alert.alert("Erro no cadastro", d.message || d.error || "Tente novamente");
        return;
      }
      await AsyncStorage.setItem(TOKEN_KEY, d.token);
      await AsyncStorage.setItem(EMPRESA_KEY, JSON.stringify(d.empresa));

      Alert.alert(
        "Cadastro realizado! ✅",
        `Bem-vindo, ${nome}!\n\nSua empresa foi ativada. Acesse o painel abaixo para ver seu dashboard e use o PDV web para cadastrar rotas e horários.`,
        [{ text: "Ir ao painel", onPress: () => router.replace("/pro/tur-viagens" as any) }]
      );
    } catch {
      Alert.alert("Falha de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <SafeAreaView style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          <TouchableOpacity style={s.back} onPress={() => router.back()}>
            <Text style={s.backTxt}>← Voltar</Text>
          </TouchableOpacity>

          <Text style={s.title}>Cadastrar no{"\n"}<Text style={{ color: MOD }}>Tur Viagens</Text></Text>
          <Text style={s.sub}>Crie sua conta para vender passagens e gerenciar seus serviços de transporte</Text>

          {/* Tipo */}
          <Text style={s.sectionLabel}>Tipo de cadastro</Text>
          <View style={s.tipoRow}>
            {([["pj", "🏢", "Empresa (CNPJ)"], ["pf", "👤", "Autônomo (CPF)"]] as const).map(([t, icon, label]) => (
              <TouchableOpacity key={t} style={[s.tipoBtn, tipo === t && { backgroundColor: MOD + "22", borderColor: MOD }]}
                onPress={() => setTipo(t)}>
                <Text style={{ fontSize: 20 }}>{icon}</Text>
                <Text style={[s.tipoBtnTxt, tipo === t && { color: MOD }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Empresa / Nome */}
          <Text style={s.sectionLabel}>Dados {tipo === "pj" ? "da empresa" : "pessoais"}</Text>

          <Text style={s.label}>{tipo === "pj" ? "Nome da empresa *" : "Nome completo *"}</Text>
          <TextInput style={s.input} placeholder={tipo === "pj" ? "Ex: Trans Rota Sul Ltda" : "Seu nome completo"}
            placeholderTextColor="#444" value={nomeEmpresa} onChangeText={setNomeEmpresa}
            autoCapitalize="words" />

          {tipo === "pj" && (
            <>
              <Text style={s.label}>Nome do responsável *</Text>
              <TextInput style={s.input} placeholder="Nome do sócio/responsável"
                placeholderTextColor="#444" value={responsavel} onChangeText={setResponsavel}
                autoCapitalize="words" />
            </>
          )}

          <Text style={s.label}>{tipo === "pj" ? "CNPJ" : "CPF"} (opcional)</Text>
          <TextInput style={s.input} placeholder={tipo === "pj" ? "00.000.000/0001-00" : "000.000.000-00"}
            placeholderTextColor="#444" value={cnpj} onChangeText={setCnpj}
            keyboardType="numeric" />

          {/* Contato */}
          <Text style={s.sectionLabel}>Contato</Text>

          <Text style={s.label}>E-mail *</Text>
          <TextInput style={s.input} placeholder="contato@exemplo.com"
            placeholderTextColor="#444" value={email} onChangeText={setEmail}
            keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

          <Text style={s.label}>Telefone / WhatsApp *</Text>
          <TextInput style={s.input} placeholder="(11) 99999-0000"
            placeholderTextColor="#444" value={telefone}
            onChangeText={v => setTelefone(formatTel(v))} keyboardType="phone-pad" />

          {/* Localização */}
          <Text style={s.sectionLabel}>Localização</Text>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 2 }}>
              <Text style={s.label}>Cidade *</Text>
              <TextInput style={s.input} placeholder="Ex: Campinas"
                placeholderTextColor="#444" value={cidade} onChangeText={setCidade}
                autoCapitalize="words" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Estado</Text>
              <TextInput style={s.input} placeholder="SP"
                placeholderTextColor="#444" value={estado} onChangeText={setEstado}
                autoCapitalize="characters" maxLength={2} />
            </View>
          </View>

          {/* Senha */}
          <Text style={s.sectionLabel}>Acesso</Text>

          <Text style={s.label}>Senha *</Text>
          <View style={{ position: "relative" }}>
            <TextInput style={[s.input, { paddingRight: 48 }]} placeholder="Mínimo 6 caracteres"
              placeholderTextColor="#444" value={senha} onChangeText={setSenha}
              secureTextEntry={!showSenha} />
            <TouchableOpacity onPress={() => setShowSenha(!showSenha)} style={s.eyeBtn}>
              <Feather name={showSenha ? "eye-off" : "eye"} size={18} color="#555" />
            </TouchableOpacity>
          </View>

          <Text style={s.label}>Confirmar senha *</Text>
          <TextInput style={s.input} placeholder="Repita a senha"
            placeholderTextColor="#444" value={senhaConf} onChangeText={setSenhaConf}
            secureTextEntry />

          {/* Info */}
          <View style={s.infoCard}>
            <Feather name="info" size={14} color="#A78BFA" style={{ marginTop: 1 }} />
            <Text style={s.infoTxt}>
              Após o cadastro, acesse o painel web (PDV) para cadastrar seus veículos e criar suas caronas. O acesso mobile mostra um resumo das suas viagens.
            </Text>
          </View>

          <TouchableOpacity style={[s.btnPrimary, { backgroundColor: MOD, opacity: loading ? 0.7 : 1 }]}
            onPress={handleCadastro} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnPrimaryTxt}>Criar minha conta</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.replace("/pro/tur-viagens" as any)}>
            <Text style={s.linkTxt}>Já tem conta? <Text style={{ color: MOD }}>Entrar</Text></Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: "#0D0D0D" },
  scroll:       { paddingHorizontal: 24, paddingBottom: 40 },
  back:         { marginTop: 12, marginBottom: 20 },
  backTxt:      { color: MOD, fontSize: 14, fontWeight: "600" },
  title:        { fontSize: 26, fontWeight: "900", color: "#FFF", lineHeight: 32 },
  sub:          { fontSize: 14, color: "#8896B0", marginTop: 8, marginBottom: 24, lineHeight: 20 },
  sectionLabel: { fontSize: 11, color: "#8896B0", fontWeight: "700", marginTop: 24, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 },
  tipoRow:      { flexDirection: "row", gap: 12 },
  tipoBtn:      { flex: 1, backgroundColor: "#1A1A1A", borderRadius: 14, padding: 14, alignItems: "center", gap: 6, borderWidth: 1.5, borderColor: "#2A2A2A" },
  tipoBtnTxt:   { fontSize: 13, fontWeight: "700", color: "#FFF", textAlign: "center" },
  label:        { fontSize: 12, color: "#8896B0", fontWeight: "600", marginTop: 12, marginBottom: 6 },
  input:        { backgroundColor: "#1A1A1A", borderWidth: 1.5, borderColor: "#2A2A2A", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: "#FFF", fontSize: 15 },
  eyeBtn:       { position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" },
  infoCard:     { flexDirection: "row", gap: 10, backgroundColor: "#150D25", borderRadius: 12, padding: 14, marginTop: 20, borderWidth: 1, borderColor: "#A78BFA33" },
  infoTxt:      { flex: 1, fontSize: 12, color: "#8896B0", lineHeight: 18 },
  btnPrimary:   { borderRadius: 16, paddingVertical: 17, alignItems: "center", marginTop: 24 },
  btnPrimaryTxt:{ fontSize: 17, fontWeight: "800", color: "#fff" },
  linkTxt:      { textAlign: "center", color: "#8896B0", marginTop: 18, fontSize: 14 },
});
