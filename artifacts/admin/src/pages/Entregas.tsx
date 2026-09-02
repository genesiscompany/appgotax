import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";

const API = "/api";

type Status = "aguardando" | "aceita" | "coletado" | "em_transito" | "entregue" | "cancelada";

interface Entrega {
  id: number;
  remetente_nome: string;
  remetente_telefone?: string;
  destinatario_nome: string;
  destinatario_telefone?: string;
  origem_endereco: string;
  destino_endereco: string;
  descricao_pacote: string;
  forma_pagamento: string;
  status: Status;
  valor: number | string;
  distancia_km?: number;
  entregador_nome?: string;
  entregador_veiculo?: string;
  avaliacao?: number;
  criado_em: string;
  entregue_em?: string;
  cancelada_em?: string;
}

interface Stats {
  aguardando: number;
  em_transito: number;
  entregues_hoje: number;
  canceladas_hoje: number;
  receita_hoje: number;
  avaliacao_media: number;
}

const STATUS_LABEL: Record<Status, string> = {
  aguardando: "Aguardando",
  aceita: "Aceita",
  coletado: "Coletado",
  em_transito: "Em Trânsito",
  entregue: "Entregue",
  cancelada: "Cancelada",
};

const STATUS_COLOR: Record<Status, string> = {
  aguardando: "#F59E0B",
  aceita: "#3B82F6",
  coletado: "#8B5CF6",
  em_transito: "#0EA5E9",
  entregue: "#10B981",
  cancelada: "#EF4444",
};

const DEMO_ENTREGAS: Entrega[] = [
  {
    id: 2001, remetente_nome: "Loja Alpha", remetente_telefone: "(11) 3344-5566",
    destinatario_nome: "João Silva", destinatario_telefone: "(11) 98765-4321",
    origem_endereco: "Rua do Comércio, 100 — São Paulo",
    destino_endereco: "Av. das Flores, 200 — São Paulo",
    descricao_pacote: "Caixa pequena — eletrônicos",
    forma_pagamento: "pix", status: "em_transito", valor: 18.50, distancia_km: 4.2,
    entregador_nome: "Rodrigo Mendes", entregador_veiculo: "Moto Honda Pop",
    criado_em: "2025-03-20T10:15:00Z",
  },
  {
    id: 2002, remetente_nome: "Maria Santos", remetente_telefone: "(21) 91234-5678",
    destinatario_nome: "Pedro Alves", destinatario_telefone: "(21) 99876-5432",
    origem_endereco: "Rua Nova, 45 — Rio de Janeiro",
    destino_endereco: "Bairro Ipanema, 500 — Rio de Janeiro",
    descricao_pacote: "Envelope — documentos",
    forma_pagamento: "credito", status: "entregue", valor: 12.00, distancia_km: 2.8,
    entregador_nome: "Camila Souza", entregador_veiculo: "Bicicleta",
    avaliacao: 5, criado_em: "2025-03-20T08:00:00Z", entregue_em: "2025-03-20T08:45:00Z",
  },
  {
    id: 2003, remetente_nome: "Farmácia Central", remetente_telefone: "(31) 3456-7890",
    destinatario_nome: "Ana Lima", destinatario_telefone: "(31) 97654-3210",
    origem_endereco: "Centro, 78 — Belo Horizonte",
    destino_endereco: "Bairro Savassi, 321 — Belo Horizonte",
    descricao_pacote: "Bolsa — medicamentos",
    forma_pagamento: "dinheiro", status: "aguardando", valor: 22.00, distancia_km: 3.5,
    criado_em: "2025-03-20T11:30:00Z",
  },
  {
    id: 2004, remetente_nome: "Gráfica Top", remetente_telefone: "(41) 3567-8901",
    destinatario_nome: "Carlos Ramos", destinatario_telefone: "(41) 96543-2100",
    origem_endereco: "Rua das Indústrias, 99 — Curitiba",
    destino_endereco: "Av. Batel, 654 — Curitiba",
    descricao_pacote: "Tubo — banners impressos",
    forma_pagamento: "pix", status: "coletado", valor: 35.00, distancia_km: 6.1,
    entregador_nome: "Rodrigo Mendes", entregador_veiculo: "Moto Honda Pop",
    criado_em: "2025-03-20T09:45:00Z",
  },
  {
    id: 2005, remetente_nome: "Paulo Ferreira", remetente_telefone: "(51) 98765-1234",
    destinatario_nome: "Lúcia Martins", destinatario_telefone: "(51) 91234-9876",
    origem_endereco: "Bairro Moinhos, 11 — Porto Alegre",
    destino_endereco: "Bairro Higienópolis, 88 — Porto Alegre",
    descricao_pacote: "Sacola — roupas",
    forma_pagamento: "credito", status: "cancelada", valor: 14.90, distancia_km: 2.0,
    criado_em: "2025-03-20T07:30:00Z", cancelada_em: "2025-03-20T07:45:00Z",
  },
];

const DEMO_STATS: Stats = {
  aguardando: 8,
  em_transito: 24,
  entregues_hoje: 193,
  canceladas_hoje: 4,
  receita_hoje: 3847.50,
  avaliacao_media: 4.8,
};

const fmt = (v: number | string) =>
  `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export default function Entregas() {
  const { token } = useAuth();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [stats, setStats] = useState<Stats>({
    aguardando: 0, em_transito: 0, entregues_hoje: 0, canceladas_hoje: 0, receita_hoje: 0, avaliacao_media: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("todos");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Entrega | null>(null);

  const load = useCallback(async () => {
    try {
      const [eRes, sRes] = await Promise.all([
        fetch(`${API}/entregas/admin/list`, { headers }),
        fetch(`${API}/entregas/admin/stats`, { headers }),
      ]);
      if (eRes.ok) setEntregas(await eRes.json());
      else setEntregas([]);
      if (sRes.ok) setStats(await sRes.json());
    } catch (_) {
      setEntregas([]);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const filtered = entregas.filter(e => {
    const matchStatus = filterStatus === "todos" || e.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      e.remetente_nome.toLowerCase().includes(q) ||
      e.destinatario_nome.toLowerCase().includes(q) ||
      String(e.id).includes(q) ||
      (e.entregador_nome?.toLowerCase().includes(q) ?? false);
    return matchStatus && matchSearch;
  });

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3" />
      Carregando entregas...
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: "Aguardando", value: stats.aguardando, color: "#F59E0B" },
          { label: "Em Trânsito", value: stats.em_transito, color: "#0EA5E9" },
          { label: "Entregues Hoje", value: stats.entregues_hoje, color: "#10B981" },
          { label: "Canceladas Hoje", value: stats.canceladas_hoje, color: "#EF4444" },
          { label: "Receita Hoje", value: fmt(stats.receita_hoje), color: "#6366F1", small: true },
          { label: "Avaliação Média", value: `★ ${Number(stats.avaliacao_media).toFixed(1)}`, color: "#F59E0B", small: true },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className={`font-bold ${(stat as any).small ? "text-lg" : "text-2xl"}`} style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por remetente, destinatário, entregador ou nº..."
          className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/30"
        />
        <div className="flex gap-2 flex-wrap">
          {(["todos", "aguardando", "aceita", "coletado", "em_transito", "entregue", "cancelada"] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
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
                {["#Entrega", "Remetente", "Destinatário", "Pacote", "Valor", "Entregador", "Status", "Hora"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">Nenhuma entrega encontrada</td></tr>
              ) : filtered.map(e => {
                const color = STATUS_COLOR[e.status] ?? "#94A3B8";
                const label = STATUS_LABEL[e.status] ?? e.status;
                return (
                  <tr
                    key={e.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setSelected(selected?.id === e.id ? null : e)}
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-primary">#{e.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{e.remetente_nome}</div>
                      {e.remetente_telefone && <div className="text-xs text-muted-foreground">{e.remetente_telefone}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{e.destinatario_nome}</div>
                      {e.destinatario_telefone && <div className="text-xs text-muted-foreground">{e.destinatario_telefone}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-muted-foreground max-w-[140px] truncate">{e.descricao_pacote}</div>
                      {e.distancia_km && <div className="text-xs text-muted-foreground">{e.distancia_km} km</div>}
                    </td>
                    <td className="px-4 py-3 font-semibold">{fmt(e.valor)}</td>
                    <td className="px-4 py-3">
                      {e.entregador_nome ? (
                        <>
                          <div className="font-medium text-xs">{e.entregador_nome}</div>
                          <div className="text-xs text-muted-foreground">{e.entregador_veiculo}</div>
                        </>
                      ) : <span className="text-muted-foreground text-xs">Aguardando</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ color, background: color + "22", border: `1px solid ${color}44` }}>
                        {label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {fmtTime(e.criado_em)}
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
              <p className="font-semibold text-sm">Detalhes da Entrega #{selected.id}</p>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-xs">Fechar</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Origem</p>
                <p className="text-xs">{selected.origem_endereco}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Destino</p>
                <p className="text-xs">{selected.destino_endereco}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pagamento</p>
                <p className="capitalize">{selected.forma_pagamento}</p>
              </div>
              {selected.avaliacao && (
                <div>
                  <p className="text-xs text-muted-foreground">Avaliação</p>
                  <p>{"★".repeat(selected.avaliacao)} ({selected.avaliacao}/5)</p>
                </div>
              )}
              {selected.entregue_em && (
                <div>
                  <p className="text-xs text-muted-foreground">Entregue em</p>
                  <p>{new Date(selected.entregue_em).toLocaleString("pt-BR")}</p>
                </div>
              )}
              {selected.cancelada_em && (
                <div>
                  <p className="text-xs text-muted-foreground">Cancelada em</p>
                  <p>{new Date(selected.cancelada_em).toLocaleString("pt-BR")}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
          {filtered.length} de {entregas.length} entregas
        </div>
      </div>
    </div>
  );
}
