import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";

const API = "/api";

interface Motorista {
  id: number;
  nome: string;
  telefone: string;
  cpf?: string;
  email?: string;
  status: string;
  tipo_profissional?: string;
  tipo_veiculo: string;
  veiculo_marca?: string;
  veiculo_modelo?: string;
  veiculo_ano?: number;
  veiculo_placa?: string;
  doc_cnh_status: string;
  doc_veiculo_status: string;
  doc_selfie_status: string;
  total_corridas: number;
  avaliacao_media: number;
  criado_em: string;
  categorias_habilitadas?: { categoria_id: number; categoria_nome: string }[];
}

const STATUS_CONF: Record<string, { label: string; color: string; bg: string }> = {
  pendente:   { label: "Pendente",    color: "#F59E0B", bg: "#FEF3C7" },
  em_analise: { label: "Em Análise",  color: "#8B5CF6", bg: "#EDE9FE" },
  aprovado:   { label: "Aprovado",    color: "#10B981", bg: "#D1FAE5" },
  suspenso:   { label: "Suspenso",    color: "#F97316", bg: "#FEE9D1" },
  bloqueado:  { label: "Bloqueado",   color: "#EF4444", bg: "#FEE2E2" },
};

const DOC_STATUS_CONF: Record<string, { label: string; color: string }> = {
  pendente:   { label: "Pendente",    color: "#94A3B8" },
  em_analise: { label: "Em análise",  color: "#8B5CF6" },
  aprovado:   { label: "Aprovado",    color: "#10B981" },
  rejeitado:  { label: "Rejeitado",   color: "#EF4444" },
};

const TIPO_LABEL: Record<string, string> = { economico: "Econômico", conforto: "Conforto", premium: "Premium" };

// ── Simular Corrida Modal ──────────────────────────────────────────────────────
interface SimularForm {
  tipo_servico: string;
  categoria_nome: string;
  valor_estimado: string;
  origem_endereco: string;
  destino_endereco: string;
  distancia_motorista_km: string;
  tempo_motorista_min: string;
  distancia_viagem_km: string;
  tempo_viagem_min: string;
}

const DEFAULT_FORM: SimularForm = {
  tipo_servico: "corrida",
  categoria_nome: "GoTaxi X",
  valor_estimado: "18.50",
  origem_endereco: "R. Benedito Leite, 300 — Centro",
  destino_endereco: "Av. Paulista, 1578 — Bela Vista, SP",
  distancia_motorista_km: "1.7",
  tempo_motorista_min: "5",
  distancia_viagem_km: "5.8",
  tempo_viagem_min: "13",
};

function SimularCorridaModal({
  motorista, token, onClose,
}: {
  motorista: Motorista;
  token: string;
  onClose: () => void;
}) {
  const [form, setForm] = useState<SimularForm>(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const set = (k: keyof SimularForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSend = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${API}/motorista-app/corrida/simular`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          motorista_id: motorista.id,
          tipo_servico: form.tipo_servico,
          categoria_nome: form.categoria_nome,
          valor_estimado: parseFloat(form.valor_estimado),
          origem_endereco: form.origem_endereco,
          destino_endereco: form.destino_endereco,
          distancia_motorista_km: parseFloat(form.distancia_motorista_km),
          tempo_motorista_min: parseInt(form.tempo_motorista_min),
          distancia_viagem_km: parseFloat(form.distancia_viagem_km),
          tempo_viagem_min: parseInt(form.tempo_viagem_min),
        }),
      });
      if (res.ok) {
        setResult({ ok: true, msg: "✅ Corrida enviada! O motorista receberá o popup em até 3 segundos." });
      } else {
        const err = await res.json().catch(() => ({}));
        setResult({ ok: false, msg: `Erro: ${err.error || res.statusText}` });
      }
    } catch (e) {
      setResult({ ok: false, msg: "Falha de conexão com a API." });
    }
    setLoading(false);
  };

  const TIPO_SERVICO = [
    { value: "corrida",  label: "🚗 Corrida" },
    { value: "entrega",  label: "📦 Entrega" },
    { value: "delivery", label: "🛵 Delivery" },
  ];

  const CATEGORIAS = ["GoTaxi X", "GoTaxi Plus", "GoTaxi Black"];

  const inp = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";
  const lbl = "block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="text-lg font-bold text-foreground">Simular Corrida</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Para: <span className="font-semibold text-foreground">{motorista.nome}</span></p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/70 text-lg">✕</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Tipo + Categoria */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Tipo de Serviço</label>
              <select value={form.tipo_servico} onChange={e => set("tipo_servico", e.target.value)} className={inp}>
                {TIPO_SERVICO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Categoria</label>
              <select value={form.categoria_nome} onChange={e => set("categoria_nome", e.target.value)} className={inp}>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Valor */}
          <div>
            <label className={lbl}>Valor Estimado (R$)</label>
            <input type="number" step="0.01" value={form.valor_estimado} onChange={e => set("valor_estimado", e.target.value)} className={inp} placeholder="18.50" />
          </div>

          {/* Rota */}
          <div className="bg-muted/40 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Rota</p>
            <div>
              <label className={lbl}>📍 Origem (embarque)</label>
              <input type="text" value={form.origem_endereco} onChange={e => set("origem_endereco", e.target.value)} className={inp} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Distância até embarque (km)</label>
                <input type="number" step="0.1" value={form.distancia_motorista_km} onChange={e => set("distancia_motorista_km", e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Tempo até embarque (min)</label>
                <input type="number" value={form.tempo_motorista_min} onChange={e => set("tempo_motorista_min", e.target.value)} className={inp} />
              </div>
            </div>
            <div>
              <label className={lbl}>🏁 Destino</label>
              <input type="text" value={form.destino_endereco} onChange={e => set("destino_endereco", e.target.value)} className={inp} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Distância da viagem (km)</label>
                <input type="number" step="0.1" value={form.distancia_viagem_km} onChange={e => set("distancia_viagem_km", e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Tempo da viagem (min)</label>
                <input type="number" value={form.tempo_viagem_min} onChange={e => set("tempo_viagem_min", e.target.value)} className={inp} />
              </div>
            </div>
          </div>

          {/* Result feedback */}
          {result && (
            <div className={`rounded-xl p-4 text-sm font-medium ${result.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {result.msg}
            </div>
          )}

          {/* Preview card */}
          <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Preview do popup no app</p>
            <div className="flex items-center gap-2">
              <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded">{form.categoria_nome}</span>
              <span className="text-xs text-muted-foreground">{TIPO_SERVICO.find(t => t.value === form.tipo_servico)?.label}</span>
            </div>
            <p className="text-2xl font-black text-foreground">R$ {parseFloat(form.valor_estimado || "0").toFixed(2).replace(".", ",")}</p>
            <p className="text-xs text-muted-foreground">
              {form.tempo_motorista_min} min ({form.distancia_motorista_km} km) até embarque<br />
              Viagem de {form.tempo_viagem_min} min ({form.distancia_viagem_km} km)<br />
              <span className="text-foreground font-medium">{form.destino_endereco}</span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 pt-0">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:bg-muted transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enviando...</>
            ) : (
              "🚖 Enviar Corrida"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Motoristas() {
  const { token } = useAuth();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("todos");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [simularMotorista, setSimularMotorista] = useState<Motorista | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/motorista-app/admin/list`, { headers });
      if (res.ok) {
        const data: Motorista[] = await res.json();
        data.sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());
        setMotoristas(data);
      }
    } catch (_) {}
    setLoading(false);
  }, [token]);

  const isNovo = (criado_em: string) => {
    const diffH = (Date.now() - new Date(criado_em).getTime()) / 36e5;
    return diffH <= 24;
  };

  useEffect(() => { load(); }, [load]);

  const handleStatus = async (id: number, status: string) => {
    setUpdatingId(id);
    try {
      await fetch(`${API}/motorista-app/admin/${id}/status`, {
        method: "PATCH", headers,
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (_) {}
    setUpdatingId(null);
  };

  const handleDelete = async (m: Motorista) => {
    const aviso =
      m.total_corridas > 0
        ? `⚠️ ATENÇÃO: ${m.nome} tem ${m.total_corridas} corrida(s) registrada(s).\n\nAo excluir, o histórico desse motorista será PERDIDO PERMANENTEMENTE.\n\nTem certeza que quer excluir?`
        : `Excluir o motorista ${m.nome}?\n\nEssa ação não pode ser desfeita.`;
    if (!window.confirm(aviso)) return;
    setUpdatingId(m.id);
    try {
      const res = await fetch(`${API}/motorista-app/admin/${m.id}`, {
        method: "DELETE",
        headers,
      });
      if (res.ok) {
        setMotoristas(prev => prev.filter(x => x.id !== m.id));
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Não foi possível excluir: ${err.error || res.statusText}`);
      }
    } catch (_) {
      alert("Falha de conexão ao excluir.");
    }
    setUpdatingId(null);
  };

  const handleDocStatus = async (id: number, tipo: string, status: string) => {
    try {
      await fetch(`${API}/motorista-app/admin/${id}/documentos/${tipo}/status`, {
        method: "PATCH", headers,
        body: JSON.stringify({ status }),
      });
      setMotoristas(prev => prev.map(m => {
        if (m.id !== id) return m;
        const field = tipo === "cnh" ? "doc_cnh_status" : tipo === "veiculo" ? "doc_veiculo_status" : "doc_selfie_status";
        return { ...m, [field]: status };
      }));
    } catch (_) {}
  };

  const filtered = motoristas
    .filter(m => filterStatus === "todos" || m.status === filterStatus)
    .filter(m => {
      if (!search) return true;
      const s = search.toLowerCase();
      return m.nome.toLowerCase().includes(s) || m.telefone.includes(s)
        || (m.veiculo_placa || "").toLowerCase().includes(s);
    });

  const counts = Object.entries(STATUS_CONF).reduce((acc, [k]) => ({
    ...acc,
    [k]: motoristas.filter(m => m.status === k).length,
  }), {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Modal */}
      {simularMotorista && (
        <SimularCorridaModal
          motorista={simularMotorista}
          token={token!}
          onClose={() => setSimularMotorista(null)}
        />
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Motoristas</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Gerenciamento de candidatos e motoristas ativos</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(STATUS_CONF).map(([k, conf]) => (
          <button key={k} onClick={() => setFilterStatus(filterStatus === k ? "todos" : k)}
            className={`rounded-xl p-4 border text-left transition-all ${filterStatus === k ? "ring-2 ring-offset-1" : ""}`}
            style={{ borderColor: filterStatus === k ? conf.color : "transparent", backgroundColor: conf.bg }}>
            <p className="text-2xl font-bold" style={{ color: conf.color }}>{counts[k] || 0}</p>
            <p className="text-xs font-medium mt-1" style={{ color: conf.color }}>{conf.label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Buscar por nome, telefone ou placa..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground flex-1 min-w-[240px] max-w-xs"
        />
        <button onClick={load} className="text-xs text-primary hover:underline">Atualizar</button>
        <p className="text-sm text-muted-foreground ml-auto">{filtered.length} motorista{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-muted-foreground gap-2">
          <svg className="w-12 h-12 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
          <p className="text-sm font-medium">Nenhum motorista encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(m => {
            const conf = STATUS_CONF[m.status] || STATUS_CONF.pendente;
            const isUpdating = updatingId === m.id;
            const allDocsOk = m.doc_cnh_status !== "pendente" && m.doc_veiculo_status !== "pendente" && m.doc_selfie_status !== "pendente";
            return (
              <div key={m.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="h-1" style={{ backgroundColor: conf.color }} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    {/* Driver info */}
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                        style={{ backgroundColor: conf.color }}>
                        {m.nome.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-foreground">{m.nome}</p>
                          {isNovo(m.criado_em) && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider bg-emerald-500 text-white animate-pulse">
                              Novo
                            </span>
                          )}
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ color: conf.color, backgroundColor: conf.bg }}>
                            {conf.label}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {TIPO_LABEL[m.tipo_veiculo] || m.tipo_veiculo}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{m.telefone}{m.email ? ` · ${m.email}` : ""}</p>
                        {m.veiculo_modelo && (
                          <p className="text-sm text-muted-foreground">
                            {m.veiculo_marca} {m.veiculo_modelo}{m.veiculo_ano ? ` (${m.veiculo_ano})` : ""}{m.veiculo_placa ? ` · ${m.veiculo_placa}` : ""}
                          </p>
                        )}
                        {m.categorias_habilitadas && m.categorias_habilitadas.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {m.categorias_habilitadas.map(c => (
                              <span key={c.categoria_id} className="text-xs px-2 py-0.5 rounded-full font-semibold bg-primary/10 text-primary border border-primary/20">
                                {c.categoria_nome}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Cadastro: {new Date(m.criado_em).toLocaleDateString("pt-BR")}
                          {m.total_corridas > 0 ? ` · ${m.total_corridas} corridas` : ""}
                          {m.avaliacao_media > 0 ? ` · ★ ${Number(m.avaliacao_media).toFixed(1)}` : ""}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 shrink-0 items-start">
                      {/* Simular button — always visible for testing */}
                      <button
                        onClick={() => setSimularMotorista(m)}
                        className="px-3 py-1.5 text-xs rounded-lg font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors border border-amber-200 flex items-center gap-1"
                        title="Enviar uma corrida de teste para este motorista"
                      >
                        🚖 Simular Corrida
                      </button>

                      {m.status === "pendente" && (
                        <button onClick={() => handleStatus(m.id, "em_analise")} disabled={isUpdating}
                          className="px-3 py-1.5 text-xs rounded-lg font-medium bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors disabled:opacity-50">
                          Iniciar Análise
                        </button>
                      )}
                      {m.status === "em_analise" && (
                        <>
                          <button onClick={() => handleStatus(m.id, "aprovado")} disabled={isUpdating || !allDocsOk}
                            className="px-3 py-1.5 text-xs rounded-lg font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
                            title={!allDocsOk ? "Aguardando todos os documentos" : "Aprovar motorista"}>
                            Aprovar
                          </button>
                          <button onClick={() => handleStatus(m.id, "suspenso")} disabled={isUpdating}
                            className="px-3 py-1.5 text-xs rounded-lg font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors disabled:opacity-50">
                            Reprovar
                          </button>
                        </>
                      )}
                      {m.status === "aprovado" && (
                        <button onClick={() => handleStatus(m.id, "suspenso")} disabled={isUpdating}
                          className="px-3 py-1.5 text-xs rounded-lg font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors disabled:opacity-50">
                          Suspender
                        </button>
                      )}
                      {m.status === "suspenso" && (
                        <>
                          <button onClick={() => handleStatus(m.id, "aprovado")} disabled={isUpdating}
                            className="px-3 py-1.5 text-xs rounded-lg font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50">
                            Reativar
                          </button>
                          <button onClick={() => handleStatus(m.id, "bloqueado")} disabled={isUpdating}
                            className="px-3 py-1.5 text-xs rounded-lg font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50">
                            Bloquear
                          </button>
                        </>
                      )}
                      {m.status === "bloqueado" && (
                        <button onClick={() => handleStatus(m.id, "pendente")} disabled={isUpdating}
                          className="px-3 py-1.5 text-xs rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50">
                          Reativar
                        </button>
                      )}
                      <button onClick={() => handleDelete(m)} disabled={isUpdating}
                        title="Excluir motorista permanentemente"
                        className="px-3 py-1.5 text-xs rounded-lg font-semibold bg-red-600/10 text-red-600 hover:bg-red-600/20 transition-colors border border-red-200 disabled:opacity-50">
                        🗑️ Excluir
                      </button>
                    </div>
                  </div>

                  {/* Documents */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      { field: "doc_cnh_status", tipo: "cnh", label: "CNH", value: m.doc_cnh_status },
                      { field: "doc_veiculo_status", tipo: "veiculo", label: "Veículo", value: m.doc_veiculo_status },
                      { field: "doc_selfie_status", tipo: "selfie", label: "Selfie", value: m.doc_selfie_status },
                    ].map(doc => {
                      const dConf = DOC_STATUS_CONF[doc.value] || DOC_STATUS_CONF.pendente;
                      return (
                        <div key={doc.label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border"
                          style={{ borderColor: dConf.color + "44", backgroundColor: dConf.color + "11" }}>
                          <span className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: dConf.color }} />
                          <span style={{ color: dConf.color }} className="font-medium">{doc.label}:</span>
                          <select
                            value={doc.value}
                            onChange={e => handleDocStatus(m.id, doc.tipo, e.target.value)}
                            className="bg-transparent border-none outline-none text-xs font-semibold cursor-pointer"
                            style={{ color: dConf.color }}
                          >
                            <option value="pendente">Pendente</option>
                            <option value="em_analise">Em análise</option>
                            <option value="aprovado">Aprovado</option>
                            <option value="rejeitado">Rejeitado</option>
                          </select>
                        </div>
                      );
                    })}
                    {!allDocsOk && m.status === "em_analise" && (
                      <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-200">
                        Aguardando documentos
                      </span>
                    )}
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
