import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, useColorScheme, Platform, Alert, ActivityIndicator, Image, TextInput } from "react-native";
import PixPagamento from "@/components/PixPagamento";
import SegmentoBottomNav, { SEGMENTO_NAV_HEIGHT } from "@/components/SegmentoBottomNav";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import Colors from "@/constants/colors";
import { useCart } from "@/context/CartContext";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { useAuthGate } from "@/components/AuthGate";
import PaymentSelector from "@/components/PaymentSelector";
import { getWallet, checkoutPayment } from "@/api/payments";
import * as Linking from "expo-linking";

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

type ConfigEntrega = {
  tipo: string; taxa_fixa: number; taxa_por_km: number;
  km_minimo: number; taxa_minima: number; raio_max_km: number | null; ativo: boolean;
};

type PlaceSuggestion = {
  place_id: string; description: string; main_text: string; secondary_text: string;
};

export default function ClienteEcommerce() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;
  const [categoriaSel, setCategoriaSel] = useState("Todos");
  const [showCarrinho, setShowCarrinho] = useState(false);
  const [pedidoFeito, setPedidoFeito] = useState(false);
  const [pedidoId, setPedidoId] = useState<number | null>(null);
  const pedidoFormaPagamentoRef = useRef<string | null>(null);
  const pedidoEmpresaIdRef = useRef<number | null>(null);
  const [produtosDB, setProdutosDB] = useState<ProdutoDB[]>([]);
  const [loadingProdutos, setLoadingProdutos] = useState(true);
  const [enviandoPedido, setEnviandoPedido] = useState(false);
  const params = useLocalSearchParams<{ empresaId?: string; nomeEmpresa?: string; corEmpresa?: string }>();
  const empresaId = Number(params.empresaId ?? 0);
  const nomeEmpresa = params.nomeEmpresa ?? "Loja Online";
  const corEmpresa = params.corEmpresa ?? MOD_COLOR;

  const { customer } = useCustomerAuth();
  const { requireAuth } = useAuthGate("/cliente/ecommerce");
  const { items, vendor, totalQtd, addItem, removeItem, updateQtd, clearCart } = useCart();

  const [metodosPag, setMetodosPag] = useState<string[]>(["pix", "dinheiro", "credito", "debito"]);
  const [formaSel, setFormaSel] = useState<string | null>(null);
  const [paymentSource, setPaymentSource] = useState<"direto" | "mercado_pago" | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    if (customer?.token) {
      getWallet(customer.token).then(d => setWalletBalance(d.balanceCents)).catch(() => {});
    }
  }, [customer?.token]);

  const [tipoEntrega, setTipoEntrega] = useState<"delivery" | "retirar">("delivery");
  const [horarioRetirada, setHorarioRetirada] = useState("");
  const [tempoEntregaEco, setTempoEntregaEco] = useState(30);

  // ── Delivery fee + address autocomplete state ─────────────────────────────
  const [configEntrega, setConfigEntrega] = useState<ConfigEntrega | null>(null);
  const [taxaCalculada, setTaxaCalculada] = useState<number | null>(null);
  const [calculandoFrete, setCalculandoFrete] = useState(false);
  const [freteInfo, setFreteInfo] = useState<{ distancia_km?: number; duracao?: string; fora_raio?: boolean; mensagem?: string } | null>(null);

  const [inputBusca, setInputBusca] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [placeSel, setPlaceSel] = useState<PlaceSuggestion | null>(null);
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessiontoken = useRef(Math.random().toString(36).slice(2));

  useEffect(() => {
    if (!empresaId) { setLoadingProdutos(false); return; }
    setLoadingProdutos(true);
    fetch(`${API_BASE}/public/ecommerce/${empresaId}/produtos`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setProdutosDB(data); })
      .catch(() => {})
      .finally(() => setLoadingProdutos(false));
    fetch(`${API_BASE}/public/ecommerce/${empresaId}/formas-pagamento`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data?.metodos) && data.metodos.length) setMetodosPag(data.metodos); })
      .catch(() => {});
    // Load full delivery config (for km-based freight calculation)
    fetch(`${API_BASE}/food/empresa/${empresaId}/config-entrega`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setConfigEntrega(d);
          setTempoEntregaEco(30);
          // If fixed rate, set it immediately
          if (d.tipo === "fixa") setTaxaCalculada(Number(d.taxa_fixa ?? 0));
        }
      })
      .catch(() => {});
  }, [empresaId]);

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  const categorias = ["Todos", ...Array.from(new Set(produtosDB.map(p => p.categoria).filter(Boolean) as string[]))];
  const produtosFiltrados = categoriaSel === "Todos" ? produtosDB : produtosDB.filter(p => p.categoria === categoriaSel);

  const myItems = vendor?.id === empresaId ? items : [];
  const myQtd = myItems.reduce((s, c) => s + c.qtd, 0);
  const myTotal = myItems.reduce((s, c) => s + c.produto.preco * c.qtd, 0);

  const vendor_info = { id: empresaId, nome: nomeEmpresa, cor: corEmpresa, modulo: "ecommerce" };

  // ── Derived address ───────────────────────────────────────────────────────
  const enderecoFinal = placeSel
    ? [placeSel.description.replace(/,\s*\d{5}-?\d{3}.*$/, "").trim(), numero, complemento].filter(Boolean).join(", ")
    : "";

  // ── Autocomplete functions ────────────────────────────────────────────────
  const buscarSugestoes = (text: string) => {
    setInputBusca(text);
    setPlaceSel(null);
    setNumero("");
    setComplemento("");
    setTaxaCalculada(configEntrega?.tipo === "fixa" ? Number(configEntrega.taxa_fixa ?? 0) : null);
    setFreteInfo(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 3) { setSuggestions([]); setShowSuggestions(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`${API_BASE}/food/places/autocomplete?input=${encodeURIComponent(text)}&sessiontoken=${sessiontoken.current}`);
        const data = await r.json();
        setSuggestions(Array.isArray(data) ? data : []);
        setShowSuggestions(true);
      } catch { setSuggestions([]); }
    }, 350);
  };

  const selecionarPlace = (place: PlaceSuggestion) => {
    setPlaceSel(place);
    setInputBusca(place.main_text);
    setSuggestions([]);
    setShowSuggestions(false);
    sessiontoken.current = Math.random().toString(36).slice(2);
  };

  const calcularFrete = async (endDest: string) => {
    if (!endDest.trim() || endDest.trim().length < 8) return;
    setCalculandoFrete(true);
    setFreteInfo(null);
    try {
      const r = await fetch(`${API_BASE}/food/empresa/${empresaId}/calcular-frete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endereco_destino: endDest }),
      });
      const data = await r.json();
      if (data.fora_raio) {
        setTaxaCalculada(null);
        setFreteInfo({ fora_raio: true, distancia_km: data.distancia_km, mensagem: data.mensagem });
      } else if (data.taxa_entrega !== null && data.taxa_entrega !== undefined) {
        setTaxaCalculada(Number(data.taxa_entrega));
        setFreteInfo({ distancia_km: data.distancia_km, duracao: data.duracao });
      }
    } catch { /* silent */ }
    setCalculandoFrete(false);
  };

  // Trigger fee calc when place + number are set (for km config)
  useEffect(() => {
    if (placeSel && numero && configEntrega?.tipo === "km" && empresaId) {
      calcularFrete(enderecoFinal);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeSel, numero]);

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
    if (tipoEntrega === "delivery" && freteInfo?.fora_raio) {
      Alert.alert("Fora do raio", freteInfo.mensagem ?? "Seu endereço está fora do raio de entrega.");
      return;
    }
    setEnviandoPedido(true);
    try {
      const taxa = tipoEntrega === "delivery" ? (taxaCalculada ?? 0) : 0;
      const totalFinal = myTotal + taxa;
      const body = {
        empresa_id: empresaId,
        itens: myItems.map(c => ({ nome: c.produto.nome, quantidade: c.qtd, preco: c.produto.preco })),
        total: totalFinal,
        taxa_entrega: taxa,
        tipo_entrega: tipoEntrega,
        horario_retirada: tipoEntrega === "retirar" ? (horarioRetirada || "A combinar") : null,
        cliente_nome: customer?.nome || "Cliente App",
        cliente_telefone: customer?.whatsapp || "",
        cliente_endereco: tipoEntrega === "delivery" ? enderecoFinal : "",
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
      
      if (paymentSource === "mercado_pago") {
        try {
          const checkout = await checkoutPayment(customer?.token || "", {
            module: "ecommerce",
            referenceId: data.id,
            paymentSource: "mercado_pago",
            mercadoPagoMethod: formaSel as any
          });
          if (checkout.sandboxInitPoint) {
            Linking.openURL(checkout.sandboxInitPoint);
          } else if (checkout.initPoint) {
            Linking.openURL(checkout.initPoint);
          }
        } catch (e: any) {
          Alert.alert("Aviso", "Pedido criado, mas houve falha ao iniciar o Mercado Pago.");
        }
      }

      setPedidoId(data.id ?? null);
      pedidoFormaPagamentoRef.current = formaSel;
      pedidoEmpresaIdRef.current = empresaId;
      clearCart();
      setShowCarrinho(false);
      setPedidoFeito(true);
      if (formaSel !== "pix") {
        setTimeout(() => {
          setPedidoFeito(false);
          setFormaSel(null);
          pedidoFormaPagamentoRef.current = null;
          pedidoEmpresaIdRef.current = null;
        }, 4000);
      }
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível finalizar o pedido. Tente novamente.");
    } finally {
      setEnviandoPedido(false);
    }
  };

  if (pedidoFeito) {
    const formaPedido = pedidoFormaPagamentoRef.current ?? formaSel;
    const empresaIdPedido = pedidoEmpresaIdRef.current ?? empresaId;
    if (formaPedido === "pix" && empresaIdPedido) {
      return (
        <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }]}>
          <PixPagamento
            empresaId={empresaIdPedido}
            pedidoId={pedidoId}
            modulo="ecommerce"
            colors={colors}
            onClose={() => {
              pedidoFormaPagamentoRef.current = null;
              pedidoEmpresaIdRef.current = null;
              setPedidoFeito(false);
              setPedidoId(null);
              setFormaSel(null);
            }}
          />
        </View>
      );
    }
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
    const taxaEntrega = tipoEntrega === "retirar" ? 0 : (taxaCalculada ?? 0);
    const totalFinal = myTotal + taxaEntrega;
    const isFixa = configEntrega?.tipo === "fixa";
    const isKm = configEntrega?.tipo === "km";
    const semEnderecoKm = isKm && tipoEntrega === "delivery" && taxaCalculada === null && !freteInfo?.fora_raio;

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {enviandoPedido && (
          <View style={{ position: "absolute", inset: 0, zIndex: 99, backgroundColor: "#00000060", alignItems: "center", justifyContent: "center" }}>
            <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 28, alignItems: "center", gap: 14 }}>
              <ActivityIndicator size="large" color={corEmpresa} />
              <Text style={{ color: colors.text, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>Enviando pedido...</Text>
            </View>
          </View>
        )}
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

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + SEGMENTO_NAV_HEIGHT + 16, gap: 10 }}>
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
            <>
              {/* ── Subtotal / Taxa / Total ──────────────────────── */}
              <View style={[{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 16, gap: 8 }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={[{ color: colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 14 }]}>Subtotal</Text>
                  <Text style={[{ color: colors.text, fontFamily: "Inter_600SemiBold", fontSize: 14 }]}>R$ {myTotal.toFixed(2)}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <Text style={[{ color: colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 14 }]}>Taxa de entrega</Text>
                    {!!freteInfo?.distancia_km && (
                      <Text style={[{ color: colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 11 }]}>
                        {freteInfo.distancia_km} km • {freteInfo.duracao ?? ""}
                      </Text>
                    )}
                  </View>
                  {tipoEntrega === "retirar" ? (
                    <Text style={[{ color: "#10B981", fontFamily: "Inter_600SemiBold", fontSize: 14 }]}>Grátis</Text>
                  ) : calculandoFrete ? (
                    <ActivityIndicator size="small" color={corEmpresa} />
                  ) : freteInfo?.fora_raio ? (
                    <Text style={[{ color: "#EF4444", fontFamily: "Inter_600SemiBold", fontSize: 13 }]}>Fora do raio</Text>
                  ) : semEnderecoKm ? (
                    <Text style={[{ color: colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 12 }]}>informe o endereço</Text>
                  ) : isFixa && (configEntrega?.taxa_fixa ?? 0) === 0 ? (
                    <Text style={[{ color: "#10B981", fontFamily: "Inter_600SemiBold", fontSize: 14 }]}>Grátis</Text>
                  ) : (
                    <Text style={[{ color: taxaEntrega > 0 ? colors.text : "#10B981", fontFamily: "Inter_600SemiBold", fontSize: 14 }]}>
                      {taxaEntrega > 0 ? `R$ ${taxaEntrega.toFixed(2)}` : "Grátis"}
                    </Text>
                  )}
                </View>
                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 2 }} />
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={[{ color: colors.text, fontFamily: "Inter_700Bold", fontSize: 16 }]}>Total</Text>
                  <Text style={[{ color: corEmpresa, fontFamily: "Inter_700Bold", fontSize: 22 }]}>
                    {semEnderecoKm || freteInfo?.fora_raio ? `R$ ${myTotal.toFixed(2)}+` : `R$ ${totalFinal.toFixed(2)}`}
                  </Text>
                </View>
              </View>

              {/* ── Tipo de entrega ──────────────────────────────── */}
              <View style={{ gap: 10 }}>
                <Text style={{ color: colors.text, fontFamily: "Inter_700Bold", fontSize: 15 }}>Tipo de entrega</Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable onPress={() => setTipoEntrega("delivery")}
                    style={[{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 2,
                      borderColor: tipoEntrega === "delivery" ? corEmpresa : colors.border,
                      backgroundColor: tipoEntrega === "delivery" ? corEmpresa + "15" : colors.card }]}>
                    <Feather name="truck" size={20} color={tipoEntrega === "delivery" ? corEmpresa : colors.textMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={[{ color: colors.text, fontFamily: tipoEntrega === "delivery" ? "Inter_700Bold" : "Inter_500Medium", fontSize: 14 }]}>Delivery</Text>
                      <Text style={[{ color: colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 11 }]}>{tempoEntregaEco} min</Text>
                    </View>
                    {tipoEntrega === "delivery" && <Feather name="check-circle" size={18} color={corEmpresa} />}
                  </Pressable>
                  <Pressable onPress={() => setTipoEntrega("retirar")}
                    style={[{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 2,
                      borderColor: tipoEntrega === "retirar" ? corEmpresa : colors.border,
                      backgroundColor: tipoEntrega === "retirar" ? corEmpresa + "15" : colors.card }]}>
                    <Feather name="shopping-bag" size={20} color={tipoEntrega === "retirar" ? corEmpresa : colors.textMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={[{ color: colors.text, fontFamily: tipoEntrega === "retirar" ? "Inter_700Bold" : "Inter_500Medium", fontSize: 14 }]}>Retirar</Text>
                      <Text style={[{ color: colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 11 }]}>Na loja</Text>
                    </View>
                    {tipoEntrega === "retirar" && <Feather name="check-circle" size={18} color={corEmpresa} />}
                  </Pressable>
                </View>

                {/* ── Address autocomplete (delivery only) ─────── */}
                {tipoEntrega === "delivery" && configEntrega && (
                  <View style={{ gap: 6 }}>
                    <Text style={[{ color: colors.text, fontFamily: "Inter_600SemiBold", fontSize: 13 }]}>
                      Endereço de entrega
                    </Text>

                    {placeSel ? (
                      <View style={{ gap: 8 }}>
                        <View style={[{ backgroundColor: corEmpresa + "12", borderWidth: 1.5, borderColor: corEmpresa, borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "flex-start", gap: 8 }]}>
                          <Feather name="map-pin" size={16} color={corEmpresa} style={{ marginTop: 2 }} />
                          <View style={{ flex: 1 }}>
                            <Text style={[{ color: colors.text, fontFamily: "Inter_600SemiBold", fontSize: 13 }]}>{placeSel.main_text}</Text>
                            {placeSel.secondary_text ? (
                              <Text style={[{ color: colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 11 }]}>{placeSel.secondary_text}</Text>
                            ) : null}
                          </View>
                          <Pressable onPress={() => {
                            setPlaceSel(null); setInputBusca(""); setNumero(""); setComplemento("");
                            setTaxaCalculada(configEntrega?.tipo === "fixa" ? Number(configEntrega.taxa_fixa ?? 0) : null);
                            setFreteInfo(null);
                          }}>
                            <Feather name="x" size={16} color={colors.textMuted} />
                          </Pressable>
                        </View>
                        {/* Número + Complemento */}
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <TextInput
                            style={[{ flex: 1, backgroundColor: colors.card, borderWidth: 1.5, borderColor: numero ? corEmpresa : colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, fontFamily: "Inter_400Regular", fontSize: 14 }]}
                            placeholder="Número"
                            placeholderTextColor={colors.textMuted}
                            value={numero}
                            onChangeText={setNumero}
                            keyboardType="numeric"
                            returnKeyType="next"
                          />
                          <TextInput
                            style={[{ flex: 2, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, fontFamily: "Inter_400Regular", fontSize: 14 }]}
                            placeholder="Complemento (apto, bloco...)"
                            placeholderTextColor={colors.textMuted}
                            value={complemento}
                            onChangeText={setComplemento}
                            returnKeyType="done"
                          />
                        </View>
                        {configEntrega.tipo === "km" && (
                          calculandoFrete ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <ActivityIndicator size="small" color={corEmpresa} />
                              <Text style={[{ color: colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 12 }]}>Calculando frete...</Text>
                            </View>
                          ) : freteInfo?.fora_raio ? (
                            <Text style={[{ color: "#EF4444", fontFamily: "Inter_400Regular", fontSize: 12 }]}>⚠ {freteInfo.mensagem ?? "Fora do raio de entrega"}</Text>
                          ) : freteInfo?.distancia_km ? (
                            <Text style={[{ color: "#10B981", fontFamily: "Inter_400Regular", fontSize: 12 }]}>✓ {freteInfo.distancia_km} km • frete R$ {taxaCalculada?.toFixed(2)}</Text>
                          ) : numero ? (
                            <Text style={[{ color: colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 11 }]}>Taxa mínima: R$ {configEntrega.taxa_minima.toFixed(2)}</Text>
                          ) : (
                            <Text style={[{ color: colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 11 }]}>Informe o número para calcular o frete</Text>
                          )
                        )}
                      </View>
                    ) : (
                      <View>
                        <View style={{ position: "relative" }}>
                          <Feather name="search" size={16} color={colors.textMuted} style={{ position: "absolute", left: 12, top: 13, zIndex: 1 }} />
                          <TextInput
                            style={[{ backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingLeft: 36, paddingVertical: 11, color: colors.text, fontFamily: "Inter_400Regular", fontSize: 14 }]}
                            placeholder="Buscar rua, avenida..."
                            placeholderTextColor={colors.textMuted}
                            value={inputBusca}
                            onChangeText={buscarSugestoes}
                            returnKeyType="search"
                            autoCorrect={false}
                          />
                        </View>
                        {showSuggestions && suggestions.length > 0 && (
                          <View style={[{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, marginTop: 4, overflow: "hidden" }]}>
                            {suggestions.slice(0, 5).map((s, i) => (
                              <Pressable
                                key={s.place_id}
                                onPress={() => selecionarPlace(s)}
                                style={[{ flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.border }]}
                              >
                                <Feather name="map-pin" size={14} color={corEmpresa} style={{ marginTop: 2 }} />
                                <View style={{ flex: 1 }}>
                                  <Text style={[{ color: colors.text, fontFamily: "Inter_500Medium", fontSize: 13 }]} numberOfLines={1}>{s.main_text}</Text>
                                  {s.secondary_text ? (
                                    <Text style={[{ color: colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 11 }]} numberOfLines={1}>{s.secondary_text}</Text>
                                  ) : null}
                                </View>
                              </Pressable>
                            ))}
                          </View>
                        )}
                        {inputBusca.length >= 3 && suggestions.length === 0 && !showSuggestions && (
                          <Text style={[{ color: colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 6 }]}>
                            Nenhuma sugestão encontrada. Tente um endereço mais completo.
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                )}

                {tipoEntrega === "retirar" && (
                  <View style={{ gap: 8 }}>
                    <Text style={[{ color: colors.text, fontFamily: "Inter_600SemiBold", fontSize: 13 }]}>Horário de retirada</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {["Agora", "15 min", "30 min", "1 hora"].map(opt => (
                        <Pressable key={opt} onPress={() => setHorarioRetirada(opt)}
                          style={[{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
                            borderColor: horarioRetirada === opt ? corEmpresa : colors.border,
                            backgroundColor: horarioRetirada === opt ? corEmpresa + "18" : colors.backgroundSecondary }]}>
                          <Text style={[{ color: horarioRetirada === opt ? corEmpresa : colors.text,
                            fontFamily: horarioRetirada === opt ? "Inter_600SemiBold" : "Inter_400Regular", fontSize: 13 }]}>{opt}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <TextInput
                      style={[{ backgroundColor: colors.card, borderWidth: 1.5,
                        borderColor: horarioRetirada && !["Agora", "15 min", "30 min", "1 hora"].includes(horarioRetirada) ? corEmpresa : colors.border,
                        borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
                        color: colors.text, fontFamily: "Inter_400Regular", fontSize: 14 }]}
                      placeholder="Ou digite o horário: ex. 14:30"
                      placeholderTextColor={colors.textMuted}
                      value={["Agora", "15 min", "30 min", "1 hora"].includes(horarioRetirada) ? "" : horarioRetirada}
                      onChangeText={v => setHorarioRetirada(v)}
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                    />
                  </View>
                )}
              </View>

              {/* ── Forma de pagamento ───────────────────────────── */}
              <View style={{ marginTop: 4, gap: 10 }}>
                <Text style={{ color: colors.text, fontFamily: "Inter_700Bold", fontSize: 15 }}>Pagamento</Text>
                <PaymentSelector
                  empresaId={empresaId}
                  token={customer?.token}
                  colors={colors}
                  accentColor={corEmpresa}
                  directMethods={metodosPag.map(m => ({
                    id: m,
                    label: PAG_META[m]?.label || m,
                    icon: "credit-card",
                    color: corEmpresa
                  }))}
                  selectedSource={paymentSource}
                  onSourceSelect={(src) => setPaymentSource(src)}
                  selectedMethod={formaSel}
                  onMethodSelect={(m) => setFormaSel(m)}
                  walletBalanceCents={walletBalance}
                />
              </View>
            </>
          )}
        </ScrollView>
        <SegmentoBottomNav
          ativo="carrinho"
          corAtivo={corEmpresa}
          qtdCarrinho={myQtd}
          onInicio={() => setShowCarrinho(false)}
          onCarrinho={() => {}}
          onFinalizar={myItems.length > 0 ? () => requireAuth(() => handleFinalizar()) : undefined}
          empresaId={empresaId || null}
          empresaNome={nomeEmpresa}
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
        empresaId={empresaId || null}
        empresaNome={nomeEmpresa}
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
  carrinhoItem: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 12, gap: 12 },
  carrinhoImagem: { width: 50, height: 50, borderRadius: 10, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  carrinhoImagemImg: { width: 50, height: 50, borderRadius: 10 },
  carrinhoInfo: { flex: 1 },
  carrinhoNome: { fontSize: 14, marginBottom: 4 },
  carrinhoPreco: { fontSize: 16 },
  qtdControls: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtdBtn: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  qtdNum: { fontSize: 16, minWidth: 20, textAlign: "center" },
  sucessoCard: { borderRadius: 20, borderWidth: 1, padding: 32, alignItems: "center", marginHorizontal: 32, gap: 12 },
  checkCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  sucessoTitulo: { fontSize: 22 },
  sucessoSub: { fontSize: 14, textAlign: "center", lineHeight: 22 },
});
