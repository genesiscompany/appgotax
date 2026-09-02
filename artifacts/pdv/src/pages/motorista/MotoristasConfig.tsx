import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Building2, Plus, Pencil, Trash2, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.BASE_URL.replace(/\/$/, "").replace("/pdv", "") + "/api";
function apiHeaders(token: string | null) { return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }; }
function fmt(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

function ModalCentro({ centros, onClose, onSave, initial }: any) {
  const [form, setForm] = useState({ nome: initial?.nome ?? "", descricao: initial?.descricao ?? "", limite_mensal: initial?.limite_mensal ?? "" });
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md">
        <h3 className="font-bold text-lg mb-4">{initial ? "Editar" : "Novo"} Centro de Custo</h3>
        <div className="space-y-4">
          <div className="space-y-1.5"><label className="text-sm font-medium">Nome *</label>
            <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Secretaria de Saúde" className="h-11" /></div>
          <div className="space-y-1.5"><label className="text-sm font-medium">Descrição</label>
            <Input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descrição opcional" className="h-11" /></div>
          <div className="space-y-1.5"><label className="text-sm font-medium">Limite mensal (R$)</label>
            <Input type="number" step="0.01" value={form.limite_mensal} onChange={e => setForm(f => ({ ...f, limite_mensal: e.target.value }))} placeholder="0,00" className="h-11" /></div>
        </div>
        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button onClick={() => onSave(form)} className="flex-1" disabled={!form.nome}>Salvar</Button>
        </div>
      </div>
    </div>
  );
}

function ModalFuncionario({ centros, onClose, onSave, initial }: any) {
  const [form, setForm] = useState({
    nome: initial?.nome ?? "", email: initial?.email ?? "", cargo: initial?.cargo ?? "",
    telefone: initial?.telefone ?? "", centro_custo_id: initial?.centro_custo_id ?? "",
    pode_solicitar: initial?.pode_solicitar !== false, precisa_aprovacao: initial?.precisa_aprovacao === true,
    limite_corrida: initial?.limite_corrida ?? "",
  });
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-lg mb-4">{initial ? "Editar" : "Novo"} Funcionário</h3>
        <div className="space-y-4">
          <div className="space-y-1.5"><label className="text-sm font-medium">Nome *</label>
            <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome completo" className="h-11" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><label className="text-sm font-medium">E-mail</label>
              <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@empresa.com" className="h-11" /></div>
            <div className="space-y-1.5"><label className="text-sm font-medium">Cargo</label>
              <Input value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} placeholder="Ex: Médico" className="h-11" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><label className="text-sm font-medium">Telefone</label>
              <Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(00) 00000-0000" className="h-11" /></div>
            <div className="space-y-1.5"><label className="text-sm font-medium">Centro de custo</label>
              <select value={form.centro_custo_id} onChange={e => setForm(f => ({ ...f, centro_custo_id: e.target.value }))}
                className="w-full h-11 rounded-lg border border-input bg-background px-3 text-sm">
                <option value="">Nenhum</option>
                {centros.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5"><label className="text-sm font-medium">Limite por corrida (R$)</label>
            <Input type="number" step="0.01" value={form.limite_corrida} onChange={e => setForm(f => ({ ...f, limite_corrida: e.target.value }))}
              placeholder="Deixe vazio = sem limite" className="h-11" /></div>
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.pode_solicitar} onChange={e => setForm(f => ({ ...f, pode_solicitar: e.target.checked }))} className="w-4 h-4 rounded" />
              <span className="text-sm">Pode solicitar corridas</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.precisa_aprovacao} onChange={e => setForm(f => ({ ...f, precisa_aprovacao: e.target.checked }))} className="w-4 h-4 rounded" />
              <span className="text-sm">Requer aprovação do gestor</span>
            </label>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button onClick={() => onSave(form)} className="flex-1" disabled={!form.nome}>Salvar</Button>
        </div>
      </div>
    </div>
  );
}

export default function MotoristasConfig() {
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"centros" | "funcionarios">("centros");
  const [modalCentro, setModalCentro] = useState<any>(null);
  const [modalFunc, setModalFunc] = useState<any>(null);

  const { data: centros = [], isLoading: loadC } = useQuery({
    queryKey: ["corp-centros"], queryFn: async () => { const r = await fetch(`${API}/pdv/corporativo/centros-custo`, { headers: apiHeaders(token) }); return r.json(); },
  });
  const { data: funcionarios = [], isLoading: loadF } = useQuery({
    queryKey: ["corp-funcionarios"], queryFn: async () => { const r = await fetch(`${API}/pdv/corporativo/funcionarios`, { headers: apiHeaders(token) }); return r.json(); },
  });

  const saveCentro = useMutation({
    mutationFn: async (d: any) => {
      const isEdit = !!d.id;
      const r = await fetch(`${API}/pdv/corporativo/centros-custo${isEdit ? `/${d.id}` : ""}`, {
        method: isEdit ? "PUT" : "POST", headers: apiHeaders(token), body: JSON.stringify(d),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["corp-centros"] }); setModalCentro(null); toast({ title: "Salvo!" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const delCentro = useMutation({
    mutationFn: async (id: number) => { await fetch(`${API}/pdv/corporativo/centros-custo/${id}`, { method: "DELETE", headers: apiHeaders(token) }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["corp-centros"] }); toast({ title: "Removido" }); },
  });

  const saveFunc = useMutation({
    mutationFn: async (d: any) => {
      const isEdit = !!d.id;
      const r = await fetch(`${API}/pdv/corporativo/funcionarios${isEdit ? `/${d.id}` : ""}`, {
        method: isEdit ? "PUT" : "POST", headers: apiHeaders(token), body: JSON.stringify(d),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["corp-funcionarios"] }); setModalFunc(null); toast({ title: "Salvo!" }); },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const delFunc = useMutation({
    mutationFn: async (id: number) => { await fetch(`${API}/pdv/corporativo/funcionarios/${id}`, { method: "DELETE", headers: apiHeaders(token) }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["corp-funcionarios"] }); toast({ title: "Removido" }); },
  });

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-bold mb-2">Configurações GoTaxi Pro</h1>
      <p className="text-sm text-muted-foreground mb-6">Gerencie centros de custo e funcionários</p>

      {/* Tabs */}
      <div className="flex border border-border rounded-xl overflow-hidden mb-6 w-fit">
        {([["centros", Building2, "Centros de Custo"], ["funcionarios", Users, "Funcionários"]] as any[]).map(([k, Icon, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors ${tab === k ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            <Icon className="w-4 h-4" />{l}
          </button>
        ))}
      </div>

      {tab === "centros" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setModalCentro({})} className="gap-2"><Plus className="w-4 h-4" />Novo Centro</Button>
          </div>
          {loadC ? <div className="flex justify-center py-8"><div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
            : centros.length === 0 ? <div className="text-center py-12 text-muted-foreground bg-card border border-border rounded-xl"><Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>Nenhum centro de custo cadastrado</p></div>
            : (
              <div className="space-y-3">
                {centros.map((c: any) => (
                  <div key={c.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-purple-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{c.nome}</p>
                      {c.descricao && <p className="text-xs text-muted-foreground">{c.descricao}</p>}
                      <p className="text-xs text-muted-foreground mt-1">Limite: {fmt(Number(c.limite_mensal ?? 0))}/mês · {c.ativo ? "✅ Ativo" : "❌ Inativo"}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setModalCentro(c)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors">
                        <Pencil className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button onClick={() => { if (confirm("Remover este centro?")) delCentro.mutate(c.id); }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-destructive/10 transition-colors">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {tab === "funcionarios" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setModalFunc({})} className="gap-2"><Plus className="w-4 h-4" />Novo Funcionário</Button>
          </div>
          {loadF ? <div className="flex justify-center py-8"><div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
            : funcionarios.length === 0 ? <div className="text-center py-12 text-muted-foreground bg-card border border-border rounded-xl"><Users className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>Nenhum funcionário cadastrado</p></div>
            : (
              <div className="space-y-3">
                {funcionarios.map((f: any) => (
                  <div key={f.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 text-sm font-bold text-blue-500">
                      {f.nome.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{f.nome}</p>
                        {f.cargo && <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{f.cargo}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {f.centro_custo_nome ?? "Sem centro"} ·{" "}
                        {f.pode_solicitar ? <span className="text-green-500">Pode solicitar</span> : <span className="text-red-500">Bloqueado</span>}
                        {f.precisa_aprovacao && " · Requer aprovação"}
                        {f.limite_corrida && ` · Limite: ${fmt(Number(f.limite_corrida))}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setModalFunc(f)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors">
                        <Pencil className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button onClick={() => { if (confirm("Remover funcionário?")) delFunc.mutate(f.id); }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-destructive/10 transition-colors">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {modalCentro !== null && (
        <ModalCentro centros={centros} initial={modalCentro.id ? modalCentro : null} onClose={() => setModalCentro(null)}
          onSave={(d: any) => saveCentro.mutate(modalCentro.id ? { ...d, id: modalCentro.id } : d)} />
      )}
      {modalFunc !== null && (
        <ModalFuncionario centros={centros} initial={modalFunc.id ? modalFunc : null} onClose={() => setModalFunc(null)}
          onSave={(d: any) => saveFunc.mutate(modalFunc.id ? { ...d, id: modalFunc.id } : d)} />
      )}
    </div>
  );
}
