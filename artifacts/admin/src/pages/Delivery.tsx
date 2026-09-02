import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";

const API = "/api";

interface Entregador {
  id: number;
  nome: string;
  telefone: string;
  cpf?: string;
  email?: string;
  status: string;
  tipo_veiculo: string;
  veiculo_marca?: string;
  veiculo_modelo?: string;
  veiculo_placa?: string;
  doc_cnh_status: string;
  doc_veiculo_status: string;
  doc_selfie_status: string;
  total_entregas: number;
  avaliacao_media: number;
  criado_em: string;
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

const TIPO_LABEL: Record<string, string> = {
  moto: "Moto",
  bicicleta: "Bicicleta",
  carro: "Carro",
  a_pe: "A pé",
};

const DEMO_ENTREGADORES: Entregador[] = [
  {
    id: 1, nome: "Lucas Ferreira", telefone: "(11) 97890-1234", cpf: "234.567.890-12",
    email: "lucas@email.com", status: "aprovado", tipo_veiculo: "moto",
    veiculo_marca: "Honda", veiculo_modelo: "CG 160", veiculo_placa: "ABC-1234",
    doc_cnh_status: "aprovado", doc_veiculo_status: "aprovado", doc_selfie_status: "aprovado",
    total_entregas: 312, avaliacao_media: 4.9, criado_em: "2024-11-10T09:00:00Z",
  },
  {
    id: 2, nome: "Renata Oliveira", telefone: "(21) 96543-2100", cpf: "345.678.901-23",
    email: "renata@email.com", status: "em_analise", tipo_veiculo: "bicicleta",
    veiculo_marca: "", veiculo_modelo: "", veiculo_placa: "",
    doc_cnh_status: "em_analise", doc_veiculo_status: "pendente", doc_selfie_status: "aprovado",
    total_entregas: 0, avaliacao_media: 0, criado_em: "2025-01-05T14:00:00Z",
  },
  {
    id: 3, nome: "Felipe Costa", telefone: "(31) 98765-4321", cpf: "456.789.012-34",
    email: "felipe@email.com", status: "pendente", tipo_veiculo: "moto",
    veiculo_marca: "Yamaha", veiculo_modelo: "Factor 150", veiculo_placa: "DEF-5678",
    doc_cnh_status: "pendente", doc_veiculo_status: "pendente", doc_selfie_status: "pendente",
    total_entregas: 0, avaliacao_media: 0, criado_em: "2025-02-01T10:30:00Z",
  },
  {
    id: 4, nome: "Amanda Souza", telefone: "(41) 99012-3456", cpf: "567.890.123-45",
    email: "amanda@email.com", status: "suspenso", tipo_veiculo: "carro",
    veiculo_marca: "Fiat", veiculo_modelo: "Argo", veiculo_placa: "GHI-9012",
    doc_cnh_status: "aprovado", doc_veiculo_status: "aprovado", doc_selfie_status: "aprovado",
    total_entregas: 78, avaliacao_media: 4.2, criado_em: "2024-09-15T16:00:00Z",
  },
];

interface SimularDeliveryForm {
  categoria_nome: string; valor_estimado: string;
  coleta_endereco: string; entrega_endereco: string;
  distancia_profissional_km: string; tempo_profissional_min: string;
  distancia_entrega_km: string; tempo_entrega_min: string;
  descricao_item: string;
}

function SimularDeliveryModal({ entregador, token, onClose }: { entregador: Entregador; token: string; onClose: () => void }) {
  const [form, setForm] = useState<SimularDeliveryForm>({
    categoria_nome: "Delivery Padrão", valor_estimado: "22.00",
    coleta_endereco: "R. Augusta, 500 — Consolação, São Paulo",
    entrega_endereco: "Av. Paulista, 1578 — Bela Vista, São Paulo",
    distancia_profissional_km: "0.5", tempo_profissional_min: "2",
    distancia_entrega_km: "1.8", tempo_entrega_min: "6",
    descricao_item: "Pedido de comida",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const set = (k: keyof SimularDeliveryForm, v: string) => setForm(f => ({ ...f, [k]: v }));
  const inp = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";
  const lbl = "block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide";

  const handleSend = async () => {
    setLoading(true); setResult(null);
    try {
      const res = await fetch(`${API}/motorista-app/entrega/simular`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          profissional_id: entregador.id, tipo_servico: "delivery",
          categoria_nome: form.categoria_nome, valor_estimado: parseFloat(form.valor_estimado),
          coleta_endereco: form.coleta_endereco, entrega_endereco: form.entrega_endereco,
          distancia_profissional_km: parseFloat(form.distancia_profissional_km),
          tempo_profissional_min: parseInt(form.tempo_profissional_min),
          distancia_entrega_km: parseFloat(form.distancia_entrega_km),
          tempo_entrega_min: parseInt(form.tempo_entrega_min),
          descricao_item: form.descricao_item,
        }),
      });
      if (res.ok) setResult({ ok: true, msg: "✅ Delivery enviado! O entregador receberá o popup em até 3 segundos." });
      else { const err = await res.json().catch(() => ({})); setResult({ ok: false, msg: `Erro: ${err.error || res.statusText}` }); }
    } catch { setResult({ ok: false, msg: "Falha de conexão com a API." }); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="text-lg font-bold text-foreground">🛵 Simular Delivery</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Para: <span className="font-semibold text-foreground">{entregador.nome}</span></p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/70 text-lg">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={lbl}>Categoria</label>
              <select value={form.categoria_nome} onChange={e => set("categoria_nome", e.target.value)} className={inp}>
                {["Delivery Padrão", "Delivery Premium", "Delivery Expresso"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Valor (R$)</label>
            <input type="number" step="0.01" value={form.valor_estimado} onChange={e => set("valor_estimado", e.target.value)} className={inp} />
          </div>
          <div>
            <label className={lbl}>Descrição do pedido</label>
            <input type="text" value={form.descricao_item} onChange={e => set("descricao_item", e.target.value)} className={inp} />
          </div>
          <div className="bg-muted/40 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Rota</p>
            <div>
              <label className={lbl}>Restaurante / Loja (coleta)</label>
              <input type="text" value={form.coleta_endereco} onChange={e => set("coleta_endereco", e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Endereço de entrega</label>
              <input type="text" value={form.entrega_endereco} onChange={e => set("entrega_endereco", e.target.value)} className={inp} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Dist. até loja (km)</label>
                <input type="number" step="0.1" value={form.distancia_profissional_km} onChange={e => set("distancia_profissional_km", e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Tempo até loja (min)</label>
                <input type="number" value={form.tempo_profissional_min} onChange={e => set("tempo_profissional_min", e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Dist. entrega (km)</label>
                <input type="number" step="0.1" value={form.distancia_entrega_km} onChange={e => set("distancia_entrega_km", e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Tempo entrega (min)</label>
                <input type="number" value={form.tempo_entrega_min} onChange={e => set("tempo_entrega_min", e.target.value)} className={inp} />
              </div>
            </div>
          </div>
          {result && (
            <div className={`rounded-xl p-4 text-sm font-medium ${result.ok ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
              {result.msg}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted/40 transition-colors">Cancelar</button>
            <button onClick={handleSend} disabled={loading} className="flex-2 flex-grow px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-60">
              {loading ? "Enviando..." : "🛵 Enviar Delivery"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Delivery() {
  const { token } = useAuth();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("todos");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Entregador | null>(null);
  const [simularEntregador, setSimularEntregador] = useState<Entregador | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/delivery/admin/list`, { headers });
      if (res.ok) {
        const data = await res.json();
        setEntregadores(Array.isArray(data) ? data : []);
      } else {
        setEntregadores([]);
      }
    } catch (_) {
      setEntregadores([]);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: number, status: string) => {
    setUpdatingId(id);
    try {
      await fetch(`${API}/delivery/admin/${id}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status }),
      });
      setEntregadores(prev => prev.map(e => e.id === id ? { ...e, status } : e));
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : null);
    } catch (_) {}
    setUpdatingId(null);
  };

  const handleDelete = async (e: Entregador) => {
    const aviso =
      e.total_entregas > 0
        ? `⚠️ ATENÇÃO: ${e.nome} tem ${e.total_entregas} entrega(s) registrada(s).\n\nAo excluir, o histórico desse entregador será PERDIDO PERMANENTEMENTE.\n\nTem certeza que quer excluir?`
        : `Excluir o entregador ${e.nome}?\n\nEssa ação não pode ser desfeita.`;
    if (!window.confirm(aviso)) return;
    setUpdatingId(e.id);
    try {
      const res = await fetch(`${API}/delivery/admin/${e.id}`, {
        method: "DELETE",
        headers,
      });
      if (res.ok) {
        setEntregadores(prev => prev.filter(x => x.id !== e.id));
        if (selected?.id === e.id) setSelected(null);
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
      await fetch(`${API}/delivery/admin/${id}/documentos/${tipo}/status`, {
        method: "PATCH", headers,
        body: JSON.stringify({ status }),
      });
      setEntregadores(prev => prev.map(e => {
        if (e.id !== id) return e;
        const field = tipo === "cnh" ? "doc_cnh_status" : tipo === "veiculo" ? "doc_veiculo_status" : "doc_selfie_status";
        return { ...e, [field]: status };
      }));
      if (selected?.id === id) {
        const field = tipo === "cnh" ? "doc_cnh_status" : tipo === "veiculo" ? "doc_veiculo_status" : "doc_selfie_status";
        setSelected(prev => prev ? { ...prev, [field]: status } : null);
      }
    } catch (_) {}
  };

  const filtered = entregadores.filter(e => {
    const matchStatus = filterStatus === "todos" || e.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch = !q || e.nome.toLowerCase().includes(q) || e.telefone.includes(q) || (e.veiculo_placa?.toLowerCase().includes(q) ?? false);
    return matchStatus && matchSearch;
  });

  const counts = {
    total: entregadores.length,
    pendente: entregadores.filter(e => e.status === "pendente").length,
    em_analise: entregadores.filter(e => e.status === "em_analise").length,
    aprovado: entregadores.filter(e => e.status === "aprovado").length,
  };

  const DocSelect = ({ id, tipo, status }: { id: number; tipo: string; status: string }) => {
    const conf = DOC_STATUS_CONF[status] ?? { label: status, color: "#94A3B8" };
    return (
      <select
        value={status}
        onChange={e => handleDocStatus(id, tipo, e.target.value)}
        className="bg-transparent border-none outline-none text-xs font-semibold cursor-pointer"
        style={{ color: conf.color }}
      >
        <option value="pendente">Pendente</option>
        <option value="em_analise">Em análise</option>
        <option value="aprovado">Aprovado</option>
        <option value="rejeitado">Rejeitado</option>
      </select>
    );
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3" />
      Carregando entregadores...
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total", value: counts.total, color: "#6366F1" },
          { label: "Pendentes", value: counts.pendente, color: "#F59E0B" },
          { label: "Em Análise", value: counts.em_analise, color: "#8B5CF6" },
          { label: "Aprovados", value: counts.aprovado, color: "#10B981" },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, telefone ou placa..."
          className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/30"
        />
        <div className="flex gap-2 flex-wrap">
          {["todos", "pendente", "em_analise", "aprovado", "suspenso", "bloqueado"].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === s ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "todos" ? "Todos" : STATUS_CONF[s]?.label ?? s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {["Entregador", "Veículo", "Documentos", "Entregas", "Avaliação", "Status", "Ações"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Nenhum entregador encontrado</td></tr>
              ) : filtered.map(e => {
                const sc = STATUS_CONF[e.status] ?? { label: e.status, color: "#94A3B8", bg: "#F1F5F9" };
                return (
                  <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{e.nome}</div>
                      <div className="text-xs text-muted-foreground">{e.telefone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{TIPO_LABEL[e.tipo_veiculo] ?? e.tipo_veiculo}</div>
                      {e.veiculo_placa && <div className="text-xs text-muted-foreground font-mono">{e.veiculo_placa}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs"><span className="text-muted-foreground w-8">CNH</span><DocSelect id={e.id} tipo="cnh" status={e.doc_cnh_status} /></div>
                        <div className="flex items-center gap-1.5 text-xs"><span className="text-muted-foreground w-8">Doc</span><DocSelect id={e.id} tipo="veiculo" status={e.doc_veiculo_status} /></div>
                        <div className="flex items-center gap-1.5 text-xs"><span className="text-muted-foreground w-8">Selfie</span><DocSelect id={e.id} tipo="selfie" status={e.doc_selfie_status} /></div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold">{e.total_entregas}</td>
                    <td className="px-4 py-3">
                      {e.avaliacao_media > 0 ? (
                        <span className="flex items-center gap-1">
                          <span className="text-yellow-400">★</span>
                          <span className="font-medium">{Number(e.avaliacao_media).toFixed(1)}</span>
                        </span>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ color: sc.color, background: sc.bg + "33", border: `1px solid ${sc.color}33` }}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        {e.status === "pendente" && (
                          <button onClick={() => updateStatus(e.id, "em_analise")} disabled={updatingId === e.id}
                            className="px-2 py-1 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 rounded text-xs font-medium transition-colors disabled:opacity-50">
                            Analisar
                          </button>
                        )}
                        {e.status === "em_analise" && (
                          <button onClick={() => updateStatus(e.id, "aprovado")} disabled={updatingId === e.id}
                            className="px-2 py-1 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded text-xs font-medium transition-colors disabled:opacity-50">
                            Aprovar
                          </button>
                        )}
                        {e.status === "aprovado" && (
                          <button onClick={() => updateStatus(e.id, "suspenso")} disabled={updatingId === e.id}
                            className="px-2 py-1 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 rounded text-xs font-medium transition-colors disabled:opacity-50">
                            Suspender
                          </button>
                        )}
                        {(e.status === "suspenso" || e.status === "bloqueado") && (
                          <button onClick={() => updateStatus(e.id, "aprovado")} disabled={updatingId === e.id}
                            className="px-2 py-1 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded text-xs font-medium transition-colors disabled:opacity-50">
                            Reativar
                          </button>
                        )}
                        {e.status !== "bloqueado" && (
                          <button onClick={() => updateStatus(e.id, "bloqueado")} disabled={updatingId === e.id}
                            className="px-2 py-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded text-xs font-medium transition-colors disabled:opacity-50">
                            Bloquear
                          </button>
                        )}
                        {e.status === "aprovado" && (
                          <button onClick={() => setSimularEntregador(e)}
                            className="px-2 py-1 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 rounded text-xs font-medium transition-colors">
                            🛵 Simular
                          </button>
                        )}
                        <button onClick={() => handleDelete(e)} disabled={updatingId === e.id}
                          title="Excluir entregador permanentemente"
                          className="px-2 py-1 bg-red-600/10 text-red-500 hover:bg-red-600/20 rounded text-xs font-semibold transition-colors disabled:opacity-50">
                          🗑️ Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
          {filtered.length} de {entregadores.length} entregadores
        </div>
      </div>

      {simularEntregador && (
        <SimularDeliveryModal
          entregador={simularEntregador}
          token={token!}
          onClose={() => setSimularEntregador(null)}
        />
      )}
    </div>
  );
}
