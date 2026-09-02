import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, useColorScheme,
  Platform, Modal, TextInput, Alert, ActivityIndicator, RefreshControl, Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";
const MOD_COLOR = Colors.modules.ecommerce;

interface Categoria { id: number; nome: string; }
interface Produto {
  id: number; nome: string; descricao?: string; preco: number;
  imagem?: string; ativo: boolean; categoria_id?: number; categoria_nome?: string;
  extras: any[];
}
interface Promocao {
  id: number; nome: string; tipo: string; valor: number;
  codigo_cupom?: string; min_pedido: number; validade?: string; ativo: boolean;
}

const TIPO_PROMO: Record<string, string> = {
  percentual: "% OFF",
  valor: "R$ OFF",
  frete_gratis: "Frete Grátis",
};

export default function EcommerceScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const { auth } = useAuth();

  const [activeTab, setActiveTab] = useState<"produtos" | "promocoes" | "pedidos">("produtos");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [promocoes, setPromocoes] = useState<Promocao[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Produto modal
  const [modalProduto, setModalProduto] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  const [saving, setSaving] = useState(false);
  const [fNome, setFNome] = useState("");
  const [fDescricao, setFDescricao] = useState("");
  const [fPreco, setFPreco] = useState("");
  const [fCategoria, setFCategoria] = useState("");
  const [fImageUri, setFImageUri] = useState<string | null>(null);

  // Promoção modal
  const [modalPromo, setModalPromo] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promocao | null>(null);
  const [pNome, setPNome] = useState("");
  const [pTipo, setPTipo] = useState("percentual");
  const [pValor, setPValor] = useState("");
  const [pCodigo, setPCodigo] = useState("");
  const [pMin, setPMin] = useState("");
  const [savingPromo, setSavingPromo] = useState(false);

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  const authHeaders = {
    "Content-Type": "application/json",
    ...(auth.token ? { Authorization: `Bearer ${auth.token}`, "x-empresa-id": String(auth.empresa?.id) } : {}),
  };

  const fetchData = useCallback(async () => {
    if (!auth.token) return;
    try {
      const headers = {
        Authorization: `Bearer ${auth.token}`,
        "x-empresa-id": String(auth.empresa?.id),
        "Content-Type": "application/json",
      };
      const [pRes, cRes, prRes] = await Promise.all([
        fetch(`${API_BASE}/pdv/produtos`, { headers }),
        fetch(`${API_BASE}/pdv/categorias`, { headers }),
        fetch(`${API_BASE}/pdv/promocoes`, { headers }),
      ]);
      const [p, c, pr] = await Promise.all([pRes.json(), cRes.json(), prRes.json()]);
      setProdutos(Array.isArray(p) ? p : []);
      setCategorias(Array.isArray(c) ? c : []);
      setPromocoes(Array.isArray(pr) ? pr : []);
    } catch (e) {
      console.error("fetchData error", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [auth.token, auth.empresa?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  // ── Produto handlers ──────────────────────────────────────────────────────
  const openAddProduto = () => {
    setEditingProduto(null);
    setFNome(""); setFDescricao(""); setFPreco(""); setFCategoria(""); setFImageUri(null);
    setModalProduto(true);
  };

  const openEditProduto = (p: Produto) => {
    setEditingProduto(p);
    setFNome(p.nome); setFDescricao(p.descricao ?? ""); setFPreco(String(p.preco));
    setFCategoria(p.categoria_nome ?? ""); setFImageUri(p.imagem ?? null);
    setModalProduto(true);
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permissão necessária", "Precisa de acesso à galeria."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setFImageUri(result.assets[0].uri);
    }
  };

  const handleSaveProduto = async () => {
    if (!fNome.trim()) { Alert.alert("Atenção", "Nome é obrigatório"); return; }
    setSaving(true);
    try {
      const headers = { Authorization: `Bearer ${auth.token}`, "x-empresa-id": String(auth.empresa?.id), "Content-Type": "application/json" };
      let produtoId = editingProduto?.id;

      if (editingProduto) {
        await fetch(`${API_BASE}/pdv/produtos/${editingProduto.id}`, {
          method: "PATCH", headers,
          body: JSON.stringify({ nome: fNome.trim(), descricao: fDescricao.trim() || undefined, preco: parseFloat(fPreco) || 0 }),
        });
      } else {
        const r = await fetch(`${API_BASE}/pdv/produtos`, {
          method: "POST", headers,
          body: JSON.stringify({ nome: fNome.trim(), descricao: fDescricao.trim() || undefined, preco: parseFloat(fPreco) || 0 }),
        });
        const novo = await r.json();
        produtoId = novo?.id;
      }

      // Upload image if picked and changed
      if (fImageUri && produtoId && (!editingProduto || fImageUri !== editingProduto.imagem)) {
        const fd = new FormData();
        const filename = fImageUri.split("/").pop() ?? "imagem.jpg";
        const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
        const mimeMap: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
        fd.append("imagem", { uri: fImageUri, name: filename, type: mimeMap[ext] ?? "image/jpeg" } as any);
        await fetch(`${API_BASE}/pdv/produtos/${produtoId}/imagem`, {
          method: "POST",
          headers: { Authorization: `Bearer ${auth.token}`, "x-empresa-id": String(auth.empresa?.id) },
          body: fd,
        });
      }

      setModalProduto(false);
      fetchData();
    } catch {
      Alert.alert("Erro", "Não foi possível salvar o produto.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleProduto = async (p: Produto) => {
    const headers = { Authorization: `Bearer ${auth.token}`, "x-empresa-id": String(auth.empresa?.id), "Content-Type": "application/json" };
    await fetch(`${API_BASE}/pdv/produtos/${p.id}`, {
      method: "PATCH", headers, body: JSON.stringify({ ativo: !p.ativo }),
    });
    setProdutos(prev => prev.map(x => x.id === p.id ? { ...x, ativo: !x.ativo } : x));
  };

  const handleDeleteProduto = (p: Produto) => {
    Alert.alert("Excluir produto", `Deseja excluir "${p.nome}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir", style: "destructive",
        onPress: async () => {
          const headers = { Authorization: `Bearer ${auth.token}`, "x-empresa-id": String(auth.empresa?.id), "Content-Type": "application/json" };
          await fetch(`${API_BASE}/pdv/produtos/${p.id}`, { method: "DELETE", headers });
          setProdutos(prev => prev.filter(x => x.id !== p.id));
        },
      },
    ]);
  };

  // ── Promoção handlers ─────────────────────────────────────────────────────
  const openAddPromo = () => {
    setEditingPromo(null);
    setPNome(""); setPTipo("percentual"); setPValor(""); setPCodigo(""); setPMin("");
    setModalPromo(true);
  };

  const openEditPromo = (p: Promocao) => {
    setEditingPromo(p);
    setPNome(p.nome); setPTipo(p.tipo); setPValor(String(p.valor));
    setPCodigo(p.codigo_cupom ?? ""); setPMin(p.min_pedido ? String(p.min_pedido) : "");
    setModalPromo(true);
  };

  const handleSavePromo = async () => {
    if (!pNome.trim()) { Alert.alert("Atenção", "Nome é obrigatório"); return; }
    setSavingPromo(true);
    try {
      const headers = { Authorization: `Bearer ${auth.token}`, "x-empresa-id": String(auth.empresa?.id), "Content-Type": "application/json" };
      const body = { nome: pNome.trim(), tipo: pTipo, valor: parseFloat(pValor) || 0, codigo_cupom: pCodigo.trim().toUpperCase() || undefined, min_pedido: parseFloat(pMin) || 0 };
      if (editingPromo) {
        await fetch(`${API_BASE}/pdv/promocoes/${editingPromo.id}`, { method: "PATCH", headers, body: JSON.stringify(body) });
      } else {
        await fetch(`${API_BASE}/pdv/promocoes`, { method: "POST", headers, body: JSON.stringify(body) });
      }
      setModalPromo(false);
      fetchData();
    } catch {
      Alert.alert("Erro", "Não foi possível salvar a promoção.");
    } finally {
      setSavingPromo(false);
    }
  };

  const handleTogglePromo = async (p: Promocao) => {
    const headers = { Authorization: `Bearer ${auth.token}`, "x-empresa-id": String(auth.empresa?.id), "Content-Type": "application/json" };
    await fetch(`${API_BASE}/pdv/promocoes/${p.id}`, { method: "PATCH", headers, body: JSON.stringify({ ativo: !p.ativo }) });
    setPromocoes(prev => prev.map(x => x.id === p.id ? { ...x, ativo: !x.ativo } : x));
  };

  const handleDeletePromo = (p: Promocao) => {
    Alert.alert("Excluir promoção", `Deseja excluir "${p.nome}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir", style: "destructive",
        onPress: async () => {
          const headers = { Authorization: `Bearer ${auth.token}`, "x-empresa-id": String(auth.empresa?.id), "Content-Type": "application/json" };
          await fetch(`${API_BASE}/pdv/promocoes/${p.id}`, { method: "DELETE", headers });
          setPromocoes(prev => prev.filter(x => x.id !== p.id));
        },
      },
    ]);
  };

  const promoLabel = (p: Promocao) => {
    if (p.tipo === "frete_gratis") return "Frete Grátis";
    if (p.tipo === "percentual") return `${p.valor}% OFF`;
    return `R$ ${Number(p.valor).toFixed(2)} OFF`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitle}>
          <View style={[styles.headerIcon, { backgroundColor: MOD_COLOR + "20" }]}>
            <Feather name="shopping-bag" size={18} color={MOD_COLOR} />
          </View>
          <Text style={[styles.title, { color: colors.text, fontFamily: "Inter_700Bold" }]}>E-commerce</Text>
        </View>
        {activeTab === "produtos" && (
          <Pressable style={[styles.addBtn, { backgroundColor: MOD_COLOR }]} onPress={openAddProduto}>
            <Feather name="plus" size={20} color="#fff" />
          </Pressable>
        )}
        {activeTab === "promocoes" && (
          <Pressable style={[styles.addBtn, { backgroundColor: MOD_COLOR }]} onPress={openAddPromo}>
            <Feather name="plus" size={20} color="#fff" />
          </Pressable>
        )}
      </View>

      {/* Tabs */}
      <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
        {(["produtos", "promocoes", "pedidos"] as const).map(tab => (
          <Pressable key={tab} onPress={() => setActiveTab(tab)} style={[styles.tab, activeTab === tab && { borderBottomColor: MOD_COLOR, borderBottomWidth: 2 }]}>
            <Text style={[styles.tabText, { color: activeTab === tab ? MOD_COLOR : colors.textSecondary, fontFamily: activeTab === tab ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
              {tab === "produtos" ? "Produtos" : tab === "promocoes" ? "Promoções" : "Pedidos"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={MOD_COLOR} />
          <Text style={[styles.loadingText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Carregando...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 80 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MOD_COLOR} />}
        >
          {/* ── Produtos tab ──────────────────────────────────── */}
          {activeTab === "produtos" && (
            <>
              {produtos.length === 0 ? (
                <View style={styles.emptyState}>
                  <Feather name="box" size={40} color={colors.textMuted} />
                  <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Sem produtos</Text>
                  <Text style={[styles.emptySubtitle, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Adicione o primeiro produto</Text>
                  <Pressable style={[styles.emptyBtn, { backgroundColor: MOD_COLOR }]} onPress={openAddProduto}>
                    <Text style={[styles.emptyBtnText, { fontFamily: "Inter_600SemiBold" }]}>Adicionar produto</Text>
                  </Pressable>
                </View>
              ) : produtos.map(p => (
                <View key={p.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: p.ativo ? 1 : 0.55 }]}>
                  <View style={styles.cardRow}>
                    {/* Image */}
                    <View style={[styles.prodImageBox, { backgroundColor: colors.backgroundSecondary }]}>
                      {p.imagem ? (
                        <Image source={{ uri: p.imagem.startsWith("/") ? `${API_BASE.replace("/api", "")}${p.imagem}` : p.imagem }} style={styles.prodImage} />
                      ) : (
                        <Feather name="image" size={20} color={colors.textMuted} />
                      )}
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={[styles.cardTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{p.nome}</Text>
                      {p.categoria_nome && <Text style={[styles.cardSub, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>{p.categoria_nome}</Text>}
                      <Text style={[styles.preco, { color: MOD_COLOR, fontFamily: "Inter_700Bold" }]}>R$ {Number(p.preco).toFixed(2)}</Text>
                    </View>
                    <View style={styles.cardActions}>
                      <Pressable
                        style={[styles.statusBadge, { backgroundColor: p.ativo ? "#10B98120" : "#EF444420" }]}
                        onPress={() => handleToggleProduto(p)}
                      >
                        <Text style={[styles.statusText, { color: p.ativo ? "#10B981" : "#EF4444", fontFamily: "Inter_600SemiBold" }]}>
                          {p.ativo ? "Ativo" : "Inativo"}
                        </Text>
                      </Pressable>
                      <View style={styles.iconRow}>
                        <Pressable style={styles.iconBtn} onPress={() => openEditProduto(p)}>
                          <Feather name="edit-2" size={15} color={MOD_COLOR} />
                        </Pressable>
                        <Pressable style={styles.iconBtn} onPress={() => handleDeleteProduto(p)}>
                          <Feather name="trash-2" size={15} color="#EF4444" />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* ── Promoções tab ─────────────────────────────────── */}
          {activeTab === "promocoes" && (
            <>
              {promocoes.length === 0 ? (
                <View style={styles.emptyState}>
                  <Feather name="tag" size={40} color={colors.textMuted} />
                  <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Sem promoções</Text>
                  <Text style={[styles.emptySubtitle, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Crie a primeira promoção ou desconto</Text>
                  <Pressable style={[styles.emptyBtn, { backgroundColor: MOD_COLOR }]} onPress={openAddPromo}>
                    <Text style={[styles.emptyBtnText, { fontFamily: "Inter_600SemiBold" }]}>Criar promoção</Text>
                  </Pressable>
                </View>
              ) : promocoes.map(p => (
                <View key={p.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: p.ativo ? 1 : 0.5 }]}>
                  <View style={styles.cardRow}>
                    <View style={[styles.headerIcon, { backgroundColor: MOD_COLOR + "20" }]}>
                      <Feather name="tag" size={16} color={MOD_COLOR} />
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={[styles.cardTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{p.nome}</Text>
                      <View style={styles.promoRow}>
                        <View style={[styles.promoBadge, { backgroundColor: MOD_COLOR + "20" }]}>
                          <Text style={[styles.promoText, { color: MOD_COLOR, fontFamily: "Inter_700Bold" }]}>{promoLabel(p)}</Text>
                        </View>
                        {p.codigo_cupom && (
                          <View style={[styles.promoBadge, { backgroundColor: colors.backgroundSecondary }]}>
                            <Text style={[styles.promoText, { color: colors.textMuted, fontFamily: "Inter_500Medium" }]}>{p.codigo_cupom}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={styles.cardActions}>
                      <Pressable
                        style={[styles.statusBadge, { backgroundColor: p.ativo ? "#10B98120" : "#EF444420" }]}
                        onPress={() => handleTogglePromo(p)}
                      >
                        <Text style={[styles.statusText, { color: p.ativo ? "#10B981" : "#EF4444", fontFamily: "Inter_600SemiBold" }]}>
                          {p.ativo ? "Ativa" : "Inativa"}
                        </Text>
                      </Pressable>
                      <View style={styles.iconRow}>
                        <Pressable style={styles.iconBtn} onPress={() => openEditPromo(p)}>
                          <Feather name="edit-2" size={15} color={MOD_COLOR} />
                        </Pressable>
                        <Pressable style={styles.iconBtn} onPress={() => handleDeletePromo(p)}>
                          <Feather name="trash-2" size={15} color="#EF4444" />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* ── Pedidos tab ───────────────────────────────────── */}
          {activeTab === "pedidos" && (
            <View style={styles.emptyState}>
              <Feather name="shopping-cart" size={40} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>Pedidos</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>Os pedidos da loja aparecem aqui</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Modal: Produto ─────────────────────────────────────────────────── */}
      <Modal visible={modalProduto} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
                {editingProduto ? "Editar Produto" : "Novo Produto"}
              </Text>
              <Pressable onPress={() => setModalProduto(false)}>
                <Feather name="x" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            {/* Image picker */}
            <Pressable style={[styles.imagePicker, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]} onPress={pickImage}>
              {fImageUri ? (
                <Image
                  source={{ uri: fImageUri.startsWith("/") ? `${API_BASE.replace("/api", "")}${fImageUri}` : fImageUri }}
                  style={styles.imagePickerImg}
                />
              ) : (
                <View style={styles.imagePickerPlaceholder}>
                  <Feather name="camera" size={24} color={colors.textMuted} />
                  <Text style={[styles.imagePickerText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>
                    Adicionar imagem
                  </Text>
                </View>
              )}
              {fImageUri && (
                <View style={styles.imagePickerOverlay}>
                  <Feather name="camera" size={20} color="#fff" />
                </View>
              )}
            </Pressable>

            {[
              { p: "Nome do produto *", v: fNome, s: setFNome },
              { p: "Descrição (opcional)", v: fDescricao, s: setFDescricao },
              { p: "Preço (R$)", v: fPreco, s: setFPreco, k: "decimal-pad" as const },
            ].map(f => (
              <View key={f.p} style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
                <TextInput
                  style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]}
                  placeholder={f.p}
                  placeholderTextColor={colors.textMuted}
                  value={f.v}
                  onChangeText={f.s}
                  keyboardType={(f as any).k || "default"}
                />
              </View>
            ))}

            <Pressable style={[styles.saveBtn, { backgroundColor: MOD_COLOR }]} onPress={handleSaveProduto} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : (
                <Text style={[styles.saveBtnText, { fontFamily: "Inter_600SemiBold" }]}>
                  {editingProduto ? "Salvar alterações" : "Adicionar produto"}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── Modal: Promoção ────────────────────────────────────────────────── */}
      <Modal visible={modalPromo} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
                {editingPromo ? "Editar Promoção" : "Nova Promoção"}
              </Text>
              <Pressable onPress={() => setModalPromo(false)}>
                <Feather name="x" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
              <TextInput style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]} placeholder="Nome da promoção *" placeholderTextColor={colors.textMuted} value={pNome} onChangeText={setPNome} />
            </View>

            {/* Tipo selector */}
            <View style={styles.tipoRow}>
              {(["percentual", "valor", "frete_gratis"] as const).map(t => (
                <Pressable
                  key={t}
                  style={[styles.tipoBtn, { borderColor: pTipo === t ? MOD_COLOR : colors.border, backgroundColor: pTipo === t ? MOD_COLOR + "15" : colors.backgroundSecondary }]}
                  onPress={() => setPTipo(t)}
                >
                  <Text style={[styles.tipoText, { color: pTipo === t ? MOD_COLOR : colors.textMuted, fontFamily: pTipo === t ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
                    {t === "percentual" ? "% DESC" : t === "valor" ? "R$ DESC" : "FRETE 🆓"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {pTipo !== "frete_gratis" && (
              <View style={[styles.inputGroup, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
                <TextInput style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]} placeholder={pTipo === "percentual" ? "Percentual (ex: 15)" : "Valor (ex: 10.00)"} placeholderTextColor={colors.textMuted} value={pValor} onChangeText={setPValor} keyboardType="decimal-pad" />
              </View>
            )}

            <View style={styles.rowInputs}>
              <View style={[styles.inputGroup, { flex: 1, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
                <TextInput style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]} placeholder="Cupom (opcional)" placeholderTextColor={colors.textMuted} value={pCodigo} onChangeText={t => setPCodigo(t.toUpperCase())} autoCapitalize="characters" />
              </View>
              <View style={[styles.inputGroup, { flex: 1, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
                <TextInput style={[styles.input, { color: colors.text, fontFamily: "Inter_400Regular" }]} placeholder="Mín. R$" placeholderTextColor={colors.textMuted} value={pMin} onChangeText={setPMin} keyboardType="decimal-pad" />
              </View>
            </View>

            <Pressable style={[styles.saveBtn, { backgroundColor: MOD_COLOR }]} onPress={handleSavePromo} disabled={savingPromo}>
              {savingPromo ? <ActivityIndicator color="#fff" /> : (
                <Text style={[styles.saveBtnText, { fontFamily: "Inter_600SemiBold" }]}>
                  {editingPromo ? "Salvar" : "Criar promoção"}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20 },
  addBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  tabRow: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabText: { fontSize: 14 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, marginTop: 8 },
  card: { borderRadius: 14, borderWidth: 1, marginBottom: 12, overflow: "hidden", padding: 14 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  prodImageBox: { width: 52, height: 52, borderRadius: 10, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  prodImage: { width: 52, height: 52, borderRadius: 10 },
  cardInfo: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 15 },
  cardSub: { fontSize: 12 },
  preco: { fontSize: 15, marginTop: 2 },
  precoOld: { fontSize: 12, textDecorationLine: "line-through" },
  cardActions: { alignItems: "flex-end", gap: 6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11 },
  iconRow: { flexDirection: "row", gap: 4 },
  iconBtn: { padding: 6 },
  promoRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4 },
  promoBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  promoText: { fontSize: 11 },
  emptyState: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 18, marginTop: 8 },
  emptySubtitle: { fontSize: 14, textAlign: "center" },
  emptyBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { color: "#fff", fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, gap: 12 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  modalTitle: { fontSize: 20 },
  imagePicker: { borderWidth: 1, borderStyle: "dashed", borderRadius: 12, height: 100, alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" },
  imagePickerImg: { width: "100%", height: "100%", borderRadius: 12 },
  imagePickerPlaceholder: { alignItems: "center", gap: 6 },
  imagePickerText: { fontSize: 13 },
  imagePickerOverlay: { position: "absolute", bottom: 8, right: 8, backgroundColor: "rgba(0,0,0,0.5)", width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  inputGroup: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, height: 48, gap: 10 },
  input: { flex: 1, fontSize: 15 },
  saveBtn: { height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 4 },
  saveBtnText: { color: "#fff", fontSize: 16 },
  tipoRow: { flexDirection: "row", gap: 8 },
  tipoBtn: { flex: 1, height: 40, borderWidth: 1.5, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tipoText: { fontSize: 11 },
  rowInputs: { flexDirection: "row", gap: 10 },
});
