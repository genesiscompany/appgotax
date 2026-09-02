import React, { useEffect, useState, useCallback } from "react";
import { Link } from "wouter";
import { Search, Plus, MapPin, Clock, CheckCircle2, XCircle, AlertCircle, Filter, RefreshCw, Printer } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const API = "/api/pdv/viagens";
const fmt = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtHora = (h: string) => h ? h.slice(0, 5) : "—";
const fmtData = (d: string) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

const STATUS_STYLE: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  confirmado: { label: "Confirmado", className: "bg-green-500/15 text-green-400 border-green-500/20", icon: CheckCircle2 },
  pendente:   { label: "Pendente",   className: "bg-amber-500/15 text-amber-400 border-amber-500/20", icon: AlertCircle },
  cancelado:  { label: "Cancelado",  className: "bg-red-500/15 text-red-400 border-red-500/20",       icon: XCircle },
};

const PAGAMENTO_LABEL: Record<string, string> = {
  pix: "PIX", dinheiro: "Dinheiro", credito: "Crédito", debito: "Débito",
};

type Passagem = {
  id: number;
  cliente_nome: string;
  cliente_cpf: string;
  cliente_telefone: string;
  origem: string;
  destino: string;
  tipo: string;
  hora_partida: string;
  hora_chegada: string;
  data_partida: string;
  assento: string;
  valor: number;
  forma_pagamento: string;
  status: string;
  observacoes: string;
  vendido_em: string;
};

type DetailModalProps = {
  passagem: Passagem;
  onClose: () => void;
  onStatusChange: (id: number, status: string) => Promise<void>;
};

function DetailModal({ passagem: p, onClose, onStatusChange }: DetailModalProps) {
  const [updating, setUpdating] = useState(false);
  const s = STATUS_STYLE[p.status] ?? STATUS_STYLE.confirmado;

  const handleStatus = async (newStatus: string) => {
    setUpdating(true);
    await onStatusChange(p.id, newStatus);
    setUpdating(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-border/60">
          <div>
            <h3 className="font-bold text-foreground">Passagem V-{String(p.id).padStart(3, "0")}</h3>
            <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full border mt-1 inline-block", s.className)}>
              {s.label}
            </span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none">✕</button>
        </div>

        <div className="p-5 space-y-4 text-sm">
          <div className="bg-secondary/30 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Passageiro</p>
            <p className="font-semibold text-foreground">{p.cliente_nome ?? "—"}</p>
            {p.cliente_cpf && <p className="text-muted-foreground">CPF: {p.cliente_cpf}</p>}
            {p.cliente_telefone && <p className="text-muted-foreground">Tel: {p.cliente_telefone}</p>}
          </div>

          <div className="bg-secondary/30 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Rota</p>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              <span className="text-muted-foreground">{p.origem ?? "—"}</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-semibold text-foreground">{p.destino ?? "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4 shrink-0" />
              {p.data_partida ? fmtData(p.data_partida) : "—"} às {fmtHora(p.hora_partida)}
              {p.hora_chegada && <> → {fmtHora(p.hora_chegada)}</>}
            </div>
            {p.assento && <p className="text-muted-foreground">Assento: <span className="font-semibold text-foreground">{p.assento}</span></p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-secondary/30 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Valor</p>
              <p className="font-bold text-foreground text-lg">{fmt(p.valor)}</p>
            </div>
            <div className="bg-secondary/30 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Pagamento</p>
              <p className="font-semibold text-foreground">{PAGAMENTO_LABEL[p.forma_pagamento] ?? p.forma_pagamento}</p>
            </div>
          </div>

          {p.observacoes && (
            <div className="bg-secondary/30 rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">Observações</p>
              <p className="text-sm text-foreground">{p.observacoes}</p>
            </div>
          )}
        </div>

        <div className="p-5 pt-0 flex gap-2">
          {p.status === "pendente" && (
            <button
              onClick={() => handleStatus("confirmado")}
              disabled={updating}
              className="flex-1 bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-green-500/25 rounded-xl py-2 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              Confirmar
            </button>
          )}
          {p.status !== "cancelado" && (
            <button
              onClick={() => handleStatus("cancelado")}
              disabled={updating}
              className="flex-1 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-xl py-2 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
          )}
          {p.status === "cancelado" && (
            <button
              onClick={() => handleStatus("confirmado")}
              disabled={updating}
              className="flex-1 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded-xl py-2 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              Reativar
            </button>
          )}
          <button onClick={onClose} className="flex-1 bg-secondary text-muted-foreground hover:bg-secondary/80 rounded-xl py-2 text-sm font-semibold transition-colors">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ViagensVendas() {
  const { token } = useAuth();
  const [passagens, setPassagens] = useState<Passagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterData, setFilterData] = useState("");
  const [selected, setSelected] = useState<Passagem | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus !== "todos") params.set("status", filterStatus);
    if (filterData) params.set("data", filterData);
    if (search) params.set("q", search);
    fetch(`${API}/passagens?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setPassagens(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token, filterStatus, filterData, search]);

  useEffect(load, [load]);

  const handleStatusChange = async (id: number, status: string) => {
    await fetch(`${API}/passagens/${id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  };

  const totais = {
    total: passagens.filter(p => p.status !== "cancelado").reduce((s, p) => s + Number(p.valor), 0),
    confirmados: passagens.filter(p => p.status === "confirmado").length,
    pendentes: passagens.filter(p => p.status === "pendente").length,
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendas — Passagens</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie todas as passagens emitidas</p>
        </div>
        <Link href="/viagens/nova-venda">
          <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" />
            Nova Venda
          </button>
        </Link>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total faturado", value: fmt(totais.total), color: "#22C55E" },
          { label: "Confirmadas", value: totais.confirmados, color: "#3B82F6" },
          { label: "Pendentes", value: totais.pendentes, color: "#F97316" },
        ].map(c => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="text-xl font-bold mt-1" style={{ color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-card border border-border rounded-xl px-3 py-2">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        <input
          type="date"
          value={filterData}
          onChange={e => setFilterData(e.target.value)}
          className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="todos">Todos status</option>
          <option value="confirmado">Confirmado</option>
          <option value="pendente">Pendente</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <button onClick={load} className="flex items-center gap-2 bg-secondary text-muted-foreground hover:text-foreground px-3 py-2 rounded-xl text-sm border border-border transition-colors">
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </button>
      </div>

      {/* Tabela */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground gap-2 text-sm">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Carregando...
          </div>
        ) : !passagens.length ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
            <Filter className="w-8 h-8 opacity-30" />
            <p className="text-sm">Nenhuma passagem encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-secondary/20">
                  {["ID", "Cliente", "Rota", "Partida", "Assento", "Valor", "Pagamento", "Status", ""].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {passagens.map((p, i) => {
                  const s = STATUS_STYLE[p.status] ?? STATUS_STYLE.confirmado;
                  return (
                    <tr key={p.id} className={cn("border-b border-border/30 last:border-0 hover:bg-secondary/20 transition-colors", i % 2 === 0 ? "" : "bg-secondary/10")}>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">V-{String(p.id).padStart(3,"0")}</td>
                      <td className="px-4 py-3 font-medium text-foreground max-w-[120px] truncate">{p.cliente_nome ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-primary shrink-0" />
                          {p.origem ?? "?"} → {p.destino ?? "?"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{p.data_partida ? fmtData(p.data_partida) : "—"} {fmtHora(p.hora_partida)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.assento || "—"}</td>
                      <td className="px-4 py-3 font-semibold text-foreground">{fmt(p.valor)}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{PAGAMENTO_LABEL[p.forma_pagamento] ?? p.forma_pagamento}</td>
                      <td className="px-4 py-3">
                        <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full border", s.className)}>{s.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelected(p)}
                          className="text-xs text-primary hover:underline"
                        >
                          Detalhes
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <DetailModal
          passagem={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
