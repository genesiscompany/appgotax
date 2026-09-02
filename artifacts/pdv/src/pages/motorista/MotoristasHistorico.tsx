import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Car, MapPin, Clock, CheckCircle, XCircle, AlertCircle, Filter, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.BASE_URL.replace(/\/$/, "").replace("/pdv", "") + "/api";
function apiHeaders(token: string | null) { return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }; }
function fmt(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function fmtDate(d: string) { return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pendente_aprovacao: { label: "Aguard. Aprovação", color: "text-amber-500 bg-amber-500/10", icon: AlertCircle },
  aprovada: { label: "Aprovada", color: "text-blue-500 bg-blue-500/10", icon: CheckCircle },
  em_andamento: { label: "Em andamento", color: "text-green-500 bg-green-500/10", icon: Car },
  concluida: { label: "Concluída", color: "text-green-600 bg-green-600/10", icon: CheckCircle },
  recusada: { label: "Recusada", color: "text-red-500 bg-red-500/10", icon: XCircle },
  cancelada: { label: "Cancelada", color: "text-muted-foreground bg-muted", icon: XCircle },
};

export default function MotoristasHistorico() {
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFiltro, setStatusFiltro] = useState("");
  const [selected, setSelected] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["corp-corridas", statusFiltro],
    queryFn: async () => {
      const qs = statusFiltro ? `?status=${statusFiltro}` : "";
      const r = await fetch(`${API}/pdv/corporativo/corridas${qs}`, { headers: apiHeaders(token) });
      return r.json();
    },
  });

  const cancelar = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`${API}/pdv/corporativo/corridas/${id}/status`, {
        method: "PUT", headers: apiHeaders(token), body: JSON.stringify({ status: "cancelada" }),
      });
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["corp-corridas"] }); setSelected(null); toast({ title: "Corrida cancelada" }); },
    onError: () => toast({ title: "Erro ao cancelar", variant: "destructive" }),
  });

  const corridas: any[] = data?.corridas ?? [];

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Histórico de Corridas</h1>
          <p className="text-sm text-muted-foreground mt-1">{data?.total ?? 0} corridas no total</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm">
            <option value="">Todos os status</option>
            {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : corridas.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Car className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhuma corrida encontrada</p>
        </div>
      ) : (
        <div className="space-y-3">
          {corridas.map((c: any) => {
            const s = STATUS_MAP[c.status] ?? { label: c.status, color: "text-muted-foreground bg-muted", icon: Clock };
            const Icon = s.icon;
            return (
              <div key={c.id} className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => setSelected(selected?.id === c.id ? null : c)}>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Car className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-sm">{c.passageiro_nome}</p>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>
                        <Icon className="w-3 h-3" />{s.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{c.origem}</span>
                      <span>→</span>
                      <span className="truncate">{c.destino}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDate(c.criado_em)}</span>
                      {c.centro_custo_nome && <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" />{c.centro_custo_nome}</span>}
                      {c.funcionario_nome && <span>{c.funcionario_nome}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {c.valor_final ? <p className="font-bold text-green-600">{fmt(Number(c.valor_final))}</p>
                      : c.valor_estimado ? <p className="text-muted-foreground text-sm">~{fmt(Number(c.valor_estimado))}</p>
                      : null}
                    <ChevronDown className={`w-4 h-4 text-muted-foreground mt-1 transition-transform ${selected?.id === c.id ? "rotate-180" : ""}`} />
                  </div>
                </div>

                {selected?.id === c.id && (
                  <div className="mt-4 pt-4 border-t border-border space-y-2" onClick={e => e.stopPropagation()}>
                    {c.motivo && <p className="text-sm"><span className="text-muted-foreground">Motivo:</span> {c.motivo}</p>}
                    {c.tipo === "agendado" && c.data_agendamento && (
                      <p className="text-sm"><span className="text-muted-foreground">Agendado para:</span> {fmtDate(c.data_agendamento)}</p>
                    )}
                    {c.observacoes && <p className="text-sm"><span className="text-muted-foreground">Obs:</span> {c.observacoes}</p>}
                    {["pendente_aprovacao", "aprovada"].includes(c.status) && (
                      <button onClick={() => cancelar.mutate(c.id)}
                        className="mt-2 px-4 py-2 text-sm text-destructive border border-destructive/30 rounded-lg hover:bg-destructive/10 transition-colors">
                        Cancelar corrida
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
