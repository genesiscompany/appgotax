import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tag, Plus, Pencil, Trash2, X, CheckCircle2, Loader2,
  Copy, Check, ToggleLeft, ToggleRight,
  Calendar, ShoppingBag, Package, AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";

type Tipo = "percentual" | "fixo";

interface Produto {
  id: number;
  nome: string;
  preco: number;
  imagem?: string | null;
}

interface Promocao {
  id: number;
  nome: string;
  descricao?: string;
  tipo: Tipo;
  valor: number;
  codigo_cupom?: string;
  min_pedido: number;
  validade?: string;
  ativo: boolean;
  criado_em: string;
  produto_id?: number | null;
  preco_promocional?: number | null;
  quantidade_disponivel?: number | null;
  produto_nome?: string | null;
  produto_preco?: number | null;
  produto_imagem?: string | null;
}

interface FormState {
  nome: string;
  descricao: string;
  produto_id: number | null;
  preco_promocional: string;
  quantidade_disponivel: string;
  codigo_cupom: string;
  validade: string;
  min_pedido: string;
}

const EMPTY: FormState = {
  nome: "", descricao: "",
  produto_id: null, preco_promocional: "", quantidade_disponivel: "",
  codigo_cupom: "", validade: "", min_pedido: "",
};

export default function Promocoes() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [items, setItems] = useState<Promocao[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Promocao | null>(null);
  const [form, setForm] = useState<FormState>({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/pdv/promocoes", { headers })
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const loadProdutos = () => {
    fetch("/api/pdv/produtos", { headers })
      .then(r => r.json())
      .then(d => setProdutos(Array.isArray(d) ? d.filter((p: any) => p.ativo !== false) : []))
      .catch(() => {});
  };

  useEffect(() => { load(); loadProdutos(); }, [token]);

  const produtoSel = produtos.find(p => p.id === form.produto_id) || null;
  const precoAtual = produtoSel ? Number(produtoSel.preco) : 0;
  const precoPromo = Number(form.preco_promocional) || 0;
  const descontoCalc = precoAtual > 0 && precoPromo > 0 && precoPromo < precoAtual
    ? Math.round(((precoAtual - precoPromo) / precoAtual) * 100)
    : 0;

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY });
    setError("");
    setShowModal(true);
  };

  const openEdit = (p: Promocao) => {
    setEditing(p);
    setForm({
      nome: p.nome,
      descricao: p.descricao || "",
      produto_id: p.produto_id ?? null,
      preco_promocional: p.preco_promocional != null ? String(p.preco_promocional) : "",
      quantidade_disponivel: p.quantidade_disponivel != null ? String(p.quantidade_disponivel) : "",
      codigo_cupom: p.codigo_cupom || "",
      validade: p.validade || "",
      min_pedido: p.min_pedido ? String(p.min_pedido) : "",
    });
    setError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) { setError("Informe o nome da promoção"); return; }
    if (!form.produto_id) { setError("Selecione o produto da promoção"); return; }
    if (!form.preco_promocional || precoPromo <= 0) { setError("Informe o preço promocional"); return; }
    if (precoAtual > 0 && precoPromo >= precoAtual) {
      setError("O preço promocional deve ser menor que o preço atual"); return;
    }

    setSaving(true); setError("");

    // Cálculo automático do "desconto" para retrocompatibilidade (campo legado tipo/valor)
    const tipo: Tipo = "fixo";
    const valor = precoAtual > 0 ? Math.max(0, precoAtual - precoPromo) : 0;

    const body: any = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      tipo,
      valor,
      produto_id: form.produto_id,
      preco_promocional: precoPromo,
      quantidade_disponivel: form.quantidade_disponivel ? Number(form.quantidade_disponivel) : null,
      codigo_cupom: form.codigo_cupom.trim() || null,
      validade: form.validade || null,
      min_pedido: form.min_pedido ? Number(form.min_pedido) : 0,
    };
    const res = await fetch(editing ? `/api/pdv/promocoes/${editing.id}` : "/api/pdv/promocoes", {
      method: editing ? "PATCH" : "POST",
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Erro ao salvar");
    } else {
      setShowModal(false);
      load();
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir esta promoção?")) return;
    await fetch(`/api/pdv/promocoes/${id}`, { method: "DELETE", headers });
    load();
  };

  const toggleAtivo = async (p: Promocao) => {
    await fetch(`/api/pdv/promocoes/${p.id}`, {
      method: "PATCH", headers, body: JSON.stringify({ ativo: !p.ativo }),
    });
    load();
  };

  const copyCupom = (p: Promocao) => {
    if (!p.codigo_cupom) return;
    navigator.clipboard?.writeText(p.codigo_cupom);
    setCopiedId(p.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isValid = (p: Promocao) => !p.validade || new Date(p.validade) >= new Date();
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Tag className="w-7 h-7 text-primary" /> Promoções
          </h1>
          <p className="text-muted-foreground mt-1">Crie descontos e cupons para atrair mais clientes.</p>
        </div>
        <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 shadow-md shadow-primary/20">
          <Plus className="w-4 h-4 mr-2" /> Nova Promoção
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed border-2 border-border/50 shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Tag className="w-8 h-8 text-primary/60" />
            </div>
            <p className="text-lg font-semibold text-foreground">Nenhuma promoção criada</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Crie promoções com desconto percentual ou fixo e gere cupons que seus clientes podem usar no pedido.
            </p>
            <Button onClick={openCreate} className="mt-2"><Plus className="w-4 h-4 mr-2" />Criar Primeira Promoção</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map(p => {
            const valid = isValid(p);
            return (
              <motion.div key={p.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
                <Card className={`shadow-sm border-border/50 overflow-hidden transition-all ${!p.ativo || !valid ? "opacity-60" : ""}`}>
                  <div className="h-1.5 bg-gradient-to-r from-orange-500 to-rose-500" />
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground text-base leading-tight">{p.nome}</span>
                          {!valid && <Badge variant="destructive" className="text-[10px]">Expirada</Badge>}
                          {p.ativo && valid && <Badge className="text-[10px] bg-green-500/15 text-green-600 border-0">Ativa</Badge>}
                          {p.quantidade_disponivel != null && (
                            <Badge className="text-[10px] bg-orange-500/15 text-orange-600 border-0">
                              {p.quantidade_disponivel} restantes
                            </Badge>
                          )}
                        </div>
                        {p.produto_nome && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Package className="w-3 h-3" />
                            <span className="font-medium text-foreground">{p.produto_nome}</span>
                          </div>
                        )}
                        {p.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.descricao}</p>}
                      </div>
                      {p.preco_promocional != null && p.produto_preco != null && (
                        <div className="shrink-0 text-right">
                          <div className="text-xs text-muted-foreground line-through">
                            R$ {Number(p.produto_preco).toFixed(2)}
                          </div>
                          <div className="text-lg font-extrabold text-orange-600 leading-none">
                            R$ {Number(p.preco_promocional).toFixed(2)}
                          </div>
                          {Number(p.produto_preco) > Number(p.preco_promocional) && (
                            <div className="text-[10px] font-bold text-green-600 mt-0.5">
                              -{Math.round(((Number(p.produto_preco) - Number(p.preco_promocional)) / Number(p.produto_preco)) * 100)}%
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {p.codigo_cupom && (
                        <button
                          onClick={() => copyCupom(p)}
                          className="flex items-center gap-1.5 bg-secondary px-2.5 py-1.5 rounded-lg hover:bg-secondary/80 transition-colors font-mono font-semibold text-foreground border border-border/50"
                        >
                          {copiedId === p.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                          {p.codigo_cupom}
                        </button>
                      )}
                      {p.min_pedido > 0 && (
                        <span className="flex items-center gap-1 bg-secondary/60 px-2.5 py-1.5 rounded-lg">
                          <ShoppingBag className="w-3 h-3" /> Mín R$ {Number(p.min_pedido).toFixed(2)}
                        </span>
                      )}
                      {p.validade && (
                        <span className="flex items-center gap-1 bg-secondary/60 px-2.5 py-1.5 rounded-lg">
                          <Calendar className="w-3 h-3" /> Válido até {new Date(p.validade + "T00:00:00").toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/40">
                      <button
                        onClick={() => toggleAtivo(p)}
                        className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${p.ativo ? "text-green-600" : "text-muted-foreground"}`}
                      >
                        {p.ativo ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                        {p.ativo ? "Ativa" : "Pausada"}
                      </button>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-bold text-lg">{editing ? "Editar Promoção" : "Nova Promoção"}</h2>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-secondary"><X className="w-4 h-4" /></button>
              </div>

              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Nome da promoção *</label>
                  <Input placeholder="Ex: Desconto de Verão" value={form.nome} onChange={e => set("nome", e.target.value)} autoFocus />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Descrição (opcional)</label>
                  <Input placeholder="Ex: Válido em toda a semana..." value={form.descricao} onChange={e => set("descricao", e.target.value)} />
                </div>

                {/* Produto */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-primary" /> Produto em promoção *
                  </label>
                  {produtos.length === 0 ? (
                    <div className="px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 text-xs flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>Nenhum produto cadastrado. Cadastre produtos primeiro em <b>Cardápio</b>.</span>
                    </div>
                  ) : (
                    <select
                      value={form.produto_id ?? ""}
                      onChange={e => set("produto_id", e.target.value ? Number(e.target.value) : null)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="">— Selecione o produto —</option>
                      {produtos.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nome} — R$ {Number(p.preco).toFixed(2)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Preços */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Preço atual</label>
                    <div className="h-10 px-3 rounded-md border border-border bg-secondary/50 flex items-center text-sm font-semibold">
                      {produtoSel ? `R$ ${precoAtual.toFixed(2)}` : "—"}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-orange-600">Preço promocional (R$) *</label>
                    <Input
                      type="number" min="0" step="0.01"
                      value={form.preco_promocional}
                      onChange={e => set("preco_promocional", e.target.value)}
                      placeholder="Ex: 19.90"
                      className="font-semibold"
                    />
                  </div>
                </div>

                {descontoCalc > 0 && (
                  <div className="px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/30 text-green-700 text-xs font-medium text-center">
                    Desconto de <b>{descontoCalc}%</b> &nbsp;•&nbsp; Cliente economiza <b>R$ {(precoAtual - precoPromo).toFixed(2)}</b>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Quantidade disponível</label>
                    <Input
                      type="number" min="1" step="1"
                      value={form.quantidade_disponivel}
                      onChange={e => set("quantidade_disponivel", e.target.value)}
                      placeholder="Vazio = ilimitado"
                    />
                    <p className="text-xs text-muted-foreground">Para estoque limitado</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Válido até</label>
                    <Input type="date" value={form.validade} onChange={e => set("validade", e.target.value)} />
                    <p className="text-xs text-muted-foreground">Vazio = sem expiração</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Código do cupom (opcional)</label>
                    <Input
                      placeholder="Ex: PIZZA10"
                      value={form.codigo_cupom}
                      onChange={e => set("codigo_cupom", e.target.value.toUpperCase().replace(/\s/g, ""))}
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Pedido mínimo (R$)</label>
                    <Input
                      type="number" min="0" step="1"
                      value={form.min_pedido}
                      onChange={e => set("min_pedido", e.target.value)}
                      placeholder="0 = sem mínimo"
                    />
                  </div>
                </div>

                {error && (
                  <div className="px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive flex items-center gap-2">
                    <X className="w-4 h-4 shrink-0" />{error}
                  </div>
                )}
              </div>

              <div className="p-5 pt-0 flex gap-3">
                <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">Cancelar</Button>
                <Button onClick={handleSave} disabled={saving} className="flex-1 bg-primary hover:bg-primary/90">
                  {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : <><CheckCircle2 className="w-4 h-4 mr-2" />Salvar</>}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
