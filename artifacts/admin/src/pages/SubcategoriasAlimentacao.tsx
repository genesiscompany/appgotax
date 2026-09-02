import React, { useEffect, useState } from "react";
import { useAuth, authHeaders } from "@/lib/auth";

type Subcategoria = {
  id: number;
  nome: string;
  slug: string;
  emoji: string | null;
  ordem: number;
  ativo: boolean;
};

const SUB_API = "/api/subcategorias-alimentacao";

function SubcategoriaModal({
  sub,
  onClose,
  onSave,
}: {
  sub: Partial<Subcategoria> | null;
  onClose: () => void;
  onSave: (data: { nome: string; emoji: string; ordem: number; ativo: boolean }) => void;
}) {
  const [nome, setNome] = useState(sub?.nome || "");
  const [emoji, setEmoji] = useState(sub?.emoji || "");
  const [ordem, setOrdem] = useState(String(sub?.ordem ?? 0));
  const [ativo, setAtivo] = useState(sub?.ativo !== false);
  const isEdit = !!sub?.id;

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-foreground">
            {isEdit ? "Editar Subcategoria" : "Nova Subcategoria"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Nome da Subcategoria
            </label>
            <input
              className="mt-1 w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Ex: Pizzaria"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Emoji</label>
              <input
                className="mt-1 w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground text-2xl text-center focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="🍕"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                maxLength={4}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ordem</label>
              <input
                type="number"
                className="mt-1 w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={ordem}
                onChange={(e) => setOrdem(e.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(e) => setAtivo(e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-sm text-foreground">Ativa (aparece no app)</span>
          </label>
        </div>

        <button
          onClick={() => {
            if (!nome.trim()) return;
            onSave({
              nome: nome.trim(),
              emoji: emoji.trim(),
              ordem: Number(ordem) || 0,
              ativo,
            });
          }}
          disabled={!nome.trim()}
          className="mt-6 w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 hover:bg-primary/90 transition-colors"
        >
          {isEdit ? "Salvar Alterações" : "Criar Subcategoria"}
        </button>
      </div>
    </div>
  );
}

export default function SubcategoriasAlimentacao() {
  const { token } = useAuth();
  const [items, setItems] = useState<Subcategoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Subcategoria> | null>(null);
  const [showModal, setShowModal] = useState(false);

  const carregar = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${SUB_API}/admin`, { headers: authHeaders(token) });
      if (!res.ok) throw new Error("Falha ao carregar");
      const data = await res.json();
      setItems(data);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Erro");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) carregar();
  }, [token]);

  const salvar = async (form: { nome: string; emoji: string; ordem: number; ativo: boolean }) => {
    try {
      const isEdit = !!editing?.id;
      const url = isEdit ? `${SUB_API}/admin/${editing!.id}` : `${SUB_API}/admin`;
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: authHeaders(token),
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.error === "duplicada") {
          alert("Já existe uma subcategoria com esse nome.");
        } else {
          alert("Não foi possível salvar.");
        }
        return;
      }
      setShowModal(false);
      setEditing(null);
      carregar();
    } catch {
      alert("Erro ao salvar.");
    }
  };

  const desativar = async (sub: Subcategoria) => {
    if (!confirm(`Desativar "${sub.nome}"? Ela não aparecerá mais no app.`)) return;
    try {
      const res = await fetch(`${SUB_API}/admin/${sub.id}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });
      if (!res.ok) {
        alert("Erro ao desativar.");
        return;
      }
      carregar();
    } catch {
      alert("Erro ao desativar.");
    }
  };

  const reativar = async (sub: Subcategoria) => {
    try {
      const res = await fetch(`${SUB_API}/admin/${sub.id}`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({ ativo: true }),
      });
      if (!res.ok) {
        alert("Erro ao reativar.");
        return;
      }
      carregar();
    } catch {
      alert("Erro ao reativar.");
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Subcategorias de Alimentação</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Defina os tipos de loja (Pizzaria, Hamburgueria, etc.) que os parceiros podem escolher.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowModal(true);
          }}
          className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
        >
          + Nova Subcategoria
        </button>
      </div>

      {loading && <div className="text-muted-foreground text-sm">Carregando...</div>}
      {error && <div className="text-red-500 text-sm">{error}</div>}

      {!loading && !error && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-border bg-secondary/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <div className="col-span-1">Emoji</div>
            <div className="col-span-5">Nome</div>
            <div className="col-span-2">Slug</div>
            <div className="col-span-1 text-center">Ordem</div>
            <div className="col-span-1 text-center">Status</div>
            <div className="col-span-2 text-right">Ações</div>
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              Nenhuma subcategoria cadastrada.
            </div>
          ) : (
            items.map((sub) => (
              <div
                key={sub.id}
                className={`grid grid-cols-12 gap-3 px-4 py-3 border-b border-border items-center text-sm ${
                  !sub.ativo ? "opacity-50" : ""
                }`}
              >
                <div className="col-span-1 text-2xl">{sub.emoji || "—"}</div>
                <div className="col-span-5 font-semibold text-foreground">{sub.nome}</div>
                <div className="col-span-2 text-muted-foreground text-xs font-mono">{sub.slug}</div>
                <div className="col-span-1 text-center text-muted-foreground">{sub.ordem}</div>
                <div className="col-span-1 text-center">
                  {sub.ativo ? (
                    <span className="text-xs px-2 py-1 rounded-full bg-green-500/15 text-green-600 dark:text-green-400 font-semibold">
                      Ativa
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-500/15 text-gray-500 font-semibold">
                      Inativa
                    </span>
                  )}
                </div>
                <div className="col-span-2 flex items-center justify-end gap-2">
                  <button
                    onClick={() => {
                      setEditing(sub);
                      setShowModal(true);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/70 text-foreground transition-colors"
                  >
                    Editar
                  </button>
                  {sub.ativo ? (
                    <button
                      onClick={() => desativar(sub)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/15 hover:bg-red-500/25 text-red-600 dark:text-red-400 transition-colors"
                    >
                      Desativar
                    </button>
                  ) : (
                    <button
                      onClick={() => reativar(sub)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-500/15 hover:bg-green-500/25 text-green-600 dark:text-green-400 transition-colors"
                    >
                      Reativar
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showModal && (
        <SubcategoriaModal
          sub={editing}
          onClose={() => {
            setShowModal(false);
            setEditing(null);
          }}
          onSave={salvar}
        />
      )}
    </div>
  );
}
