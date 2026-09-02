import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";

const API = "/api";

interface EmpresaEcommerce {
  id: number;
  nome: string;
  categoria: string;
  telefone?: string;
  email?: string;
  status: string;
  plano: string;
  avaliacao_media: number;
  total_pedidos: number;
  receita_total: number | string;
  taxa_comissao: number;
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

const CATEGORIA_LABEL: Record<string, string> = {
  moda:        "Moda",
  eletronicos: "Eletrônicos",
  casa:        "Casa & Decoração",
  beleza:      "Beleza",
  esportes:    "Esportes",
  livros:      "Livros",
  infantil:    "Infantil",
  pets:        "Pets",
  outro:       "Outro",
};

const DEMO_EMPRESAS: EmpresaEcommerce[] = [
  {
    id: 1, nome: "Moda Brasil Shop", categoria: "moda",
    telefone: "(11) 3344-5566", email: "contato@modabrasil.com.br",
    status: "ativo", plano: "enterprise",
    avaliacao_media: 4.5, total_pedidos: 3241, receita_total: 187420.00, taxa_comissao: 10,
    criado_em: "2024-02-10T09:00:00Z",
  },
  {
    id: 2, nome: "TechStore Premium", categoria: "eletronicos",
    telefone: "(21) 3456-7890", email: "vendas@techstore.com.br",
    status: "ativo", plano: "pro",
    avaliacao_media: 4.7, total_pedidos: 1854, receita_total: 542800.00, taxa_comissao: 8,
    criado_em: "2024-04-15T10:00:00Z",
  },
  {
    id: 3, nome: "Casa & Cia Decor", categoria: "casa",
    telefone: "(31) 9876-5432", email: "contato@casaecia.com.br",
    status: "em_analise", plano: "free",
    avaliacao_media: 0, total_pedidos: 0, receita_total: 0, taxa_comissao: 15,
    criado_em: "2025-01-20T14:30:00Z",
  },
  {
    id: 4, nome: "Beleza Natural", categoria: "beleza",
    telefone: "(41) 3456-1234", email: "beleza@natural.com.br",
    status: "ativo", plano: "pro",
    avaliacao_media: 4.8, total_pedidos: 987, receita_total: 45320.00, taxa_comissao: 12,
    criado_em: "2024-07-01T08:00:00Z",
  },
  {
    id: 5, nome: "Esporte Total", categoria: "esportes",
    telefone: "(51) 9654-3210", email: "contato@esportetotal.com.br",
    status: "pendente", plano: "free",
    avaliacao_media: 0, total_pedidos: 0, receita_total: 0, taxa_comissao: 15,
    criado_em: "2025-03-01T11:00:00Z",
  },
  {
    id: 6, nome: "PetShop Online", categoria: "pets",
    telefone: "(61) 3567-8901", email: "contato@petshoponline.com.br",
    status: "suspenso", plano: "pro",
    avaliacao_media: 3.9, total_pedidos: 562, receita_total: 38700.00, taxa_comissao: 12,
    criado_em: "2024-05-20T13:00:00Z",
  },
];

const fmt = (v: number | string) =>
  `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function Ecommerce() {
  const { token } = useAuth();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const [empresas, setEmpresas] = useState<EmpresaEcommerce[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("todos");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/ecommerce/admin/list`, { headers });
      if (res.ok) {
        const data = await res.json();
        setEmpresas(Array.isArray(data) ? data : []);
      } else {
        setEmpresas([]);
      }
    } catch (_) {
      setEmpresas([]);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: number, status: string) => {
    setUpdatingId(id);
    try {
      await fetch(`${API}/ecommerce/admin/${id}/status`, {
        method: "PATCH", headers, body: JSON.stringify({ status }),
      });
      setEmpresas(prev => prev.map(e => e.id === id ? { ...e, status } : e));
    } catch (_) {}
    setUpdatingId(null);
  };

  const filtered = empresas.filter(e => {
    const matchStatus = filterStatus === "todos" || e.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch = !q || e.nome.toLowerCase().includes(q) || (e.email?.toLowerCase().includes(q) ?? false);
    return matchStatus && matchSearch;
  });

  const counts = {
    total: empresas.length,
    pendente: empresas.filter(e => e.status === "pendente").length,
    em_analise: empresas.filter(e => e.status === "em_analise").length,
    ativo: empresas.filter(e => e.status === "ativo").length,
    receita: empresas.reduce((acc, e) => acc + Number(e.receita_total), 0),
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3" />
      Carregando lojas...
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Total", value: counts.total, color: "#6366F1" },
          { label: "Pendentes", value: counts.pendente, color: "#F59E0B" },
          { label: "Em Análise", value: counts.em_analise, color: "#8B5CF6" },
          { label: "Ativas", value: counts.ativo, color: "#10B981" },
          { label: "Receita Total", value: fmt(counts.receita), color: "#6366F1", small: true },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className={`font-bold ${(stat as any).small ? "text-lg" : "text-2xl"}`} style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome ou email..."
          className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/30"
        />
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
                {["Loja", "Categoria", "Plano", "Pedidos", "Receita", "Avaliação", "Comissão", "Status", "Ações"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">Nenhuma loja encontrada</td></tr>
              ) : filtered.map(e => {
                const sc = STATUS_CONF[e.status] ?? { label: e.status, color: "#94A3B8" };
                const pc = PLANO_CONF[e.plano] ?? { label: e.plano, color: "#94A3B8" };
                return (
                  <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{e.nome}</div>
                      {e.email && <div className="text-xs text-muted-foreground">{e.email}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm">{CATEGORIA_LABEL[e.categoria] ?? e.categoria}</td>
                    <td className="px-4 py-3"><span className="text-xs font-semibold" style={{ color: pc.color }}>{pc.label}</span></td>
                    <td className="px-4 py-3 font-semibold">{e.total_pedidos.toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-3 font-semibold text-xs">{fmt(e.receita_total)}</td>
                    <td className="px-4 py-3">
                      {e.avaliacao_media > 0
                        ? <span className="flex items-center gap-1"><span className="text-yellow-400">★</span><span className="font-medium">{Number(e.avaliacao_media).toFixed(1)}</span></span>
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">{e.taxa_comissao}%</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ color: sc.color, background: sc.color + "22", border: `1px solid ${sc.color}44` }}>{sc.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        {e.status === "pendente" && <button onClick={() => updateStatus(e.id, "em_analise")} disabled={updatingId === e.id} className="px-2 py-1 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 rounded text-xs font-medium transition-colors disabled:opacity-50">Analisar</button>}
                        {e.status === "em_analise" && <button onClick={() => updateStatus(e.id, "ativo")} disabled={updatingId === e.id} className="px-2 py-1 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded text-xs font-medium transition-colors disabled:opacity-50">Ativar</button>}
                        {e.status === "ativo" && <button onClick={() => updateStatus(e.id, "suspenso")} disabled={updatingId === e.id} className="px-2 py-1 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 rounded text-xs font-medium transition-colors disabled:opacity-50">Suspender</button>}
                        {(e.status === "suspenso" || e.status === "bloqueado") && <button onClick={() => updateStatus(e.id, "ativo")} disabled={updatingId === e.id} className="px-2 py-1 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded text-xs font-medium transition-colors disabled:opacity-50">Reativar</button>}
                        {e.status !== "bloqueado" && <button onClick={() => updateStatus(e.id, "bloqueado")} disabled={updatingId === e.id} className="px-2 py-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded text-xs font-medium transition-colors disabled:opacity-50">Bloquear</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">{filtered.length} de {empresas.length} lojas</div>
      </div>
    </div>
  );
}
