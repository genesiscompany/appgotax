import { useState, useEffect } from "react";
import { useAuth, API, authHeaders } from "@/lib/auth";
import { useLocation } from "wouter";
import { FileText, Shield, Users, Save, ExternalLink, CheckCircle, ChevronDown, ChevronUp, Car, Wallet, AlertCircle, Loader2 } from "lucide-react";

type Tab = "politica" | "termos" | "afiliados" | "caronas" | "mercadopago";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "politica", label: "Política de Privacidade", icon: Shield },
  { id: "termos", label: "Termos de Uso", icon: FileText },
  { id: "afiliados", label: "Regras de Afiliados", icon: Users },
  { id: "caronas", label: "Viagens Compartilhadas", icon: Car },
  { id: "mercadopago", label: "Mercado Pago (Beta)", icon: Wallet },
];

const PROD_BASE = "https://admin.gotaxi.com.br";

export default function ConfiguracoesSistema() {
  const { token } = useAuth();
  const [location] = useLocation();
  const hdrs = { ...authHeaders(token), "Content-Type": "application/json" };

  const getRequestedTab = (value: string) => {
    const query = value.includes("?") ? value.slice(value.indexOf("?") + 1) : window.location.search.slice(1);
    return new URLSearchParams(query).get("tab") === "mercadopago" ? "mercadopago" : "politica";
  };
  const [tab, setTab] = useState<Tab>(() => getRequestedTab(window.location.pathname + window.location.search));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [sistema, setSistema] = useState<Record<string, string>>({
    politica_privacidade: "",
    termos_de_uso: "",
    afiliados_descricao: "",
    afiliados_como_funciona: "",
    afiliados_prazo_pagamento_dias: "3",
    afiliados_requisitos: "",
    caronas_valor_por_km: "0.80",
    caronas_taxa_plataforma: "5",
  });
  const [afiliados, setAfiliados] = useState({ percentual_comissao: 10, valor_minimo_saque: 50 });
  const [showPreview, setShowPreview] = useState(false);

  // Mercado Pago Fees State
  const [mpFees, setMpFees] = useState({ pix: 0, card: 0, wallet: 0 });
  const [mpCredentials, setMpCredentials] = useState({
    publicKey: "",
    accessToken: "",
    enabled: false,
    configured: false,
  });
  const [mpBetaInfo, setMpBetaInfo] = useState({ beta: false, environment: "sandbox" });
  const [savingMp, setSavingMp] = useState(false);
  const [savedMp, setSavedMp] = useState(false);
  const [mpError, setMpError] = useState("");

  useEffect(() => {
    const requestedTab = getRequestedTab(location);
    if (requestedTab === "mercadopago") setTab(requestedTab);
  }, [location]);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/configuracoes/admin`, { headers: hdrs }).then(r => r.json()),
      fetch(`/api/payments/admin/fees`, { headers: hdrs }).then(r => r.ok ? r.json() : null),
      fetch(`/api/payments/admin/config`, { headers: hdrs }).then(r => r.ok ? r.json() : null),
    ])
      .then(([d, mp, config]) => {
        if (d && d.sistema) setSistema(prev => ({ ...prev, ...d.sistema }));
        if (d && d.afiliados) setAfiliados(d.afiliados);
        if (mp && mp.feesBasisPoints) {
          setMpFees({
            pix: mp.feesBasisPoints.pix / 100,
            card: mp.feesBasisPoints.card / 100,
            wallet: mp.feesBasisPoints.wallet / 100
          });
          setMpBetaInfo({ beta: !!mp.beta, environment: mp.environment || "sandbox" });
        }
        if (config) {
          setMpCredentials({
            publicKey: config.publicKey || "",
            accessToken: "",
            enabled: !!config.enabled,
            configured: !!config.configured,
          });
          setMpBetaInfo({ beta: !!config.beta, environment: config.environment || "sandbox" });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`${API}/configuracoes/admin`, {
        method: "PATCH",
        headers: hdrs,
        body: JSON.stringify({ sistema, afiliados }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveMp() {
    setSavingMp(true);
    setMpError("");
    setSavedMp(false);
    try {
      // Validate 0-100%
      if (mpFees.pix < 0 || mpFees.pix > 100 || mpFees.card < 0 || mpFees.card > 100 || mpFees.wallet < 0 || mpFees.wallet > 100) {
        throw new Error("As taxas devem ser entre 0% e 100%.");
      }
      const configBody: Record<string, string | boolean> = {
        publicKey: mpCredentials.publicKey.trim(),
        enabled: mpCredentials.enabled,
      };
      if (mpCredentials.accessToken.trim()) configBody.accessToken = mpCredentials.accessToken.trim();
      const [feesResponse, configResponse] = await Promise.all([
        fetch(`/api/payments/admin/fees`, {
          method: "PUT",
          headers: hdrs,
          body: JSON.stringify({
            pix: Math.round(mpFees.pix * 100),
            card: Math.round(mpFees.card * 100),
            wallet: Math.round(mpFees.wallet * 100)
          }),
        }),
        fetch(`/api/payments/admin/config`, {
          method: "PUT",
          headers: hdrs,
          body: JSON.stringify(configBody),
        }),
      ]);
      if (!feesResponse.ok || !configResponse.ok) {
        const failed = !configResponse.ok ? configResponse : feesResponse;
        const err = await failed.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Erro ao salvar taxas.");
      }
      const updatedConfig = await configResponse.json();
      setMpCredentials(prev => ({
        ...prev,
        publicKey: updatedConfig.publicKey || "",
        accessToken: "",
        enabled: !!updatedConfig.enabled,
        configured: !!updatedConfig.configured,
      }));
      setSavedMp(true);
      setTimeout(() => setSavedMp(false), 3000);
    } catch (err: any) {
      setMpError(err.message || "Erro de conexão.");
    } finally {
      setSavingMp(false);
    }
  }

  const currentKey = tab === "politica" ? "politica_privacidade" : tab === "termos" ? "termos_de_uso" : null;
  const publicUrl = tab === "politica"
    ? `${PROD_BASE}/api/politica-de-privacidade`
    : tab === "termos"
    ? `${PROD_BASE}/api/termos-de-uso`
    : null;

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3" />
      Carregando configurações...
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Regras do App</h1>
          <p className="text-sm text-muted-foreground mt-1">Edite as páginas legais e regras do programa de afiliados</p>
        </div>
        <button
          onClick={tab === "mercadopago" ? handleSaveMp : handleSave}
          disabled={tab === "mercadopago" ? savingMp : saving}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            (tab === "mercadopago" ? savedMp : saved) ? "bg-green-500 text-white" : "bg-primary text-primary-foreground hover:opacity-90"
          } disabled:opacity-50`}
        >
          {(tab === "mercadopago" ? savedMp : saved) ? <CheckCircle size={16} /> : <Save size={16} />}
          {(tab === "mercadopago" ? savingMp : saving) ? "Salvando..." : (tab === "mercadopago" ? savedMp : saved) ? "Salvo!" : "Salvar Alterações"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setTab(id); setShowPreview(false); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id ? "bg-white shadow text-primary" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Legal tabs (política + termos) */}
      {currentKey && (
        <div className="space-y-4">
          {publicUrl && (
            <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-medium text-blue-800">URL pública desta página</p>
                <p className="text-xs text-blue-600 mt-0.5 font-mono">{publicUrl}</p>
              </div>
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition"
              >
                <ExternalLink size={12} />
                Abrir
              </a>
            </div>
          )}

          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <p className="font-semibold text-gray-900">
                  {tab === "politica" ? "Conteúdo da Política de Privacidade" : "Conteúdo dos Termos de Uso"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Cole HTML completo ou texto simples. Deixe em branco para usar o conteúdo padrão.</p>
              </div>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                {showPreview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {showPreview ? "Ocultar preview" : "Ver preview"}
              </button>
            </div>

            {showPreview && sistema[currentKey] ? (
              <div className="border-b border-gray-100">
                <iframe
                  srcDoc={sistema[currentKey]}
                  className="w-full h-[400px] border-0"
                  title="Preview"
                  sandbox="allow-same-origin"
                />
              </div>
            ) : null}

            <div className="p-4">
              <textarea
                value={sistema[currentKey]}
                onChange={e => setSistema(prev => ({ ...prev, [currentKey]: e.target.value }))}
                placeholder={`Cole aqui o HTML completo da página de ${tab === "politica" ? "Política de Privacidade" : "Termos de Uso"}...`}
                className="w-full h-96 font-mono text-xs px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-y"
              />
              <p className="text-xs text-muted-foreground mt-2">
                {sistema[currentKey]?.length || 0} caracteres
                {(!sistema[currentKey] || sistema[currentKey].trim().length < 100) && (
                  <span className="ml-2 text-amber-600">⚠ Conteúdo padrão será exibido enquanto estiver em branco</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Afiliados tab */}
      {tab === "afiliados" && (
        <div className="space-y-5">
          {/* Comissão e saque */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-5">Regras Financeiras</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Percentual de Comissão do Afiliado (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={afiliados.percentual_comissao}
                  onChange={e => setAfiliados(a => ({ ...a, percentual_comissao: Number(e.target.value) }))}
                  className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  % do lucro GoTaxi (3% de cada transação). Ex.: corrida R$100 → GoTaxi = R$3 → afiliado ({afiliados.percentual_comissao}%) = R${((3 * afiliados.percentual_comissao) / 100).toFixed(2)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Valor Mínimo para Saque (R$)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={afiliados.valor_minimo_saque}
                  onChange={e => setAfiliados(a => ({ ...a, valor_minimo_saque: Number(e.target.value) }))}
                  className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Prazo de Pagamento (dias úteis)
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={sistema.afiliados_prazo_pagamento_dias}
                  onChange={e => setSistema(s => ({ ...s, afiliados_prazo_pagamento_dias: e.target.value }))}
                  className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">Prazo para processar saques após solicitação</p>
              </div>
            </div>
          </div>

          {/* Textos do programa */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-5">Textos do Programa</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Descrição do Programa</label>
                <textarea
                  value={sistema.afiliados_descricao}
                  onChange={e => setSistema(s => ({ ...s, afiliados_descricao: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  placeholder="Descrição geral do programa de afiliados..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Como Funciona</label>
                <textarea
                  value={sistema.afiliados_como_funciona}
                  onChange={e => setSistema(s => ({ ...s, afiliados_como_funciona: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  placeholder="Explique o passo a passo para o afiliado ganhar comissões..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Requisitos de Elegibilidade</label>
                <textarea
                  value={sistema.afiliados_requisitos}
                  onChange={e => setSistema(s => ({ ...s, afiliados_requisitos: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  placeholder="Quais são os requisitos para participar do programa..."
                />
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            <strong>Atenção:</strong> Alterações no percentual de comissão afetam apenas novas comissões geradas após o salvamento.
          </div>
        </div>
      )}

      {/* Caronas / Viagens compartilhadas */}
      {tab === "caronas" && (
        <div className="space-y-5">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-1">Tarifa Sugerida por Quilômetro</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Define o valor sugerido (R$/km) que o app calcula automaticamente para o motorista quando ele cadastra uma viagem compartilhada (estilo BlaBlaCar). O motorista ainda pode ajustar o valor final.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Valor por km (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={sistema.caronas_valor_por_km}
                    onChange={e => setSistema(s => ({ ...s, caronas_valor_por_km: e.target.value }))}
                    className="w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="0.80"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Ex.: 0,80 → viagem de 100 km sugere R$ {(Number(sistema.caronas_valor_por_km || 0) * 100).toFixed(2)} por passageiro.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Taxa da Plataforma (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={sistema.caronas_taxa_plataforma}
                  onChange={e => setSistema(s => ({ ...s, caronas_taxa_plataforma: e.target.value }))}
                  className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="5"
                />
                <p className="text-xs text-muted-foreground mt-1">% que a plataforma fica em cada reserva (informativo, ainda não cobrado automaticamente).</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
            <strong>Como funciona:</strong> Ao criar uma viagem compartilhada no app do parceiro, o motorista informa origem e destino. O app calcula a distância automaticamente (Google Maps) e sugere o valor por vaga (km × tarifa). O motorista pode aceitar ou ajustar.
          </div>
        </div>
      )}

      {/* Mercado Pago */}
      {tab === "mercadopago" && (
        <div className="space-y-5">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-[#009EE3]" />
                  Credenciais globais da GoTaxi
                  {mpCredentials.configured && (
                    <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                      CONFIGURADO
                    </span>
                  )}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Esta é a única conta Mercado Pago usada pela plataforma. Nenhum parceiro terá acesso ou cadastrará credenciais.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium mb-1.5">Public Key</label>
                <input
                  value={mpCredentials.publicKey}
                  onChange={e => setMpCredentials(prev => ({ ...prev, publicKey: e.target.value }))}
                  placeholder="APP_USR-..."
                  autoComplete="off"
                  className="w-full px-4 py-2.5 border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Access Token
                  {mpCredentials.configured && <span className="text-xs text-green-600 font-normal ml-1">(salvo e oculto)</span>}
                </label>
                <input
                  type="password"
                  value={mpCredentials.accessToken}
                  onChange={e => setMpCredentials(prev => ({ ...prev, accessToken: e.target.value }))}
                  placeholder={mpCredentials.configured ? "Deixe em branco para manter o token atual" : "APP_USR-..."}
                  autoComplete="new-password"
                  className="w-full px-4 py-2.5 border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <label className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 cursor-pointer">
              <span>
                <span className="block text-sm font-medium text-gray-900">Ativar Mercado Pago na plataforma</span>
                <span className="block text-xs text-muted-foreground">Os pagamentos dos clientes serão processados pela conta global da GoTaxi.</span>
              </span>
              <input
                type="checkbox"
                checked={mpCredentials.enabled}
                onChange={e => setMpCredentials(prev => ({ ...prev, enabled: e.target.checked }))}
                className="h-4 w-4 accent-primary"
              />
            </label>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-[#009EE3]" />
                   Taxas e repasses da plataforma
                  {mpBetaInfo.beta && (
                    <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                      BETA
                    </span>
                  )}
                  {mpBetaInfo.environment === "sandbox" && (
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                      SANDBOX
                    </span>
                  )}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                   Defina a porcentagem que será registrada como taxa da GoTaxi antes do repasse ao parceiro.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-medium mb-1.5">Taxa Pix (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={mpFees.pix === 0 ? "" : mpFees.pix}
                    onChange={e => setMpFees(f => ({ ...f, pix: Number(e.target.value) }))}
                    className="w-full pr-8 pl-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="0.00"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Taxa Cartão de Crédito (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={mpFees.card === 0 ? "" : mpFees.card}
                    onChange={e => setMpFees(f => ({ ...f, card: Number(e.target.value) }))}
                    className="w-full pr-8 pl-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="0.00"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Taxa Carteira MP (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={mpFees.wallet === 0 ? "" : mpFees.wallet}
                    onChange={e => setMpFees(f => ({ ...f, wallet: Number(e.target.value) }))}
                    className="w-full pr-8 pl-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="0.00"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                </div>
              </div>
            </div>

            {mpError && (
              <div className="mt-5 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                <AlertCircle size={16} />
                {mpError}
              </div>
            )}
          </div>
          
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700">
            <strong>Nota:</strong> Os pagamentos entram na conta global da GoTaxi. A taxa é registrada pela plataforma e o valor líquido é repassado usando os dados bancários ou Pix cadastrados pelo parceiro.
          </div>
        </div>
      )}
    </div>
  );
}
