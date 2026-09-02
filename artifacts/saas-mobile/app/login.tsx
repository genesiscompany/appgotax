import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import Colors from "@/constants/colors";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api` : "/api";

export default function LoginScreen() {
  const { login, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  const [email, setEmail] = useState("admin@empresa.com");
  const [senha, setSenha] = useState("123456");
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");

  const handleLogin = async () => {
    if (!email || !senha) {
      Alert.alert("Atenção", "Preencha email e senha");
      return;
    }
    setLoading(true);
    // Sempre limpar sessão anterior antes de tentar autenticar (evita vazamento entre tenants)
    await logout();
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });
      const data = await res.json();
      if (res.ok) {
        await login(data.token, data.usuario, data.empresa);
        router.replace("/(tabs)");
      } else {
        Alert.alert("Erro", data.message || "Credenciais inválidas");
      }
    } catch {
      Alert.alert("Erro de conexão", "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!nome || !email || !senha) {
      Alert.alert("Atenção", "Preencha todos os campos obrigatórios");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, senha, telefone, empresaId: 1 }),
      });
      const data = await res.json();
      if (res.ok) {
        await login(data.token, data.usuario, data.empresa);
        router.replace("/(tabs)");
      } else {
        Alert.alert("Erro", data.message || "Erro ao registrar");
      }
    } catch {
      Alert.alert("Erro", "Não foi possível conectar ao servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 40), paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={[styles.logoContainer, { backgroundColor: colors.tint }]}>
            <Feather name="grid" size={32} color="#fff" />
          </View>
          <Text style={[styles.title, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
            SaaS Multi-Empresas
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
            {isRegister ? "Crie sua conta" : "Acesse sua conta"}
          </Text>
        </View>

        <View style={styles.form}>
          {isRegister && (
            <View style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Feather name="user" size={18} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]}
                placeholder="Nome completo"
                placeholderTextColor={colors.textMuted}
                value={nome}
                onChangeText={setNome}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Feather name="mail" size={18} color={colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]}
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {isRegister && (
            <View style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Feather name="phone" size={18} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]}
                placeholder="Telefone (opcional)"
                placeholderTextColor={colors.textMuted}
                value={telefone}
                onChangeText={setTelefone}
                keyboardType="phone-pad"
              />
            </View>
          )}

          <View style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Feather name="lock" size={18} color={colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]}
              placeholder="Senha"
              placeholderTextColor={colors.textMuted}
              value={senha}
              onChangeText={setSenha}
              secureTextEntry={!showSenha}
              autoCapitalize="none"
            />
            <Pressable onPress={() => setShowSenha(!showSenha)} style={styles.eyeButton}>
              <Feather name={showSenha ? "eye-off" : "eye"} size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: colors.tint, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={isRegister ? handleRegister : handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.buttonText, { fontFamily: "Inter_600SemiBold" }]}>
                {isRegister ? "Criar conta" : "Entrar"}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => setIsRegister(!isRegister)}
            style={styles.switchButton}
          >
            <Text style={[styles.switchText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
              {isRegister ? "Já tem conta? " : "Não tem conta? "}
              <Text style={{ color: colors.tint, fontFamily: "Inter_600SemiBold" }}>
                {isRegister ? "Entrar" : "Registrar"}
              </Text>
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.demoHint, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
          Demo: use qualquer email/senha para entrar
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 26,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
  },
  form: {
    gap: 14,
  },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: "100%",
  },
  eyeButton: {
    padding: 4,
  },
  button: {
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    shadowColor: "#1A56DB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
  },
  switchButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  switchText: {
    fontSize: 14,
  },
  demoHint: {
    textAlign: "center",
    fontSize: 12,
    marginTop: 32,
  },
});
