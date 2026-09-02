import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useColorScheme,
  Platform,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

const BRAND_GREEN = "#22C55E";
const API_BASE = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api` : "/api";

const MODULOS_OPTIONS = [
  { id: "food", nome: "Alimentação", icone: "coffee" as const, cor: "#F97316", emoji: "🍔", desc: "Restaurantes, lanchonetes, marmitarias e delivery" },
  { id: "ecommerce", nome: "E-commerce", icone: "shopping-bag" as const, cor: "#8B5CF6", emoji: "🛍️", desc: "Lojas online, marketplace e varejo digital" },
  { id: "servicos", nome: "Serviços", icone: "tool" as const, cor: "#06B6D4", emoji: "🔧", desc: "Profissionais autônomos e prestadores de serviço (gerenciado pelo app)" },
];

const BENEFICIOS = [
  { icone: "trending-up" as const, titulo: "Mais clientes", desc: "Acesse milhares de usuários na plataforma" },
  { icone: "smartphone" as const, titulo: "App completo", desc: "Gerencie tudo pelo celular ou computador" },
  { icone: "shield" as const, titulo: "Pagamentos seguros", desc: "Receba em dia com proteção total" },
  { icone: "headphones" as const, titulo: "Suporte dedicado", desc: "Equipe disponível para te ajudar" },
];

export default function ParceirosScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const { login: authLogin, logout: authLogout } = useAuth();
  const [step, setStep] = useState<"intro" | "form" | "login" | "sucesso">("intro");
  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [moduloSel, setModuloSel] = useState<string>("");
  const [selectOpen, setSelectOpen] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmar, setShowConfirmar] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  // Login states
  const [loginEmail, setLoginEmail] = useState("");
  const [loginSenha, setLoginSenha] = useState("");
  const [showLoginSenha, setShowLoginSenha] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginErro, setLoginErro] = useState<string | null>(null);

  const topPadding = insets.top + (Platform.OS === "web" ? 0 : 0);

  const selecionado = MODULOS_OPTIONS.find(m => m.id === moduloSel) || null;

  const labelSelecionado = selecionado ? selecionado.nome : "Selecione o seguimento";

  const handleCadastrar = async () => {
    setErroForm(null);
    if (!nome.trim() || nome.trim().length < 3) { setErroForm("Informe seu nome completo (mínimo 3 caracteres)"); return; }
    if (!empresa.trim()) { setErroForm("Informe o nome da empresa"); return; }
    if (!email.trim() || !email.includes("@")) { setErroForm("Informe um e-mail válido"); return; }
    if (!whatsapp.replace(/\D/g, "") || whatsapp.replace(/\D/g, "").length < 10) { setErroForm("Informe um WhatsApp válido"); return; }
    if (!senha || senha.length < 6) { setErroForm("A senha deve ter no mínimo 6 caracteres"); return; }
    if (senha !== confirmarSenha) { setErroForm("As senhas não coincidem"); return; }
    if (!moduloSel) { setErroForm("Selecione um seguimento comercial"); return; }

    // Tur Viagens usa fluxo dedicado com ativação imediata
    if (moduloSel === "passagens") {
      router.push("/pro/tur-viagens-cadastro" as any);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/public/parceiro-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nome.trim(), empresa: empresa.trim(), email: email.trim(), whatsapp: whatsapp.replace(/\D/g, ""), senha, seguimento: moduloSel }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErroForm(data.message || "Erro ao realizar cadastro. Tente novamente.");
        setLoading(false);
        return;
      }
    } catch {
      setErroForm("Sem conexão com o servidor. Verifique sua internet.");
      setLoading(false);
      return;
    }
    setLoading(false);
    setStep("sucesso");
  };

  const handleLogin = async () => {
    setLoginErro(null);
    if (!loginEmail.trim() || !loginEmail.includes("@")) { setLoginErro("Informe um e-mail válido"); return; }
    if (!loginSenha) { setLoginErro("Informe sua senha"); return; }
    setLoginLoading(true);
    // CRÍTICO: limpar sessão anterior antes de autenticar (evita vazamento entre tenants)
    await authLogout();
    const pdvUrl = process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/pdv/`
      : "http://localhost:5173/pdv/";
    console.log("[parceiro-login] POST", `${API_BASE}/pdv/login`, "email=", loginEmail.trim().toLowerCase());
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/pdv/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail.trim().toLowerCase(), senha: loginSenha }),
      });
    } catch (e: any) {
      console.error("[parceiro-login] fetch error:", e?.message, e);
      setLoginErro(`Erro de rede: ${e?.message || "sem conexão"}. Verifique sua internet.`);
      setLoginLoading(false);
      return;
    }
    let data: any = {};
    try { data = await res.json(); } catch (e: any) {
      console.error("[parceiro-login] json parse error:", e?.message);
    }
    console.log("[parceiro-login] response status=", res.status, "body=", JSON.stringify(data).slice(0, 200));
    if (!res.ok) {
      setLoginErro(data.message || `E-mail ou senha incorretos (${res.status})`);
      setLoginLoading(false);
      return;
    }
    setLoginLoading(false);
    // CRÍTICO: salvar token+usuário+empresa do parceiro no AuthContext
    // para que /modulo/servicos use o empresaId correto deste parceiro
    if (data?.token && data?.usuario) {
      const empresaForCtx = data.empresa ? {
        id: data.empresa.id,
        nome: data.empresa.nome,
        codigo: data.empresa.codigo,
        logo: data.empresa.logo ?? null,
        corPrimaria: data.empresa.corPrimaria ?? data.empresa.cor_primaria ?? "#22C55E",
        plano: data.empresa.plano ?? "basico",
        modulosAtivos: data.empresa.modulosAtivos ?? data.empresa.modulos_ativos ?? [],
        ativo: data.empresa.ativo ?? true,
      } : null;
      await authLogin(data.token, {
        id: data.usuario.id,
        nome: data.usuario.nome,
        email: data.usuario.email,
        telefone: data.usuario.telefone ?? null,
        avatar: data.usuario.avatar ?? null,
        papel: data.usuario.papel,
        empresaId: data.usuario.empresaId ?? data.usuario.empresa_id,
        ativo: data.usuario.ativo ?? true,
      }, empresaForCtx);
    }
    const mods: string[] = data?.empresa?.modulosAtivos || data?.empresa?.modulos_ativos || [];
    const isServicos = mods.includes("servicos") && !mods.includes("ecommerce") && !mods.includes("food");
    if (isServicos) {
      router.push("/modulo/servicos" as any);
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(pdvUrl);
    } catch (e: any) {
      console.error("[parceiro-login] WebBrowser error:", e?.message);
      try {
        await Linking.openURL(pdvUrl);
      } catch (e2: any) {
        console.error("[parceiro-login] Linking fallback error:", e2?.message);
        setLoginErro(`Login OK! Acesse seu painel em: ${pdvUrl}`);
      }
    }
  };

  if (step === "login") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => { setStep("intro"); setLoginErro(null); setLoginEmail(""); setLoginSenha(""); }} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Entrar como Parceiro</Text>
          <View style={{ width: 30 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 80, gap: 20 }} showsVerticalScrollIndicator={false}>
          {/* Ícone decorativo */}
          <View style={{ alignItems: "center", paddingVertical: 24 }}>
            <LinearGradient colors={[BRAND_GREEN, "#16A34A"]} style={{ width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" }}>
              <Feather name="briefcase" size={32} color="#fff" />
            </LinearGradient>
            <Text style={[{ fontSize: 20, marginTop: 16, textAlign: "center" }, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
              Acesse seu painel
            </Text>
            <Text style={[{ fontSize: 14, marginTop: 6, textAlign: "center", lineHeight: 20 }, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
              Entre com o e-mail e senha do seu cadastro
            </Text>
          </View>

          {/* E-mail */}
          <View>
            <Text style={[styles.fieldLabel, { color: colors.text, fontFamily: "Inter_500Medium" }]}>E-mail</Text>
            <View style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
              <Feather name="mail" size={16} color={colors.textMuted} />
              <TextInput
                style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]}
                placeholder="seu@email.com"
                placeholderTextColor={colors.textMuted}
                value={loginEmail}
                onChangeText={v => { setLoginEmail(v); setLoginErro(null); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>
          </View>

          {/* Senha */}
          <View>
            <Text style={[styles.fieldLabel, { color: colors.text, fontFamily: "Inter_500Medium" }]}>Senha</Text>
            <View style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
              <Feather name="lock" size={16} color={colors.textMuted} />
              <TextInput
                style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]}
                placeholder="Sua senha"
                placeholderTextColor={colors.textMuted}
                value={loginSenha}
                onChangeText={v => { setLoginSenha(v); setLoginErro(null); }}
                secureTextEntry={!showLoginSenha}
                autoCapitalize="none"
                autoComplete="password"
              />
              <Pressable onPress={() => setShowLoginSenha(v => !v)} hitSlop={8}>
                <Feather name={showLoginSenha ? "eye-off" : "eye"} size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>

          {/* Erro */}
          {loginErro && (
            <View style={[styles.erroBox, { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" }]}>
              <Feather name="alert-circle" size={15} color="#EF4444" />
              <Text style={{ color: "#DC2626", fontSize: 13, flex: 1, fontFamily: "Inter_400Regular" }}>{loginErro}</Text>
            </View>
          )}

          {/* Botão entrar */}
          <Pressable
            style={[styles.cadastrarBtn, { backgroundColor: BRAND_GREEN, opacity: loginLoading ? 0.8 : 1 }]}
            onPress={handleLogin}
            disabled={loginLoading}
          >
            {loginLoading
              ? <ActivityIndicator color="#fff" />
              : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={[styles.cadastrarBtnText, { fontFamily: "Inter_700Bold" }]}>Entrar no Painel</Text>
                  <Feather name="external-link" size={18} color="#fff" />
                </View>
              )
            }
          </Pressable>

          {/* Link para cadastro */}
          <Pressable style={{ alignItems: "center", paddingVertical: 8 }} onPress={() => { setStep("form"); setLoginErro(null); }}>
            <Text style={{ color: colors.textMuted, fontSize: 14, fontFamily: "Inter_400Regular" }}>
              Não tem conta?{" "}
              <Text style={{ color: BRAND_GREEN, fontFamily: "Inter_600SemiBold" }}>Cadastre-se grátis</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  if (step === "sucesso") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()}><Feather name="x" size={22} color={colors.text} /></Pressable>
        </View>
        <View style={styles.sucessoContainer}>
          <LinearGradient colors={[BRAND_GREEN, "#16A34A"]} style={styles.sucessoCircle}>
            <Feather name="check" size={40} color="#fff" />
          </LinearGradient>
          <Text style={[styles.sucessoTitulo, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
            Cadastro realizado!
          </Text>
          <Text style={[styles.sucessoDesc, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
            Obrigado, {nome.split(" ")[0]}! Nossa equipe vai entrar em contato via WhatsApp em até 24 horas para ativar sua conta.
          </Text>
          <View style={[styles.whatsappCard, { backgroundColor: "#22C55E15", borderColor: BRAND_GREEN + "40" }]}>
            <Feather name="message-circle" size={20} color={BRAND_GREEN} />
            <Text style={[styles.whatsappText, { color: BRAND_GREEN, fontFamily: "Inter_500Medium" }]}>
              Retorno no WhatsApp: {whatsapp}
            </Text>
          </View>
          <Pressable style={[styles.voltarBtn, { backgroundColor: BRAND_GREEN }]} onPress={() => router.back()}>
            <Text style={[styles.voltarBtnText, { fontFamily: "Inter_600SemiBold" }]}>Voltar ao início</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (step === "form") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => setStep("intro")} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Dados do Parceiro</Text>
          <View style={{ width: 30 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 80, gap: 14 }} showsVerticalScrollIndicator={false}>
          <Text style={[styles.formDesc, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
            Preencha os dados abaixo para criar sua conta de parceiro GoTaxi.
          </Text>

          {[
            { label: "Seu nome", value: nome, onChange: setNome, icone: "user" as const, placeholder: "Nome completo", keyboard: "default" as const },
            { label: "Nome da empresa", value: empresa, onChange: setEmpresa, icone: "briefcase" as const, placeholder: "Razão social ou nome fantasia", keyboard: "default" as const },
            { label: "E-mail", value: email, onChange: setEmail, icone: "mail" as const, placeholder: "seu@email.com", keyboard: "email-address" as const },
            { label: "WhatsApp", value: whatsapp, onChange: setWhatsapp, icone: "message-circle" as const, placeholder: "(11) 99999-9999", keyboard: "phone-pad" as const },
          ].map(f => (
            <View key={f.label}>
              <Text style={[styles.fieldLabel, { color: colors.text, fontFamily: "Inter_500Medium" }]}>{f.label}</Text>
              <View style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
                <Feather name={f.icone} size={16} color={colors.textMuted} />
                <TextInput
                  style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]}
                  placeholder={f.placeholder}
                  placeholderTextColor={colors.textMuted}
                  value={f.value}
                  onChangeText={f.onChange}
                  keyboardType={f.keyboard}
                  autoCapitalize={f.keyboard === "email-address" ? "none" : "words"}
                />
              </View>
            </View>
          ))}

          {/* Senha */}
          <View>
            <Text style={[styles.fieldLabel, { color: colors.text, fontFamily: "Inter_500Medium" }]}>Senha de acesso</Text>
            <View style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
              <Feather name="lock" size={16} color={colors.textMuted} />
              <TextInput
                style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={colors.textMuted}
                value={senha}
                onChangeText={setSenha}
                secureTextEntry={!showSenha}
                autoCapitalize="none"
              />
              <Pressable onPress={() => setShowSenha(v => !v)} hitSlop={8}>
                <Feather name={showSenha ? "eye-off" : "eye"} size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>

          {/* Confirmar Senha */}
          <View>
            <Text style={[styles.fieldLabel, { color: colors.text, fontFamily: "Inter_500Medium" }]}>Confirmar senha</Text>
            <View style={[styles.inputGroup, { borderColor: confirmarSenha && confirmarSenha !== senha ? "#EF4444" : colors.border, backgroundColor: colors.backgroundSecondary }]}>
              <Feather name="lock" size={16} color={colors.textMuted} />
              <TextInput
                style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]}
                placeholder="Repita a senha"
                placeholderTextColor={colors.textMuted}
                value={confirmarSenha}
                onChangeText={setConfirmarSenha}
                secureTextEntry={!showConfirmar}
                autoCapitalize="none"
              />
              <Pressable onPress={() => setShowConfirmar(v => !v)} hitSlop={8}>
                <Feather name={showConfirmar ? "eye-off" : "eye"} size={16} color={colors.textMuted} />
              </Pressable>
            </View>
            {confirmarSenha.length > 0 && confirmarSenha !== senha && (
              <Text style={{ color: "#EF4444", fontSize: 12, marginTop: 4, fontFamily: "Inter_400Regular" }}>As senhas não coincidem</Text>
            )}
          </View>

          <Text style={[styles.fieldLabel, { color: colors.text, fontFamily: "Inter_500Medium" }]}>Seguimentos comerciais</Text>
          <Pressable
            onPress={() => setSelectOpen(true)}
            style={[styles.selectBox, { borderColor: selecionado ? selecionado.cor : colors.border, backgroundColor: colors.backgroundSecondary }]}
          >
            <Feather name={selecionado ? selecionado.icone : "grid"} size={16} color={selecionado ? selecionado.cor : colors.textMuted} />
            <Text
              style={[styles.selectText, { color: selecionado ? colors.text : colors.textMuted, fontFamily: selecionado ? "Inter_500Medium" : "Inter_400Regular", flex: 1 }]}
              numberOfLines={1}
            >
              {labelSelecionado}
            </Text>
            <Feather name="chevron-down" size={18} color={colors.textMuted} />
          </Pressable>

          {/* Modal dropdown — seleção única */}
          <Modal visible={selectOpen} transparent animationType="slide" onRequestClose={() => setSelectOpen(false)}>
            <Pressable style={styles.modalOverlay} onPress={() => setSelectOpen(false)} />
            <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
              <Text style={[styles.modalTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Seguimento comercial</Text>
              <Text style={[styles.modalSub, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Escolha apenas um seguimento</Text>
              {MODULOS_OPTIONS.map(mod => {
                const sel = moduloSel === mod.id;
                return (
                  <Pressable key={mod.id}
                    onPress={() => { setModuloSel(mod.id); setSelectOpen(false); }}
                    style={[styles.modalOption, { borderBottomColor: colors.border, backgroundColor: sel ? mod.cor + "10" : "transparent" }]}
                  >
                    <View style={[styles.modalOptionIcon, { backgroundColor: mod.cor + "20" }]}>
                      <Feather name={mod.icone} size={18} color={mod.cor} />
                    </View>
                    <Text style={[styles.modalOptionText, { color: colors.text, fontFamily: sel ? "Inter_600SemiBold" : "Inter_400Regular", flex: 1 }]}>
                      {mod.nome}
                    </Text>
                    {/* Radio button */}
                    <View style={[styles.radio, { borderColor: sel ? mod.cor : colors.border }]}>
                      {sel && <View style={[styles.radioDot, { backgroundColor: mod.cor }]} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Modal>

          {/* Banner especial para Tur Viagens */}
          {moduloSel === "passagens" && (
            <View style={{ backgroundColor: "#22C55E15", borderRadius: 14, borderWidth: 1.5, borderColor: BRAND_GREEN + "60", padding: 16, gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 22 }}>🎟️</Text>
                <Text style={{ color: BRAND_GREEN, fontFamily: "Inter_700Bold", fontSize: 15 }}>Tur Viagens — Cadastro Especial</Text>
              </View>
              <Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 }}>
                Empresas de passagens usam um cadastro dedicado com ativação imediata. Você será redirecionado ao formulário correto.
              </Text>
              <Pressable
                style={{ backgroundColor: BRAND_GREEN, borderRadius: 12, height: 46, alignItems: "center", justifyContent: "center", marginTop: 4 }}
                onPress={() => router.push("/pro/tur-viagens-cadastro" as any)}
              >
                <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 }}>Cadastrar minha empresa →</Text>
              </Pressable>
            </View>
          )}

          {erroForm && (
            <View style={[styles.erroBox, { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" }]}>
              <Feather name="alert-circle" size={15} color="#EF4444" />
              <Text style={{ color: "#DC2626", fontSize: 13, flex: 1, fontFamily: "Inter_400Regular" }}>{erroForm}</Text>
            </View>
          )}

          {moduloSel !== "passagens" && (
            <Pressable style={[styles.cadastrarBtn, { backgroundColor: BRAND_GREEN, opacity: loading ? 0.8 : 1 }]} onPress={handleCadastrar} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : (
                <Text style={[styles.cadastrarBtnText, { fontFamily: "Inter_700Bold" }]}>Criar Conta</Text>
              )}
            </Pressable>
          )}

          <Pressable style={{ alignItems: "center", paddingVertical: 8 }} onPress={() => { setStep("login"); setErroForm(null); }}>
            <Text style={{ color: colors.textMuted, fontSize: 14, fontFamily: "Inter_400Regular" }}>
              Já tem conta?{" "}
              <Text style={{ color: BRAND_GREEN, fontFamily: "Inter_600SemiBold" }}>Entrar</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 20 }} showsVerticalScrollIndicator={false}>
        {/* HERO */}
        <LinearGradient colors={["#0F172A", "#1E3A5F"]} style={[styles.hero, { paddingTop: topPadding + 24 }]}>
          <Pressable onPress={() => router.back()} style={styles.heroBack}>
            <Feather name="arrow-left" size={22} color="rgba(255,255,255,0.7)" />
          </Pressable>
          <View style={[styles.heroBadge, { backgroundColor: BRAND_GREEN + "30" }]}>
            <Text style={[styles.heroBadgeText, { color: BRAND_GREEN, fontFamily: "Inter_600SemiBold" }]}>Para empresas</Text>
          </View>
          <Text style={[styles.heroTitulo, { fontFamily: "Inter_700Bold" }]}>Tem um negócio?</Text>
          <Text style={[styles.heroSubtitulo, { fontFamily: "Inter_400Regular" }]}>
            Alcance milhares de clientes na sua cidade. Comece gratuitamente hoje mesmo.
          </Text>
          <View style={styles.heroStats}>
            {[{ num: "10K+", label: "Usuários ativos" }, { num: "6", label: "Módulos" }, { num: "24h", label: "Ativação" }].map(s => (
              <View key={s.label} style={styles.heroStat}>
                <Text style={[styles.heroStatNum, { fontFamily: "Inter_700Bold", color: "#fff" }]}>{s.num}</Text>
                <Text style={[styles.heroStatLabel, { fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)" }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* BENEFÍCIOS */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Por que escolher o GoTaxi?</Text>
          <View style={styles.beneficiosGrid}>
            {BENEFICIOS.map(b => (
              <View key={b.titulo} style={[styles.beneficioCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.beneficioIcon, { backgroundColor: BRAND_GREEN + "20" }]}>
                  <Feather name={b.icone} size={22} color={BRAND_GREEN} />
                </View>
                <Text style={[styles.beneficioTitulo, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{b.titulo}</Text>
                <Text style={[styles.beneficioDesc, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{b.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* SEGUIMENTOS */}
        <View style={[styles.section, { paddingBottom: 20 }]}>
          <View style={styles.segTitleRow}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_700Bold", marginBottom: 0 }]}>Seguimentos</Text>
            <View style={[styles.segBadge, { backgroundColor: BRAND_GREEN + "20" }]}>
              <Text style={[styles.segBadgeText, { color: BRAND_GREEN, fontFamily: "Inter_600SemiBold" }]}>6 opções</Text>
            </View>
          </View>
          <Text style={[styles.segSubtitle, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
            Escolha o que melhor representa seu negócio
          </Text>
          <View style={styles.segGrid}>
            {MODULOS_OPTIONS.map(mod => (
              <View key={mod.id} style={[styles.segCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.segCardTop, { backgroundColor: mod.cor + "15" }]}>
                  <Text style={styles.segEmoji}>{mod.emoji}</Text>
                  <View style={[styles.segCorDot, { backgroundColor: mod.cor }]} />
                </View>
                <View style={styles.segCardBody}>
                  <Text style={[styles.segNome, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{mod.nome}</Text>
                  <Text style={[styles.segDesc, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{mod.desc}</Text>
                </View>
                <View style={[styles.segCardBar, { backgroundColor: mod.cor }]} />
              </View>
            ))}
          </View>
        </View>

        {/* CTA */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 20, gap: 12 }}>
          <Pressable style={[styles.ctaBtn, { backgroundColor: BRAND_GREEN }]} onPress={() => setStep("form")}>
            <Text style={[styles.ctaBtnText, { fontFamily: "Inter_700Bold" }]}>Quero ser um Parceiro →</Text>
          </Pressable>
          <Pressable
            style={[styles.ctaBtn, { backgroundColor: "transparent", borderWidth: 1.5, borderColor: BRAND_GREEN }]}
            onPress={() => setStep("login")}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Feather name="log-in" size={17} color={BRAND_GREEN} />
              <Text style={[styles.ctaBtnText, { fontFamily: "Inter_600SemiBold", color: BRAND_GREEN }]}>Já sou parceiro — Entrar</Text>
            </View>
          </Pressable>
          <Text style={[styles.ctaNote, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
            Gratuito para começar · Sem taxa de adesão
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18 },
  hero: { padding: 24, paddingBottom: 32 },
  heroBack: { marginBottom: 20 },
  heroBadge: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginBottom: 14 },
  heroBadgeText: { fontSize: 13 },
  heroTitulo: { fontSize: 34, color: "#fff", marginBottom: 10 },
  heroSubtitulo: { fontSize: 15, color: "rgba(255,255,255,0.7)", lineHeight: 24, marginBottom: 28 },
  heroStats: { flexDirection: "row", gap: 32 },
  heroStat: { alignItems: "center" },
  heroStatNum: { fontSize: 24, marginBottom: 2 },
  heroStatLabel: { fontSize: 12 },
  section: { padding: 20, paddingBottom: 0 },
  sectionTitle: { fontSize: 20, marginBottom: 16 },
  beneficiosGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  beneficioCard: { width: "47%", borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  beneficioIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  beneficioTitulo: { fontSize: 14 },
  beneficioDesc: { fontSize: 12, lineHeight: 18 },
  /* Seguimentos */
  segTitleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  segBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  segBadgeText: { fontSize: 12 },
  segSubtitle: { fontSize: 13, marginBottom: 16, lineHeight: 18 },
  segGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  segCard: { width: "47%", borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  segCardTop: { paddingVertical: 16, alignItems: "center", justifyContent: "center", position: "relative" },
  segEmoji: { fontSize: 30 },
  segCorDot: { position: "absolute", top: 8, right: 10, width: 8, height: 8, borderRadius: 4 },
  segCardBody: { padding: 12, gap: 4 },
  segNome: { fontSize: 14 },
  segDesc: { fontSize: 11, lineHeight: 15 },
  segCardBar: { height: 3 },
  ctaBtn: { height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  ctaBtnText: { color: "#fff", fontSize: 17 },
  ctaNote: { textAlign: "center", fontSize: 13 },

  /* Form */
  formDesc: { fontSize: 14, lineHeight: 22, marginBottom: 8 },
  fieldLabel: { fontSize: 14, marginBottom: 8 },
  inputGroup: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 50, gap: 10 },
  input: { flex: 1, fontSize: 15 },
  selectBox: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, height: 52, gap: 10 },
  selectText: { fontSize: 15 },
  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, marginBottom: 4 },
  modalSub: { fontSize: 13, marginBottom: 16 },
  modalOption: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, borderBottomWidth: 1, paddingHorizontal: 4, borderRadius: 10 },
  modalOptionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  modalOptionText: { fontSize: 15 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 11, height: 11, borderRadius: 6 },
  cadastrarBtn: { height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 8 },
  cadastrarBtnText: { color: "#fff", fontSize: 17 },
  erroBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },

  /* Sucesso */
  sucessoContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  sucessoCircle: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  sucessoTitulo: { fontSize: 26 },
  sucessoDesc: { fontSize: 15, textAlign: "center", lineHeight: 24 },
  whatsappCard: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, padding: 14 },
  whatsappText: { fontSize: 14 },
  voltarBtn: { width: "100%", height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 8 },
  voltarBtnText: { color: "#fff", fontSize: 16 },
});
