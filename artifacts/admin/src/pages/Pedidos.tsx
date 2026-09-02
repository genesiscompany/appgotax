import React, { useEffect, useState } from "react";
import { useAuth, API, authHeaders } from "@/lib/auth";

type Pedido = {
  id: number; status: string; total: number; criado_em: string;
  empresa_id: number; empresa_nome?: string;
  cliente_nome?: string; cliente_telefone?: string;
  total_itens: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  novo: { label: "Novo", color: "bg-blue-500/15 text-blue-400 border border-blue-500/20" },
  preparando: { label: "Preparando", color: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20" },
  pronto: { label: "Pronto", color: "bg-orange-500/15 text-orange-400 border border-orange-500/20" },
  entregue: { label: "Entregue", color: "bg-green-500/15 text-green-400 border border-green-500/20" },
  cancelado: { label: "Cancelado", color: "bg-red-500/15 text-red-400 border border-red-500/20" },
};

export default function Pedidos() {
  const { token } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterEmpresa, setFilterEmpresa] = useState("todos");

  useEffect(() => {
    fetch(`${API}/pedidos`, { headers: authHeaders(token) })
      .then(r => r.json()).then(d => { setPedidos(Array.isArray(d) ? d : []); setLoading(false); });
  }, [token]);

  const empresas = Array.from(new Set(pedidos.map(p => p.empresa_nome).filter(Boolean)));
  const statuses = ["todos", ...Object.keys(STATUS_CONFIG)];

  const filtered = pedidos.filter(p => {
    const matchSearch = !search || p.cliente_nome?.toLowerCase().includes(search.toLowerCase()) || String(p.id).includes(search);
    const matchStatus = filterStatus === "todos" || p.status === filterStatus;
    const matchEmpresa = filterEmpresa === "todos" || p.empresa_nome === filterEmpresa;
    return matchSearch && matchStatus && matchEmpresa;
  });

  const totalReceita = filtered.filter(p => p.status === "entregue").reduce((s, p) => s + Number(p.total), 0);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pedidos</h1>
        <p className="text-muted-foreground text-sm mt-1">Todos os pedidos da plataforma.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total filtrado", value: filtered.length },
          { label: "Entregues", value: filtered.filter(p => p.status === "entregue").length },
          { label: "Receita filtrada", value: `R$ ${totalReceita.toFixed(2)}` },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input placeholder="ID ou cliente..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
          {statuses.map(s => <option key={s} value={s}>{s === "todos" ? "Todos os status" : STATUS_CONFIG[s]?.label}</option>)}
        </select>
        {empresas.length > 0 && (
          <select value={filterEmpresa} onChange={e => setFilterEmpresa(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
            <option value="todos">Todas as empresas</option>
            {empresas.map(e => <option key={e} value={e!}>{e}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground gap-3">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Carregando...
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">#ID</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Empresa</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Cliente</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map(pedido => {
                const sc = STATUS_CONFIG[pedido.status] ?? { label: pedido.status, color: "bg-secondary text-muted-foreground" };
                return (
                  <tr key={pedido.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-4">
                      <span className="font-mono text-sm font-semibold text-foreground/80">#{pedido.id}</span>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <span className="text-sm text-foreground/70">{pedido.empresa_nome ?? "—"}</span>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <div>
                        <p className="text-sm text-foreground/80">{pedido.cliente_nome ?? "—"}</p>
                        {pedido.cliente_telefone && <p className="text-xs text-muted-foreground">{pedido.cliente_telefone}</p>}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${sc.color}`}>{sc.label}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-sm font-bold text-foreground">R$ {Number(pedido.total).toFixed(2)}</span>
                    </td>
                    <td className="px-5 py-4 text-right hidden lg:table-cell">
                      <span className="text-xs text-muted-foreground">{new Date(pedido.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-muted-foreground text-sm">Nenhum pedido encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
