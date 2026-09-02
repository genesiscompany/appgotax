import React, { useEffect, useState } from "react";
import { useAuth, API, authHeaders } from "@/lib/auth";

type Stats = {
  empresas_ativas: string; total_empresas: string;
  total_usuarios: string; total_parceiros: string;
  total_pedidos: string; pedidos_entregues: string;
  receita_total: string; produtos_ativos: string;
  comissao_afiliados: string; afiliados_ativos: string;
};

function StatCard({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub?: string;
  color: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-sm font-medium text-foreground/70 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/stats`, { headers: authHeaders(token) })
      .then(r => r.json()).then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-muted-foreground gap-3">
      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      Carregando métricas...
    </div>
  );

  const cards = [
    {
      label: "Empresas ativas", value: stats?.empresas_ativas ?? 0,
      sub: `${stats?.total_empresas ?? 0} total`, color: "bg-blue-500/10 text-blue-400",
      icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>,
    },
    {
      label: "Usuários cadastrados", value: stats?.total_usuarios ?? 0,
      sub: `${stats?.total_parceiros ?? 0} parceiros`, color: "bg-violet-500/10 text-violet-400",
      icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    },
    {
      label: "Pedidos totais", value: stats?.total_pedidos ?? 0,
      sub: `${stats?.pedidos_entregues ?? 0} entregues`, color: "bg-green-500/10 text-green-400",
      icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
    },
    {
      label: "Receita da plataforma", value: `R$ ${Number(stats?.receita_total ?? 0).toFixed(2)}`,
      sub: "Pedidos entregues", color: "bg-yellow-500/10 text-yellow-400",
      icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    },
    {
      label: "Produtos ativos", value: stats?.produtos_ativos ?? 0,
      sub: "No catálogo PDV", color: "bg-orange-500/10 text-orange-400",
      icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
    },
    {
      label: "Comissão de afiliados", value: `R$ ${Number(stats?.comissao_afiliados ?? 0).toFixed(2)}`,
      sub: `${stats?.afiliados_ativos ?? 0} afiliados ativos`, color: "bg-pink-500/10 text-pink-400",
      icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>,
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral da plataforma GoTaxi em tempo real.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(c => <StatCard key={c.label} {...c} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Status da plataforma
          </h3>
          <div className="space-y-3">
            {[
              { label: "API Server", status: "Operacional", color: "text-green-400" },
              { label: "Banco de dados", status: "Operacional", color: "text-green-400" },
              { label: "PDV Web", status: "Operacional", color: "text-green-400" },
              { label: "App Cliente", status: "Operacional", color: "text-green-400" },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <span className="text-sm text-foreground/80">{s.label}</span>
                <span className={`text-xs font-semibold ${s.color}`}>{s.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-semibold text-foreground mb-4">Módulos disponíveis</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { nome: "Food/PDV", cor: "#C36EF0", ativo: true },
              { nome: "App Motoristas", cor: "#FF6B35", ativo: true },
              { nome: "E-commerce", cor: "#4ECDC4", ativo: true },
              { nome: "Serviços", cor: "#45B7D1", ativo: true },
              { nome: "Passagens", cor: "#68D391", ativo: true },
              { nome: "Entrega", cor: "#F0A500", ativo: true },
            ].map(m => (
              <div key={m.nome} className="flex items-center gap-2.5 p-2.5 bg-secondary/50 rounded-lg">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: m.cor }} />
                <span className="text-xs font-medium text-foreground/80">{m.nome}</span>
                <span className="ml-auto text-[10px] text-green-400 font-semibold">ON</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
