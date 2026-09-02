import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, TrendingUp, Users, Building2, BarChart3, FileText } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";

const API = import.meta.env.BASE_URL.replace(/\/$/, "").replace("/pdv", "") + "/api";
function apiHeaders(token: string | null) { return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }; }
function fmt(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

export default function MotoristasFinanceiro() {
  const { token } = useAuth();
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));

  const { data, isLoading } = useQuery({
    queryKey: ["corp-financeiro", mes],
    queryFn: async () => {
      const r = await fetch(`${API}/pdv/corporativo/financeiro?mes=${mes}`, { headers: apiHeaders(token) });
      return r.json();
    },
  });

  const totais = data?.totais ?? {};
  const porCentro: any[] = data?.por_centro_custo ?? [];
  const porFunc: any[] = data?.por_funcionario ?? [];
  const porDia: any[] = data?.por_dia ?? [];
  const maxDia = Math.max(...porDia.map((d: any) => Number(d.total)), 1);

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Financeiro Corporativo</h1>
          <p className="text-sm text-muted-foreground">Gastos e análises por período</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="month" value={mes} onChange={e => setMes(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm" />
          <Link href="/motorista/faturas">
            <button className="flex items-center gap-2 h-9 px-4 rounded-lg border border-border text-sm hover:bg-secondary transition-colors">
              <FileText className="w-4 h-4" /> Faturas
            </button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: DollarSign, label: "Total do mês", value: fmt(Number(totais.total ?? 0)), color: "text-green-500 bg-green-500/10" },
              { icon: BarChart3, label: "Total corridas", value: totais.corridas ?? 0, color: "text-blue-500 bg-blue-500/10" },
              { icon: TrendingUp, label: "Concluídas", value: totais.concluidas ?? 0, color: "text-green-600 bg-green-600/10" },
              { icon: Building2, label: "Centros de custo", value: porCentro.length, color: "text-purple-500 bg-purple-500/10" },
            ].map(c => (
              <div key={c.label} className="bg-card border border-border rounded-xl p-4">
                <div className={`w-9 h-9 rounded-lg ${c.color} flex items-center justify-center mb-3`}>
                  <c.icon className="w-5 h-5" />
                </div>
                <p className="text-2xl font-bold">{c.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
              </div>
            ))}
          </div>

          {/* Gráfico por dia */}
          {porDia.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Gastos por dia
              </h3>
              <div className="space-y-2">
                {porDia.map((d: any) => (
                  <div key={d.dia} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-20 shrink-0">
                      {new Date(d.dia + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </span>
                    <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
                      <div className="bg-primary h-2.5 rounded-full transition-all" style={{ width: `${(Number(d.total) / maxDia) * 100}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-6 text-center">{d.corridas}</span>
                    <span className="text-sm font-medium w-24 text-right">{fmt(Number(d.total))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Por centro de custo */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-500" /> Por Centro de Custo
              </h3>
              {porCentro.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados no período</p>
              ) : (
                <div className="space-y-3">
                  {porCentro.map((c: any) => (
                    <div key={c.centro} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{c.centro ?? "Sem centro"}</p>
                        <p className="text-xs text-muted-foreground">{c.corridas} corrida(s)</p>
                      </div>
                      <p className="font-bold text-sm">{fmt(Number(c.total))}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Por funcionário */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" /> Por Funcionário
              </h3>
              {porFunc.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados no período</p>
              ) : (
                <div className="space-y-3">
                  {porFunc.map((f: any) => (
                    <div key={f.funcionario} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{f.funcionario ?? "Sem vínculo"}</p>
                        <p className="text-xs text-muted-foreground">{f.corridas} corrida(s)</p>
                      </div>
                      <p className="font-bold text-sm">{fmt(Number(f.total))}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
