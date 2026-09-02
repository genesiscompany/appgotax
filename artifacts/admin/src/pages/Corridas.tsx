import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";

const API = "/api";

type Status = "aguardando" | "aceita" | "a_caminho" | "em_andamento" | "concluida" | "cancelada";

interface Corrida {
  id: number;
  empresa_id: number;
  empresa_nome?: string;
  passageiro_nome: string;
  passageiro_telefone?: string;
  origem_endereco: string;
  destino_endereco: string;
  tipo_veiculo: string;
  forma_pagamento: string;
  status: Status;
  valor: number | string;
  distancia_km?: number;
  motorista_nome?: string;
  motorista_veiculo?: string;
  motorista_placa?: string;
  avaliacao?: number;
  criado_em: string;
  concluido_em?: string;
  cancelado_em?: string;
}

interface Stats {
  aguardando?: string;
  aceitas?: string;
  em_andamento?: string;
  concluidas_hoje?: string;
  receita_hoje?: string | number;
  avaliacao_media?: string | number;
  total_concluidas?: string;
}

const STATUS_LABEL: Record<Status, string> = {
  aguardando: "Aguardando", aceita: "Aceita", a_caminho: "A Caminho",
  em_andamento: "Em Andamento", concluida: "Concluída", cancelada: "Cancelada",
};
const STATUS_COLOR: Record<Status, string> = {
  aguardando: "#F59E0B", aceita: "#3B82F6", a_caminho: "#8B5CF6",
  em_andamento: "#0EA5E9", concluida: "#10B981", cancelada: "#EF4444",
};

const TIPO_LABEL: Record<string, string> = { economico: "Econômico", conforto: "Conforto", premium: "Premium" };

const ALL_STATUS = ["todos", "aguardando", "aceita", "a_caminho", "em_andamento", "concluida", "cancelada"] as const;

export default function Corridas() {
  const { token } = useAuth();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const [corridas, setCorridas] = useState<Corrida[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"todos" | Status>("todos");
  const [filterEmpresa, setFilterEmpresa] = useState("todas");
  const [empresas, setEmpresas] = useState<{ id: number; nome: string }[]>([]);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const empresaParam = filterEmpresa !== "todas" ? filterEmpresa : "1";
      const [corridasRes, statsRes, empresasRes] = await Promise.all([
        fetch(`${API}/motorista/corridas?empresa_id=${empresaParam}`, { headers }),
        fetch(`${API}/motorista/stats?empresa_id=${empresaParam}`, { headers }),
        fetch(`${API}/admin/empresas`, { headers }),
      ]);
      const [c, s, e] = await Promise.all([corridasRes.json(), statsRes.json(), empresasRes.json()]);
      if (Array.isArray(c)) setCorridas(c);
      if (s && typeof s === "object") setStats(s);
      if (Array.isArray(e)) setEmpresas(e.map((em: any) => ({ id: em.id, nome: em.nome })));
    } catch (_) {}
    setLoading(false);
  }, [token, filterEmpresa]);

  useEffect(() => { load(); }, [load]);

  const handleCancelar = async (id: number) => {
    if (!confirm("Cancelar esta corrida?")) return;
    await fetch(`${API}/motorista/corridas/${id}/status`, {
      method: "PATCH", headers,
      body: JSON.stringify({ status: "cancelada" }),
    });
    load();
  };

  const filtered = corridas
    .filter(c => filterStatus === "todos" || c.status === filterStatus)
    .filter(c => {
      if (!search) return true;
      const s = search.toLowerCase();
      return c.passageiro_nome.toLowerCase().includes(s)
        || c.origem_endereco.toLowerCase().includes(s)
        || c.destino_endereco.toLowerCase().includes(s)
        || (c.motorista_nome || "").toLowerCase().includes(s);
    });

  const totalReceita = corridas.filter(c => c.status === "concluida")
    .reduce((sum, c) => sum + Number(c.valor), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Central de Corridas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestão de todas as corridas da plataforma</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
          <span className="text-xs text-muted-foreground">Tempo real</span>
          <button onClick={load} className="text-xs text-primary hover:underline ml-2">Atualizar</button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: "Aguardando", value: stats.aguardando || "0", color: "#F59E0B", bg: "#FEF3C7" },
            { label: "Aceitas", value: stats.aceitas || "0", color: "#3B82F6", bg: "#DBEAFE" },
            { label: "Em andamento", value: stats.em_andamento || "0", color: "#0EA5E9", bg: "#E0F2FE" },
            { label: "Concluídas hoje", value: stats.concluidas_hoje || "0", color: "#10B981", bg: "#D1FAE5" },
            { label: "Receita hoje", value: `R$ ${Number(stats.receita_hoje || 0).toFixed(2)}`, color: "#8B5CF6", bg: "#EDE9FE" },
            { label: "Total receita", value: `R$ ${totalReceita.toFixed(2)}`, color: "#6366F1", bg: "#E0E7FF" },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4 border border-border bg-card">
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Buscar passageiro, endereço ou motorista..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground flex-1 min-w-[220px] max-w-xs"
        />
        <select
          value={filterEmpresa}
          onChange={e => setFilterEmpresa(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground"
        >
          <option value="todas">Todas as empresas</option>
          {empresas.map(e => <option key={e.id} value={String(e.id)}>{e.nome}</option>)}
        </select>
        <div className="flex flex-wrap gap-1">
          {ALL_STATUS.map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s as any)}
              className="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
              style={filterStatus === s ? {
                backgroundColor: s === "todos" ? "#6366F1" : STATUS_COLOR[s as Status],
                color: "#fff",
                borderColor: "transparent",
              } : { backgroundColor: "transparent", color: "#64748b", borderColor: "#e2e8f0" }}
            >
              {s === "todos" ? "Todos" : STATUS_LABEL[s as Status]}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <p className="text-sm text-muted-foreground">{filtered.length} corrida{filtered.length !== 1 ? "s" : ""}</p>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-muted-foreground gap-2">
          <svg className="w-12 h-12 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0"/><path d="M12 8v4l3 3"/></svg>
          <p className="text-sm font-medium">Nenhuma corrida encontrada</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(corrida => {
            const cor = STATUS_COLOR[corrida.status] || "#64748b";
            return (
              <div key={corrida.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="h-1" style={{ backgroundColor: cor }} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                        style={{ backgroundColor: cor }}>
                        {corrida.passageiro_nome.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-foreground">{corrida.passageiro_nome}</p>
                          {corrida.passageiro_telefone && (
                            <span className="text-xs text-muted-foreground">{corrida.passageiro_telefone}</span>
                          )}
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: cor + "20", color: cor }}>
                            {STATUS_LABEL[corrida.status]}
                          </span>
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {TIPO_LABEL[corrida.tipo_veiculo] || corrida.tipo_veiculo}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          #{corrida.id} · {corrida.forma_pagamento} · {new Date(corrida.criado_em).toLocaleString("pt-BR")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold text-foreground">R$ {Number(corrida.valor).toFixed(2)}</p>
                      {corrida.distancia_km && <p className="text-xs text-muted-foreground">{Number(corrida.distancia_km).toFixed(1)} km</p>}
                    </div>
                  </div>

                  {/* Route */}
                  <div className="mt-3 bg-muted/50 rounded-lg p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 mt-1 shrink-0" />
                      <p className="text-sm text-foreground">{corrida.origem_endereco}</p>
                    </div>
                    <div className="w-px h-3 bg-border ml-1" />
                    <div className="flex items-start gap-2">
                      <div className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: cor }} />
                      <p className="text-sm text-foreground">{corrida.destino_endereco}</p>
                    </div>
                  </div>

                  {/* Motorista */}
                  {corrida.motorista_nome && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                      <span>Motorista: <strong className="text-foreground">{corrida.motorista_nome}</strong></span>
                      {corrida.motorista_veiculo && <span>· {corrida.motorista_veiculo}</span>}
                      {corrida.motorista_placa && <span>· {corrida.motorista_placa}</span>}
                    </div>
                  )}

                  {/* Avaliação */}
                  {corrida.avaliacao && (
                    <div className="mt-2 flex items-center gap-1 text-sm">
                      {"★★★★★".split("").map((_, i) => (
                        <span key={i} style={{ color: i < corrida.avaliacao! ? "#F59E0B" : "#D1D5DB" }}>★</span>
                      ))}
                      <span className="text-muted-foreground text-xs ml-1">{corrida.avaliacao}/5</span>
                    </div>
                  )}

                  {/* Actions */}
                  {["aguardando", "aceita", "a_caminho"].includes(corrida.status) && (
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={() => handleCancelar(corrida.id)}
                        className="text-xs text-destructive hover:underline"
                      >
                        Cancelar corrida
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
