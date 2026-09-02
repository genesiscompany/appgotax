import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, StatusBar, Modal, Image, Platform, Share, KeyboardAvoidingView,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import QRCode from "react-native-qrcode-svg";
import { useProAuth, PRO_COLORS, PRO_LABELS, PRO_ICONS } from "@/context/ProAuthContext";
import { gerarPixQRCode } from "@/utils/pixQrCode";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const DOC_STATUS: Record<string, { label: string; color: string }> = {
  pendente:   { label: "Pendente",    color: "#444" },
  em_analise: { label: "Em análise",  color: "#8B5CF6" },
  aprovado:   { label: "✓ Aprovado",  color: "#10B981" },
  rejeitado:  { label: "✗ Rejeitado", color: "#EF4444" },
};

type CategoriaCarro = {
  id: number; nome: string; taxa_minima: number; taxa_por_km: number;
};

type ModeloCarro = {
  id: number; nome: string; ano_minimo: number;
  categorias: CategoriaCarro[];
};

const TIPOS_VEICULO_ENTREGADOR = [
  { key: "moto", label: "Moto", icon: "🛵" },
  { key: "bicicleta", label: "Bicicleta", icon: "🚲" },
  { key: "carro", label: "Carro", icon: "🚗" },
  { key: "a_pe", label: "A pé", icon: "🚶" },
];

function VeiculoModal({
  visible, proUser, onClose, onSave,
}: {
  visible: boolean;
  proUser: any;
  onClose: () => void;
  onSave: (data: any) => void;
}) {
  const isEntregador = proUser?.tipo_profissional === "entregador" || proUser?.tipo_profissional === "delivery";

  // Motorista fields
  const [modelos, setModelos] = useState<ModeloCarro[]>([]);
  const [loadingModelos, setLoadingModelos] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedModelo, setSelectedModelo] = useState<ModeloCarro | null>(null);
  const [selectedCats, setSelectedCats] = useState<number[]>([]);

  // Shared fields
  const [placa, setPlaca] = useState(proUser?.veiculo_placa || "");
  const [cor, setCor] = useState(proUser?.veiculo_cor || "");
  const [ano, setAno] = useState(proUser?.veiculo_ano ? String(proUser.veiculo_ano) : "");
  const [marca, setMarca] = useState(proUser?.veiculo_marca || "");
  const [modelo, setModelo] = useState(proUser?.veiculo_modelo || "");

  // Entregador fields
  const [tipoVeiculo, setTipoVeiculo] = useState(proUser?.tipo_veiculo || "moto");

  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPlaca(proUser?.veiculo_placa || "");
    setCor(proUser?.veiculo_cor || "");
    setAno(proUser?.veiculo_ano ? String(proUser.veiculo_ano) : "");
    setMarca(proUser?.veiculo_marca || "");
    setModelo(proUser?.veiculo_modelo || "");
    setTipoVeiculo(proUser?.tipo_veiculo || "moto");

    if (!isEntregador) {
      setLoadingModelos(true);
      fetch(`${API_BASE}/admin/modelos-veiculo/publico`)
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            setModelos(data);
            const found = data.find((m: ModeloCarro) => m.nome === proUser?.veiculo_modelo);
            setSelectedModelo(found || null);
            const currentIds = (proUser?.categorias_habilitadas || []).map((c: any) => c.categoria_id);
            setSelectedCats(currentIds);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingModelos(false));
    }
  }, [visible]);

  const toggleCat = (id: number) => {
    setSelectedCats(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleModeloSelect = (m: ModeloCarro) => {
    setSelectedModelo(m);
    setShowDropdown(false);
    setSelectedCats([]);
  };

  const anoNum = parseInt(ano, 10);

  const handleSave = async () => {
    setSalvando(true);
    if (isEntregador) {
      await onSave({
        tipo_veiculo: tipoVeiculo,
        veiculo_marca: marca,
        veiculo_modelo: modelo,
        veiculo_placa: placa,
        veiculo_cor: cor,
        veiculo_ano: anoNum || undefined,
      });
    } else {
      await onSave({
        veiculo_modelo: selectedModelo?.nome || proUser?.veiculo_modelo || "",
        veiculo_placa: placa,
        veiculo_cor: cor,
        veiculo_ano: anoNum || undefined,
        selected_categoria_ids: selectedCats,
      });
    }
    setSalvando(false);
  };

  const formatMoney = (v: number) =>
    `R$ ${v.toFixed(2).replace(".", ",")} min.`;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={vstyles.root}>
        <ScrollView contentContainerStyle={vstyles.scroll}>
          <View style={vstyles.header}>
            <View style={vstyles.iconBox}>
              <Text style={{ fontSize: 24 }}>{isEntregador ? "🛵" : "🚗"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={vstyles.title}>Detalhes do Veículo</Text>
              <Text style={vstyles.subtitle}>Mantenha seus dados atualizados.</Text>
            </View>
          </View>

          {isEntregador ? (
            <>
              <Text style={vstyles.label}>TIPO DE VEÍCULO</Text>
              <View style={vstyles.tipoGrid}>
                {TIPOS_VEICULO_ENTREGADOR.map(t => (
                  <TouchableOpacity
                    key={t.key}
                    style={[vstyles.tipoBtn, tipoVeiculo === t.key && vstyles.tipoBtnActive]}
                    onPress={() => setTipoVeiculo(t.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 20 }}>{t.icon}</Text>
                    <Text style={[vstyles.tipoBtnTxt, tipoVeiculo === t.key && vstyles.tipoBtnTxtActive]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={vstyles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={vstyles.label}>MARCA</Text>
                  <TextInput style={vstyles.input} placeholder="Ex: Honda" placeholderTextColor="#555"
                    value={marca} onChangeText={setMarca} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={vstyles.label}>MODELO</Text>
                  <TextInput style={vstyles.input} placeholder="Ex: CG 160" placeholderTextColor="#555"
                    value={modelo} onChangeText={setModelo} />
                </View>
              </View>
            </>
          ) : (
            <>
              <Text style={vstyles.label}>MODELO DO CARRO</Text>
              {loadingModelos ? (
                <View style={vstyles.inputBox}><ActivityIndicator color="#1DB954" /></View>
              ) : modelos.length === 0 ? (
                <View style={vstyles.inputBox}><Text style={vstyles.placeholder}>Nenhum modelo cadastrado pelo admin</Text></View>
              ) : (
                <>
                  <TouchableOpacity style={[vstyles.inputBox, selectedModelo ? vstyles.inputBoxActive : null]} onPress={() => setShowDropdown(v => !v)}>
                    <Text style={selectedModelo ? vstyles.inputText : vstyles.placeholder}>
                      {selectedModelo ? selectedModelo.nome : "Selecione o modelo"}
                    </Text>
                    <Text style={vstyles.chevron}>{showDropdown ? "▲" : "▼"}</Text>
                  </TouchableOpacity>
                  {showDropdown && (
                    <View style={vstyles.dropdown}>
                      {modelos.map(m => (
                        <TouchableOpacity key={m.id} style={vstyles.dropdownItem} onPress={() => handleModeloSelect(m)}>
                          <Text style={[vstyles.dropdownText, selectedModelo?.id === m.id && vstyles.dropdownTextActive]}>{m.nome}</Text>
                          <Text style={vstyles.dropdownSub}>A partir de {m.ano_minimo}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </>
              )}
            </>
          )}

          <View style={vstyles.row}>
            <View style={{ flex: 1 }}>
              <Text style={vstyles.label}>PLACA</Text>
              <TextInput style={vstyles.input} placeholder="ABC-1234" placeholderTextColor="#555"
                value={placa} onChangeText={setPlaca} autoCapitalize="characters" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={vstyles.label}>COR</Text>
              <TextInput style={vstyles.input} placeholder="Ex: Prata" placeholderTextColor="#555"
                value={cor} onChangeText={setCor} />
            </View>
          </View>

          <Text style={vstyles.label}>ANO DE FABRICAÇÃO</Text>
          <TextInput style={vstyles.inputFull} placeholder="Ex: 2022" placeholderTextColor="#555"
            value={ano} onChangeText={setAno} keyboardType="number-pad" />

          {!isEntregador && selectedModelo && selectedModelo.categorias.length > 0 && (
            <View style={vstyles.catSection}>
              <Text style={vstyles.label}>CATEGORIAS DISPONÍVEIS</Text>
              {selectedModelo.categorias.map(c => {
                const checked = selectedCats.includes(c.id);
                return (
                  <TouchableOpacity key={c.id} style={vstyles.catCheckRow} onPress={() => toggleCat(c.id)} activeOpacity={0.7}>
                    <View style={[vstyles.checkbox, checked && vstyles.checkboxChecked]}>
                      {checked && <Text style={vstyles.checkmark}>✓</Text>}
                    </View>
                    <Text style={vstyles.catCheckName}>{c.nome}</Text>
                    <Text style={vstyles.catCheckPrice}>{formatMoney(c.taxa_minima)}</Text>
                  </TouchableOpacity>
                );
              })}
              <Text style={vstyles.catHint}>Selecione todas as categorias em que seu veículo se enquadra.</Text>
            </View>
          )}
        </ScrollView>

        <View style={vstyles.footer}>
          <TouchableOpacity style={vstyles.cancelBtn} onPress={onClose}>
            <Text style={vstyles.cancelBtnTxt}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={vstyles.saveBtn} onPress={handleSave} disabled={salvando}>
            {salvando ? <ActivityIndicator color="#000" /> : <Text style={vstyles.saveBtnTxt}>Salvar</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const vstyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0D0D0D" },
  scroll: { padding: 20, paddingBottom: 20, gap: 6 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  iconBox: { width: 50, height: 50, borderRadius: 14, backgroundColor: "#1A3A28", justifyContent: "center", alignItems: "center" },
  title: { fontSize: 18, fontWeight: "800", color: "#FFF" },
  subtitle: { fontSize: 13, color: "#8896B0", marginTop: 2 },
  label: { fontSize: 11, fontWeight: "700", color: "#555", letterSpacing: 0.8, marginBottom: 6, marginTop: 10 },
  inputBox: { backgroundColor: "#1A1A1A", borderWidth: 1.5, borderColor: "#2A2A2A", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 15, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  inputBoxActive: { borderColor: "#1DB954" },
  inputText: { fontSize: 15, color: "#FFF", fontWeight: "600" },
  placeholder: { fontSize: 15, color: "#555" },
  chevron: { fontSize: 10, color: "#555" },
  dropdown: { backgroundColor: "#1A1A1A", borderWidth: 1.5, borderColor: "#2A2A2A", borderRadius: 12, marginTop: 4, overflow: "hidden" },
  dropdownItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#222" },
  dropdownText: { fontSize: 14, color: "#FFF", fontWeight: "600" },
  dropdownTextActive: { color: "#1DB954" },
  dropdownSub: { fontSize: 12, color: "#555", marginTop: 2 },
  row: { flexDirection: "row", gap: 12 },
  input: { backgroundColor: "#1A1A1A", borderWidth: 1.5, borderColor: "#2A2A2A", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 15, color: "#FFF", fontSize: 15 },
  inputFull: { backgroundColor: "#1A1A1A", borderWidth: 1.5, borderColor: "#2A2A2A", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 15, color: "#FFF", fontSize: 15 },
  // Category checkboxes
  catSection: { backgroundColor: "#1A1A1A", borderRadius: 14, paddingHorizontal: 4, paddingTop: 4, paddingBottom: 4, marginTop: 8 },
  catCheckRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "#252525" },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: "#444", marginRight: 14, justifyContent: "center", alignItems: "center", backgroundColor: "#111" },
  checkboxChecked: { backgroundColor: "#1DB954", borderColor: "#1DB954" },
  checkmark: { fontSize: 13, fontWeight: "900", color: "#000" },
  catCheckName: { flex: 1, fontSize: 15, fontWeight: "700", color: "#FFF" },
  catCheckPrice: { fontSize: 13, fontWeight: "600", color: "#888" },
  catHint: { fontSize: 12, color: "#444", paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6, lineHeight: 18 },
  footer: { flexDirection: "row", gap: 12, padding: 20, paddingBottom: 40, borderTopWidth: 1, borderTopColor: "#1A1A1A" },
  cancelBtn: { flex: 1, backgroundColor: "#1A1A1A", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  cancelBtnTxt: { fontSize: 15, fontWeight: "700", color: "#888" },
  saveBtn: { flex: 1, backgroundColor: "#1DB954", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  saveBtnTxt: { fontSize: 15, fontWeight: "800", color: "#000" },
  tipoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 4 },
  tipoBtn: { flex: 1, minWidth: "40%", backgroundColor: "#1A1A1A", borderWidth: 1.5, borderColor: "#2A2A2A", borderRadius: 14, paddingVertical: 14, alignItems: "center", gap: 6 },
  tipoBtnActive: { borderColor: "#1DB954", backgroundColor: "#1A2E22" },
  tipoBtnTxt: { fontSize: 13, fontWeight: "700", color: "#666" },
  tipoBtnTxtActive: { color: "#1DB954" },
});

const REFERRAL_DOMAIN = "gotaxi.com.br";

function ReferralCard({ codigo, cor }: { codigo: string; cor: string }) {
  const link = `https://${REFERRAL_DOMAIN}/afiliados/r/${codigo}`;

  const copiar = async () => {
    await Clipboard.setStringAsync(link);
    Alert.alert("✅ Copiado!", "Link de indicação copiado para a área de transferência.");
  };

  const compartilhar = async () => {
    try {
      await Share.share({
        message: `🚖 Cadastre-se no GoTaxi usando meu link e ganhe benefícios!\n\n${link}`,
        url: link,
        title: "GoTaxi — Meu link de indicação",
      });
    } catch (_) {}
  };

  return (
    <View style={rStyles.card}>
      <View style={rStyles.header}>
        <Text style={rStyles.icon}>🔗</Text>
        <View style={{ flex: 1 }}>
          <Text style={rStyles.title}>Seu link de indicação</Text>
          <Text style={rStyles.subtitle}>Indique amigos e ganhe benefícios</Text>
        </View>
        <View style={[rStyles.codeBadge, { backgroundColor: cor + "22", borderColor: cor + "55" }]}>
          <Text style={[rStyles.codeText, { color: cor }]}>{codigo}</Text>
        </View>
      </View>

      <View style={rStyles.linkBox}>
        <Text style={rStyles.linkText} numberOfLines={1} ellipsizeMode="middle">{link}</Text>
      </View>

      <View style={rStyles.row}>
        <TouchableOpacity style={[rStyles.btn, rStyles.copyBtn]} onPress={copiar} activeOpacity={0.8}>
          <Text style={rStyles.copyBtnTxt}>📋 Copiar link</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[rStyles.btn, { backgroundColor: cor }]} onPress={compartilhar} activeOpacity={0.8}>
          <Text style={rStyles.shareBtnTxt}>🚀 Compartilhar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const rStyles = StyleSheet.create({
  card: { backgroundColor: "#1A1A1A", borderRadius: 16, padding: 16, marginBottom: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  icon: { fontSize: 26 },
  title: { fontSize: 14, fontWeight: "800", color: "#FFF" },
  subtitle: { fontSize: 12, color: "#666", marginTop: 2 },
  codeBadge: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  codeText: { fontSize: 13, fontWeight: "900", letterSpacing: 0.5 },
  linkBox: { backgroundColor: "#111", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
  linkText: { fontSize: 12, color: "#888", fontFamily: "monospace" },
  row: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  copyBtn: { backgroundColor: "#252525" },
  copyBtnTxt: { fontSize: 13, fontWeight: "700", color: "#FFF" },
  shareBtnTxt: { fontSize: 13, fontWeight: "800", color: "#000" },
});

const PIX_TIPOS = [
  { key: "cpf",             label: "CPF" },
  { key: "cnpj",            label: "CNPJ" },
  { key: "telefone",        label: "Telefone" },
  { key: "email",           label: "E-mail" },
  { key: "chave_aleatoria", label: "Aleatória" },
];

function buildPixImgUrl(pixImagem: string, apiBase: string) {
  if (!pixImagem) return "";
  if (pixImagem.startsWith("http")) return pixImagem;
  const base = apiBase.replace("/api", "");
  return `${base}${pixImagem}`;
}

export default function ProPerfil() {
  const { proUser, logout, refreshPerfil } = useProAuth();
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [veiculoModal, setVeiculoModal] = useState(false);
  const [pinModal, setPinModal] = useState(false);
  const [pinAtual, setPinAtual] = useState("");
  const [novoPin, setNovoPin] = useState("");
  const [confirmaPin, setConfirmaPin] = useState("");
  const [salvandoPin, setSalvandoPin] = useState(false);
  const [pinMsg, setPinMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleAlterarPin = async () => {
    setPinMsg(null);
    if (!pinAtual || !novoPin || !confirmaPin) { setPinMsg({ ok: false, text: "Preencha todos os campos." }); return; }
    if (novoPin !== confirmaPin) { setPinMsg({ ok: false, text: "Os PINs não coincidem." }); return; }
    if (novoPin.length < 4) { setPinMsg({ ok: false, text: "O PIN deve ter pelo menos 4 dígitos." }); return; }
    setSalvandoPin(true);
    try {
      const token = `ma_${proUser?.id}_${Date.now()}`;
      const res = await fetch(`${API_BASE}/motorista-app/alterar-pin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pinAtual, novoPin }),
      });
      const data = await res.json();
      if (res.ok) {
        setPinMsg({ ok: true, text: "PIN alterado com sucesso!" });
        setPinAtual(""); setNovoPin(""); setConfirmaPin("");
        setTimeout(() => { setPinModal(false); setPinMsg(null); }, 1500);
      } else {
        setPinMsg({ ok: false, text: data.message || "Erro ao alterar PIN." });
      }
    } catch { setPinMsg({ ok: false, text: "Erro de rede. Tente novamente." }); }
    setSalvandoPin(false);
  };

  const [form, setForm] = useState({
    nome: proUser?.nome || "",
    email: proUser?.email || "",
    cidade: proUser?.cidade || "",
    estado: proUser?.estado || "",
  });

  // PIX state
  const [editandoPix, setEditandoPix] = useState(false);
  const [salvandoPix, setSalvandoPix] = useState(false);
  const [enviandoPixImg, setEnviandoPixImg] = useState(false);
  const [pixTipo, setPixTipo] = useState(proUser?.pix_tipo || "cpf");
  const [pixChave, setPixChave] = useState(proUser?.pix_chave || "");

  useEffect(() => {
    setForm({
      nome: proUser?.nome || "",
      email: proUser?.email || "",
      cidade: proUser?.cidade || "",
      estado: proUser?.estado || "",
    });
    setPixTipo(proUser?.pix_tipo || "cpf");
    setPixChave(proUser?.pix_chave || "");
  }, [proUser]);

  if (!proUser) return null;

  const cor = PRO_COLORS[proUser.tipo_profissional];

  const salvar = async () => {
    setSalvando(true);
    try {
      const res = await fetch(`${API_BASE}/motorista-app/perfil`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${proUser.token}` },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        await refreshPerfil();
        setEditando(false);
        Alert.alert("✅ Perfil atualizado!");
      } else {
        Alert.alert("Erro", "Não foi possível salvar.");
      }
    } catch { Alert.alert("Erro", "Sem conexão."); }
    setSalvando(false);
  };

  const salvarVeiculo = async (data: any) => {
    try {
      const res = await fetch(`${API_BASE}/motorista-app/perfil`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${proUser.token}` },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await refreshPerfil();
        setVeiculoModal(false);
        Alert.alert("✅ Veículo atualizado!");
      } else {
        Alert.alert("Erro", "Não foi possível salvar.");
      }
    } catch { Alert.alert("Erro", "Sem conexão."); }
  };

  const salvarPix = async () => {
    if (!pixChave.trim() && !proUser.pix_imagem_url) {
      Alert.alert("Atenção", "Digite sua chave PIX ou adicione a imagem do seu banco.");
      return;
    }
    setSalvandoPix(true);
    try {
      const res = await fetch(`${API_BASE}/motorista-app/pix`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${proUser.token}` },
        body: JSON.stringify({ pix_tipo: pixTipo, pix_chave: pixChave.trim() || null }),
      });
      if (res.ok) {
        await refreshPerfil();
        setEditandoPix(false);
        Alert.alert("✅ PIX atualizado!");
      } else {
        Alert.alert("Erro", "Não foi possível salvar.");
      }
    } catch { Alert.alert("Erro", "Sem conexão."); }
    setSalvandoPix(false);
  };

  const uploadPixImagem = async () => {
    setEnviandoPixImg(true);
    try {
      if (Platform.OS !== "web") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permissão necessária", "Permita o acesso à galeria.");
          setEnviandoPixImg(false);
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) { setEnviandoPixImg(false); return; }
      const asset = result.assets[0];
      const formData = new FormData();
      if (Platform.OS === "web") {
        const blobRes = await globalThis.fetch(asset.uri);
        const blob = await blobRes.blob();
        formData.append("file", blob, "pix.jpg");
      } else {
        formData.append("file", { uri: asset.uri, name: "pix.jpg", type: asset.mimeType || "image/jpeg" } as any);
      }
      const res = await globalThis.fetch(`${API_BASE}/motorista-app/pix/imagem`, {
        method: "POST",
        headers: { Authorization: `Bearer ${proUser.token}` },
        body: formData,
      });
      if (res.ok) {
        await refreshPerfil();
        Alert.alert("✅ Imagem PIX salva!");
      } else {
        Alert.alert("Erro", "Não foi possível enviar a imagem.");
      }
    } catch { Alert.alert("Erro", "Sem conexão."); }
    setEnviandoPixImg(false);
  };

  const removerPixImagem = async () => {
    try {
      await fetch(`${API_BASE}/motorista-app/pix`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${proUser.token}` },
        body: JSON.stringify({ pix_tipo: proUser.pix_tipo || "cpf", pix_chave: proUser.pix_chave || null, pix_imagem_url: null }),
      });
      await refreshPerfil();
    } catch {}
  };

  const handleLogout = () => {
    Alert.alert("Sair", "Deseja sair do GoTaxi Pro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: async () => { router.replace("/pro/bem-vindo" as any); await logout(); } },
    ]);
  };

  const docs = [
    { label: "CNH",             status: proUser.doc_cnh_status },
    { label: "CRLV do Veículo", status: proUser.doc_veiculo_status },
    { label: "Selfie com CNH",  status: proUser.doc_selfie_status },
  ];

  const campos = [
    { label: "Nome",        key: "nome" as const },
    { label: "E-mail",      key: "email" as const },
    { label: "Cidade",      key: "cidade" as const },
    { label: "Estado (UF)", key: "estado" as const },
  ];

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.avatar, { borderColor: cor }]}>
            <Text style={styles.avatarIcon}>{PRO_ICONS[proUser.tipo_profissional]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.nome}>{proUser.nome}</Text>
            <Text style={[styles.tipo, { color: cor }]}>{PRO_LABELS[proUser.tipo_profissional]}</Text>
            {proUser.avaliacao_media > 0 && (
              <Text style={styles.avaliacao}>★ {Number(proUser.avaliacao_media).toFixed(1)} · {proUser.total_corridas} serviços</Text>
            )}
          </View>
          <TouchableOpacity style={[styles.editBtn, { borderColor: cor }]} onPress={() => setEditando(!editando)}>
            <Text style={[styles.editBtnTxt, { color: cor }]}>{editando ? "Cancelar" : "Editar"}</Text>
          </TouchableOpacity>
        </View>

        {/* Documentos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DOCUMENTOS</Text>
          {docs.map(d => {
            const conf = DOC_STATUS[d.status] || DOC_STATUS.pendente;
            return (
              <View key={d.label} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{d.label}</Text>
                <Text style={[styles.docStatus, { color: conf.color }]}>{conf.label}</Text>
              </View>
            );
          })}
        </View>

        {/* Dados Pessoais */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DADOS PESSOAIS</Text>
          {editando ? (
            <>
              {campos.map(c => (
                <View key={c.key}>
                  <Text style={styles.fieldLabel}>{c.label}</Text>
                  <TextInput
                    style={styles.input}
                    value={form[c.key]}
                    onChangeText={v => setForm(p => ({ ...p, [c.key]: v }))}
                    placeholderTextColor="#444"
                  />
                </View>
              ))}
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: cor }]} onPress={salvar} disabled={salvando}>
                {salvando
                  ? <ActivityIndicator color="#000" />
                  : <Text style={styles.saveBtnTxt}>Salvar alterações</Text>
                }
              </TouchableOpacity>
            </>
          ) : (
            <>
              {[
                { label: "Telefone", val: proUser.telefone },
                { label: "E-mail", val: proUser.email || "–" },
                { label: "CPF", val: proUser.cpf || "–" },
                { label: "Cidade", val: [proUser.cidade, proUser.estado].filter(Boolean).join(" – ") || "–" },
              ].map(r => (
                <View key={r.label} style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{r.label}</Text>
                  <Text style={styles.infoVal}>{r.val}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        {/* PIX */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>💸 PIX</Text>
            <TouchableOpacity onPress={() => setEditandoPix(v => !v)}>
              <Text style={[styles.editVeiculoBtnTxt, { color: cor }]}>
                {editandoPix ? "Cancelar" : "Editar"}
              </Text>
            </TouchableOpacity>
          </View>

          {editandoPix ? (
            <>
              {/* Tipo selector */}
              <Text style={styles.fieldLabel}>TIPO DE CHAVE</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {PIX_TIPOS.map(t => (
                  <TouchableOpacity
                    key={t.key}
                    onPress={() => setPixTipo(t.key)}
                    style={[styles.tipoBtn, pixTipo === t.key && { borderColor: cor, backgroundColor: cor + "22" }]}
                  >
                    <Text style={[styles.tipoBtnTxt, pixTipo === t.key && { color: cor }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Chave input */}
              <Text style={styles.fieldLabel}>CHAVE PIX</Text>
              <TextInput
                style={styles.input}
                value={pixChave}
                onChangeText={setPixChave}
                placeholder={`Digite sua chave ${PIX_TIPOS.find(t => t.key === pixTipo)?.label || ""}`}
                placeholderTextColor="#444"
                autoCapitalize="none"
                keyboardType={pixTipo === "telefone" ? "phone-pad" : pixTipo === "email" ? "email-address" : "default"}
              />

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: cor, marginTop: 4 }]}
                onPress={salvarPix}
                disabled={salvandoPix}
              >
                {salvandoPix
                  ? <ActivityIndicator color="#000" />
                  : <Text style={styles.saveBtnTxt}>Salvar chave PIX</Text>
                }
              </TouchableOpacity>

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>IMAGEM DO QR CODE DO BANCO</Text>
              <Text style={{ fontSize: 12, color: "#555", marginBottom: 10 }}>
                Suba uma foto do QR Code do PIX gerado pelo app do seu banco
              </Text>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: "#1A1A1A", borderWidth: 1, borderColor: "#333" }]}
                onPress={uploadPixImagem}
                disabled={enviandoPixImg}
              >
                {enviandoPixImg
                  ? <ActivityIndicator color="#FFF" />
                  : <Text style={[styles.saveBtnTxt, { color: "#FFF" }]}>📷 Escolher imagem do banco</Text>
                }
              </TouchableOpacity>
            </>
          ) : (
            <>
              {proUser.pix_chave && (
                <>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Tipo</Text>
                    <Text style={styles.infoVal}>{PIX_TIPOS.find(t => t.key === proUser.pix_tipo)?.label || proUser.pix_tipo}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Chave</Text>
                    <Text style={[styles.infoVal, { flex: 1, textAlign: "right" }]} numberOfLines={1}>{proUser.pix_chave}</Text>
                  </View>
                </>
              )}

              {proUser.pix_imagem_url ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={[styles.infoLabel, { marginBottom: 8 }]}>QR Code do banco</Text>
                  <Image
                    source={{ uri: buildPixImgUrl(proUser.pix_imagem_url, API_BASE) }}
                    style={{ width: "100%", height: 220, borderRadius: 12 }}
                    resizeMode="contain"
                  />
                  <TouchableOpacity
                    style={{ marginTop: 6, alignItems: "center" }}
                    onPress={() => Alert.alert("Remover imagem", "Remover a imagem PIX do banco?", [
                      { text: "Cancelar", style: "cancel" },
                      { text: "Remover", style: "destructive", onPress: removerPixImagem },
                    ])}
                  >
                    <Text style={{ fontSize: 12, color: "#EF4444" }}>Remover imagem</Text>
                  </TouchableOpacity>
                </View>
              ) : proUser.pix_chave ? (
                <View style={{ alignItems: "center", marginTop: 12 }}>
                  <View style={{ backgroundColor: "#FFF", borderRadius: 16, padding: 14 }}>
                    <QRCode
                      value={gerarPixQRCode(proUser.pix_chave, proUser.nome, proUser.cidade || "Brasil")}
                      size={180}
                      backgroundColor="#FFFFFF"
                      color="#000000"
                    />
                  </View>
                  <Text style={{ fontSize: 11, color: "#555", marginTop: 8 }}>QR Code PIX válido da sua chave</Text>
                </View>
              ) : (
                <Text style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                  Configure sua chave PIX ou faça upload do QR Code do seu banco para receber pagamentos.
                </Text>
              )}
            </>
          )}
        </View>

        {/* Veículo */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>VEÍCULO</Text>
            <TouchableOpacity onPress={() => setVeiculoModal(true)} style={styles.editVeiculoBtn}>
              <Text style={styles.editVeiculoBtnTxt}>Editar</Text>
            </TouchableOpacity>
          </View>
          {[
            { label: "Modelo", val: proUser.veiculo_modelo || "–" },
            { label: "Placa",  val: proUser.veiculo_placa || "–" },
            { label: "Cor",    val: proUser.veiculo_cor || "–" },
            { label: "Ano",    val: proUser.veiculo_ano ? String(proUser.veiculo_ano) : "–" },
          ].map(r => (
            <View key={r.label} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{r.label}</Text>
              <Text style={styles.infoVal}>{r.val}</Text>
            </View>
          ))}
          {proUser.categorias_habilitadas && proUser.categorias_habilitadas.length > 0 && (
            <View style={styles.catHabSection}>
              <Text style={styles.catHabLabel}>CATEGORIAS HABILITADAS</Text>
              <View style={styles.catHabList}>
                {proUser.categorias_habilitadas.map(c => (
                  <View key={c.categoria_id} style={styles.catHabBadge}>
                    <Text style={styles.catHabBadgeText}>{c.categoria_nome}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {proUser.veiculo_modelo && (!proUser.categorias_habilitadas || proUser.categorias_habilitadas.length === 0) && (
            <View style={styles.catHabSection}>
              <Text style={[styles.catHabLabel, { color: "#EF4444" }]}>NENHUMA CATEGORIA HABILITADA</Text>
              <Text style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                Verifique se o modelo e o ano do seu veículo atendem aos requisitos.
              </Text>
            </View>
          )}
        </View>

        {/* Conta */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CONTA</Text>
          {[
            { label: "Repasse GoTaxi", val: `${proUser.percentual_repasse || 3}%` },
            { label: "Saldo disponível", val: `R$ ${Number(proUser.saldo || 0).toFixed(2).replace(".", ",")}` },
            { label: "Membro desde", val: proUser.criado_em ? (() => { const d = new Date(proUser.criado_em); return `${d.getDate().toString().padStart(2,"0")}/${(d.getMonth()+1).toString().padStart(2,"0")}/${d.getFullYear()}`; })() : "–" },
          ].map(r => (
            <View key={r.label} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{r.label}</Text>
              <Text style={styles.infoVal}>{r.val}</Text>
            </View>
          ))}
        </View>

        {/* Link de Indicação */}
        {proUser.codigo_referral ? (
          <ReferralCard codigo={proUser.codigo_referral} cor={cor} />
        ) : null}

        <TouchableOpacity style={styles.alterarPinBtn} onPress={() => setPinModal(true)}>
          <Text style={styles.alterarPinTxt}>🔐 Alterar PIN de acesso</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutTxt}>Sair da conta</Text>
        </TouchableOpacity>

      </ScrollView>

      <VeiculoModal
        visible={veiculoModal}
        proUser={proUser}
        onClose={() => setVeiculoModal(false)}
        onSave={salvarVeiculo}
      />

      {/* Modal Alterar PIN */}
      <Modal visible={pinModal} transparent animationType="slide" onRequestClose={() => setPinModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={styles.pinOverlay}>
            <View style={styles.pinSheet}>
              <View style={styles.pinHandle} />
              <Text style={styles.pinTitle}>Alterar PIN de Acesso</Text>
              <Text style={styles.pinSubtitle}>O PIN é usado para fazer login no aplicativo.</Text>

              <View style={styles.pinField}>
                <Text style={styles.pinLabel}>PIN atual</Text>
                <TextInput
                  style={styles.pinInput}
                  value={pinAtual}
                  onChangeText={setPinAtual}
                  placeholder="••••"
                  placeholderTextColor="#555"
                  secureTextEntry
                  keyboardType="number-pad"
                  maxLength={8}
                />
              </View>
              <View style={styles.pinField}>
                <Text style={styles.pinLabel}>Novo PIN <Text style={{ color: "#555", fontSize: 11 }}>(mínimo 4 dígitos)</Text></Text>
                <TextInput
                  style={styles.pinInput}
                  value={novoPin}
                  onChangeText={setNovoPin}
                  placeholder="••••"
                  placeholderTextColor="#555"
                  secureTextEntry
                  keyboardType="number-pad"
                  maxLength={8}
                />
              </View>
              <View style={styles.pinField}>
                <Text style={styles.pinLabel}>Confirmar novo PIN</Text>
                <TextInput
                  style={styles.pinInput}
                  value={confirmaPin}
                  onChangeText={setConfirmaPin}
                  placeholder="••••"
                  placeholderTextColor="#555"
                  secureTextEntry
                  keyboardType="number-pad"
                  maxLength={8}
                />
              </View>

              {pinMsg && (
                <View style={[styles.pinMsg, { backgroundColor: pinMsg.ok ? "#10B98120" : "#EF444420", borderColor: pinMsg.ok ? "#10B981" : "#EF4444" }]}>
                  <Text style={{ color: pinMsg.ok ? "#10B981" : "#EF4444", fontSize: 13, fontWeight: "600" }}>{pinMsg.text}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.pinSaveBtn, { opacity: salvandoPin || !pinAtual || !novoPin || !confirmaPin ? 0.5 : 1 }]}
                onPress={handleAlterarPin}
                disabled={salvandoPin || !pinAtual || !novoPin || !confirmaPin}>
                {salvandoPin
                  ? <ActivityIndicator color="#000" />
                  : <Text style={styles.pinSaveTxt}>Alterar PIN</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity style={styles.pinCancelBtn} onPress={() => { setPinModal(false); setPinMsg(null); setPinAtual(""); setNovoPin(""); setConfirmaPin(""); }}>
                <Text style={styles.pinCancelTxt}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0D0D0D" },
  scroll: { padding: 20, gap: 4, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20 },
  avatar: { width: 60, height: 60, borderRadius: 18, borderWidth: 2.5, justifyContent: "center", alignItems: "center", backgroundColor: "#1A1A1A" },
  avatarIcon: { fontSize: 28 },
  nome: { fontSize: 18, fontWeight: "800", color: "#FFF" },
  tipo: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  avaliacao: { fontSize: 12, color: "#8896B0", marginTop: 2 },
  editBtn: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  editBtnTxt: { fontSize: 13, fontWeight: "700" },
  section: { backgroundColor: "#1A1A1A", borderRadius: 16, padding: 16, marginBottom: 12 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  sectionTitle: { fontSize: 11, fontWeight: "800", color: "#555", marginBottom: 12, letterSpacing: 0.8 },
  editVeiculoBtn: { backgroundColor: "#1DB95420", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 8 },
  editVeiculoBtnTxt: { fontSize: 12, fontWeight: "700", color: "#1DB954" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#222" },
  infoLabel: { fontSize: 13, color: "#8896B0" },
  infoVal: { fontSize: 14, color: "#FFF", fontWeight: "600", maxWidth: "55%", textAlign: "right" },
  docStatus: { fontSize: 13, fontWeight: "700" },
  fieldLabel: { fontSize: 12, color: "#8896B0", marginTop: 10, marginBottom: 4 },
  input: { backgroundColor: "#111", borderWidth: 1.5, borderColor: "#2A2A2A", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: "#FFF", fontSize: 15 },
  saveBtn: { borderRadius: 14, paddingVertical: 15, alignItems: "center", marginTop: 16 },
  saveBtnTxt: { fontSize: 15, fontWeight: "800", color: "#000" },
  alterarPinBtn: { backgroundColor: "#FF6B0015", borderWidth: 1.5, borderColor: "#FF6B0040", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  alterarPinTxt: { fontSize: 14, fontWeight: "700", color: "#FF8C00" },
  logoutBtn: { backgroundColor: "#1A1A1A", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 4 },
  logoutTxt: { fontSize: 15, fontWeight: "600", color: "#EF4444" },
  pinOverlay: { flex: 1, backgroundColor: "#000000AA", justifyContent: "flex-end" },
  pinSheet: { backgroundColor: "#141414", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  pinHandle: { width: 40, height: 4, backgroundColor: "#333", borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  pinTitle: { fontSize: 18, fontWeight: "800", color: "#FFF", marginBottom: 4 },
  pinSubtitle: { fontSize: 13, color: "#888", marginBottom: 20 },
  pinField: { marginBottom: 14 },
  pinLabel: { fontSize: 12, color: "#888", fontWeight: "600", marginBottom: 6 },
  pinInput: { backgroundColor: "#1E1E1E", borderWidth: 1.5, borderColor: "#2A2A2A", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: "#FFF", fontSize: 18, letterSpacing: 4 },
  pinMsg: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16 },
  pinSaveBtn: { backgroundColor: "#FF8C00", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginBottom: 10 },
  pinSaveTxt: { fontSize: 15, fontWeight: "800", color: "#000" },
  pinCancelBtn: { paddingVertical: 14, alignItems: "center" },
  pinCancelTxt: { fontSize: 14, fontWeight: "600", color: "#888" },
  catHabSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#222" },
  catHabLabel: { fontSize: 10, fontWeight: "800", color: "#555", letterSpacing: 0.8, marginBottom: 8 },
  catHabList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catHabBadge: { backgroundColor: "#1DB95420", borderWidth: 1.5, borderColor: "#1DB95450", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  catHabBadgeText: { fontSize: 12, fontWeight: "700", color: "#1DB954" },
  tipoBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: "#2A2A2A", backgroundColor: "#1A1A1A", marginRight: 6, marginBottom: 6 },
  tipoBtnTxt: { fontSize: 13, fontWeight: "600" as const, color: "#888" },
});
