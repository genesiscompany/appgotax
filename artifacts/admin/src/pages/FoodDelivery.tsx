import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";

const API = "/api";

type Status = "aguardando" | "aceito" | "em_preparo" | "a_caminho" | "entregue" | "cancelado";

interface Pedido {
  id: number;
  restaurante_nome: string;
  cliente_nome: string;
  cliente_telefone?: string;
  endereco_entrega: string;
  itens_resumo: string;
  forma_pagamento: string;
  status: Status;
  valor: number | string;
  taxa_entrega: number | string;
  entregador_nome?: string;
  entregador_veiculo?: string;
  tempo_estimado?: number;
  avaliacao?: number;
  criado_em: string;
  entregue_em?: string;
  cancelado_em?: string;
}

interface Stats {
  aguardando: number;
  em_preparo: number;
  a_caminho: number;
  entregues_hoje: number;
  receita_hoje: number;
  avaliacao_media: number;
}

const STATUS_LABEL: Record<Status, string> = {
  aguardando: "Aguardando", aceito: "Aceito", em_preparo: "Em Preparo",
  a_caminho: "A Caminho", entregue: "Entregue", cancelado: "Cancelado",
};
const STATUS_COLOR: Record<Status, string> = {
  aguardando: "#F59E0B", aceito: "#3B82F6", em_preparo: "#8B5CF6",
  a_caminho: "#0EA5E9", entregue: "#10B981", cancelado: "#EF4444",
};

const DEMO_PEDIDOS: Pedido[] = [
  {
    id: 1001, restaurante_nome: "Burger King", cliente_nome: "João Silva", cliente_telefone: "(11) 98765-4321",
    endereco_entrega: "Rua das Flores, 123 — São Paulo", itens_resumo: "2x Whopper + 1x Batata G",
    forma_pagamento: "pix", status: "a_caminho", valor: 58.90, taxa_entrega: 6.99,
    entregador_nome: "Lucas Ferreira", entregador_veiculo: "Moto Honda CG 160",
    tempo_estimado: 12, criado_em: "2025-03-20T18:30:00Z",
  },
  {
    id: 1002, restaurante_nome: "Subway", cliente_nome: "Maria Costa", cliente_telefone: "(11) 91234-5678",
    endereco_entrega: "Av. Paulista, 456 — São Paulo", itens_resumo: "1x Sub Frango + 1x Refrigerante",
    forma_pagamento: "credito", status: "em_preparo", valor: 32.50, taxa_entrega: 5.00,
    entregador_nome: "Renata Oliveira", entregador_veiculo: "Bicicleta",
    tempo_estimado: 25, criado_em: "2025-03-20T18:45:00Z",
  },
  {
    id: 1003, restaurante_nome: "Pizza Hut", cliente_nome: "Pedro Santos", cliente_telefone: "(21) 99876-5432",
    endereco_entrega: "Rua do Comércio, 789 — Rio de Janeiro", itens_resumo: "1x Pizza Grande Margherita + 2x Refri",
    forma_pagamento: "dinheiro", status: "aguardando", valor: 79.90, taxa_entrega: 8.00,
    criado_em: "2025-03-20T19:00:00Z",
  },
  {
    id: 1004, restaurante_nome: "Petz Pet Shop", cliente_nome: "Ana Lima", cliente_telefone: "(31) 97654-3210",
    endereco_entrega: "Rua Nova, 321 — Belo Horizonte", itens_resumo: "Ração Golden 15kg",
    forma_pagamento: "pix", status: "entregue", valor: 145.00, taxa_entrega: 12.00,
    entregador_nome: "Felipe Costa", entregador_veiculo: "Moto Yamaha Factor",
    avaliacao: 5, criado_em: "2025-03-20T14:00:00Z", entregue_em: "2025-03-20T14:42:00Z",
  },
  {
    id: 1005, restaurante_nome: "Carrefour", cliente_nome: "Carlos Ramos", cliente_telefone: "(41) 96543-2100",
    endereco_entrega: "Av. do Batel, 654 — Curitiba", itens_resumo: "Compras de mercado (23 itens)",
    forma_pagamento: "debito", status: "cancelado", valor: 234.80, taxa_entrega: 10.00,
    criado_em: "2025-03-20T10:00:00Z", cancelado_em: "2025-03-20T10:15:00Z",
  },
];

const DEMO_STATS: Stats = {
  aguardando: 3,
  em_preparo: 5,
  a_caminho: 12,
  entregues_hoje: 148,
  receita_hoje: 4782.40,
  avaliacao_media: 4.7,
};

const fmt = (v: number | string) =>
  `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export default function FoodDelivery() {
  const { token } = useAuth();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [stats, setStats] = useState<Stats>({
    aguardando: 0, em_preparo: 0, a_caminho: 0, entregues_hoje: 0, receita_hoje: 0, avaliacao_media: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("todos");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Pedido | null>(null);

  const load = useCallback(async () => {
    try {
      const [pRes, sRes] = await Promise.all([
        fetch(`${API}/food-delivery/admin/pedidos`, { headers }),
        fetch(`${API}/food-delivery/admin/stats`, { headers }),
      ]);
      if (pRes.ok) setPedidos(await pRes.json());
      else setPedidos([]);
      if (sRes.ok) setStats(await sRes.json());
    } catch (_) {
      setPedidos([]);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const filtered = pedidos.filter(p => {
    const matchStatus = filterStatus === "todos" || p.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      p.cliente_nome.toLowerCase().includes(q) ||
      p.restaurante_nome.toLowerCase().includes(q) ||
      String(p.id).includes(q);
    return matchStatus && matchSearch;
  });

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3" />
      Carregando pedidos...
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: "Aguardando", value: stats.aguardando, color: "#F59E0B" },
          { label: "Em Preparo", value: stats.em_preparo, color: "#8B5CF6" },
          { label: "A Caminho", value: stats.a_caminho, color: "#0EA5E9" },
          { label: "Entregues Hoje", value: stats.entregues_hoje, color: "#10B981" },
          { label: "Receita Hoje", value: fmt(stats.receita_hoje), color: "#6366F1", small: true },
          { label: "Avaliação Média", value: `★ ${Number(stats.avaliacao_media).toFixed(1)}`, color: "#F59E0B", small: true },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className={`font-bold ${stat.small ? "text-lg" : "text-2xl"}`} style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por cliente, restaurante ou nº pedido..."
          className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/30"
        />
        <div className="flex gap-2 flex-wrap">
          {(["todos", "aguardando", "aceito", "em_preparo", "a_caminho", "entregue", "cancelado"] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === s ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "todos" ? "Todos" : STATUS_LABEL[s]}
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
                {["#Pedido", "Restaurante", "Cliente", "Itens", "Valor", "Entregador", "Status", "Hora"].map(h => (
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
                  <tr
                    key={p.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setSelected(selected?.id === p.id ? null : p)}
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-primary">#{p.id}</td>
                    <td className="px-4 py-3 font-medium">{p.restaurante_nome}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{p.cliente_nome}</div>
                      {p.cliente_telefone && <div className="text-xs text-muted-foreground">{p.cliente_telefone}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-muted-foreground max-w-[160px] truncate">{p.itens_resumo}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{fmt(p.valor)}</div>
                      <div className="text-xs text-muted-foreground">+ {fmt(p.taxa_entrega)} entrega</div>
                    </td>
                    <td className="px-4 py-3">
                      {p.entregador_nome ? (
                        <>
                          <div className="font-medium text-xs">{p.entregador_nome}</div>
                          <div className="text-xs text-muted-foreground">{p.entregador_veiculo}</div>
                        </>
                      ) : <span className="text-muted-foreground text-xs">Aguardando</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ color, background: color + "22", border: `1px solid ${color}44` }}>
                        {label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {fmtTime(p.criado_em)}
                      {p.tempo_estimado && p.status === "a_caminho" && (
                        <div className="text-primary font-medium">{p.tempo_estimado} min</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Selected detail */}
        {selected && (
          <div className="border-t border-border bg-muted/20 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">Detalhes do Pedido #{selected.id}</p>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-xs">Fechar</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-xs text-muted-foreground">Endereço de Entrega</p><p>{selected.endereco_entrega}</p></div>
              <div><p className="text-xs text-muted-foreground">Forma de Pagamento</p><p className="capitalize">{selected.forma_pagamento}</p></div>
              <div><p className="text-xs text-muted-foreground">Itens</p><p>{selected.itens_resumo}</p></div>
              {selected.avaliacao && <div><p className="text-xs text-muted-foreground">Avaliação</p><p>{"★".repeat(selected.avaliacao)} ({selected.avaliacao}/5)</p></div>}
            </div>
          </div>
        )}

        <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
          {filtered.length} de {pedidos.length} pedidos
        </div>
      </div>
    </div>
  );
}
