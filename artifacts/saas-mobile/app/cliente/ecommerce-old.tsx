import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, useColorScheme, Platform, Alert, ActivityIndicator, Image } from "react-native";
import SegmentoBottomNav, { SEGMENTO_NAV_HEIGHT } from "@/components/SegmentoBottomNav";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import Colors from "@/constants/colors";
import { useCart } from "@/context/CartContext";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { useAuthGate } from "@/components/AuthGate";

const MOD_COLOR = Colors.modules.ecommerce;

const PAG_META: Record<string, { label: string; emoji: string }> = {
  pix:      { label: "Pix",                emoji: "⚡" },
  dinheiro: { label: "Dinheiro",           emoji: "💵" },
  credito:  { label: "Cartão de Crédito",  emoji: "💳" },
  debito:   { label: "Cartão de Débito",   emoji: "💳" },
  vr:       { label: "Vale-Refeição",      emoji: "🍽️" },
  sodexo:   { label: "Sodexo",             emoji: "🎫" },
};

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "http://localhost:8080/api";

const getImgUrl = (imagem?: string | null) => {
  if (!imagem) return null;
  if (imagem.startsWith("http")) return imagem;
  const domain = process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : "";
  return `${domain}${imagem}`;
};

function ProductImage({ uri, style, fallbackIcon = "box", fallbackColor = "#888" }: {
  uri: string | null; style: any; fallbackIcon?: string; fallbackColor?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) return <Feather name={fallbackIcon as any} size={24} color={fallbackColor} />;
  return <Image source={{ uri }} style={style} resizeMode="cover" onError={() => setFailed(true)} />;
}

type ProdutoDB = {
  id: number; nome: string; descricao?: string; preco: number;
  preco_promocional?: number; categoria?: string; imagem?: string; estoque: number;
};

export default function ClienteEcommerce() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const [categoriaSel, setCategoriaSel] = useState("Todos");
  const [showCarrinho, setShowCarrinho] = useState(false);
  const [pedidoFeito, setPedidoFeito] = useState(false);
  const [produtosDB, setProdutosDB] = useState<ProdutoDB[]>([]);
  const [loadingProdutos, setLoadingProdutos] = useState(true);
  const [enviandoPedido, setEnviandoPedido] = useState(false);
  const [metodosPag, setMetodosPag] = useState<string[]>(["pix", "dinheiro", "credito", "debito"]);
  const [formaSel, setFormaSel] = useState<string | null>(null);

  const params = useLocalSearchParams<{ empresaId?: string; nomeEmpresa?: string; corEmpresa?: string }>();
  const empresaId = Number(params.empresaId ?? 0);
  const nomeEmpresa = params.nomeEmpresa ?? "Loja Online";
  const corEmpresa = params.corEmpresa ?? MOD_COLOR;

  const { customer } = useCustomerAuth();
  const { requireAuth } = useAuthGate("/cliente/ecommerce");
  const { items, vendor, totalQtd, totalPreco, addItem, removeItem, updateQtd, clearCart } = useCart();

  useEffect(() => {
    if (!empresaId) { setLoadingProdutos(false); return; }
    setLoadingProdutos(true);
    fetch(`${API_BASE}/public/ecommerce/${empresaId}/produtos`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setProdutosDB(data); })
      .catch(() => {})
      .finally(() => setLoadingProdutos(false));
    fetch(`${API_BASE}/public/servicos/${empresaId}/formas-pagamento`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data?.metodos) && data.metodos.length) setMetodosPag(data.metodos); })
      .catch(() => {});
  }, [empresaId]);

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  const categorias = ["Todos", ...Array.from(new Set(produtosDB.map(p => p.categoria).filter(Boolean) as string[]))];
  const produtosFiltrados = categoriaSel === "Todos" ? produtosDB : produtosDB.filter(p => p.categoria === categoriaSel);

  const myItems = vendor?.id === empresaId ? items : [];
  const myQtd = myItems.reduce((s, c) => s + c.qtd, 0);
  const myTotal = myItems.reduce((s, c) => s + c.produto.preco * c.qtd, 0);

  const vendor_info = { id: empresaId, nome: nomeEmpresa, cor: corEmpresa, modulo: "ecommerce" };

  const handleAddCarrinho = (produto: ProdutoDB) => {
    addItem(
      { id: produto.id, nome: produto.nome, preco: Number(produto.preco_promocional || produto.preco), cor: MOD_COLOR },
      vendor_info
    );
  };

  const handleFinalizar = async () => {
    if (enviandoPedido) return;
    if (!formaSel) {
      Alert.alert("Forma de pagamento", "Selecione uma forma de pagamento para continuar.");
      return;
    }
    setEnviandoPedido(true);
    try {
      const body = {
        empresa_id: empresaId,
        itens: myItems.map(c => ({ nome: c.produto.nome, quantidade: c.qtd, preco: c.produto.preco })),
        total: myTotal,
        cliente_nome: customer?.nome || "Cliente App",
        cliente_telefone: customer?.whatsapp || "",
        cliente_endereco: "",
        forma_pagamento: formaSel,
      };
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (customer?.token) headers["Authorization"] = `Bearer ${customer.token}`;
      const res = await fetch(`${API_BASE}/public/ecommerce/pedido`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Erro ao finalizar");
      clearCart();
      setFormaSel(null);
      setShowCarrinho(false);
      setPedidoFeito(true);
      setTimeout(() => setPedidoFeito(false), 4000);
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível finalizar o pedido. Tente novamente.");
    } finally {
      setEnviandoPedido(false);
    }
  };

  if (pedidoFeito) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <View style={[styles.sucessoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.checkCircle, { backgroundColor: MOD_COLOR }]}>
            <Feather name="check" size={32} color="#fff" />
          </View>
          <Text style={[styles.sucessoTitulo, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Pedido confirmado!</Text>
          <Text style={[styles.sucessoSub, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Você receberá atualizações sobre seu pedido por e-mail</Text>
        </View>
      </View>
    );
  }

  if (showCarrinho) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: corEmpresa }]}>
          <Pressable onPress={() => setShowCarrinho(false)} style={styles.backBtn}><Feather name="arrow-left" size={22} color="#fff" /></Pressable>
          <Text style={[styles.headerTitle, { fontFamily: "Inter_700Bold", color: "#fff" }]}>Meu Carrinho ({myQtd})</Text>
          <View style={{ width: 30 }} />
        </View>

        {vendor && vendor.id !== empresaId && (
          <View style={[styles.vendorWarning, { backgroundColor: "#FEF3C7" }]}>
            <Feather name="alert-triangle" size={14} color="#F59E0B" />
            <Text style={[styles.vendorWarningText, { color: "#92400E" }]}>
              Você tem itens de "{vendor.nome}" no carrinho. Adicione itens desta loja para substituir.
            </Text>
          </View>
        )}

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + SEGMENTO_NAV_HEIGHT + 16 }}>
          {myItems.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 48, gap: 12 }}>
              <Feather name="shopping-cart" size={48} color={colors.textMuted} />
              <Text style={[{ color: colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 14 }]}>Carrinho vazio para esta loja</Text>
            </View>
          ) : (
            myItems.map(c => (
              <View key={c.produto.id} style={[styles.carrinhoItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.carrinhoImagem, { backgroundColor: (c.produto.cor ?? MOD_COLOR) + "20" }]}>
                  <ProductImage uri={getImgUrl(c.produto.imagem)} style={styles.carrinhoImagemImg} fallbackIcon="box" fallbackColor={c.produto.cor ?? MOD_COLOR} />
                </View>
                <View style={styles.carrinhoInfo}>
                  <Text style={[styles.carrinhoNome, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{c.produto.nome}</Text>
                  <Text style={[styles.carrinhoPreco, { color: corEmpresa, fontFamily: "Inter_700Bold" }]}>R$ {c.produto.preco.toFixed(2)}</Text>
                </View>
                <View style={styles.qtdControls}>
                  <Pressable onPress={() => updateQtd(c.produto.id, -1)}
                    style={[styles.qtdBtn, { backgroundColor: colors.backgroundSecondary }]}>
                    <Feather name="minus" size={14} color={colors.text} />
                  </Pressable>
                  <Text style={[styles.qtdNum, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{c.qtd}</Text>
                  <Pressable onPress={() => updateQtd(c.produto.id, 1)} style={[styles.qtdBtn, { backgroundColor: corEmpresa }]}>
                    <Feather name="plus" size={14} color="#fff" />
                  </Pressable>
                </View>
              </View>
            ))
          )}
          {myItems.length > 0 && (
            <View style={[styles.totalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Subtotal</Text>
                <Text style={[styles.totalValue, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>R$ {myTotal.toFixed(2)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>Frete</Text>
                <Text style={[styles.totalValue, { color: "#10B981", fontFamily: "Inter_600SemiBold" }]}>Grátis</Text>
              </View>
              <View style={[styles.totalDivider, { backgroundColor: colors.border }]} />
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.text, fontFamily: "Inter_700Bold", fontSize: 16 }]}>Total</Text>
                <Text style={[styles.totalValue, { color: corEmpresa, fontFamily: "Inter_700Bold", fontSize: 20 }]}>R$ {myTotal.toFixed(2)}</Text>
              </View>
            </View>
          )}
          {myItems.length > 0 && (
            <View style={{ marginTop: 16, gap: 10 }}>
              <Text style={{ color: colors.text, fontFamily: "Inter_700Bold", fontSize: 15 }}>Forma de pagamento</Text>
              {metodosPag.length === 0 ? (
                <Text style={{ color: colors.textMuted, fontSize: 13, fontFamily: "Inter_400Regular" }}>
                  Esta loja ainda não configurou formas de pagamento.
                </Text>
              ) : (
                metodosPag.map(m => {
                  const meta = PAG_META[m] ?? { label: m, emoji: "💰" };
                  const sel = formaSel === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => setFormaSel(m)}
                      style={{
                        flexDirection: "row", alignItems: "center", gap: 12,
                        padding: 14, borderRadius: 12, borderWidth: 2,
                        borderColor: sel ? corEmpresa : colors.border,
                        backgroundColor: sel ? corEmpresa + "15" : colors.card,
                      }}>
                      <Text style={{ fontSize: 22 }}>{meta.emoji}</Text>
                      <Text style={{ flex: 1, color: colors.text, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{meta.label}</Text>
                      {sel && <Feather name="check-circle" size={20} color={corEmpresa} />}
                    </Pressable>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>
        <SegmentoBottomNav
          ativo="carrinho"
          corAtivo={corEmpresa}
          qtdCarrinho={myQtd}
          onInicio={() => setShowCarrinho(false)}
          onCarrinho={() => {}}
          onFinalizar={myItems.length > 0 ? () => requireAuth(() => handleFinalizar()) : undefined}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: corEmpresa }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Feather name="arrow-left" size={22} color="#fff" /></Pressable>
        <Text style={[styles.headerTitle, { fontFamily: "Inter_700Bold", color: "#fff" }]} numberOfLines={1}>{nomeEmpresa}</Text>
        <Pressable onPress={() => setShowCarrinho(true)} style={styles.cartContainer}>
          <Feather name="shopping-cart" size={20} color="#fff" />
          {totalQtd > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{totalQtd}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {vendor && vendor.id !== empresaId && totalQtd > 0 && (
        <View style={[styles.vendorWarning, { backgroundColor: "#FEF3C7" }]}>
          <Feather name="alert-triangle" size={14} color="#F59E0B" />
          <Text style={[styles.vendorWarningText, { color: "#92400E" }]} numberOfLines={2}>
            Você tem {totalQtd} item(s) de "{vendor.nome}". Adicionar aqui irá perguntar se quer trocar.
          </Text>
        </View>
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + SEGMENTO_NAV_HEIGHT + 16 }} showsVerticalScrollIndicator={false}>
        {categorias.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, height: 56 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: "center" }}>
            {categorias.map(cat => (
              <Pressable key={cat} onPress={() => setCategoriaSel(cat)}
                style={[styles.catChip, { backgroundColor: categoriaSel === cat ? corEmpresa : colors.backgroundSecondary, borderColor: categoriaSel === cat ? corEmpresa : colors.textMuted }]}>
                <Text style={[styles.catText, { color: categoriaSel === cat ? "#fff" : colors.text, fontFamily: "Inter_600SemiBold" }]}>{cat}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {loadingProdutos ? (
          <View style={{ paddingVertical: 60, alignItems: "center" }}>
            <ActivityIndicator size="large" color={corEmpresa} />
            <Text style={[{ color: colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 12 }]}>Carregando produtos...</Text>
          </View>
        ) : produtosFiltrados.length === 0 ? (
          <View style={{ paddingVertical: 60, alignItems: "center", gap: 10 }}>
            <Feather name="shopping-bag" size={48} color={colors.textMuted} />
            <Text style={[{ color: colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 14 }]}>Nenhum produto cadastrado ainda</Text>
          </View>
        ) : (
          <View style={styles.produtosGrid}>
            {produtosFiltrados.map(p => {
              const precoFinal = Number(p.preco_promocional || p.preco);
              const precoOriginal = p.preco_promocional ? Number(p.preco) : null;
              const desconto = precoOriginal ? Math.round((1 - precoFinal / precoOriginal) * 100) : null;
              return (
                <View key={p.id} style={[styles.produtoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.produtoImagem, { backgroundColor: corEmpresa + "20" }]}>
                    <ProductImage uri={getImgUrl(p.imagem)} style={styles.produtoImagemImg} fallbackIcon="box" fallbackColor={corEmpresa} />
                    {desconto && (
                      <View style={[styles.descontoTag, { backgroundColor: "#EF4444" }]}>
                        <Text style={styles.descontoText}>-{desconto}%</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.produtoInfo}>
                    <Text style={[styles.produtoNome, { color: colors.text, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>{p.nome}</Text>
                    {p.categoria ? (
                      <Text style={[styles.avaliacaoText, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>{p.categoria}</Text>
                    ) : null}
                    {precoOriginal && (
                      <Text style={[styles.precoAnt, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]}>R$ {precoOriginal.toFixed(2)}</Text>
                    )}
                    <Text style={[styles.preco, { color: corEmpresa, fontFamily: "Inter_700Bold" }]}>R$ {precoFinal.toFixed(2)}</Text>
                    <Pressable onPress={() => handleAddCarrinho(p)} style={[styles.addBtn, { backgroundColor: corEmpresa }]}>
                      <Feather name="shopping-cart" size={14} color="#fff" />
                      <Text style={[styles.addBtnText, { fontFamily: "Inter_600SemiBold", color: "#fff" }]}>Adicionar</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
      <SegmentoBottomNav
        ativo="inicio"
        corAtivo={corEmpresa}
        qtdCarrinho={totalQtd}
        onInicio={() => {}}
        onCarrinho={() => setShowCarrinho(true)}
        onFinalizar={() => { if (myQtd > 0) setShowCarrinho(true); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 16, justifyContent: "space-between" },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, flex: 1, textAlign: "center" },
  cartContainer: { position: "relative", padding: 4 },
  cartBadge: { position: "absolute", top: 0, right: 0, backgroundColor: "#F59E0B", borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center" },
  cartBadgeText: { fontSize: 10, color: "#fff", fontFamily: "Inter_700Bold" },
  vendorWarning: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  vendorWarningText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  catChip: { height: 36, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1.5, alignItems: "center", justifyContent: "center", flexShrink: 0, alignSelf: "center" },
  catText: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  produtosGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 10 },
  produtoCard: { width: "47%", borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  produtoImagem: { height: 110, alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" },
  produtoImagemImg: { width: "100%", height: 110, position: "absolute", top: 0, left: 0 },
  descontoTag: { position: "absolute", top: 8, right: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  descontoText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  produtoInfo: { padding: 10, gap: 4 },
  produtoNome: { fontSize: 13 },
  avaliacaoRow: { flexDirection: "row", alignItems: "center" },
  avaliacaoText: { fontSize: 11 },
  precoAnt: { fontSize: 11, textDecorationLine: "line-through" },
  preco: { fontSize: 16 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 34, borderRadius: 8, marginTop: 4 },
  addBtnText: { fontSize: 12 },
  carrinhoItem: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 10, gap: 12 },
  carrinhoImagem: { width: 50, height: 50, borderRadius: 10, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  carrinhoImagemImg: { width: 50, height: 50, borderRadius: 10 },
  carrinhoInfo: { flex: 1 },
  carrinhoNome: { fontSize: 14, marginBottom: 4 },
  carrinhoPreco: { fontSize: 16 },
  qtdControls: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtdBtn: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  qtdNum: { fontSize: 16, minWidth: 20, textAlign: "center" },
  totalCard: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 12, marginTop: 8 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 14 },
  totalValue: { fontSize: 14 },
  totalDivider: { height: 1 },
  sucessoCard: { borderRadius: 20, borderWidth: 1, padding: 32, alignItems: "center", marginHorizontal: 32, gap: 12 },
  checkCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  sucessoTitulo: { fontSize: 22 },
  sucessoSub: { fontSize: 14, textAlign: "center", lineHeight: 22 },
});
