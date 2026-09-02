import React, { useEffect, useState } from "react";
import { useAuth, API, authHeaders } from "@/lib/auth";

type Usuario = {
  id: number; nome: string; email: string; papel: string;
  empresa_id?: number | null; empresa_nome?: string; criado_em: string;
};

type EmpresaOpt = { id: number; nome: string };

const PAPEL_BADGE: Record<string, string> = {
  admin: "bg-red-500/15 text-red-400 border border-red-500/20",
  parceiro: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  cliente: "bg-green-500/15 text-green-400 border border-green-500/20",
};

const PAPEIS_EDITAVEIS = ["admin", "parceiro", "cliente"];

function EditarUsuarioModal({
  usuario,
  empresas,
  onClose,
  onSaved,
  token,
}: {
  usuario: Usuario;
  empresas: EmpresaOpt[];
  onClose: () => void;
  onSaved: (u: Partial<Usuario>) => void;
  token: string | null;
}) {
  const [nome, setNome] = useState(usuario.nome);
  const [email, setEmail] = useState(usuario.email);
  const [papel, setPapel] = useState(usuario.papel);
  const [empresaId, setEmpresaId] = useState<string>(
    usuario.empresa_id != null ? String(usuario.empresa_id) : ""
  );
  const [novaSenha, setNovaSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailOriginal = (usuario.email || "").toLowerCase();
  const empresaOriginalId = usuario.empresa_id != null ? String(usuario.empresa_id) : "";

  const handleSave = async () => {
    const nomeT = nome.trim();
    const emailT = email.trim().toLowerCase();

    if (!nomeT) {
      setError("O nome é obrigatório.");
      return;
    }
    if (!emailT) {
      setError("O email é obrigatório.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailT)) {
      setError("Email inválido.");
      return;
    }
    if (!PAPEIS_EDITAVEIS.includes(papel)) {
      setError("Papel inválido.");
      return;
    }
    if (novaSenha && novaSenha.length < 6) {
      setError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setSaving(true);
    setError(null);

    const errorMap: Record<string, string> = {
      nome_vazio: "O nome é obrigatório.",
      email_invalido: "Email inválido.",
      email_em_uso: "Este email já está em uso por outro usuário.",
      not_found: "Usuário não encontrado.",
    };

    // Monta payload só com campos alterados
    const payload: any = {};
    if (nomeT !== usuario.nome) payload.nome = nomeT;
    if (emailT !== emailOriginal) payload.email = emailT;
    if (papel !== usuario.papel) payload.papel = papel;
    if (empresaId !== empresaOriginalId) {
      payload.empresa_id = empresaId ? Number(empresaId) : null;
    }

    try {
      // 1) Dados básicos (se houver mudanças)
      if (Object.keys(payload).length > 0) {
        const r1 = await fetch(`${API}/usuarios/${usuario.id}`, {
          method: "PATCH",
          headers: authHeaders(token),
          body: JSON.stringify(payload),
        });
        if (!r1.ok) {
          const d = await r1.json().catch(() => ({}));
          setError(errorMap[d?.error] || d?.message || "Erro ao salvar usuário.");
          setSaving(false);
          return;
        }
      }

      // 2) Senha (se preenchida)
      if (novaSenha) {
        const r2 = await fetch(`${API}/usuarios/${usuario.id}/alterar-senha`, {
          method: "PATCH",
          headers: authHeaders(token),
          body: JSON.stringify({ novaSenha }),
        });
        if (!r2.ok) {
          const d = await r2.json().catch(() => ({}));
          setError(d?.message || errorMap[d?.error] || "Dados salvos, mas erro ao atualizar a senha.");
          setSaving(false);
          return;
        }
      }

      const novaEmpresa = empresas.find((e) => String(e.id) === empresaId);
      onSaved({
        nome: nomeT,
        email: emailT,
        papel,
        empresa_id: empresaId ? Number(empresaId) : null,
        empresa_nome: novaEmpresa?.nome ?? (empresaId ? usuario.empresa_nome : undefined),
      });
      onClose();
    } catch {
      setError("Erro de rede. Tente novamente.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-foreground">Editar Usuário</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5">Nome</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5">Email (login)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Não pode estar em uso por outro usuário.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">Papel</label>
              <select
                value={papel}
                onChange={(e) => setPapel(e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {PAPEIS_EDITAVEIS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-1.5">Empresa</label>
              <select
                value={empresaId}
                onChange={(e) => setEmpresaId(e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">— Nenhuma —</option>
                {empresas.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.nome}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-border">
            <label className="block text-sm font-medium text-foreground/80 mb-1.5">
              Nova senha <span className="text-muted-foreground font-normal">(deixe em branco para manter)</span>
            </label>
            <div className="relative">
              <input
                type={showSenha ? "text" : "password"}
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
                className="w-full bg-input border border-border rounded-lg px-3 py-2.5 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                type="button"
                onClick={() => setShowSenha((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground"
                title={showSenha ? "Ocultar senha" : "Mostrar senha"}
              >
                {showSenha ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Usuarios() {
  const { token } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [empresas, setEmpresas] = useState<EmpresaOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterPapel, setFilterPapel] = useState("todos");
  const [editTarget, setEditTarget] = useState<Usuario | null>(null);

  useEffect(() => {
    fetch(`${API}/usuarios`, { headers: authHeaders(token) })
      .then(r => r.json()).then(d => { setUsuarios(Array.isArray(d) ? d : []); setLoading(false); });
    fetch(`${API}/empresas`, { headers: authHeaders(token) })
      .then(r => r.json()).then(d => {
        if (Array.isArray(d)) setEmpresas(d.map((e: any) => ({ id: e.id, nome: e.nome })));
      }).catch(() => {});
  }, [token]);

  async function handleDelete(u: Usuario) {
    if (!window.confirm(`Apagar definitivamente "${u.nome}" (${u.email})?\n\nTambém serão apagados vínculos no programa de afiliados.`)) return;
    const r = await fetch(`${API}/usuarios/${u.id}`, { method: "DELETE", headers: authHeaders(token) });
    if (r.ok) {
      setUsuarios(prev => prev.filter(x => x.id !== u.id));
    } else {
      const d = await r.json().catch(() => ({}));
      alert(`Não foi possível apagar: ${d.message || d.error || r.status}`);
    }
  }

  const filtered = usuarios.filter(u => {
    const matchSearch = !search || u.nome.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchPapel = filterPapel === "todos" || u.papel === filterPapel;
    return matchSearch && matchPapel;
  });

  const papeis = ["todos", "admin", "parceiro", "cliente"];

  return (
    <div className="space-y-6 max-w-6xl">
      {editTarget && (
        <EditarUsuarioModal
          usuario={editTarget}
          empresas={empresas}
          token={token}
          onClose={() => setEditTarget(null)}
          onSaved={(updated) => {
            setUsuarios((prev) =>
              prev.map((u) => (u.id === editTarget.id ? { ...u, ...updated } : u))
            );
          }}
        />
      )}

      <div>
        <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
        <p className="text-muted-foreground text-sm mt-1">Todos os usuários da plataforma.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input placeholder="Buscar por nome ou email..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div className="flex gap-2">
          {papeis.map(p => (
            <button key={p} onClick={() => setFilterPapel(p)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors capitalize ${filterPapel === p ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
              {p} {p !== "todos" && `(${usuarios.filter(u => u.papel === p).length})`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground gap-3">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Carregando...
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Usuário</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Papel</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Empresa</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Cadastro</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-primary font-bold text-sm">{u.nome?.charAt(0) ?? "?"}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-foreground">{u.nome}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 hidden sm:table-cell">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${PAPEL_BADGE[u.papel] ?? "bg-secondary text-muted-foreground"}`}>
                      {u.papel}
                    </span>
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell">
                    <span className="text-sm text-foreground/70">{u.empresa_nome ?? "—"}</span>
                  </td>
                  <td className="px-5 py-4 text-right hidden lg:table-cell">
                    <span className="text-xs text-muted-foreground">{new Date(u.criado_em).toLocaleDateString("pt-BR")}</span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="inline-flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditTarget(u)}
                        title="Editar usuário"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        title="Apagar usuário"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-md text-red-400 hover:bg-red-500/15 hover:text-red-300 transition-colors"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-muted-foreground text-sm">Nenhum usuário encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
