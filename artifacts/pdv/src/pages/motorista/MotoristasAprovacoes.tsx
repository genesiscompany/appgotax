import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, AlertCircle, MapPin, User, Clock, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.BASE_URL.replace(/\/$/, "").replace("/pdv", "") + "/api";
function apiHeaders(token: string | null) { return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }; }
function fmt(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function fmtDate(d: string) { return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }

export default function MotoristasAprovacoes() {
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [obs, setObs] = useState<Record<number, string>>({});

  const { data: pendentes = [], isLoading } = useQuery({
    queryKey: ["corp-aprovacoes"],
    queryFn: async () => {
      const r = await fetch(`${API}/pdv/corporativo/aprovacoes`, { headers: apiHeaders(token) });
      return r.json();
    },
    refetchInterval: 20000,
  });

  const agir = useMutation({
    mutationFn: async ({ id, acao }: { id: number; acao: string }) => {
      const r = await fetch(`${API}/pdv/corporativo/aprovacoes/${id}`, {
        method: "POST", headers: apiHeaders(token),
        body: JSON.stringify({ acao, observacao: obs[id] ?? "", aprovador_nome: "Gestor" }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      return r.json();
    },
    onSuccess: (_, { acao }) => {
      qc.invalidateQueries({ queryKey: ["corp-aprovacoes"] });
      qc.invalidateQueries({ queryKey: ["corp-dashboard"] });
      qc.invalidateQueries({ queryKey: ["corp-corridas"] });
      toast({ title: acao === "aprovada" ? "✅ Corrida aprovada!" : "❌ Corrida recusada", description: "Status atualizado com sucesso." });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
          <AlertCircle className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Aprovações Pendentes</h1>
          <p className="text-sm text-muted-foreground">{pendentes.length} corrida(s) aguardando decisão</p>
        </div>
      </div>

      {pendentes.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-xl">
          <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-500 opacity-50" />
          <p className="font-medium">Nenhuma aprovação pendente</p>
          <p className="text-sm mt-1">Todas as solicitações foram atendidas</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendentes.map((c: any) => (
            <div key={c.id} className="bg-card border border-amber-400/30 rounded-xl p-5">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-amber-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold">{c.passageiro_nome}</p>
                    {c.funcionario_nome && <span className="text-xs text-muted-foreground">({c.funcionario_nome})</span>}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                    <Clock className="w-3 h-3" /> {fmtDate(c.criado_em)}
                    {c.centro_custo_nome && <><Building2 className="w-3 h-3 ml-2" />{c.centro_custo_nome}</>}
                  </div>
                </div>
                {c.valor_estimado && (
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">Valor est.</p>
                    <p className="font-bold text-lg">{fmt(Number(c.valor_estimado))}</p>
                  </div>
                )}
              </div>

              <div className="space-y-2 mb-4 p-3 bg-muted/40 rounded-lg text-sm">
                <div className="flex gap-2">
                  <span className="text-green-500 shrink-0">📍</span>
                  <div><span className="text-muted-foreground text-xs block">Origem</span>{c.origem}</div>
                </div>
                <div className="flex gap-2">
                  <span className="text-red-500 shrink-0">🏁</span>
                  <div><span className="text-muted-foreground text-xs block">Destino</span>{c.destino}</div>
                </div>
                {c.motivo && (
                  <div className="flex gap-2">
                    <span className="shrink-0">💼</span>
                    <div><span className="text-muted-foreground text-xs block">Motivo</span>{c.motivo}</div>
                  </div>
                )}
                {c.tipo === "agendado" && c.data_agendamento && (
                  <div className="flex gap-2">
                    <span className="shrink-0">📅</span>
                    <div><span className="text-muted-foreground text-xs block">Agendamento</span>{fmtDate(c.data_agendamento)}</div>
                  </div>
                )}
              </div>

              <div className="mb-4">
                <Input value={obs[c.id] ?? ""} onChange={e => setObs(o => ({ ...o, [c.id]: e.target.value }))}
                  placeholder="Observação (opcional)..." className="h-9 text-sm" />
              </div>

              <div className="flex gap-3">
                <Button onClick={() => agir.mutate({ id: c.id, acao: "aprovada" })}
                  disabled={agir.isPending} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                  <CheckCircle className="w-4 h-4 mr-2" /> Aprovar
                </Button>
                <Button variant="outline" onClick={() => agir.mutate({ id: c.id, acao: "recusada" })}
                  disabled={agir.isPending} className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10">
                  <XCircle className="w-4 h-4 mr-2" /> Recusar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
