import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, Pressable, TextInput,
  useColorScheme, ScrollView, Alert, ActivityIndicator, Linking, Modal, Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import Colors from "@/constants/colors";
import { useCustomerAuth, type FormaPagamento } from "@/context/CustomerAuthContext";
import ClienteBottomNav from "@/components/ClienteBottomNav";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "http://localhost:8080/api";

const BRAND_GREEN = "#22C55E";

const FORMAS_PAGAMENTO: { id: FormaPagamento; label: string; icon: string; color: string; desc: string }[] = [
  { id: "maquininha", label: "Maquininha", icon: "credit-card", color: "#3B82F6", desc: "Débito ou crédito" },
  { id: "pix",        label: "Pix",         icon: "zap",         color: "#22C55E", desc: "Transferência instantânea" },
  { id: "dinheiro",  label: "Dinheiro",    icon: "dollar-sign", color: "#F59E0B", desc: "Pagamento em espécie" },
];

function formatWhatsapp(num?: string | null) {
  const d = (num ?? "").replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return num ?? "";
}

function formatInput(val: string) {
  const nums = val.replace(/\D/g, "").slice(0, 11);
  if (nums.length <= 2) return nums;
  if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`;
}

function labelFormaPagamento(fp: FormaPagamento) {
  if (!fp) return "Não definida";
  return FORMAS_PAGAMENTO.find(f => f.id === fp)?.label ?? fp;
}

export default function PerfilScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const { customer, logout, updateProfile, uploadAvatar, isLoggedIn } = useCustomerAuth();

  const [suporteNumero, setSuporteNumero] = useState("5511900000000");
  const [avatarLoading, setAvatarLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/public/config`)
      .then(r => r.json())
      .then(d => { if (d?.whatsapp_suporte) setSuporteNumero(d.whatsapp_suporte); })
      .catch(() => {});
  }, []);

  const handleTrocarFoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permissão necessária", "Permita o acesso à galeria para trocar sua foto.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setAvatarLoading(true);
    const res = await uploadAvatar(result.assets[0].uri);
    setAvatarLoading(false);
    if (!res.ok) Alert.alert("Erro", res.error || "Não foi possível enviar a foto.");
  };

  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const [senhaModal, setSenhaModal] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [senhaLoading, setSenhaLoading] = useState(false);
  const [senhaErro, setSenhaErro] = useState<string | null>(null);
  const [showSenhaAtual, setShowSenhaAtual] = useState(false);
  const [showNovaSenha, setShowNovaSenha] = useState(false);

  const [enderecoModal, setEnderecoModal] = useState(false);
  const [enderecoInput, setEnderecoInput] = useState("");
  const [enderecoLoading, setEnderecoLoading] = useState(false);
  const [enderecoErro, setEnderecoErro] = useState<string | null>(null);

  const [pagamentoModal, setPagamentoModal] = useState(false);
  const [pagamentoLoading, setPagamentoLoading] = useState(false);

  const abrirEdicao = () => {
    if (!customer) return;
    setNome(customer.nome ?? "");
    setWhatsapp(formatWhatsapp(customer.whatsapp));
    setErro(null);
    setSucesso(false);
    setEditando(true);
  };

  const handleSalvar = async () => {
    if (!nome.trim() || nome.trim().length < 3) { setErro("Nome deve ter ao menos 3 caracteres"); return; }
    const wnum = whatsapp.replace(/\D/g, "");
    if (wnum.length < 10) { setErro("WhatsApp inválido"); return; }
    setLoading(true);
    setErro(null);
    const result = await updateProfile({ nome: nome.trim(), whatsapp: wnum });
    setLoading(false);
    if (!result.ok) { setErro(result.error || "Erro ao salvar"); return; }
    setSucesso(true);
    setTimeout(() => { setSucesso(false); setEditando(false); }, 1200);
  };

  const handleAlterarSenha = async () => {
    setSenhaErro(null);
    if (!senhaAtual) { setSenhaErro("Digite a senha atual"); return; }
    if (!novaSenha || novaSenha.length < 4) { setSenhaErro("Nova senha deve ter ao menos 4 caracteres"); return; }
    if (novaSenha !== confirmarSenha) { setSenhaErro("As senhas não coincidem"); return; }
    setSenhaLoading(true);
    const result = await updateProfile({ novaSenha });
    setSenhaLoading(false);
    if (!result.ok) { setSenhaErro(result.error || "Erro ao alterar senha"); return; }
    setSenhaModal(false);
    setSenhaAtual(""); setNovaSenha(""); setConfirmarSenha("");
    Alert.alert("Senha alterada", "Sua senha foi atualizada com sucesso.");
  };

  const abrirEnderecoModal = () => {
    setEnderecoInput(customer?.endereco ?? "");
    setEnderecoErro(null);
    setEnderecoModal(true);
  };

  const handleSalvarEndereco = async () => {
    setEnderecoErro(null);
    if (!enderecoInput.trim() || enderecoInput.trim().length < 5) {
      setEnderecoErro("Digite um endereço válido (mínimo 5 caracteres)");
      return;
    }
    setEnderecoLoading(true);
    const result = await updateProfile({ endereco: enderecoInput.trim() });
    setEnderecoLoading(false);
    if (!result.ok) { setEnderecoErro(result.error || "Erro ao salvar endereço"); return; }
    setEnderecoModal(false);
  };

  const handleSelecionarPagamento = async (fp: FormaPagamento) => {
    if (fp === customer?.formaPagamento) { setPagamentoModal(false); return; }
    setPagamentoLoading(true);
    await updateProfile({ formaPagamento: fp });
    setPagamentoLoading(false);
    setPagamentoModal(false);
  };

  const handleLogout = () => {
    Alert.alert("Sair da conta", "Deseja realmente sair?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair", style: "destructive", onPress: async () => {
          router.replace("/cliente" as any);
          await logout();
        }
      },
    ]);
  };

  const handleSuporte = () => {
    const msg = encodeURIComponent("Olá! Preciso de ajuda com minha conta GoTaxi.");
    Linking.openURL(`https://wa.me/${suporteNumero}?text=${msg}`).catch(() =>
      Alert.alert("WhatsApp não encontrado", "Instale o WhatsApp para falar com o suporte.")
    );
  };

  if (!isLoggedIn || !customer) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()}><Feather name="arrow-left" size={22} color={colors.text} /></Pressable>
          <Text style={[styles.headerTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Meu Perfil</Text>
          <View style={{ width: 30 }} />
        </View>
        <View style={styles.semContaContainer}>
          <View style={[styles.semContaCircle, { backgroundColor: BRAND_GREEN + "20" }]}>
            <Feather name="user" size={48} color={BRAND_GREEN} />
          </View>
          <Text style={[styles.semContaTitulo, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Você não está logado</Text>
          <Text style={[styles.semContaDesc, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
            Crie uma conta ou entre para ver seu histórico de pedidos e gerenciar seu perfil.
          </Text>
          <Pressable style={[styles.cadastrarBtn, { backgroundColor: BRAND_GREEN }]} onPress={() => router.push("/cliente/cadastro" as any)}>
            <Feather name="user-plus" size={18} color="#fff" />
            <Text style={[styles.cadastrarBtnText, { fontFamily: "Inter_700Bold" }]}>Criar conta grátis</Text>
          </Pressable>
          <Pressable onPress={() => router.push({ pathname: "/cliente/cadastro" as any, params: { modo: "login" } })}>
            <Text style={[styles.jaTemConta, { color: BRAND_GREEN, fontFamily: "Inter_500Medium" }]}>Já tenho conta → Entrar</Text>
          </Pressable>
        </View>
        <ClienteBottomNav activeTab="perfil" />
      </View>
    );
  }

  const initials = (customer?.nome || "C").split(" ").filter(Boolean).map((n: string) => n[0]).slice(0, 2).join("").toUpperCase() || "C";
  const fpAtual = FORMAS_PAGAMENTO.find(f => f.id === customer?.formaPagamento);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>

        {/* HERO */}
        <LinearGradient colors={["#0F172A", "#1E3A5F"]} style={[styles.perfilHero, { paddingTop: insets.top + 20 }]}>
          <Pressable onPress={() => router.back()} style={styles.heroBack}>
            <Feather name="arrow-left" size={20} color="rgba(255,255,255,0.7)" />
          </Pressable>
          <Pressable style={styles.avatarWrap} onPress={!editando ? handleTrocarFoto : undefined} disabled={avatarLoading}>
            {customer?.avatar ? (
              <Image source={{ uri: customer?.avatar }} style={styles.avatarImg} />
            ) : (
              <View style={[styles.avatarImg, { backgroundColor: BRAND_GREEN, alignItems: "center", justifyContent: "center" }]}>
                <Text style={[styles.avatarText, { fontFamily: "Inter_700Bold" }]}>{initials}</Text>
              </View>
            )}
            {avatarLoading ? (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color="#fff" size="small" />
              </View>
            ) : (
              <View style={styles.avatarCamBtn}>
                <Feather name="camera" size={12} color="#fff" />
              </View>
            )}
          </Pressable>

          {!editando ? (
            <>
              <Text style={[styles.perfilNome, { fontFamily: "Inter_700Bold" }]}>{customer?.nome}</Text>
              <View style={styles.perfilInfoRow}>
                <Feather name="message-circle" size={13} color="#25D366" />
                <Text style={[styles.perfilWhats, { fontFamily: "Inter_400Regular" }]}>
                  {formatWhatsapp(customer?.whatsapp)}
                </Text>
              </View>
              <Pressable style={[styles.editarBtn, { backgroundColor: "rgba(255,255,255,0.15)" }]} onPress={abrirEdicao}>
                <Feather name="edit-2" size={14} color="#fff" />
                <Text style={[styles.editarBtnText, { fontFamily: "Inter_500Medium" }]}>Editar perfil</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.editForm}>
              <View>
                <Text style={[styles.editLabel, { fontFamily: "Inter_400Regular" }]}>Nome completo</Text>
                <TextInput
                  style={[styles.editInput, { color: "#fff", borderBottomColor: "rgba(255,255,255,0.3)", fontFamily: "Inter_500Medium" }]}
                  value={nome}
                  onChangeText={setNome}
                  placeholder="Nome completo"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  autoComplete="name"
                />
              </View>
              <View>
                <Text style={[styles.editLabel, { fontFamily: "Inter_400Regular" }]}>WhatsApp</Text>
                <TextInput
                  style={[styles.editInput, { color: "#fff", borderBottomColor: "rgba(255,255,255,0.3)", fontFamily: "Inter_500Medium" }]}
                  value={whatsapp}
                  onChangeText={v => setWhatsapp(formatInput(v))}
                  placeholder="(11) 99999-9999"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  keyboardType="phone-pad"
                />
              </View>
              {erro && <Text style={[styles.editErro, { fontFamily: "Inter_400Regular" }]}>{erro}</Text>}
              {sucesso && <Text style={[styles.editSucessoText, { fontFamily: "Inter_500Medium" }]}>✓ Salvo com sucesso!</Text>}
              <View style={styles.editBtns}>
                <Pressable style={[styles.editSalvar, { backgroundColor: BRAND_GREEN }]} onPress={handleSalvar} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[styles.editSalvarText, { fontFamily: "Inter_700Bold" }]}>Salvar</Text>}
                </Pressable>
                <Pressable style={[styles.editCancelar, { borderColor: "rgba(255,255,255,0.3)" }]} onPress={() => setEditando(false)}>
                  <Text style={[styles.editCancelarText, { fontFamily: "Inter_500Medium" }]}>Cancelar</Text>
                </Pressable>
              </View>
            </View>
          )}
        </LinearGradient>

        {/* RESUMO DOS DADOS */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.infoRow}>
            <View style={[styles.infoIconBox, { backgroundColor: "#25D36620" }]}>
              <Feather name="message-circle" size={16} color="#25D366" />
            </View>
            <View style={styles.infoTexts}>
              <Text style={[styles.infoLabel, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>WhatsApp</Text>
              <Text style={[styles.infoValor, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>
                {formatWhatsapp(customer?.whatsapp)}
              </Text>
            </View>
            <View style={[styles.infoBadge, { backgroundColor: "#25D36620" }]}>
              <Text style={[styles.infoBadgeText, { color: "#25D366", fontFamily: "Inter_500Medium" }]}>Notificações ativas</Text>
            </View>
          </View>
        </View>

        {/* SEÇÃO: ENDEREÇO & PAGAMENTO */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Entrega & Pagamento</Text>

          {/* CARTEIRA GOTAXI */}
          <Pressable
            style={[styles.optCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push("/cliente/carteira")}
          >
            <View style={[styles.optIcon, { backgroundColor: "#00B1EA20" }]}>
              <Feather name="briefcase" size={18} color="#00B1EA" />
            </View>
            <View style={styles.optInfo}>
              <Text style={[styles.optLabel, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Minha Carteira</Text>
              <Text style={[styles.optSub, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Saldo e movimentações</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.textMuted} />
          </Pressable>

          {/* ENDEREÇO */}
          <Pressable
            style={[styles.optCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={abrirEnderecoModal}
          >
            <View style={[styles.optIcon, { backgroundColor: "#3B82F620" }]}>
              <Feather name="map-pin" size={18} color="#3B82F6" />
            </View>
            <View style={styles.optInfo}>
              <Text style={[styles.optLabel, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Endereço de entrega</Text>
              <Text
                style={[styles.optSub, { color: customer?.endereco ? colors.text : colors.textMuted, fontFamily: "Inter_400Regular" }]}
                numberOfLines={1}
              >
                {customer?.endereco || "Toque para adicionar seu endereço"}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.textMuted} />
          </Pressable>

          {/* FORMA DE PAGAMENTO */}
          <Pressable
            style={[styles.optCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setPagamentoModal(true)}
          >
            <View style={[styles.optIcon, { backgroundColor: (fpAtual?.color ?? "#10B981") + "20" }]}>
              <Feather name={(fpAtual?.icon ?? "credit-card") as any} size={18} color={fpAtual?.color ?? "#10B981"} />
            </View>
            <View style={styles.optInfo}>
              <Text style={[styles.optLabel, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Forma de pagamento</Text>
              <Text style={[styles.optSub, { color: customer?.formaPagamento ? colors.text : colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                {customer?.formaPagamento ? `${fpAtual?.label} · ${fpAtual?.desc}` : "Selecione como vai pagar"}
              </Text>
            </View>
            {customer?.formaPagamento && (
              <View style={[styles.fpBadge, { backgroundColor: (fpAtual?.color ?? "#10B981") + "20" }]}>
                <Text style={[styles.fpBadgeText, { color: fpAtual?.color ?? "#10B981", fontFamily: "Inter_700Bold" }]}>
                  {fpAtual?.label}
                </Text>
              </View>
            )}
            {!customer?.formaPagamento && <Feather name="chevron-right" size={16} color={colors.textMuted} />}
          </Pressable>
        </View>

        {/* SEÇÃO: CONTA */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Conta</Text>

          <Pressable
            style={[styles.optCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => Alert.alert("Notificações", "Você recebe notificações de pedidos pelo WhatsApp " + formatWhatsapp(customer?.whatsapp) + ".\n\nEm breve: configurações de notificações por push.")}
          >
            <View style={[styles.optIcon, { backgroundColor: "#8B5CF620" }]}>
              <Feather name="bell" size={18} color="#8B5CF6" />
            </View>
            <View style={styles.optInfo}>
              <Text style={[styles.optLabel, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Notificações</Text>
              <Text style={[styles.optSub, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Via WhatsApp · Pedidos e entregas</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.textMuted} />
          </Pressable>

          <Pressable
            style={[styles.optCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setSenhaModal(true)}
          >
            <View style={[styles.optIcon, { backgroundColor: "#F59E0B20" }]}>
              <Feather name="shield" size={18} color="#F59E0B" />
            </View>
            <View style={styles.optInfo}>
              <Text style={[styles.optLabel, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Privacidade & Segurança</Text>
              <Text style={[styles.optSub, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Alterar senha</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.textMuted} />
          </Pressable>

          <Pressable
            style={[styles.optCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleSuporte}
          >
            <View style={[styles.optIcon, { backgroundColor: "#25D36620" }]}>
              <Feather name="message-circle" size={18} color="#25D366" />
            </View>
            <View style={styles.optInfo}>
              <Text style={[styles.optLabel, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Suporte</Text>
              <Text style={[styles.optSub, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Fale conosco pelo WhatsApp</Text>
            </View>
            <Feather name="external-link" size={14} color={colors.textMuted} />
          </Pressable>

          <Pressable
            style={[styles.optCard, { backgroundColor: "#22C55E18", borderColor: "#22C55E40" }]}
            onPress={() => router.push("/cliente/afiliados" as any)}
          >
            <View style={[styles.optIcon, { backgroundColor: "#22C55E22" }]}>
              <Feather name="gift" size={18} color="#22C55E" />
            </View>
            <View style={styles.optInfo}>
              <Text style={[styles.optLabel, { color: "#16A34A", fontFamily: "Inter_700Bold" }]}>Programa de Afiliados</Text>
              <Text style={[styles.optSub, { color: "#22C55E", fontFamily: "Inter_400Regular" }]}>Indique amigos e ganhe comissão</Text>
            </View>
            <Feather name="chevron-right" size={16} color="#22C55E" />
          </Pressable>

        </View>

        {/* SAIR */}
        <Pressable style={[styles.sairBtn, { borderColor: "#EF4444" }]} onPress={handleLogout}>
          <Feather name="log-out" size={18} color="#EF4444" />
          <Text style={[styles.sairBtnText, { fontFamily: "Inter_600SemiBold" }]}>Sair da conta</Text>
        </Pressable>
      </ScrollView>

      <ClienteBottomNav activeTab="perfil" />

      {/* MODAL: ENDEREÇO */}
      <Modal visible={enderecoModal} transparent animationType="slide" onRequestClose={() => setEnderecoModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEnderecoModal(false)} />
        <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View style={[styles.modalIconBox, { backgroundColor: "#3B82F620" }]}>
              <Feather name="map-pin" size={20} color="#3B82F6" />
            </View>
            <Text style={[styles.modalTitulo, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Endereço de entrega</Text>
          </View>
          <Text style={[styles.modalDesc, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
            Seu endereço padrão será usado nos seus pedidos.
          </Text>

          <View style={styles.modalFields}>
            <View style={[styles.inputWrap, { borderColor: enderecoErro ? "#EF4444" : colors.border, backgroundColor: colors.background }]}>
              <Feather name="map-pin" size={16} color={colors.textMuted} />
              <TextInput
                style={[styles.modalInput, { color: colors.text, fontFamily: "Inter_400Regular" }]}
                value={enderecoInput}
                onChangeText={v => { setEnderecoInput(v); setEnderecoErro(null); }}
                placeholder="Ex: Rua das Flores, 123 - Bairro, Cidade"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={2}
                autoFocus
              />
            </View>
            {enderecoErro && (
              <View style={[styles.erroBox, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
                <Feather name="alert-circle" size={14} color="#EF4444" />
                <Text style={[styles.erroText, { fontFamily: "Inter_400Regular" }]}>{enderecoErro}</Text>
              </View>
            )}
          </View>

          <Pressable style={[styles.modalBtn, { backgroundColor: "#3B82F6" }]} onPress={handleSalvarEndereco} disabled={enderecoLoading}>
            {enderecoLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={[styles.modalBtnText, { fontFamily: "Inter_700Bold" }]}>Salvar endereço</Text>}
          </Pressable>
          <Pressable style={styles.modalCancelar} onPress={() => setEnderecoModal(false)}>
            <Text style={[styles.modalCancelarText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Cancelar</Text>
          </Pressable>
        </View>
      </Modal>

      {/* MODAL: FORMA DE PAGAMENTO */}
      <Modal visible={pagamentoModal} transparent animationType="slide" onRequestClose={() => setPagamentoModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPagamentoModal(false)} />
        <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View style={[styles.modalIconBox, { backgroundColor: "#10B98120" }]}>
              <Feather name="credit-card" size={20} color="#10B981" />
            </View>
            <Text style={[styles.modalTitulo, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Forma de pagamento</Text>
          </View>
          <Text style={[styles.modalDesc, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
            Escolha como prefere pagar nos seus pedidos.
          </Text>

          <View style={[styles.pagamentoOptions, { opacity: pagamentoLoading ? 0.6 : 1 }]}>
            {FORMAS_PAGAMENTO.map(fp => {
              const selected = customer?.formaPagamento === fp.id;
              return (
                <Pressable
                  key={fp.id}
                  style={[
                    styles.pagamentoCard,
                    { backgroundColor: colors.background, borderColor: selected ? fp.color : colors.border },
                    selected && { borderWidth: 2 },
                  ]}
                  onPress={() => !pagamentoLoading && handleSelecionarPagamento(fp.id)}
                >
                  <View style={[styles.pagamentoIcon, { backgroundColor: fp.color + "20" }]}>
                    <Feather name={fp.icon as any} size={22} color={fp.color} />
                  </View>
                  <View style={styles.pagamentoInfo}>
                    <Text style={[styles.pagamentoLabel, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{fp.label}</Text>
                    <Text style={[styles.pagamentoDesc, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>{fp.desc}</Text>
                  </View>
                  {selected && (
                    <View style={[styles.checkCircle, { backgroundColor: fp.color }]}>
                      <Feather name="check" size={14} color="#fff" />
                    </View>
                  )}
                  {!selected && pagamentoLoading && <ActivityIndicator size="small" color={fp.color} />}
                </Pressable>
              );
            })}
          </View>

          <Pressable style={styles.modalCancelar} onPress={() => setPagamentoModal(false)}>
            <Text style={[styles.modalCancelarText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Fechar</Text>
          </Pressable>
        </View>
      </Modal>

      {/* MODAL: ALTERAR SENHA */}
      <Modal visible={senhaModal} transparent animationType="slide" onRequestClose={() => setSenhaModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSenhaModal(false)} />
        <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
          <View style={styles.modalHandle} />
          <Text style={[styles.modalTitulo, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Alterar senha</Text>

          <View style={styles.modalFields}>
            <View>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Senha atual</Text>
              <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Feather name="lock" size={16} color={colors.textMuted} />
                <TextInput
                  style={[styles.modalInput, { color: colors.text, fontFamily: "Inter_400Regular" }]}
                  value={senhaAtual}
                  onChangeText={setSenhaAtual}
                  secureTextEntry={!showSenhaAtual}
                  placeholder="Senha atual"
                  placeholderTextColor={colors.textMuted}
                />
                <Pressable onPress={() => setShowSenhaAtual(!showSenhaAtual)}>
                  <Feather name={showSenhaAtual ? "eye-off" : "eye"} size={16} color={colors.textMuted} />
                </Pressable>
              </View>
            </View>

            <View>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Nova senha</Text>
              <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Feather name="lock" size={16} color={colors.textMuted} />
                <TextInput
                  style={[styles.modalInput, { color: colors.text, fontFamily: "Inter_400Regular" }]}
                  value={novaSenha}
                  onChangeText={setNovaSenha}
                  secureTextEntry={!showNovaSenha}
                  placeholder="Mínimo 4 caracteres"
                  placeholderTextColor={colors.textMuted}
                />
                <Pressable onPress={() => setShowNovaSenha(!showNovaSenha)}>
                  <Feather name={showNovaSenha ? "eye-off" : "eye"} size={16} color={colors.textMuted} />
                </Pressable>
              </View>
            </View>

            <View>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary, fontFamily: "Inter_500Medium" }]}>Confirmar nova senha</Text>
              <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Feather name="lock" size={16} color={colors.textMuted} />
                <TextInput
                  style={[styles.modalInput, { color: colors.text, fontFamily: "Inter_400Regular" }]}
                  value={confirmarSenha}
                  onChangeText={setConfirmarSenha}
                  secureTextEntry
                  placeholder="Repita a nova senha"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {senhaErro && (
              <View style={[styles.erroBox, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
                <Feather name="alert-circle" size={14} color="#EF4444" />
                <Text style={[styles.erroText, { fontFamily: "Inter_400Regular" }]}>{senhaErro}</Text>
              </View>
            )}
          </View>

          <Pressable style={[styles.modalBtn, { backgroundColor: BRAND_GREEN }]} onPress={handleAlterarSenha} disabled={senhaLoading}>
            {senhaLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={[styles.modalBtnText, { fontFamily: "Inter_700Bold" }]}>Salvar nova senha</Text>}
          </Pressable>
          <Pressable style={styles.modalCancelar} onPress={() => setSenhaModal(false)}>
            <Text style={[styles.modalCancelarText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Cancelar</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18 },
  semContaContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  semContaCircle: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  semContaTitulo: { fontSize: 24 },
  semContaDesc: { fontSize: 15, textAlign: "center", lineHeight: 24 },
  cadastrarBtn: { flexDirection: "row", alignItems: "center", gap: 10, width: "100%", height: 54, borderRadius: 14, justifyContent: "center" },
  cadastrarBtnText: { color: "#fff", fontSize: 17 },
  jaTemConta: { fontSize: 15, marginTop: 4 },
  perfilHero: { paddingHorizontal: 24, paddingBottom: 32, alignItems: "center" },
  heroBack: { alignSelf: "flex-start", marginBottom: 20 },
  avatarWrap: { width: 86, height: 86, borderRadius: 43, marginBottom: 14, position: "relative" },
  avatarImg: { width: 86, height: 86, borderRadius: 43, borderWidth: 3, borderColor: "rgba(255,255,255,0.3)" },
  avatarText: { fontSize: 30, color: "#fff" },
  avatarOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 43, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  avatarCamBtn: { position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: "#22C55E", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#0F172A" },
  perfilNome: { fontSize: 24, color: "#fff", marginBottom: 6 },
  perfilInfoRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 },
  perfilWhats: { color: "rgba(255,255,255,0.65)", fontSize: 14 },
  editarBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20 },
  editarBtnText: { color: "#fff", fontSize: 14 },
  editForm: { width: "100%", gap: 14, paddingTop: 8 },
  editLabel: { color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 4 },
  editInput: { fontSize: 16, borderBottomWidth: 1, paddingVertical: 10 },
  editErro: { color: "#FCA5A5", fontSize: 13 },
  editSucessoText: { color: "#86EFAC", fontSize: 13 },
  editBtns: { flexDirection: "row", gap: 12, marginTop: 4 },
  editSalvar: { flex: 1, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  editSalvarText: { color: "#fff", fontSize: 15 },
  editCancelar: { flex: 1, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  editCancelarText: { color: "rgba(255,255,255,0.7)", fontSize: 15 },
  infoCard: { marginHorizontal: 16, marginTop: 16, borderRadius: 14, borderWidth: 1, padding: 14 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  infoIconBox: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  infoTexts: { flex: 1 },
  infoLabel: { fontSize: 11, marginBottom: 2 },
  infoValor: { fontSize: 14 },
  infoBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  infoBadgeText: { fontSize: 11 },
  section: { padding: 16, gap: 10 },
  sectionTitle: { fontSize: 17, marginBottom: 4 },
  optCard: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 14, borderWidth: 1, padding: 14 },
  optIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  optInfo: { flex: 1 },
  optLabel: { fontSize: 14, marginBottom: 2 },
  optSub: { fontSize: 12 },
  fpBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  fpBadgeText: { fontSize: 12 },
  referralCard: { marginHorizontal: 16, marginBottom: 12, borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  referralHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  referralIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  referralTitle: { fontSize: 14, marginBottom: 2 },
  referralSub: { fontSize: 12 },
  referralCodeBox: { borderRadius: 12, borderWidth: 1, padding: 12, alignItems: "center" },
  referralCode: { fontSize: 22, letterSpacing: 4 },
  referralBtns: { flexDirection: "row", gap: 10 },
  referralBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 42, borderRadius: 12 },
  referralBtnText: { color: "#fff", fontSize: 14 },
  sairBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginHorizontal: 16, height: 52, borderRadius: 14, borderWidth: 1.5, marginBottom: 8 },
  sairBtnText: { color: "#EF4444", fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB", alignSelf: "center", marginBottom: 20 },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  modalIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  modalTitulo: { fontSize: 20 },
  modalDesc: { fontSize: 13, marginBottom: 20, lineHeight: 20 },
  modalFields: { gap: 16, marginBottom: 24 },
  fieldLabel: { fontSize: 13, marginBottom: 8 },
  inputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, minHeight: 52, gap: 10, paddingVertical: 12 },
  modalInput: { flex: 1, fontSize: 15 },
  erroBox: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, padding: 12 },
  erroText: { color: "#EF4444", fontSize: 13, flex: 1 },
  pagamentoOptions: { gap: 10, marginBottom: 20 },
  pagamentoCard: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 14, borderWidth: 1, padding: 16 },
  pagamentoIcon: { width: 46, height: 46, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  pagamentoInfo: { flex: 1 },
  pagamentoLabel: { fontSize: 16, marginBottom: 2 },
  pagamentoDesc: { fontSize: 12 },
  checkCircle: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  modalBtn: { height: 54, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  modalBtnText: { color: "#fff", fontSize: 16 },
  modalCancelar: { alignItems: "center", paddingVertical: 8 },
  modalCancelarText: { fontSize: 15 },
});
