import React, { useEffect, useState, useCallback } from "react";
import { MapPin, Globe, Package, ChevronRight, Save, CheckCircle2, AlertCircle, Info, Truck } from "lucide-react";
import { useAuth } from "@/lib/auth";

const API = "/api/pdv";

type Zona = "local" | "estadual" | "regional" | "nacional";
type Servico = "pac" | "sedex";
type Faixa = { base: number; kg_adicional: number; prazo_dias: number };
type Tabela = Record<Servico, Record<Zona, Faixa>>;

type Config = {
  venda_local_ativo: boolean;
  raio_km: number;
  venda_nacional_ativo: boolean;
  correios_cep_origem: string | null;
  correios_tabela: Tabela | null;
  correios_peso_padrao_kg: number;
};

const ZONAS: { id: Zona; label: string; hint: string }[] = [
  { id: "local", label: "Mesma região", hint: "CEP próximo ao seu" },
  { id: "estadual", label: "Mesmo estado", hint: "Outras cidades do estado" },
  { id: "regional", label: "Mesma região do país", hint: "Ex.: Sudeste → Sudeste" },
  { id: "nacional", label: "Outras regiões", hint: "Ex.: Sudeste → Nordeste" },
];
const SERVICOS: { id: Servico; label: string }[] = [
  { id: "pac", label: "PAC" },
  { id: "sedex", label: "SEDEX" },
];

const formatCep = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!on)}
      disabled={disabled}
      className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${on ? "bg-primary" : "bg-muted"} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${on ? "left-6" : "left-0.5"}`} />
    </button>
  );
}

function SectionCard({ icon: Icon, color, title, subtitle, children }: {
  icon: React.ElementType; color: string; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-4 p-5 border-b border-border/50">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: color + "20" }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

export default function LojaConfig() {
  const { token } = useAuth();
  const [config, setConfig] = useState<Config>({
    venda_local_ativo: true,
    raio_km: 15,
    venda_nacional_ativo: false,
    correios_cep_origem: null,
    correios_tabela: null,
    correios_peso_padrao_kg: 0.5,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [raioInput, setRaioInput] = useState("15");
  const [cepInput, setCepInput] = useState("");
  const [pesoInput, setPesoInput] = useState("0.5");

  useEffect(() => {
    fetch(`${API}/ecommerce/config`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        setConfig(d);
        setRaioInput(String(d.raio_km ?? 15));
        setCepInput(formatCep(d.correios_cep_origem ?? ""));
        setPesoInput(String(d.correios_peso_padrao_kg ?? 0.5));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token]);

  const save = useCallback(async (patch: Partial<Config>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(`${API}/ecommerce/config`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Erro ao salvar. Tente novamente.");
      setConfig(data);
      setRaioInput(String(data.raio_km));
      setCepInput(formatCep(data.correios_cep_origem ?? ""));
      setPesoInput(String(data.correios_peso_padrao_kg ?? 0.5));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e?.message || "Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }, [config, token]);

  const handleRaioBlur = () => {
    const val = Math.min(Math.max(parseInt(raioInput) || 15, 1), 100);
    setRaioInput(String(val));
    save({ raio_km: val });
  };

  const handleCepBlur = () => {
    const digits = cepInput.replace(/\D/g, "");
    if (digits === (config.correios_cep_origem ?? "")) return;
    if (digits.length !== 0 && digits.length !== 8) {
      setError("CEP de origem deve ter 8 dígitos");
      return;
    }
    save({ correios_cep_origem: digits || null });
  };

  const handlePesoBlur = () => {
    const val = Math.min(Math.max(parseFloat(pesoInput.replace(",", ".")) || 0.5, 0.01), 30);
    setPesoInput(String(val));
    if (val !== config.correios_peso_padrao_kg) save({ correios_peso_padrao_kg: val });
  };

  const setFaixa = (s: Servico, z: Zona, campo: keyof Faixa, valor: string) => {
    if (!config.correios_tabela) return;
    const n = parseFloat(valor.replace(",", "."));
    setConfig(c => c.correios_tabela ? ({
      ...c,
      correios_tabela: {
        ...c.correios_tabela,
        [s]: { ...c.correios_tabela[s], [z]: { ...c.correios_tabela[s][z], [campo]: Number.isFinite(n) ? n : 0 } },
      },
    }) : c);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-muted-foreground gap-3">
      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      Carregando...
    </div>
  );

  const nenhummodoAtivo = !config.venda_local_ativo && !config.venda_nacional_ativo;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Minha Loja Online</h1>
          <p className="text-muted-foreground text-sm mt-1">Configure as modalidades de venda disponíveis para os seus clientes.</p>
        </div>
        <div className="flex items-center gap-2 text-sm shrink-0">
          {saving && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Salvando...
            </span>
          )}
          {saved && (
            <span className="flex items-center gap-1.5 text-green-400 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              Salvo
            </span>
          )}
          {error && (
            <span className="flex items-center gap-1.5 text-destructive text-xs">
              <AlertCircle className="w-4 h-4" />
              {error}
            </span>
          )}
        </div>
      </div>

      {nenhummodoAtivo && (
        <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Nenhuma modalidade de venda ativa. Seus clientes não conseguirão fazer pedidos na loja online.</span>
        </div>
      )}

      {/* Venda Local */}
      <SectionCard
        icon={MapPin}
        color="#F97316"
        title="Venda Local"
        subtitle="Entrega feita pelo seu próprio entregador dentro de um raio configurável"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Ativar venda local</p>
            <p className="text-xs text-muted-foreground mt-0.5">Clientes dentro do raio definido poderão comprar na sua loja</p>
          </div>
          <Toggle on={config.venda_local_ativo} onChange={v => save({ venda_local_ativo: v })} disabled={saving} />
        </div>

        {config.venda_local_ativo && (
          <>
            <div className="h-px bg-border/60" />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Raio de entrega</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={raioInput}
                    onChange={e => setRaioInput(e.target.value)}
                    onBlur={handleRaioBlur}
                    onKeyDown={e => e.key === "Enter" && handleRaioBlur()}
                    className="w-16 text-center bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <span className="text-sm text-muted-foreground">km</span>
                </div>
              </div>

              <input
                type="range"
                min={1}
                max={50}
                value={Math.min(parseInt(raioInput) || 15, 50)}
                onChange={e => setRaioInput(e.target.value)}
                onMouseUp={handleRaioBlur}
                onTouchEnd={handleRaioBlur}
                className="w-full accent-primary"
              />

              <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
                <span>1 km</span>
                <span>10 km</span>
                <span>25 km</span>
                <span>50 km</span>
              </div>

              <div className="flex items-start gap-2 p-3 bg-orange-500/8 border border-orange-500/20 rounded-lg text-xs text-muted-foreground">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-orange-400" />
                <span>
                  Clientes a mais de <strong className="text-foreground">{raioInput} km</strong> do seu endereço não verão sua loja no app. Use o Google Maps para estimar a cobertura.
                </span>
              </div>
            </div>
          </>
        )}
      </SectionCard>

      {/* Venda Nacional */}
      <SectionCard
        icon={Globe}
        color="#8B5CF6"
        title="Venda Nacional"
        subtitle="Envio para todo o Brasil pelos Correios (PAC e SEDEX)"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Ativar venda nacional</p>
            <p className="text-xs text-muted-foreground mt-0.5">Seus produtos poderão ser enviados para qualquer estado do Brasil</p>
          </div>
          <Toggle on={config.venda_nacional_ativo} onChange={v => save({ venda_nacional_ativo: v })} disabled={saving} />
        </div>

        {config.venda_nacional_ativo && (
          <>
            <div className="h-px bg-border/60" />

            {/* Correios */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-purple-400" />
                <p className="text-sm font-semibold text-foreground">Envio pelos Correios (PAC e SEDEX)</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1.5 block">CEP de origem (de onde você envia)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="00000-000"
                    value={cepInput}
                    onChange={e => setCepInput(formatCep(e.target.value))}
                    onBlur={handleCepBlur}
                    onKeyDown={e => e.key === "Enter" && handleCepBlur()}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Peso padrão por produto (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    min={0.01}
                    max={30}
                    value={pesoInput}
                    onChange={e => setPesoInput(e.target.value)}
                    onBlur={handlePesoBlur}
                    onKeyDown={e => e.key === "Enter" && handlePesoBlur()}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Usado quando o produto não tem peso cadastrado.</p>
                </div>
              </div>

              {config.correios_tabela && SERVICOS.map(serv => (
                <div key={serv.id} className="border border-border/60 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-secondary/50 text-sm font-semibold text-foreground">{serv.label}</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted-foreground">
                          <th className="text-left font-medium px-3 py-2">Destino</th>
                          <th className="text-left font-medium px-2 py-2">Até 1 kg (R$)</th>
                          <th className="text-left font-medium px-2 py-2">Kg adicional (R$)</th>
                          <th className="text-left font-medium px-2 py-2">Prazo (dias úteis)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ZONAS.map(z => {
                          const f = config.correios_tabela![serv.id][z.id];
                          const cell = (campo: keyof Faixa, step: string) => (
                            <td className="px-2 py-1.5">
                              <input
                                type="number"
                                step={step}
                                min={0}
                                value={f[campo]}
                                onChange={e => setFaixa(serv.id, z.id, campo, e.target.value)}
                                onBlur={() => save({ correios_tabela: config.correios_tabela })}
                                className="w-24 bg-secondary border border-border rounded-md px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                              />
                            </td>
                          );
                          return (
                            <tr key={z.id} className="border-t border-border/40">
                              <td className="px-3 py-1.5">
                                <p className="text-foreground font-medium">{z.label}</p>
                                <p className="text-[10px] text-muted-foreground">{z.hint}</p>
                              </td>
                              {cell("base", "0.01")}
                              {cell("kg_adicional", "0.01")}
                              {cell("prazo_dias", "1")}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              <div className="flex items-start gap-2 p-3 bg-purple-500/8 border border-purple-500/20 rounded-lg text-xs">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-purple-400" />
                <div className="text-muted-foreground space-y-1">
                  <p>O frete é calculado pelo <strong className="text-foreground">seu CEP</strong> e o <strong className="text-foreground">CEP do cliente</strong>, usando esta tabela. Não é a cotação oficial dos Correios: ajuste os valores para ficarem próximos do que você paga na agência.</p>
                  <p>Valor = "Até 1 kg" + "Kg adicional" × cada kg acima de 1 kg. Limite de 30 kg por pedido.</p>
                </div>
              </div>

              {!config.correios_cep_origem && (
                <div className="flex items-center gap-2 p-3 bg-secondary/50 border border-border/50 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <p className="text-xs text-muted-foreground">Informe o <span className="text-amber-400 font-medium">CEP de origem</span> para o envio pelos Correios aparecer no app.</p>
                </div>
              )}
            </div>
          </>
        )}

        {!config.venda_nacional_ativo && (
          <div className="flex items-start gap-2 p-3 bg-secondary/30 border border-border/40 rounded-lg text-xs text-muted-foreground">
            <Package className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>Ative para vender para o Brasil inteiro pelos Correios. O frete será calculado automaticamente no checkout do cliente pelo CEP.</span>
          </div>
        )}
      </SectionCard>

      {/* Resumo */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Resumo da loja</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> Venda local</span>
            <span className={`font-semibold ${config.venda_local_ativo ? "text-green-400" : "text-muted-foreground"}`}>
              {config.venda_local_ativo ? `Ativa — raio de ${config.raio_km} km` : "Desativada"}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-2"><Globe className="w-3.5 h-3.5" /> Venda nacional (Correios)</span>
            <span className={`font-semibold ${config.venda_nacional_ativo ? "text-purple-400" : "text-muted-foreground"}`}>
              {config.venda_nacional_ativo ? (config.correios_cep_origem ? `Ativa — envio de ${formatCep(config.correios_cep_origem)}` : "Ativa — falta CEP de origem") : "Desativada"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
