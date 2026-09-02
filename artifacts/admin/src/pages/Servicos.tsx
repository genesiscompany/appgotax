import React, { useEffect, useState } from "react";
import { useAuth, API, authHeaders } from "@/lib/auth";

const MOD_COLOR = "#06B6D4";

type Empresa = {
  id: number; nome: string; plano: string; ativo: boolean;
  cor_primaria: string; criado_em: string; modulos_ativos: string[] | null;
  total_usuarios: string;
};

const PLANO_CONF: Record<string, { label: string; color: string }> = {
  free:       { label: "Free",       color: "#94A3B8" },
  basico:     { label: "Básico",     color: "#64B5F6" },
  pro:        { label: "Pro",        color: "#3B82F6" },
  enterprise: { label: "Enterprise", color: "#8B5CF6" },
};

const CATEGORIAS = [
  { emoji: "✂️", nome: "Beleza & Estética" },
  { emoji: "🏠", nome: "Casa & Reforma" },
  { emoji: "❤️", nome: "Saúde & Bem-estar" },
  { emoji: "🔧", nome: "Manutenção" },
  { emoji: "🐾", nome: "Pet" },
  { emoji: "💻", nome: "Tecnologia" },
];

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function Servicos() {
  const { token } = useAuth();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    fetch(`${API}/empresas`, { headers: authHeaders(token) })
      .then(r => r.json())
      .then(d => {
        const todas: Empresa[] = Array.isArray(d) ? d : [];
        const filtradas = todas.filter(e => {
          const mods = Array.isArray(e.modulos_ativos) ? e.modulos_ativos : [];
          return mods.includes("servicos");
        });
        setEmpresas(filtradas);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token]);

  const exibidas = empresas.filter(e =>
    e.nome.toLowerCase().includes(busca.toLowerCase())
  );

  const ativas = empresas.filter(e => e.ativo).length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
              style={{ background: MOD_COLOR + "20" }}>🔧</div>
            <h1 className="text-2xl font-bold text-foreground">Serviços</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Empresas do módulo Serviços — profissionais autônomos e prestadores
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Empresas", value: empresas.length, icon: "🏢" },
          { label: "Ativas", value: ativas, icon: "✅" },
          { label: "Inativas", value: empresas.length - ativas, icon: "⏸️" },
          { label: "Categorias", value: CATEGORIAS.length, icon: "📋" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <span className="text-base">{s.icon}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Categorias */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Categorias do módulo
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {CATEGORIAS.map(cat => (
            <div key={cat.nome}
              className="bg-card border border-border rounded-xl p-3 flex flex-col items-center gap-1.5 text-center">
              <span className="text-xl">{cat.emoji}</span>
              <p className="text-[11px] text-muted-foreground leading-tight">{cat.nome}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Empresas com Serviços */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Empresas ativas
          </h2>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar empresa..."
              className="pl-8 pr-3 py-1.5 bg-input border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 w-48"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground gap-3">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Carregando...
          </div>
        ) : exibidas.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-10 text-center">
            <p className="text-3xl mb-3">🔧</p>
            <p className="text-muted-foreground text-sm">
              {empresas.length === 0
                ? "Nenhuma empresa com o módulo Serviços ativado."
                : "Nenhuma empresa encontrada."}
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Empresa</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Plano</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Usuários</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Cadastro</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {exibidas.map(e => {
                  const plano = PLANO_CONF[e.plano] ?? { label: e.plano, color: "#94A3B8" };
                  return (
                    <tr key={e.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                            style={{ background: e.cor_primaria || MOD_COLOR }}>
                            {e.nome.charAt(0)}
                          </div>
                          <p className="font-semibold text-sm text-foreground">{e.nome}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4 hidden sm:table-cell">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: plano.color + "20", color: plano.color }}>
                          {plano.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 hidden sm:table-cell">
                        <span className="text-sm text-muted-foreground">{Number(e.total_usuarios)} usuários</span>
                      </td>
                      <td className="px-5 py-4 hidden sm:table-cell">
                        <span className="text-sm text-muted-foreground">{fmtData(e.criado_em)}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                          e.ativo
                            ? "bg-green-500/15 text-green-400"
                            : "bg-zinc-500/15 text-zinc-400"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${e.ativo ? "bg-green-400" : "bg-zinc-400"}`} />
                          {e.ativo ? "Ativa" : "Inativa"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
