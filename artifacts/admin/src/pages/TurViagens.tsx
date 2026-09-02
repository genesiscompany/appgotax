import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";

const API = "/api";

interface Agencia {
  id: number;
  nome: string;
  tipo: string;
  cnpj?: string;
  telefone?: string;
  email?: string;
  cidade?: string;
  estado?: string;
  site?: string;
  responsavel?: string;
  status: string;
  plano: string;
  total_passagens: number;
  total_rotas: number;
  receita_total: number | string;
  taxa_comissao: number;
  avaliacao_media: number;
  criado_em: string;
}

const STATUS_CONF: Record<string, { label: string; color: string }> = {
  pendente:   { label: "Pendente",    color: "#F59E0B" },
  em_analise: { label: "Em Análise",  color: "#8B5CF6" },
  ativo:      { label: "Ativo",       color: "#10B981" },
  suspenso:   { label: "Suspenso",    color: "#F97316" },
  bloqueado:  { label: "Bloqueado",   color: "#EF4444" },
};

const PLANO_CONF: Record<string, { label: string; color: string }> = {
  free:       { label: "Free",       color: "#94A3B8" },
  pro:        { label: "Pro",        color: "#3B82F6" },
  enterprise: { label: "Enterprise", color: "#8B5CF6" },
};

const TIPO_LABEL: Record<string, string> = {
  agencia:      "Agência de Viagens",
  operadora:    "Operadora Turística",
  companhia:    "Companhia Aérea",
  rodoviaria:   "Empresa Rodoviária",
  maritima:     "Linha Marítima",
  fretamento:   "Fretamento",
  outro:        "Outro",
};

const DEMO_AGENCIAS: Agencia[] = [
  {
    id: 1, nome: "ViajeMais Turismo", tipo: "agencia",
    cnpj: "11.222.333/0001-44", telefone: "(11) 3344-9900", email: "contato@viajemais.com.br",
    cidade: "São Paulo", estado: "SP", site: "www.viajemais.com.br",
    responsavel: "Roberto Alves", status: "ativo", plano: "enterprise",
    total_rotas: 12, total_passagens: 4832, receita_total: 2340000, taxa_comissao: 8,
    avaliacao_media: 4.7, criado_em: "2023-11-01T09:00:00Z",
  },
  {
    id: 2, nome: "BrasilRota Rodoviária", tipo: "rodoviaria",
    cnpj: "22.333.444/0001-55", telefone: "(21) 3456-0099", email: "reservas@brasilrota.com.br",
    cidade: "Rio de Janeiro", estado: "RJ",
    responsavel: "Carla Nunes", status: "ativo", plano: "pro",
    total_rotas: 8, total_passagens: 12540, receita_total: 890000, taxa_comissao: 6,
    avaliacao_media: 4.3, criado_em: "2024-01-15T10:00:00Z",
  },
  {
    id: 3, nome: "SkyFly Linhas Aéreas", tipo: "companhia",
    cnpj: "33.444.555/0001-66", telefone: "(61) 3567-1122", email: "sac@skyfly.com.br",
    cidade: "Brasília", estado: "DF", site: "www.skyfly.com.br",
    responsavel: "Marcos Lima", status: "ativo", plano: "enterprise",
    total_rotas: 24, total_passagens: 28900, receita_total: 18400000, taxa_comissao: 5,
    avaliacao_media: 4.1, criado_em: "2023-06-10T08:00:00Z",
  },
  {
    id: 4, nome: "Norte Turismo & Expedições", tipo: "operadora",
    cnpj: "44.555.666/0001-77", telefone: "(92) 9876-5432", email: "info@norteturismo.com.br",
    cidade: "Manaus", estado: "AM",
    responsavel: "Ana Souza", status: "em_analise", plano: "pro",
    total_rotas: 0, total_passagens: 0, receita_total: 0, taxa_comissao: 10,
    avaliacao_media: 0, criado_em: "2025-02-20T14:00:00Z",
  },
  {
    id: 5, nome: "Litoral Fretamentos", tipo: "fretamento",
    cnpj: "55.666.777/0001-88", telefone: "(71) 9654-3210", email: "contato@litoralfrete.com.br",
    cidade: "Salvador", estado: "BA",
    responsavel: "Paulo Ribeiro", status: "pendente", plano: "free",
    total_rotas: 0, total_passagens: 0, receita_total: 0, taxa_comissao: 12,
    avaliacao_media: 0, criado_em: "2025-03-05T11:30:00Z",
  },
  {
    id: 6, nome: "Mar Azul Cruzeiros", tipo: "maritima",
    cnpj: "66.777.888/0001-99", telefone: "(13) 3456-7788", email: "reservas@marazul.com.br",
    cidade: "Santos", estado: "SP", site: "www.marazul.com.br",
    responsavel: "Fernanda Costa", status: "suspenso", plano: "pro",
    total_rotas: 5, total_passagens: 1230, receita_total: 4500000, taxa_comissao: 7,
    avaliacao_media: 4.5, criado_em: "2024-03-18T09:00:00Z",
  },
];

const fmt = (v: number | string) =>
  `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function TurViagens() {
  const { token } = useAuth();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const [agencias, setAgencias] = useState<Agencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterTipo, setFilterTipo] = useState("todos");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Agencia | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/tur-viagens/admin/list`, { headers });
      if (res.ok) {
        const d = await res.json();
        setAgencias(Array.isArray(d) ? d : []);
      } else {
        setAgencias([]);
      }
    } catch (_) {
      setAgencias([]);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: number, status: string) => {
    setUpdatingId(id);
    try {
      await fetch(`${API}/tur-viagens/admin/${id}/status`, { method: "PATCH", headers, body: JSON.stringify({ status }) });
      setAgencias(prev => prev.map(a => a.id === id ? { ...a, status } : a));
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null);
    } catch (_) {}
    setUpdatingId(null);
  };

  const filtered = agencias.filter(a => {
    const matchStatus = filterStatus === "todos" || a.status === filterStatus;
    const matchTipo = filterTipo === "todos" || a.tipo === filterTipo;
    const q = search.toLowerCase();
    const matchSearch = !q || a.nome.toLowerCase().includes(q) || (a.email?.toLowerCase().includes(q) ?? false) || (a.cidade?.toLowerCase().includes(q) ?? false);
    return matchStatus && matchTipo && matchSearch;
  });

  const counts = {
    total: agencias.length,
    pendente: agencias.filter(a => a.status === "pendente").length,
    em_analise: agencias.filter(a => a.status === "em_analise").length,
    ativo: agencias.filter(a => a.status === "ativo").length,
    receita: agencias.reduce((acc, a) => acc + Number(a.receita_total), 0),
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3" />
      Carregando empresas...
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Total",      value: counts.total,      color: "#6366F1" },
          { label: "Pendentes",  value: counts.pendente,   color: "#F59E0B" },
          { label: "Em Análise", value: counts.em_analise, color: "#8B5CF6" },
          { label: "Ativas",     value: counts.ativo,      color: "#10B981" },
          { label: "Receita Total", value: fmt(counts.receita), color: "#6366F1", small: true },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className={`font-bold ${(stat as any).small ? "text-lg" : "text-2xl"}`} style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, email ou cidade..."
          className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/30" />
        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/30">
          <option value="todos">Todos os tipos</option>
          {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="flex gap-2 flex-wrap">
          {["todos", "pendente", "em_analise", "ativo", "suspenso", "bloqueado"].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === s ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}>
              {s === "todos" ? "Todos" : STATUS_CONF[s]?.label ?? s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {["Empresa", "Tipo", "Plano", "Rotas", "Passagens", "Receita", "Comissão", "Status", "Ações"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">Nenhuma empresa encontrada</td></tr>
              ) : filtered.map(a => {
                const sc = STATUS_CONF[a.status] ?? { label: a.status, color: "#94A3B8" };
                const pc = PLANO_CONF[a.plano] ?? { label: a.plano, color: "#94A3B8" };
                return (
                  <tr key={a.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelected(selected?.id === a.id ? null : a)}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{a.nome}</div>
                      {a.cnpj && <div className="text-xs text-muted-foreground font-mono">{a.cnpj}</div>}
                      {a.email && <div className="text-xs text-muted-foreground">{a.email}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs">{TIPO_LABEL[a.tipo] ?? a.tipo}</td>
                    <td className="px-4 py-3"><span className="text-xs font-semibold" style={{ color: pc.color }}>{pc.label}</span></td>
                    <td className="px-4 py-3">
                      {(a.total_rotas ?? 0) === 0
                        ? <span className="text-xs text-orange-400 font-medium">⚠ Sem rotas</span>
                        : <span className="font-semibold">{(a.total_rotas ?? 0).toLocaleString("pt-BR")}</span>}
                    </td>
                    <td className="px-4 py-3 font-semibold">{(a.total_passagens ?? 0).toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-3 font-semibold text-xs">{fmt(a.receita_total)}</td>
                    <td className="px-4 py-3 text-sm font-medium">{a.taxa_comissao}%</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ color: sc.color, background: sc.color + "22", border: `1px solid ${sc.color}44` }}>{sc.label}</span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1.5 flex-wrap">
                        {a.status === "pendente" && <button onClick={() => updateStatus(a.id, "em_analise")} disabled={updatingId === a.id} className="px-2 py-1 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 rounded text-xs font-medium transition-colors disabled:opacity-50">Analisar</button>}
                        {a.status === "em_analise" && <button onClick={() => updateStatus(a.id, "ativo")} disabled={updatingId === a.id} className="px-2 py-1 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded text-xs font-medium transition-colors disabled:opacity-50">Ativar</button>}
                        {a.status === "ativo" && <button onClick={() => updateStatus(a.id, "suspenso")} disabled={updatingId === a.id} className="px-2 py-1 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 rounded text-xs font-medium transition-colors disabled:opacity-50">Suspender</button>}
                        {(a.status === "suspenso" || a.status === "bloqueado") && <button onClick={() => updateStatus(a.id, "ativo")} disabled={updatingId === a.id} className="px-2 py-1 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded text-xs font-medium transition-colors disabled:opacity-50">Reativar</button>}
                        {a.status !== "bloqueado" && <button onClick={() => updateStatus(a.id, "bloqueado")} disabled={updatingId === a.id} className="px-2 py-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded text-xs font-medium transition-colors disabled:opacity-50">Bloquear</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {selected && (
          <div className="border-t border-border bg-muted/20 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">Detalhes — {selected.nome}</p>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-xs">Fechar</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {selected.responsavel && <div><p className="text-xs text-muted-foreground">Responsável</p><p>{selected.responsavel}</p></div>}
              {selected.telefone && <div><p className="text-xs text-muted-foreground">Telefone</p><p>{selected.telefone}</p></div>}
              {selected.site && <div><p className="text-xs text-muted-foreground">Site</p><p className="text-blue-400">{selected.site}</p></div>}
              <div><p className="text-xs text-muted-foreground">Membro desde</p><p>{new Date(selected.criado_em).toLocaleDateString("pt-BR")}</p></div>
              <div><p className="text-xs text-muted-foreground">Receita Total</p><p className="font-semibold">{fmt(selected.receita_total)}</p></div>
              <div><p className="text-xs text-muted-foreground">Total Passagens</p><p className="font-semibold">{(selected.total_passagens ?? 0).toLocaleString("pt-BR")}</p></div>
              <div><p className="text-xs text-muted-foreground">Rotas Cadastradas</p><p className={`font-semibold ${(selected.total_rotas ?? 0) === 0 ? "text-orange-400" : ""}`}>{(selected.total_rotas ?? 0) === 0 ? "Nenhuma rota" : (selected.total_rotas ?? 0).toLocaleString("pt-BR")}</p></div>
            </div>
          </div>
        )}
        <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">{filtered.length} de {agencias.length} empresas</div>
      </div>
    </div>
  );
}
