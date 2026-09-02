import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, CheckCircle, Clock, DollarSign, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.BASE_URL.replace(/\/$/, "").replace("/pdv", "") + "/api";
function apiHeaders(token: string | null) { return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }; }
function fmt(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  aberta: { label: "Em aberto", color: "text-amber-500 bg-amber-500/10", icon: Clock },
  fechada: { label: "Fechada", color: "text-blue-500 bg-blue-500/10", icon: CheckCircle },
  paga: { label: "Paga", color: "text-green-500 bg-green-500/10", icon: CheckCircle },
};

export default function MotoristasRaturas() {
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const mesAtual = new Date().toISOString().slice(0, 7);

  const { data: faturas = [], isLoading } = useQuery({
    queryKey: ["corp-faturas"],
    queryFn: async () => {
      const r = await fetch(`${API}/pdv/corporativo/faturas`, { headers: apiHeaders(token) });
      return r.json();
    },
  });

  const gerar = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/pdv/corporativo/faturas/gerar`, {
        method: "POST", headers: apiHeaders(token), body: JSON.stringify({ mes: mesAtual }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["corp-faturas"] }); toast({ title: "Fatura gerada!" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const mudarStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const r = await fetch(`${API}/pdv/corporativo/faturas/${id}/status`, {
        method: "PUT", headers: apiHeaders(token), body: JSON.stringify({ status }),
      });
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["corp-faturas"] }); toast({ title: "Status atualizado" }); },
  });

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> Faturas Mensais
          </h1>
          <p className="text-sm text-muted-foreground">Faturamento acumulado por mês</p>
        </div>
        <Button onClick={() => gerar.mutate()} disabled={gerar.isPending} className="gap-2">
          <Plus className="w-4 h-4" /> Gerar fatura do mês
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : faturas.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-xl">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhuma fatura gerada ainda</p>
          <p className="text-sm mt-1">Clique em "Gerar fatura do mês" para criar a primeira</p>
        </div>
      ) : (
        <div className="space-y-4">
          {faturas.map((f: any) => {
            const s = STATUS_MAP[f.status] ?? STATUS_MAP.aberta;
            const Icon = s.icon;
            const mesLabel = new Date(f.mes_referencia + "T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
            return (
              <div key={f.id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold capitalize">{mesLabel}</p>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>
                        <Icon className="w-3 h-3" />{s.label}
                      </span>
                    </div>
                    <div className="flex gap-6 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" />{fmt(Number(f.valor_total))}</span>
                      <span>{f.total_corridas} corrida(s)</span>
                      {f.paga_em && <span>Pago em {new Date(f.paga_em).toLocaleDateString("pt-BR")}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {f.status === "aberta" && (
                      <button onClick={() => mudarStatus.mutate({ id: f.id, status: "fechada" })}
                        className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-secondary transition-colors">
                        Fechar
                      </button>
                    )}
                    {f.status === "fechada" && (
                      <button onClick={() => mudarStatus.mutate({ id: f.id, status: "paga" })}
                        className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                        Marcar paga
                      </button>
                    )}
                    <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:bg-secondary transition-colors">
                      <Download className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
