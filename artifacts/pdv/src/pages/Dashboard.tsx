import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, LineChart, Line, Legend, Cell
} from "recharts";
import { TrendingUp, ShoppingBag, Receipt, AlertCircle, Eye, MousePointerClick, Landmark, CheckCircle2, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { ReferralShareCard } from "@/components/ReferralShareCard";

type DashboardStats = {
  vendas_hoje: number;
  vendas_ontem: number;
  pedidos_hoje: number;
  pedidos_ontem: number;
  ticket_medio: number;
  em_aberto: number;
};

function useDashboardStats(token: string | null) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const load = () => {
      fetch("/api/pdv/dashboard-stats", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (!cancelled && d) setStats(d); })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 60_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { cancelled = true; clearInterval(id); window.removeEventListener("focus", onFocus); };
  }, [token]);
  return stats;
}

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function useComissaoSemana(token: string | null) {
  const [data, setData] = useState<{
    receita: number; comissao: number; taxa: number;
    status: string; semanaInicio: string; semanaFim: string;
  } | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch("/api/pdv/repasse-status", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        const rep = d.repasse_semana_atual ?? d.repasse;
        if (rep) setData({
          receita: Number(rep.receita_total ?? 0),
          comissao: Number(rep.valor_repasse ?? 0),
          taxa: Number(rep.taxa_percentual ?? d.config?.taxa_repasse ?? 3),
          status: rep.status,
          semanaInicio: rep.semana_inicio,
          semanaFim: rep.semana_fim,
        });
      }).catch(() => {});
  }, [token]);
  return data;
}

const salesData = [
  { day: "Seg", value: 620 },
  { day: "Ter", value: 480 },
  { day: "Qua", value: 890 },
  { day: "Qui", value: 760 },
  { day: "Sex", value: 1200 },
  { day: "Sáb", value: 1650 },
  { day: "Dom", value: 1100 },
];

const productData = [
  { name: "Pizza Margherita", vendas: 47, fill: "hsl(var(--chart-1))" },
  { name: "Coca-Cola 350ml", vendas: 38, fill: "hsl(var(--chart-2))" },
  { name: "Pizza Calabresa", vendas: 35, fill: "hsl(var(--chart-3))" },
  { name: "Esfiha de Carne", vendas: 29, fill: "hsl(var(--chart-4))" },
  { name: "Batata Frita", vendas: 22, fill: "hsl(var(--chart-5))" },
];

const forecastData = [
  { day: "01/05", realizado: 800, projecao: 850 },
  { day: "02/05", realizado: 950, projecao: 900 },
  { day: "03/05", realizado: null, projecao: 1100 },
  { day: "04/05", realizado: null, projecao: 1300 },
  { day: "05/05", realizado: null, projecao: 1800 },
  { day: "06/05", realizado: null, projecao: 1700 },
  { day: "07/05", realizado: null, projecao: 900 },
];

export default function Dashboard() {
  const { isFeatured, setIsFeatured } = useAppStore();
  const { token, user } = useAuth();
  const comissao = useComissaoSemana(token);
  const stats = useDashboardStats(token);
  const vendasHoje = stats?.vendas_hoje ?? 0;
  const pedidosHoje = stats?.pedidos_hoje ?? 0;
  const ticketMedio = stats?.ticket_medio ?? 0;
  const emAberto = stats?.em_aberto ?? 0;
  const vendasOntem = stats?.vendas_ontem ?? 0;
  const pedidosOntem = stats?.pedidos_ontem ?? 0;
  const deltaVendasPct = vendasOntem > 0 ? Math.round(((vendasHoje - vendasOntem) / vendasOntem) * 100) : null;
  const deltaPedidos = pedidosHoje - pedidosOntem;
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-7xl mx-auto"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Visão Geral</h1>
          <p className="text-muted-foreground mt-1">Bem-vindo de volta! Aqui está o resumo do seu negócio hoje.</p>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border-border/50">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Vendas Hoje</p>
                <p className="text-3xl font-bold font-display text-foreground">{fmtBRL(vendasHoje)}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-sm">
              {deltaVendasPct !== null ? (
                <>
                  <span className={`flex items-center font-medium ${deltaVendasPct >= 0 ? "text-primary" : "text-red-500"}`}>
                    <TrendingUp className="w-3.5 h-3.5 mr-1" /> {deltaVendasPct >= 0 ? "+" : ""}{deltaVendasPct}%
                  </span>
                  <span className="text-muted-foreground">vs ontem</span>
                </>
              ) : (
                <span className="text-muted-foreground">Sem vendas ontem</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Pedidos Hoje</p>
                <p className="text-3xl font-bold font-display text-foreground">{pedidosHoje}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <ShoppingBag className="w-5 h-5 text-blue-500" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-sm">
              {pedidosOntem > 0 || pedidosHoje > 0 ? (
                <>
                  <span className={`flex items-center font-medium ${deltaPedidos >= 0 ? "text-primary" : "text-red-500"}`}>
                    <TrendingUp className="w-3.5 h-3.5 mr-1" /> {deltaPedidos >= 0 ? "+" : ""}{deltaPedidos}
                  </span>
                  <span className="text-muted-foreground">vs ontem</span>
                </>
              ) : (
                <span className="text-muted-foreground">Sem pedidos ainda</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Ticket Médio</p>
                <p className="text-3xl font-bold font-display text-foreground">{fmtBRL(ticketMedio)}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-purple-500" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground">
              {pedidosHoje > 0 ? `Calculado de ${pedidosHoje} pedido${pedidosHoje > 1 ? "s" : ""} hoje` : "Sem pedidos hoje"}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50 bg-amber-50/50 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-900/50">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-500">Em Aberto</p>
                <p className="text-3xl font-bold font-display text-amber-600 dark:text-amber-400">{emAberto}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-sm">
              <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 font-semibold uppercase tracking-wider text-[10px]">Atenção</Badge>
              <span className="text-amber-700/80 dark:text-amber-500/80">Pedidos aguardando prep.</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Card de compartilhamento (afiliado) */}
      <ReferralShareCard />

      {/* Comissão GoTaxi */}
      {comissao && (
        <Card className={`border ${comissao.status === "bloqueado" ? "border-red-500/40 bg-red-500/5" : comissao.status === "pago" ? "border-green-500/30 bg-green-500/5" : "border-amber-500/30 bg-amber-500/5"} shadow-sm`}>
          <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${comissao.status === "bloqueado" ? "bg-red-500/15" : comissao.status === "pago" ? "bg-green-500/15" : "bg-amber-500/15"}`}>
              <Landmark className={`w-5 h-5 ${comissao.status === "bloqueado" ? "text-red-400" : comissao.status === "pago" ? "text-green-400" : "text-amber-500"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-foreground">Comissão GoTaxi — Semana Atual</p>
                {comissao.status === "pago" && <Badge className="bg-green-500/15 text-green-400 border-green-500/20 border text-[10px] font-semibold uppercase tracking-wider">Pago</Badge>}
                {comissao.status === "pendente" && <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/20 border text-[10px] font-semibold uppercase tracking-wider">Pendente</Badge>}
                {comissao.status === "bloqueado" && <Badge className="bg-red-500/15 text-red-400 border-red-500/20 border text-[10px] font-semibold uppercase tracking-wider">Em Atraso</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(comissao.semanaInicio + "T00:00:00").toLocaleDateString("pt-BR")} – {new Date(comissao.semanaFim + "T00:00:00").toLocaleDateString("pt-BR")} &bull; Receita: R$ {comissao.receita.toFixed(2)} &bull; Taxa: {comissao.taxa}%
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">A repassar</p>
                <p className={`text-xl font-bold ${comissao.status === "bloqueado" ? "text-red-400" : comissao.status === "pago" ? "text-green-400" : "text-amber-500"}`}>R$ {comissao.comissao.toFixed(2)}</p>
              </div>
              {comissao.status === "pago" ? (
                <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
              ) : (
                <Clock className="w-5 h-5 text-amber-500/70 shrink-0" />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Destaque Banner */}
      <Card className="overflow-hidden border-primary/20 shadow-md shadow-primary/5 bg-gradient-to-r from-card to-primary/[0.03]">
        <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex-1 space-y-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-xl font-display font-bold text-foreground">Visibilidade no App GoTaxi</h3>
                {isFeatured ? (
                  <Badge className="bg-primary hover:bg-primary text-primary-foreground font-semibold">Ativo — Em Destaque</Badge>
                ) : (
                  <Badge variant="secondary" className="font-semibold">Pausado</Badge>
                )}
              </div>
              <p className="text-muted-foreground text-sm max-w-xl">
                Ligue o destaque para aparecer no topo do aplicativo cliente. Parceiros em destaque recebem em média <strong className="text-foreground">3x mais pedidos</strong>.
              </p>
            </div>
            
            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                  <Eye className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Visualizações</p>
                  <p className="text-lg font-bold text-foreground leading-none mt-0.5">1.240</p>
                </div>
              </div>
              <div className="w-px h-10 bg-border"></div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                  <MousePointerClick className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Cliques (Mês)</p>
                  <p className="text-lg font-bold text-foreground leading-none mt-0.5">86</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm flex flex-col items-center gap-3 min-w-[240px]">
            <Switch 
              checked={isFeatured} 
              onCheckedChange={setIsFeatured} 
              className="data-[state=checked]:bg-primary scale-125 my-2" 
            />
            <p className="text-sm font-medium text-center">
              {isFeatured ? "Visível para clientes" : "Oculto dos destaques"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-border/50">
          <CardHeader>
            <CardTitle>Volume de Vendas</CardTitle>
            <CardDescription>Faturamento dos últimos 7 dias (R$)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: 'var(--shadow-md)' }}
                    itemStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                    formatter={(value) => [`R$ ${value}`, "Vendas"]}
                  />
                  <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50">
          <CardHeader>
            <CardTitle>Produtos Mais Vendidos</CardTitle>
            <CardDescription>Top 5 produtos na semana atual</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productData} layout="vertical" margin={{ top: 10, right: 10, left: 40, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--foreground))', fontWeight: 500 }} dx={-10} width={120} />
                  <RechartsTooltip 
                    cursor={{fill: 'hsl(var(--muted)/0.4)'}}
                    contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: 'var(--shadow-md)' }}
                  />
                  <Bar dataKey="vendas" radius={[0, 4, 4, 0]} barSize={32}>
                    {
                      productData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))
                    }
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Estimates Row */}
      <Card className="shadow-sm border-border/50">
        <CardHeader>
          <CardTitle>Previsão da Semana</CardTitle>
          <CardDescription>Acompanhamento do realizado vs projeção baseada no histórico</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecastData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: 'var(--shadow-md)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Line 
                  name="Realizado" 
                  type="monotone" 
                  dataKey="realizado" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3} 
                  dot={{ r: 4, strokeWidth: 2 }} 
                  activeDot={{ r: 6 }} 
                  connectNulls
                />
                <Line 
                  name="Projeção" 
                  type="monotone" 
                  dataKey="projecao" 
                  stroke="hsl(var(--muted-foreground))" 
                  strokeWidth={2} 
                  strokeDasharray="5 5" 
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
