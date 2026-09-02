import React, { useEffect, useState } from "react";
import { useAuth, API, authHeaders } from "@/lib/auth";

type Empresa = {
  id: number; nome: string; plano: string; taxaApp: number | null; ativo: boolean;
  cor_primaria: string; criado_em: string; modulos_ativos: string[] | null;
  total_usuarios: string; total_pedidos: string; receita: string;
  usuarioPrincipal?: { id: number; nome: string; email: string } | null;
};

const MODULO_MAP: Record<string, { label: string; cor: string; emoji: string }> = {
  food:        { label: "Alimentação",    cor: "#F97316", emoji: "🍔" },
  alimentacao: { label: "Alimentação",    cor: "#F97316", emoji: "🍔" },
  motorista:   { label: "App Motoristas", cor: "#3B82F6", emoji: "🚗" },
  ecommerce:   { label: "E-commerce",     cor: "#8B5CF6", emoji: "🛍️" },
  servicos:    { label: "Serviços",       cor: "#06B6D4", emoji: "🔧" },
  entrega:     { label: "Entregas",       cor: "#F59E0B", emoji: "📦" },
  encomendas:  { label: "Entregas",       cor: "#F59E0B", emoji: "📦" },
  passagens:   { label: "Passagens",      cor: "#22C55E", emoji: "🎟️" },
  tur:         { label: "Tur viagens",    cor: "#0EA5E9", emoji: "🚌" },
};

function NovaEmpresaModal({ onClose, onCreated, token }: { onClose: () => void; onCreated: () => void; token: string | null }) {
  const [nome, setNome] = useState("");
  const [taxaApp, setTaxaApp] = useState("3");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!nome.trim()) return;
    setSaving(true);
    await fetch(`${API}/empresas`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ nome: nome.trim(), taxaApp: parseFloat(taxaApp) || 10 }),
    });
    setSaving(false); onCreated(); onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-foreground mb-4">Nova Empresa</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5">Nome da empresa</label>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Pizzaria Bella"
              className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              autoFocus onKeyDown={e => e.key === "Enter" && handleCreate()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5">Taxa do App (%)</label>
            <div className="relative">
              <input
                type="number" min="0" max="100" step="0.5"
                value={taxaApp} onChange={e => setTaxaApp(e.target.value)}
                placeholder="Ex: 10"
                className="w-full bg-input border border-border rounded-lg px-3 py-2.5 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Percentual retido pelo app em cada transação.</p>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-secondary transition-colors">Cancelar</button>
          <button onClick={handleCreate} disabled={!nome.trim() || saving}
            className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors">
            {saving ? "Criando..." : "Criar empresa"}
          </button>
        </div>
      </div>
    </div>
  );
}

const MODULOS_DISPONIVEIS: { id: string; label: string; cor: string; emoji: string }[] = [
  { id: "food",       label: "Alimentação",    cor: "#F97316", emoji: "🍔" },
  { id: "motorista",  label: "App Motoristas", cor: "#3B82F6", emoji: "🚗" },
  { id: "ecommerce",  label: "E-commerce",     cor: "#8B5CF6", emoji: "🛍️" },
  { id: "servicos",   label: "Serviços",       cor: "#06B6D4", emoji: "🔧" },
  { id: "entrega",    label: "Entregas",       cor: "#F59E0B", emoji: "📦" },
  { id: "passagens",  label: "Passagens",      cor: "#22C55E", emoji: "🎟️" },
  { id: "tur",        label: "Tur viagens",    cor: "#0EA5E9", emoji: "🚌" },
];

const CORES_PADRAO = ["#3B82F6", "#F97316", "#8B5CF6", "#06B6D4", "#F59E0B", "#22C55E", "#EF4444", "#EC4899", "#10B981", "#0EA5E9"];

function EditarEmpresaModal({
  empresa,
  onClose,
  onSaved,
  token,
}: {
  empresa: Empresa;
  onClose: () => void;
  onSaved: (atualizada: Partial<Empresa>) => void;
  token: string | null;
}) {
  const [nome, setNome] = useState(empresa.nome);
  const [taxaApp, setTaxaApp] = useState(String(empresa.taxaApp ?? 3));
  const [corPrimaria, setCorPrimaria] = useState(empresa.cor_primaria || "#3B82F6");
  const [modulos, setModulos] = useState<string[]>(
    Array.isArray(empresa.modulos_ativos) ? empresa.modulos_ativos : []
  );
  const [email, setEmail] = useState(empresa.usuarioPrincipal?.email || "");
  const [novaSenha, setNovaSenha] = useState("");
  const [showSenha, setShowSenha] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usuarioId = empresa.usuarioPrincipal?.id;
  const emailOriginal = empresa.usuarioPrincipal?.email || "";

  const toggleModulo = (id: string) =>
    setModulos((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));

  const handleSave = async () => {
    if (!nome.trim()) {
      setError("O nome é obrigatório.");
      return;
    }
    const taxa = parseFloat(taxaApp);
    if (isNaN(taxa) || taxa < 0 || taxa > 100) {
      setError("Taxa do app deve estar entre 0 e 100.");
      return;
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(corPrimaria)) {
      setError("Cor inválida. Use o formato #RRGGBB.");
      return;
    }
    const emailTrim = email.trim().toLowerCase();
    const emailMudou = usuarioId && emailTrim && emailTrim !== emailOriginal.toLowerCase();
    if (emailMudou && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      setError("Email inválido.");
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
      taxa_invalida: "Taxa inválida.",
      cor_invalida: "Cor inválida.",
      modulos_invalidos: "Módulos inválidos.",
      email_invalido: "Email inválido.",
      email_em_uso: "Este email já está em uso por outro usuário.",
      not_found: "Registro não encontrado.",
    };

    try {
      // 1) Atualiza dados da empresa
      const r1 = await fetch(`${API}/empresas/${empresa.id}`, {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({
          nome: nome.trim(),
          taxaApp: taxa,
          corPrimaria,
          modulosAtivos: modulos,
        }),
      });
      if (!r1.ok) {
        const d = await r1.json().catch(() => ({}));
        setError(errorMap[d?.error] || "Erro ao salvar a empresa.");
        setSaving(false);
        return;
      }

      // 2) Atualiza email do usuário principal (se mudou)
      if (emailMudou && usuarioId) {
        const r2 = await fetch(`${API}/usuarios/${usuarioId}`, {
          method: "PATCH",
          headers: authHeaders(token),
          body: JSON.stringify({ email: emailTrim }),
        });
        if (!r2.ok) {
          const d = await r2.json().catch(() => ({}));
          setError(errorMap[d?.error] || "Empresa salva, mas erro ao atualizar email.");
          setSaving(false);
          return;
        }
      }

      // 3) Atualiza senha do usuário principal (se preenchida)
      if (novaSenha && usuarioId) {
        const r3 = await fetch(`${API}/usuarios/${usuarioId}/alterar-senha`, {
          method: "PATCH",
          headers: authHeaders(token),
          body: JSON.stringify({ novaSenha }),
        });
        if (!r3.ok) {
          const d = await r3.json().catch(() => ({}));
          setError(d?.message || "Empresa salva, mas erro ao atualizar a senha.");
          setSaving(false);
          return;
        }
      }

      onSaved({
        nome: nome.trim(),
        taxaApp: taxa,
        cor_primaria: corPrimaria,
        modulos_ativos: modulos,
        usuarioPrincipal: usuarioId
          ? { id: usuarioId, nome: empresa.usuarioPrincipal?.nome || "", email: emailTrim || emailOriginal }
          : empresa.usuarioPrincipal,
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
          <h2 className="text-lg font-bold text-foreground">Editar Empresa</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5">Nome da empresa</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5">Taxa do App (%)</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={taxaApp}
                onChange={(e) => setTaxaApp(e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-3 py-2.5 pr-8 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                %
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-1.5">Cor primária</label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="color"
                value={corPrimaria}
                onChange={(e) => setCorPrimaria(e.target.value)}
                className="w-12 h-10 rounded-lg border border-border bg-input cursor-pointer"
              />
              <input
                value={corPrimaria}
                onChange={(e) => setCorPrimaria(e.target.value)}
                placeholder="#3B82F6"
                className="flex-1 bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CORES_PADRAO.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCorPrimaria(c)}
                  className={`w-6 h-6 rounded-md border-2 transition-transform ${
                    corPrimaria.toLowerCase() === c.toLowerCase()
                      ? "border-foreground scale-110"
                      : "border-border hover:scale-110"
                  }`}
                  style={{ background: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground/80 mb-2">Segmentos ativos</label>
            <div className="grid grid-cols-2 gap-2">
              {MODULOS_DISPONIVEIS.map((m) => {
                const selected = modulos.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleModulo(m.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors text-left ${
                      selected
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-secondary/30 text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    <span className="text-base">{m.emoji}</span>
                    <span className="flex-1">{m.label}</span>
                    {selected && (
                      <svg
                        className="w-4 h-4 text-primary"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Selecione quais segmentos esta empresa atende.
            </p>
          </div>

          <div className="pt-4 mt-2 border-t border-border">
            <h3 className="text-sm font-semibold text-foreground/90 mb-1">Acesso do parceiro</h3>
            <p className="text-xs text-muted-foreground mb-3">
              {usuarioId
                ? "Edite o login (email) ou defina uma nova senha para o usuário principal desta empresa."
                : "Esta empresa ainda não tem um usuário principal cadastrado."}
            </p>

            <div className={usuarioId ? "space-y-3" : "space-y-3 opacity-50 pointer-events-none"}>
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-1.5">
                  Email do parceiro
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="parceiro@exemplo.com"
                  autoComplete="off"
                  disabled={!usuarioId}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
                />
              </div>

              <div>
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
                    disabled={!usuarioId}
                    className="w-full bg-input border border-border rounded-lg px-3 py-2.5 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
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
            disabled={saving || !nome.trim()}
            className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({
  empresa,
  onClose,
  onConfirm,
  deleting,
}: {
  empresa: Empresa;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  const [input, setInput] = useState("");
  const match = input.trim().toLowerCase() === empresa.nome.trim().toLowerCase();
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-destructive/30 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Excluir empresa permanentemente</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Esta ação não pode ser desfeita.</p>
          </div>
        </div>
        <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 mb-4 text-sm text-foreground/80 space-y-1">
          <p>Todos os dados desta empresa serão excluídos permanentemente:</p>
          <ul className="list-disc ml-4 mt-1.5 space-y-0.5 text-xs text-muted-foreground">
            <li>Usuários e perfis</li>
            <li>Pedidos, produtos e categorias</li>
            <li>Histórico de viagens e passagens</li>
            <li>Entregas, encomendas e corridas</li>
            <li>Repasses e configurações</li>
          </ul>
        </div>
        <p className="text-sm text-foreground/80 mb-2">
          Para confirmar, digite o nome da empresa: <strong className="text-foreground">{empresa.nome}</strong>
        </p>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={empresa.nome}
          className="w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-destructive/50 focus:border-destructive/50 mb-4"
          autoFocus
        />
        <div className="flex gap-3">
          <button onClick={onClose} disabled={deleting}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={!match || deleting}
            className="flex-1 px-4 py-2.5 rounded-lg bg-destructive text-white text-sm font-semibold disabled:opacity-40 hover:bg-destructive/90 transition-colors flex items-center justify-center gap-2">
            {deleting
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Excluindo...</>
              : "Excluir tudo"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Empresas() {
  const { token } = useAuth();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [editingTaxaId, setEditingTaxaId] = useState<number | null>(null);
  const [editingTaxaVal, setEditingTaxaVal] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Empresa | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<Empresa | null>(null);

  const fetchEmpresas = () => {
    fetch(`${API}/empresas`, { headers: authHeaders(token) })
      .then(r => r.json()).then(d => { setEmpresas(Array.isArray(d) ? d : []); setLoading(false); });
  };

  useEffect(() => { fetchEmpresas(); }, [token]);

  const handleToggleAtivo = async (empresa: Empresa) => {
    setTogglingId(empresa.id);
    await fetch(`${API}/empresas/${empresa.id}`, {
      method: "PATCH", headers: authHeaders(token),
      body: JSON.stringify({ ativo: !empresa.ativo }),
    });
    setEmpresas(prev => prev.map(e => e.id === empresa.id ? { ...e, ativo: !e.ativo } : e));
    setTogglingId(null);
  };

  const handleTaxaSave = async (id: number) => {
    const val = parseFloat(editingTaxaVal);
    if (isNaN(val) || val < 0 || val > 100) return;
    await fetch(`${API}/empresas/${id}`, {
      method: "PATCH", headers: authHeaders(token),
      body: JSON.stringify({ taxaApp: val }),
    });
    setEmpresas(prev => prev.map(e => e.id === id ? { ...e, taxaApp: val } : e));
    setEditingTaxaId(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API}/empresas/${deleteTarget.id}`, {
        method: "DELETE", headers: authHeaders(token),
      });
      const data = await res.json();
      if (res.ok) {
        setEmpresas(prev => prev.filter(e => e.id !== deleteTarget.id));
        setDeleteMsg(data.message || "Empresa excluída com sucesso.");
        setDeleteTarget(null);
        setTimeout(() => setDeleteMsg(null), 4000);
      } else {
        setDeleteMsg(data.message || "Erro ao excluir empresa.");
      }
    } catch { setDeleteMsg("Erro de rede. Tente novamente."); }
    setDeleting(false);
  };

  const filtered = empresas.filter(e => !search || e.nome.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 max-w-6xl">
      {showModal && <NovaEmpresaModal onClose={() => setShowModal(false)} onCreated={fetchEmpresas} token={token} />}
      {editTarget && (
        <EditarEmpresaModal
          empresa={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(atualizada) => {
            setEmpresas((prev) =>
              prev.map((e) => (e.id === editTarget.id ? { ...e, ...atualizada } : e))
            );
          }}
          token={token}
        />
      )}
      {deleteTarget && (
        <ConfirmDeleteModal
          empresa={deleteTarget}
          onClose={() => !deleting && setDeleteTarget(null)}
          onConfirm={handleDelete}
          deleting={deleting}
        />
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Parceiros</h1>
          <p className="text-muted-foreground text-sm mt-1">Empresas parceiras cadastradas na plataforma.</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input placeholder="Buscar empresa..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nova empresa
          </button>
        </div>
      </div>

      {deleteMsg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${deleteMsg.includes("sucesso") || deleteMsg.includes("excluíd") ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-destructive/10 border border-destructive/20 text-destructive"}`}>
          {deleteMsg.includes("sucesso") || deleteMsg.includes("excluíd")
            ? <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
            : <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          }
          {deleteMsg}
        </div>
      )}

      {/* Stats row */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span><strong className="text-foreground">{empresas.filter(e => e.ativo).length}</strong> ativas</span>
        <span>·</span>
        <span><strong className="text-foreground">{empresas.filter(e => !e.ativo).length}</strong> inativas</span>
        <span>·</span>
        <span><strong className="text-foreground">{empresas.length}</strong> total</span>
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
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Empresa</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Seguimento</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Taxa do App</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Pedidos</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Receita</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map(empresa => (
                <tr key={empresa.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                        style={{ background: empresa.cor_primaria || "#3B82F6" }}>
                        {empresa.nome.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-foreground">{empresa.nome}</p>
                        <p className="text-xs text-muted-foreground">{Number(empresa.total_usuarios)} usuários</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 hidden sm:table-cell">
                    {(() => {
                      const mods = Array.isArray(empresa.modulos_ativos) ? empresa.modulos_ativos : [];
                      if (mods.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
                      return (
                        <div className="flex flex-wrap gap-1">
                          {mods.map(m => {
                            const info = MODULO_MAP[m];
                            if (!info) return null;
                            return (
                              <span key={m} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                                style={{ background: info.cor + "20", color: info.cor }}>
                                {info.emoji} {info.label}
                              </span>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-5 py-4 hidden sm:table-cell">
                    {editingTaxaId === empresa.id ? (
                      <div className="flex items-center gap-1.5">
                        <div className="relative">
                          <input
                            type="number" min="0" max="100" step="0.5"
                            value={editingTaxaVal}
                            onChange={e => setEditingTaxaVal(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") handleTaxaSave(empresa.id); if (e.key === "Escape") setEditingTaxaId(null); }}
                            autoFocus
                            className="w-20 bg-input border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                        </div>
                        <button onClick={() => handleTaxaSave(empresa.id)}
                          className="px-2 py-1 bg-primary text-primary-foreground text-xs rounded font-semibold hover:bg-primary/90">✓</button>
                        <button onClick={() => setEditingTaxaId(null)}
                          className="px-2 py-1 bg-secondary text-muted-foreground text-xs rounded hover:bg-secondary/80">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingTaxaId(empresa.id); setEditingTaxaVal(String(empresa.taxaApp ?? 3)); }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                        title="Clique para editar a taxa"
                      >
                        {(empresa.taxaApp ?? 3).toFixed(1)}%
                        <svg className="w-3 h-3 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right hidden md:table-cell">
                    <span className="text-sm text-foreground/80">{Number(empresa.total_pedidos)}</span>
                  </td>
                  <td className="px-5 py-4 text-right hidden md:table-cell">
                    <span className="text-sm font-semibold text-foreground">R$ {Number(empresa.receita).toFixed(2)}</span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <button
                      onClick={() => handleToggleAtivo(empresa)}
                      disabled={togglingId === empresa.id}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${empresa.ativo ? "bg-primary" : "bg-secondary border border-border"}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${empresa.ativo ? "translate-x-4" : "translate-x-0.5"}`} />
                    </button>
                  </td>
                  <td className="px-3 py-4 text-center">
                    <div className="inline-flex items-center justify-center gap-1">
                      <button
                        onClick={() => setEditTarget(empresa)}
                        title="Editar empresa"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteTarget(empresa)}
                        title="Excluir empresa e todos os dados"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-muted-foreground text-sm">Nenhuma empresa encontrada</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
