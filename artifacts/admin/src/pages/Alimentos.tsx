import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";

const API = "/api";

interface EmpresaAlimentos {
  id: number;
  nome: string;
  categoria: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  status: string;
  plano: string;
  avaliacao_media: number;
  total_pedidos: number;
  receita_total: number | string;
  taxa_comissao: number;
  criado_em: string;
}

const STATUS_CONF: Record<string, { label: string; color: string; bg: string }> = {
  pendente:   { label: "Pendente",    color: "#F59E0B", bg: "#FEF3C7" },
  em_analise: { label: "Em Análise",  color: "#8B5CF6", bg: "#EDE9FE" },
  ativo:      { label: "Ativo",       color: "#10B981", bg: "#D1FAE5" },
  suspenso:   { label: "Suspenso",    color: "#F97316", bg: "#FEE9D1" },
  bloqueado:  { label: "Bloqueado",   color: "#EF4444", bg: "#FEE2E2" },
};

const PLANO_CONF: Record<string, { label: string; color: string }> = {
  free:       { label: "Free",       color: "#94A3B8" },
  pro:        { label: "Pro",        color: "#3B82F6" },
  enterprise: { label: "Enterprise", color: "#8B5CF6" },
};

const CATEGORIA_LABEL: Record<string, string> = {
  restaurante:  "Restaurante",
  lanchonete:   "Lanchonete",
  pizzaria:     "Pizzaria",
  hamburgueria: "Hamburgueria",
  padaria:      "Padaria",
  sorveteria:   "Sorveteria",
  saudavel:     "Saudável",
  mercado:      "Mercado",
  outro:        "Outro",
};

const DEMO_EMPRESAS: EmpresaAlimentos[] = [
  {
    id: 1, nome: "Burger King Centro", categoria: "hamburgueria",
    telefone: "(11) 3344-5566", email: "centro@burgerking.com.br",
    endereco: "Av. Paulista, 1000 — São Paulo", status: "ativo", plano: "enterprise",
    avaliacao_media: 4.3, total_pedidos: 1842, receita_total: 98420.50, taxa_comissao: 12,
    criado_em: "2024-03-15T09:00:00Z",
  },
  {
    id: 2, nome: "Subway Pinheiros", categoria: "lanchonete",
    telefone: "(11) 3456-7890", email: "pinheiros@subway.com.br",
    endereco: "Rua dos Pinheiros, 500 — São Paulo", status: "ativo", plano: "pro",
    avaliacao_media: 4.6, total_pedidos: 974, receita_total: 42300.00, taxa_comissao: 15,
    criado_em: "2024-06-01T10:00:00Z",
  },
  {
    id: 3, nome: "Pizzaria do Bairro", categoria: "pizzaria",
    telefone: "(21) 9876-5432", email: "contato@pizzariabairro.com.br",
    endereco: "Rua Nova, 78 — Rio de Janeiro", status: "em_analise", plano: "free",
    avaliacao_media: 0, total_pedidos: 0, receita_total: 0, taxa_comissao: 20,
    criado_em: "2025-01-20T14:30:00Z",
  },
  {
    id: 4, nome: "Padaria Pão & Arte", categoria: "padaria",
    telefone: "(31) 3456-1234", email: "paoearte@gmail.com",
    endereco: "Bairro Savassi — Belo Horizonte", status: "ativo", plano: "pro",
    avaliacao_media: 4.9, total_pedidos: 2310, receita_total: 67850.75, taxa_comissao: 15,
    criado_em: "2024-01-10T08:00:00Z",
  },
  {
    id: 5, nome: "Açaí da Vila", categoria: "sorveteria",
    telefone: "(41) 9654-3210", email: "acaidavila@email.com",
    endereco: "Av. do Batel, 321 — Curitiba", status: "pendente", plano: "free",
    avaliacao_media: 0, total_pedidos: 0, receita_total: 0, taxa_comissao: 20,
    criado_em: "2025-02-28T11:00:00Z",
  },
  {
    id: 6, nome: "Mercado Fresco", categoria: "mercado",
    telefone: "(51) 3567-8901", email: "mercadofresco@email.com",
    endereco: "Rua Andrade Neves, 654 — Porto Alegre", status: "suspenso", plano: "pro",
    avaliacao_media: 3.7, total_pedidos: 412, receita_total: 28400.00, taxa_comissao: 15,
    criado_em: "2024-05-20T13:00:00Z",
  },
];

const fmt = (v: number | string) =>
  `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function Alimentos() {
  const { token } = useAuth();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const [empresas, setEmpresas] = useState<EmpresaAlimentos[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("todos");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/empresas-alimentos/admin/list`, { headers });
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
      await fetch(`${API}/empresas-alimentos/admin/${id}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status }),
      });
      setEmpresas(prev => prev.map(e => e.id === id ? { ...e, status } : e));
    } catch (_) {}
    setUpdatingId(null);
  };

  const filtered = empresas.filter(e => {
    const matchStatus = filterStatus === "todos" || e.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      e.nome.toLowerCase().includes(q) ||
      (e.email?.toLowerCase().includes(q) ?? false) ||
      (e.telefone?.includes(q) ?? false) ||
      CATEGORIA_LABEL[e.categoria]?.toLowerCase().includes(q);
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
      Carregando empresas de alimentos...
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Total", value: counts.total, color: "#F97316" },
          { label: "Pendentes", value: counts.pendente, color: "#F59E0B" },
          { label: "Em Análise", value: counts.em_analise, color: "#8B5CF6" },
          { label: "Ativas", value: counts.ativo, color: "#10B981" },
          { label: "Receita Total", value: fmt(counts.receita), color: "#6366F1", small: true },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className={`font-bold ${(stat as any).small ? "text-lg" : "text-2xl"}`} style={{ color: stat.color }}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, email, categoria ou telefone..."
          className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/30"
        />
        <div className="flex gap-2 flex-wrap">
          {["todos", "pendente", "em_analise", "ativo", "suspenso", "bloqueado"].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "todos" ? "Todos" : STATUS_CONF[s]?.label ?? s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {["Empresa", "Categoria", "Plano", "Pedidos", "Receita", "Avaliação", "Comissão", "Status", "Ações"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">Nenhuma empresa encontrada</td></tr>
              ) : filtered.map(e => {
                const sc = STATUS_CONF[e.status] ?? { label: e.status, color: "#94A3B8", bg: "#F1F5F9" };
                const pc = PLANO_CONF[e.plano] ?? { label: e.plano, color: "#94A3B8" };
                return (
                  <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{e.nome}</div>
                      {e.email && <div className="text-xs text-muted-foreground">{e.email}</div>}
                      {e.telefone && <div className="text-xs text-muted-foreground">{e.telefone}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {CATEGORIA_LABEL[e.categoria] ?? e.categoria}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold" style={{ color: pc.color }}>{pc.label}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold">{e.total_pedidos.toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-3 font-semibold text-xs">{fmt(e.receita_total)}</td>
                    <td className="px-4 py-3">
                      {e.avaliacao_media > 0 ? (
                        <span className="flex items-center gap-1">
                          <span className="text-yellow-400">★</span>
                          <span className="font-medium">{Number(e.avaliacao_media).toFixed(1)}</span>
                        </span>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">{e.taxa_comissao}%</td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ color: sc.color, background: sc.color + "22", border: `1px solid ${sc.color}44` }}
                      >
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        {e.status === "pendente" && (
                          <button onClick={() => updateStatus(e.id, "em_analise")} disabled={updatingId === e.id}
                            className="px-2 py-1 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 rounded text-xs font-medium transition-colors disabled:opacity-50">
                            Analisar
                          </button>
                        )}
                        {e.status === "em_analise" && (
                          <button onClick={() => updateStatus(e.id, "ativo")} disabled={updatingId === e.id}
                            className="px-2 py-1 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded text-xs font-medium transition-colors disabled:opacity-50">
                            Ativar
                          </button>
                        )}
                        {e.status === "ativo" && (
                          <button onClick={() => updateStatus(e.id, "suspenso")} disabled={updatingId === e.id}
                            className="px-2 py-1 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 rounded text-xs font-medium transition-colors disabled:opacity-50">
                            Suspender
                          </button>
                        )}
                        {(e.status === "suspenso" || e.status === "bloqueado") && (
                          <button onClick={() => updateStatus(e.id, "ativo")} disabled={updatingId === e.id}
                            className="px-2 py-1 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded text-xs font-medium transition-colors disabled:opacity-50">
                            Reativar
                          </button>
                        )}
                        {e.status !== "bloqueado" && (
                          <button onClick={() => updateStatus(e.id, "bloqueado")} disabled={updatingId === e.id}
                            className="px-2 py-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded text-xs font-medium transition-colors disabled:opacity-50">
                            Bloquear
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
          {filtered.length} de {empresas.length} empresas de alimentos
        </div>
      </div>
    </div>
  );
}
