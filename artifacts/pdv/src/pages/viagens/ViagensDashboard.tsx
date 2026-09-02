import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import { ShoppingCart, DollarSign, Users, Clock, MapPin, ArrowRight, Plane, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ReferralShareCard } from "@/components/ReferralShareCard";

const API = "/api/pdv/viagens";
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtHora = (h: string) => h ? h.slice(0, 5) : "—";

const STATUS_STYLE: Record<string, string> = {
  confirmado: "bg-green-500/15 text-green-400 border-green-500/20",
  pendente:   "bg-amber-500/15 text-amber-400 border-amber-500/20",
  cancelado:  "bg-red-500/15 text-red-400 border-red-500/20",
};

type Passagem = {
  id: number;
  cliente_nome: string;
  destino: string;
  valor: number;
  hora_partida: string;
  status: string;
  vendido_em: string;
};

type Stats = {
  vendas_hoje: number;
  faturamento_hoje: number;
  clientes_hoje: number;
  pendentes: number;
  recentes: Passagem[];
};

function StatCard({ icon: Icon, color, label, value, sub }: {
  icon: React.ElementType; color: string; label: string; value: string | number; sub?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex items-start gap-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: color + "20" }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-2xl font-bold text-foreground mt-0.5 leading-none">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export default function ViagensDashboard() {
  const { token, user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const now = new Date();

  const load = () => {
    setLoading(true);
    fetch(`${API}/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(load, [token]);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard — Tur Viagens</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-xl border border-border hover:bg-secondary">
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Atualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ShoppingCart} color="#3B82F6" label="Vendas Hoje" value={loading ? "—" : stats?.vendas_hoje ?? 0} sub="passagens emitidas" />
        <StatCard icon={DollarSign} color="#22C55E" label="Faturamento" value={loading ? "—" : fmt(stats?.faturamento_hoje ?? 0)} sub="hoje" />
        <StatCard icon={Users} color="#8B5CF6" label="Clientes" value={loading ? "—" : stats?.clientes_hoje ?? 0} sub="atendidos hoje" />
        <StatCard icon={Clock} color="#F97316" label="Pendentes" value={loading ? "—" : stats?.pendentes ?? 0} sub="aguardando pagamento" />
      </div>

      {/* Card de compartilhamento (afiliado) */}
      <ReferralShareCard />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ações Rápidas */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações Rápidas</h2>
          {[
            { href: "/viagens/nova-venda", icon: ShoppingCart, color: "#3B82F6", label: "Nova Venda", sub: "Iniciar atendimento" },
            { href: "/viagens/clientes", icon: Users, color: "#8B5CF6", label: "Cadastrar Cliente", sub: "Novo passageiro" },
            { href: "/viagens/rotas", icon: Plane, color: "#22C55E", label: "Consultar Rotas", sub: "Horários e disponibilidade" },
          ].map(item => (
            <Link key={item.href} href={item.href}>
              <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-2xl hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer group">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: item.color + "20" }}>
                  <item.icon className="w-5 h-5" style={{ color: item.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.sub}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </div>
            </Link>
          ))}
        </div>

        {/* Vendas Recentes */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Passagens Recentes</h2>
            <Link href="/viagens/vendas">
              <span className="text-xs text-primary hover:underline cursor-pointer">Ver Todas</span>
            </Link>
          </div>

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground gap-2 text-sm">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Carregando...
              </div>
            ) : !stats?.recentes?.length ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                <Plane className="w-8 h-8 opacity-30" />
                <p className="text-sm">Nenhuma passagem vendida ainda</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">ID</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Cliente</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Destino</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Valor</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Partida</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentes.map((p, i) => (
                      <tr key={p.id} className={cn("border-b border-border/30 last:border-0", i % 2 === 0 ? "" : "bg-secondary/20")}>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">V-{String(p.id).padStart(3,"0")}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{p.cliente_nome ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-primary shrink-0" />
                            {p.destino ?? "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-foreground">{fmt(Number(p.valor))}</td>
                        <td className="px-4 py-3 text-muted-foreground">{fmtHora(p.hora_partida)}</td>
                        <td className="px-4 py-3">
                          <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full border capitalize", STATUS_STYLE[p.status] ?? "bg-muted text-muted-foreground border-border")}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
