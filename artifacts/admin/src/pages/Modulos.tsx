import React, { useEffect, useState, useCallback } from "react";
import { useAuth, API, authHeaders } from "@/lib/auth";

type Empresa = {
  id: number;
  nome: string;
  plano: string;
  ativo: boolean;
  cor_primaria: string;
  modulos_ativos?: string[] | null;
};

const MODULOS = [
  { id: "food",       nome: "Alimentação",    cor: "#F97316", icon: "🍔", desc: "PDV, pedidos, delivery, cardápio" },
  { id: "ecommerce",  nome: "E-commerce",     cor: "#8B5CF6", icon: "🛍️", desc: "Loja online, catálogo, envios" },
  { id: "motorista",  nome: "App Motoristas", cor: "#3B82F6", icon: "🚗", desc: "App para motoristas de táxi/moto" },
  { id: "entrega",    nome: "Entregas",       cor: "#F59E0B", icon: "📦", desc: "Rastreio e gestão de entregas" },
  { id: "servicos",   nome: "Serviços",       cor: "#06B6D4", icon: "🔧", desc: "Agendamento e serviços avulsos" },
  { id: "passagens",  nome: "Passagens",      cor: "#22C55E", icon: "🎟️", desc: "Venda de passagens e bilhetes" },
];

function ModuloToggle({
  modulo,
  ativo,
  saving,
  onToggle,
}: {
  modulo: typeof MODULOS[0];
  ativo: boolean;
  saving: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={saving ? undefined : onToggle}
      className={`flex flex-col gap-2 p-3 rounded-xl border text-center transition-all cursor-pointer select-none ${
        ativo
          ? "border-border bg-secondary/40 opacity-100"
          : "border-border/30 opacity-40 hover:opacity-60"
      } ${saving ? "cursor-wait" : "hover:border-border"}`}
    >
      <span className="text-2xl">{modulo.icon}</span>
      <span className="text-[11px] font-semibold text-foreground leading-tight">{modulo.nome}</span>
      <span
        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full mx-auto ${
          ativo ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground"
        }`}
      >
        {saving ? "..." : ativo ? "ON" : "OFF"}
      </span>
    </div>
  );
}

export default function Modulos() {
  const { token } = useAuth();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch(`${API}/empresas`, { headers: authHeaders(token) })
      .then(r => r.json())
      .then(d => { setEmpresas(Array.isArray(d) ? d : []); setLoading(false); });
  }, [token]);

  const getModulos = (empresa: Empresa): string[] => {
    if (!empresa.modulos_ativos || empresa.modulos_ativos.length === 0) return MODULOS.map(m => m.id);
    return empresa.modulos_ativos;
  };

  const toggleModulo = useCallback(async (empresa: Empresa, moduloId: string) => {
    const key = `${empresa.id}-${moduloId}`;
    setSavingMap(prev => ({ ...prev, [key]: true }));

    const current = getModulos(empresa);
    const updated = current.includes(moduloId)
      ? current.filter(m => m !== moduloId)
      : [...current, moduloId];

    try {
      const res = await fetch(`${API}/empresas/${empresa.id}/modulos`, {
        method: "PUT",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ modulos: updated }),
      });
      if (res.ok) {
        setEmpresas(prev =>
          prev.map(e => e.id === empresa.id ? { ...e, modulos_ativos: updated } : e)
        );
      }
    } catch { /* ignore */ }

    setSavingMap(prev => ({ ...prev, [key]: false }));
  }, [token]);

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-muted-foreground gap-3">
      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      Carregando...
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Módulos</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Habilite ou desabilite módulos por empresa. O PDV exibe apenas os módulos ativos.
        </p>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Módulos disponíveis na plataforma
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {MODULOS.map(m => (
            <div key={m.id} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ background: m.cor + "22" }}>
                {m.icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{m.nome}</p>
                <p className="text-xs text-muted-foreground leading-tight mt-0.5">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Módulos por empresa — clique para ativar / desativar
        </h2>
        <div className="space-y-4">
          {empresas.map(empresa => {
            const ativos = getModulos(empresa);
            return (
              <div key={empresa.id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                    style={{ background: empresa.cor_primaria || "#3B82F6" }}
                  >
                    {empresa.nome.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{empresa.nome}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {empresa.plano} · {empresa.ativo ? "Ativa" : "Inativa"}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {ativos.length}/{MODULOS.length} módulos
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {MODULOS.map(m => (
                    <ModuloToggle
                      key={m.id}
                      modulo={m}
                      ativo={ativos.includes(m.id)}
                      saving={!!savingMap[`${empresa.id}-${m.id}`]}
                      onToggle={() => toggleModulo(empresa, m.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
