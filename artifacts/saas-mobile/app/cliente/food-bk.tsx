import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  useColorScheme, Platform, ActivityIndicator, Alert, Image, Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import Colors from "@/constants/colors";
import { useAuthGate } from "@/components/AuthGate";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import SegmentoBottomNav, { SEGMENTO_NAV_HEIGHT } from "@/components/SegmentoBottomNav";

const FP_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  pix:              { label: "Pix",                icon: "zap",          color: "#22C55E" },
  dinheiro:         { label: "Dinheiro",           icon: "dollar-sign",  color: "#F59E0B" },
  credito:          { label: "Cartão de Crédito",  icon: "credit-card",  color: "#3B82F6" },
  debito:           { label: "Cartão de Débito",   icon: "credit-card",  color: "#8B5CF6" },
  vr:               { label: "Vale Refeição / VR", icon: "gift",         color: "#F97316" },
  sodexo:           { label: "Sodexo / Alelo",     icon: "star",         color: "#EF4444" },
  credito_gotaxi:   { label: "Crédito GoTaxi",     icon: "award",        color: "#7C3AED" },
};

const MOD_COLOR = Colors.modules.food;
const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

const getImgUrl = (imagem?: string | null) => {
  if (!imagem) return null;
  if (imagem.startsWith("http")) return imagem;
  const domain = process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : "";
  return `${domain}${imagem}`;
};

function ProductImage({ uri, style, fallbackIcon = "coffee", fallbackColor = "#888" }: {
  uri: string | null; style: any; fallbackIcon?: string; fallbackColor?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) return <Feather name={fallbackIcon as any} size={24} color={fallbackColor} />;
  return <Image source={{ uri }} style={style} resizeMode="cover" onError={() => setFailed(true)} />;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Parceiro = {
  id: number;
  nome: string;
  cor: string | null;
  total_produtos: number;
};

type Categoria = { id: number; nome: string; ordem: number };
type Extra = { id: number; nome: string; preco: number };
type Tamanho = { nome: string; preco: number };
type Produto = {
  id: number; nome: string; descricao?: string; preco: number;
  imagem?: string; categoria_id?: number; categoria_nome?: string;
  extras: Extra[];
  tamanhos?: Tamanho[] | null;
};

type Cardapio = { categorias: Categoria[]; produtos: Produto[]; formasPagamento: string[] };
type CartItem = { uid: string; produto: Produto; qtd: number; extrasSel: Extra[]; tamanhoSel: Tamanho | null; precoUnitario: number };

const makeUid = (produtoId: number, tamanhoNome: string, extraIds: number[]) =>
  `${produtoId}_t:${tamanhoNome}_${[...extraIds].sort((a, b) => a - b).join("_")}`;

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ClienteFood() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const { requireAuth } = useAuthGate("/cliente/food");
  const { customer } = useCustomerAuth();
  const fp = customer?.formaPagamento ? FP_LABELS[customer.formaPagamento] : null;

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  // ── List screen state ──────────────────────────────────────────────────────
  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [loadingParceiros, setLoadingParceiros] = useState(true);

  // ── Detail screen state ────────────────────────────────────────────────────
  const [parceiroSel, setParceiroSel] = useState<Parceiro | null>(null);
  const [cardapio, setCardapio] = useState<Cardapio | null>(null);
  const [loadingCardapio, setLoadingCardapio] = useState(false);
  const [categoriaSel, setCategoriaSel] = useState<number | null>(null);

  // ── Credit balance ──────────────────────────────────────────────────────────
  const [creditoDisponivel, setCreditoDisponivel] = useState(0);

  useEffect(() => {
    if (!customer?.token) return;
    fetch(`${API_BASE}/cliente/afiliados/credito`, {
      headers: { Authorization: `Bearer ${customer.token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.saldo > 0) setCreditoDisponivel(Number(d.saldo)); })
      .catch(() => {});
  }, [customer?.token]);

  // ── Cart ────────────────────────────────────────────────────────────────────
  const [carrinho, setCarrinho] = useState<CartItem[]>([]);
  const [showCarrinho, setShowCarrinho] = useState(false);
  const [pedidoFeito, setPedidoFeito] = useState(false);
  const [enviandoPedido, setEnviandoPedido] = useState(false);
  const [formaEscolhida, setFormaEscolhida] = useState<string | null>(null);
  const [formasPagamento, setFormasPagamento] = useState<string[]>([]);
  const [modalProduto, setModalProduto] = useState<Produto | null>(null);

  const totalCarrinho = carrinho.reduce((s, c) => s + c.precoUnitario * c.qtd, 0);
  const qtdCarrinho = carrinho.reduce((s, c) => s + c.qtd, 0);

  // ── Fetch partners ──────────────────────────────────────────────────────────
  const { empresaId: empresaIdParam, produtoId: produtoIdParam } = useLocalSearchParams<{ empresaId?: string; produtoId?: string }>();

  useEffect(() => {
    fetch(`${API_BASE}/food/parceiros`)
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d) ? d : [];
        setParceiros(list);
        setLoadingParceiros(false);
        // Auto-select partner if empresaId was passed via deeplink/navigation
        if (empresaIdParam) {
          const target = list.find((p: Parceiro) => String(p.id) === String(empresaIdParam));
          if (target) {
            handleSelectParceiro(target);
          } else {
            // Empresa não está na lista (sem produtos) — abre mesmo assim como parceiro avulso
            handleSelectParceiro({
              id: Number(empresaIdParam),
              nome: "Restaurante",
              cor: null,
              total_produtos: 0,
            } as Parceiro);
          }
        }
      })
      .catch(() => setLoadingParceiros(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaIdParam]);

  // ── Fetch catalog when a partner is selected ────────────────────────────────
  const handleSelectParceiro = async (p: Parceiro) => {
    setParceiroSel(p);
    setCarrinho([]);
    setCategoriaSel(null);
    setCardapio(null);
    setFormaEscolhida(null);
    setFormasPagamento([]);
    setLoadingCardapio(true);
    try {
      const res = await fetch(`${API_BASE}/food/parceiros/${p.id}/cardapio`);
      const data = await res.json();
      setCardapio(data);
      const base = Array.isArray(data.formasPagamento) && data.formasPagamento.length > 0
        ? data.formasPagamento
        : ["pix", "dinheiro", "credito", "debito"];
      // Inject GoTaxi credit option if user has balance
      const withCredito = creditoDisponivel > 0 && !base.includes("credito_gotaxi")
        ? [...base, "credito_gotaxi"]
        : base;
      setFormasPagamento(withCredito);
    } catch {
      setCardapio({ categorias: [], produtos: [], formasPagamento: [] });
      const base = ["pix", "dinheiro", "credito", "debito"];
      const withCredito = creditoDisponivel > 0 ? [...base, "credito_gotaxi"] : base;
      setFormasPagamento(withCredito);
    }
    setLoadingCardapio(false);
  };

  // ── Auto-open product modal when arriving via promo (produtoId param) ───────
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current) return;
    if (!produtoIdParam || !cardapio?.produtos?.length) return;
    const target = cardapio.produtos.find(p => String(p.id) === String(produtoIdParam));
    if (target) {
      setModalProduto(target);
      autoOpenedRef.current = true;
    }
  }, [produtoIdParam, cardapio]);

  // ── Cart helpers ────────────────────────────────────────────────────────────
  const addToCart = (produto: Produto, tamanhoSel: Tamanho | null, extrasSel: Extra[], qtdAdded: number) => {
    const uid = makeUid(produto.id, tamanhoSel?.nome ?? "", extrasSel.map(e => e.id));
    const basePreco = tamanhoSel ? Number(tamanhoSel.preco) : Number(produto.preco);
    const precoUnitario = basePreco + extrasSel.reduce((s, e) => s + Number(e.preco), 0);
    setCarrinho(prev => {
      const ex = prev.find(c => c.uid === uid);
      if (ex) return prev.map(c => c.uid === uid ? { ...c, qtd: c.qtd + qtdAdded } : c);
      return [...prev, { uid, produto, qtd: qtdAdded, extrasSel, tamanhoSel, precoUnitario }];
    });
  };

  const removeItem = (uid: string) => {
    setCarrinho(prev => prev.map(c => c.uid === uid ? { ...c, qtd: c.qtd - 1 } : c).filter(c => c.qtd > 0));
  };

  const getQtd = (produtoId: number) =>
    carrinho.filter(c => c.produto.id === produtoId).reduce((s, c) => s + c.qtd, 0);

  const handlePedido = async () => {
    if (!formaEscolhida || !parceiroSel) return;
    setEnviandoPedido(true);
    try {
      const taxaEntrega = Number((parceiroSel as any).taxa_entrega ?? 0);
      const totalPedido = totalCarrinho + taxaEntrega;

      if (formaEscolhida === "credito_gotaxi" && creditoDisponivel < totalPedido) {
        Alert.alert(
          "Crédito insuficiente",
          `Seu saldo GoTaxi é R$ ${creditoDisponivel.toFixed(2)}. O pedido custa R$ ${totalPedido.toFixed(2)}.`
        );
        setEnviandoPedido(false);
        return;
      }

      const itens = carrinho.map(c => ({
        nome: c.produto.nome + (c.extrasSel.length > 0 ? ` + ${c.extrasSel.map(e => e.nome).join(", ")}` : ""),
        quantidade: c.qtd,
        preco_unitario: c.precoUnitario,
        total: c.precoUnitario * c.qtd,
      }));

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (customer?.token) headers["Authorization"] = `Bearer ${customer.token}`;

      const r = await fetch(`${API_BASE}/food/pedido`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          empresa_id: parceiroSel.id,
          itens,
          total: totalPedido,
          forma_pagamento: formaEscolhida,
          cliente_nome: customer?.nome ?? "Cliente App",
          cliente_whatsapp: customer?.whatsapp ?? "",
          cliente_endereco: (customer as any)?.endereco ?? "",
          taxa_entrega: taxaEntrega,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        Alert.alert("Erro ao enviar pedido", err.message || "Tente novamente.");
        return;
      }
      if (formaEscolhida === "credito_gotaxi") {
        setCreditoDisponivel(prev => Math.max(0, prev - totalPedido));
      }
      setPedidoFeito(true);
      setCarrinho([]);
      setTimeout(() => {
        setPedidoFeito(false);
        setParceiroSel(null);
        setCardapio(null);
        setFormaEscolhida(null);
      }, 3500);
    } catch {
      Alert.alert("Falha de conexão", "Verifique sua internet e tente novamente.");
    } finally {
      setEnviandoPedido(false);
    }
  };

  const accentColor = parceiroSel?.cor || MOD_COLOR;

  // ── Success screen ──────────────────────────────────────────────────────────
  if (pedidoFeito) {
    const fpSel = formaEscolhida ? FP_LABELS[formaEscolhida] : (fp ?? null);
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <View style={[styles.sucessoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.checkCircle, { backgroundColor: "#10B981" }]}>
            <Feather name="check" size={32} color="#fff" />
          </View>
          <Text style={[styles.sucessoTitulo, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Pedido realizado!</Text>
          <Text style={[styles.sucessoSub, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
            Seu pedido foi enviado para o restaurante. Aguarde a confirmação.
          </Text>
          {fpSel && (
            <View style={[styles.fpTag, { backgroundColor: fpSel.color + "18", borderColor: fpSel.color + "40" }]}>
              <Feather name={fpSel.icon as any} size={14} color={fpSel.color} />
              <Text style={[styles.fpTagText, { color: fpSel.color, fontFamily: "Inter_600SemiBold" }]}>
                Pagamento: {fpSel.label}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // ── Detail screen (catalog of selected partner) ─────────────────────────────
  if (parceiroSel) {
    const produtosFiltrados = cardapio?.produtos.filter(p =>
      categoriaSel === null || p.categoria_id === categoriaSel
    ) ?? [];

    const canFinalizar = qtdCarrinho > 0 && (!showCarrinho || !!formaEscolhida);
    const navComum = (
      <SegmentoBottomNav
        ativo={showCarrinho ? "carrinho" : "inicio"}
        corAtivo={accentColor}
        qtdCarrinho={qtdCarrinho}
        onInicio={() => { setShowCarrinho(false); if (!parceiroSel) return; }}
        onCarrinho={() => { if (qtdCarrinho > 0) setShowCarrinho(true); }}
        onFinalizar={() => {
          if (!canFinalizar || enviandoPedido) return;
          if (showCarrinho) {
            requireAuth(() => handlePedido());
          } else {
            if (qtdCarrinho > 0) setShowCarrinho(true);
          }
        }}
      />
    );

    // ── Cart view ─────────────────────────────────────────────────────────────
    if (showCarrinho) {
      return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          {enviandoPedido && (
            <View style={{ position: "absolute", inset: 0, zIndex: 99, backgroundColor: "#00000060", alignItems: "center", justifyContent: "center" }}>
              <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 28, alignItems: "center", gap: 14 }}>
                <ActivityIndicator size="large" color={accentColor} />
                <Text style={{ color: colors.text, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Enviando pedido...</Text>
              </View>
            </View>
          )}
          <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: accentColor }]}>
            <Pressable onPress={() => { if (!enviandoPedido) setShowCarrinho(false); }} style={styles.backBtn}>
              <Feather name="arrow-left" size={22} color="#fff" />
            </Pressable>
            <Text style={[styles.headerTitle, { fontFamily: "Inter_700Bold", color: "#fff" }]}>Meu Carrinho ({qtdCarrinho})</Text>
            <View style={{ width: 30 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + SEGMENTO_NAV_HEIGHT + 16, gap: 10 }}>
            {carrinho.map(c => (
              <View key={c.uid} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: "row", alignItems: "center" }]}>
                <View style={[styles.itemImagem, { backgroundColor: accentColor + "15" }]}>
                  <ProductImage uri={getImgUrl(c.produto.imagem)} style={styles.itemImagemImg} fallbackIcon="coffee" fallbackColor={accentColor} />
                </View>
                <View style={{ flex: 1, paddingHorizontal: 12 }}>
                  <Text style={[styles.itemNome, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>{c.produto.nome}</Text>
                  {c.extrasSel.length > 0 && (
                    <Text style={[styles.itemExtras, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]} numberOfLines={2}>
                      + {c.extrasSel.map(e => e.nome).join(", ")}
                    </Text>
                  )}
                  <Text style={[styles.itemPreco, { color: accentColor, fontFamily: "Inter_700Bold" }]}>
                    R$ {(c.precoUnitario * c.qtd).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.qtdControls}>
                  <Pressable onPress={() => removeItem(c.uid)} style={[styles.qtdBtn, { backgroundColor: colors.backgroundSecondary }]}>
                    <Feather name="minus" size={14} color={colors.text} />
                  </Pressable>
                  <Text style={[styles.qtdNum, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{c.qtd}</Text>
                  <Pressable onPress={() => addToCart(c.produto, c.tamanhoSel, c.extrasSel, 1)} style={[styles.qtdBtn, { backgroundColor: accentColor }]}>
                    <Feather name="plus" size={14} color="#fff" />
                  </Pressable>
                </View>
              </View>
            ))}

            {/* Total */}
            <View style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 0 }]}>
              <Text style={[{ color: colors.text, fontFamily: "Inter_700Bold", fontSize: 16 }]}>Total</Text>
              <Text style={[{ color: accentColor, fontFamily: "Inter_700Bold", fontSize: 22, marginLeft: "auto" }]}>R$ {totalCarrinho.toFixed(2)}</Text>
            </View>

            {/* ── Payment method selector ──────────────────────────────── */}
            <View style={{ marginTop: 4 }}>
              <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_700Bold", fontSize: 15, marginBottom: 10 }]}>
                Forma de Pagamento
              </Text>
              {formasPagamento.length === 0 ? (
                <Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 13 }}>
                  Nenhuma forma de pagamento disponível.
                </Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {formasPagamento.map(key => {
                    const meta = FP_LABELS[key];
                    if (!meta) return null;
                    const selected = formaEscolhida === key;
                    const isCredito = key === "credito_gotaxi";
                    const labelDisplay = isCredito
                      ? `Crédito GoTaxi  •  R$ ${creditoDisponivel.toFixed(2)} disponível`
                      : meta.label;
                    return (
                      <Pressable
                        key={key}
                        onPress={() => setFormaEscolhida(key)}
                        style={[
                          styles.fpOption,
                          {
                            backgroundColor: selected ? meta.color + "18" : colors.card,
                            borderColor: selected ? meta.color : colors.border,
                            borderWidth: selected ? 2 : 1,
                          },
                        ]}
                      >
                        <View style={[styles.fpIconBox, { backgroundColor: meta.color + "22" }]}>
                          <Feather name={meta.icon as any} size={18} color={meta.color} />
                        </View>
                        <Text style={[styles.fpOptionLabel, { color: colors.text, fontFamily: selected ? "Inter_700Bold" : "Inter_500Medium" }]}>
                          {labelDisplay}
                        </Text>
                        {selected && (
                          <View style={[styles.fpCheck, { backgroundColor: meta.color }]}>
                            <Feather name="check" size={12} color="#fff" />
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              )}
              {!formaEscolhida && (
                <Text style={{ color: "#EF4444", fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 6 }}>
                  Selecione uma forma de pagamento para finalizar
                </Text>
              )}
            </View>
          </ScrollView>
          {navComum}
        </View>
      );
    }

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: accentColor }]}>
          <Pressable onPress={() => { setParceiroSel(null); setCardapio(null); setCarrinho([]); setShowCarrinho(false); }} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color="#fff" />
          </Pressable>
          <Text style={[styles.headerTitle, { fontFamily: "Inter_700Bold", color: "#fff" }]} numberOfLines={1}>
            {parceiroSel.nome}
          </Text>
          <View style={styles.cartBadgeContainer}>
            {qtdCarrinho > 0 && (
              <>
                <Feather name="shopping-cart" size={20} color="#fff" />
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{qtdCarrinho}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {loadingCardapio ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
            <ActivityIndicator size="large" color={accentColor} />
            <Text style={[{ color: colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 14 }]}>
              Carregando cardápio...
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {/* Category filter */}
            {(cardapio?.categorias.length ?? 0) > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flexGrow: 0, flexShrink: 0, height: 56 }}
                contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: "center" }}
              >
                <Pressable
                  onPress={() => setCategoriaSel(null)}
                  style={[styles.catChip, {
                    backgroundColor: categoriaSel === null ? accentColor : colors.backgroundSecondary,
                    borderColor: categoriaSel === null ? accentColor : colors.textMuted,
                  }]}
                >
                  <Text style={[styles.catText, {
                    color: categoriaSel === null ? "#fff" : colors.text,
                    fontFamily: "Inter_600SemiBold",
                  }]}>Todos</Text>
                </Pressable>
                {cardapio?.categorias.map(cat => (
                  <Pressable
                    key={cat.id}
                    onPress={() => setCategoriaSel(cat.id)}
                    style={[styles.catChip, {
                      backgroundColor: categoriaSel === cat.id ? accentColor : colors.backgroundSecondary,
                      borderColor: categoriaSel === cat.id ? accentColor : colors.textMuted,
                    }]}
                  >
                    <Text style={[styles.catText, {
                      color: categoriaSel === cat.id ? "#fff" : colors.text,
                      fontFamily: "Inter_600SemiBold",
                    }]}>{cat.nome}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {/* Products */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + SEGMENTO_NAV_HEIGHT + 16 }}
              showsVerticalScrollIndicator={false}
            >
              {produtosFiltrados.length === 0 ? (
                <View style={{ alignItems: "center", paddingTop: 40, gap: 8 }}>
                  <Feather name="package" size={40} color={colors.textMuted} />
                  <Text style={[{ color: colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 14 }]}>
                    Nenhum produto disponível
                  </Text>
                </View>
              ) : (
                produtosFiltrados.map(produto => {
                  const qtd = getQtd(produto.id);
                  return (
                    <Pressable
                      key={produto.id}
                      onPress={() => {
                        const hasOptions = (produto.extras?.length ?? 0) > 0 || (Array.isArray(produto.tamanhos) && produto.tamanhos.length > 0);
                        if (hasOptions) setModalProduto(produto);
                        else addToCart(produto, null, [], 1);
                      }}
                      style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      {/* Info */}
                      <View style={styles.itemInfo}>
                        {produto.categoria_nome && (
                          <Text style={[styles.itemCategoria, { color: accentColor, fontFamily: "Inter_600SemiBold" }]}>
                            {produto.categoria_nome}
                          </Text>
                        )}
                        <Text style={[styles.itemNome, { color: colors.text, fontFamily: "Inter_600SemiBold" }]}>
                          {produto.nome}
                        </Text>
                        {produto.descricao && (
                          <Text style={[styles.itemDesc, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]} numberOfLines={2}>
                            {produto.descricao}
                          </Text>
                        )}
                        {produto.extras.length > 0 && (
                          <Text style={[styles.itemExtras, { color: accentColor + "CC", fontFamily: "Inter_400Regular" }]} numberOfLines={1}>
                            {produto.extras.length} opç{produto.extras.length === 1 ? "ão" : "ões"} disponíve{produto.extras.length === 1 ? "l" : "is"}
                          </Text>
                        )}
                        <Text style={[styles.itemPreco, { color: accentColor, fontFamily: "Inter_700Bold" }]}>
                          R$ {Number(produto.preco).toFixed(2)}
                        </Text>
                      </View>
                      {/* Product image */}
                      <View style={styles.itemImagemCol}>
                        <View style={[styles.itemImagem, { backgroundColor: accentColor + "15" }]}>
                          <ProductImage
                            uri={getImgUrl(produto.imagem)}
                            style={styles.itemImagemImg}
                            fallbackIcon="coffee"
                            fallbackColor={accentColor}
                          />
                        </View>
                        {qtd > 0 && (
                          <View style={[styles.qtdBadge, { backgroundColor: accentColor }]}>
                            <Text style={styles.qtdBadgeText}>{qtd}</Text>
                          </View>
                        )}
                        <View style={[styles.qtdBtn, { backgroundColor: accentColor, marginTop: 6 }]}>
                          <Feather name="plus" size={14} color="#fff" />
                        </View>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

          </View>
        )}
        {/* Product selection modal */}
        {modalProduto && (
          <ProdutoModal
            produto={modalProduto}
            accentColor={accentColor}
            colors={colors}
            insets={insets}
            onClose={() => setModalProduto(null)}
            onAdd={(tamanho, extras, qtd) => { addToCart(modalProduto, tamanho, extras, qtd); setModalProduto(null); }}
          />
        )}
        {navComum}
      </View>
    );
  }

  // ── List screen (partner selection) ─────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: MOD_COLOR }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <Text style={[styles.headerTitle, { fontFamily: "Inter_700Bold", color: "#fff" }]}>Pedir Comida</Text>
        <View style={{ width: 30 }} />
      </View>

      {loadingParceiros ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <ActivityIndicator size="large" color={MOD_COLOR} />
          <Text style={[{ color: colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 14 }]}>
            Buscando restaurantes...
          </Text>
        </View>
      ) : parceiros.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 }}>
          <Feather name="coffee" size={48} color={colors.textMuted} />
          <Text style={[{ color: colors.text, fontFamily: "Inter_700Bold", fontSize: 18, textAlign: "center" }]}>
            Nenhum restaurante disponível
          </Text>
          <Text style={[{ color: colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center" }]}>
            Em breve novos parceiros na sua área!
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + SEGMENTO_NAV_HEIGHT + 16, padding: 16, gap: 12 }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
            Restaurantes parceiros
          </Text>
          {parceiros.map(parceiro => {
            const cor = parceiro.cor || MOD_COLOR;
            return (
              <Pressable
                key={parceiro.id}
                onPress={() => handleSelectParceiro(parceiro)}
                style={[styles.restCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={[styles.restImagem, { backgroundColor: cor + "22" }]}>
                  <Feather name="coffee" size={36} color={cor} />
                </View>
                <View style={styles.restInfo}>
                  <Text style={[styles.restNome, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
                    {parceiro.nome}
                  </Text>
                  <View style={styles.restMeta}>
                    <Feather name="package" size={13} color={colors.textMuted} />
                    <Text style={[styles.metaText, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>
                      {" "}{parceiro.total_produtos} {Number(parceiro.total_produtos) === 1 ? "item" : "itens"} no cardápio
                    </Text>
                  </View>
                  <View style={[styles.abertoBadge, { backgroundColor: "#10B98122" }]}>
                    <View style={[styles.abertoIndicator, { backgroundColor: "#10B981" }]} />
                    <Text style={[styles.abertoText, { color: "#10B981", fontFamily: "Inter_600SemiBold" }]}>Aberto agora</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={20} color={colors.textMuted} />
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      <SegmentoBottomNav
        ativo="inicio"
        corAtivo={MOD_COLOR}
        onInicio={() => {}}
        onCarrinho={() => {}}
        onFinalizar={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 16, justifyContent: "space-between" },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, flex: 1, textAlign: "center" },
  cartBadgeContainer: { width: 30, alignItems: "flex-end", position: "relative" },
  cartBadge: { position: "absolute", top: -6, right: -4, backgroundColor: "#F59E0B", borderRadius: 8, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center" },
  cartBadgeText: { fontSize: 10, color: "#fff", fontFamily: "Inter_700Bold" },
  sectionTitle: { fontSize: 20, marginBottom: 4 },
  restCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden", flexDirection: "row", alignItems: "center", padding: 0 },
  restImagem: { width: 90, height: 90, alignItems: "center", justifyContent: "center" },
  restInfo: { flex: 1, padding: 12, gap: 4 },
  restNome: { fontSize: 16, marginBottom: 2 },
  restMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 13 },
  abertoBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: "flex-start", marginTop: 4 },
  abertoIndicator: { width: 7, height: 7, borderRadius: 4 },
  abertoText: { fontSize: 11 },
  catChip: { height: 36, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1.5, alignItems: "center", justifyContent: "center", flexShrink: 0, alignSelf: "center" },
  catText: { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  itemCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  itemInfo: { flex: 1 },
  itemCategoria: { fontSize: 10, marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.5 },
  itemNome: { fontSize: 15, marginBottom: 4 },
  itemDesc: { fontSize: 12, marginBottom: 4, lineHeight: 16 },
  itemExtras: { fontSize: 11, marginBottom: 6, fontStyle: "italic" },
  itemPreco: { fontSize: 16 },
  itemImagem: { width: 72, height: 72, borderRadius: 12, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  itemImagemImg: { width: 72, height: 72, borderRadius: 12 },
  itemImagemCol: { alignItems: "center", gap: 4, minWidth: 72 },
  qtdBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, minWidth: 24, alignItems: "center" },
  qtdBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  qtdControls: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  qtdBtn: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  qtdNum: { fontSize: 16, minWidth: 20, textAlign: "center" },
  carrinhoBar: { padding: 12 },
  pedirBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  pedirBadge: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  pedirBadgeText: { fontSize: 14 },
  pedirText: { flex: 1, textAlign: "center", fontSize: 16 },
  pedirTotal: { fontSize: 16 },
  sucessoCard: { borderRadius: 20, borderWidth: 1, padding: 32, alignItems: "center", marginHorizontal: 32, gap: 12 },
  checkCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  sucessoTitulo: { fontSize: 22 },
  sucessoSub: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  fpTag: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  fpTagText: { fontSize: 13 },
  fpBarRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingBottom: 6 },
  fpBarText: { fontSize: 12, color: "rgba(255,255,255,0.9)" },
  fpOption: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, padding: 12 },
  fpIconBox: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  fpOptionLabel: { flex: 1, fontSize: 14 },
  fpCheck: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
});

// ── Product customization modal ───────────────────────────────────────────────
function ProdutoModal({ produto, accentColor, colors, insets, onClose, onAdd }: {
  produto: Produto;
  accentColor: string;
  colors: any;
  insets: { bottom: number };
  onClose: () => void;
  onAdd: (tamanho: Tamanho | null, extras: Extra[], qtd: number) => void;
}) {
  const tamanhos = Array.isArray(produto.tamanhos) ? produto.tamanhos : [];
  const [extrasSel, setExtrasSel] = useState<Extra[]>([]);
  const [tamanhoSel, setTamanhoSel] = useState<Tamanho | null>(tamanhos.length > 0 ? tamanhos[0] : null);
  const [qtd, setQtd] = useState(1);

  const basePreco = tamanhoSel ? Number(tamanhoSel.preco) : Number(produto.preco);
  const precoTotal = (basePreco + extrasSel.reduce((s, e) => s + Number(e.preco), 0)) * qtd;

  const toggleExtra = (extra: Extra) => {
    setExtrasSel(prev =>
      prev.find(e => e.id === extra.id) ? prev.filter(e => e.id !== extra.id) : [...prev, extra]
    );
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={mStyles.overlay}>
        <Pressable style={StyleSheet.absoluteFillObject as any} onPress={onClose} />
        <View style={[mStyles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 }]}>
          <View style={[mStyles.handle, { backgroundColor: colors.border }]} />

          <ProductImage uri={getImgUrl(produto.imagem)} style={[mStyles.prodImg, { borderColor: colors.border }]} fallbackIcon="coffee" fallbackColor={colors.textMuted} />

          <View style={mStyles.headerRow}>
            <Text style={[mStyles.prodNome, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{produto.nome}</Text>
            <Pressable onPress={onClose} style={[mStyles.closeBtn, { backgroundColor: colors.backgroundSecondary }]}>
              <Feather name="x" size={16} color={colors.text} />
            </Pressable>
          </View>

          {produto.descricao ? (
            <Text style={[mStyles.prodDesc, { color: colors.textSecondary, fontFamily: "Inter_400Regular" }]}>{produto.descricao}</Text>
          ) : null}

          <Text style={[mStyles.basePreco, { color: accentColor, fontFamily: "Inter_700Bold" }]}>
            R$ {basePreco.toFixed(2)}
          </Text>

          {tamanhos.length > 0 && (
            <>
              <Text style={[mStyles.sectionLabel, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
                Tamanho
              </Text>
              <View>
                {tamanhos.map(t => {
                  const sel = tamanhoSel?.nome === t.nome;
                  return (
                    <Pressable key={t.nome} onPress={() => setTamanhoSel(t)}
                      style={[mStyles.extraRow, {
                        borderColor: sel ? accentColor : colors.border,
                        backgroundColor: sel ? accentColor + "12" : colors.backgroundSecondary,
                        marginBottom: 8,
                      }]}>
                      <View style={[mStyles.extraCheck, {
                        borderRadius: 999,
                        borderColor: sel ? accentColor : colors.border,
                        backgroundColor: "transparent",
                      }]}>
                        {sel && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accentColor }} />}
                      </View>
                      <Text style={[mStyles.extraNome, { color: colors.text, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>
                        {t.nome}
                      </Text>
                      <Text style={[mStyles.extraPreco, { color: accentColor, fontFamily: "Inter_600SemiBold" }]}>
                        R$ {Number(t.preco).toFixed(2)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {produto.extras.length > 0 && (
            <>
              <Text style={[mStyles.sectionLabel, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
                Adicionais / Opções
              </Text>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 220 }}>
                {produto.extras.map(extra => {
                  const sel = !!extrasSel.find(e => e.id === extra.id);
                  return (
                    <Pressable key={extra.id} onPress={() => toggleExtra(extra)}
                      style={[mStyles.extraRow, {
                        borderColor: sel ? accentColor : colors.border,
                        backgroundColor: sel ? accentColor + "12" : colors.backgroundSecondary,
                        marginBottom: 8,
                      }]}>
                      <View style={[mStyles.extraCheck, {
                        borderColor: sel ? accentColor : colors.border,
                        backgroundColor: sel ? accentColor : "transparent",
                      }]}>
                        {sel && <Feather name="check" size={11} color="#fff" />}
                      </View>
                      <Text style={[mStyles.extraNome, { color: colors.text, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>
                        {extra.nome}
                      </Text>
                      {Number(extra.preco) > 0 && (
                        <Text style={[mStyles.extraPreco, { color: accentColor, fontFamily: "Inter_600SemiBold" }]}>
                          +R$ {Number(extra.preco).toFixed(2)}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}

          <View style={mStyles.addRow}>
            <View style={[mStyles.qtdRow, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <Pressable onPress={() => setQtd(q => Math.max(1, q - 1))}
                style={[mStyles.qtdBtnMd, { backgroundColor: qtd > 1 ? accentColor : colors.border }]}>
                <Feather name="minus" size={16} color="#fff" />
              </Pressable>
              <Text style={[mStyles.qtdLabel, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{qtd}</Text>
              <Pressable onPress={() => setQtd(q => q + 1)} style={[mStyles.qtdBtnMd, { backgroundColor: accentColor }]}>
                <Feather name="plus" size={16} color="#fff" />
              </Pressable>
            </View>
            <Pressable onPress={() => onAdd(tamanhoSel, extrasSel, qtd)}
              style={[mStyles.addBtn, { backgroundColor: accentColor }]}>
              <Text style={[mStyles.addBtnText, { fontFamily: "Inter_700Bold" }]}>
                Adicionar  •  R$ {precoTotal.toFixed(2)}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const mStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, gap: 10 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  prodImg: { width: "100%", height: 170, borderRadius: 16, borderWidth: 1 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  prodNome: { flex: 1, fontSize: 20, lineHeight: 26 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 2 },
  prodDesc: { fontSize: 13, lineHeight: 19 },
  basePreco: { fontSize: 22 },
  sectionLabel: { fontSize: 15, marginTop: 2 },
  extraRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1.5, padding: 12 },
  extraCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  extraNome: { flex: 1, fontSize: 14 },
  extraPreco: { fontSize: 13 },
  addRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  qtdRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  qtdBtnMd: { width: 44, height: 50, alignItems: "center", justifyContent: "center" },
  qtdLabel: { minWidth: 40, textAlign: "center", fontSize: 18 },
  addBtn: { flex: 1, height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  addBtnText: { color: "#fff", fontSize: 15 },
});
