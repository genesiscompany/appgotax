import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";

const API = "/api";

interface Motivo {
  id: number;
  texto: string;
  ativo: boolean;
  criado_em: string;
}

export default function MotivosCancelamento() {
  const { token } = useAuth();
  const [motivos, setMotivos] = useState<Motivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoTexto, setNovoTexto] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editTexto, setEditTexto] = useState("");

  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/admin/motivos-cancelamento`, { headers });
      if (res.ok) setMotivos(await res.json());
    } catch {}
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!novoTexto.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`${API}/admin/motivos-cancelamento`, {
        method: "POST", headers,
        body: JSON.stringify({ texto: novoTexto.trim() }),
      });
      if (res.ok) { setNovoTexto(""); await load(); }
    } catch {}
    setAdding(false);
  };

  const handleToggle = async (motivo: Motivo) => {
    try {
      await fetch(`${API}/admin/motivos-cancelamento/${motivo.id}`, {
        method: "PUT", headers,
        body: JSON.stringify({ ativo: !motivo.ativo }),
      });
      await load();
    } catch {}
  };

  const handleSaveEdit = async (id: number) => {
    if (!editTexto.trim()) return;
    try {
      await fetch(`${API}/admin/motivos-cancelamento/${id}`, {
        method: "PUT", headers,
        body: JSON.stringify({ texto: editTexto.trim() }),
      });
      setEditId(null);
      await load();
    } catch {}
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir este motivo permanentemente?")) return;
    try {
      await fetch(`${API}/admin/motivos-cancelamento/${id}`, { method: "DELETE", headers });
      await load();
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Motivos de Cancelamento</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie os motivos que o motorista pode selecionar ao cancelar uma corrida.
        </p>
      </div>

      {/* Add new */}
      <div className="bg-card border border-border rounded-xl p-5 flex gap-3 items-center">
        <input
          className="flex-1 bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Novo motivo de cancelamento..."
          value={novoTexto}
          onChange={e => setNovoTexto(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
          disabled={adding}
        />
        <button
          onClick={handleAdd}
          disabled={adding || !novoTexto.trim()}
          className="bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors"
        >
          {adding ? "Adicionando..." : "Adicionar"}
        </button>
      </div>

      {/* List */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Carregando...
          </div>
        ) : motivos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <span className="text-3xl">🚫</span>
            <p className="text-muted-foreground text-sm">Nenhum motivo cadastrado.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-5 py-3 font-semibold text-muted-foreground">Motivo</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground w-28">Status</th>
                <th className="text-right px-5 py-3 font-semibold text-muted-foreground w-40">Ações</th>
              </tr>
            </thead>
            <tbody>
              {motivos.map((m, i) => (
                <tr key={m.id} className={`border-b border-border last:border-0 ${!m.ativo ? "opacity-50" : ""}`}>
                  <td className="px-5 py-3.5">
                    {editId === m.id ? (
                      <div className="flex gap-2">
                        <input
                          className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                          value={editTexto}
                          onChange={e => setEditTexto(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && handleSaveEdit(m.id)}
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveEdit(m.id)}
                          className="bg-primary text-primary-foreground px-3 py-1 rounded-md text-xs font-semibold hover:bg-primary/90"
                        >
                          Salvar
                        </button>
                        <button
                          onClick={() => setEditId(null)}
                          className="text-muted-foreground hover:text-foreground px-2 py-1 rounded-md text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <span className="text-foreground font-medium">{m.texto}</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <button
                      onClick={() => handleToggle(m)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                        m.ativo
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${m.ativo ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                      {m.ativo ? "Ativo" : "Inativo"}
                    </button>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => { setEditId(m.id); setEditTexto(m.texto); }}
                        className="text-xs text-muted-foreground hover:text-foreground font-medium px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="text-xs text-destructive hover:text-destructive/80 font-medium px-3 py-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Motivos inativos não aparecem para o motorista. Você pode reativá-los clicando no status.
      </p>
    </div>
  );
}
