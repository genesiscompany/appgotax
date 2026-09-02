import React, { useState, useEffect, useCallback } from "react";
import { ShoppingCart, Plus, Trash2, X, Package, ChevronRight, Calendar, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";

const API = "/api";

const UNIDADES = ["un", "kg", "g", "L", "mL", "cx", "pct", "fardo", "saco", "dz", "m²"];

const PRODUTO_SUGESTOES = [
  "Mussarela", "Farinha de trigo", "Calabresa", "Temperos mistos",
  "Bacon", "Catupiri", "Presunto", "Tomate", "Cebola", "Alho",
  "Óleo de soja", "Açúcar", "Sal", "Manteiga", "Creme de leite",
  "Leite integral", "Ovos", "Frango", "Carne moída", "Pão de hambúrguer",
  "Refrigerante", "Água mineral", "Cerveja", "Embalagens", "Sacolas",
  "Queijo prato", "Requeijão", "Orégano", "Pimenta do reino",
];

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(d: string) {
  const dt = new Date(d + "T12:00:00");
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type Fornecedor = { id: number; nome: string; categoria: string };
type Item = { produto: string; quantidade: string; unidade: string; valor_unitario: string };
type Compra = {
  id: number;
  fornecedor_nome: string;
  data_compra: string;
  total: string;
  status: string;
  observacoes?: string;
  itens_count?: number;
};
type CompraDetalhe = Compra & {
  itens: { id: number; produto: string; quantidade: string; unidade: string; valor_unitario: string; subtotal: string }[];
};

const BLANK_ITEM: Item = { produto: "", quantidade: "1", unidade: "un", valor_unitario: "" };

const STATUS_STYLE: Record<string, string> = {
  pago: "bg-emerald-100 text-emerald-700",
  pendente: "bg-amber-100 text-amber-700",
  cancelado: "bg-gray-100 text-gray-500",
};

export default function FinanceiroCompras({ token }: { token: string }) {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const authHeader = { Authorization: `Bearer ${token}` };

  const [compras, setCompras] = useState<Compra[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [expandido, setExpandido] = useState<number | null>(null);
  const [detalhe, setDetalhe] = useState<Record<number, CompraDetalhe>>({});

  // Form state
  const [fFornecedorId, setFFornecedorId] = useState<string>("");
  const [fFornecedorNome, setFFornecedorNome] = useState("");
  const [fData, setFData] = useState(new Date().toISOString().slice(0, 10));
  const [fStatus, setFStatus] = useState("pago");
  const [fObs, setFObs] = useState("");
  const [fItens, setFItens] = useState<Item[]>([{ ...BLANK_ITEM }]);
  const [salvando, setSalvando] = useState(false);
  const [filtroMes, setFiltroMes] = useState(new Date().toISOString().slice(0, 7));

  const fetchCompras = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/pdv/financeiro/compras?mes=${filtroMes}`, { headers: authHeader });
      if (r.ok) setCompras(await r.json());
    } catch {}
    setLoading(false);
  }, [token, filtroMes]);

  const fetchFornecedores = useCallback(async () => {
    try {
      const r = await fetch(`${API}/pdv/financeiro/fornecedores`, { headers: authHeader });
      if (r.ok) setFornecedores(await r.json());
    } catch {}
  }, [token]);

  useEffect(() => { fetchCompras(); fetchFornecedores(); }, [fetchCompras, fetchFornecedores]);

  const calcSubtotal = (item: Item) => {
    const qty = parseFloat(item.quantidade.replace(",", ".")) || 0;
    const preco = parseFloat(item.valor_unitario.replace(",", ".")) || 0;
    return qty * preco;
  };
  const totalGeral = fItens.reduce((s, i) => s + calcSubtotal(i), 0);

  const addItem = () => setFItens(p => [...p, { ...BLANK_ITEM }]);
  const removeItem = (idx: number) => setFItens(p => p.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof Item, val: string) =>
    setFItens(p => p.map((it, i) => i === idx ? { ...it, [field]: val } : it));

  const abrirModal = () => {
    setFFornecedorId(""); setFFornecedorNome(""); setFData(new Date().toISOString().slice(0, 10));
    setFStatus("pago"); setFObs(""); setFItens([{ ...BLANK_ITEM }]); setShowModal(true);
  };

  const salvar = async () => {
    const itensValidos = fItens.filter(i => i.produto.trim() && (parseFloat(i.valor_unitario.replace(",", ".")) || 0) > 0);
    if (!itensValidos.length || (!fFornecedorId && !fFornecedorNome.trim())) return;
    setSalvando(true);
    try {
      const payload = {
        fornecedor_id: fFornecedorId ? Number(fFornecedorId) : null,
        fornecedor_nome: fFornecedorNome.trim() || fornecedores.find(f => String(f.id) === fFornecedorId)?.nome || "",
        data_compra: fData,
        status: fStatus,
        observacoes: fObs.trim() || null,
        itens: itensValidos.map(i => ({
          produto: i.produto.trim(),
          quantidade: parseFloat(i.quantidade.replace(",", ".")) || 1,
          unidade: i.unidade,
          valor_unitario: parseFloat(i.valor_unitario.replace(",", ".")) || 0,
          subtotal: calcSubtotal(i),
        })),
        total: itensValidos.reduce((s, i) => s + calcSubtotal(i), 0),
      };
      const r = await fetch(`${API}/pdv/financeiro/compras`, { method: "POST", headers, body: JSON.stringify(payload) });
      if (r.ok) { setShowModal(false); fetchCompras(); }
    } catch {}
    setSalvando(false);
  };

  const deletar = async (id: number) => {
    if (!confirm("Remover esta compra?")) return;
    await fetch(`${API}/pdv/financeiro/compras/${id}`, { method: "DELETE", headers: authHeader });
    fetchCompras();
  };

  const toggleDetalhe = async (compra: Compra) => {
    if (expandido === compra.id) { setExpandido(null); return; }
    setExpandido(compra.id);
    if (!detalhe[compra.id]) {
      try {
        const r = await fetch(`${API}/pdv/financeiro/compras/${compra.id}`, { headers: authHeader });
        if (r.ok) {
          const data = await r.json();
          setDetalhe(d => ({ ...d, [compra.id]: data }));
        }
      } catch {}
    }
  };

  const totalMes = compras.filter(c => c.status !== "cancelado").reduce((s, c) => s + Number(c.total), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-primary" /> Compras
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Registre compras de fornecedores — lançamento automático no financeiro</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            className="h-9 px-3 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            value={filtroMes}
            onChange={e => setFiltroMes(e.target.value)}
          />
          <Button size="sm" onClick={abrirModal} className="gap-1.5">
            <Plus className="w-4 h-4" /> Nova Compra
          </Button>
        </div>
      </div>

      {/* Resumo do mês */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border/60">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Total do mês</p>
            <p className="text-base font-bold text-red-500">{fmt(totalMes)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Compras</p>
            <p className="text-base font-bold text-foreground">{compras.filter(c => c.status !== "cancelado").length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Pendentes</p>
            <p className="text-base font-bold text-amber-500">{compras.filter(c => c.status === "pendente").length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de compras */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-10 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : compras.length === 0 ? (
            <div className="py-12 text-center">
              <ShoppingCart className="w-10 h-10 text-muted-foreground/25 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma compra registrada neste mês</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {compras.map(c => (
                <div key={c.id}>
                  <button
                    onClick={() => toggleDetalhe(c)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <ShoppingCart className="w-4 h-4 text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{c.fornecedor_nome || "Fornecedor avulso"}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />{fmtDate(c.data_compra)}
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_STYLE[c.status] ?? STATUS_STYLE.pago}`}>
                          {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-red-500 flex-shrink-0">{fmt(Number(c.total))}</p>
                    <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform flex-shrink-0 ${expandido === c.id ? "rotate-90" : ""}`} />
                  </button>
                  <AnimatePresence>
                    {expandido === c.id && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                        <div className="px-4 pb-3 bg-secondary/20">
                          {detalhe[c.id] ? (
                            <div className="space-y-1.5 pt-2">
                              <div className="grid grid-cols-[1fr_auto_auto_auto] text-[10px] text-muted-foreground font-semibold uppercase tracking-wide px-1 mb-1">
                                <span>Produto</span><span className="text-right pr-3">Qtd</span><span className="text-right pr-3">Unitário</span><span className="text-right">Subtotal</span>
                              </div>
                              {detalhe[c.id].itens.map(item => (
                                <div key={item.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-1 bg-background rounded-lg px-3 py-2 text-sm">
                                  <span className="font-medium text-foreground truncate">{item.produto}</span>
                                  <span className="text-muted-foreground text-right pr-3">{Number(item.quantidade).toLocaleString("pt-BR")} {item.unidade}</span>
                                  <span className="text-muted-foreground text-right pr-3">{fmt(Number(item.valor_unitario))}</span>
                                  <span className="font-semibold text-foreground text-right">{fmt(Number(item.subtotal))}</span>
                                </div>
                              ))}
                              {detalhe[c.id].observacoes && (
                                <p className="text-xs text-muted-foreground pt-1 pl-1">Obs: {detalhe[c.id].observacoes}</p>
                              )}
                              <div className="flex justify-end pt-1">
                                <button onClick={() => deletar(c.id)} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors">
                                  <Trash2 className="w-3 h-3" /> Remover compra
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="py-3 flex justify-center">
                              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Nova Compra */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-4 top-4 bottom-4 sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-8 sm:w-full sm:max-w-2xl sm:max-h-[90vh] z-50 bg-background rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden">

              {/* Modal header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-shrink-0">
                <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4 text-orange-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground text-sm">Nova Compra</p>
                  <p className="text-xs text-muted-foreground">Preencha os itens da compra</p>
                </div>
                <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-secondary rounded-lg">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Modal body */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {/* Fornecedor + data + status */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground font-medium mb-1 block">Fornecedor *</label>
                    {fornecedores.length > 0 ? (
                      <Select value={fFornecedorId} onValueChange={v => {
                        setFFornecedorId(v);
                        const f = fornecedores.find(f => String(f.id) === v);
                        setFFornecedorNome(f?.nome ?? "");
                      }}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione ou digite abaixo" /></SelectTrigger>
                        <SelectContent>
                          {fornecedores.map(f => (
                            <SelectItem key={f.id} value={String(f.id)}>
                              <span className="flex items-center gap-2">
                                <Truck className="w-3.5 h-3.5 text-muted-foreground" />{f.nome}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                    {!fFornecedorId && (
                      <Input
                        className="h-9 text-sm mt-1.5"
                        placeholder={fornecedores.length > 0 ? "Ou digite o nome do fornecedor" : "Nome do fornecedor *"}
                        value={fFornecedorNome}
                        onChange={e => setFFornecedorNome(e.target.value)}
                      />
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-medium mb-1 block">Data da compra</label>
                    <Input type="date" className="h-9 text-sm" value={fData} onChange={e => setFData(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-medium mb-1 block">Status</label>
                    <Select value={fStatus} onValueChange={setFStatus}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pago"><span className="text-emerald-600 font-medium">Pago</span></SelectItem>
                        <SelectItem value="pendente"><span className="text-amber-600 font-medium">Pendente</span></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Itens */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Itens da compra</label>
                    <button onClick={addItem} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium">
                      <Plus className="w-3.5 h-3.5" /> Adicionar item
                    </button>
                  </div>

                  <datalist id="produtos-lista">
                    {PRODUTO_SUGESTOES.map(p => <option key={p} value={p} />)}
                  </datalist>

                  <div className="space-y-2">
                    {/* Header */}
                    <div className="grid grid-cols-[1fr_80px_80px_90px_28px] gap-1.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wide px-1">
                      <span>Produto</span><span>Qtd</span><span>Unidade</span><span className="text-right">Preço unit.</span><span></span>
                    </div>

                    {fItens.map((item, idx) => (
                      <motion.div key={idx} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        className="grid grid-cols-[1fr_80px_80px_90px_28px] gap-1.5 items-center">
                        <input
                          list="produtos-lista"
                          className="h-9 w-full px-3 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="Ex: Mussarela"
                          value={item.produto}
                          onChange={e => updateItem(idx, "produto", e.target.value)}
                        />
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          className="h-9 w-full px-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary text-center"
                          value={item.quantidade}
                          onChange={e => updateItem(idx, "quantidade", e.target.value)}
                        />
                        <select
                          className="h-9 w-full px-1 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                          value={item.unidade}
                          onChange={e => updateItem(idx, "unidade", e.target.value)}
                        >
                          {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="h-9 w-full px-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary text-right"
                          placeholder="0,00"
                          value={item.valor_unitario}
                          onChange={e => updateItem(idx, "valor_unitario", e.target.value.replace(/[^0-9,.]/g, ""))}
                        />
                        <button onClick={() => removeItem(idx)} disabled={fItens.length === 1} className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    ))}
                  </div>

                  {/* Subtotals preview */}
                  {fItens.some(i => calcSubtotal(i) > 0) && (
                    <div className="mt-2 space-y-1 bg-secondary/40 rounded-xl p-3">
                      {fItens.filter(i => i.produto && calcSubtotal(i) > 0).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{item.produto || "Item"}</span>
                          <span className="font-medium text-foreground">{fmt(calcSubtotal(item))}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Observações */}
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1 block">Observações</label>
                  <Input className="h-9 text-sm" placeholder="Nota fiscal, número do pedido..." value={fObs} onChange={e => setFObs(e.target.value)} />
                </div>
              </div>

              {/* Modal footer com total */}
              <div className="flex items-center gap-3 px-5 py-4 border-t border-border bg-secondary/20 flex-shrink-0">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Total da compra</p>
                  <p className="text-xl font-bold text-red-500">{fmt(totalGeral)}</p>
                  {fStatus === "pago" && <p className="text-[10px] text-muted-foreground mt-0.5">Será lançado como despesa automaticamente</p>}
                </div>
                <Button variant="ghost" onClick={() => setShowModal(false)}>Cancelar</Button>
                <Button
                  onClick={salvar}
                  disabled={salvando || totalGeral === 0 || (!fFornecedorId && !fFornecedorNome.trim())}
                  className="gap-1.5"
                >
                  {salvando ? "Salvando..." : "Registrar Compra"}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
