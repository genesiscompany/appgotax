import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Car, Users, DollarSign, Clock, TrendingUp, AlertCircle, CheckCircle, MapPin } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { ReferralShareCard } from "@/components/ReferralShareCard";

const API = import.meta.env.BASE_URL.replace(/\/$/, "").replace("/pdv", "") + "/api";

function apiHeaders(token: string | null) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function MotoristasDashboard() {
  const { token } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["corp-dashboard"],
    queryFn: async () => {
      const r = await fetch(`${API}/pdv/corporativo/dashboard`, { headers: apiHeaders(token) });
      return r.json();
    },
    refetchInterval: 30000,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const corridas = data?.corridas ?? {};
  const grafico = data?.grafico_semana ?? [];

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">GoTaxi Pro</h1>
        <p className="text-sm text-muted-foreground mt-1">Mobilidade Corporativa — painel de gestão</p>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Car className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-sm text-muted-foreground">Corridas este mês</span>
          </div>
          <p className="text-2xl font-bold">{corridas.total ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-1">{corridas.concluidas ?? 0} concluídas</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-500" />
            </div>
            <span className="text-sm text-muted-foreground">Gasto no mês</span>
          </div>
          <p className="text-2xl font-bold">{fmt(data?.gasto_mes ?? 0)}</p>
          <p className="text-xs text-muted-foreground mt-1">Hoje: {fmt(data?.gasto_hoje ?? 0)}</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <span className="text-sm text-muted-foreground">Aguard. aprovação</span>
          </div>
          <p className="text-2xl font-bold">{data?.pendentes_aprovacao ?? 0}</p>
          {(data?.pendentes_aprovacao ?? 0) > 0 && (
            <Link href="/motorista/aprovacoes">
              <span className="text-xs text-amber-500 font-medium cursor-pointer hover:underline">Ver agora →</span>
            </Link>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-500" />
            </div>
            <span className="text-sm text-muted-foreground">Funcionários</span>
          </div>
          <p className="text-2xl font-bold">{data?.funcionarios ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-1">{data?.centros_custo ?? 0} centros de custo</p>
        </div>
      </div>

      {/* Card de compartilhamento (afiliado) */}
      <ReferralShareCard />

      {/* Alerta pendentes */}
      {(data?.pendentes_aprovacao ?? 0) > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-600">{data.pendentes_aprovacao} corrida(s) aguardando sua aprovação</p>
            <p className="text-xs text-amber-500/80">Aprovar rapidamente garante menor tempo de espera para o funcionário</p>
          </div>
          <Link href="/motorista/aprovacoes">
            <button className="px-4 py-1.5 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors">
              Aprovar
            </button>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico semana */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">Corridas — últimos 7 dias</h3>
          </div>
          {grafico.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              Nenhuma corrida esta semana
            </div>
          ) : (
            <div className="space-y-2">
              {grafico.map((g: any) => (
                <div key={g.dia} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20 shrink-0">
                    {new Date(g.dia + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                  </span>
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div className="bg-primary h-2 rounded-full" style={{ width: `${Math.min(100, (g.qtd / Math.max(...grafico.map((x: any) => x.qtd))) * 100)}%` }} />
                  </div>
                  <span className="text-xs font-medium w-8 text-right">{g.qtd}</span>
                  <span className="text-xs text-muted-foreground w-20 text-right">{fmt(Number(g.valor))}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Atalhos rápidos */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Ações rápidas</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: "/motorista/nova-corrida", icon: Car, label: "Solicitar corrida", color: "bg-blue-500/10 text-blue-500" },
              { href: "/motorista/aprovacoes", icon: CheckCircle, label: "Aprovações", color: "bg-amber-500/10 text-amber-500" },
              { href: "/motorista/historico", icon: Clock, label: "Histórico", color: "bg-green-500/10 text-green-500" },
              { href: "/motorista/financeiro", icon: DollarSign, label: "Financeiro", color: "bg-purple-500/10 text-purple-500" },
              { href: "/motorista/rastreamento", icon: MapPin, label: "Rastreamento", color: "bg-red-500/10 text-red-500" },
              { href: "/motorista/config", icon: Users, label: "Funcionários", color: "bg-slate-500/10 text-slate-500" },
            ].map(item => (
              <Link key={item.href} href={item.href}>
                <div className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-secondary transition-colors cursor-pointer">
                  <div className={`w-8 h-8 rounded-lg ${item.color} flex items-center justify-center`}>
                    <item.icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Status corridas */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-4">Status das corridas este mês</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Concluídas", value: corridas.concluidas ?? 0, color: "text-green-500" },
            { label: "Em andamento", value: corridas.em_andamento ?? 0, color: "text-blue-500" },
            { label: "Aguard. aprovação", value: corridas.aguardando ?? 0, color: "text-amber-500" },
            { label: "Total", value: corridas.total ?? 0, color: "text-foreground" },
          ].map(s => (
            <div key={s.label} className="text-center p-3 bg-muted/40 rounded-lg">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
