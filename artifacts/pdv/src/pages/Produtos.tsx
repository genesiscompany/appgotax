import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Search, Plus, Edit2, Trash2, Tag, Package,
  X, Check, Loader2, ShoppingBag, Sparkles, ChevronRight,
  Percent, Gift, Upload, ImageIcon, TicketPercent, Calendar,
  Layers, Copy, ChevronDown, ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Categoria { id: number; nome: string; ordem: number; }
interface Extra { id: number; nome: string; preco: number; ativo: boolean; obrigatorio: boolean; }
interface Tamanho { nome: string; preco: number; }
interface OpcaoGrupo { id: number; nome: string; preco_adicional: number; ativo: boolean; ordem: number; }
interface Grupo {
  id: number; nome: string; min_selecoes: number; max_selecoes: number;
  obrigatorio: boolean; ordem: number; ativo: boolean;
  opcoes: OpcaoGrupo[];
}
interface Produto {
  id: number; nome: string; descricao?: string; preco: number;
  imagem?: string; ativo: boolean; categoria_id?: number; categoria_nome?: string;
  extras: Extra[];
  tamanhos?: Tamanho[] | null;
}
interface Promocao {
  id: number; nome: string; descricao?: string; tipo: string;
  valor: number; codigo_cupom?: string; min_pedido: number;
  validade?: string; ativo: boolean;
}

// ── Canvas resize helper (client-side, no packages) ───────────────────────────
async function resizeImageFile(file: File, maxW: number, maxH: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("resize failed")), "image/webp", 0.88);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── API helpers ───────────────────────────────────────────────────────────────
function useApi(token: string | null, empresaId: number | null) {
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}`, "x-empresa-id": String(empresaId) } : {}),
  };
  const authHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}`, "x-empresa-id": String(empresaId) }
    : {};
  const get = (path: string) => fetch(`/api/pdv/${path}`, { headers }).then(r => r.json());
  const post = (path: string, body: object) => fetch(`/api/pdv/${path}`, { method: "POST", headers, body: JSON.stringify(body) }).then(r => r.json());
  const patch = (path: string, body: object) => fetch(`/api/pdv/${path}`, { method: "PATCH", headers, body: JSON.stringify(body) }).then(r => r.json());
  const put = (path: string, body: object) => fetch(`/api/pdv/${path}`, { method: "PUT", headers, body: JSON.stringify(body) }).then(r => r.json());
  const del = (path: string) => fetch(`/api/pdv/${path}`, { method: "DELETE", headers }).then(r => r.json());
  const uploadImage = async (produtoId: number, blob: Blob, ext: string) => {
    void ext;
    const fd = new FormData();
    fd.append("imagem", blob, `produto.${ext}`);
    const r = await fetch(`/api/pdv/produtos/${produtoId}/imagem`, { method: "POST", headers: authHeaders, body: fd });
    return r.json();
  };
  return { get, post, patch, put, del, uploadImage };
}

// ── Promoções Dialog ──────────────────────────────────────────────────────────
function PromoDialog({
  open, onClose, promo, api, onSaved,
}: {
  open: boolean; onClose: () => void;
  promo?: Promocao | null; api: ReturnType<typeof useApi>;
  onSaved: () => void;
}) {
  const isEdit = !!promo;
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState("percentual");
  const [valor, setValor] = useState("");
  const [codigo, setCodigo] = useState("");
  const [minPedido, setMinPedido] = useState("");
  const [validade, setValidade] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) {
      setNome(promo?.nome ?? "");
      setDescricao(promo?.descricao ?? "");
      setTipo(promo?.tipo ?? "percentual");
      setValor(promo ? String(promo.valor) : "");
      setCodigo(promo?.codigo_cupom ?? "");
      setMinPedido(promo?.min_pedido ? String(promo.min_pedido) : "");
      setValidade(promo?.validade ?? "");
      setErr("");
    }
  }, [open, promo]);

  const handleSave = async () => {
    if (!nome.trim() || !valor) return;
    setSaving(true); setErr("");
    const body = {
      nome: nome.trim(), descricao: descricao.trim() || undefined,
      tipo, valor: parseFloat(valor) || 0,
      codigo_cupom: codigo.trim().toUpperCase() || undefined,
      min_pedido: parseFloat(minPedido) || 0,
      validade: validade || undefined,
    };
    const r = isEdit
      ? await api.patch(`promocoes/${promo!.id}`, body)
      : await api.post("promocoes", body);
    setSaving(false);
    if (r?.error === "cupom_duplicado") { setErr("Código de cupom já existe."); return; }
    onSaved(); onClose();
  };

  const tipoLabel = tipo === "percentual" ? "% desconto" : tipo === "valor" ? "R$ desconto" : "Frete grátis";

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TicketPercent className="w-5 h-5 text-primary" />
            {isEdit ? "Editar promoção" : "Nova promoção"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Input placeholder="Nome da promoção *" value={nome} onChange={e => setNome(e.target.value)} />
          <Input placeholder="Descrição (opcional)" value={descricao} onChange={e => setDescricao(e.target.value)} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1.5 font-medium">Tipo de desconto</p>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="bg-background h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentual"><div className="flex items-center gap-2"><Percent className="w-3.5 h-3.5" />Percentual</div></SelectItem>
                  <SelectItem value="valor"><div className="flex items-center gap-2"><Gift className="w-3.5 h-3.5" />Valor fixo</div></SelectItem>
                  <SelectItem value="frete_gratis"><div className="flex items-center gap-2"><Package className="w-3.5 h-3.5" />Frete grátis</div></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5 font-medium">{tipoLabel}</p>
              <div className="relative">
                {tipo !== "frete_gratis" && (
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
                    {tipo === "percentual" ? "%" : "R$"}
                  </span>
                )}
                <Input
                  type="number" step="0.01" min="0"
                  className={`h-9 ${tipo !== "frete_gratis" ? "pl-7" : ""}`}
                  placeholder={tipo === "frete_gratis" ? "—" : "0"}
                  value={tipo === "frete_gratis" ? "" : valor}
                  disabled={tipo === "frete_gratis"}
                  onChange={e => setValor(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1.5 font-medium">Código cupom (opcional)</p>
              <Input
                placeholder="Ex: PROMO10"
                value={codigo}
                onChange={e => setCodigo(e.target.value.toUpperCase())}
                className="h-9 uppercase"
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5 font-medium">Pedido mínimo</p>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">R$</span>
                <Input type="number" step="0.01" min="0" className="h-9 pl-7" placeholder="0" value={minPedido} onChange={e => setMinPedido(e.target.value)} />
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1.5 font-medium flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />Validade (opcional)
            </p>
            <Input type="date" value={validade} onChange={e => setValidade(e.target.value)} className="h-9" />
          </div>

          {err && <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{err}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!nome.trim() || saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {isEdit ? "Salvar" : "Criar promoção"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Grupos de Adicionais Section ──────────────────────────────────────────────
function GruposSection({ api, grupos, onChanged }: {
  api: ReturnType<typeof useApi>;
  grupos: Grupo[];
  onChanged: () => void;
}) {
  const [newNome, setNewNome] = useState("");
  const [newMin, setNewMin] = useState("0");
  const [newMax, setNewMax] = useState("1");
  const [newObrig, setNewObrig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editMin, setEditMin] = useState("0");
  const [editMax, setEditMax] = useState("1");
  const [editObrig, setEditObrig] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Opção state
  const [newOpcaoNome, setNewOpcaoNome] = useState<Record<number, string>>({});
  const [newOpcaoPreco, setNewOpcaoPreco] = useState<Record<number, string>>({});
  const [savingOpcao, setSavingOpcao] = useState<number | null>(null);
  const [deletingOpcaoId, setDeletingOpcaoId] = useState<number | null>(null);

  const handleAddGrupo = async () => {
    if (!newNome.trim()) return;
    setSaving(true);
    await api.post("grupos", { nome: newNome.trim(), min_selecoes: Number(newMin), max_selecoes: Number(newMax), obrigatorio: newObrig });
    setNewNome(""); setNewMin("0"); setNewMax("1"); setNewObrig(false);
    setSaving(false);
    onChanged();
  };

  const handleDuplicate = async (g: Grupo) => {
    setDuplicatingId(g.id);
    await api.post(`grupos/${g.id}/duplicar`, {});
    setDuplicatingId(null);
    onChanged();
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    await api.del(`grupos/${id}`);
    setDeletingId(null);
    onChanged();
  };

  const startEdit = (g: Grupo) => {
    setEditingId(g.id);
    setEditNome(g.nome);
    setEditMin(String(g.min_selecoes));
    setEditMax(String(g.max_selecoes));
    setEditObrig(g.obrigatorio);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editNome.trim()) return;
    setSavingEdit(true);
    await api.patch(`grupos/${editingId}`, { nome: editNome.trim(), min_selecoes: Number(editMin), max_selecoes: Number(editMax), obrigatorio: editObrig });
    setSavingEdit(false);
    setEditingId(null);
    onChanged();
  };

  const handleToggleGrupo = async (g: Grupo) => {
    await api.patch(`grupos/${g.id}`, { ativo: !g.ativo });
    onChanged();
  };

  const handleAddOpcao = async (grupoId: number) => {
    const nome = (newOpcaoNome[grupoId] ?? "").trim();
    if (!nome) return;
    setSavingOpcao(grupoId);
    await api.post(`grupos/${grupoId}/opcoes`, { nome, preco_adicional: parseFloat(newOpcaoPreco[grupoId] ?? "0") || 0 });
    setNewOpcaoNome(prev => ({ ...prev, [grupoId]: "" }));
    setNewOpcaoPreco(prev => ({ ...prev, [grupoId]: "" }));
    setSavingOpcao(null);
    onChanged();
  };

  const handleDeleteOpcao = async (opcaoId: number) => {
    setDeletingOpcaoId(opcaoId);
    await api.del(`grupos/opcoes/${opcaoId}`);
    setDeletingOpcaoId(null);
    onChanged();
  };

  const handleToggleOpcao = async (opcaoId: number, ativo: boolean) => {
    await api.patch(`grupos/opcoes/${opcaoId}`, { ativo: !ativo });
    onChanged();
  };

  return (
    <Card className="shadow-sm border-border/50 overflow-hidden">
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-sm flex items-center gap-2 text-foreground">
          <Layers className="w-3.5 h-3.5 text-primary" />
          Grupos de Adicionais
          {grupos.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{grupos.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {/* Criar grupo */}
        <div className="space-y-2 p-3 bg-muted/40 rounded-xl border border-border/50">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Novo grupo</p>
          <Input
            placeholder='Ex: "Escolha o Sabor"'
            className="h-8 text-sm bg-background"
            value={newNome}
            onChange={e => setNewNome(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAddGrupo()}
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <p className="text-[10px] text-muted-foreground mb-1">Mín.</p>
              <Input type="number" min="0" className="h-7 text-xs bg-background" value={newMin} onChange={e => setNewMin(e.target.value)} />
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-muted-foreground mb-1">Máx.</p>
              <Input type="number" min="1" className="h-7 text-xs bg-background" value={newMax} onChange={e => setNewMax(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Switch checked={newObrig} onCheckedChange={setNewObrig} className="scale-75" />
              <span className="text-xs text-muted-foreground">{newObrig ? <span className="text-destructive font-semibold">Obrigatório</span> : "Opcional"}</span>
            </label>
            <Button size="sm" className="h-7 px-3 gap-1 text-xs" disabled={!newNome.trim() || saving} onClick={handleAddGrupo}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Criar
            </Button>
          </div>
        </div>

        {grupos.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">Nenhum grupo criado</p>
        ) : (
          <div className="space-y-2">
            {grupos.map(g => (
              <div key={g.id} className="border border-border/60 rounded-xl overflow-hidden">
                {/* Header do grupo */}
                {editingId === g.id ? (
                  <div className="p-3 space-y-2 bg-primary/5 border-b border-border/50">
                    <Input className="h-7 text-sm" value={editNome} onChange={e => setEditNome(e.target.value)} autoFocus
                      onKeyDown={e => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") setEditingId(null); }} />
                    <div className="flex gap-2">
                      <div className="flex-1"><p className="text-[10px] text-muted-foreground mb-1">Mín.</p>
                        <Input type="number" min="0" className="h-7 text-xs" value={editMin} onChange={e => setEditMin(e.target.value)} /></div>
                      <div className="flex-1"><p className="text-[10px] text-muted-foreground mb-1">Máx.</p>
                        <Input type="number" min="1" className="h-7 text-xs" value={editMax} onChange={e => setEditMax(e.target.value)} /></div>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <Switch checked={editObrig} onCheckedChange={setEditObrig} className="scale-75" />
                        <span className="text-xs">{editObrig ? <span className="text-destructive font-semibold">Obrigatório</span> : "Opcional"}</span>
                      </label>
                      <div className="flex gap-1">
                        <button onClick={handleSaveEdit} disabled={savingEdit || !editNome.trim()}
                          className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1 disabled:opacity-50">
                          {savingEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Salvar
                        </button>
                        <button onClick={() => setEditingId(null)} className="h-7 px-2 rounded-md border border-border text-xs text-muted-foreground hover:bg-secondary">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-secondary/20">
                    <Switch checked={g.ativo} onCheckedChange={() => handleToggleGrupo(g)} className="scale-75 shrink-0" />
                    <button className="flex-1 text-left min-w-0" onClick={() => setExpandedId(expandedId === g.id ? null : g.id)}>
                      <p className={`text-xs font-semibold truncate ${g.ativo ? "text-foreground" : "text-muted-foreground line-through"}`}>{g.nome}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {g.opcoes.length} opç{g.opcoes.length === 1 ? "ão" : "ões"}
                        {g.obrigatorio && <span className="text-destructive font-bold ml-1">• Obrig.</span>}
                        {" "}• {g.opcoes.filter(o => o.ativo).length} iten{g.opcoes.filter(o => o.ativo).length === 1 ? "" : "s"}
                      </p>
                    </button>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button title="Duplicar" onClick={() => handleDuplicate(g)} disabled={duplicatingId === g.id}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
                        {duplicatingId === g.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />}
                      </button>
                      <button title="Editar" onClick={() => startEdit(g)} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button title="Apagar" onClick={() => handleDelete(g.id)} disabled={deletingId === g.id}
                        className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
                        {deletingId === g.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      </button>
                      <button onClick={() => setExpandedId(expandedId === g.id ? null : g.id)}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
                        {expandedId === g.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Opções do grupo (expandido) */}
                {expandedId === g.id && (
                  <div className="divide-y divide-border/40">
                    {g.opcoes.length === 0 && (
                      <p className="text-[11px] text-muted-foreground text-center py-3">Nenhuma opção — adicione abaixo</p>
                    )}
                    {g.opcoes.map(op => (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => handleToggleOpcao(op.id, op.ativo)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors group ${
                          op.ativo ? "bg-primary/5 hover:bg-primary/10" : "opacity-50 hover:opacity-70 hover:bg-muted/40"
                        }`}
                      >
                        <span className="text-xs flex-1 truncate text-foreground">{op.nome}</span>
                        {Number(op.preco_adicional) > 0 && (
                          <span className="text-xs font-semibold text-primary shrink-0">+R$ {Number(op.preco_adicional).toFixed(2)}</span>
                        )}
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); handleDeleteOpcao(op.id); }}
                          disabled={deletingOpcaoId === op.id}
                          className="p-0.5 rounded text-transparent group-hover:text-muted-foreground hover:!text-destructive hover:bg-destructive/10 transition-all shrink-0"
                        >
                          {deletingOpcaoId === op.id ? <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" /> : <Trash2 className="w-2.5 h-2.5" />}
                        </button>
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          op.ativo ? "bg-primary border-primary" : "border-muted-foreground/30 bg-background"
                        }`}>
                          {op.ativo && <Check className="w-3 h-3 text-primary-foreground" />}
                        </div>
                      </button>
                    ))}
                    {/* Adicionar opção */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
                      <Input
                        placeholder="Nova opção..."
                        className="h-7 text-xs flex-1"
                        value={newOpcaoNome[g.id] ?? ""}
                        onChange={e => setNewOpcaoNome(prev => ({ ...prev, [g.id]: e.target.value }))}
                        onKeyDown={e => e.key === "Enter" && handleAddOpcao(g.id)}
                      />
                      <div className="relative w-20">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">R$</span>
                        <Input type="number" step="0.01" min="0" placeholder="0" className="h-7 text-xs pl-6"
                          value={newOpcaoPreco[g.id] ?? ""}
                          onChange={e => setNewOpcaoPreco(prev => ({ ...prev, [g.id]: e.target.value }))} />
                      </div>
                      <Button size="icon" className="h-7 w-7 shrink-0" disabled={!(newOpcaoNome[g.id] ?? "").trim() || savingOpcao === g.id}
                        onClick={() => handleAddOpcao(g.id)}>
                        {savingOpcao === g.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Left Sidebar ──────────────────────────────────────────────────────────────
function LeftSidebar({
  categorias, extras, produtos, promocoes, grupos, api,
  onCategoriaCreated, onExtraCreated, onPromoCreated, onGrupoChanged,
  onCategoriaDeleted, onExtraDeleted, onExtraUpdated, onPromoUpdated,
  filterCat, setFilterCat,
}: {
  categorias: Categoria[];
  extras: Extra[];
  produtos: Produto[];
  promocoes: Promocao[];
  grupos: Grupo[];
  api: ReturnType<typeof useApi>;
  onCategoriaCreated: () => void;
  onExtraCreated: () => void;
  onPromoCreated: () => void;
  onGrupoChanged: () => void;
  onCategoriaDeleted: (id: number) => void;
  onExtraDeleted: (id: number) => void;
  onExtraUpdated: () => void;
  onPromoUpdated: () => void;
  filterCat: string;
  setFilterCat: (v: string) => void;
}) {
  const [newCategoria, setNewCategoria] = useState("");
  const [savingCat, setSavingCat] = useState(false);
  const [newExtraNome, setNewExtraNome] = useState("");
  const [newExtraPreco, setNewExtraPreco] = useState("0");
  const [newExtraObrig, setNewExtraObrig] = useState(false);
  const [savingExtra, setSavingExtra] = useState(false);
  const [deletingCatId, setDeletingCatId] = useState<number | null>(null);
  const [deletingExtraId, setDeletingExtraId] = useState<number | null>(null);
  const [editingExtraId, setEditingExtraId] = useState<number | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editPreco, setEditPreco] = useState("");
  const [editObrig, setEditObrig] = useState(false);
  const [duplicatingExtraId, setDuplicatingExtraId] = useState<number | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [showPromoDialog, setShowPromoDialog] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promocao | null>(null);
  const [deletingPromoId, setDeletingPromoId] = useState<number | null>(null);

  const handleAddCategoria = async () => {
    if (!newCategoria.trim()) return;
    setSavingCat(true);
    await api.post("categorias", { nome: newCategoria.trim() });
    setNewCategoria("");
    setSavingCat(false);
    onCategoriaCreated();
  };

  const handleAddExtra = async () => {
    if (!newExtraNome.trim()) return;
    setSavingExtra(true);
    await api.post("extras", { nome: newExtraNome.trim(), preco: parseFloat(newExtraPreco) || 0, obrigatorio: newExtraObrig });
    setNewExtraNome("");
    setNewExtraPreco("0");
    setNewExtraObrig(false);
    setSavingExtra(false);
    onExtraCreated();
  };

  const handleDuplicateExtra = async (extra: Extra) => {
    setDuplicatingExtraId(extra.id);
    await api.post("extras", { nome: `${extra.nome} (cópia)`, preco: extra.preco, obrigatorio: extra.obrigatorio });
    setDuplicatingExtraId(null);
    onExtraCreated();
  };

  const handleDeleteCat = async (id: number) => {
    setDeletingCatId(id);
    await api.del(`categorias/${id}`);
    setDeletingCatId(null);
    onCategoriaDeleted(id);
  };

  const handleDeleteExtra = async (id: number) => {
    setDeletingExtraId(id);
    await api.del(`extras/${id}`);
    setDeletingExtraId(null);
    onExtraDeleted(id);
  };

  const startEdit = (extra: Extra) => {
    setEditingExtraId(extra.id);
    setEditNome(extra.nome);
    setEditPreco(String(extra.preco));
    setEditObrig(extra.obrigatorio ?? false);
  };

  const cancelEdit = () => setEditingExtraId(null);

  const handleSaveEdit = async () => {
    if (!editNome.trim() || editingExtraId === null) return;
    setSavingEdit(true);
    await api.patch(`extras/${editingExtraId}`, { nome: editNome.trim(), preco: parseFloat(editPreco) || 0, obrigatorio: editObrig });
    setSavingEdit(false);
    setEditingExtraId(null);
    onExtraUpdated();
  };

  const handleToggleAtivo = async (extra: Extra) => {
    await api.patch(`extras/${extra.id}`, { ativo: !extra.ativo });
    onExtraUpdated();
  };

  const handleTogglePromo = async (promo: Promocao) => {
    await api.patch(`promocoes/${promo.id}`, { ativo: !promo.ativo });
    onPromoUpdated();
  };

  const handleDeletePromo = async (id: number) => {
    setDeletingPromoId(id);
    await api.del(`promocoes/${id}`);
    setDeletingPromoId(null);
    onPromoUpdated();
  };

  const tipoIcon = (tipo: string) => {
    if (tipo === "percentual") return <Percent className="w-3 h-3" />;
    if (tipo === "frete_gratis") return <Package className="w-3 h-3" />;
    return <Gift className="w-3 h-3" />;
  };

  const tipoLabel = (p: Promocao) => {
    if (p.tipo === "percentual") return `${p.valor}% OFF`;
    if (p.tipo === "frete_gratis") return "Frete grátis";
    return `R$ ${Number(p.valor).toFixed(2)} OFF`;
  };

  return (
    <aside className="w-64 shrink-0 flex flex-col gap-4">

      {/* ── Categorias ─────────────────────────────────── */}
      <Card className="shadow-sm border-border/50 overflow-hidden">
        <CardHeader className="pb-2 px-4 pt-4">
          <CardTitle className="text-sm flex items-center gap-2 text-foreground">
            <Tag className="w-3.5 h-3.5 text-primary" />
            Categorias
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Nova categoria..."
              className="h-8 text-sm"
              value={newCategoria}
              onChange={e => setNewCategoria(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddCategoria()}
            />
            <Button
              size="icon"
              className="h-8 w-8 shrink-0"
              disabled={!newCategoria.trim() || savingCat}
              onClick={handleAddCategoria}
            >
              {savingCat ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            </Button>
          </div>

          <div className="space-y-1">
            <button
              onClick={() => setFilterCat("todas")}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                filterCat === "todas"
                  ? "bg-primary text-primary-foreground font-medium"
                  : "hover:bg-secondary text-muted-foreground"
              }`}
            >
              <span>Todos</span>
              <Badge variant={filterCat === "todas" ? "secondary" : "outline"} className="text-[10px] h-4 px-1.5">
                {produtos.length}
              </Badge>
            </button>
            {categorias.map(cat => (
              <div key={cat.id} className="group flex items-center gap-1">
                <button
                  onClick={() => setFilterCat(String(cat.id))}
                  className={`flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                    filterCat === String(cat.id)
                      ? "bg-primary text-primary-foreground font-medium"
                      : "hover:bg-secondary text-muted-foreground"
                  }`}
                >
                  <span className="truncate">{cat.nome}</span>
                  <Badge
                    variant={filterCat === String(cat.id) ? "secondary" : "outline"}
                    className="text-[10px] h-4 px-1.5 ml-1 shrink-0"
                  >
                    {produtos.filter(p => p.categoria_id === cat.id).length}
                  </Badge>
                </button>
                <button
                  onClick={() => handleDeleteCat(cat.id)}
                  disabled={deletingCatId === cat.id}
                  className="p-1 rounded-md opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                >
                  {deletingCatId === cat.id
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <X className="w-3 h-3" />
                  }
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Pacotes / Kits ──────────────────────────────── */}
      <Card className="shadow-sm border-border/50 overflow-hidden">
        <CardHeader className="pb-2 px-4 pt-4">
          <CardTitle className="text-sm flex items-center gap-2 text-foreground">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Pacotes / Kits
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="space-y-2 p-3 bg-muted/40 rounded-xl border border-border/50">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Novo pacote</p>
            <Input
              placeholder="Ex: Kit Presente, Combo..."
              className="h-8 text-sm bg-background"
              value={newExtraNome}
              onChange={e => setNewExtraNome(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddExtra()}
            />
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  className="h-8 text-sm pl-7 bg-background"
                  value={newExtraPreco}
                  onChange={e => setNewExtraPreco(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddExtra()}
                />
              </div>
              <Button
                size="sm"
                className="h-8 px-3 shrink-0 gap-1"
                disabled={!newExtraNome.trim() || savingExtra}
                onClick={handleAddExtra}
              >
                {savingExtra ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Adicionar
              </Button>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
              <Switch checked={newExtraObrig} onCheckedChange={setNewExtraObrig} className="scale-75" />
              <span className="text-xs text-muted-foreground">
                {newExtraObrig ? <span className="text-destructive font-semibold">Obrigatório — cliente deve selecionar</span> : "Opcional"}
              </span>
            </label>
          </div>

          {extras.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Nenhum pacote cadastrado</p>
          ) : (
            <div className="space-y-1.5">
              {extras.map(extra => (
                <div key={extra.id}>
                  {editingExtraId === extra.id ? (
                    <div className="p-2.5 border border-primary/30 bg-primary/5 rounded-xl space-y-2">
                      <Input
                        className="h-7 text-sm"
                        value={editNome}
                        onChange={e => setEditNome(e.target.value)}
                        autoFocus
                        onKeyDown={e => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") cancelEdit(); }}
                      />
                      <div className="flex gap-1.5">
                        <div className="relative flex-1">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">R$</span>
                          <Input
                            type="number" step="0.01" min="0"
                            className="h-7 text-sm pl-6"
                            value={editPreco}
                            onChange={e => setEditPreco(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") cancelEdit(); }}
                          />
                        </div>
                        <button
                          onClick={handleSaveEdit}
                          disabled={savingEdit || !editNome.trim()}
                          className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
                        >
                          {savingEdit ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Salvar
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="h-7 px-2 rounded-md border border-border text-xs text-muted-foreground hover:bg-secondary"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
                        <Switch checked={editObrig} onCheckedChange={setEditObrig} className="scale-75" />
                        <span className="text-xs text-muted-foreground">
                          {editObrig ? <span className="text-destructive font-semibold">Obrigatório</span> : "Opcional"}
                        </span>
                      </label>
                    </div>
                  ) : (
                    <div className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors ${
                      extra.ativo ? "hover:bg-secondary/50" : "opacity-50 hover:bg-secondary/30"
                    }`}>
                      <Switch
                        checked={extra.ativo}
                        onCheckedChange={() => handleToggleAtivo(extra)}
                        className="scale-75 shrink-0"
                      />
                      <span className={`text-sm flex-1 truncate ${extra.ativo ? "" : "line-through text-muted-foreground"}`}>
                        {extra.nome}
                      </span>
                      {extra.obrigatorio && (
                        <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full shrink-0">
                          Obrig.
                        </span>
                      )}
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs font-semibold text-primary">
                          {Number(extra.preco) === 0 ? "Grátis" : `R$ ${Number(extra.preco).toFixed(2)}`}
                        </span>
                        <button
                          onClick={() => handleDuplicateExtra(extra)}
                          disabled={duplicatingExtraId === extra.id}
                          title="Duplicar"
                          className="p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                        >
                          {duplicatingExtraId === extra.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                          }
                        </button>
                        <button
                          onClick={() => startEdit(extra)}
                          className="p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteExtra(extra.id)}
                          disabled={deletingExtraId === extra.id}
                          className="p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                        >
                          {deletingExtraId === extra.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Trash2 className="w-3 h-3" />
                          }
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Grupos de Adicionais ──────────────────────── */}
      <GruposSection api={api} grupos={grupos} onChanged={onGrupoChanged} />

      {/* ── Promoções ───────────────────────────────────── */}
      <PromoDialog
        open={showPromoDialog}
        onClose={() => { setShowPromoDialog(false); setEditingPromo(null); }}
        promo={editingPromo}
        api={api}
        onSaved={onPromoCreated}
      />
      <Card className="shadow-sm border-border/50 overflow-hidden">
        <CardHeader className="pb-2 px-4 pt-4">
          <CardTitle className="text-sm flex items-center justify-between text-foreground">
            <span className="flex items-center gap-2">
              <TicketPercent className="w-3.5 h-3.5 text-primary" />
              Promoções
              {promocoes.filter(p => p.ativo).length > 0 && (
                <Badge className="text-[10px] h-4 px-1.5 bg-green-500/20 text-green-700 border-green-500/30 hover:bg-green-500/20">
                  {promocoes.filter(p => p.ativo).length} ativas
                </Badge>
              )}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => { setEditingPromo(null); setShowPromoDialog(true); }}
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {promocoes.length === 0 ? (
            <div className="text-center py-3">
              <p className="text-xs text-muted-foreground mb-2">Nenhuma promoção criada</p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
                onClick={() => { setEditingPromo(null); setShowPromoDialog(true); }}
              >
                <Plus className="w-3 h-3" /> Criar promoção
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {promocoes.map(promo => (
                <div
                  key={promo.id}
                  className={`group flex items-start gap-2 px-2.5 py-2 rounded-lg transition-colors ${
                    promo.ativo ? "hover:bg-secondary/50" : "opacity-50 hover:bg-secondary/30"
                  }`}
                >
                  <Switch
                    checked={promo.ativo}
                    onCheckedChange={() => handleTogglePromo(promo)}
                    className="scale-75 shrink-0 mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${promo.ativo ? "text-foreground" : "line-through text-muted-foreground"}`}>
                      {promo.nome}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                        {tipoIcon(promo.tipo)}{tipoLabel(promo)}
                      </span>
                      {promo.codigo_cupom && (
                        <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                          {promo.codigo_cupom}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                    <button
                      onClick={() => { setEditingPromo(promo); setShowPromoDialog(true); }}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeletePromo(promo.id)}
                      disabled={deletingPromoId === promo.id}
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    >
                      {deletingPromoId === promo.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Trash2 className="w-3 h-3" />
                      }
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </aside>
  );
}

// ── Add/Edit Product Dialog ───────────────────────────────────────────────────
function ProdutoDialog({
  open, onClose, categorias, extras, grupos, produto, api, onSaved,
}: {
  open: boolean; onClose: () => void;
  categorias: Categoria[]; extras: Extra[]; grupos: Grupo[];
  produto?: Produto | null; api: ReturnType<typeof useApi>;
  onSaved: () => void;
}) {
  const isEdit = !!produto;
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [selectedExtras, setSelectedExtras] = useState<Set<number>>(new Set());
  const [selectedGrupos, setSelectedGrupos] = useState<Set<number>>(new Set());
  const [grupoOverrides, setGrupoOverrides] = useState<Record<number, { min: string; max: string; obrig: boolean }>>({});
  const [tamanhos, setTamanhos] = useState<{ nome: string; preco: string }[]>([]);
  const [saving, setSaving] = useState(false);

  // ── Image upload state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setNome(produto?.nome ?? "");
      setDescricao(produto?.descricao ?? "");
      setPreco(produto ? String(produto.preco) : "");
      setCategoriaId(produto?.categoria_id ? String(produto.categoria_id) : "");
      setSelectedExtras(new Set((produto?.extras ?? []).map(e => e.id)));
      setSelectedGrupos(new Set());
      setGrupoOverrides({});
      setTamanhos(
        Array.isArray(produto?.tamanhos)
          ? produto!.tamanhos!.map(t => ({ nome: t.nome, preco: String(t.preco) }))
          : []
      );
      setImagePreview(produto?.imagem ?? null);
      setImageBlob(null);
      // ── Load grupos já vinculados ao produto (para edição) ──────────────
      if (produto?.id) {
        api.get(`produtos/${produto.id}/grupos`).then((rows: { id: number; min_selecoes: number | null; max_selecoes: number | null; obrigatorio: boolean | null }[]) => {
          if (Array.isArray(rows)) {
            const ids = new Set(rows.map(r => r.id));
            const ovs: Record<number, { min: string; max: string; obrig: boolean }> = {};
            for (const r of rows) {
              if (r.min_selecoes !== null || r.max_selecoes !== null || r.obrigatorio !== null) {
                ovs[r.id] = {
                  min: String(r.min_selecoes ?? ""),
                  max: String(r.max_selecoes ?? ""),
                  obrig: r.obrigatorio ?? false,
                };
              }
            }
            setSelectedGrupos(ids);
            setGrupoOverrides(ovs);
          }
        }).catch(() => {});
      }
    }
  }, [open, produto]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const blob = await resizeImageFile(file, 250, 280);
      const url = URL.createObjectURL(blob);
      setImagePreview(url);
      setImageBlob(blob);
    } finally {
      setUploadingImage(false);
    }
    e.target.value = "";
  };

  const toggleExtra = (id: number) => {
    setSelectedExtras(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleGrupo = (id: number) => {
    setSelectedGrupos(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    if (!nome.trim()) return;
    setSaving(true);
    const tamanhosClean = tamanhos
      .map(t => ({ nome: t.nome.trim(), preco: parseFloat(t.preco) || 0 }))
      .filter(t => t.nome.length > 0);
    const body = {
      nome: nome.trim(),
      descricao: descricao.trim() || undefined,
      preco: parseFloat(preco) || 0,
      categoriaId: categoriaId ? Number(categoriaId) : null,
      extraIds: Array.from(selectedExtras),
      tamanhos: tamanhosClean,
    };
    let produtoId: number | undefined = produto?.id;
    if (isEdit) {
      await api.patch(`produtos/${produto!.id}`, body);
    } else {
      const r = await api.post("produtos", body);
      produtoId = r?.id;
    }
    if (produtoId) {
      // Vincular grupos com overrides por produto (min/max/obrig ficam individuais)
      const overrides: Record<string, { min_selecoes: number; max_selecoes: number; obrigatorio: boolean }> = {};
      for (const [gidStr, ov] of Object.entries(grupoOverrides)) {
        overrides[gidStr] = {
          min_selecoes: parseInt(ov.min) || 0,
          max_selecoes: parseInt(ov.max) || 1,
          obrigatorio: ov.obrig,
        };
      }
      await api.put(`produtos/${produtoId}/grupos`, {
        grupoIds: Array.from(selectedGrupos),
        overrides,
      });
    }
    if (imageBlob && produtoId) {
      await api.uploadImage(produtoId, imageBlob, "webp");
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  const currentImage = imagePreview;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            {isEdit ? "Editar produto" : "Novo produto"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">

          {/* ── Image upload ── */}
          <div className="flex items-center gap-4">
            <div
              className="relative w-24 h-24 rounded-xl border-2 border-dashed border-border bg-secondary/40 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:border-primary/50 transition-colors group"
              onClick={() => fileInputRef.current?.click()}
            >
              {currentImage ? (
                <>
                  <img src={currentImage} alt="preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground/50">
                  {uploadingImage
                    ? <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    : <ImageIcon className="w-7 h-7" />
                  }
                  {!uploadingImage && <span className="text-[10px]">Sem imagem</span>}
                </div>
              )}
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium text-foreground">Imagem do produto</p>
              <p className="text-xs text-muted-foreground">Redimensionada automaticamente para max 250×280px. Formatos aceitos: JPG, PNG, WebP.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-2 text-xs mt-1"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
              >
                {uploadingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {currentImage ? "Alterar imagem" : "Escolher imagem"}
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <Select value={categoriaId} onValueChange={setCategoriaId}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Selecione categoria" />
            </SelectTrigger>
            <SelectContent>
              {categorias.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Nome do produto"
            value={nome}
            onChange={e => setNome(e.target.value)}
            className="text-base"
          />

          <Input
            placeholder="Descrição (opcional)"
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
          />

          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">R$</span>
            <Input
              type="number"
              step="0.01"
              placeholder={tamanhos.length > 0 ? "Preço base (não usado se há tamanhos)" : "0,00"}
              className="pl-9"
              value={preco}
              onChange={e => setPreco(e.target.value)}
            />
          </div>

          {/* ── Tamanhos / Variantes (ex: Pizza Brotinho/Grande) ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Tamanhos / Variantes</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => setTamanhos(prev => [...prev, { nome: "", preco: "" }])}
              >
                <Plus className="w-3 h-3" />
                Adicionar
              </Button>
            </div>
            {tamanhos.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Sem tamanhos. O cliente verá o preço base. Adicione (ex: Brotinho, Grande) para mostrar opções de tamanho com preços diferentes no app.
              </p>
            ) : (
              <div className="space-y-2">
                {tamanhos.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      placeholder="Nome (ex: Brotinho)"
                      value={t.nome}
                      onChange={e => setTamanhos(prev => prev.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))}
                      className="flex-1"
                    />
                    <div className="relative w-32">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">R$</span>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        className="pl-8"
                        value={t.preco}
                        onChange={e => setTamanhos(prev => prev.map((x, j) => j === i ? { ...x, preco: e.target.value } : x))}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive hover:bg-destructive/10"
                      onClick={() => setTamanhos(prev => prev.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {extras.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Pacotes / Kits disponíveis</p>
              <div className="border border-border rounded-lg divide-y divide-border/50 overflow-hidden">
                {extras.map(extra => {
                  const selected = selectedExtras.has(extra.id);
                  return (
                    <button
                      key={extra.id}
                      type="button"
                      onClick={() => toggleExtra(extra.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        selected ? "bg-primary/5" : "hover:bg-muted/50"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        selected ? "bg-primary border-primary" : "border-muted-foreground/30"
                      }`}>
                        {selected && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      <span className="flex-1 text-sm">{extra.nome}</span>
                      <span className="text-sm font-medium text-muted-foreground bg-secondary px-2.5 py-1 rounded-md">
                        R$ {Number(extra.preco).toFixed(0)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {grupos.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Grupos de Adicionais
              </p>
              <p className="text-xs text-muted-foreground -mt-1">Marque os grupos para vincular a este produto. Ajuste as quantidades abaixo.</p>
              <div className="border border-border rounded-lg divide-y divide-border/50 overflow-hidden">
                {grupos.filter(g => g.ativo).map(g => {
                  const selected = selectedGrupos.has(g.id);
                  const ov = grupoOverrides[g.id];
                  const curMin = ov ? ov.min : String(g.min_selecoes);
                  const curMax = ov ? ov.max : String(g.max_selecoes);
                  const curObrig = ov ? ov.obrig : g.obrigatorio;
                  const setOv = (patch: Partial<{ min: string; max: string; obrig: boolean }>) =>
                    setGrupoOverrides(prev => {
                      const existing = prev[g.id];
                      return {
                        ...prev,
                        [g.id]: {
                          min: existing?.min ?? String(g.min_selecoes),
                          max: existing?.max ?? String(g.max_selecoes),
                          obrig: existing?.obrig ?? g.obrigatorio,
                          ...patch,
                        },
                      };
                    });
                  return (
                    <div key={g.id}>
                      {/* Row principal — clica para selecionar/desselecionar */}
                      <button
                        type="button"
                        onClick={() => toggleGrupo(g.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                          selected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50"
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          selected ? "bg-primary border-primary" : "border-muted-foreground/30"
                        }`}>
                          {selected && <Check className="w-3 h-3 text-primary-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{g.nome}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {g.opcoes.filter(o => o.ativo).length} opç{g.opcoes.filter(o => o.ativo).length === 1 ? "ão" : "ões"} ativas
                            {curObrig && <span className="text-destructive font-semibold ml-1">• Obrigatório</span>}
                            {" "}• Escolha {curMin !== "0" ? `${curMin}–` : "até "}{curMax}
                          </p>
                        </div>
                      </button>
                      {/* Painel inline de qtd — só aparece quando selecionado */}
                      {selected && (
                        <div className="px-4 pb-3 pt-1 bg-primary/5 border-t border-primary/10 flex flex-wrap items-center gap-3">
                          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Quantidade de escolhas:</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">Mín.</span>
                            <Input
                              type="number" min="0" max={curMax}
                              className="h-7 w-14 text-xs text-center px-1"
                              value={curMin}
                              onClick={e => e.stopPropagation()}
                              onChange={e => setOv({ min: e.target.value })}
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">Máx.</span>
                            <Input
                              type="number" min="1"
                              className="h-7 w-14 text-xs text-center px-1"
                              value={curMax}
                              onClick={e => e.stopPropagation()}
                              onChange={e => setOv({ max: e.target.value })}
                            />
                          </div>
                          <label className="flex items-center gap-1.5 cursor-pointer ml-auto">
                            <Switch
                              checked={curObrig}
                              onCheckedChange={v => setOv({ obrig: v })}
                              className="scale-75"
                            />
                            <span className="text-xs">{curObrig ? <span className="text-destructive font-semibold">Obrigatório</span> : "Opcional"}</span>
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!nome.trim() || saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {isEdit ? "Salvar" : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Produtos Page ────────────────────────────────────────────────────────
export default function Produtos() {
  const { token, user } = useAuth();
  const api = useApi(token, user?.empresaId ?? null);

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [promocoes, setPromocoes] = useState<Promocao[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("todas");

  const [showAddProduto, setShowAddProduto] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [p, c, e, pr, g] = await Promise.all([
      api.get("produtos"),
      api.get("categorias"),
      api.get("extras"),
      api.get("promocoes"),
      api.get("grupos"),
    ]);
    setProdutos(Array.isArray(p) ? p : []);
    setCategorias(Array.isArray(c) ? c : []);
    setExtras(Array.isArray(e) ? e : []);
    setPromocoes(Array.isArray(pr) ? pr : []);
    setGrupos(Array.isArray(g) ? g : []);
    setLoading(false);
  }, [token]);

  useEffect(() => { if (token) fetchAll(); }, [token]);

  const handleToggleAtivo = async (produto: Produto) => {
    await api.patch(`produtos/${produto.id}`, { ativo: !produto.ativo });
    setProdutos(prev => prev.map(p => p.id === produto.id ? { ...p, ativo: !p.ativo } : p));
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    await api.del(`produtos/${id}`);
    setProdutos(prev => prev.filter(p => p.id !== id));
    setDeletingId(null);
  };

  const filtered = produtos.filter(p => {
    const matchCat = filterCat === "todas" || String(p.categoria_id) === filterCat;
    const matchSearch = !search || p.nome.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const grouped = filtered.reduce<Record<string, Produto[]>>((acc, p) => {
    const key = p.categoria_nome ?? "Sem Categoria";
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  return (
    <>
      <ProdutoDialog
        open={showAddProduto || !!editingProduto}
        onClose={() => { setShowAddProduto(false); setEditingProduto(null); }}
        categorias={categorias}
        extras={extras}
        grupos={grupos}
        produto={editingProduto}
        api={api}
        onSaved={fetchAll}
      />

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-6 max-w-7xl mx-auto">

        {/* ── Left Sidebar ───────────────────────────── */}
        <LeftSidebar
          categorias={categorias}
          extras={extras}
          produtos={produtos}
          promocoes={promocoes}
          grupos={grupos}
          api={api}
          filterCat={filterCat}
          setFilterCat={setFilterCat}
          onCategoriaCreated={fetchAll}
          onExtraCreated={fetchAll}
          onPromoCreated={fetchAll}
          onGrupoChanged={fetchAll}
          onExtraUpdated={fetchAll}
          onPromoUpdated={fetchAll}
          onCategoriaDeleted={id => {
            setCategorias(prev => prev.filter(c => c.id !== id));
            if (filterCat === String(id)) setFilterCat("todas");
          }}
          onExtraDeleted={id => setExtras(prev => prev.filter(e => e.id !== id))}
        />

        {/* ── Main Content ────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Catálogo de Produtos</h1>
              <p className="text-muted-foreground text-sm mt-0.5">Gerencie itens, preços e disponibilidade.</p>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-52">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar produto..." className="pl-9 h-9 bg-card" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Button className="bg-primary hover:bg-primary/90 shadow-sm gap-2 h-9 shrink-0" onClick={() => setShowAddProduto(true)}>
                <Plus className="w-4 h-4" />
                Novo item
              </Button>
            </div>
          </div>

          {/* Active category label */}
          {filterCat !== "todas" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ChevronRight className="w-4 h-4" />
              <span className="font-medium text-foreground">
                {categorias.find(c => String(c.id) === filterCat)?.nome}
              </span>
              <button onClick={() => setFilterCat("todas")} className="ml-1 text-xs hover:text-destructive underline">limpar filtro</button>
            </div>
          )}

          {/* Products */}
          {loading ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground gap-3">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Carregando catálogo...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
              <ShoppingBag className="w-12 h-12 opacity-20" />
              <p className="font-medium">Nenhum produto encontrado</p>
              <Button variant="outline" size="sm" onClick={() => setShowAddProduto(true)} className="gap-2">
                <Plus className="w-4 h-4" /> Adicionar primeiro produto
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([catName, items]) => (
                <div key={catName}>
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="font-semibold text-sm text-foreground">{catName}</h2>
                    <div className="h-px flex-1 bg-border/50" />
                    <Badge variant="secondary" className="text-xs">
                      {items.length} {items.length === 1 ? "item" : "itens"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {items.map(produto => (
                      <motion.div
                        key={produto.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`bg-card border rounded-xl p-4 shadow-sm flex flex-col gap-3 transition-all ${
                          produto.ativo ? "border-border/50" : "border-border/30 opacity-55"
                        }`}
                      >
                        {/* Image */}
                        <div
                          className="w-full aspect-video bg-secondary/50 rounded-lg flex items-center justify-center overflow-hidden cursor-pointer group relative"
                          onClick={() => setEditingProduto(produto)}
                        >
                          {produto.imagem ? (
                            <>
                              <img src={produto.imagem} alt={produto.nome} className="object-cover w-full h-full" />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Upload className="w-5 h-5 text-white" />
                              </div>
                            </>
                          ) : (
                            <div className="flex flex-col items-center gap-1 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors">
                              <Package className="w-7 h-7" />
                              <span className="text-[10px]">Clique para adicionar imagem</span>
                            </div>
                          )}
                        </div>

                        <div className="flex-1">
                          <p className="font-semibold text-sm leading-tight">{produto.nome}</p>
                          {produto.descricao && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{produto.descricao}</p>
                          )}
                          <p className="text-primary font-bold mt-1">R$ {Number(produto.preco).toFixed(2)}</p>
                          {produto.extras.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {produto.extras.slice(0, 3).map(e => (
                                <span key={e.id} className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full">
                                  {e.nome}
                                </span>
                              ))}
                              {produto.extras.length > 3 && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-secondary text-muted-foreground rounded-full">
                                  +{produto.extras.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between border-t border-border/50 pt-3">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={produto.ativo}
                              onCheckedChange={() => handleToggleAtivo(produto)}
                              className="scale-90"
                            />
                            <span className="text-xs text-muted-foreground">
                              {produto.ativo ? "Ativo" : "Inativo"}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost" size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                              onClick={() => setEditingProduto(produto)}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              disabled={deletingId === produto.id}
                              onClick={() => handleDelete(produto.id)}
                            >
                              {deletingId === produto.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Trash2 className="w-3.5 h-3.5" />
                              }
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
