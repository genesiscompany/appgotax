import React, { useEffect, useState, useCallback } from "react";
import { MapPin, Globe, Package, ChevronRight, Save, CheckCircle2, AlertCircle, Info, Truck } from "lucide-react";
import { useAuth } from "@/lib/auth";

const API = "/api/pdv";

type Config = {
  venda_local_ativo: boolean;
  raio_km: number;
  venda_nacional_ativo: boolean;
  jadlog_contrato: string | null;
  jadlog_senha: string | null;
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
    jadlog_contrato: null,
    jadlog_senha: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [raioInput, setRaioInput] = useState("15");

  useEffect(() => {
    fetch(`${API}/ecommerce/config`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        setConfig(d);
        setRaioInput(String(d.raio_km ?? 15));
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
      if (!res.ok) throw new Error("Falha ao salvar");
      const data = await res.json();
      setConfig(data);
      setRaioInput(String(data.raio_km));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }, [config, token]);

  const handleRaioBlur = () => {
    const val = Math.min(Math.max(parseInt(raioInput) || 15, 1), 100);
    setRaioInput(String(val));
    save({ raio_km: val });
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
        subtitle="Envio para todo o Brasil via transportadora parceira"
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

            {/* JadLog */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-purple-400" />
                <p className="text-sm font-semibold text-foreground">Transportadora: JadLog</p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Número do contrato JadLog</label>
                  <input
                    type="text"
                    placeholder="Ex: 00123456"
                    value={config.jadlog_contrato ?? ""}
                    onChange={e => setConfig(c => ({ ...c, jadlog_contrato: e.target.value || null }))}
                    onBlur={() => save({ jadlog_contrato: config.jadlog_contrato })}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Senha do contrato</label>
                  <input
                    type="password"
                    placeholder="Senha do portal JadLog"
                    value={config.jadlog_senha ?? ""}
                    onChange={e => setConfig(c => ({ ...c, jadlog_senha: e.target.value || null }))}
                    onBlur={() => save({ jadlog_senha: config.jadlog_senha })}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 bg-purple-500/8 border border-purple-500/20 rounded-lg text-xs">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-purple-400" />
                <div className="text-muted-foreground space-y-1">
                  <p>A integração com a <strong className="text-purple-400">JadLog</strong> permite:</p>
                  <ul className="list-disc list-inside space-y-0.5 ml-1">
                    <li>Cotação automática de frete no checkout</li>
                    <li>Geração de etiqueta de envio</li>
                    <li>Rastreamento em tempo real para o cliente</li>
                  </ul>
                  <p className="text-purple-400 font-medium mt-2">Integração completa em breve — salve suas credenciais agora.</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-secondary/50 border border-border/50 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <p className="text-xs text-muted-foreground">Status: <span className="text-amber-400 font-medium">Integração pendente de ativação</span></p>
              </div>
            </div>
          </>
        )}

        {!config.venda_nacional_ativo && (
          <div className="flex items-start gap-2 p-3 bg-secondary/30 border border-border/40 rounded-lg text-xs text-muted-foreground">
            <Package className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>Ative para vender para o Brasil inteiro via JadLog. O frete será calculado automaticamente no checkout do cliente.</span>
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
            <span className="text-muted-foreground flex items-center gap-2"><Globe className="w-3.5 h-3.5" /> Venda nacional (JadLog)</span>
            <span className={`font-semibold ${config.venda_nacional_ativo ? "text-purple-400" : "text-muted-foreground"}`}>
              {config.venda_nacional_ativo ? "Ativa — pendente integração" : "Desativada"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
