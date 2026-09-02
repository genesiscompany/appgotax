import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingBag, Wallet,
  Plus, Trash2, Receipt, ShoppingCart, Truck,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import FinanceiroCompras from "./FinanceiroCompras";
import FinanceiroFornecedores from "./FinanceiroFornecedores";

const API = "/api";

const FORMA_LABEL: Record<string, string> = {
  pix: "Pix", dinheiro: "Dinheiro", credito: "Cartão Crédito",
  debito: "Cartão Débito", cartao: "Cartão", fiado: "Fiado", outro: "Outro",
};

const CATEGORIA_RECEITA = ["vendas", "serviço", "outros"];
const CATEGORIA_DESPESA = ["aluguel", "salários", "fornecedor", "marketing", "manutenção", "embalagens", "impostos", "outros"];

const PIE_COLORS = ["#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#3B82F6", "#EC4899", "#14B8A6"];

type Periodo = "hoje" | "semana" | "mes" | "ano";
type Resumo = {
  total_pedidos: number; receita_bruta: number; receita_pedidos: number;
  receitas_manuais: number; despesas: number; receita_liquida: number;
  total_frete: number; ticket_medio: number;
};
type FluxoDia = { dia: string; label: string; receita: number; pedidos: number };
type PagData = { forma: string; total_pedidos: number; valor_total: number };
type Lancamento = {
  id: number; tipo: "receita" | "despesa"; valor: string; descricao: string;
  categoria: string; data: string; observacoes?: string;
};

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const PERIODO_LABELS: Record<Periodo, string> = {
  hoje: "Hoje", semana: "Esta semana", mes: "Este mês", ano: "Este ano",
};

export default function Financeiro() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [fluxo, setFluxo] = useState<FluxoDia[]>([]);
  const [pagamentos, setPagamentos] = useState<PagData[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [tab, setTab] = useState<"visao" | "lancamentos" | "compras" | "fornecedores">("visao");
  const [loadingResumo, setLoadingResumo] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [fTipo, setFTipo] = useState<"receita" | "despesa">("despesa");
  const [fValor, setFValor] = useState("");
  const [fDescricao, setFDescricao] = useState("");
  const [fCategoria, setFCategoria] = useState("outros");
  const [fData, setFData] = useState(new Date().toISOString().slice(0, 10));
  const [fObs, setFObs] = useState("");
  const [salvando, setSalvando] = useState(false);

  const fetchResumo = useCallback(async () => {
    setLoadingResumo(true);
    try {
      const r = await fetch(`${API}/pdv/financeiro/resumo?periodo=${periodo}`, { headers });
      if (r.ok) setResumo(await r.json());
    } catch {}
    setLoadingResumo(false);
  }, [periodo, token]);

  const fetchFluxo = useCallback(async () => {
    try {
      const dias = periodo === "hoje" ? 7 : periodo === "semana" ? 14 : periodo === "ano" ? 90 : 30;
      const r = await fetch(`${API}/pdv/financeiro/fluxo-diario?dias=${dias}`, { headers });
      if (r.ok) setFluxo(await r.json());
    } catch {}
  }, [periodo, token]);

  const fetchPagamentos = useCallback(async () => {
    try {
      const r = await fetch(`${API}/pdv/financeiro/por-pagamento?periodo=${periodo}`, { headers });
      if (r.ok) setPagamentos(await r.json());
    } catch {}
  }, [periodo, token]);

  const fetchLancamentos = useCallback(async () => {
    try {
      const r = await fetch(`${API}/pdv/financeiro/lancamentos`, { headers });
      if (r.ok) setLancamentos(await r.json());
    } catch {}
  }, [token]);

  useEffect(() => {
    fetchResumo();
    fetchFluxo();
    fetchPagamentos();
    fetchLancamentos();
  }, [fetchResumo, fetchFluxo, fetchPagamentos, fetchLancamentos]);

  const salvarLancamento = async () => {
    if (!fValor || !fDescricao) return;
    setSalvando(true);
    try {
      const r = await fetch(`${API}/pdv/financeiro/lancamentos`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: fTipo, valor: Number(fValor.replace(",", ".")), descricao: fDescricao, categoria: fCategoria, data: fData, observacoes: fObs || undefined }),
      });
      if (r.ok) {
        setShowForm(false);
        setFValor(""); setFDescricao(""); setFCategoria("outros"); setFObs("");
        fetchLancamentos(); fetchResumo();
      }
    } catch {}
    setSalvando(false);
  };

  const deletarLancamento = async (id: number) => {
    if (!confirm("Remover este lançamento?")) return;
    await fetch(`${API}/pdv/financeiro/lancamentos/${id}`, { method: "DELETE", headers });
    fetchLancamentos(); fetchResumo();
  };

  const totalReceitas = resumo?.receita_bruta ?? 0;
  const totalDespesas = resumo?.despesas ?? 0;
  const liquida = resumo?.receita_liquida ?? 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" /> Financeiro
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Receitas, despesas e fluxo de caixa</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
            <SelectTrigger className="w-[150px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(PERIODO_LABELS) as [Periodo, string][]).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl flex-wrap">
        {([
          ["visao", "Visão Geral", null],
          ["lancamentos", "Lançamentos", null],
          ["compras", "Compras", ShoppingCart],
          ["fornecedores", "Fornecedores", Truck],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id as any)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {label}
          </button>
        ))}
      </div>

      {tab === "visao" && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Receita Bruta", value: totalReceitas, icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
              { label: "Despesas", value: -totalDespesas, icon: TrendingDown, color: "text-red-500", bg: "bg-red-500/10" },
              { label: "Receita Líquida", value: liquida, icon: Wallet, color: liquida >= 0 ? "text-primary" : "text-red-500", bg: liquida >= 0 ? "bg-primary/10" : "bg-red-500/10" },
              { label: "Ticket Médio", value: resumo?.ticket_medio ?? 0, icon: ShoppingBag, color: "text-amber-500", bg: "bg-amber-500/10", suffix: `${resumo?.total_pedidos ?? 0} pedidos` },
            ].map(({ label, value, icon: Icon, color, bg, suffix }) => (
              <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <Card className="border-border/60">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">{label}</p>
                        {loadingResumo
                          ? <div className="h-6 w-24 bg-secondary animate-pulse rounded mt-1" />
                          : <p className={`text-xl font-bold mt-1 ${color}`}>{fmt(Math.abs(value))}</p>
                        }
                        {suffix && <p className="text-[11px] text-muted-foreground mt-0.5">{suffix}</p>}
                      </div>
                      <div className={`p-2 rounded-lg ${bg}`}>
                        <Icon className={`w-4 h-4 ${color}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Revenue Chart */}
            <Card className="lg:col-span-2 border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-foreground">Receita por Dia</CardTitle>
              </CardHeader>
              <CardContent>
                {fluxo.length === 0 ? (
                  <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">Sem dados no período</div>
                ) : (
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={fluxo} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        interval={Math.floor(fluxo.length / 8)}
                      />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `R$${v}`} />
                      <Tooltip
                        formatter={(v: number) => [fmt(v), "Receita"]}
                        labelFormatter={(l) => `Dia: ${l}`}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      />
                      <Bar dataKey="receita" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Payment Methods Pie */}
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-foreground">Por Forma de Pagamento</CardTitle>
              </CardHeader>
              <CardContent>
                {pagamentos.length === 0 ? (
                  <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
                ) : (
                  <ResponsiveContainer width="100%" height={210}>
                    <PieChart>
                      <Pie data={pagamentos} dataKey="valor_total" nameKey="forma" cx="50%" cy="45%" outerRadius={70} label={false}>
                        {pagamentos.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => [fmt(v), "Valor"]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                      <Legend formatter={(v) => FORMA_LABEL[v] ?? v} iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payment breakdown table */}
          {pagamentos.length > 0 && (
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-foreground">Detalhamento por Pagamento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pagamentos.map((p, i) => {
                    const pct = totalReceitas > 0 ? (p.valor_total / totalReceitas) * 100 : 0;
                    return (
                      <div key={p.forma} className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-sm text-foreground w-32 flex-shrink-0">{FORMA_LABEL[p.forma] ?? p.forma}</span>
                        <div className="flex-1 bg-secondary rounded-full h-2">
                          <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        </div>
                        <span className="text-sm font-medium text-foreground w-24 text-right">{fmt(p.valor_total)}</span>
                        <span className="text-xs text-muted-foreground w-12 text-right">{pct.toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {tab === "compras" && <FinanceiroCompras token={token!} />}
      {tab === "fornecedores" && <FinanceiroFornecedores token={token!} />}

      {tab === "lancamentos" && (
        <>
          {/* Add button */}
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowForm(!showForm)} className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Lançamento
            </Button>
          </div>

          {/* Form */}
          {showForm && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-primary/30 bg-primary/3">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-primary" /> Novo Lançamento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground font-medium mb-1 block">Tipo</label>
                      <Select value={fTipo} onValueChange={(v) => { setFTipo(v as any); setFCategoria("outros"); }}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="receita">
                            <span className="text-emerald-500 font-medium">+ Receita</span>
                          </SelectItem>
                          <SelectItem value="despesa">
                            <span className="text-red-500 font-medium">− Despesa</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground font-medium mb-1 block">Valor (R$)</label>
                      <Input
                        className="h-9 text-sm"
                        placeholder="0,00"
                        value={fValor}
                        onChange={e => setFValor(e.target.value.replace(/[^0-9,.]/g, ""))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground font-medium mb-1 block">Descrição</label>
                      <Input className="h-9 text-sm" placeholder="Ex: Aluguel de maio" value={fDescricao} onChange={e => setFDescricao(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground font-medium mb-1 block">Categoria</label>
                      <Select value={fCategoria} onValueChange={setFCategoria}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(fTipo === "receita" ? CATEGORIA_RECEITA : CATEGORIA_DESPESA).map(c => (
                            <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground font-medium mb-1 block">Data</label>
                      <Input type="date" className="h-9 text-sm" value={fData} onChange={e => setFData(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground font-medium mb-1 block">Observações (opcional)</label>
                      <Input className="h-9 text-sm" placeholder="..." value={fObs} onChange={e => setFObs(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={salvarLancamento} disabled={salvando || !fValor || !fDescricao} className="gap-1">
                      {salvando ? "Salvando..." : "Salvar"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Summary in this month */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Receitas", value: lancamentos.filter(l => l.tipo === "receita").reduce((s, l) => s + Number(l.valor), 0), color: "text-emerald-500" },
              { label: "Despesas", value: lancamentos.filter(l => l.tipo === "despesa").reduce((s, l) => s + Number(l.valor), 0), color: "text-red-500" },
              { label: "Saldo", value: lancamentos.filter(l => l.tipo === "receita").reduce((s, l) => s + Number(l.valor), 0) - lancamentos.filter(l => l.tipo === "despesa").reduce((s, l) => s + Number(l.valor), 0), color: "text-primary" },
            ].map(({ label, value, color }) => (
              <Card key={label} className="border-border/60">
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={`text-base font-bold ${color}`}>{fmt(value)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Lancamentos list */}
          <Card className="border-border/60">
            <CardContent className="p-0">
              {lancamentos.length === 0 ? (
                <div className="py-12 text-center">
                  <Receipt className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhum lançamento este mês</p>
                  <p className="text-xs text-muted-foreground mt-1">Adicione despesas e receitas extras manualmente</p>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {lancamentos.map(l => (
                    <div key={l.id} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors">
                      <div className={`w-2 h-8 rounded-full flex-shrink-0 ${l.tipo === "receita" ? "bg-emerald-500" : "bg-red-500"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{l.descricao}</p>
                        <p className="text-xs text-muted-foreground">{l.categoria} · {new Date(l.data + "T12:00:00").toLocaleDateString("pt-BR")}</p>
                      </div>
                      <p className={`text-sm font-bold flex-shrink-0 ${l.tipo === "receita" ? "text-emerald-500" : "text-red-500"}`}>
                        {l.tipo === "receita" ? "+" : "−"}{fmt(Number(l.valor))}
                      </p>
                      <button onClick={() => deletarLancamento(l.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
