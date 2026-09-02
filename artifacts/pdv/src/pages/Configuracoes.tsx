import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Store, MapPin, Truck, CreditCard, Save, CheckCircle2, AlertCircle, Loader2, Globe, Navigation, Zap, Copy, UtensilsCrossed, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { useAuth } from "@/lib/auth";

type Subcategoria = { id: number; nome: string; slug: string; emoji: string | null; ativo: boolean };

type ConfigEntrega = {
  tipo: "fixa" | "km";
  taxa_fixa: number;
  taxa_por_km: number;
  km_minimo: number;
  raio_max_km: number;
  taxa_minima: number;
  endereco_restaurante: string;
  ativo: boolean;
};

const DEFAULT_CONFIG: ConfigEntrega = {
  tipo: "fixa",
  taxa_fixa: 5,
  taxa_por_km: 2,
  km_minimo: 0,
  raio_max_km: 10,
  taxa_minima: 5,
  endereco_restaurante: "",
  ativo: true,
};

const PAYMENT_METHODS = [
  { key: "pix",      label: "Pix",                  emoji: "⚡", color: "#22C55E" },
  { key: "dinheiro", label: "Dinheiro",              emoji: "💵", color: "#F59E0B" },
  { key: "credito",  label: "Cartão de Crédito",     emoji: "💳", color: "#3B82F6" },
  { key: "debito",   label: "Cartão de Débito",      emoji: "💳", color: "#8B5CF6" },
  { key: "vr",       label: "Vale Refeição / VR",    emoji: "🎫", color: "#F97316" },
  { key: "sodexo",   label: "Sodexo / Alelo",        emoji: "🏷️", color: "#EF4444" },
];

export default function Configuracoes() {
  const { token, empresa } = useAuth();
  const isPassagens = empresa?.modulosAtivos?.includes("passagens") && !empresa?.modulosAtivos?.includes("food") && !empresa?.modulosAtivos?.includes("ecommerce");
  const isFood = empresa?.modulosAtivos?.includes("food");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [cfg, setCfg] = useState<ConfigEntrega>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [area, setArea] = useState({ lat_loja: "", lng_loja: "", raio_visibilidade_km: 50 });
  const [savingArea, setSavingArea] = useState(false);
  const [savedArea, setSavedArea] = useState(false);
  const [areaSaveError, setAreaSaveError] = useState("");

  const [metodosPag, setMetodosPag] = useState<string[]>(["pix", "dinheiro", "credito", "debito"]);
  const [loadingPag, setLoadingPag] = useState(true);
  const [savingPag, setSavingPag] = useState(false);
  const [savedPag, setSavedPag] = useState(false);
  const [pagError, setPagError] = useState("");

  const [pixChave, setPixChave] = useState("");
  const [pixTipo, setPixTipo] = useState("aleatoria");
  const [dadosRecebimento, setDadosRecebimento] = useState({
    numero_conta_mercado_pago: "",
  });
  const [savingPix, setSavingPix] = useState(false);
  const [savedPix, setSavedPix] = useState(false);
  const [pixError, setPixError] = useState("");
  const [pixCopiado, setPixCopiado] = useState(false);

  const [perfil, setPerfil] = useState({ nome: "", categoria: "", descricao: "", telefone: "", cnpj: "" });
  const [savingPerfil, setSavingPerfil] = useState(false);
  const [savedPerfil, setSavedPerfil] = useState(false);
  const [perfilError, setPerfilError] = useState("");

  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");
  const [savingSenha, setSavingSenha] = useState(false);
  const [senhaMsg, setSenhaMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);
  const [subcategoriaId, setSubcategoriaId] = useState<number | null>(null);
  const [savingSubcat, setSavingSubcat] = useState(false);
  const [savedSubcat, setSavedSubcat] = useState(false);

  // Mercado Pago Config State
  const [mpConfig, setMpConfig] = useState({
    mercadoPagoEnabled: false,
    directPaymentEnabled: true,
    configured: false,
    beta: false,
    environment: "sandbox",
  });
  const [savingMp, setSavingMp] = useState(false);
  const [savedMp, setSavedMp] = useState(false);
  const [mpError, setMpError] = useState("");

  useEffect(() => {
    if (isFood) {
      fetch("/api/subcategorias-alimentacao").then(r => r.ok ? r.json() : []).then(d => setSubcategorias(Array.isArray(d) ? d : [])).catch(() => {});
      fetch("/api/pdv/config-subcategoria", { headers }).then(r => r.ok ? r.json() : null).then(d => { if (d?.subcategoria_id) setSubcategoriaId(Number(d.subcategoria_id)); }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFood, token]);

  const handleSaveSubcat = async (id: number | null) => {
    setSubcategoriaId(id);
    // Preenche o campo Categoria do perfil com o nome da subcategoria selecionada
    if (id !== null) {
      const sub = subcategorias.find(s => s.id === id);
      if (sub) setPerfil(p => ({ ...p, categoria: sub.nome }));
    }
    setSavingSubcat(true);
    setSavedSubcat(false);
    try {
      const r = await fetch("/api/pdv/config-subcategoria", { method: "PUT", headers, body: JSON.stringify({ subcategoria_id: id }) });
      if (r.ok) { setSavedSubcat(true); setTimeout(() => setSavedSubcat(false), 2500); }
    } catch { /* silent */ }
    setSavingSubcat(false);
  };

  useEffect(() => {
    Promise.all([
      fetch("/api/pdv/config-entrega", { headers }).then(r => r.ok ? r.json() : null),
      fetch("/api/pdv/config-area", { headers }).then(r => r.ok ? r.json() : null),
      fetch("/api/pdv/config-pagamento", { headers }).then(r => r.ok ? r.json() : null),
      fetch("/api/pdv/config-pix", { headers }).then(r => r.ok ? r.json() : null),
      fetch("/api/pdv/perfil", { headers }).then(r => r.ok ? r.json() : null),
      fetch("/api/payments/partner-config", { headers }).then(r => r.ok ? r.json() : null),
    ]).then(([entrega, areaData, pag, pix, perfilData, mp]) => {
      if (entrega) setCfg({
        tipo: entrega.tipo ?? "fixa",
        taxa_fixa: Number(entrega.taxa_fixa ?? 5),
        taxa_por_km: Number(entrega.taxa_por_km ?? 2),
        km_minimo: Number(entrega.km_minimo ?? 0),
        raio_max_km: Number(entrega.raio_max_km ?? 10),
        taxa_minima: Number(entrega.taxa_minima ?? 5),
        endereco_restaurante: entrega.endereco_restaurante ?? "",
        ativo: entrega.ativo ?? true,
      });
      if (areaData) setArea({
        lat_loja: areaData.lat_loja ?? "",
        lng_loja: areaData.lng_loja ?? "",
        raio_visibilidade_km: Number(areaData.raio_visibilidade_km ?? 50),
      });
      if (pag?.metodos) setMetodosPag(pag.metodos);
      if (pix?.chave_pix !== undefined) {
        setPixChave(pix.chave_pix ?? "");
        setPixTipo(pix.tipo_chave_pix ?? "aleatoria");
        setDadosRecebimento({
          numero_conta_mercado_pago: pix.numero_conta_mercado_pago ?? "",
        });
      }
      if (perfilData) setPerfil({ nome: perfilData.nome ?? "", categoria: perfilData.categoria ?? "", descricao: perfilData.descricao ?? "", telefone: perfilData.telefone ?? "", cnpj: perfilData.cnpj ?? "" });
      if (mp) setMpConfig(prev => ({
        ...prev,
        mercadoPagoEnabled: !!mp.mercadoPagoEnabled,
        directPaymentEnabled: mp.directPaymentEnabled ?? true,
        configured: !!mp.configured,
        beta: !!mp.beta,
        environment: mp.environment || "sandbox",
      }));
    })
    .catch(() => {})
    .finally(() => { setLoading(false); setLoadingPag(false); });
  }, [token]);

  const handleSavePerfil = async () => {
    setSavingPerfil(true); setPerfilError(""); setSavedPerfil(false);
    try {
      const r = await fetch("/api/pdv/perfil", { method: "PUT", headers, body: JSON.stringify(perfil) });
      if (r.ok) { setSavedPerfil(true); setTimeout(() => setSavedPerfil(false), 3000); }
      else {
        let detail = "";
        try { const e = await r.json(); detail = e?.error || e?.message || ""; } catch { /* no-op */ }
        setPerfilError(`Erro ao salvar (${r.status})${detail ? ": " + detail : ". Tente novamente."}`);
      }
    } catch (err: unknown) {
      setPerfilError(`Falha de conexão: ${err instanceof Error ? err.message : String(err)}`);
    }
    setSavingPerfil(false);
  };

  const handleSavePix = async () => {
    setSavingPix(true); setPixError(""); setSavedPix(false);
    try {
      const r = await fetch("/api/pdv/config-pix", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          chave_pix: pixChave,
          tipo_chave_pix: pixTipo,
          ...dadosRecebimento,
        }),
      });
      if (r.ok) { setSavedPix(true); setTimeout(() => setSavedPix(false), 3000); }
      else setPixError("Erro ao salvar. Tente novamente.");
    } catch { setPixError("Falha de conexão. Tente novamente."); }
    setSavingPix(false);
  };

  const handleSaveArea = async () => {
    setSavingArea(true); setAreaSaveError(""); setSavedArea(false);
    try {
      const r = await fetch("/api/pdv/config-area", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          lat_loja: area.lat_loja ? Number(area.lat_loja) : null,
          lng_loja: area.lng_loja ? Number(area.lng_loja) : null,
          raio_visibilidade_km: area.raio_visibilidade_km,
        }),
      });
      if (r.ok) { setSavedArea(true); setTimeout(() => setSavedArea(false), 3000); }
      else {
        let detail = "";
        try { const e = await r.json(); detail = e?.error || e?.message || ""; } catch { /* no-op */ }
        setAreaSaveError(`Erro ao salvar (${r.status})${detail ? ": " + detail : ". Tente novamente."}`);
      }
    } catch (err: unknown) {
      setAreaSaveError(`Falha de conexão: ${err instanceof Error ? err.message : String(err)}`);
    }
    setSavingArea(false);
  };

  const handleSave = async () => {
    setSaving(true); setSaveError(""); setSaved(false);
    try {
      const r = await fetch("/api/pdv/config-entrega", {
        method: "PUT",
        headers,
        body: JSON.stringify(cfg),
      });
      if (r.ok) {
        const saved = await r.json();
        setCfg(prev => ({
          ...prev,
          tipo: saved.tipo ?? prev.tipo,
          taxa_fixa: Number(saved.taxa_fixa ?? prev.taxa_fixa),
          taxa_por_km: Number(saved.taxa_por_km ?? prev.taxa_por_km),
          km_minimo: Number(saved.km_minimo ?? prev.km_minimo),
          raio_max_km: Number(saved.raio_max_km ?? prev.raio_max_km),
          taxa_minima: Number(saved.taxa_minima ?? prev.taxa_minima),
          endereco_restaurante: saved.endereco_restaurante ?? prev.endereco_restaurante,
          ativo: saved.ativo ?? prev.ativo,
        }));
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        let detail = "";
        try { const e = await r.json(); detail = e?.error || e?.message || ""; } catch { /* no-op */ }
        setSaveError(`Erro ao salvar (${r.status})${detail ? ": " + detail : ". Tente novamente."}`);
      }
    } catch (err: unknown) {
      setSaveError(`Falha de conexão: ${err instanceof Error ? err.message : String(err)}`);
    }
    setSaving(false);
  };

  const handleSavePag = async () => {
    setSavingPag(true); setPagError(""); setSavedPag(false);
    try {
      const r = await fetch("/api/pdv/config-pagamento", {
        method: "PUT",
        headers,
        body: JSON.stringify({ metodos: metodosPag }),
      });
      if (r.ok) {
        setSavedPag(true);
        setTimeout(() => setSavedPag(false), 3000);
      } else {
        setPagError("Erro ao salvar. Tente novamente.");
      }
    } catch {
      setPagError("Falha de conexão. Tente novamente.");
    }
    setSavingPag(false);
  };

  const handleSaveMp = async () => {
    setSavingMp(true); setMpError(""); setSavedMp(false);
    try {
      const r = await fetch("/api/payments/partner-options", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          mercadoPagoEnabled: mpConfig.mercadoPagoEnabled,
          directPaymentEnabled: mpConfig.directPaymentEnabled,
        }),
      });
      
      if (r.ok) {
        const updated = await r.json();
        setMpConfig(prev => ({ ...prev, ...updated }));
        setSavedMp(true);
        setTimeout(() => setSavedMp(false), 3000);
      } else {
        const err = await r.json().catch(() => ({}));
        setMpError(err.message || err.error || "Erro ao salvar opções de pagamento.");
      }
    } catch {
      setMpError("Falha de conexão. Tente novamente.");
    }
    setSavingMp(false);
  };

  const toggleMetodo = (key: string) => {
    setMetodosPag(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleAlterarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setSenhaMsg(null);
    if (novaSenha !== confirmaSenha) { setSenhaMsg({ ok: false, text: "As senhas não coincidem." }); return; }
    if (novaSenha.length < 6) { setSenhaMsg({ ok: false, text: "A nova senha deve ter pelo menos 6 caracteres." }); return; }
    setSavingSenha(true);
    try {
      const res = await fetch("/api/pdv/alterar-senha", {
        method: "PATCH", headers,
        body: JSON.stringify({ senhaAtual, novaSenha }),
      });
      const data = await res.json();
      if (res.ok) {
        setSenhaMsg({ ok: true, text: "Senha alterada com sucesso!" });
        setSenhaAtual(""); setNovaSenha(""); setConfirmaSenha("");
      } else {
        setSenhaMsg({ ok: false, text: data.message || "Erro ao alterar senha." });
      }
    } catch { setSenhaMsg({ ok: false, text: "Erro de rede. Tente novamente." }); }
    setSavingSenha(false);
    setTimeout(() => setSenhaMsg(null), 4000);
  };

  const set = <K extends keyof ConfigEntrega>(key: K, val: ConfigEntrega[K]) =>
    setCfg(prev => ({ ...prev, [key]: val }));

  const exampleKm = 3;
  const kmCobrado = Math.max(0, exampleKm - cfg.km_minimo);
  const taxaExemplo = cfg.tipo === "fixa"
    ? cfg.taxa_fixa
    : Math.max(cfg.taxa_minima, cfg.taxa_por_km * kmCobrado);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-5xl mx-auto"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Configurações</h1>
        <p className="text-muted-foreground mt-1">Gerencie o perfil da loja, horários e preferências.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile */}
        <div className="md:col-span-1">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Store className="w-5 h-5 text-primary" /> Perfil da Loja
          </h3>
          <p className="text-sm text-muted-foreground mt-1">Informações públicas exibidas para os clientes.</p>
        </div>
        <Card className="md:col-span-2 shadow-sm border-border/50">
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome da Loja</label>
                <Input value={perfil.nome} onChange={e => setPerfil(p => ({ ...p, nome: e.target.value }))} placeholder="Nome da loja" className="bg-muted/50" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Categoria</label>
                <Input value={perfil.categoria} onChange={e => setPerfil(p => ({ ...p, categoria: e.target.value }))} placeholder="Ex: Pizzaria, Loja de Roupas..." className="bg-muted/50" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição Curta</label>
              <Input value={perfil.descricao} onChange={e => setPerfil(p => ({ ...p, descricao: e.target.value }))} placeholder="Breve descrição para os clientes" className="bg-muted/50" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Telefone / WhatsApp</label>
                <Input value={perfil.telefone} onChange={e => setPerfil(p => ({ ...p, telefone: e.target.value }))} placeholder="(11) 99999-9999" className="bg-muted/50" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">CNPJ</label>
                <Input value={perfil.cnpj} onChange={e => setPerfil(p => ({ ...p, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" className="bg-muted/50" />
              </div>
            </div>
            {perfilError && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-3 py-2 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" /> {perfilError}
              </div>
            )}
            <div className="flex justify-end pt-2">
              <Button onClick={handleSavePerfil} disabled={savingPerfil} className="min-w-[140px]">
                {savingPerfil ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : savedPerfil ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                {savingPerfil ? "Salvando..." : savedPerfil ? "Salvo!" : "Salvar Perfil"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Subcategoria de Alimentação — só aparece para parceiros food */}
        {isFood && subcategorias.length > 0 && (
          <>
            <div className="md:col-span-1 mt-6">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <UtensilsCrossed className="w-5 h-5 text-primary" /> Tipo de Estabelecimento
              </h3>
              <p className="text-sm text-muted-foreground mt-1">Selecione a subcategoria que melhor descreve o seu negócio. Isso ajuda os clientes a encontrar sua loja no app.</p>
            </div>
            <Card className="md:col-span-2 shadow-sm border-border/50 mt-0 md:mt-6">
              <CardContent className="p-6 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {subcategorias.map(sub => {
                    const sel = subcategoriaId === sub.id;
                    return (
                      <button
                        key={sub.id}
                        onClick={() => handleSaveSubcat(sel ? null : sub.id)}
                        disabled={savingSubcat}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                          sel
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-muted/30 text-foreground hover:border-primary/40"
                        } disabled:opacity-50`}
                      >
                        {sub.emoji && <span className="text-base">{sub.emoji}</span>}
                        {sub.nome}
                        {sel && <CheckCircle2 className="w-3.5 h-3.5 ml-1" />}
                      </button>
                    );
                  })}
                </div>
                {savedSubcat && (
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <CheckCircle2 className="w-4 h-4" /> Subcategoria salva com sucesso!
                  </div>
                )}
                {!subcategoriaId && (
                  <p className="text-xs text-muted-foreground">Nenhuma subcategoria selecionada. Seu estabelecimento aparecerá na aba "Todos" do app.</p>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Delivery fees / km calc */}
        <div className="md:col-span-1 mt-6">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" /> {isPassagens ? "Calcular por km" : "Taxa de Entrega"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {isPassagens
              ? "Configure o cálculo de tarifa por distância percorrida nas viagens."
              : "Configure como a taxa de delivery é calculada para os pedidos."}
          </p>
        </div>
        <Card className="md:col-span-2 shadow-sm border-border/50 mt-0 md:mt-6">
          <CardContent className="p-6 space-y-5">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando configurações...
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border/50">
                  <div>
                    <p className="font-medium">{isPassagens ? "Calcular tarifa por km" : "Cobrar taxa de entrega"}</p>
                    <p className="text-sm text-muted-foreground">
                      {isPassagens ? "Ative para calcular o valor da viagem por distância percorrida." : "Ative para aplicar taxa nos pedidos delivery."}
                    </p>
                  </div>
                  <Switch checked={cfg.ativo} onCheckedChange={v => set("ativo", v)} />
                </div>

                {cfg.ativo && (
                  <>
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-2">Tipo de cobrança</p>
                      <div className="grid grid-cols-2 gap-3">
                        {(["fixa", "km"] as const).map(t => (
                          <button
                            key={t}
                            onClick={() => set("tipo", t)}
                            className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left ${
                              cfg.tipo === t
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/30 bg-muted/20"
                            }`}
                          >
                            <span className="font-semibold text-sm text-foreground">
                              {t === "fixa" ? "Taxa Fixa" : "Por Quilômetro"}
                            </span>
                            <span className="text-xs text-muted-foreground mt-0.5">
                              {t === "fixa"
                                ? "Valor único para qualquer distância"
                                : "Calculado via Google Maps por km percorrido"}
                            </span>
                            {cfg.tipo === t && (
                              <span className="mt-2 text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-semibold">Ativo</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {cfg.tipo === "fixa" && (
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium">Valor da taxa fixa (R$)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                            <Input
                              type="number" min="0" step="0.50"
                              value={cfg.taxa_fixa}
                              onChange={e => set("taxa_fixa", Number(e.target.value))}
                              className="pl-9 bg-muted/50"
                            />
                          </div>
                        </div>
                        <div className="bg-blue-500/5 border border-blue-500/15 rounded-lg p-3 text-sm">
                          <span className="text-muted-foreground">Exemplo: </span>
                          <span className="font-semibold text-foreground">Todo delivery cobrará R$ {cfg.taxa_fixa.toFixed(2)} fixo.</span>
                        </div>
                      </div>
                    )}

                    {cfg.tipo === "km" && (
                      <div className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-primary" />
                            {isPassagens ? "Endereço de partida (garagem / terminal)" : "Endereço do restaurante (origem)"}
                          </label>
                          <AddressAutocomplete
                            value={cfg.endereco_restaurante}
                            onChange={v => set("endereco_restaurante", v)}
                            placeholder={isPassagens ? "Ex: Terminal Rodoviário de São Paulo" : "Ex: Rua das Flores, 100, São Paulo, SP"}
                          />
                          <p className="text-xs text-muted-foreground">
                            {isPassagens ? "Endereço de origem para calcular a distância até o destino." : "Este endereço é usado como ponto de partida para calcular a distância."}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium">Taxa por km (R$)</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                              <Input type="number" min="0" step="0.50" value={cfg.taxa_por_km}
                                onChange={e => set("taxa_por_km", Number(e.target.value))}
                                className="pl-9 bg-muted/50" />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium">Taxa mínima (R$)</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                              <Input type="number" min="0" step="0.50" value={cfg.taxa_minima}
                                onChange={e => set("taxa_minima", Number(e.target.value))}
                                className="pl-9 bg-muted/50" />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium">KM grátis (primeiros km)</label>
                            <Input type="number" min="0" step="0.5" value={cfg.km_minimo}
                              onChange={e => set("km_minimo", Number(e.target.value))}
                              className="bg-muted/50" placeholder="0" />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium">Raio máximo (km)</label>
                            <Input type="number" min="1" step="1" value={cfg.raio_max_km}
                              onChange={e => set("raio_max_km", Number(e.target.value))}
                              className="bg-muted/50" />
                          </div>
                        </div>

                        <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4 space-y-2">
                          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Prévia — exemplo {exampleKm} km</p>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between text-muted-foreground">
                              <span>Distância percorrida</span><span>{exampleKm} km</span>
                            </div>
                            {cfg.km_minimo > 0 && (
                              <div className="flex justify-between text-muted-foreground">
                                <span>Grátis até {cfg.km_minimo} km</span><span>- {cfg.km_minimo} km</span>
                              </div>
                            )}
                            <div className="flex justify-between text-muted-foreground">
                              <span>KM cobrado × R$ {cfg.taxa_por_km.toFixed(2)}</span>
                              <span>{kmCobrado.toFixed(1)} km</span>
                            </div>
                            <div className="flex justify-between font-bold text-foreground border-t border-blue-500/15 pt-2 mt-1">
                              <span>Taxa de entrega</span>
                              <span className="text-primary">R$ {taxaExemplo.toFixed(2)}</span>
                            </div>
                            {cfg.raio_max_km > 0 && (
                              <p className="text-xs text-muted-foreground">Máximo: {cfg.raio_max_km} km de distância</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {!loading && (
              <>
                {saveError && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
                    <AlertCircle className="w-4 h-4 shrink-0" />{saveError}
                  </div>
                )}
                <Button onClick={handleSave} disabled={saving} className="w-full bg-primary hover:bg-primary/90 shadow-md shadow-primary/20">
                  {saving
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                    : saved
                    ? <><CheckCircle2 className="w-4 h-4 mr-2 text-green-400" />Salvo!</>
                    : <><Save className="w-4 h-4 mr-2" />{isPassagens ? "Salvar configuração de km" : "Salvar configurações de entrega"}</>
                  }
                </Button>
              </>
            )}
          </CardContent>
        </Card>


        {/* Area limit */}
        <div className="md:col-span-1 mt-6">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" /> Área de Visibilidade
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Defina a localização da loja e o raio máximo no qual ela aparece para clientes no app.
          </p>
        </div>
        <Card className="md:col-span-2 shadow-sm border-border/50 mt-0 md:mt-6">
          <CardContent className="p-6 space-y-5">
            <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2">
              <Navigation className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span>Informe a latitude e longitude da sua loja para que o app calcule a distância até o cliente e mostre apenas restaurantes próximos.</span>
                <div>
                  <span>Não sabe sua localização? </span>
                  <a
                    href="https://www.latlong.net/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity"
                  >
                    Clique aqui para descobrir no mapa →
                  </a>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" /> Latitude da Loja
                </label>
                <Input
                  type="number" step="0.000001" placeholder="Ex: -23.5505"
                  value={area.lat_loja}
                  onChange={e => setArea(a => ({ ...a, lat_loja: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" /> Longitude da Loja
                </label>
                <Input
                  type="number" step="0.000001" placeholder="Ex: -46.6333"
                  value={area.lng_loja}
                  onChange={e => setArea(a => ({ ...a, lng_loja: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-muted-foreground" /> Raio de Visibilidade (km)
              </label>
              <Input
                type="number" min="1" max="500" step="1"
                value={area.raio_visibilidade_km}
                onChange={e => setArea(a => ({ ...a, raio_visibilidade_km: Number(e.target.value) }))}
              />
              <p className="text-xs text-muted-foreground">
                Clientes a mais de <strong>{area.raio_visibilidade_km} km</strong> não verão sua loja no app.
                Deixe um valor alto (ex: 500) para exibir para todos.
              </p>
            </div>

            {areaSaveError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0" />{areaSaveError}
              </div>
            )}

            <Button onClick={handleSaveArea} disabled={savingArea} className="bg-primary hover:bg-primary/90">
              {savingArea
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                : savedArea
                ? <><CheckCircle2 className="w-4 h-4 mr-2 text-green-400" />Área salva!</>
                : <><Save className="w-4 h-4 mr-2" />Salvar Área</>
              }
            </Button>
          </CardContent>
        </Card>

        {/* ── Payment methods ─────────────────────────────────────────────── */}
        <div className="md:col-span-1 mt-6">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" /> Formas de Pagamento
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Métodos aceitos na entrega ou no balcão. Os métodos ativos aparecerão para o cliente escolher no app.
          </p>
        </div>
        <Card className="md:col-span-2 shadow-sm border-border/50 mt-0 md:mt-6">
          <CardContent className="p-6 space-y-5">
            {loadingPag ? (
              <div className="flex items-center gap-2 text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando formas de pagamento...
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PAYMENT_METHODS.map(method => {
                    const enabled = metodosPag.includes(method.key);
                    return (
                      <div
                        key={method.key}
                        onClick={() => toggleMetodo(method.key)}
                        className={`flex items-center gap-3 p-3.5 border-2 rounded-xl cursor-pointer transition-all ${
                          enabled
                            ? "border-primary/40 bg-primary/5"
                            : "border-border/50 hover:border-border bg-card"
                        }`}
                      >
                        <span className="text-2xl">{method.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{method.label}</p>
                          {enabled && (
                            <p className="text-[11px] text-primary font-semibold">Habilitado</p>
                          )}
                        </div>
                        <Switch
                          checked={enabled}
                          onCheckedChange={() => toggleMetodo(method.key)}
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-4 py-3">
                  <strong>{metodosPag.length}</strong> {metodosPag.length === 1 ? "forma habilitada" : "formas habilitadas"}.
                  {metodosPag.length === 0 && " Habilite ao menos uma forma de pagamento."}
                </div>

                {pagError && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
                    <AlertCircle className="w-4 h-4 shrink-0" />{pagError}
                  </div>
                )}

                <Button
                  onClick={handleSavePag}
                  disabled={savingPag || metodosPag.length === 0}
                  className="w-full bg-primary hover:bg-primary/90 shadow-md shadow-primary/20"
                >
                  {savingPag
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                    : savedPag
                    ? <><CheckCircle2 className="w-4 h-4 mr-2 text-green-400" />Formas de pagamento salvas!</>
                    : <><Save className="w-4 h-4 mr-2" />Salvar formas de pagamento</>
                  }
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* PIX Direto */}
        <div className="md:col-span-1 mt-6">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="w-5 h-5 text-green-500" /> PIX Direto ao Parceiro
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Configure sua chave PIX para que os clientes possam pagar diretamente para você pelo app.
          </p>
        </div>
        <Card className="md:col-span-2 shadow-sm border-border/50 mt-0 md:mt-6">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
              <Zap className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-foreground">Como funciona?</p>
                <p className="text-muted-foreground mt-0.5">
                  Quando configurado, o app do cliente exibe o botão <strong>"PIX Direto"</strong> ao fazer um pedido. O cliente copia a chave e transfere diretamente para você — sem intermediários.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo da chave</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val: "cpf", label: "CPF" },
                  { val: "cnpj", label: "CNPJ" },
                  { val: "email", label: "E-mail" },
                  { val: "telefone", label: "Telefone" },
                  { val: "aleatoria", label: "Aleatória" },
                ].map(t => (
                  <button
                    key={t.val}
                    onClick={() => setPixTipo(t.val)}
                    className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      pixTipo === t.val
                        ? "border-green-500 bg-green-500/10 text-green-600"
                        : "border-border bg-muted/30 text-muted-foreground hover:border-border/80"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Chave PIX</label>
              <div className="flex gap-2">
                <Input
                  value={pixChave}
                  onChange={e => setPixChave(e.target.value)}
                  placeholder={
                    pixTipo === "cpf" ? "000.000.000-00" :
                    pixTipo === "cnpj" ? "00.000.000/0001-00" :
                    pixTipo === "email" ? "seu@email.com" :
                    pixTipo === "telefone" ? "+55 11 99999-9999" :
                    "Cole aqui a chave aleatória"
                  }
                  className="flex-1"
                />
                {pixChave && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => { navigator.clipboard.writeText(pixChave); setPixCopiado(true); setTimeout(() => setPixCopiado(false), 2000); }}
                    title="Copiar chave"
                  >
                    {pixCopiado ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Esta chave ficará visível para os clientes no app ao realizar pedidos.
              </p>
            </div>

              <div className="border-t border-border pt-5 space-y-4">
              <div>
                 <p className="text-sm font-semibold text-foreground">Conta Mercado Pago para receber repasses</p>
                <p className="text-xs text-muted-foreground mt-1">
                   Para receber repasses relacionados aos pagamentos via Mercado Pago, você precisa criar uma conta Mercado Pago.
                   O Mercado Pago não transfere esse valor automaticamente para outro banco.
                </p>
              </div>

              <div className="space-y-2">
                 <label className="text-sm font-medium">Número da sua conta Mercado Pago</label>
                <Input
                  value={dadosRecebimento.numero_conta_mercado_pago}
                  onChange={e => setDadosRecebimento(prev => ({ ...prev, numero_conta_mercado_pago: e.target.value }))}
                  placeholder="Ex: 123456789"
                  className="font-mono"
                />
                 <p className="text-xs text-muted-foreground">
                   Informe o número da conta Mercado Pago criada em seu nome ou em nome da sua empresa.
                 </p>
              </div>
            </div>

            {pixError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0" />{pixError}
              </div>
            )}

            <Button
              onClick={handleSavePix}
              disabled={savingPix}
              className="w-full bg-green-600 hover:bg-green-700 shadow-md shadow-green-500/20"
            >
              {savingPix
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                : savedPix
                ? <><CheckCircle2 className="w-4 h-4 mr-2" />Chave PIX salva!</>
                : <><Zap className="w-4 h-4 mr-2" />Salvar chave PIX</>
              }
            </Button>
          </CardContent>
        </Card>

        {/* Mercado Pago */}
        <div className="md:col-span-1 mt-6">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[#009EE3]" /> Integração Mercado Pago
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            A GoTaxi processa os pagamentos pela conta global. Para receber repasses, mantenha uma conta Mercado Pago própria.
          </p>
        </div>
        <Card className="md:col-span-2 shadow-sm border-border/50 mt-0 md:mt-6 overflow-hidden">
          <div className="bg-[#009EE3]/5 border-b border-[#009EE3]/10 px-6 py-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-[#009EE3] flex items-center gap-2">
                Configuração da integração
                {mpConfig.beta && (
                  <span className="bg-[#009EE3] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">BETA</span>
                )}
                {mpConfig.environment === "sandbox" && (
                  <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">SANDBOX</span>
                )}
                {mpConfig.configured && (
                  <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Configurado
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                As credenciais são globais, pertencem à GoTaxi e não são acessíveis aos parceiros.
              </p>
            </div>
          </div>
          <CardContent className="p-6 space-y-5">
            <div className={`rounded-xl border p-4 ${mpConfig.configured ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
              <p className={`text-sm font-semibold ${mpConfig.configured ? "text-green-700" : "text-amber-700"}`}>
                {mpConfig.configured ? "Integração global da GoTaxi ativa" : "Integração global aguardando configuração"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {mpConfig.configured
                  ? "Você pode escolher abaixo quais formas de pagamento deseja aceitar."
                  : "A integração global ainda não foi ativada pela GoTaxi."}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-6 space-y-4">
              <p className="font-semibold text-sm text-foreground mb-2">Opções de Checkout</p>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Aceitar Pagamentos via Mercado Pago</p>
                  <p className="text-xs text-muted-foreground">O cliente pagará pelo app. O pagamento será processado pela conta global da GoTaxi.</p>
                </div>
                <Switch 
                  checked={mpConfig.mercadoPagoEnabled} 
                  onCheckedChange={v => setMpConfig(p => ({ ...p, mercadoPagoEnabled: v }))} 
                  disabled={!mpConfig.configured} 
                />
              </div>
              
              <div className="border-t border-slate-200 pt-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Aceitar Recebimento Direto</p>
                  <p className="text-xs text-muted-foreground">O cliente pagará diretamente para você via Pix ou maquineta no ato da entrega (usa suas formas de pagamento configuradas acima).</p>
                </div>
                <Switch 
                  checked={mpConfig.directPaymentEnabled} 
                  onCheckedChange={v => setMpConfig(p => ({ ...p, directPaymentEnabled: v }))} 
                />
              </div>
            </div>

            {mpError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0" />{mpError}
              </div>
            )}

            <Button
              onClick={handleSaveMp}
              disabled={savingMp}
              className="w-full bg-[#009EE3] hover:bg-[#009EE3]/90 text-white shadow-md shadow-[#009EE3]/20"
            >
              {savingMp
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                : savedMp
                ? <><CheckCircle2 className="w-4 h-4 mr-2" />Configuração salva!</>
                : <><Save className="w-4 h-4 mr-2" />Salvar Configuração Mercado Pago</>
              }
            </Button>
          </CardContent>
        </Card>

        {/* Alterar Senha */}
        <Card className="border-border">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-foreground">Alterar Senha de Acesso</h3>
                <p className="text-xs text-muted-foreground">Altere a senha de login da sua conta no painel.</p>
              </div>
            </div>
            <form onSubmit={handleAlterarSenha} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Senha atual</label>
                <input type="password" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
                  autoComplete="current-password" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Nova senha <span className="text-muted-foreground/60">(mínimo 6 caracteres)</span></label>
                <input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
                  autoComplete="new-password" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Confirmar nova senha</label>
                <input type="password" value={confirmaSenha} onChange={e => setConfirmaSenha(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
                  autoComplete="new-password" />
              </div>
              {senhaMsg && (
                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm ${senhaMsg.ok ? "bg-green-500/10 border border-green-500/20 text-green-600" : "bg-destructive/10 border border-destructive/20 text-destructive"}`}>
                  {senhaMsg.ok
                    ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                    : <AlertCircle className="w-4 h-4 shrink-0" />}
                  {senhaMsg.text}
                </div>
              )}
              <Button type="submit" disabled={savingSenha || !senhaAtual || !novaSenha || !confirmaSenha}
                className="w-full bg-orange-500 hover:bg-orange-600 shadow-md shadow-orange-500/20">
                {savingSenha ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Alterando...</> : "Alterar Senha"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
