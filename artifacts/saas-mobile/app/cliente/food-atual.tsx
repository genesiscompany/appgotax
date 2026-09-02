import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  useColorScheme, Platform, ActivityIndicator, Alert, Image, Modal, TextInput,
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
type Subcategoria = { id: number; nome: string; slug: string; emoji: string | null };

type Parceiro = {
  id: number;
  nome: string;
  cor: string | null;
  total_produtos: number;
  subcategoria_id?: number | null;
};

type Categoria = { id: number; nome: string; ordem: number };
type Extra = { id: number; nome: string; preco: number };
type Tamanho = { nome: string; preco: number };
type OpcaoGrupo = { id: number; nome: string; preco_adicional: number };
type Grupo = {
  id: number; nome: string;
  min_selecoes: number; max_selecoes: number;
  obrigatorio: boolean;
  opcoes: OpcaoGrupo[];
};
type Produto = {
  id: number; nome: string; descricao?: string; preco: number;
  imagem?: string; categoria_id?: number; categoria_nome?: string;
  extras: Extra[];
  grupos?: Grupo[];
  tamanhos?: Tamanho[] | null;
};

type Cardapio = { categorias: Categoria[]; produtos: Produto[]; formasPagamento: string[] };
type CartItem = { uid: string; produto: Produto; qtd: number; extrasSel: Extra[]; gruposSel: Record<number, OpcaoGrupo[]>; tamanhoSel: Tamanho | null; precoUnitario: number };

const makeUid = (produtoId: number, tamanhoNome: string, extraIds: number[], gruposSel: Record<number, OpcaoGrupo[]>) => {
  const grupoStr = Object.entries(gruposSel).sort(([a],[b]) => Number(a)-Number(b)).map(([gid, ops]) => `g${gid}:[${ops.map(o=>o.id).sort((a,b)=>a-b).join(",")}]`).join("_");
  return `${produtoId}_t:${tamanhoNome}_${[...extraIds].sort((a, b) => a - b).join("_")}_${grupoStr}`;
};

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
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);
  const [subcategoriaFiltro, setSubcategoriaFiltro] = useState<number | null>(null);

  // ── Delivery state ─────────────────────────────────────────────────────────
  const [tipoEntrega, setTipoEntrega] = useState<"delivery" | "retirada">("delivery");
  const [enderecoEntrega, setEnderecoEntrega] = useState("");
  const [numeroEntrega, setNumeroEntrega] = useState("");
  const [complementoEntrega, setComplementoEntrega] = useState("");
  const [freteInfo, setFreteInfo] = useState<{ taxa: number; distancia_km?: number; duracao?: string; fora_raio?: boolean } | null>(null);
  const [loadingFrete, setLoadingFrete] = useState(false);
  const [sugestoes, setSugestoes] = useState<Array<{ description: string; place_id: string }>>([]);
  const [buscandoSugestoes, setBuscandoSugestoes] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/subcategorias-alimentacao`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setSubcategorias(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

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
  const [precoPromoModal, setPrecoPromoModal] = useState<number | null>(null);

  const totalCarrinho = carrinho.reduce((s, c) => s + c.precoUnitario * c.qtd, 0);
  const qtdCarrinho = carrinho.reduce((s, c) => s + c.qtd, 0);

  // ── Fetch partners ──────────────────────────────────────────────────────────
  const { empresaId: empresaIdParam, produtoId: produtoIdParam, precoPromocional: precoPromocionalParam } = useLocalSearchParams<{ empresaId?: string; produtoId?: string; precoPromocional?: string }>();

  useEffect(() => {
    fetch(`${API_BASE}/food/parceiros`)
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d) ? d : [];
        setParceiros(list);
        setLoadingParceiros(false);
        if (empresaIdParam) {
          const target = list.find((p: Parceiro) => String(p.id) === String(empresaIdParam));
          if (target) {
            handleSelectParceiro(target);
          } else {
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

  // ── Delivery helpers ───────────────────────────────────────────────────────
  const buscarSugestoes = (texto: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!texto || texto.length < 3) { setSugestoes([]); return; }
    debounceRef.current = setTimeout(async () => {
      setBuscandoSugestoes(true);
      try {
        const r = await fetch(`${API_BASE}/food/places/autocomplete?input=${encodeURIComponent(texto)}`);
        const d = await r.json();
        setSugestoes(Array.isArray(d) ? d : []);
      } catch {}
      setBuscandoSugestoes(false);
    }, 400);
  };

  const calcularFrete = async (endereco: string, empresaId: number) => {
    if (!endereco || tipoEntrega === "retirada") { setFreteInfo(null); return; }
    setLoadingFrete(true);
    try {
      const r = await fetch(`${API_BASE}/food/empresa/${empresaId}/calcular-frete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endereco_destino: endereco }),
      });
      const d = await r.json();
      setFreteInfo({ taxa: d.taxa_entrega ?? 0, distancia_km: d.distancia_km, duracao: d.duracao, fora_raio: d.fora_raio });
    } catch { setFreteInfo(null); }
    setLoadingFrete(false);
  };

  // ── Fetch catalog when a partner is selected ────────────────────────────────
  const handleSelectParceiro = async (p: Parceiro) => {
    setParceiroSel(p);
    setCarrinho([]);
    setCategoriaSel(null);
    setCardapio(null);
    setFormaEscolhida(null);
    setFormasPagamento([]);
    setTipoEntrega("delivery");
    setEnderecoEntrega("");
    setNumeroEntrega("");
    setComplementoEntrega("");
    setFreteInfo(null);
    setSugestoes([]);
    setLoadingCardapio(true);
    try {
      const res = await fetch(`${API_BASE}/food/parceiros/${p.id}/cardapio`);
      const data = await res.json();
      setCardapio(data);
      const base = Array.isArray(data.formasPagamento) && data.formasPagamento.length > 0
        ? data.formasPagamento
        : ["pix", "dinheiro", "credito", "debito"];
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
  const autoOpenedRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${produtoIdParam}_${precoPromocionalParam}`;
    if (autoOpenedRef.current === key) return;
    if (!produtoIdParam || !cardapio?.produtos?.length) return;
    const target = cardapio.produtos.find(p => String(p.id) === String(produtoIdParam));
    if (target) {
      const preco = precoPromocionalParam ? Number(precoPromocionalParam) : null;
      setModalProduto(target);
      setPrecoPromoModal(preco);
      autoOpenedRef.current = key;
    }
  }, [produtoIdParam, precoPromocionalParam, cardapio]);

  // ── Cart helpers ────────────────────────────────────────────────────────────
  const addToCart = (produto: Produto, tamanhoSel: Tamanho | null, extrasSel: Extra[], qtdAdded: number, gruposSel: Record<number, OpcaoGrupo[]> = {}, precoOverride?: number | null) => {
    const uid = makeUid(produto.id, tamanhoSel?.nome ?? "", extrasSel.map(e => e.id), gruposSel);
    const basePreco = precoOverride != null ? precoOverride : (tamanhoSel ? Number(tamanhoSel.preco) : Number(produto.preco));
    const extrasPreco = extrasSel.reduce((s, e) => s + Number(e.preco), 0);
    const gruposPreco = Object.values(gruposSel).flat().reduce((s, o) => s + Number(o.preco_adicional), 0);
    const precoUnitario = basePreco + extrasPreco + gruposPreco;
    setCarrinho(prev => {
      const ex = prev.find(c => c.uid === uid);
      if (ex) return prev.map(c => c.uid === uid ? { ...c, qtd: c.qtd + qtdAdded } : c);
      return [...prev, { uid, produto, qtd: qtdAdded, extrasSel, gruposSel, tamanhoSel, precoUnitario }];
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
      const taxaEntrega = tipoEntrega === "retirada" ? 0 : (freteInfo?.taxa ?? 0);
      const totalPedido = totalCarrinho + taxaEntrega;
      const enderecoCompleto = tipoEntrega === "retirada"
        ? "Retirada na loja"
        : [enderecoEntrega, numeroEntrega, complementoEntrega].filter(Boolean).join(", ");

      if (formaEscolhida === "credito_gotaxi" && creditoDisponivel < totalPedido) {
        Alert.alert(
          "Crédito insuficiente",
          `Seu saldo GoTaxi é R$ ${creditoDisponivel.toFixed(2)}. O pedido custa R$ ${totalPedido.toFixed(2)}.`
        );
        setEnviandoPedido(false);
        return;
      }

      const itens = carrinho.map(c => {
        const gruposDesc = Object.values(c.gruposSel ?? {}).flat().map(o => o.nome).join(", ");
        const extrasDesc = c.extrasSel.map(e => e.nome).join(", ");
        const complementos = [gruposDesc, extrasDesc].filter(Boolean).join(", ");
        return {
          nome: c.produto.nome + (complementos ? ` + ${complementos}` : ""),
          quantidade: c.qtd,
          preco_unitario: c.precoUnitario,
          total: c.precoUnitario * c.qtd,
        };
      });

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
          cliente_endereco: enderecoCompleto,
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

    const enderecoOk = tipoEntrega === "retirada" || (enderecoEntrega.length > 4 && !freteInfo?.fora_raio);
    const canFinalizar = qtdCarrinho > 0 && (!showCarrinho || (!!formaEscolhida && enderecoOk));
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
        empresaId={parceiroSel?.id}
        empresaNome={parceiroSel?.nome}
        clienteNome={customer?.nome ?? "Cliente"}
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
                  {(() => {
                    const gruposDesc = Object.values(c.gruposSel ?? {}).flat().map(o => o.nome).join(", ");
                    const extrasDesc = c.extrasSel.map(e => e.nome).join(", ");
                    const desc = [gruposDesc, extrasDesc].filter(Boolean).join(", ");
                    return desc ? (
                      <Text style={[styles.itemExtras, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]} numberOfLines={2}>
                        + {desc}
                      </Text>
                    ) : null;
                  })()}
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

            {/* ── Resumo de valores ──────────────────────────────────── */}
            <View style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: "column", gap: 8 }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 14 }}>Subtotal</Text>
                <Text style={{ color: colors.text, fontFamily: "Inter_500Medium", fontSize: 14 }}>R$ {totalCarrinho.toFixed(2)}</Text>
              </View>
              {tipoEntrega === "delivery" && (
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View>
                    <Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 14 }}>Taxa de entrega</Text>
                    {freteInfo?.distancia_km != null && (
                      <Text style={{ color: colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 11 }}>
                        {freteInfo.distancia_km} km{freteInfo.duracao ? ` • ${freteInfo.duracao}` : ""}
                      </Text>
                    )}
                  </View>
                  {loadingFrete ? (
                    <ActivityIndicator size="small" color={accentColor} />
                  ) : freteInfo?.fora_raio ? (
                    <Text style={{ color: "#EF4444", fontFamily: "Inter_500Medium", fontSize: 13 }}>Fora do raio</Text>
                  ) : (
                    <Text style={{ color: colors.text, fontFamily: "Inter_500Medium", fontSize: 14 }}>
                      {freteInfo != null ? `R$ ${freteInfo.taxa.toFixed(2)}` : "—"}
                    </Text>
                  )}
                </View>
              )}
              <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.text, fontFamily: "Inter_700Bold", fontSize: 16 }}>Total</Text>
                <Text style={{ color: accentColor, fontFamily: "Inter_700Bold", fontSize: 22 }}>
                  R$ {(totalCarrinho + (tipoEntrega === "retirada" ? 0 : (freteInfo?.taxa ?? 0))).toFixed(2)}
                </Text>
              </View>
            </View>

            {/* ── Tipo de entrega ───────────────────────────────────────── */}
            <View style={{ marginTop: 4 }}>
              <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_700Bold", fontSize: 15, marginBottom: 10 }]}>
                Tipo de entrega
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {(["delivery", "retirada"] as const).map(tipo => {
                  const sel = tipoEntrega === tipo;
                  return (
                    <Pressable
                      key={tipo}
                      onPress={() => {
                        setTipoEntrega(tipo);
                        if (tipo === "retirada") { setFreteInfo(null); setSugestoes([]); }
                        else if (enderecoEntrega) calcularFrete(enderecoEntrega, parceiroSel!.id);
                      }}
                      style={{
                        flex: 1, borderRadius: 12, borderWidth: sel ? 2 : 1,
                        borderColor: sel ? accentColor : colors.border,
                        backgroundColor: sel ? accentColor + "18" : colors.card,
                        padding: 12, alignItems: "flex-start", gap: 2,
                      }}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                        <Feather name={tipo === "delivery" ? "truck" : "shopping-bag"} size={20} color={sel ? accentColor : colors.textSecondary} />
                        {sel && <Feather name="check-circle" size={16} color={accentColor} />}
                      </View>
                      <Text style={{ color: sel ? accentColor : colors.text, fontFamily: "Inter_700Bold", fontSize: 14, marginTop: 4 }}>
                        {tipo === "delivery" ? "Delivery" : "Retirar"}
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 11 }}>
                        {tipo === "delivery" ? "Entrega em casa" : "Na loja"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* ── Endereço de entrega ───────────────────────────────────── */}
            {tipoEntrega === "delivery" && (
              <View style={{ marginTop: 2 }}>
                <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_700Bold", fontSize: 15, marginBottom: 10 }]}>
                  Endereço de entrega
                </Text>
                <View style={{ position: "relative" }}>
                  <View style={{
                    flexDirection: "row", alignItems: "center",
                    backgroundColor: colors.card, borderRadius: 12,
                    borderWidth: 1, borderColor: enderecoEntrega ? accentColor : colors.border,
                    paddingHorizontal: 12, paddingVertical: 10,
                  }}>
                    <Feather name="map-pin" size={16} color={accentColor} style={{ marginRight: 8 }} />
                    <TextInput
                      style={{ flex: 1, color: colors.text, fontFamily: "Inter_400Regular", fontSize: 14, padding: 0 }}
                      placeholder="Rua, Avenida..."
                      placeholderTextColor={colors.textMuted}
                      value={enderecoEntrega}
                      onChangeText={t => {
                        setEnderecoEntrega(t);
                        setFreteInfo(null);
                        buscarSugestoes(t);
                      }}
                      returnKeyType="search"
                    />
                    {enderecoEntrega.length > 0 && (
                      <Pressable onPress={() => { setEnderecoEntrega(""); setFreteInfo(null); setSugestoes([]); }}>
                        <Feather name="x" size={16} color={colors.textMuted} />
                      </Pressable>
                    )}
                    {buscandoSugestoes && <ActivityIndicator size="small" color={accentColor} style={{ marginLeft: 6 }} />}
                  </View>

                  {sugestoes.length > 0 && (
                    <View style={{
                      position: "absolute", top: "100%", left: 0, right: 0, zIndex: 999,
                      backgroundColor: colors.card, borderRadius: 12,
                      borderWidth: 1, borderColor: colors.border,
                      marginTop: 4, overflow: "hidden", elevation: 6,
                      shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8,
                    }}>
                      {sugestoes.slice(0, 5).map((s, i) => (
                        <Pressable
                          key={s.place_id}
                          onPress={() => {
                            setEnderecoEntrega(s.description);
                            setSugestoes([]);
                            calcularFrete(s.description, parceiroSel!.id);
                          }}
                          style={{
                            flexDirection: "row", alignItems: "center", gap: 10,
                            paddingHorizontal: 14, paddingVertical: 12,
                            borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.border,
                          }}
                        >
                          <Feather name="map-pin" size={14} color={colors.textMuted} />
                          <Text style={{ flex: 1, color: colors.text, fontFamily: "Inter_400Regular", fontSize: 13 }} numberOfLines={2}>
                            {s.description}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>

                {/* Número e Complemento */}
                <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                  <TextInput
                    style={{
                      flex: 1, backgroundColor: colors.card, borderRadius: 12,
                      borderWidth: 1, borderColor: colors.border,
                      paddingHorizontal: 14, paddingVertical: 12,
                      color: colors.text, fontFamily: "Inter_400Regular", fontSize: 14,
                    }}
                    placeholder="Número"
                    placeholderTextColor={colors.textMuted}
                    value={numeroEntrega}
                    onChangeText={setNumeroEntrega}
                    keyboardType="numeric"
                    returnKeyType="next"
                  />
                  <TextInput
                    style={{
                      flex: 2, backgroundColor: colors.card, borderRadius: 12,
                      borderWidth: 1, borderColor: colors.border,
                      paddingHorizontal: 14, paddingVertical: 12,
                      color: colors.text, fontFamily: "Inter_400Regular", fontSize: 14,
                    }}
                    placeholder="Complemento (Apto, Bloco...)"
                    placeholderTextColor={colors.textMuted}
                    value={complementoEntrega}
                    onChangeText={setComplementoEntrega}
                    returnKeyType="done"
                  />
                </View>

                {/* Confirmação frete */}
                {freteInfo && !freteInfo.fora_raio && !loadingFrete && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                    <Feather name="check-circle" size={13} color="#10B981" />
                    <Text style={{ color: "#10B981", fontFamily: "Inter_500Medium", fontSize: 12 }}>
                      {freteInfo.distancia_km != null ? `${freteInfo.distancia_km} km • ` : ""}frete R$ {freteInfo.taxa.toFixed(2)}
                    </Text>
                  </View>
                )}
                {freteInfo?.fora_raio && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                    <Feather name="alert-circle" size={13} color="#EF4444" />
                    <Text style={{ color: "#EF4444", fontFamily: "Inter_500Medium", fontSize: 12 }}>
                      Endereço fora do raio de entrega
                    </Text>
                  </View>
                )}
                {!freteInfo && enderecoEntrega.length > 4 && !loadingFrete && !buscandoSugestoes && (
                  <Text style={{ color: colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 6 }}>
                    Selecione um endereço da lista para calcular o frete
                  </Text>
                )}
              </View>
            )}

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
                        const hasOptions = (produto.extras?.length ?? 0) > 0 || (Array.isArray(produto.tamanhos) && produto.tamanhos.length > 0) || (produto.grupos?.length ?? 0) > 0;
                        if (hasOptions) setModalProduto(produto);
                        else addToCart(produto, null, [], 1, {});
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
            precoPromocional={precoPromoModal}
            onClose={() => { setModalProduto(null); setPrecoPromoModal(null); }}
            onAdd={(tamanho, extras, qtd, gruposSel) => { addToCart(modalProduto, tamanho, extras, qtd, gruposSel, precoPromoModal); setModalProduto(null); setPrecoPromoModal(null); }}
          />
        )}
        {navComum}
      </View>
    );
  }

  // ── List screen (partner selection) ─────────────────────────────────────────
  const parceirosFiltrados = subcategoriaFiltro === null
    ? parceiros
    : parceiros.filter(p => Number(p.subcategoria_id) === subcategoriaFiltro);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: MOD_COLOR }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <Text style={[styles.headerTitle, { fontFamily: "Inter_700Bold", color: "#fff" }]}>Pedir Comida</Text>
        <View style={{ width: 30 }} />
      </View>

      {/* Carrossel de subcategorias */}
      {subcategorias.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}
          contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 10, gap: 8, alignItems: "center" }}
        >
          <Pressable
            onPress={() => setSubcategoriaFiltro(null)}
            style={[styles.catChip, {
              backgroundColor: subcategoriaFiltro === null ? MOD_COLOR : colors.backgroundSecondary,
              borderColor: subcategoriaFiltro === null ? MOD_COLOR : colors.textMuted,
            }]}
          >
            <Text style={[styles.catText, {
              color: subcategoriaFiltro === null ? "#fff" : colors.text,
              fontFamily: subcategoriaFiltro === null ? "Inter_600SemiBold" : "Inter_400Regular",
            }]}>Todos</Text>
          </Pressable>
          {subcategorias.map(sub => {
            const sel = subcategoriaFiltro === sub.id;
            return (
              <Pressable
                key={sub.id}
                onPress={() => setSubcategoriaFiltro(sel ? null : sub.id)}
                style={[styles.catChip, {
                  backgroundColor: sel ? MOD_COLOR : colors.backgroundSecondary,
                  borderColor: sel ? MOD_COLOR : colors.textMuted,
                }]}
              >
                {sub.emoji ? <Text style={{ fontSize: 14 }}>{sub.emoji}</Text> : null}
                <Text style={[styles.catText, {
                  color: sel ? "#fff" : colors.text,
                  fontFamily: sel ? "Inter_600SemiBold" : "Inter_400Regular",
                }]}>{sub.nome}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {loadingParceiros ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <ActivityIndicator size="large" color={MOD_COLOR} />
          <Text style={[{ color: colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 14 }]}>
            Buscando restaurantes...
          </Text>
        </View>
      ) : parceirosFiltrados.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 }}>
          <Feather name="coffee" size={48} color={colors.textMuted} />
          <Text style={[{ color: colors.text, fontFamily: "Inter_700Bold", fontSize: 18, textAlign: "center" }]}>
            {subcategoriaFiltro ? "Nenhum restaurante nesta categoria" : "Nenhum restaurante disponível"}
          </Text>
          <Text style={[{ color: colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center" }]}>
            {subcategoriaFiltro ? "Tente selecionar outra categoria ou ver todos." : "Em breve novos parceiros na sua área!"}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + SEGMENTO_NAV_HEIGHT + 16, padding: 16, gap: 12 }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_700Bold" }]}>
            {subcategoriaFiltro
              ? (subcategorias.find(s => s.id === subcategoriaFiltro)?.nome ?? "Restaurantes")
              : "Restaurantes parceiros"}
          </Text>
          {parceirosFiltrados.map(parceiro => {
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
  catChip: { height: 36, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1.5, alignItems: "center", justifyContent: "center", flexShrink: 0, alignSelf: "center", flexDirection: "row", gap: 4 },
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
function ProdutoModal({ produto, accentColor, colors, insets, onClose, onAdd, precoPromocional }: {
  produto: Produto;
  accentColor: string;
  colors: any;
  insets: { bottom: number };
  precoPromocional?: number | null;
  onClose: () => void;
  onAdd: (tamanho: Tamanho | null, extras: Extra[], qtd: number, gruposSel: Record<number, OpcaoGrupo[]>) => void;
}) {
  const tamanhos = Array.isArray(produto.tamanhos) ? produto.tamanhos : [];
  const grupos = Array.isArray(produto.grupos) ? produto.grupos : [];
  const [extrasSel, setExtrasSel] = useState<Extra[]>([]);
  const [gruposSel, setGruposSel] = useState<Record<number, OpcaoGrupo[]>>({});
  const [tamanhoSel, setTamanhoSel] = useState<Tamanho | null>(tamanhos.length > 0 ? tamanhos[0] : null);
  const [qtd, setQtd] = useState(1);

  const basePreco = precoPromocional != null ? precoPromocional : (tamanhoSel ? Number(tamanhoSel.preco) : Number(produto.preco));
  const gruposPreco = Object.values(gruposSel).flat().reduce((s, o) => s + Number(o.preco_adicional), 0);
  const precoTotal = (basePreco + extrasSel.reduce((s, e) => s + Number(e.preco), 0) + gruposPreco) * qtd;

  const toggleExtra = (extra: Extra) => {
    setExtrasSel(prev =>
      prev.find(e => e.id === extra.id) ? prev.filter(e => e.id !== extra.id) : [...prev, extra]
    );
  };

  const toggleOpcaoGrupo = (grupo: Grupo, opcao: OpcaoGrupo) => {
    setGruposSel(prev => {
      const current = prev[grupo.id] ?? [];
      const already = current.find(o => o.id === opcao.id);
      if (grupo.max_selecoes === 1) {
        return { ...prev, [grupo.id]: already ? [] : [opcao] };
      }
      if (already) {
        return { ...prev, [grupo.id]: current.filter(o => o.id !== opcao.id) };
      }
      if (current.length >= grupo.max_selecoes) return prev;
      return { ...prev, [grupo.id]: [...current, opcao] };
    });
  };

  const gruposObrigatoriosPendentes = grupos.filter(g => {
    if (!g.obrigatorio) return false;
    const sel = gruposSel[g.id] ?? [];
    return sel.length < g.min_selecoes;
  });
  const canAdd = gruposObrigatoriosPendentes.length === 0;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={mStyles.overlay}>
        <Pressable style={StyleSheet.absoluteFillObject as any} onPress={onClose} />
        <View style={[mStyles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 }]}>
          <View style={[mStyles.handle, { backgroundColor: colors.border }]} />

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
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

            {precoPromocional != null ? (
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 14, textDecorationLine: "line-through", fontFamily: "Inter_400Regular" }}>
                  R$ {Number(produto.preco).toFixed(2)}
                </Text>
                <Text style={[mStyles.basePreco, { color: accentColor, fontFamily: "Inter_700Bold" }]}>
                  R$ {precoPromocional.toFixed(2)}
                </Text>
              </View>
            ) : (
              <Text style={[mStyles.basePreco, { color: accentColor, fontFamily: "Inter_700Bold" }]}>
                R$ {basePreco.toFixed(2)}
              </Text>
            )}

            {tamanhos.length > 0 && (
              <>
                <Text style={[mStyles.sectionLabel, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Tamanho</Text>
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
                        <View style={[mStyles.extraCheck, { borderRadius: 999, borderColor: sel ? accentColor : colors.border, backgroundColor: "transparent" }]}>
                          {sel && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accentColor }} />}
                        </View>
                        <Text style={[mStyles.extraNome, { color: colors.text, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>{t.nome}</Text>
                        <Text style={[mStyles.extraPreco, { color: accentColor, fontFamily: "Inter_600SemiBold" }]}>R$ {Number(t.preco).toFixed(2)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            {grupos.map(grupo => {
              const selGrupo = gruposSel[grupo.id] ?? [];
              const isRadio = grupo.max_selecoes === 1;
              return (
                <View key={grupo.id}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, marginBottom: 6 }}>
                    <View>
                      <Text style={[mStyles.sectionLabel, { color: colors.text, fontFamily: "Inter_700Bold", marginTop: 0 }]}>{grupo.nome}</Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted, fontFamily: "Inter_400Regular" }}>
                        {grupo.obrigatorio ? "Obrigatório" : "Opcional"} • Escolha até {grupo.max_selecoes}
                      </Text>
                    </View>
                    {grupo.obrigatorio && selGrupo.length >= grupo.min_selecoes && (
                      <View style={{ backgroundColor: "#10B98120", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ color: "#10B981", fontSize: 11, fontFamily: "Inter_600SemiBold" }}>✓ Ok</Text>
                      </View>
                    )}
                  </View>
                  {grupo.opcoes.map(opcao => {
                    const sel = !!selGrupo.find(o => o.id === opcao.id);
                    return (
                      <Pressable key={opcao.id} onPress={() => toggleOpcaoGrupo(grupo, opcao)}
                        style={[mStyles.extraRow, {
                          borderColor: sel ? accentColor : colors.border,
                          backgroundColor: sel ? accentColor + "12" : colors.backgroundSecondary,
                          marginBottom: 8,
                        }]}>
                        <View style={[mStyles.extraCheck, {
                          borderRadius: isRadio ? 999 : 4,
                          borderColor: sel ? accentColor : colors.border,
                          backgroundColor: sel ? accentColor : "transparent",
                        }]}>
                          {sel && (isRadio
                            ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" }} />
                            : <Feather name="check" size={11} color="#fff" />
                          )}
                        </View>
                        <Text style={[mStyles.extraNome, { color: colors.text, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>{opcao.nome}</Text>
                        {Number(opcao.preco_adicional) > 0 && (
                          <Text style={[mStyles.extraPreco, { color: accentColor, fontFamily: "Inter_600SemiBold" }]}>
                            +R$ {Number(opcao.preco_adicional).toFixed(2)}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}

            {produto.extras.length > 0 && (
              <>
                <Text style={[mStyles.sectionLabel, { color: colors.text, fontFamily: "Inter_700Bold" }]}>Adicionais</Text>
                <View>
                  {produto.extras.map(extra => {
                    const sel = !!extrasSel.find(e => e.id === extra.id);
                    return (
                      <Pressable key={extra.id} onPress={() => toggleExtra(extra)}
                        style={[mStyles.extraRow, {
                          borderColor: sel ? accentColor : colors.border,
                          backgroundColor: sel ? accentColor + "12" : colors.backgroundSecondary,
                          marginBottom: 8,
                        }]}>
                        <View style={[mStyles.extraCheck, { borderColor: sel ? accentColor : colors.border, backgroundColor: sel ? accentColor : "transparent" }]}>
                          {sel && <Feather name="check" size={11} color="#fff" />}
                        </View>
                        <Text style={[mStyles.extraNome, { color: colors.text, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>{extra.nome}</Text>
                        {Number(extra.preco) > 0 && (
                          <Text style={[mStyles.extraPreco, { color: accentColor, fontFamily: "Inter_600SemiBold" }]}>
                            +R$ {Number(extra.preco).toFixed(2)}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </ScrollView>

          {!canAdd && (
            <Text style={{ color: "#EF4444", fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", paddingTop: 6 }}>
              Selecione as opções obrigatórias: {gruposObrigatoriosPendentes.map(g => g.nome).join(", ")}
            </Text>
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
            <Pressable
              onPress={() => canAdd && onAdd(tamanhoSel, extrasSel, qtd, gruposSel)}
              style={[mStyles.addBtn, { backgroundColor: canAdd ? accentColor : colors.textMuted }]}
            >
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
