import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, ShoppingBag, Calculator, RefreshCcw, Zap, Printer, MapPin, Plus, CreditCard, Trash2, Clock, UserPlus, Phone, CheckCircle2, X, Truck, Loader2, Banknote, QrCode } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { useOrders } from "@/lib/useOrders";
import { printCupom } from "@/lib/print";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

interface Extra {
  id: number;
  nome: string;
  preco: number;
}

interface Tamanho {
  nome: string;
  preco: number;
}

interface PdvProduct {
  id: number;
  name: string;
  cat: string;
  price: number;
  emoji?: string;
  image?: string | null;
  extras: Extra[];
  tamanhos: Tamanho[];
}


function ProductImageCell({ image, name }: { image?: string | null; name: string }) {
  const [failed, setFailed] = React.useState(false);
  return (
    <div className="aspect-square bg-secondary/50 flex items-center justify-center relative overflow-hidden group-hover:bg-secondary transition-colors">
      {image && !failed ? (
        <img src={image} alt={name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={() => setFailed(true)} />
      ) : (
        <span className="text-5xl filter drop-shadow-sm group-hover:scale-110 transition-transform duration-300">📦</span>
      )}
      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors" />
    </div>
  );
}

function usePdvProdutos(token: string | null, empresaId: number | null, enabled: boolean) {
  const [produtos, setProdutos] = useState<PdvProduct[]>([]);
  const [loadingProdutos, setLoadingProdutos] = useState(false);

  useEffect(() => {
    if (!enabled || !token || !empresaId) return;
    setLoadingProdutos(true);
    fetch("/api/pdv/produtos", {
      headers: { Authorization: `Bearer ${token}`, "x-empresa-id": String(empresaId) },
    })
      .then(r => r.json())
      .then((data: any[]) => {
        if (Array.isArray(data)) {
          setProdutos(data.filter(p => p.ativo !== false).map(p => ({
            id: p.id,
            name: p.nome ?? p.name ?? "",
            cat: p.categoria_nome ?? p.categoria ?? "Geral",
            price: Number(p.preco ?? 0),
            image: p.imagem ?? null,
            extras: Array.isArray(p.extras)
              ? p.extras.map((e: any) => ({ id: Number(e.id), nome: String(e.nome ?? ""), preco: Number(e.preco ?? 0) }))
              : [],
            tamanhos: Array.isArray(p.tamanhos)
              ? p.tamanhos.map((t: any) => ({ nome: String(t?.nome ?? ""), preco: Number(t?.preco ?? 0) })).filter((t: Tamanho) => t.nome.length > 0)
              : [],
          })));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingProdutos(false));
  }, [enabled, token, empresaId]);

  return { produtos, loadingProdutos };
}

const STATUS_COLORS: Record<string, string> = {
  novo: "bg-blue-500 text-white",
  preparando: "bg-amber-100 text-amber-700 border border-amber-200",
  pronto: "bg-emerald-500 text-white",
};
const STATUS_LABELS: Record<string, string> = {
  novo: "Novo", preparando: "Preparando", pronto: "Pronto!",
};
const STATUS_NEXT: Record<string, string> = {
  novo: "preparando", preparando: "pronto", pronto: "entregue",
};

interface CartItem {
  uid: string;
  id: number;
  name: string;
  price: number;
  qty: number;
  image?: string | null;
  extras: Extra[];
  tamanho: Tamanho | null;
}

function makeCartUid(productId: number, tamanho: Tamanho | null, extras: Extra[]): string {
  const ids = extras.map(e => e.id).sort((a, b) => a - b).join(",");
  const tam = tamanho ? tamanho.nome : "";
  return `${productId}:${tam}:${ids}`;
}
interface ClienteInfo { clienteNome: string; clienteWhatsapp: string; clienteEndereco?: string; }

function useClienteSearch(token: string | null, empresaId: number | null) {
  const [telefone, setTelefone] = useState("");
  const [cliente, setCliente] = useState<ClienteInfo | null>(null);
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}`, "x-empresa-id": String(empresaId) } : {};

  const search = useCallback(async (tel: string) => {
    const clean = tel.replace(/\D/g, "");
    if (clean.length < 8) { setCliente(null); setNotFound(false); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/pdv/clientes?telefone=${clean}`, { headers });
      const data = await res.json();
      if (data && data.clienteNome) {
        setCliente(data);
        setNotFound(false);
      } else {
        setCliente(null);
        setNotFound(true);
      }
    } catch { setCliente(null); setNotFound(false); }
    setSearching(false);
  }, [token, empresaId]);

  const handleChange = (val: string) => {
    setTelefone(val);
    setCliente(null);
    setNotFound(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(val), 600);
  };

  const clear = () => { setTelefone(""); setCliente(null); setNotFound(false); };

  return { telefone, cliente, searching, notFound, handleChange, clear, setCliente };
}

// ── Delivery fee hook ────────────────────────────────────────────────────────
function useFrete(token: string | null, endereco: string, isDelivery: boolean) {
  const [taxa, setTaxa] = useState<number | null>(null);
  const [distancia, setDistancia] = useState<number | null>(null);
  const [duracao, setDuracao] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [foraRaio, setForaRaio] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isDelivery || !endereco || endereco.length < 10 || !token) {
      setTaxa(null); setDistancia(null); setDuracao(null); setForaRaio(false); setMensagem(null);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/pdv/calcular-frete", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ endereco_destino: endereco }),
        });
        const data = await res.json();
        setForaRaio(!!data.fora_raio);
        setMensagem(data.mensagem ?? null);
        setTaxa(data.taxa_entrega ?? null);
        setDistancia(data.distancia_km ?? null);
        setDuracao(data.duracao ?? null);
      } catch { setTaxa(null); }
      setLoading(false);
    }, 800);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [endereco, isDelivery, token]);

  return { taxa, distancia, duracao, loading, foraRaio, mensagem };
}

// ── Quick registration dialog ────────────────────────────────────────────────
function CadastroRapidoDialog({
  open,
  onClose,
  initialPhone,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initialPhone: string;
  onSave: (cliente: ClienteInfo) => void;
}) {
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState(initialPhone.replace(/\D/g, ""));
  const [endereco, setEndereco] = useState("");

  useEffect(() => {
    if (open) {
      setNome("");
      setWhatsapp(initialPhone.replace(/\D/g, ""));
      setEndereco("");
    }
  }, [open, initialPhone]);

  const handleSave = () => {
    if (!nome.trim()) return;
    onSave({ clienteNome: nome.trim(), clienteWhatsapp: whatsapp, clienteEndereco: endereco || undefined });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-primary" />
            </div>
            Cadastro Rápido
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cad-nome">Nome completo *</Label>
            <Input
              id="cad-nome"
              placeholder="Ex: João Silva"
              value={nome}
              onChange={e => setNome(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cad-whats">WhatsApp</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="cad-whats"
                placeholder="11 99999-9999"
                className="pl-9"
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cad-end">Endereço</Label>
            <AddressAutocomplete
              value={endereco}
              onChange={setEndereco}
              placeholder="Digite o endereço..."
            />
            <p className="text-xs text-muted-foreground">Sugestões do Google Maps ao digitar</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!nome.trim()} className="gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Salvar cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main PDV component ───────────────────────────────────────────────────────
export default function Pdv() {
  const { activeModule } = useAppStore();
  const { token, user, empresa } = useAuth();
  const { orders, updateStatus, createOrder } = useOrders(token, user?.empresaId ?? null);

  const modulosAtivos: string[] = (empresa?.modulosAtivos ?? []).filter((m: string) => !m.startsWith("destaque:"));
  const isEcommerce = modulosAtivos.includes("ecommerce");
  const isFood = modulosAtivos.includes("food") || (!isEcommerce);

  const { produtos: pdvProdutos, loadingProdutos } = usePdvProdutos(token, user?.empresaId ?? null, (isEcommerce || isFood) && !!token && !!user?.empresaId);

  const allProducts: PdvProduct[] = pdvProdutos.length > 0
    ? pdvProdutos
    : [];

  const allCats = pdvProdutos.length > 0
    ? ["Todas", ...Array.from(new Set(pdvProdutos.map(p => p.cat)))]
    : ["Todas"];

  const [activeTab, setActiveTab] = useState("delivery");
  const [activeCat, setActiveCat] = useState("Todas");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!allCats.includes(activeCat)) setActiveCat("Todas");
  }, [allCats]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [clienteEndereco, setClienteEndereco] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCadastro, setShowCadastro] = useState(false);
  const [pedidoCriado, setPedidoCriado] = useState<{ id: number; whatsapp?: string } | null>(null);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [showPagamento, setShowPagamento] = useState(false);
  const [metodosPag, setMetodosPag] = useState<string[]>(["pix", "dinheiro", "credito", "debito"]);
  const [extrasModalProduto, setExtrasModalProduto] = useState<PdvProduct | null>(null);
  
  const [paymentOptions, setPaymentOptions] = useState<{mercadoPago: boolean, directPayment: boolean, beta: boolean, environment: string}>({
    mercadoPago: false,
    directPayment: true,
    beta: false,
    environment: "sandbox"
  });
  const [selectedReceivingSource, setSelectedReceivingSource] = useState<"direto" | "mercadopago" | null>(null);

  useEffect(() => {
    if (!token || !user?.empresaId) return;
    
    // Fetch local payment methods
    fetch("/api/pdv/config-pagamento", {
      headers: { Authorization: `Bearer ${token}`, "x-empresa-id": String(user.empresaId) },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.metodos && Array.isArray(d.metodos) && d.metodos.length) setMetodosPag(d.metodos); })
      .catch(() => {});
      
    // Fetch marketplace payment options
    fetch(`/api/payments/options/${user.empresaId}`, {
      headers: { Authorization: `Bearer ${token}`, "x-empresa-id": String(user.empresaId) },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { 
        if (d) setPaymentOptions({
          mercadoPago: !!d.mercadoPago,
          directPayment: d.directPayment !== false,
          beta: !!d.beta,
          environment: d.environment || "sandbox"
        }); 
      })
      .catch(() => {});
  }, [token, user?.empresaId]);

  const { telefone, cliente, searching, notFound, handleChange: handleTelChange, clear: clearTel, setCliente } = useClienteSearch(token, user?.empresaId ?? null);

  const enderecoEfetivo = clienteEndereco || cliente?.clienteEndereco || "";
  const frete = useFrete(token, enderecoEfetivo, activeTab === "delivery");

  const activeOrders = orders.filter(o => ["novo", "preparando", "pronto"].includes(o.status));

  const filteredProducts = allProducts.filter(p => {
    if (activeCat !== "Todas" && p.cat !== activeCat) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const addCartItem = (product: PdvProduct, tamanho: Tamanho | null, extras: Extra[], qty: number) => {
    const uid = makeCartUid(product.id, tamanho, extras);
    const basePrice = tamanho ? tamanho.preco : product.price;
    const unitPrice = basePrice + extras.reduce((s, e) => s + e.preco, 0);
    const tamanhoSuffix = tamanho ? ` (${tamanho.nome})` : "";
    const extrasSuffix = extras.length > 0 ? ` + ${extras.map(e => e.nome).join(", ")}` : "";
    const fullName = product.name + tamanhoSuffix + extrasSuffix;
    setCart(prev => {
      const existing = prev.find(item => item.uid === uid);
      if (existing) return prev.map(item => item.uid === uid ? { ...item, qty: item.qty + qty } : item);
      return [...prev, { uid, id: product.id, name: fullName, price: unitPrice, qty, image: product.image, extras, tamanho }];
    });
  };

  const addToCart = (product: PdvProduct) => {
    if (product.extras.length > 0 || product.tamanhos.length > 0) {
      setExtrasModalProduto(product);
    } else {
      addCartItem(product, null, [], 1);
    }
  };

  const removeFromCart = (uid: string) => setCart(prev => prev.filter(item => item.uid !== uid));

  const cartSubtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const taxaFrete = activeTab === "delivery" && frete.taxa !== null ? frete.taxa : 0;
  const cartTotal = cartSubtotal + taxaFrete;

  const handleFinalizar = () => {
    if (cart.length === 0) return;
    setShowPagamento(true);
  };

  const confirmFinalizar = async (formaPag: string, formaPagLabel: string) => {
    const nome = cliente?.clienteNome || "Cliente";
    const whatsapp = cliente?.clienteWhatsapp || telefone.replace(/\D/g, "");
    const end = clienteEndereco || cliente?.clienteEndereco;
    setIsSubmitting(true);
    const novo = await createOrder({
      modulo: isEcommerce ? "ecommerce" : "food",
      tipo: activeTab,
      clienteNome: nome,
      clienteWhatsapp: whatsapp || undefined,
      clienteEndereco: end || undefined,
      total: cartTotal,
      taxa_entrega: taxaFrete || undefined,
      distancia_km: frete.distancia || undefined,
      forma_pagamento: formaPag,
      formaPagamento: formaPag,
      itens: cart.map(item => ({ nome: item.name, quantidade: item.qty, preco: item.price })),
    } as any);
    if (novo) {
      setPedidoCriado({ id: novo.id, whatsapp: whatsapp || undefined });
      setCart([]);
      clearTel();
      setClienteEndereco("");
      setShowPagamento(false);
    }
    setIsSubmitting(false);
  };

  const handleCadastroSave = (c: ClienteInfo) => {
    setCliente(c);
    if (c.clienteEndereco) setClienteEndereco(c.clienteEndereco);
  };

  const [mpUnavailableMessage, setMpUnavailableMessage] = useState(false);

  const confirmFinalizarMercadoPago = () => {
    setMpUnavailableMessage(true);
  };

  const trackingUrl = pedidoCriado
    ? `${window.location.origin}${import.meta.env.BASE_URL}track/${pedidoCriado.id}`
    : "";

  const handleShareWhatsApp = () => {
    if (!pedidoCriado) return;
    const msg = encodeURIComponent(
      `✅ Olá! Seu pedido *#${pedidoCriado.id}* foi confirmado em *${empresa?.nome ?? "GoTaxi PDV"}*.\n\nAcompanhe o status em tempo real:\n${trackingUrl}`
    );
    const tel = pedidoCriado.whatsapp?.replace(/\D/g, "");
    window.open(`https://wa.me/${tel ? `55${tel}` : ""}?text=${msg}`, "_blank");
  };

  const PAG_META: Record<string, { label: string; emoji: string; color: string }> = {
    pix:      { label: "Pix",                emoji: "⚡", color: "#22C55E" },
    dinheiro: { label: "Dinheiro",           emoji: "💵", color: "#F59E0B" },
    credito:  { label: "Cartão de Crédito",  emoji: "💳", color: "#3B82F6" },
    debito:   { label: "Cartão de Débito",   emoji: "💳", color: "#8B5CF6" },
  };

  return (
    <>
      {/* Payment selection modal */}
      {showPagamento && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => !isSubmitting && setShowPagamento(false)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">Receber pagamento</h2>
                  <p className="text-xs text-muted-foreground">Total: <strong className="text-foreground">R$ {cartTotal.toFixed(2)}</strong></p>
                </div>
              </div>
              <button onClick={() => {
                if (!isSubmitting) {
                  setShowPagamento(false);
                  setMpUnavailableMessage(false);
                  setSelectedReceivingSource(null);
                }
              }} className="text-muted-foreground hover:text-foreground" disabled={isSubmitting}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              
              {!selectedReceivingSource ? (
                <>
                  <p className="text-sm font-semibold text-foreground">Como o cliente vai pagar?</p>
                  <div className="space-y-3">
                    {paymentOptions.mercadoPago && (
                      <button
                        onClick={() => setSelectedReceivingSource("mercadopago")}
                        className="w-full flex items-center gap-3 p-4 rounded-xl border border-[#009EE3]/30 hover:border-[#009EE3] hover:bg-[#009EE3]/5 transition-colors text-left relative overflow-hidden"
                      >
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl bg-[#009EE3]/10 text-[#009EE3]">
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <span className="block text-sm font-bold text-foreground">Mercado Pago</span>
                          <span className="block text-xs text-muted-foreground mt-0.5">Link de pagamento online</span>
                        </div>
                        {paymentOptions.beta && (
                          <span className="absolute top-0 right-0 bg-[#009EE3] text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase">BETA</span>
                        )}
                      </button>
                    )}

                    {paymentOptions.directPayment && (
                      <button
                        onClick={() => setSelectedReceivingSource("direto")}
                        className="w-full flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl bg-primary/10 text-primary">
                          <Banknote className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <span className="block text-sm font-bold text-foreground">Receber direto</span>
                          <span className="block text-xs text-muted-foreground mt-0.5">Pix, dinheiro ou maquininha</span>
                        </div>
                      </button>
                    )}

                    {!paymentOptions.mercadoPago && !paymentOptions.directPayment && (
                      <p className="text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                        Nenhuma forma de recebimento habilitada. Vá em <strong>Configurações → Integração Mercado Pago</strong> para configurar.
                      </p>
                    )}
                  </div>
                </>
              ) : selectedReceivingSource === "mercadopago" ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-[#009EE3] font-bold bg-[#009EE3]/10 px-3 py-2 rounded-lg cursor-pointer hover:bg-[#009EE3]/20" onClick={() => { setMpUnavailableMessage(false); setSelectedReceivingSource(null); }}>
                    ← Voltar
                  </div>

                  {!mpUnavailableMessage ? (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">O cliente pagará via Mercado Pago (cartão, Pix ou carteira MP). O valor será processado online e creditado na sua conta Mercado Pago após dedução de taxas.</p>
                      
                      <button
                        onClick={confirmFinalizarMercadoPago}
                        className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-[#009EE3] hover:bg-[#009EE3]/90 text-white font-bold transition-colors"
                      >
                        Gerar Link de Pagamento
                      </button>
                    </div>
                  ) : (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center space-y-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                        <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 16v-4"/><path d="M12 8h.01"/><path d="M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0z"/></svg>
                      </div>
                      <p className="text-sm text-blue-900 font-medium">Recurso em Desenvolvimento</p>
                      <p className="text-xs text-blue-700">A geração de links do Mercado Pago direto pelo PDV Web presencial ainda está em desenvolvimento na versão Beta. Para usar Mercado Pago hoje, o cliente deve fazer o pedido pelo aplicativo.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground font-bold bg-muted/50 px-3 py-2 rounded-lg cursor-pointer hover:bg-muted" onClick={() => setSelectedReceivingSource(null)}>
                    ← Voltar
                  </div>

                  {metodosPag.length === 0 && (
                    <p className="text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                      Nenhuma forma de pagamento habilitada. Vá em <strong>Configurações → Pagamento</strong>.
                    </p>
                  )}
                  {metodosPag.map(key => {
                    const meta = PAG_META[key] ?? { label: key, emoji: "💰", color: "#64748B" };
                    return (
                      <button
                        key={key}
                        disabled={isSubmitting}
                        onClick={() => confirmFinalizar(key, meta.label)}
                        className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left disabled:opacity-50"
                      >
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ backgroundColor: `${meta.color}20` }}>
                          <span>{meta.emoji}</span>
                        </div>
                        <span className="flex-1 text-sm font-semibold text-foreground">{meta.label}</span>
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <CheckCircle2 className="w-4 h-4 text-muted-foreground/40" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp share modal */}
      {pedidoCriado && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setPedidoCriado(null)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-green-500/10 border-b border-green-500/20 p-5 text-center">
              <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-2.5">
                <svg className="w-7 h-7 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h2 className="text-lg font-bold text-foreground">Pedido #{pedidoCriado.id} criado!</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Compartilhe o link de rastreamento com o cliente</p>
            </div>

            <div className="p-5 space-y-4">
              {/* Tracking link */}
              <div className="bg-secondary/50 border border-border rounded-xl p-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Link de rastreamento</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-foreground font-mono break-all flex-1 leading-relaxed">{trackingUrl}</p>
                  <button
                    onClick={() => { navigator.clipboard?.writeText(trackingUrl); setLinkCopiado(true); setTimeout(() => setLinkCopiado(false), 2500); }}
                    className="shrink-0 px-2.5 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-semibold hover:bg-primary/20 transition-colors border border-primary/20">
                    {linkCopiado ? "✓" : "Copiar"}
                  </button>
                </div>
              </div>

              {/* WhatsApp button */}
              <button
                onClick={handleShareWhatsApp}
                className="w-full py-3 rounded-xl bg-[#25D366] hover:bg-[#22c55e] text-white font-bold text-sm flex items-center justify-center gap-2.5 transition-colors shadow-md shadow-green-500/20">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.99 2C6.469 2 2 6.476 2 12.005c0 1.768.462 3.43 1.264 4.878L2 22l5.266-1.243A9.956 9.956 0 0 0 12.01 22C17.531 22 22 17.524 22 12 22 6.476 17.521 2 11.99 2zm.02 18c-1.591 0-3.088-.44-4.37-1.198l-.313-.185-3.124.738.779-3.04-.203-.32A8.01 8.01 0 0 1 4 12.005C4 7.584 7.578 4 11.99 4 16.411 4 20 7.582 20 12c0 4.418-3.589 8-8.01 8z"/></svg>
                {pedidoCriado.whatsapp ? "Enviar via WhatsApp" : "Compartilhar no WhatsApp"}
              </button>

              <button onClick={() => setPedidoCriado(null)} className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <CadastroRapidoDialog
        open={showCadastro}
        onClose={() => setShowCadastro(false)}
        initialPhone={telefone}
        onSave={handleCadastroSave}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col lg:flex-row h-[calc(100vh-92px)] gap-4"
      >
        {/* LEFT PANEL */}
        <Card className="w-full lg:w-[40%] xl:w-[35%] flex flex-col shadow-sm border-border/50 overflow-hidden bg-card/50">
          <div className="p-4 border-b border-border/50 bg-card">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-4 w-full h-11 bg-muted/50 p-1">
                <TabsTrigger value="local" className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">C. Local</TabsTrigger>
                <TabsTrigger value="retirar" className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">Retirar</TabsTrigger>
                <TabsTrigger value="delivery" className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">Delivery</TabsTrigger>
                <TabsTrigger value="mesa" className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">Mesa</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="mt-4 space-y-3">
              {/* Phone search field */}
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                <Input
                  placeholder="Buscar cliente por telefone..."
                  className={`pl-9 pr-14 bg-background transition-colors ${
                    cliente ? "border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20" :
                    notFound ? "border-orange-400" : ""
                  }`}
                  value={telefone}
                  onChange={e => handleTelChange(e.target.value)}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {searching && (
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  )}
                  {cliente && !searching && (
                    <button onClick={() => { clearTel(); setClienteEndereco(""); }} className="p-1 text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {notFound && !searching && (
                    <button
                      onClick={() => setShowCadastro(true)}
                      className="px-2.5 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-md hover:bg-primary/90 transition-colors"
                    >
                      Ad
                    </button>
                  )}
                </div>
              </div>

              {/* Client found card */}
              {cliente && (
                <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                    <span className="text-white text-xs font-bold">{cliente.clienteNome.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-emerald-800 dark:text-emerald-300 truncate">{cliente.clienteNome}</p>
                    {cliente.clienteEndereco && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 truncate">
                        <MapPin className="w-3 h-3 inline mr-0.5" />
                        {cliente.clienteEndereco}
                      </p>
                    )}
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                </div>
              )}

              {/* Not found hint */}
              {notFound && (
                <p className="text-xs text-orange-600 dark:text-orange-400 pl-1">
                  Cliente não encontrado — clique em <strong>Ad</strong> para cadastrar
                </p>
              )}

              {/* Address field (delivery mode) */}
              {activeTab === "delivery" && (
                <AddressAutocomplete
                  value={clienteEndereco || (cliente?.clienteEndereco ?? "")}
                  onChange={setClienteEndereco}
                />
              )}
            </div>
          </div>

          {/* CART TABLE */}
          <div className="flex-1 overflow-auto bg-card flex flex-col">
            <div className="grid grid-cols-12 gap-2 p-3 border-b border-border/50 bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <div className="col-span-5">Item</div>
              <div className="col-span-2 text-right">Preço</div>
              <div className="col-span-2 text-center">Qtd</div>
              <div className="col-span-2 text-right">Total</div>
              <div className="col-span-1"></div>
            </div>

            <ScrollArea className="flex-1">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <ShoppingBag className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-lg font-display font-medium text-foreground/50">O carrinho está vazio</p>
                  <p className="text-sm">Adicione produtos pelo painel ao lado</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {cart.map(item => (
                    <div key={item.uid} className="grid grid-cols-12 gap-2 p-2 items-center hover:bg-secondary/50 rounded-lg group">
                      <div className="col-span-5 text-sm font-medium truncate pr-2" title={item.name}>{item.name}</div>
                      <div className="col-span-2 text-sm text-right text-muted-foreground">R$ {item.price.toFixed(2)}</div>
                      <div className="col-span-2 flex items-center justify-center">
                        <Badge variant="secondary" className="font-mono">{item.qty}</Badge>
                      </div>
                      <div className="col-span-2 text-sm text-right font-semibold">R$ {(item.price * item.qty).toFixed(2)}</div>
                      <div className="col-span-1 flex justify-end">
                        <button onClick={() => removeFromCart(item.uid)} className="p-1.5 text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-md opacity-0 group-hover:opacity-100 transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>


          {/* BOTTOM ACTION BAR */}
          <div className="px-3 py-3 bg-card border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-10 shrink-0">
            {/* Frete alert (out of range) */}
            {activeTab === "delivery" && frete.foraRaio && (
              <div className="mb-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 shrink-0" />
                {frete.mensagem ?? "Endereço fora do raio de entrega"}
              </div>
            )}

            <div className="mb-3 bg-secondary/50 px-4 py-2.5 rounded-xl border border-border/50 space-y-1.5">
              {/* Subtotal */}
              {activeTab === "delivery" && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Subtotal ({cart.reduce((a, i) => a + i.qty, 0)} itens)</span>
                  <span>R$ {cartSubtotal.toFixed(2)}</span>
                </div>
              )}
              {/* Frete row */}
              {activeTab === "delivery" && (
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Truck className="w-3 h-3" />
                    Taxa de entrega
                    {frete.distancia !== null && <span className="text-muted-foreground/70">({frete.distancia} km{frete.duracao ? ` · ${frete.duracao}` : ""})</span>}
                  </span>
                  {frete.loading ? (
                    <span className="flex items-center gap-1 text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> calculando...</span>
                  ) : frete.taxa === null && enderecoEfetivo.length >= 10 ? (
                    <span className="text-muted-foreground italic">—</span>
                  ) : frete.taxa !== null ? (
                    <span className={`font-semibold ${taxaFrete === 0 ? "text-green-500" : "text-foreground"}`}>
                      {taxaFrete === 0 ? "Grátis" : `R$ ${taxaFrete.toFixed(2)}`}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/60 text-[10px]">informe o endereço</span>
                  )}
                </div>
              )}

              {/* Total line */}
              <div className="flex items-center justify-between border-t border-border/40 pt-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                    <Calculator className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">Total</span>
                </div>
                <span className="text-2xl font-display font-bold text-foreground">
                  R$ {cartTotal.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" onClick={() => { setCart([]); clearTel(); setClienteEndereco(""); }} className="h-10 text-xs border-destructive/20 text-destructive hover:bg-destructive/10 px-2">
                <RefreshCcw className="w-3.5 h-3.5 mr-1.5" />
                Reiniciar
              </Button>
              <Button className="h-10 text-xs bg-blue-600 hover:bg-blue-700 text-white px-2" disabled={cart.length === 0}>
                <Zap className="w-3.5 h-3.5 mr-1.5" />
                P. Rápido
              </Button>
              <Button
                className="h-10 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 px-2"
                disabled={cart.length === 0 || isSubmitting}
                onClick={handleFinalizar}
              >
                {isSubmitting ? <RefreshCcw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Printer className="w-3.5 h-3.5 mr-1.5" />}
                Finalizar
              </Button>
            </div>
          </div>
        </Card>

        {/* RIGHT PANEL - PRODUCT CATALOG */}
        <Card className="w-full lg:flex-1 flex flex-col shadow-sm border-border/50 bg-card/50 overflow-hidden">
          <div className="p-4 border-b border-border/50 bg-card space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou categoria..."
                className="pl-9 bg-background"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <ScrollArea className="w-full whitespace-nowrap pb-2">
              <div className="flex w-max space-x-2">
                {allCats.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCat(cat)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                      activeCat === cat
                        ? "bg-foreground text-background shadow-sm"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/50"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          <ScrollArea className="flex-1 p-4 bg-muted/10">
            {loadingProdutos && (
              <div className="flex items-center justify-center h-40 text-muted-foreground gap-3">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Carregando produtos...
              </div>
            )}
            {!loadingProdutos && filteredProducts.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                <ShoppingBag className="w-10 h-10 opacity-20" />
                <p className="text-sm">Nenhum produto encontrado</p>
                {(isEcommerce || isFood) && <p className="text-xs text-center px-8">Cadastre produtos no Cardápio para que apareçam aqui</p>}
              </div>
            )}
            <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
              {filteredProducts.map(product => (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  key={product.id}
                  className="group relative bg-card border border-border/50 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer flex flex-col"
                  onClick={() => addToCart(product)}
                >
                  <ProductImageCell image={product.image} name={product.name} />
                  <div className="p-3 flex flex-col flex-1">
                    <p className="text-xs text-muted-foreground mb-1">{product.cat}</p>
                    <h4 className="font-semibold text-sm leading-tight mb-2 line-clamp-2">{product.name}</h4>
                    <div className="mt-auto flex items-center justify-between">
                      <span className="font-display font-bold text-primary">R$ {product.price.toFixed(2)}</span>
                      <button className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </Card>
      </motion.div>

      {/* Extras selection modal */}
      {extrasModalProduto && (
        <ExtrasModal
          produto={extrasModalProduto}
          onClose={() => setExtrasModalProduto(null)}
          onAdd={(tamanho, extras, qtd) => {
            addCartItem(extrasModalProduto, tamanho, extras, qtd);
            setExtrasModalProduto(null);
          }}
        />
      )}
    </>
  );
}

function ExtrasModal({ produto, onClose, onAdd }: {
  produto: PdvProduct;
  onClose: () => void;
  onAdd: (tamanho: Tamanho | null, extras: Extra[], qtd: number) => void;
}) {
  const [selecionados, setSelecionados] = useState<Extra[]>([]);
  const [tamanhoSel, setTamanhoSel] = useState<Tamanho | null>(
    produto.tamanhos.length > 0 ? produto.tamanhos[0] : null
  );
  const [qtd, setQtd] = useState(1);

  const toggleExtra = (extra: Extra) => {
    setSelecionados(prev =>
      prev.find(e => e.id === extra.id)
        ? prev.filter(e => e.id !== extra.id)
        : [...prev, extra]
    );
  };

  const basePrice = tamanhoSel ? tamanhoSel.preco : produto.price;
  const precoUnit = basePrice + selecionados.reduce((s, e) => s + e.preco, 0);
  const precoTotal = precoUnit * qtd;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            {produto.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="text-sm text-muted-foreground">
            Preço base: <strong className="text-foreground">R$ {basePrice.toFixed(2)}</strong>
          </div>

          {produto.tamanhos.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Tamanho <span className="text-destructive">*</span></Label>
              <div className="space-y-1.5">
                {produto.tamanhos.map(t => {
                  const sel = tamanhoSel?.nome === t.nome;
                  return (
                    <button
                      key={t.nome}
                      type="button"
                      onClick={() => setTamanhoSel(t)}
                      className={`w-full flex items-center justify-between gap-2 p-3 rounded-lg border transition-all text-left ${
                        sel ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-secondary/50"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          sel ? "border-primary" : "border-border"
                        }`}>
                          {sel && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                        </div>
                        <span className="text-sm font-medium truncate">{t.nome}</span>
                      </div>
                      <span className={`text-xs font-semibold shrink-0 ${sel ? "text-primary" : "text-muted-foreground"}`}>
                        R$ {t.preco.toFixed(2)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {produto.extras.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Adicionais</Label>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {produto.extras.map(extra => {
                const sel = !!selecionados.find(e => e.id === extra.id);
                return (
                  <button
                    key={extra.id}
                    type="button"
                    onClick={() => toggleExtra(extra)}
                    className={`w-full flex items-center justify-between gap-2 p-3 rounded-lg border transition-all text-left ${
                      sel
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40 hover:bg-secondary/50"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                        sel ? "border-primary bg-primary" : "border-border"
                      }`}>
                        {sel && <CheckCircle2 className="w-4 h-4 text-primary-foreground" />}
                      </div>
                      <span className="text-sm font-medium truncate">{extra.nome}</span>
                    </div>
                    <span className={`text-xs font-semibold shrink-0 ${sel ? "text-primary" : "text-muted-foreground"}`}>
                      + R$ {extra.preco.toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          )}

          <div className="flex items-center justify-between border-t border-border pt-3">
            <Label className="text-sm font-semibold">Quantidade</Label>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setQtd(q => Math.max(1, q - 1))}
              >
                −
              </Button>
              <span className="font-mono font-semibold w-6 text-center">{qtd}</span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setQtd(q => q + 1)}
              >
                +
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
          <Button variant="outline" onClick={onClose} className="sm:flex-1">
            Cancelar
          </Button>
          <Button
            onClick={() => onAdd(tamanhoSel, selecionados, qtd)}
            className="sm:flex-1 gap-2"
          >
            <Plus className="w-4 h-4" />
            Adicionar · R$ {precoTotal.toFixed(2)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
