import React, { useEffect, useState, useCallback } from "react";
import { Search, Plus, User, Phone, Mail, CreditCard, Edit2, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const API = "/api/pdv/viagens";

type Cliente = {
  id: number;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  data_nascimento: string | null;
  criado_em: string;
};

type FormData = { nome: string; cpf: string; telefone: string; email: string; data_nascimento: string };
const EMPTY: FormData = { nome: "", cpf: "", telefone: "", email: "", data_nascimento: "" };

function ClienteModal({
  cliente,
  onClose,
  onSaved,
  token,
}: { cliente: Cliente | null; onClose: () => void; onSaved: () => void; token: string | null }) {
  const [form, setForm] = useState<FormData>(cliente ? {
    nome: cliente.nome,
    cpf: cliente.cpf ?? "",
    telefone: cliente.telefone ?? "",
    email: cliente.email ?? "",
    data_nascimento: cliente.data_nascimento ?? "",
  } : EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof FormData, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.nome.trim()) { setError("Nome obrigatório"); return; }
    setSaving(true); setError(null);
    try {
      const url = cliente ? `${API}/clientes/${cliente.id}` : `${API}/clientes`;
      const method = cliente ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ nome: form.nome.trim(), cpf: form.cpf || null, telefone: form.telefone || null, email: form.email || null, data_nascimento: form.data_nascimento || null }),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-border/60">
          <h3 className="font-bold text-foreground">{cliente ? "Editar Cliente" : "Novo Cliente"}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {error && <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">{error}</div>}

          {[
            { label: "Nome completo *", key: "nome" as keyof FormData, type: "text", placeholder: "Ex: João da Silva" },
            { label: "CPF", key: "cpf" as keyof FormData, type: "text", placeholder: "000.000.000-00" },
            { label: "Telefone / WhatsApp", key: "telefone" as keyof FormData, type: "tel", placeholder: "(00) 00000-0000" },
            { label: "E-mail", key: "email" as keyof FormData, type: "email", placeholder: "email@exemplo.com" },
            { label: "Data de nascimento", key: "data_nascimento" as keyof FormData, type: "date", placeholder: "" },
          ].map(field => (
            <div key={field.key}>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">{field.label}</label>
              <input
                type={field.type}
                placeholder={field.placeholder}
                value={form[field.key]}
                onChange={e => set(field.key, e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          ))}
        </div>

        <div className="p-5 pt-0 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <button onClick={onClose} className="flex-1 bg-secondary text-muted-foreground rounded-xl py-2.5 text-sm font-semibold hover:bg-secondary/80 transition-colors">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDelete({ nome, onConfirm, onCancel, loading }: { nome: string; onConfirm: () => void; onCancel: () => void; loading: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-xl p-6 space-y-4">
        <h3 className="font-bold text-foreground">Confirmar exclusão?</h3>
        <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir o cliente <strong className="text-foreground">{nome}</strong>? Esta ação não pode ser desfeita.</p>
        <div className="flex gap-3">
          <button onClick={onConfirm} disabled={loading} className="flex-1 bg-destructive text-white rounded-xl py-2 text-sm font-semibold hover:bg-destructive/90 transition-colors disabled:opacity-50">
            {loading ? "Excluindo..." : "Excluir"}
          </button>
          <button onClick={onCancel} className="flex-1 bg-secondary text-muted-foreground rounded-xl py-2 text-sm font-semibold">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

export default function ViagensClientes() {
  const { token } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"new" | "edit" | null>(null);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [deleting, setDeleting] = useState<Cliente | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    fetch(`${API}/clientes?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setClientes(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token, search]);

  useEffect(load, [load]);

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    await fetch(`${API}/clientes/${deleting.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setDeleteLoading(false);
    setDeleting(null);
    load();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground text-sm mt-1">Cadastro de passageiros</p>
        </div>
        <button
          onClick={() => { setEditing(null); setModal("new"); }}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Cliente
        </button>
      </div>

      <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2.5">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          type="text"
          placeholder="Buscar por nome, CPF ou telefone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground gap-2 text-sm">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Carregando...
        </div>
      ) : !clientes.length ? (
        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2 bg-card border border-border rounded-2xl">
          <User className="w-8 h-8 opacity-30" />
          <p className="text-sm">{search ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}</p>
          {!search && <button onClick={() => setModal("new")} className="text-primary text-xs hover:underline">Cadastrar primeiro cliente</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {clientes.map(c => (
            <div key={c.id} className="bg-card border border-border rounded-2xl p-4 hover:border-border/80 transition-all group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-primary font-bold text-sm">{c.nome.charAt(0)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{c.nome}</p>
                    {c.cpf && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <CreditCard className="w-3 h-3 shrink-0" />
                        {c.cpf}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditing(c); setModal("edit"); }}
                    className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleting(c)}
                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                {c.telefone && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="w-3 h-3 shrink-0" />
                    {c.telefone}
                  </div>
                )}
                {c.email && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="w-3 h-3 shrink-0" />
                    {c.email}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(modal === "new" || modal === "edit") && (
        <ClienteModal
          cliente={modal === "edit" ? editing : null}
          onClose={() => { setModal(null); setEditing(null); }}
          onSaved={load}
          token={token}
        />
      )}

      {deleting && (
        <ConfirmDelete
          nome={deleting.nome}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}
