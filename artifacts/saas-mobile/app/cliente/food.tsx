import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  useColorScheme, Platform, ActivityIndicator, Alert, Image, Modal, TextInput,
} from "react-native";
import PixPagamento from "@/components/PixPagamento";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import Colors from "@/constants/colors";
import { useAuthGate } from "@/components/AuthGate";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import SegmentoBottomNav, { SEGMENTO_NAV_HEIGHT } from "@/components/SegmentoBottomNav";
import PaymentSelector from "@/components/PaymentSelector";
import { getWallet, checkoutPayment } from "@/api/payments";
import * as Linking from "expo-linking";

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
  subcategoria_id: number | null;
  subcategoria_nome: string | null;
  subcategoria_slug: string | null;
  subcategoria_emoji: string | null;
};

type Categoria = { id: number; nome: string; ordem: number };
type Extra = { id: number; nome: string; preco: number; obrigatorio?: boolean };
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
  preco_promocional?: number | null;
  quantidade_disponivel_promo?: number | null;
  promo_id?: number | null;
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
  const [pedidoId, setPedidoId] = useState<number | null>(null);
  const [enviandoPedido, setEnviandoPedido] = useState(false);
  const [paymentSource, setPaymentSource] = useState<"direto" | "mercado_pago" | null>(null);
  const [formaEscolhida, setFormaEscolhida] = useState<string | null>(null);
  const [formasPagamento, setFormasPagamento] = useState<string[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    if (customer?.token) {
      getWallet(customer.token).then(d => setWalletBalance(d.balanceCents)).catch(() => {});
    }
  }, [customer?.token]);

  // Captura a forma de pagamento e parceiro no momento exato do pedido,
  // evitando race conditions com o estado formaEscolhida em producao (New Arch)
  const pedidoFormaPagamentoRef = React.useRef<string | null>(null);
  const pedidoParceiroIdRef = React.useRef<number | null>(null);
  const [modalProduto, setModalProduto] = useState<Produto | null>(null);
  const [tipoEntrega, setTipoEntrega] = useState<"delivery" | "retirar">("delivery");
  const [horarioRetirada, setHorarioRetirada] = useState("");

  const totalCarrinho = carrinho.reduce((s, c) => s + c.precoUnitario * c.qtd, 0);
  const qtdCarrinho = carrinho.reduce((s, c) => s + c.qtd, 0);

  // ── Delivery fee + address autocomplete state ────────────────────────────────
  type ConfigEntrega = { tipo: string; taxa_fixa: number; taxa_por_km: number; km_minimo: number; taxa_minima: number; raio_max_km: number | null; ativo: boolean };
  type PlaceSuggestion = { place_id: string; description: string; main_text: string; secondary_text: string };

  const [configEntrega, setConfigEntrega] = useState<ConfigEntrega | null>(null);
  const [enderecoEntrega, setEnderecoEntrega] = useState("");
  const [taxaCalculada, setTaxaCalculada] = useState<number | null>(null);
  const [calculandoFrete, setCalculandoFrete] = useState(false);
  const [freteInfo, setFreteInfo] = useState<{ distancia_km?: number; duracao?: string; fora_raio?: boolean; mensagem?: string } | null>(null);

  // Autocomplete
  const [inputBusca, setInputBusca] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [placeSel, setPlaceSel] = useState<PlaceSuggestion | null>(null);
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessiontoken = useRef(Math.random().toString(36).slice(2));

  const buscarSugestoes = (text: string) => {
    setInputBusca(text);
    setPlaceSel(null);
    setNumero("");
    setComplemento("");
    setTaxaCalculada(null);
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

  const enderecoFinal = placeSel
    ? [placeSel.description.replace(/,\s*\d{5}-?\d{3}.*$/, "").trim(), numero, complemento].filter(Boolean).join(", ")
    : enderecoEntrega;

  const calcularFrete = async (empresaId: number, endereco: string) => {
    if (!endereco.trim() || endereco.trim().length < 8) return;
    setCalculandoFrete(true);
    setFreteInfo(null);
    try {
      const r = await fetch(`${API_BASE}/food/empresa/${empresaId}/calcular-frete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endereco_destino: endereco }),
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
    if (placeSel && numero && configEntrega?.tipo === "km" && parceiroSel) {
      calcularFrete(parceiroSel.id, enderecoFinal);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeSel, numero]);

  // ── Fetch partners ──────────────────────────────────────────────────────────
  const { empresaId: empresaIdParam, produtoId: produtoIdParam, precoPromocional: precoPromocionalParam } = useLocalSearchParams<{ empresaId?: string; produtoId?: string; precoPromocional?: string }>();
  const [modalPrecoPromo, setModalPrecoPromo] = useState<number | null>(null);

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
    setTipoEntrega("delivery");
    setHorarioRetirada("");
    setEnderecoEntrega("");
    setTaxaCalculada(null);
    setFreteInfo(null);
    setConfigEntrega(null);
    setInputBusca("");
    setSuggestions([]);
    setShowSuggestions(false);
    setPlaceSel(null);
    setNumero("");
    setComplemento("");
    setLoadingCardapio(true);
    // Fetch delivery config in background
    fetch(`${API_BASE}/food/empresa/${p.id}/config-entrega`)
      .then(r => r.ok ? r.json() : null)
      .then(cfg => { if (cfg) setConfigEntrega(cfg); })
      .catch(() => {});
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
  const autoOpenedRef = useRef<string | null>(null);
  const [focusCount, setFocusCount] = useState(0);

  // Reset tracking every time screen gains focus so returning from home → promo
  // always re-opens the modal even if food screen was kept alive in the stack.
  useFocusEffect(
    React.useCallback(() => {
      autoOpenedRef.current = null;
      if (produtoIdParam) setFocusCount(c => c + 1);
    }, [produtoIdParam])
  );

  useEffect(() => {
    const key = `${produtoIdParam}_${precoPromocionalParam}`;
    if (autoOpenedRef.current === key) return;
    if (!produtoIdParam || !cardapio?.produtos?.length) return;
    const target = cardapio.produtos.find(p => String(p.id) === String(produtoIdParam));
    if (target) {
      const promoPrice = precoPromocionalParam && !isNaN(Number(precoPromocionalParam)) && Number(precoPromocionalParam) > 0
        ? Number(precoPromocionalParam)
        : null;
      setModalPrecoPromo(promoPrice);
      setModalProduto(target);
      autoOpenedRef.current = key;
    }
  }, [produtoIdParam, cardapio, precoPromocionalParam, focusCount]);

  // ── Cart helpers ────────────────────────────────────────────────────────────
  const addToCart = (produto: Produto, tamanhoSel: Tamanho | null, extrasSel: Extra[], qtdAdded: number, precoPromoOverride?: number | null, gruposSel?: Record<number, OpcaoGrupo[]>) => {
    const gs = gruposSel ?? {};
    const uid = makeUid(produto.id, tamanhoSel?.nome ?? "", extrasSel.map(e => e.id), gs);
    const basePreco = tamanhoSel ? Number(tamanhoSel.preco) : (precoPromoOverride != null ? precoPromoOverride : Number(produto.preco));
    const extrasTotal = extrasSel.reduce((s, e) => s + Number(e.preco), 0);
    const gruposTotal = Object.values(gs).flat().reduce((s, o) => s + Number(o.preco_adicional), 0);
    const precoUnitario = basePreco + extrasTotal + gruposTotal;
    setCarrinho(prev => {
      const ex = prev.find(c => c.uid === uid);
      if (ex) return prev.map(c => c.uid === uid ? { ...c, qtd: c.qtd + qtdAdded } : c);
      return [...prev, { uid, produto, qtd: qtdAdded, extrasSel, gruposSel: gs, tamanhoSel, precoUnitario }];
    });
  };

  const removeItem = (uid: string) => {
    setCarrinho(prev => prev.map(c => c.uid === uid ? { ...c, qtd: c.qtd - 1 } : c).filter(c => c.qtd > 0));
  };
  const addItemAgain = (c: CartItem) => addToCart(c.produto, c.tamanhoSel, c.extrasSel, 1, null, c.gruposSel);

  const getQtd = (produtoId: number) =>
    carrinho.filter(c => c.produto.id === produtoId).reduce((s, c) => s + c.qtd, 0);

  const handlePedido = async () => {
    if (!formaEscolhida || !parceiroSel) return;
    setEnviandoPedido(true);
    try {
      const taxaEntrega = tipoEntrega === "delivery" ? (taxaCalculada ?? 0) : 0;
      const totalPedido = totalCarrinho + taxaEntrega;

      if (tipoEntrega === "delivery" && freteInfo?.fora_raio) {
        Alert.alert("Fora do raio", freteInfo.mensagem ?? "Seu endereço está fora do raio de entrega.");
        setEnviandoPedido(false);
        return;
      }

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
        produto_id: c.produto.id,
        preco_promocional: c.precoUnitario < Number(c.produto.preco) ? c.precoUnitario : null,
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
          cliente_endereco: enderecoFinal || (customer as any)?.endereco || "",
          taxa_entrega: taxaEntrega,
          tipo_entrega: tipoEntrega,
          horario_retirada: tipoEntrega === "retirar" ? (horarioRetirada || "A combinar") : null,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        Alert.alert("Erro ao enviar pedido", err.message || "Tente novamente.");
        return;
      }
      const resData = await r.json().catch(() => ({}));
      
      if (paymentSource === "mercado_pago") {
        try {
          const checkout = await checkoutPayment(customer?.token || "", {
            module: "food",
            referenceId: resData.id,
            paymentSource: "mercado_pago",
            mercadoPagoMethod: formaEscolhida as any
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

      setPedidoId(resData.id ?? null);
      if (formaEscolhida === "credito_gotaxi") {
        setCreditoDisponivel(prev => Math.max(0, prev - totalPedido));
      }
      // Captura forma e parceiro ANTES do setPedidoFeito para evitar race condition
      pedidoFormaPagamentoRef.current = formaEscolhida;
      pedidoParceiroIdRef.current = parceiroSel?.id ?? null;
      setPedidoFeito(true);
      setCarrinho([]);
      if (formaEscolhida !== "pix") {
        setTimeout(() => {
          setPedidoFeito(false);
          setParceiroSel(null);
          setCardapio(null);
          setFormaEscolhida(null);
          pedidoFormaPagamentoRef.current = null;
          pedidoParceiroIdRef.current = null;
        }, 3500);
      }
    } catch {
      Alert.alert("Falha de conexão", "Verifique sua internet e tente novamente.");
    } finally {
      setEnviandoPedido(false);
    }
  };

  const accentColor = parceiroSel?.cor || MOD_COLOR;

  // ── Success screen ──────────────────────────────────────────────────────────
  if (pedidoFeito) {
    const formaPedido = pedidoFormaPagamentoRef.current ?? formaEscolhida;
    const fpSel = formaPedido ? FP_LABELS[formaPedido] : (fp ?? null);
    const parceiroIdPedido = pedidoParceiroIdRef.current ?? parceiroSel?.id ?? null;

    if (formaPedido === "pix" && parceiroIdPedido) {
      return (
        <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }]}>
          <PixPagamento
            empresaId={parceiroIdPedido}
            pedidoId={pedidoId}
            modulo="food"
            colors={colors}
            onClose={() => {
              pedidoFormaPagamentoRef.current = null;
              pedidoParceiroIdRef.current = null;
              setPedidoFeito(false);
              setPedidoId(null);
              setParceiroSel(null);
              setCardapio(null);
              setFormaEscolhida(null);
            }}
          />
        </View>
      );
    }

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
    const produtosFiltrados = cardapio?.produtos?.filter(p =>
      categoriaSel === null || p.categoria_id === categoriaSel
    ) ?? [];

    const canFinalizar = qtdCarrinho > 0 && (!showCarrinho || !!formaEscolhida);
    const navComum = (
      <SegmentoBottomNav
        ativo={showCarrinho ? "carrinho" : "inicio"}
        corAtivo={accentColor}
        qtdCarrinho={qtdCarrinho}
        empresaId={parceiroSel?.id ?? null}
        empresaNome={parceiroSel?.nome ?? null}
        clienteNome={customer?.nome ?? null}
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
                  {Object.values(c.gruposSel ?? {}).flat().length > 0 && (
                    <Text style={[styles.itemExtras, { color: colors.textMuted, fontFamily: "Inter_400Regular" }]} numberOfLines={3}>
                      {Object.entries(c.gruposSel ?? {}).map(([, ops]) => ops.map(o => o.nome).join(", ")).filter(Boolean).join(" · ")}
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
                  <Pressable onPress={() => addItemAgain(c)} style={[styles.qtdBtn, { backgroundColor: accentColor }]}>
                    <Feather name="plus" size={14} color="#fff" />
                  </Pressable>
                </View>
              </View>
            ))}

            {/* ── Subtotal / Taxa / Total ──────────────────────────────── */}
            {(() => {
              const taxaEntrega = tipoEntrega === "retirar" ? 0 : (taxaCalculada ?? 0);
              const totalFinal = totalCarrinho + taxaEntrega;
              const isFixa = configEntrega?.tipo === "fixa";
              const isKm = configEntrega?.tipo === "km";
              const semEnderecoKm = isKm && tipoEntrega === "delivery" && taxaCalculada === null && !freteInfo?.fora_raio;
              return (
                <View style={[{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 16, gap: 8 }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={[{ color: colors.textSecondary, fontFamily: "Inter_400Regular", fontSize: 14 }]}>Subtotal</Text>
                    <Text style={[{ color: colors.text, fontFamily: "Inter_600SemiBold", fontSize: 14 }]}>R$ {totalCarrinho.toFixed(2)}</Text>
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
                      <ActivityIndicator size="small" color={accentColor} />
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
                    <Text style={[{ color: accentColor, fontFamily: "Inter_700Bold", fontSize: 22 }]}>
                      {semEnderecoKm || freteInfo?.fora_raio ? `R$ ${totalCarrinho.toFixed(2)}+` : `R$ ${totalFinal.toFixed(2)}`}
                    </Text>
                  </View>
                </View>
              );
            })()}

            {/* ── Tipo de entrega ──────────────────────────────────────── */}
            <View style={{ gap: 10 }}>
              <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_700Bold", fontSize: 15 }]}>
                Tipo de entrega
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={() => setTipoEntrega("delivery")}
                  style={[{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 2,
                    borderColor: tipoEntrega === "delivery" ? accentColor : colors.border,
                    backgroundColor: tipoEntrega === "delivery" ? accentColor + "15" : colors.card }]}>
                  <Feather name="truck" size={20} color={tipoEntrega === "delivery" ? accentColor : colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={[{ color: colors.text, fontFamily: tipoEntrega === "delivery" ? "Inter_700Bold" : "Inter_500Medium", fontSize: 14 }]}>Delivery</Text>
                    <Text style={[{ color: colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 11 }]}>
                      {(parceiroSel as any)?.tempo_entrega_min ?? 30} min
                    </Text>
                  </View>
                  {tipoEntrega === "delivery" && <Feather name="check-circle" size={18} color={accentColor} />}
                </Pressable>
                <Pressable
                  onPress={() => setTipoEntrega("retirar")}
                  style={[{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 2,
                    borderColor: tipoEntrega === "retirar" ? accentColor : colors.border,
                    backgroundColor: tipoEntrega === "retirar" ? accentColor + "15" : colors.card }]}>
                  <Feather name="shopping-bag" size={20} color={tipoEntrega === "retirar" ? accentColor : colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={[{ color: colors.text, fontFamily: tipoEntrega === "retirar" ? "Inter_700Bold" : "Inter_500Medium", fontSize: 14 }]}>Retirar</Text>
                    <Text style={[{ color: colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 11 }]}>Na loja</Text>
                  </View>
                  {tipoEntrega === "retirar" && <Feather name="check-circle" size={18} color={accentColor} />}
                </Pressable>
              </View>
              {tipoEntrega === "delivery" && configEntrega && (
                <View style={{ gap: 6 }}>
                  <Text style={[{ color: colors.text, fontFamily: "Inter_600SemiBold", fontSize: 13 }]}>
                    Endereço de entrega
                  </Text>

                  {/* ── Selected place card ─────────────────────── */}
                  {placeSel ? (
                    <View style={{ gap: 8 }}>
                      <View style={[{ backgroundColor: accentColor + "12", borderWidth: 1.5, borderColor: accentColor, borderRadius: 10, padding: 12, flexDirection: "row", alignItems: "flex-start", gap: 8 }]}>
                        <Feather name="map-pin" size={16} color={accentColor} style={{ marginTop: 2 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={[{ color: colors.text, fontFamily: "Inter_600SemiBold", fontSize: 13 }]}>{placeSel.main_text}</Text>
                          {placeSel.secondary_text ? (
                            <Text style={[{ color: colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 11 }]}>{placeSel.secondary_text}</Text>
                          ) : null}
                        </View>
                        <Pressable onPress={() => { setPlaceSel(null); setInputBusca(""); setNumero(""); setComplemento(""); setTaxaCalculada(null); setFreteInfo(null); }}>
                          <Feather name="x" size={16} color={colors.textMuted} />
                        </Pressable>
                      </View>
                      {/* Número + Complemento */}
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <TextInput
                          style={[{ flex: 1, backgroundColor: colors.card, borderWidth: 1.5, borderColor: numero ? accentColor : colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, fontFamily: "Inter_400Regular", fontSize: 14 }]}
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
                      {/* Fee feedback */}
                      {configEntrega.tipo === "km" && (
                        calculandoFrete ? (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <ActivityIndicator size="small" color={accentColor} />
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
                    /* ── Search input + suggestions ──────────────── */
                    <View>
                      <View style={{ position: "relative" }}>
                        <Feather name="search" size={16} color={colors.textMuted} style={{ position: "absolute", left: 12, top: 13, zIndex: 1 }} />
                        <TextInput
                          style={[{
                            backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border,
                            borderRadius: showSuggestions && suggestions.length > 0 ? 10 : 10,
                            paddingHorizontal: 14, paddingLeft: 36, paddingVertical: 11,
                            color: colors.text, fontFamily: "Inter_400Regular", fontSize: 14,
                          }]}
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
                              <Feather name="map-pin" size={14} color={accentColor} style={{ marginTop: 2 }} />
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
                          borderColor: horarioRetirada === opt ? accentColor : colors.border,
                          backgroundColor: horarioRetirada === opt ? accentColor + "18" : colors.backgroundSecondary }]}>
                        <Text style={[{ color: horarioRetirada === opt ? accentColor : colors.text,
                          fontFamily: horarioRetirada === opt ? "Inter_600SemiBold" : "Inter_400Regular", fontSize: 13 }]}>{opt}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    style={[{ backgroundColor: colors.card, borderWidth: 1.5,
                      borderColor: horarioRetirada && !["Agora", "15 min", "30 min", "1 hora"].includes(horarioRetirada) ? accentColor : colors.border,
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

            {/* ── Payment method selector ──────────────────────────────── */}
            <View style={{ marginTop: 4 }}>
              <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: "Inter_700Bold", fontSize: 15, marginBottom: 10 }]}>
                Pagamento
              </Text>
              
              <PaymentSelector
                empresaId={parceiroSel.id}
                token={customer?.token}
                colors={colors}
                accentColor={accentColor}
                directMethods={formasPagamento.map(k => ({
                  id: k,
                  label: FP_LABELS[k]?.label || k,
                  icon: FP_LABELS[k]?.icon || "credit-card",
                  color: FP_LABELS[k]?.color || accentColor,
                  desc: k === "credito_gotaxi" ? `R$ ${creditoDisponivel.toFixed(2)} disponível` : undefined
                }))}
                selectedSource={paymentSource}
                onSourceSelect={(src) => setPaymentSource(src)}
                selectedMethod={formaEscolhida}
                onMethodSelect={(m) => setFormaEscolhida(m)}
                walletBalanceCents={walletBalance}
              />

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
            {(cardapio?.categorias?.length ?? 0) > 0 && (
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
                {cardapio?.categorias?.map(cat => (
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
                        const promoPrice = (produto.preco_promocional != null && Number(produto.preco_promocional) > 0) ? Number(produto.preco_promocional) : null;
                        if (hasOptions) { setModalPrecoPromo(promoPrice); setModalProduto(produto); }
                        else addToCart(produto, null, [], 1, promoPrice, {});
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
                        {produto.preco_promocional != null && Number(produto.preco_promocional) > 0 ? (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <Text style={[styles.itemPreco, { color: accentColor, fontFamily: "Inter_700Bold" }]}>
                              R$ {Number(produto.preco_promocional).toFixed(2)}
                            </Text>
                            <Text style={{ color: colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 12, textDecorationLine: "line-through" }}>
                              R$ {Number(produto.preco).toFixed(2)}
                            </Text>
                          </View>
                        ) : (
                          <Text style={[styles.itemPreco, { color: accentColor, fontFamily: "Inter_700Bold" }]}>
                            R$ {Number(produto.preco).toFixed(2)}
                          </Text>
                        )}
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
            precoPromocional={modalPrecoPromo}
            quantidadeDisponivelPromo={modalPrecoPromo != null ? (modalProduto.quantidade_disponivel_promo ?? null) : null}
            onClose={() => { setModalProduto(null); setModalPrecoPromo(null); }}
            onAdd={(tamanho, extras, qtd, precoPromo, gruposSel) => {
              addToCart(modalProduto, tamanho, extras, qtd, precoPromo, gruposSel);
              setModalProduto(null);
              setModalPrecoPromo(null);
            }}
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

      {/* Subcategoria filter chips */}
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
                {sub.emoji ? (
                  <Text style={{ fontSize: 14 }}>{sub.emoji}</Text>
                ) : null}
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
                  {parceiro.subcategoria_nome ? (
                    <Text style={[styles.metaText, { color: colors.textMuted, fontFamily: "Inter_400Regular", fontSize: 12, marginBottom: 2 }]}>
                      {parceiro.subcategoria_emoji ? `${parceiro.subcategoria_emoji} ` : ""}{parceiro.subcategoria_nome}
                    </Text>
                  ) : null}
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
        empresaId={null}
        empresaNome={null}
        clienteNome={customer?.nome ?? null}
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
function ProdutoModal({ produto, accentColor, colors, insets, onClose, onAdd, precoPromocional, quantidadeDisponivelPromo }: {
  produto: Produto;
  accentColor: string;
  colors: any;
  insets: { bottom: number };
  onClose: () => void;
  onAdd: (tamanho: Tamanho | null, extras: Extra[], qtd: number, precoPromo?: number | null, gruposSel?: Record<number, OpcaoGrupo[]>) => void;
  precoPromocional?: number | null;
  quantidadeDisponivelPromo?: number | null;
}) {
  const tamanhos: Tamanho[] = (() => {
    const raw = produto.tamanhos;
    if (Array.isArray(raw)) return raw as Tamanho[];
    if (typeof raw === "string") { try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; } }
    return [];
  })();
  const grupos: Grupo[] = (() => {
    const raw = produto.grupos;
    if (Array.isArray(raw)) return raw as Grupo[];
    if (typeof raw === "string") { try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; } }
    return [];
  })();
  const [extrasSel, setExtrasSel] = useState<Extra[]>([]);
  const [gruposSel, setGruposSel] = useState<Record<number, OpcaoGrupo[]>>({});
  const [tamanhoSel, setTamanhoSel] = useState<Tamanho | null>(tamanhos.length > 0 ? tamanhos[0] : null);
  const [qtd, setQtd] = useState(1);

  const hasPromo = precoPromocional != null && precoPromocional > 0;
  const precoOriginal = Number(produto.preco);
  // Promo always overrides — even when a tamanho is selected
  const basePreco = hasPromo ? precoPromocional! : (tamanhoSel ? Number(tamanhoSel.preco) : precoOriginal);
  // Limit qty to available promo stock (null = unlimited)
  const maxQtd = hasPromo && quantidadeDisponivelPromo != null ? quantidadeDisponivelPromo : 99;
  const gruposTotal = Object.values(gruposSel).flat().reduce((s, o) => s + Number(o.preco_adicional), 0);
  const precoTotal = (basePreco + extrasSel.reduce((s, e) => s + Number(e.preco), 0) + gruposTotal) * qtd;

  const toggleExtra = (extra: Extra) => {
    setExtrasSel(prev =>
      prev.find(e => e.id === extra.id) ? prev.filter(e => e.id !== extra.id) : [...prev, extra]
    );
  };

  const toggleOpcaoGrupo = (grupo: Grupo, opcao: OpcaoGrupo) => {
    setGruposSel(prev => {
      const current = prev[grupo.id] ?? [];
      const isSelected = current.some(o => o.id === opcao.id);
      if (isSelected) {
        const next = current.filter(o => o.id !== opcao.id);
        return { ...prev, [grupo.id]: next };
      }
      if (grupo.max_selecoes === 1) {
        return { ...prev, [grupo.id]: [opcao] };
      }
      if (current.length >= grupo.max_selecoes) {
        return prev;
      }
      return { ...prev, [grupo.id]: [...current, opcao] };
    });
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

          {hasPromo ? (
            <View style={{ gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 16, textDecorationLine: "line-through", fontFamily: "Inter_400Regular" }}>
                  R$ {precoOriginal.toFixed(2)}
                </Text>
                <Text style={[mStyles.basePreco, { color: accentColor, fontFamily: "Inter_700Bold" }]}>
                  R$ {precoPromocional!.toFixed(2)}
                </Text>
                <View style={{ backgroundColor: accentColor + "22", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ color: accentColor, fontSize: 12, fontFamily: "Inter_700Bold" }}>
                    -{Math.round(((precoOriginal - precoPromocional!) / precoOriginal) * 100)}%
                  </Text>
                </View>
              </View>
              {quantidadeDisponivelPromo != null && (
                <Text style={{ color: "#F97316", fontSize: 12, fontFamily: "Inter_600SemiBold" }}>
                  Apenas {quantidadeDisponivelPromo} restantes!
                </Text>
              )}
            </View>
          ) : (
            <Text style={[mStyles.basePreco, { color: accentColor, fontFamily: "Inter_700Bold" }]}>
              R$ {basePreco.toFixed(2)}
            </Text>
          )}

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

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 340 }}>

            {/* ── Grupos de Adicionais ──────────────────────────────── */}
            {grupos.map(grupo => {
              const selOps = gruposSel[grupo.id] ?? [];
              const selCount = selOps.length;
              const isObrig = grupo.obrigatorio;
              const isSatisfied = isObrig ? selCount >= grupo.min_selecoes : true;
              const isMaxed = selCount >= grupo.max_selecoes;
              return (
                <View key={grupo.id} style={{ marginBottom: 12 }}>
                  {/* Group header */}
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <View>
                      <Text style={[mStyles.sectionLabel, { color: colors.text, fontFamily: "Inter_700Bold", marginBottom: 0 }]}>
                        {grupo.nome}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 12, fontFamily: "Inter_400Regular" }}>
                        {grupo.min_selecoes > 0 && grupo.min_selecoes === grupo.max_selecoes
                          ? `Escolha ${grupo.max_selecoes} iten${grupo.max_selecoes === 1 ? "" : "s"}`
                          : `Escolha até ${grupo.max_selecoes} iten${grupo.max_selecoes === 1 ? "" : "s"}`
                        }
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                      {isObrig && (
                        <View style={{ backgroundColor: isSatisfied ? "#10B98120" : "#EF444418", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={{ color: isSatisfied ? "#10B981" : "#EF4444", fontSize: 11, fontFamily: "Inter_700Bold" }}>
                            {isSatisfied ? "✓ Ok" : "Obrigatório"}
                          </Text>
                        </View>
                      )}
                      <View style={{ backgroundColor: accentColor + "20", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ color: accentColor, fontSize: 11, fontFamily: "Inter_700Bold" }}>
                          {selCount}/{grupo.max_selecoes}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {/* Opcoes */}
                  {grupo.opcoes.map(op => {
                    const isSel = selOps.some(o => o.id === op.id);
                    const isDisabled = !isSel && isMaxed;
                    const isRadio = grupo.max_selecoes === 1;
                    return (
                      <Pressable
                        key={op.id}
                        onPress={() => !isDisabled && toggleOpcaoGrupo(grupo, op)}
                        style={[mStyles.extraRow, {
                          borderColor: isSel ? accentColor : (!isSatisfied && isObrig ? "#EF444460" : colors.border),
                          backgroundColor: isSel ? accentColor + "12" : colors.backgroundSecondary,
                          marginBottom: 6,
                          opacity: isDisabled ? 0.5 : 1,
                        }]}
                      >
                        {/* Radio or Checkbox indicator */}
                        <View style={[
                          mStyles.extraCheck,
                          isRadio ? { borderRadius: 999 } : {},
                          {
                            borderColor: isSel ? accentColor : colors.border,
                            backgroundColor: isSel ? accentColor : "transparent",
                          }
                        ]}>
                          {isSel && (isRadio
                            ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" }} />
                            : <Feather name="check" size={11} color="#fff" />
                          )}
                        </View>
                        <Text style={[mStyles.extraNome, { color: colors.text, fontFamily: "Inter_500Medium" }]} numberOfLines={1}>
                          {op.nome}
                        </Text>
                        {Number(op.preco_adicional) > 0 && (
                          <Text style={[mStyles.extraPreco, { color: accentColor, fontFamily: "Inter_600SemiBold" }]}>
                            +R$ {Number(op.preco_adicional).toFixed(2)}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}

            {/* ── Extras avulsos ────────────────────────────────────── */}
            {produto.extras.length > 0 && (() => {
              const extrasObrig = produto.extras.filter(e => e.obrigatorio);
              const extrasOpc = produto.extras.filter(e => !e.obrigatorio);
              const missingObrig = extrasObrig.filter(e => !extrasSel.find(s => s.id === e.id));
              const renderExtra = (extra: Extra) => {
                const sel = !!extrasSel.find(e => e.id === extra.id);
                const isObrig = extra.obrigatorio;
                const missing = isObrig && !sel;
                return (
                  <Pressable key={extra.id} onPress={() => toggleExtra(extra)}
                    style={[mStyles.extraRow, {
                      borderColor: sel ? accentColor : (missing ? "#EF4444" : colors.border),
                      backgroundColor: sel ? accentColor + "12" : colors.backgroundSecondary,
                      marginBottom: 8,
                    }]}>
                    <View style={[mStyles.extraCheck, {
                      borderColor: sel ? accentColor : (missing ? "#EF4444" : colors.border),
                      backgroundColor: sel ? accentColor : "transparent",
                    }]}>
                      {sel && <Feather name="check" size={11} color="#fff" />}
                    </View>
                    <Text style={[mStyles.extraNome, { color: colors.text, fontFamily: "Inter_600SemiBold", flex: 1 }]} numberOfLines={1}>
                      {extra.nome}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      {isObrig && (
                        <View style={{ backgroundColor: "#EF444418", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ color: "#EF4444", fontSize: 10, fontFamily: "Inter_700Bold" }}>Obrigatório</Text>
                        </View>
                      )}
                      {Number(extra.preco) > 0 && (
                        <Text style={[mStyles.extraPreco, { color: accentColor, fontFamily: "Inter_600SemiBold" }]}>
                          +R$ {Number(extra.preco).toFixed(2)}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                );
              };
              return (
                <>
                  {extrasObrig.length > 0 && (
                    <>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                        <Text style={[mStyles.sectionLabel, { color: colors.text, fontFamily: "Inter_700Bold", marginBottom: 0 }]}>
                          Obrigatórios
                        </Text>
                        <View style={{ backgroundColor: "#EF444420", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 }}>
                          <Text style={{ color: "#EF4444", fontSize: 10, fontFamily: "Inter_700Bold" }}>
                            {extrasObrig.length - missingObrig.length}/{extrasObrig.length}
                          </Text>
                        </View>
                      </View>
                      <View style={{ marginTop: 6 }}>
                        {extrasObrig.map(renderExtra)}
                      </View>
                    </>
                  )}
                  {extrasOpc.length > 0 && (
                    <>
                      <Text style={[mStyles.sectionLabel, { color: colors.text, fontFamily: "Inter_700Bold", marginTop: extrasObrig.length > 0 ? 8 : 4 }]}>
                        Adicionais / Opções
                      </Text>
                      <View style={{ marginTop: 6 }}>
                        {extrasOpc.map(renderExtra)}
                      </View>
                    </>
                  )}
                  {missingObrig.length > 0 && (
                    <Text style={{ color: "#EF4444", fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 4, marginBottom: 2 }}>
                      ⚠ Selecione: {missingObrig.map(e => e.nome).join(", ")}
                    </Text>
                  )}
                </>
              );
            })()}
          </ScrollView>

          <View style={mStyles.addRow}>
            <View style={[mStyles.qtdRow, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <Pressable onPress={() => setQtd(q => Math.max(1, q - 1))}
                style={[mStyles.qtdBtnMd, { backgroundColor: qtd > 1 ? accentColor : colors.border }]}>
                <Feather name="minus" size={16} color="#fff" />
              </Pressable>
              <Text style={[mStyles.qtdLabel, { color: colors.text, fontFamily: "Inter_700Bold" }]}>{qtd}</Text>
              <Pressable onPress={() => setQtd(q => Math.min(maxQtd, q + 1))} style={[mStyles.qtdBtnMd, { backgroundColor: qtd >= maxQtd ? "#9CA3AF" : accentColor }]}>
                <Feather name="plus" size={16} color="#fff" />
              </Pressable>
            </View>
            {(() => {
              const extrasObrig = produto.extras.filter(e => e.obrigatorio);
              const missingExtrasObrig = extrasObrig.filter(e => !extrasSel.find(s => s.id === e.id));
              const missingGrupos = grupos.filter(g => g.obrigatorio && (gruposSel[g.id]?.length ?? 0) < g.min_selecoes);
              const canAdd = missingExtrasObrig.length === 0 && missingGrupos.length === 0;
              return (
                <Pressable
                  onPress={() => { if (canAdd) onAdd(tamanhoSel, extrasSel, qtd, hasPromo ? precoPromocional : null, gruposSel); }}
                  style={[mStyles.addBtn, { backgroundColor: canAdd ? accentColor : "#9CA3AF" }]}>
                  <Text style={[mStyles.addBtnText, { fontFamily: "Inter_700Bold" }]}>
                    {canAdd ? `Adicionar  •  R$ ${precoTotal.toFixed(2)}` : "Selecione os itens obrigatórios"}
                  </Text>
                </Pressable>
              );
            })()}
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
