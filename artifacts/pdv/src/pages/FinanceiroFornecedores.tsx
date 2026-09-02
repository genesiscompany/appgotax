import React, { useState, useEffect, useCallback } from "react";
import { Truck, Plus, Pencil, Trash2, X, Check, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";

const API = "/api";

export const CATEGORIAS_FORNECEDOR = [
  { value: "alimentacao", label: "Alimentação" },
  { value: "bebidas", label: "Bebidas" },
  { value: "embalagens", label: "Embalagens" },
  { value: "limpeza", label: "Limpeza" },
  { value: "descartaveis", label: "Descartáveis" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "outros", label: "Outros" },
];

type Fornecedor = {
  id: number;
  nome: string;
  categoria: string;
  telefone?: string;
  email?: string;
  observacoes?: string;
  ativo: boolean;
};

const BLANK: Omit<Fornecedor, "id" | "ativo"> = { nome: "", categoria: "alimentacao", telefone: "", email: "", observacoes: "" };

export default function FinanceiroFornecedores({ token }: { token: string }) {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const [lista, setLista] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [salvando, setSalvando] = useState(false);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/pdv/financeiro/fornecedores`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setLista(await r.json());
    } catch {}
    setLoading(false);
  }, [token]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const abrirNovo = () => { setEditId(null); setForm({ ...BLANK }); setShowForm(true); };
  const abrirEditar = (f: Fornecedor) => {
    setEditId(f.id);
    setForm({ nome: f.nome, categoria: f.categoria, telefone: f.telefone ?? "", email: f.email ?? "", observacoes: f.observacoes ?? "" });
    setShowForm(true);
  };
  const cancelar = () => { setShowForm(false); setEditId(null); };

  const salvar = async () => {
    if (!form.nome.trim()) return;
    setSalvando(true);
    try {
      const url = editId ? `${API}/pdv/financeiro/fornecedores/${editId}` : `${API}/pdv/financeiro/fornecedores`;
      const r = await fetch(url, { method: editId ? "PUT" : "POST", headers, body: JSON.stringify(form) });
      if (r.ok) { setShowForm(false); fetch_(); }
    } catch {}
    setSalvando(false);
  };

  const deletar = async (id: number) => {
    if (!confirm("Remover este fornecedor?")) return;
    await fetch(`${API}/pdv/financeiro/fornecedores/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    fetch_();
  };

  const catLabel = (v: string) => CATEGORIAS_FORNECEDOR.find(c => c.value === v)?.label ?? v;

  const CAT_COLORS: Record<string, string> = {
    alimentacao: "bg-orange-100 text-orange-700",
    bebidas: "bg-blue-100 text-blue-700",
    embalagens: "bg-amber-100 text-amber-700",
    limpeza: "bg-cyan-100 text-cyan-700",
    descartaveis: "bg-green-100 text-green-700",
    ecommerce: "bg-violet-100 text-violet-700",
    outros: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Truck className="w-4 h-4 text-primary" /> Fornecedores
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Cadastre seus fornecedores para agilizar o registro de compras</p>
        </div>
        <Button size="sm" onClick={abrirNovo} className="gap-1.5">
          <Plus className="w-4 h-4" /> Novo Fornecedor
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <Card className="border-primary/30 bg-primary/[0.02]">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-foreground">{editId ? "Editar Fornecedor" : "Novo Fornecedor"}</p>
                  <button onClick={cancelar} className="p-1 rounded-lg hover:bg-secondary"><X className="w-4 h-4 text-muted-foreground" /></button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-xs text-muted-foreground font-medium mb-1 block">Nome do fornecedor *</label>
                    <Input className="h-9 text-sm" placeholder="Ex: Distribuidora São Paulo" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-medium mb-1 block">Categoria</label>
                    <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIAS_FORNECEDOR.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-medium mb-1 block">Telefone</label>
                    <Input className="h-9 text-sm" placeholder="(00) 00000-0000" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-medium mb-1 block">E-mail</label>
                    <Input className="h-9 text-sm" placeholder="contato@fornecedor.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground font-medium mb-1 block">Observações</label>
                    <Input className="h-9 text-sm" placeholder="Condições de pagamento, prazo de entrega..." value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={salvar} disabled={salvando || !form.nome.trim()} className="gap-1">
                    <Check className="w-3.5 h-3.5" />{salvando ? "Salvando..." : "Salvar"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelar}>Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="border-border/60">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-10 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : lista.length === 0 ? (
            <div className="py-12 text-center">
              <Building2 className="w-10 h-10 text-muted-foreground/25 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum fornecedor cadastrado</p>
              <p className="text-xs text-muted-foreground mt-1">Adicione fornecedores para agilizar o lançamento de compras</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {lista.map(f => (
                <div key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Truck className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{f.nome}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CAT_COLORS[f.categoria] ?? CAT_COLORS.outros}`}>
                        {catLabel(f.categoria)}
                      </span>
                      {f.telefone && <span className="text-xs text-muted-foreground">{f.telefone}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => abrirEditar(f)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deletar(f.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
