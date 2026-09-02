import React, { useEffect, useState, useCallback } from "react";
import { useAuth, authHeaders } from "@/lib/auth";
import PlacesAutocomplete from "@/components/PlacesAutocomplete";

const MAPI = "/api/motorista-app";

type Agendamento = {
  id: number; tipo: string; data_hora: string;
  local_embarque: string; local_destino?: string;
  valor: number; cliente_nome?: string; cliente_whatsapp?: string;
  observacoes?: string; status: string; criado_em: string;
  profissional_nome?: string; profissional_telefone?: string;
  profissional_id?: number; tipo_profissional?: string;
};

type Profissional = { id: number; nome: string; tipo_profissional: string; telefone?: string };

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pendente:  { label: "Pendente",   cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  aceito:    { label: "Aceito",     cls: "bg-green-500/15 text-green-400 border-green-500/30" },
  recusado:  { label: "Recusado",   cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  cancelado: { label: "Cancelado",  cls: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
  concluido: { label: "Concluído",  cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
};

const TIPO_LABEL: Record<string, string> = { corrida: "🚗 Corrida", entrega: "📦 Entrega", delivery: "🍔 Delivery" };
const TIPO_PRO: Record<string, string>   = { corrida: "motorista",  entrega: "entregador",  delivery: "delivery" };

function fmtDH(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function fmtBRL(v: number) { return "R$ " + Number(v || 0).toFixed(2).replace(".", ","); }

const INPUT_CLS = "w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50";

// ── Modal: Novo Agendamento ──────────────────────────────────────────────────
function NovoModal({
  onClose, onCreated, token, profissionais,
}: { onClose: () => void; onCreated: () => void; token: string | null; profissionais: Profissional[] }) {
  const [form, setForm] = useState({
    tipo: "corrida", profissionalId: "", dataHora: "", localEmbarque: "",
    localDestino: "", valor: "", clienteNome: "", clienteWhatsapp: "", observacoes: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.dataHora || !form.localEmbarque || !form.localDestino) {
      setErr("Preencha data/hora, embarque e destino."); return;
    }
    setSaving(true); setErr("");
    try {
      const res = await fetch(`${MAPI}/admin/agendamentos`, {
        method: "POST", headers: authHeaders(token),
        body: JSON.stringify({ ...form, valor: parseFloat(form.valor) || 0 }),
      });
      if (res.ok) { onCreated(); onClose(); }
      else { const d = await res.json(); setErr(d.error || "Erro ao salvar."); }
    } catch { setErr("Erro de conexão."); }
    setSaving(false);
  };

  const profFiltrados = profissionais.filter(p => p.tipo_profissional === TIPO_PRO[form.tipo]);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl my-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-foreground mb-5">Novo Agendamento</h2>
        <div className="space-y-4">

          {/* Tipo */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tipo de serviço</label>
            <div className="grid grid-cols-3 gap-2">
              {[["corrida","🚗","Corrida"],["entrega","📦","Entrega"],["delivery","🍔","Delivery"]].map(([v,icon,label]) => (
                <button key={v} type="button" onClick={() => { set("tipo", v); set("profissionalId", ""); }}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-sm font-semibold transition-colors
                    ${form.tipo === v ? "bg-primary/15 border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                  <span className="text-xl">{icon}</span>{label}
                </button>
              ))}
            </div>
          </div>

          {/* Profissional */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Profissional {profFiltrados.length === 0 && <span className="text-yellow-500 normal-case font-normal">(nenhum disponível para este tipo)</span>}
            </label>
            <select value={form.profissionalId} onChange={e => set("profissionalId", e.target.value)} className={INPUT_CLS}>
              <option value="">— Não atribuído —</option>
              {profFiltrados.map(p => <option key={p.id} value={p.id}>{p.nome} · {p.telefone}</option>)}
            </select>
            <p className="text-xs text-muted-foreground mt-1">Você pode atribuir ou mudar o profissional depois, direto na lista.</p>
          </div>

          {/* Data e hora */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Data e hora <span className="text-red-400">*</span></label>
            <input type="datetime-local" value={form.dataHora} onChange={e => set("dataHora", e.target.value)} className={INPUT_CLS} />
          </div>

          {/* Embarque — Google Places */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Local de embarque / coleta <span className="text-red-400">*</span></label>
            <PlacesAutocomplete
              value={form.localEmbarque}
              onChange={v => set("localEmbarque", v)}
              placeholder="Digite o endereço de origem..."
              className={INPUT_CLS}
            />
          </div>

          {/* Destino — Google Places (obrigatório) */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Destino <span className="text-red-400">*</span></label>
            <PlacesAutocomplete
              value={form.localDestino}
              onChange={v => set("localDestino", v)}
              placeholder="Digite o endereço de destino..."
              className={INPUT_CLS}
            />
          </div>

          {/* Valor + Cliente */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Valor (R$)</label>
              <input type="number" min="0" step="0.50" value={form.valor} onChange={e => set("valor", e.target.value)}
                placeholder="0,00" className={INPUT_CLS} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">WhatsApp do cliente</label>
              <input value={form.clienteWhatsapp} onChange={e => set("clienteWhatsapp", e.target.value)}
                placeholder="(11) 9xxxx-xxxx" className={INPUT_CLS} />
            </div>
          </div>

          {/* Nome cliente */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Nome do cliente</label>
            <input value={form.clienteNome} onChange={e => set("clienteNome", e.target.value)}
              placeholder="Nome do solicitante" className={INPUT_CLS} />
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Observações</label>
            <textarea value={form.observacoes} onChange={e => set("observacoes", e.target.value)}
              rows={2} placeholder="Instruções especiais..." className={INPUT_CLS + " resize-none"} />
          </div>

          {err && <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{err}</p>}
        </div>

        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground/70 hover:bg-secondary transition-colors">
            Cancelar
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 hover:bg-primary/90 transition-colors">
            {saving ? "Salvando..." : "Criar agendamento"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Mini modal: Atribuir profissional ─────────────────────────────────────────
function AtribuirModal({
  ag, profissionais, token, onClose, onUpdated,
}: { ag: Agendamento; profissionais: Profissional[]; token: string | null; onClose: () => void; onUpdated: (id: number, profId: number | null, nome: string, telefone: string) => void }) {
  const [profId, setProfId] = useState(String(ag.profissional_id || ""));
  const [saving, setSaving] = useState(false);

  const profFiltrados = profissionais.filter(p => p.tipo_profissional === TIPO_PRO[ag.tipo]);

  const handleSave = async () => {
    setSaving(true);
    await fetch(`${MAPI}/admin/agendamentos/${ag.id}`, {
      method: "PATCH", headers: authHeaders(token),
      body: JSON.stringify({ profissionalId: profId ? Number(profId) : null }),
    });
    const prof = profissionais.find(p => p.id === Number(profId));
    onUpdated(ag.id, profId ? Number(profId) : null, prof?.nome || "", prof?.telefone || "");
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-bold text-foreground mb-1">Atribuir profissional</h3>
        <p className="text-xs text-muted-foreground mb-4">{TIPO_LABEL[ag.tipo]} · {fmtDH(ag.data_hora)}</p>
        <select value={profId} onChange={e => setProfId(e.target.value)} className={INPUT_CLS + " mb-4"}>
          <option value="">— Não atribuído —</option>
          {profFiltrados.map(p => <option key={p.id} value={p.id}>{p.nome} · {p.telefone}</option>)}
        </select>
        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-border text-sm text-foreground/70 hover:bg-secondary transition-colors">
            Cancelar
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 transition-colors">
            {saving ? "Salvando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Agendamentos() {
  const { token } = useAuth();
  const [lista, setLista] = useState<Agendamento[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [atribuirAg, setAtribuirAg] = useState<Agendamento | null>(null);
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [atualizando, setAtualizando] = useState<number | null>(null);

  // Carrega todos os profissionais (motoristas + entregadores + delivery) de uma vez
  useEffect(() => {
    if (!token) return;
    const headers = authHeaders(token);
    Promise.all([
      fetch(`${MAPI}/admin/list?tipo=motorista&limit=200`,  { headers }).then(r => r.ok ? r.json() : []),
      fetch(`${MAPI}/admin/list?tipo=entregador&limit=200`, { headers }).then(r => r.ok ? r.json() : []),
      fetch(`${MAPI}/admin/list?tipo=delivery&limit=200`,   { headers }).then(r => r.ok ? r.json() : []),
    ])
      .then(([motoristas, entregadores, deliveries]) =>
        setProfissionais([...motoristas, ...entregadores, ...deliveries])
      )
      .catch(() => {});
  }, [token]);

  const fetchLista = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtroStatus) params.set("status", filtroStatus);
    if (filtroTipo)   params.set("tipo", filtroTipo);
    fetch(`${MAPI}/admin/agendamentos?${params}`, { headers: authHeaders(token) })
      .then(r => r.ok ? r.json() : [])
      .then(d => setLista(Array.isArray(d) ? d : []))
      .catch(() => setLista([]))
      .finally(() => setLoading(false));
  }, [token, filtroStatus, filtroTipo]);

  useEffect(() => { fetchLista(); }, [fetchLista]);

  const handleStatus = async (id: number, status: string) => {
    setAtualizando(id);
    await fetch(`${MAPI}/admin/agendamentos/${id}`, {
      method: "PATCH", headers: authHeaders(token), body: JSON.stringify({ status }),
    });
    setLista(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    setAtualizando(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Excluir este agendamento?")) return;
    await fetch(`${MAPI}/admin/agendamentos/${id}`, { method: "DELETE", headers: authHeaders(token) });
    setLista(prev => prev.filter(a => a.id !== id));
  };

  const handleProfUpdated = (id: number, profId: number | null, nome: string, telefone: string) => {
    setLista(prev => prev.map(a => a.id === id
      ? { ...a, profissional_id: profId ?? undefined, profissional_nome: nome || undefined, profissional_telefone: telefone || undefined }
      : a));
  };

  const pendentes = lista.filter(a => a.status === "pendente").length;
  const aceitos   = lista.filter(a => a.status === "aceito").length;

  return (
    <div className="space-y-6 max-w-6xl">
      {showModal && <NovoModal onClose={() => setShowModal(false)} onCreated={fetchLista} token={token} profissionais={profissionais} />}
      {atribuirAg && (
        <AtribuirModal ag={atribuirAg} profissionais={profissionais} token={token}
          onClose={() => setAtribuirAg(null)}
          onUpdated={handleProfUpdated} />
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">📅 Agendamentos</h1>
          <p className="text-muted-foreground text-sm mt-1">Corridas, entregas e pedidos agendados pelos clientes.</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Novo agendamento
        </button>
      </div>

      {/* Stats */}
      <div className="flex gap-3 flex-wrap text-sm">
        <span className="px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-400 font-semibold border border-yellow-500/20">{pendentes} pendentes</span>
        <span className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 font-semibold border border-green-500/20">{aceitos} aceitos</span>
        <span className="px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground font-semibold">{lista.length} total</span>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="aceito">Aceito</option>
          <option value="recusado">Recusado</option>
          <option value="cancelado">Cancelado</option>
          <option value="concluido">Concluído</option>
        </select>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
          <option value="">Todos os tipos</option>
          <option value="corrida">🚗 Corrida</option>
          <option value="entrega">📦 Entrega</option>
          <option value="delivery">🍔 Delivery</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground gap-3">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Carregando...
        </div>
      ) : lista.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
          <span className="text-5xl">📭</span>
          <p className="text-muted-foreground">Nenhum agendamento encontrado.</p>
          <button onClick={() => setShowModal(true)} className="text-primary text-sm font-semibold hover:underline">+ Criar agora</button>
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map(ag => {
            const scfg = STATUS_CFG[ag.status] || STATUS_CFG.pendente;
            return (
              <div key={ag.id} className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">

                  {/* Tipo + data */}
                  <div className="flex items-center gap-3 sm:w-48 shrink-0">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-xl">
                      {ag.tipo === "corrida" ? "🚗" : ag.tipo === "entrega" ? "📦" : "🍔"}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{TIPO_LABEL[ag.tipo]}</p>
                      <p className="text-sm font-bold text-foreground">{fmtDH(ag.data_hora)}</p>
                    </div>
                  </div>

                  {/* Rota + info */}
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-400 shrink-0 mt-1" />
                      <span className="text-sm text-foreground/90">{ag.local_embarque}</span>
                    </div>
                    {ag.local_destino && (
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-400 shrink-0 mt-1" />
                        <span className="text-sm text-foreground/70">{ag.local_destino}</span>
                      </div>
                    )}
                    {ag.cliente_nome && (
                      <p className="text-xs text-muted-foreground pt-1">
                        Cliente: <span className="text-foreground font-medium">{ag.cliente_nome}</span>
                        {ag.cliente_whatsapp && <span className="ml-2">· {ag.cliente_whatsapp}</span>}
                      </p>
                    )}

                    {/* Profissional — clicável para atribuir */}
                    {ag.profissional_nome ? (
                      <button type="button" onClick={() => setAtribuirAg(ag)}
                        className="flex items-center gap-1.5 text-xs text-foreground/70 hover:text-primary transition-colors group mt-0.5">
                        <span className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[10px] group-hover:bg-primary/20">👤</span>
                        <span className="font-medium text-foreground">{ag.profissional_nome}</span>
                        <span className="text-muted-foreground">· {ag.profissional_telefone}</span>
                        <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                    ) : (
                      <button type="button" onClick={() => setAtribuirAg(ag)}
                        className="flex items-center gap-1.5 text-xs text-yellow-500/80 hover:text-yellow-400 transition-colors mt-0.5">
                        <span>⚠</span>
                        <span>Sem profissional — clique para atribuir</span>
                      </button>
                    )}

                    {ag.observacoes && (
                      <p className="text-xs text-muted-foreground italic">📝 {ag.observacoes}</p>
                    )}
                  </div>

                  {/* Valor + status + ações */}
                  <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-2 sm:min-w-36">
                    <span className="text-lg font-bold text-foreground">{fmtBRL(ag.valor)}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${scfg.cls}`}>{scfg.label}</span>

                    <div className="flex items-center gap-1.5 mt-auto">
                      <select
                        value={ag.status}
                        onChange={e => handleStatus(ag.id, e.target.value)}
                        disabled={atualizando === ag.id}
                        className="bg-secondary border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50">
                        <option value="pendente">Pendente</option>
                        <option value="aceito">Aceito</option>
                        <option value="recusado">Recusado</option>
                        <option value="cancelado">Cancelado</option>
                        <option value="concluido">Concluído</option>
                      </select>

                      <button onClick={() => handleDelete(ag.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Excluir">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
