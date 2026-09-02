import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Car, Plus, Pencil, Trash2, X, CheckCircle2, Loader2,
  Phone, User, ToggleLeft, ToggleRight, Hash,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";

interface Motorista {
  id: number;
  nome: string;
  telefone?: string;
  veiculo?: string;
  placa?: string;
  ativo: boolean;
  criado_em: string;
}

const EMPTY = { nome: "", telefone: "", veiculo: "", placa: "" };

export default function Motoristas() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [items, setItems] = useState<Motorista[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Motorista | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/api/pdv/motoristas", { headers })
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY });
    setError("");
    setShowModal(true);
  };

  const openEdit = (m: Motorista) => {
    setEditing(m);
    setForm({ nome: m.nome, telefone: m.telefone || "", veiculo: m.veiculo || "", placa: m.placa || "" });
    setError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) { setError("Informe o nome do motorista"); return; }
    setSaving(true); setError("");
    const body = {
      nome: form.nome.trim(),
      telefone: form.telefone.trim() || undefined,
      veiculo: form.veiculo.trim() || undefined,
      placa: form.placa.trim() || undefined,
    };
    const res = await fetch(editing ? `/api/pdv/motoristas/${editing.id}` : "/api/pdv/motoristas", {
      method: editing ? "PATCH" : "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (res.ok) { setShowModal(false); load(); }
    else setError("Erro ao salvar. Tente novamente.");
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir este motorista?")) return;
    await fetch(`/api/pdv/motoristas/${id}`, { method: "DELETE", headers });
    load();
  };

  const toggleAtivo = async (m: Motorista) => {
    await fetch(`/api/pdv/motoristas/${m.id}`, {
      method: "PATCH", headers, body: JSON.stringify({ ativo: !m.ativo }),
    });
    load();
  };

  const set = (k: keyof typeof EMPTY, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Car className="w-7 h-7 text-primary" /> Meus Motoristas
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie os entregadores vinculados à sua loja.</p>
        </div>
        <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 shadow-md shadow-primary/20">
          <Plus className="w-4 h-4 mr-2" /> Cadastrar Motorista
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
              <Car className="w-8 h-8 text-primary/60" />
            </div>
            <p className="text-lg font-semibold text-foreground">Nenhum motorista cadastrado</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Cadastre os entregadores da sua loja para gerenciar suas entregas com mais eficiência.
            </p>
            <Button onClick={openCreate} className="mt-2"><Plus className="w-4 h-4 mr-2" />Cadastrar Primeiro Motorista</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map(m => (
            <motion.div key={m.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className={`shadow-sm border-border/50 overflow-hidden transition-all ${!m.ativo ? "opacity-60" : ""}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${m.ativo ? "bg-primary/10" : "bg-secondary"}`}>
                      <span className={`text-xl font-bold ${m.ativo ? "text-primary" : "text-muted-foreground"}`}>
                        {m.nome.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground truncate">{m.nome}</span>
                        <Badge className={`text-[10px] border-0 shrink-0 ${m.ativo ? "bg-green-500/15 text-green-600" : "bg-secondary text-muted-foreground"}`}>
                          {m.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      {m.telefone && (
                        <a href={`tel:${m.telefone}`} className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 hover:text-foreground transition-colors">
                          <Phone className="w-3 h-3" /> {m.telefone}
                        </a>
                      )}
                    </div>
                  </div>

                  {(m.veiculo || m.placa) && (
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {m.veiculo && (
                        <span className="flex items-center gap-1 bg-secondary/60 px-2.5 py-1.5 rounded-lg">
                          <Car className="w-3 h-3" /> {m.veiculo}
                        </span>
                      )}
                      {m.placa && (
                        <span className="flex items-center gap-1.5 bg-secondary/60 px-2.5 py-1.5 rounded-lg font-mono font-bold text-foreground">
                          <Hash className="w-3 h-3" /> {m.placa}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-border/40">
                    <button
                      onClick={() => toggleAtivo(m)}
                      className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${m.ativo ? "text-green-600" : "text-muted-foreground"}`}
                    >
                      {m.ativo ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      {m.ativo ? "Disponível" : "Inativo"}
                    </button>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
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
              className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-bold text-lg flex items-center gap-2">
                  <Car className="w-5 h-5 text-primary" />
                  {editing ? "Editar Motorista" : "Novo Motorista"}
                </h2>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-secondary"><X className="w-4 h-4" /></button>
              </div>

              <div className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1.5"><User className="w-3.5 h-3.5" />Nome completo *</label>
                  <Input placeholder="Ex: Carlos Oliveira" value={form.nome} onChange={e => set("nome", e.target.value)} autoFocus />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />Telefone / WhatsApp</label>
                  <Input placeholder="(11) 99999-9999" value={form.telefone} onChange={e => set("telefone", e.target.value)} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5"><Car className="w-3.5 h-3.5" />Veículo</label>
                    <Input placeholder="Ex: Moto Honda" value={form.veiculo} onChange={e => set("veiculo", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" />Placa</label>
                    <Input
                      placeholder="ABC-1234"
                      value={form.placa}
                      onChange={e => set("placa", e.target.value.toUpperCase())}
                      className="font-mono"
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
