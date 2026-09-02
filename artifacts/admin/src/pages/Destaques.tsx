import React, { useEffect, useState } from "react";
import { useAuth, API, authHeaders } from "@/lib/auth";

type EmpresaDestaque = {
  id: number;
  nome: string;
  cor: string;
  ativo: boolean;
  destaque: boolean;
  modulos_ativos: string[] | null;
  categoria: string | null;
};

const MODULO_MAP: Record<string, { label: string; emoji: string }> = {
  food: { label: "Alimentação", emoji: "🍔" },
  motorista: { label: "Motoristas", emoji: "🚗" },
  ecommerce: { label: "E-commerce", emoji: "🛍️" },
  servicos: { label: "Serviços", emoji: "🔧" },
  entrega: { label: "Entregas", emoji: "📦" },
  passagens: { label: "Passagens", emoji: "🎟️" },
  encomendas: { label: "Encomendas", emoji: "📫" },
};

export default function Destaques() {
  const { token } = useAuth();
  const [empresas, setEmpresas] = useState<EmpresaDestaque[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/destaques`, { headers: authHeaders(token) });
      const data = await r.json();
      if (Array.isArray(data)) setEmpresas(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleDestaque = async (empresa: EmpresaDestaque) => {
    setSaving(empresa.id);
    try {
      await fetch(`${API}/empresas/${empresa.id}/destaque`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({ destaque: !empresa.destaque }),
      });
      setEmpresas(prev => prev.map(e => e.id === empresa.id ? { ...e, destaque: !e.destaque } : e));
    } finally {
      setSaving(null);
    }
  };

  const destaques = empresas.filter(e => e.destaque);
  const outros = empresas.filter(e => !e.destaque);

  const EmpresaCard = ({ empresa }: { empresa: EmpresaDestaque }) => {
    const modulos = (empresa.modulos_ativos ?? []).filter(m => !m.startsWith("destaque:"));
    const isLoading = saving === empresa.id;

    return (
      <div className="flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card hover:border-border transition-colors">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-lg font-bold text-white shadow-sm" style={{ backgroundColor: empresa.cor ?? "#22C55E" }}>
          {empresa.nome.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm text-foreground">{empresa.nome}</p>
            {!empresa.ativo && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500">Inativo</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {modulos.length === 0 && <span className="text-xs text-muted-foreground">Sem módulos</span>}
            {modulos.map(m => {
              const info = MODULO_MAP[m];
              if (!info) return null;
              return (
                <span key={m} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                  {info.emoji} {info.label}
                </span>
              );
            })}
          </div>
          {empresa.categoria && (
            <p className="text-xs text-muted-foreground mt-0.5">{empresa.categoria}</p>
          )}
        </div>

        <button
          onClick={() => toggleDestaque(empresa)}
          disabled={isLoading}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${
            empresa.destaque
              ? "bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20"
              : "bg-secondary text-muted-foreground border-border/60 hover:bg-secondary/80 hover:text-foreground"
          } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {isLoading ? (
            <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={empresa.destaque ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          )}
          {empresa.destaque ? "Em destaque" : "Destacar"}
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Carregando...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Destaques no App</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Empresas em destaque aparecem com prioridade na tela inicial do aplicativo cliente.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border/60 rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total de parceiros</p>
          <p className="text-3xl font-bold text-foreground mt-1">{empresas.length}</p>
        </div>
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
          <p className="text-xs text-amber-600 uppercase tracking-wider font-semibold">Em destaque</p>
          <p className="text-3xl font-bold text-amber-600 mt-1">{destaques.length}</p>
        </div>
        <div className="bg-card border border-border/60 rounded-xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Sem destaque</p>
          <p className="text-3xl font-bold text-foreground mt-1">{outros.length}</p>
        </div>
      </div>

      {destaques.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-4 h-4 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Em Destaque ({destaques.length})</h2>
          </div>
          <div className="space-y-2">
            {destaques.map(e => <EmpresaCard key={e.id} empresa={e} />)}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Outros Parceiros ({outros.length})</h2>
        </div>
        {outros.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Todos os parceiros estão em destaque.
          </div>
        ) : (
          <div className="space-y-2">
            {outros.map(e => <EmpresaCard key={e.id} empresa={e} />)}
          </div>
        )}
      </div>
    </div>
  );
}
