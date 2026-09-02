import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Search, Plus, Pencil, Trash2, X, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const BASE = "/api";

type Cliente = { id: number; nome: string; telefone: string; documento: string; endereco: string; cidade: string };
const EMPTY: Partial<Cliente> = { nome: "", telefone: "", documento: "", endereco: "", cidade: "" };

export default function EncomendaClientes() {
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Cliente>>(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);

  const { data: clientes, isLoading } = useQuery({
    queryKey: ["enc-clientes", busca],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (busca) params.set("busca", busca);
      const r = await fetch(`${BASE}/pdv/encomendas/clientes?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
  });

  const save = useMutation({
    mutationFn: async (body: Partial<Cliente>) => {
      const url = editId ? `${BASE}/pdv/encomendas/clientes/${editId}` : `${BASE}/pdv/encomendas/clientes`;
      const r = await fetch(url, {
        method: editId ? "PUT" : "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => {
      toast({ title: editId ? "Cliente atualizado!" : "Cliente cadastrado!" });
      qc.invalidateQueries({ queryKey: ["enc-clientes"] });
      setModalOpen(false);
      setEditing(EMPTY);
      setEditId(null);
    },
    onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`${BASE}/pdv/encomendas/clientes/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    onSuccess: () => {
      toast({ title: "Cliente removido" });
      qc.invalidateQueries({ queryKey: ["enc-clientes"] });
    },
  });

  const openNew = () => { setEditing(EMPTY); setEditId(null); setModalOpen(true); };
  const openEdit = (c: Cliente) => { setEditing({ ...c }); setEditId(c.id); setModalOpen(true); };
  const f = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setEditing(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="w-6 h-6 text-orange-500" />Clientes de Encomendas</h1>
          <p className="text-muted-foreground text-sm">Cadastre e gerencie remetentes e destinatários</p>
        </div>
        <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" />Novo Cliente
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
        <Input className="pl-8 h-9" placeholder="Buscar por nome, telefone, CPF…" value={busca} onChange={e => setBusca(e.target.value)} />
      </div>

      {isLoading && <div className="text-center py-12 text-muted-foreground">Carregando…</div>}
      {!isLoading && !clientes?.length && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
          Nenhum cliente cadastrado. <Button variant="link" className="p-0" onClick={openNew}>Cadastrar agora</Button>
        </CardContent></Card>
      )}
      {!isLoading && clientes?.length > 0 && (
        <div className="grid md:grid-cols-2 gap-3">
          {clientes.map((c: Cliente) => (
            <Card key={c.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="py-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{c.nome}</p>
                    {c.telefone && <p className="text-sm text-muted-foreground">📞 {c.telefone}</p>}
                    {c.documento && <p className="text-sm text-muted-foreground">🪪 {c.documento}</p>}
                    {c.endereco && <p className="text-sm text-muted-foreground">📍 {c.endereco}{c.cidade ? ` — ${c.cidade}` : ""}</p>}
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => {
                      if (confirm("Remover cliente?")) del.mutate(c.id);
                    }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label className="text-xs">Nome *</Label><Input className="h-9" placeholder="Nome completo" value={editing.nome ?? ""} onChange={f("nome")} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Telefone</Label><Input className="h-9" placeholder="(00) 00000-0000" value={editing.telefone ?? ""} onChange={f("telefone")} /></div>
              <div><Label className="text-xs">CPF / CNPJ</Label><Input className="h-9" placeholder="000.000.000-00" value={editing.documento ?? ""} onChange={f("documento")} /></div>
            </div>
            <div><Label className="text-xs">Endereço</Label><Input className="h-9" placeholder="Rua, número, bairro" value={editing.endereco ?? ""} onChange={f("endereco")} /></div>
            <div><Label className="text-xs">Cidade</Label><Input className="h-9" placeholder="Ex: Belo Horizonte" value={editing.cidade ?? ""} onChange={f("cidade")} /></div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}><X className="w-4 h-4 mr-1" />Cancelar</Button>
              <Button className="flex-1 bg-orange-500 hover:bg-orange-600 text-white" onClick={() => save.mutate(editing)} disabled={save.isPending || !editing.nome?.trim()}>
                <Save className="w-4 h-4 mr-1" />{save.isPending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
