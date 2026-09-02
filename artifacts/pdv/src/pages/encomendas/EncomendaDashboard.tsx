import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Package, PackageCheck, PackageX, Truck, TrendingUp, Plus, Search, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { ReferralShareCard } from "@/components/ReferralShareCard";

const BASE = "/api";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-yellow-100 text-yellow-800" },
  coletado: { label: "Coletado", color: "bg-blue-100 text-blue-800" },
  em_transporte: { label: "Em Transporte", color: "bg-indigo-100 text-indigo-800" },
  saiu_entrega: { label: "Saiu p/ Entrega", color: "bg-purple-100 text-purple-800" },
  entregue: { label: "Entregue", color: "bg-green-100 text-green-800" },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-800" },
};

function fmtR(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

export default function EncomendaDashboard() {
  const { token } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["enc-dashboard"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/pdv/encomendas/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
    refetchInterval: 30000,
  });

  const stats = [
    { label: "Hoje", value: data?.hoje ?? 0, icon: Package, color: "text-blue-500", bg: "bg-blue-50" },
    { label: "Em Transporte", value: data?.em_transporte ?? 0, icon: Truck, color: "text-indigo-500", bg: "bg-indigo-50" },
    { label: "Entregues Hoje", value: data?.entregues_hoje ?? 0, icon: PackageCheck, color: "text-green-500", bg: "bg-green-50" },
    { label: "Pendentes", value: data?.pendentes ?? 0, icon: Clock, color: "text-yellow-500", bg: "bg-yellow-50" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">📦 Encomendas</h1>
          <p className="text-muted-foreground text-sm">Painel de envios e rastreamento</p>
        </div>
        <div className="flex gap-2">
          <Link href="/encomendas/rastreamento">
            <Button variant="outline" size="sm"><Search className="w-4 h-4 mr-1" />Rastrear</Button>
          </Link>
          <Link href="/encomendas/nova">
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white"><Plus className="w-4 h-4 mr-1" />Nova Encomenda</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.bg}`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{isLoading ? "…" : s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ReferralShareCard />

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-orange-50">
              <TrendingUp className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{isLoading ? "…" : fmtR(data?.faturamento_semana ?? 0)}</p>
              <p className="text-xs text-muted-foreground">Faturamento esta semana (encomendas entregues)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Últimas Encomendas</CardTitle></CardHeader>
        <CardContent>
          {isLoading && <div className="text-center py-8 text-muted-foreground">Carregando…</div>}
          {!isLoading && (!data?.recentes?.length) && (
            <div className="text-center py-8 text-muted-foreground">Nenhuma encomenda ainda.<br />
              <Link href="/encomendas/nova"><span className="text-orange-500 underline cursor-pointer">Cadastrar primeira</span></Link>
            </div>
          )}
          {!isLoading && data?.recentes?.length > 0 && (
            <div className="space-y-2">
              {data.recentes.map((e: any) => {
                const st = STATUS_LABEL[e.status] ?? { label: e.status, color: "bg-gray-100 text-gray-600" };
                return (
                  <div key={e.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium text-sm">{e.codigo} — {e.cliente_nome || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">→ {e.destino_cidade || "Destino não informado"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{fmtR(Number(e.valor_frete))}</span>
                      <Badge className={`${st.color} border-0 text-xs`}>{st.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: "/encomendas/nova", icon: "➕", label: "Nova Encomenda" },
          { href: "/encomendas/rastreamento", icon: "🔍", label: "Rastrear" },
          { href: "/encomendas/saidas", icon: "🚚", label: "Saídas/Entregas" },
          { href: "/encomendas/clientes", icon: "👥", label: "Clientes" },
          { href: "/encomendas/recebimentos", icon: "📥", label: "Recebimentos" },
          { href: "/encomendas/financeiro", icon: "💰", label: "Financeiro" },
          { href: "/encomendas/relatorios", icon: "📊", label: "Relatórios" },
          { href: "/encomendas/config", icon: "⚙️", label: "Configurações" },
        ].map(l => (
          <Link key={l.href} href={l.href}>
            <div className="p-4 rounded-xl border hover:bg-accent cursor-pointer text-center transition-colors">
              <p className="text-2xl">{l.icon}</p>
              <p className="text-xs font-medium mt-1">{l.label}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
