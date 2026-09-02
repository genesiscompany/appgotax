import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";

const API = "/api";

type Status = "novo" | "confirmado" | "preparando" | "enviado" | "entregue" | "cancelado" | "devolvido";

interface Pedido {
  id: number;
  loja_nome: string;
  cliente_nome: string;
  cliente_telefone?: string;
  endereco_entrega: string;
  itens_resumo: string;
  forma_pagamento: string;
  status: Status;
  valor: number | string;
  taxa_entrega: number | string;
  codigo_rastreio?: string;
  avaliacao?: number;
  criado_em: string;
  entregue_em?: string;
  cancelado_em?: string;
}

interface Stats {
  novos: number;
  preparando: number;
  enviados: number;
  entregues_hoje: number;
  cancelados_hoje: number;
  receita_hoje: number;
}

const STATUS_LABEL: Record<Status, string> = {
  novo: "Novo", confirmado: "Confirmado", preparando: "Preparando",
  enviado: "Enviado", entregue: "Entregue", cancelado: "Cancelado", devolvido: "Devolvido",
};
const STATUS_COLOR: Record<Status, string> = {
  novo: "#3B82F6", confirmado: "#6366F1", preparando: "#F59E0B",
  enviado: "#0EA5E9", entregue: "#10B981", cancelado: "#EF4444", devolvido: "#F97316",
};

const DEMO_PEDIDOS: Pedido[] = [
  {
    id: 5001, loja_nome: "TechStore Premium", cliente_nome: "João Silva", cliente_telefone: "(11) 98765-4321",
    endereco_entrega: "Rua das Flores, 123 — São Paulo", itens_resumo: "1x Fone Bluetooth JBL + 1x Cabo USB-C",
    forma_pagamento: "credito", status: "enviado", valor: 389.90, taxa_entrega: 0,
    codigo_rastreio: "BR123456789SP", criado_em: "2025-03-19T10:00:00Z",
  },
  {
    id: 5002, loja_nome: "Moda Brasil Shop", cliente_nome: "Maria Costa", cliente_telefone: "(21) 91234-5678",
    endereco_entrega: "Av. Ipanema, 456 — Rio de Janeiro", itens_resumo: "2x Camiseta G + 1x Calça Jeans M",
    forma_pagamento: "pix", status: "preparando", valor: 247.00, taxa_entrega: 15.00,
    criado_em: "2025-03-20T09:30:00Z",
  },
  {
    id: 5003, loja_nome: "Beleza Natural", cliente_nome: "Ana Lima", cliente_telefone: "(31) 97654-3210",
    endereco_entrega: "Rua Nova, 789 — Belo Horizonte", itens_resumo: "Kit Skincare Completo",
    forma_pagamento: "debito", status: "novo", valor: 189.90, taxa_entrega: 12.00,
    criado_em: "2025-03-20T11:15:00Z",
  },
  {
    id: 5004, loja_nome: "TechStore Premium", cliente_nome: "Pedro Santos", cliente_telefone: "(41) 96543-2100",
    endereco_entrega: "Av. Batel, 321 — Curitiba", itens_resumo: "1x Smartwatch Samsung Galaxy Watch",
    forma_pagamento: "pix", status: "entregue", valor: 1290.00, taxa_entrega: 0,
    codigo_rastreio: "BR987654321SP", avaliacao: 5,
    criado_em: "2025-03-15T08:00:00Z", entregue_em: "2025-03-18T14:30:00Z",
  },
  {
    id: 5005, loja_nome: "PetShop Online", cliente_nome: "Carlos Ramos", cliente_telefone: "(61) 98901-2345",
    endereco_entrega: "Asa Norte, 654 — Brasília", itens_resumo: "Ração Golden 15kg + Brinquedo Pet",
    forma_pagamento: "credito", status: "cancelado", valor: 210.00, taxa_entrega: 18.00,
    criado_em: "2025-03-20T07:00:00Z", cancelado_em: "2025-03-20T07:30:00Z",
  },
  {
    id: 5006, loja_nome: "Casa & Cia Decor", cliente_nome: "Lucia Martins", cliente_telefone: "(51) 97321-6540",
    endereco_entrega: "Moinhos, 88 — Porto Alegre", itens_resumo: "Jogo de Cama Queen + Almofadas",
    forma_pagamento: "pix", status: "confirmado", valor: 456.00, taxa_entrega: 20.00,
    criado_em: "2025-03-20T10:45:00Z",
  },
];

const DEMO_STATS: Stats = {
  novos: 12, preparando: 8, enviados: 34, entregues_hoje: 87, cancelados_hoje: 3, receita_hoje: 28450.90,
};

const fmt = (v: number | string) =>
  `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export default function EcommercePedidos() {
  const { token } = useAuth();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [stats, setStats] = useState<Stats>({
    novos: 0, preparando: 0, enviados: 0, entregues_hoje: 0, cancelados_hoje: 0, receita_hoje: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("todos");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Pedido | null>(null);

  const load = useCallback(async () => {
    try {
      const [pRes, sRes] = await Promise.all([
        fetch(`${API}/ecommerce/admin/pedidos`, { headers }),
        fetch(`${API}/ecommerce/admin/pedidos/stats`, { headers }),
      ]);
      if (pRes.ok) setPedidos(await pRes.json()); else setPedidos([]);
      if (sRes.ok) setStats(await sRes.json());
    } catch (_) { setPedidos([]); }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const filtered = pedidos.filter(p => {
    const matchStatus = filterStatus === "todos" || p.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch = !q || p.cliente_nome.toLowerCase().includes(q) || p.loja_nome.toLowerCase().includes(q) || String(p.id).includes(q) || (p.codigo_rastreio?.toLowerCase().includes(q) ?? false);
    return matchStatus && matchSearch;
  });

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3" />Carregando pedidos...
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: "Novos", value: stats.novos, color: "#3B82F6" },
          { label: "Preparando", value: stats.preparando, color: "#F59E0B" },
          { label: "Enviados", value: stats.enviados, color: "#0EA5E9" },
          { label: "Entregues Hoje", value: stats.entregues_hoje, color: "#10B981" },
          { label: "Cancelados Hoje", value: stats.cancelados_hoje, color: "#EF4444" },
          { label: "Receita Hoje", value: fmt(stats.receita_hoje), color: "#6366F1", small: true },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className={`font-bold ${(stat as any).small ? "text-base" : "text-2xl"}`} style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por cliente, loja, nº pedido ou rastreio..."
          className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/30" />
        <div className="flex gap-2 flex-wrap">
          {(["todos", "novo", "confirmado", "preparando", "enviado", "entregue", "cancelado", "devolvido"] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === s ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}>
              {s === "todos" ? "Todos" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {["#Pedido", "Loja", "Cliente", "Itens", "Valor", "Pagamento", "Status", "Hora"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Nenhum pedido encontrado</td></tr>
              ) : filtered.map(p => {
                const color = STATUS_COLOR[p.status] ?? "#94A3B8";
                const label = STATUS_LABEL[p.status] ?? p.status;
                return (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelected(selected?.id === p.id ? null : p)}>
                    <td className="px-4 py-3 font-mono font-semibold text-primary">#{p.id}</td>
                    <td className="px-4 py-3 font-medium text-xs">{p.loja_nome}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.cliente_nome}</div>
                      {p.cliente_telefone && <div className="text-xs text-muted-foreground">{p.cliente_telefone}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[150px] truncate">{p.itens_resumo}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{fmt(p.valor)}</div>
                      {Number(p.taxa_entrega) > 0 && <div className="text-xs text-muted-foreground">+ {fmt(p.taxa_entrega)} frete</div>}
                    </td>
                    <td className="px-4 py-3 text-xs capitalize">{p.forma_pagamento}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ color, background: color + "22", border: `1px solid ${color}44` }}>{label}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtTime(p.criado_em)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {selected && (
          <div className="border-t border-border bg-muted/20 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">Detalhes do Pedido #{selected.id}</p>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-xs">Fechar</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-xs text-muted-foreground">Endereço</p><p className="text-xs">{selected.endereco_entrega}</p></div>
              <div><p className="text-xs text-muted-foreground">Itens</p><p className="text-xs">{selected.itens_resumo}</p></div>
              {selected.codigo_rastreio && <div><p className="text-xs text-muted-foreground">Rastreio</p><p className="font-mono text-xs">{selected.codigo_rastreio}</p></div>}
              {selected.avaliacao && <div><p className="text-xs text-muted-foreground">Avaliação</p><p>{"★".repeat(selected.avaliacao)} ({selected.avaliacao}/5)</p></div>}
              {selected.entregue_em && <div><p className="text-xs text-muted-foreground">Entregue em</p><p>{new Date(selected.entregue_em).toLocaleString("pt-BR")}</p></div>}
              {selected.cancelado_em && <div><p className="text-xs text-muted-foreground">Cancelado em</p><p>{new Date(selected.cancelado_em).toLocaleString("pt-BR")}</p></div>}
            </div>
          </div>
        )}
        <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">{filtered.length} de {pedidos.length} pedidos</div>
      </div>
    </div>
  );
}
