import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Store, MapPin, Truck, CreditCard, Save, CheckCircle2, AlertCircle, Loader2, Globe, Navigation, Zap, Copy, UtensilsCrossed, Wallet, Ticket, Tag, Lock } from "lucide-react";
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
  { key: "pix",      label: "Pix",                  icon: Zap,        color: "text-green-500" },
  { key: "dinheiro", label: "Dinheiro",             icon: Wallet,     color: "text-emerald-500" },
  { key: "credito",  label: "Cartão de Crédito",    icon: CreditCard, color: "text-blue-500" },
  { key: "debito",   label: "Cartão de Débito",     icon: CreditCard, color: "text-violet-500" },
  { key: "vr",       label: "Vale Refeição / VR",   icon: Ticket,     color: "text-orange-500" },
  { key: "sodexo",   label: "Sodexo / Alelo",       icon: Tag,        color: "text-rose-500" },
];

function SettingBlock({ title, description, icon: Icon, children }: { title: string, description: string, icon: React.ElementType, children: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row gap-6 lg:gap-10 items-start border-b border-border/50 pb-10 pt-4 last:border-0 last:pb-0">
      <div className="w-full md:w-[320px] shrink-0 md:sticky md:top-24">
        <h3 className="text-base font-semibold flex items-center gap-2 text-foreground">
          <Icon className="w-5 h-5 text-primary" /> {title}
        </h3>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{description}</p>
      </div>
      <div className="flex-1 w-full min-w-0">
        <Card className="shadow-sm border-border/60 bg-card overflow-hidden">
          <CardContent className="p-6">
            {children}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

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
  const [areaAddress, setAreaAddress] = useState("");
  const [geocodingArea, setGeocodingArea] = useState(false);
  const [areaAddressError, setAreaAddressError] = useState("");
  const [areaAddressResult, setAreaAddressResult] = useState("");
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
      if (r.ok) {
        const saved = await r.json().catch(() => ({}));
        setPixChave(String(saved.chave_pix ?? pixChave));
        setPixTipo(String(saved.tipo_chave_pix ?? pixTipo));
        setDadosRecebimento(prev => ({
          ...prev,
          numero_conta_mercado_pago: String(saved.numero_conta_mercado_pago ?? prev.numero_conta_mercado_pago),
        }));
        setSavedPix(true);
        setTimeout(() => setSavedPix(false), 3000);
      } else {
        const err = await r.json().catch(() => ({}));
        setPixError(err.message || err.error || `Erro ao salvar (${r.status}).`);
      }
    } catch { setPixError("Falha de conexão ao salvar os dados de recebimento."); }
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

  const handleGeocodeArea = async () => {
    const address = areaAddress.trim();
    if (address.length < 8) {
      setAreaAddressError("Informe rua, número, cidade e estado.");
      return;
    }
    setGeocodingArea(true);
    setAreaAddressError("");
    setAreaAddressResult("");
    try {
      const response = await fetch("/api/pdv/config-area/geocode", {
        method: "POST",
        headers,
        body: JSON.stringify({ address }),
      });
      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error(
          response.status === 404
            ? "A busca de coordenadas ainda não está instalada na API da VPS. Atualize e reinicie o serviço da API com o arquivo deste BK."
            : `A API não retornou coordenadas válidas (HTTP ${response.status}). Verifique o serviço da API.`
        );
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível localizar o endereço.");
      if (!Number.isFinite(result.lat) || !Number.isFinite(result.lng)) {
        throw new Error("O Google Maps não retornou coordenadas válidas.");
      }
      setArea(a => ({ ...a, lat_loja: String(result.lat), lng_loja: String(result.lng) }));
      setAreaAddressResult(result.address || address);
      setSavedArea(false);
    } catch (err) {
      setAreaAddressError(err instanceof Error ? err.message : "Não foi possível localizar o endereço.");
    } finally {
      setGeocodingArea(false);
    }
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
      className="max-w-6xl mx-auto space-y-2 pb-12"
    >
      <div className="mb-8 border-b border-border pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Configurações</h1>
        <p className="text-muted-foreground mt-2">Gerencie o perfil da loja, horários e preferências da sua conta.</p>
      </div>

      <SettingBlock 
        title="Perfil da Loja" 
        description="Informações públicas exibidas para os clientes."
        icon={Store}
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome da Loja</label>
              <Input value={perfil.nome} onChange={e => setPerfil(p => ({ ...p, nome: e.target.value }))} placeholder="Nome da loja" className="bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoria</label>
              <Input value={perfil.categoria} onChange={e => setPerfil(p => ({ ...p, categoria: e.target.value }))} placeholder="Ex: Pizzaria, Loja de Roupas..." className="bg-muted/30" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Descrição Curta</label>
            <Input value={perfil.descricao} onChange={e => setPerfil(p => ({ ...p, descricao: e.target.value }))} placeholder="Breve descrição para os clientes" className="bg-muted/30" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Telefone / WhatsApp</label>
              <Input value={perfil.telefone} onChange={e => setPerfil(p => ({ ...p, telefone: e.target.value }))} placeholder="(11) 99999-9999" className="bg-muted/30" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">CNPJ</label>
              <Input value={perfil.cnpj} onChange={e => setPerfil(p => ({ ...p, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" className="bg-muted/30" />
            </div>
          </div>
          {perfilError && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-3 py-2.5 rounded-lg border border-destructive/20">
              <AlertCircle className="w-4 h-4 shrink-0" /> {perfilError}
            </div>
          )}
          <div className="flex justify-end pt-2">
            <Button onClick={handleSavePerfil} disabled={savingPerfil} className="min-w-[140px] bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20">
              {savingPerfil ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : savedPerfil ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              {savingPerfil ? "Salvando..." : savedPerfil ? "Salvo!" : "Salvar Perfil"}
            </Button>
          </div>
        </div>
      </SettingBlock>

      {isFood && subcategorias.length > 0 && (
        <SettingBlock 
          title="Tipo de Estabelecimento" 
          description="Selecione a subcategoria que melhor descreve o seu negócio. Isso ajuda os clientes a encontrar sua loja no app."
          icon={UtensilsCrossed}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2.5">
              {subcategorias.map(sub => {
                const sel = subcategoriaId === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => handleSaveSubcat(sel ? null : sub.id)}
                    disabled={savingSubcat}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm font-medium transition-all ${
                      sel
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border bg-muted/20 text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-muted/40"
                    } disabled:opacity-50`}
                  >
                    {sub.nome}
                    {sel && <CheckCircle2 className="w-3.5 h-3.5 ml-1" />}
                  </button>
                );
              })}
            </div>
            {savedSubcat && (
              <div className="flex items-center gap-2 text-primary font-medium text-sm">
                <CheckCircle2 className="w-4 h-4" /> Subcategoria salva com sucesso!
              </div>
            )}
            {!subcategoriaId && (
              <p className="text-sm text-muted-foreground">Nenhuma subcategoria selecionada. Seu estabelecimento aparecerá na aba "Todos" do app.</p>
            )}
          </div>
        </SettingBlock>
      )}

      <SettingBlock
        title={isPassagens ? "Calcular por km" : "Taxa de Entrega"}
        description={isPassagens ? "Configure o cálculo de tarifa por distância percorrida nas viagens." : "Configure como a taxa de delivery é calculada para os pedidos."}
        icon={Truck}
      >
        <div className="space-y-6">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando configurações...
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border/50">
                <div>
                  <p className="font-medium text-foreground">{isPassagens ? "Calcular tarifa por km" : "Cobrar taxa de entrega"}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {isPassagens ? "Ative para calcular o valor da viagem por distância percorrida." : "Ative para aplicar taxa nos pedidos delivery."}
                  </p>
                </div>
                <Switch checked={cfg.ativo} onCheckedChange={v => set("ativo", v)} />
              </div>

              {cfg.ativo && (
                <div className="space-y-6">
                  <div>
                    <p className="text-sm font-medium text-foreground mb-3">Tipo de cobrança</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {(["fixa", "km"] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => set("tipo", t)}
                          className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left ${
                            cfg.tipo === t
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-border hover:border-primary/30 bg-muted/10"
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className={`font-semibold text-sm ${cfg.tipo === t ? "text-primary" : "text-foreground"}`}>
                              {t === "fixa" ? "Taxa Fixa" : "Por Quilômetro"}
                            </span>
                            {cfg.tipo === t && (
                              <CheckCircle2 className="w-4 h-4 text-primary" />
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                            {t === "fixa"
                              ? "Valor único para qualquer distância. Simples e direto."
                              : "Calculado via Google Maps de acordo com a distância."}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {cfg.tipo === "fixa" && (
                    <div className="space-y-4 bg-muted/20 p-5 rounded-xl border border-border/50">
                      <div className="space-y-2 max-w-sm">
                        <label className="text-sm font-medium text-foreground">Valor da taxa fixa (R$)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">R$</span>
                          <Input
                            type="number" min="0" step="0.50"
                            value={cfg.taxa_fixa}
                            onChange={e => set("taxa_fixa", Number(e.target.value))}
                            className="pl-10 bg-background"
                          />
                        </div>
                      </div>
                      <div className="bg-primary/10 border border-primary/20 rounded-lg p-3.5 text-sm">
                        <span className="text-primary/80 font-medium">Exemplo: </span>
                        <span className="font-semibold text-primary">Todo delivery cobrará R$ {cfg.taxa_fixa.toFixed(2)} fixo.</span>
                      </div>
                    </div>
                  )}

                  {cfg.tipo === "km" && (
                    <div className="space-y-5 bg-muted/20 p-5 rounded-xl border border-border/50">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-primary" />
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">Taxa por km (R$)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">R$</span>
                            <Input type="number" min="0" step="0.50" value={cfg.taxa_por_km}
                              onChange={e => set("taxa_por_km", Number(e.target.value))}
                              className="pl-10 bg-background" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">Taxa mínima (R$)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">R$</span>
                            <Input type="number" min="0" step="0.50" value={cfg.taxa_minima}
                              onChange={e => set("taxa_minima", Number(e.target.value))}
                              className="pl-10 bg-background" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">KM grátis</label>
                          <div className="relative">
                            <Input type="number" min="0" step="0.5" value={cfg.km_minimo}
                              onChange={e => set("km_minimo", Number(e.target.value))}
                              className="pr-10 bg-background" placeholder="0" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">km</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">Raio máximo</label>
                          <div className="relative">
                            <Input type="number" min="1" step="1" value={cfg.raio_max_km}
                              onChange={e => set("raio_max_km", Number(e.target.value))}
                              className="pr-10 bg-background" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">km</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 space-y-3">
                        <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Simulação — exemplo {exampleKm} km</p>
                        <div className="space-y-1.5 text-sm text-blue-900/80 dark:text-blue-100/80">
                          <div className="flex justify-between">
                            <span>Distância percorrida</span><span>{exampleKm} km</span>
                          </div>
                          {cfg.km_minimo > 0 && (
                            <div className="flex justify-between">
                              <span>Grátis até {cfg.km_minimo} km</span><span>- {cfg.km_minimo} km</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span>KM cobrado × R$ {cfg.taxa_por_km.toFixed(2)}</span>
                            <span>{kmCobrado.toFixed(1)} km</span>
                          </div>
                          <div className="flex justify-between font-semibold text-blue-900 dark:text-blue-100 border-t border-blue-500/20 pt-2 mt-2">
                            <span>Valor calculado</span>
                            <span>R$ {taxaExemplo.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {!loading && (
            <div className="pt-2">
              {saveError && (
                <div className="flex items-center gap-2 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive mb-4">
                  <AlertCircle className="w-4 h-4 shrink-0" />{saveError}
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} className="min-w-[160px] bg-primary hover:bg-primary/90 shadow-md shadow-primary/20">
                  {saving
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                    : saved
                    ? <><CheckCircle2 className="w-4 h-4 mr-2 text-primary-foreground" />Salvo!</>
                    : <><Save className="w-4 h-4 mr-2" />{isPassagens ? "Salvar Km" : "Salvar Taxas"}</>
                  }
                </Button>
              </div>
            </div>
          )}
        </div>
      </SettingBlock>

      <SettingBlock
        title="Área de Visibilidade"
        description="Defina a localização da loja e o raio máximo no qual ela aparece para clientes no app."
        icon={Globe}
      >
        <div className="space-y-6">
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl text-sm text-primary/80 dark:text-primary-foreground flex items-start gap-3">
            <Navigation className="w-5 h-5 shrink-0 mt-0.5 text-primary" />
            <div className="space-y-1.5 leading-relaxed">
              <p>Busque o endereço da loja pelo Google Maps para preencher latitude e longitude. Confira o resultado antes de salvar a área.</p>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="area-address" className="text-sm font-medium text-foreground">Endereço da loja</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                id="area-address"
                value={areaAddress}
                onChange={e => { setAreaAddress(e.target.value); setAreaAddressResult(""); setAreaAddressError(""); }}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (!geocodingArea) void handleGeocodeArea(); } }}
                placeholder="Rua, número, bairro, cidade e estado"
                className="bg-muted/30"
                maxLength={300}
              />
              <Button type="button" variant="outline" onClick={handleGeocodeArea} disabled={geocodingArea || loading} className="shrink-0">
                {geocodingArea ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MapPin className="w-4 h-4 mr-2" />}
                {geocodingArea ? "Localizando..." : "Gerar coordenadas"}
              </Button>
            </div>
            {areaAddressError && <p role="alert" className="text-sm text-destructive">{areaAddressError}</p>}
            {areaAddressResult && <p className="text-sm text-muted-foreground">Local encontrado: {areaAddressResult}. Confira as coordenadas abaixo e clique em Salvar Área.</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-muted-foreground" /> Latitude da Loja
              </label>
              <Input
                type="number" step="0.000001" placeholder="Ex: -23.5505"
                value={area.lat_loja}
                onChange={e => setArea(a => ({ ...a, lat_loja: e.target.value }))}
                className="bg-muted/30"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-muted-foreground" /> Longitude da Loja
              </label>
              <Input
                type="number" step="0.000001" placeholder="Ex: -46.6333"
                value={area.lng_loja}
                onChange={e => setArea(a => ({ ...a, lng_loja: e.target.value }))}
                className="bg-muted/30"
              />
            </div>
          </div>

          <div className="space-y-2 max-w-sm">
            <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-muted-foreground" /> Raio de Visibilidade
            </label>
            <div className="relative">
              <Input
                type="number" min="1" max="500" step="1"
                value={area.raio_visibilidade_km}
                onChange={e => setArea(a => ({ ...a, raio_visibilidade_km: Number(e.target.value) }))}
                className="bg-muted/30 pr-10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">km</span>
            </div>
            <p className="text-xs text-muted-foreground pt-1 leading-relaxed">
              Clientes a mais de <strong>{area.raio_visibilidade_km} km</strong> não verão sua loja no app. Deixe 500 para exibir para todos.
            </p>
          </div>

          <div className="pt-2 flex justify-end">
            {areaSaveError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive mr-4">
                <AlertCircle className="w-4 h-4 shrink-0" />{areaSaveError}
              </div>
            )}
            <Button onClick={handleSaveArea} disabled={savingArea} className="min-w-[160px] bg-primary hover:bg-primary/90 shadow-md shadow-primary/20">
              {savingArea
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                : savedArea
                ? <><CheckCircle2 className="w-4 h-4 mr-2 text-primary-foreground" />Área salva!</>
                : <><Save className="w-4 h-4 mr-2" />Salvar Área</>
              }
            </Button>
          </div>
        </div>
      </SettingBlock>

      <SettingBlock
        title="Formas de Pagamento"
        description="Métodos aceitos na entrega ou no balcão. Aparecerão para o cliente no momento do checkout."
        icon={CreditCard}
      >
        <div className="space-y-6">
          {loadingPag ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando formas de pagamento...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {PAYMENT_METHODS.map(method => {
                  const enabled = metodosPag.includes(method.key);
                  return (
                    <div
                      key={method.key}
                      onClick={() => toggleMetodo(method.key)}
                      className={`flex flex-col gap-3 p-4 border rounded-xl cursor-pointer transition-all ${
                        enabled
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-border/80 bg-background"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className={`p-2 rounded-lg ${enabled ? "bg-background" : "bg-muted"}`}>
                          <method.icon className={`w-5 h-5 ${method.color}`} />
                        </div>
                        <Switch
                          checked={enabled}
                          onCheckedChange={() => toggleMetodo(method.key)}
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{method.label}</p>
                        <p className={`text-xs mt-0.5 ${enabled ? "text-primary font-medium" : "text-muted-foreground"}`}>
                          {enabled ? "Ativo" : "Desativado"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 flex flex-col sm:flex-row justify-between items-center gap-4 border-t border-border/50 pt-6 mt-6">
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">{metodosPag.length}</strong> {metodosPag.length === 1 ? "forma habilitada" : "formas habilitadas"}.
                </p>
                <div className="flex items-center gap-4">
                  {pagError && (
                    <span className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />{pagError}
                    </span>
                  )}
                  <Button
                    onClick={handleSavePag}
                    disabled={savingPag || metodosPag.length === 0}
                    className="min-w-[160px] bg-primary hover:bg-primary/90 shadow-md shadow-primary/20"
                  >
                    {savingPag
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                      : savedPag
                      ? <><CheckCircle2 className="w-4 h-4 mr-2 text-primary-foreground" />Salvo!</>
                      : <><Save className="w-4 h-4 mr-2" />Salvar Pagamentos</>
                    }
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </SettingBlock>

      <SettingBlock
        title="PIX Direto ao Parceiro"
        description="Configure sua chave PIX para que os clientes transfiram diretamente para sua conta."
        icon={Zap}
      >
        <div className="space-y-6">
          <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-900 dark:text-green-100">
            <Zap className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            <div className="text-sm leading-relaxed">
              <p className="font-semibold mb-0.5 text-green-800 dark:text-green-300">Como funciona?</p>
              <p className="opacity-90">
                O app exibirá o botão <strong>"PIX Direto"</strong> no checkout. O cliente transfere diretamente para você, e a taxa de serviço da GoTaxi é contabilizada separadamente.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Tipo de Chave PIX</label>
            <div className="flex flex-wrap gap-2.5">
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
                  className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                    pixTipo === t.val
                      ? "border-green-500 bg-green-500/10 text-green-700 dark:text-green-400 shadow-sm"
                      : "border-border bg-muted/20 text-muted-foreground hover:border-green-500/30 hover:bg-green-500/5 hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Sua Chave PIX</label>
            <div className="flex gap-2 max-w-lg">
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
                className="flex-1 bg-muted/30 font-mono"
              />
              {pixChave && (
                <Button
                  variant="outline"
                  className="shrink-0 w-10 p-0 border-border"
                  onClick={() => { navigator.clipboard.writeText(pixChave); setPixCopiado(true); setTimeout(() => setPixCopiado(false), 2000); }}
                  title="Copiar chave"
                >
                  {pixCopiado ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                </Button>
              )}
            </div>
          </div>

          <div className="border-t border-border pt-6 mt-6 space-y-4">
            <div>
               <p className="text-sm font-semibold text-foreground">Conta Mercado Pago do parceiro</p>
              <p className="text-sm text-muted-foreground mt-1">
                 Informe o número da conta Mercado Pago do parceiro para identificar os repasses. Essa informação não substitui as credenciais globais da GoTaxi.
              </p>
            </div>

            <div className="space-y-2 max-w-sm">
               <label className="text-sm font-medium text-foreground">Número da conta Mercado Pago</label>
              <Input
                value={dadosRecebimento.numero_conta_mercado_pago}
                onChange={e => setDadosRecebimento(prev => ({ ...prev, numero_conta_mercado_pago: e.target.value }))}
                placeholder="Ex: 123456789"
                className="font-mono bg-muted/30"
              />
            </div>
          </div>

           <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {pixError && (
               <div className="flex items-center gap-2 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0" />{pixError}
              </div>
            )}
            <Button
              onClick={handleSavePix}
              disabled={savingPix}
              className="min-w-[160px] bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-500/20"
            >
              {savingPix
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                : savedPix
                ? <><CheckCircle2 className="w-4 h-4 mr-2" />Chave Salva!</>
               : <><Zap className="w-4 h-4 mr-2 fill-current" />Salvar dados de recebimento</>
              }
            </Button>
          </div>
        </div>
      </SettingBlock>

      <SettingBlock
        title="Integração Mercado Pago"
        description="A GoTaxi processa pagamentos pela conta global. Ative o checkout do Mercado Pago para o cliente."
        icon={Wallet}
      >
        <div className="space-y-6">
          <div className="bg-[#009EE3]/5 border border-[#009EE3]/20 rounded-xl p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <p className="font-semibold text-[#009EE3]">Status da Integração Global</p>
                {mpConfig.beta && (
                  <span className="bg-[#009EE3] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider">BETA</span>
                )}
                {mpConfig.environment === "sandbox" && (
                  <span className="bg-amber-100 text-amber-700 text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider">SANDBOX</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
                As credenciais são globais da GoTaxi. {mpConfig.configured ? "Sua loja está apta a receber via app." : "Aguardando ativação por parte da GoTaxi."}
              </p>
            </div>
            {mpConfig.configured ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold shrink-0">
                <CheckCircle2 className="w-4 h-4" /> Ativa
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold shrink-0">
                <AlertCircle className="w-4 h-4" /> Inativa
              </div>
            )}
          </div>

          <div className="bg-muted/10 border border-border/50 rounded-xl p-5 space-y-5">
            <p className="font-semibold text-sm text-foreground">Preferências de Checkout</p>
            {!mpConfig.configured && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>O Super Admin ainda precisa ativar a integração global do Mercado Pago. Depois disso, esta loja poderá ser ativada aqui.</span>
              </div>
            )}
            
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Pagamento no App (Mercado Pago)</p>
                <p className="text-sm text-muted-foreground">O cliente paga diretamente no app. Processamento via GoTaxi.</p>
              </div>
              <Switch 
                checked={mpConfig.mercadoPagoEnabled} 
                onCheckedChange={v => setMpConfig(p => ({ ...p, mercadoPagoEnabled: v }))} 
                disabled={!mpConfig.configured} 
              />
            </div>
            
            <div className="w-full h-px bg-border/50" />

            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Pagamento Direto (Entrega/Balcão)</p>
                <p className="text-sm text-muted-foreground">O cliente paga na maquininha ou PIX direto para você no recebimento.</p>
              </div>
              <Switch 
                checked={mpConfig.directPaymentEnabled} 
                onCheckedChange={v => setMpConfig(p => ({ ...p, directPaymentEnabled: v }))} 
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            {mpError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive mr-4">
                <AlertCircle className="w-4 h-4 shrink-0" />{mpError}
              </div>
            )}
            <Button
              onClick={handleSaveMp}
              disabled={savingMp}
              className="min-w-[160px] bg-[#009EE3] hover:bg-[#009EE3]/90 text-white shadow-md shadow-[#009EE3]/20"
            >
              {savingMp
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
                : savedMp
                ? <><CheckCircle2 className="w-4 h-4 mr-2" />Salvo!</>
                : <><Save className="w-4 h-4 mr-2" />Salvar Integração</>
              }
            </Button>
          </div>
        </div>
      </SettingBlock>

      <SettingBlock
        title="Segurança"
        description="Altere a senha de acesso da sua conta."
        icon={Lock}
      >
        <form onSubmit={handleAlterarSenha} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Senha Atual</label>
              <Input type="password" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)}
                placeholder="••••••••"
                className="bg-muted/30"
                autoComplete="current-password" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center justify-between">
                Nova Senha <span className="text-xs font-normal text-muted-foreground">Mín. 6 caracteres</span>
              </label>
              <Input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)}
                placeholder="••••••••"
                className="bg-muted/30"
                autoComplete="new-password" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Confirmar Nova Senha</label>
              <Input type="password" value={confirmaSenha} onChange={e => setConfirmaSenha(e.target.value)}
                placeholder="••••••••"
                className="bg-muted/30"
                autoComplete="new-password" />
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row justify-between items-center gap-4">
            {senhaMsg ? (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium w-full sm:w-auto ${senhaMsg.ok ? "text-green-600 bg-green-50" : "text-destructive bg-destructive/10"}`}>
                {senhaMsg.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {senhaMsg.text}
              </div>
            ) : (
              <div /> // empty flex placeholder
            )}
            <Button type="submit" disabled={savingSenha || !senhaAtual || !novaSenha || !confirmaSenha}
              variant="outline"
              className="min-w-[160px] border-border hover:bg-muted/50 w-full sm:w-auto">
              {savingSenha ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Alterando...</> : "Alterar Senha"}
            </Button>
          </div>
        </form>
      </SettingBlock>
    </motion.div>
  );
}
