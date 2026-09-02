import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";

const API = "/api";

interface Loja {
  id: number;
  nome: string;
  categoria: string;
  cnpj?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  status: string;
  plano: string;
  responsavel?: string;
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

const DEMO_LOJAS: Loja[] = [
  {
    id: 1, nome: "Moda Brasil Shop", categoria: "Moda", cnpj: "12.345.678/0001-90",
    telefone: "(11) 3344-5566", email: "contato@modabrasil.com.br",
    endereco: "Av. Paulista, 1000 — São Paulo", status: "ativo", plano: "enterprise",
    responsavel: "Ana Paula Ferreira", total_pedidos: 3241, receita_total: 187420.00, taxa_comissao: 10,
    criado_em: "2024-02-10T09:00:00Z",
  },
  {
    id: 2, nome: "TechStore Premium", categoria: "Eletrônicos", cnpj: "23.456.789/0001-01",
    telefone: "(21) 3456-7890", email: "vendas@techstore.com.br",
    endereco: "Rua do Comércio, 500 — Rio de Janeiro", status: "ativo", plano: "pro",
    responsavel: "Carlos Mendes", total_pedidos: 1854, receita_total: 542800.00, taxa_comissao: 8,
    criado_em: "2024-04-15T10:00:00Z",
  },
  {
    id: 3, nome: "Casa & Cia Decor", categoria: "Casa & Decoração", cnpj: "34.567.890/0001-12",
    telefone: "(31) 9876-5432", email: "contato@casaecia.com.br",
    endereco: "Bairro Savassi — Belo Horizonte", status: "em_analise", plano: "free",
    responsavel: "Fernanda Lima", total_pedidos: 0, receita_total: 0, taxa_comissao: 15,
    criado_em: "2025-01-20T14:30:00Z",
  },
  {
    id: 4, nome: "Beleza Natural", categoria: "Beleza", cnpj: "45.678.901/0001-23",
    telefone: "(41) 3456-1234", email: "beleza@natural.com.br",
    endereco: "Av. do Batel — Curitiba", status: "ativo", plano: "pro",
    responsavel: "Juliana Costa", total_pedidos: 987, receita_total: 45320.00, taxa_comissao: 12,
    criado_em: "2024-07-01T08:00:00Z",
  },
  {
    id: 5, nome: "PetShop Online", categoria: "Pets", cnpj: "56.789.012/0001-34",
    telefone: "(61) 3567-8901", email: "contato@petshoponline.com.br",
    endereco: "Asa Sul — Brasília", status: "suspenso", plano: "pro",
    responsavel: "Rodrigo Alves", total_pedidos: 562, receita_total: 38700.00, taxa_comissao: 12,
    criado_em: "2024-05-20T13:00:00Z",
  },
];

const fmt = (v: number | string) =>
  `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function EcommerceEmpresas() {
  const { token } = useAuth();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("todos");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Loja | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/ecommerce/admin/empresas`, { headers });
      if (res.ok) {
        const data = await res.json();
        setLojas(Array.isArray(data) ? data : []);
      } else {
        setLojas([]);
      }
    } catch (_) {
      setLojas([]);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: number, status: string) => {
    setUpdatingId(id);
    try {
      await fetch(`${API}/ecommerce/admin/empresas/${id}/status`, { method: "PATCH", headers, body: JSON.stringify({ status }) });
      setLojas(prev => prev.map(l => l.id === id ? { ...l, status } : l));
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null);
    } catch (_) {}
    setUpdatingId(null);
  };

  const filtered = lojas.filter(l => {
    const matchStatus = filterStatus === "todos" || l.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch = !q || l.nome.toLowerCase().includes(q) || (l.email?.toLowerCase().includes(q) ?? false) || (l.cnpj?.includes(q) ?? false);
    return matchStatus && matchSearch;
  });

  const counts = {
    total: lojas.length,
    pendente: lojas.filter(l => l.status === "pendente").length,
    em_analise: lojas.filter(l => l.status === "em_analise").length,
    ativo: lojas.filter(l => l.status === "ativo").length,
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3" />Carregando lojas...
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total", value: counts.total, color: "#6366F1" },
          { label: "Pendentes", value: counts.pendente, color: "#F59E0B" },
          { label: "Em Análise", value: counts.em_analise, color: "#8B5CF6" },
          { label: "Ativas", value: counts.ativo, color: "#10B981" },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, email ou CNPJ..."
          className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/30" />
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
                {["Loja", "Categoria", "Responsável", "Plano", "Pedidos", "Receita", "Comissão", "Status", "Ações"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">Nenhuma loja encontrada</td></tr>
              ) : filtered.map(l => {
                const sc = STATUS_CONF[l.status] ?? { label: l.status, color: "#94A3B8" };
                const pc = PLANO_CONF[l.plano] ?? { label: l.plano, color: "#94A3B8" };
                return (
                  <tr key={l.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelected(selected?.id === l.id ? null : l)}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{l.nome}</div>
                      {l.cnpj && <div className="text-xs text-muted-foreground font-mono">{l.cnpj}</div>}
                      {l.email && <div className="text-xs text-muted-foreground">{l.email}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm">{l.categoria}</td>
                    <td className="px-4 py-3 text-sm">{l.responsavel ?? "—"}</td>
                    <td className="px-4 py-3"><span className="text-xs font-semibold" style={{ color: pc.color }}>{pc.label}</span></td>
                    <td className="px-4 py-3 font-semibold">{l.total_pedidos.toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-3 font-semibold text-xs">{fmt(l.receita_total)}</td>
                    <td className="px-4 py-3 text-sm font-medium">{l.taxa_comissao}%</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ color: sc.color, background: sc.color + "22", border: `1px solid ${sc.color}44` }}>{sc.label}</span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1.5 flex-wrap">
                        {l.status === "pendente" && <button onClick={() => updateStatus(l.id, "em_analise")} disabled={updatingId === l.id} className="px-2 py-1 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 rounded text-xs font-medium transition-colors disabled:opacity-50">Analisar</button>}
                        {l.status === "em_analise" && <button onClick={() => updateStatus(l.id, "ativo")} disabled={updatingId === l.id} className="px-2 py-1 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded text-xs font-medium transition-colors disabled:opacity-50">Ativar</button>}
                        {l.status === "ativo" && <button onClick={() => updateStatus(l.id, "suspenso")} disabled={updatingId === l.id} className="px-2 py-1 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 rounded text-xs font-medium transition-colors disabled:opacity-50">Suspender</button>}
                        {(l.status === "suspenso" || l.status === "bloqueado") && <button onClick={() => updateStatus(l.id, "ativo")} disabled={updatingId === l.id} className="px-2 py-1 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded text-xs font-medium transition-colors disabled:opacity-50">Reativar</button>}
                        {l.status !== "bloqueado" && <button onClick={() => updateStatus(l.id, "bloqueado")} disabled={updatingId === l.id} className="px-2 py-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded text-xs font-medium transition-colors disabled:opacity-50">Bloquear</button>}
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
              {selected.endereco && <div><p className="text-xs text-muted-foreground">Endereço</p><p className="text-xs">{selected.endereco}</p></div>}
              {selected.telefone && <div><p className="text-xs text-muted-foreground">Telefone</p><p>{selected.telefone}</p></div>}
              <div><p className="text-xs text-muted-foreground">Membro desde</p><p>{new Date(selected.criado_em).toLocaleDateString("pt-BR")}</p></div>
              <div><p className="text-xs text-muted-foreground">Receita Total</p><p className="font-semibold">{fmt(selected.receita_total)}</p></div>
            </div>
          </div>
        )}
        <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">{filtered.length} de {lojas.length} lojas</div>
      </div>
    </div>
  );
}
