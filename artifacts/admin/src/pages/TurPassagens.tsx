import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";

const API = "/api";

type Status = "reservado" | "confirmado" | "embarcado" | "concluido" | "cancelado" | "reembolsado";
type Modal = "aereo" | "rodoviario" | "maritimo" | "fretamento";

interface Passagem {
  id: number;
  empresa_nome: string;
  modal: Modal;
  passageiro_nome: string;
  passageiro_cpf?: string;
  passageiro_telefone?: string;
  origem: string;
  destino: string;
  data_partida: string;
  data_chegada?: string;
  poltrona?: string;
  classe?: string;
  status: Status;
  valor: number | string;
  taxa_servico: number | string;
  forma_pagamento: string;
  codigo_reserva: string;
  criado_em: string;
}

interface Stats {
  reservados: number;
  confirmados: number;
  embarcados: number;
  concluidos_hoje: number;
  cancelados_hoje: number;
  receita_hoje: number;
}

const STATUS_LABEL: Record<Status, string> = {
  reservado: "Reservado", confirmado: "Confirmado", embarcado: "Embarcado",
  concluido: "Concluído", cancelado: "Cancelado", reembolsado: "Reembolsado",
};
const STATUS_COLOR: Record<Status, string> = {
  reservado: "#F59E0B", confirmado: "#6366F1", embarcado: "#3B82F6",
  concluido: "#10B981", cancelado: "#EF4444", reembolsado: "#F97316",
};
const MODAL_LABEL: Record<Modal, string> = {
  aereo: "✈ Aéreo", rodoviario: "🚌 Rodoviário", maritimo: "🚢 Marítimo", fretamento: "🚐 Fretamento",
};
const MODAL_COLOR: Record<Modal, string> = {
  aereo: "#3B82F6", rodoviario: "#10B981", maritimo: "#0EA5E9", fretamento: "#F97316",
};

const DEMO_PASSAGENS: Passagem[] = [
  {
    id: 9001, empresa_nome: "SkyFly Linhas Aéreas", modal: "aereo",
    passageiro_nome: "Maria Fernanda Silva", passageiro_cpf: "123.456.789-00", passageiro_telefone: "(11) 98765-1234",
    origem: "GRU — São Paulo", destino: "GIG — Rio de Janeiro",
    data_partida: "2025-03-21T08:30:00Z", data_chegada: "2025-03-21T09:30:00Z",
    poltrona: "14A", classe: "Econômica",
    status: "confirmado", valor: 450.00, taxa_servico: 35.00, forma_pagamento: "credito",
    codigo_reserva: "SKY-7821", criado_em: "2025-03-18T10:00:00Z",
  },
  {
    id: 9002, empresa_nome: "BrasilRota Rodoviária", modal: "rodoviario",
    passageiro_nome: "João Carlos Santos", passageiro_cpf: "234.567.890-11", passageiro_telefone: "(21) 97654-3210",
    origem: "Rio de Janeiro — RJ", destino: "Belo Horizonte — MG",
    data_partida: "2025-03-20T22:00:00Z", data_chegada: "2025-03-21T06:30:00Z",
    poltrona: "23", classe: "Leito",
    status: "embarcado", valor: 189.90, taxa_servico: 15.00, forma_pagamento: "pix",
    codigo_reserva: "BRT-3412", criado_em: "2025-03-19T15:30:00Z",
  },
  {
    id: 9003, empresa_nome: "Mar Azul Cruzeiros", modal: "maritimo",
    passageiro_nome: "Ana Paula Oliveira", passageiro_cpf: "345.678.901-22", passageiro_telefone: "(13) 96543-2100",
    origem: "Santos — SP", destino: "Buenos Aires — AR",
    data_partida: "2025-04-05T12:00:00Z", data_chegada: "2025-04-10T08:00:00Z",
    poltrona: "Cabine 142", classe: "Cabine Dupla",
    status: "reservado", valor: 3800.00, taxa_servico: 120.00, forma_pagamento: "credito",
    codigo_reserva: "MAR-0091", criado_em: "2025-03-20T09:00:00Z",
  },
  {
    id: 9004, empresa_nome: "SkyFly Linhas Aéreas", modal: "aereo",
    passageiro_nome: "Carlos Eduardo Lima", passageiro_cpf: "456.789.012-33",
    origem: "BSB — Brasília", destino: "FLN — Florianópolis",
    data_partida: "2025-03-20T14:00:00Z", data_chegada: "2025-03-20T15:45:00Z",
    poltrona: "8C", classe: "Executiva",
    status: "concluido", valor: 1250.00, taxa_servico: 45.00, forma_pagamento: "debito",
    codigo_reserva: "SKY-4458", criado_em: "2025-03-10T11:00:00Z",
  },
  {
    id: 9005, empresa_nome: "Litoral Fretamentos", modal: "fretamento",
    passageiro_nome: "Grupo Excursão Boa Viagem", passageiro_telefone: "(71) 93456-7890",
    origem: "Salvador — BA", destino: "Porto Seguro — BA",
    data_partida: "2025-03-22T06:00:00Z", data_chegada: "2025-03-22T10:00:00Z",
    classe: "Ônibus Executivo (42 lugares)",
    status: "confirmado", valor: 4200.00, taxa_servico: 200.00, forma_pagamento: "pix",
    codigo_reserva: "LIT-8801", criado_em: "2025-03-15T08:00:00Z",
  },
  {
    id: 9006, empresa_nome: "BrasilRota Rodoviária", modal: "rodoviario",
    passageiro_nome: "Luciana Martins", passageiro_cpf: "567.890.123-44", passageiro_telefone: "(41) 92345-6789",
    origem: "Curitiba — PR", destino: "São Paulo — SP",
    data_partida: "2025-03-19T07:00:00Z", data_chegada: "2025-03-19T13:00:00Z",
    poltrona: "11", classe: "Convencional",
    status: "cancelado", valor: 145.00, taxa_servico: 12.00, forma_pagamento: "pix",
    codigo_reserva: "BRT-2287", criado_em: "2025-03-17T16:00:00Z",
  },
];

const DEMO_STATS: Stats = {
  reservados: 34, confirmados: 89, embarcados: 12, concluidos_hoje: 156, cancelados_hoje: 5, receita_hoje: 42800.50,
};

const fmt = (v: number | string) =>
  `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function TurPassagens() {
  const { token } = useAuth();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const [passagens, setPassagens] = useState<Passagem[]>([]);
  const [stats, setStats] = useState<Stats>({
    reservados: 0, confirmados: 0, embarcados: 0, concluidos_hoje: 0, cancelados_hoje: 0, receita_hoje: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterModal, setFilterModal] = useState("todos");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Passagem | null>(null);

  const load = useCallback(async () => {
    try {
      const [pRes, sRes] = await Promise.all([
        fetch(`${API}/tur-viagens/admin/passagens`, { headers }),
        fetch(`${API}/tur-viagens/admin/passagens/stats`, { headers }),
      ]);
      if (pRes.ok) setPassagens(await pRes.json()); else setPassagens([]);
      if (sRes.ok) setStats(await sRes.json());
    } catch (_) { setPassagens([]); }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const filtered = passagens.filter(p => {
    const matchStatus = filterStatus === "todos" || p.status === filterStatus;
    const matchModal = filterModal === "todos" || p.modal === filterModal;
    const q = search.toLowerCase();
    const matchSearch = !q || p.passageiro_nome.toLowerCase().includes(q) || p.empresa_nome.toLowerCase().includes(q)
      || p.codigo_reserva.toLowerCase().includes(q) || p.origem.toLowerCase().includes(q) || p.destino.toLowerCase().includes(q)
      || (p.passageiro_cpf?.includes(q) ?? false);
    return matchStatus && matchModal && matchSearch;
  });

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3" />Carregando passagens...
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: "Reservadas",      value: stats.reservados,       color: "#F59E0B" },
          { label: "Confirmadas",     value: stats.confirmados,      color: "#6366F1" },
          { label: "Embarcados",      value: stats.embarcados,       color: "#3B82F6" },
          { label: "Concluídas Hoje", value: stats.concluidos_hoje,  color: "#10B981" },
          { label: "Canceladas Hoje", value: stats.cancelados_hoje,  color: "#EF4444" },
          { label: "Receita Hoje",    value: fmt(stats.receita_hoje), color: "#6366F1", small: true },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className={`font-bold ${(stat as any).small ? "text-base" : "text-2xl"}`} style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por passageiro, empresa, código de reserva, origem ou destino..."
          className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/30" />
        <select value={filterModal} onChange={e => setFilterModal(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/30">
          <option value="todos">Todos os modais</option>
          {(["aereo", "rodoviario", "maritimo", "fretamento"] as Modal[]).map(m => (
            <option key={m} value={m}>{MODAL_LABEL[m]}</option>
          ))}
        </select>
        <div className="flex gap-2 flex-wrap">
          {(["todos", "reservado", "confirmado", "embarcado", "concluido", "cancelado", "reembolsado"] as const).map(s => (
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
                {["Reserva", "Empresa", "Modal", "Passageiro", "Trecho", "Partida", "Classe", "Valor", "Pagamento", "Status"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-muted-foreground">Nenhuma passagem encontrada</td></tr>
              ) : filtered.map(p => {
                const sc = { color: STATUS_COLOR[p.status] ?? "#94A3B8", label: STATUS_LABEL[p.status] ?? p.status };
                const mc = { color: MODAL_COLOR[p.modal] ?? "#94A3B8", label: MODAL_LABEL[p.modal] ?? p.modal };
                return (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setSelected(selected?.id === p.id ? null : p)}>
                    <td className="px-4 py-3 font-mono font-semibold text-primary text-xs">{p.codigo_reserva}</td>
                    <td className="px-4 py-3 text-xs font-medium">{p.empresa_nome}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold" style={{ color: mc.color }}>{mc.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-xs">{p.passageiro_nome}</div>
                      {p.passageiro_cpf && <div className="text-xs text-muted-foreground font-mono">{p.passageiro_cpf}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium">{p.origem}</div>
                      <div className="text-xs text-muted-foreground">→ {p.destino}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(p.data_partida)}</td>
                    <td className="px-4 py-3 text-xs">{p.poltrona ? `${p.poltrona} · ` : ""}{p.classe ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-xs">{fmt(p.valor)}</div>
                      {Number(p.taxa_servico) > 0 && <div className="text-xs text-muted-foreground">+ {fmt(p.taxa_servico)} taxa</div>}
                    </td>
                    <td className="px-4 py-3 text-xs capitalize">{p.forma_pagamento}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ color: sc.color, background: sc.color + "22", border: `1px solid ${sc.color}44` }}>{sc.label}</span>
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
              <p className="font-semibold text-sm">Detalhes — Reserva {selected.codigo_reserva}</p>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-xs">Fechar</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-xs text-muted-foreground">Passageiro</p><p>{selected.passageiro_nome}</p></div>
              {selected.passageiro_telefone && <div><p className="text-xs text-muted-foreground">Telefone</p><p>{selected.passageiro_telefone}</p></div>}
              <div><p className="text-xs text-muted-foreground">Origem</p><p>{selected.origem}</p></div>
              <div><p className="text-xs text-muted-foreground">Destino</p><p>{selected.destino}</p></div>
              <div><p className="text-xs text-muted-foreground">Partida</p><p>{fmtDate(selected.data_partida)}</p></div>
              {selected.data_chegada && <div><p className="text-xs text-muted-foreground">Chegada Prevista</p><p>{fmtDate(selected.data_chegada)}</p></div>}
              <div><p className="text-xs text-muted-foreground">Valor Total</p><p className="font-semibold">{fmt(Number(selected.valor) + Number(selected.taxa_servico))}</p></div>
              <div><p className="text-xs text-muted-foreground">Empresa</p><p>{selected.empresa_nome}</p></div>
            </div>
          </div>
        )}
        <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">{filtered.length} de {passagens.length} passagens</div>
      </div>
    </div>
  );
}
