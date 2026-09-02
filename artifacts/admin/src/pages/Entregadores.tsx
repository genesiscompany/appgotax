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
    id: 1, nome: "Rodrigo Mendes", telefone: "(11) 97890-1234", cpf: "111.222.333-44",
    email: "rodrigo@email.com", status: "aprovado", tipo_veiculo: "moto",
    veiculo_marca: "Honda", veiculo_modelo: "Pop 110", veiculo_placa: "AAA-1111",
    doc_cnh_status: "aprovado", doc_veiculo_status: "aprovado", doc_selfie_status: "aprovado",
    total_entregas: 487, avaliacao_media: 4.8, criado_em: "2024-08-20T09:00:00Z",
  },
  {
    id: 2, nome: "Camila Souza", telefone: "(21) 96543-2100", cpf: "222.333.444-55",
    email: "camila@email.com", status: "aprovado", tipo_veiculo: "bicicleta",
    veiculo_marca: "", veiculo_modelo: "", veiculo_placa: "",
    doc_cnh_status: "aprovado", doc_veiculo_status: "aprovado", doc_selfie_status: "aprovado",
    total_entregas: 153, avaliacao_media: 4.6, criado_em: "2024-10-15T14:00:00Z",
  },
  {
    id: 3, nome: "Tiago Barbosa", telefone: "(31) 98765-4321", cpf: "333.444.555-66",
    email: "tiago@email.com", status: "em_analise", tipo_veiculo: "moto",
    veiculo_marca: "Yamaha", veiculo_modelo: "Factor 150", veiculo_placa: "BBB-2222",
    doc_cnh_status: "em_analise", doc_veiculo_status: "pendente", doc_selfie_status: "aprovado",
    total_entregas: 0, avaliacao_media: 0, criado_em: "2025-01-10T10:30:00Z",
  },
  {
    id: 4, nome: "Patrícia Lima", telefone: "(41) 99012-3456", cpf: "444.555.666-77",
    email: "patricia@email.com", status: "pendente", tipo_veiculo: "carro",
    veiculo_marca: "Fiat", veiculo_modelo: "Uno", veiculo_placa: "CCC-3333",
    doc_cnh_status: "pendente", doc_veiculo_status: "pendente", doc_selfie_status: "pendente",
    total_entregas: 0, avaliacao_media: 0, criado_em: "2025-02-20T16:00:00Z",
  },
  {
    id: 5, nome: "Diego Alves", telefone: "(51) 97654-3210", cpf: "555.666.777-88",
    email: "diego@email.com", status: "suspenso", tipo_veiculo: "moto",
    veiculo_marca: "Honda", veiculo_modelo: "Biz 125", veiculo_placa: "DDD-4444",
    doc_cnh_status: "aprovado", doc_veiculo_status: "aprovado", doc_selfie_status: "aprovado",
    total_entregas: 92, avaliacao_media: 3.8, criado_em: "2024-06-01T11:00:00Z",
  },
];

interface SimularForm {
  tipo_servico: string; categoria_nome: string; valor_estimado: string;
  coleta_endereco: string; entrega_endereco: string;
  distancia_profissional_km: string; tempo_profissional_min: string;
  distancia_entrega_km: string; tempo_entrega_min: string;
  descricao_item: string;
}

const CATEGORIA_SLUG: Record<string, string> = {
  "Entrega Padrão": "padrao",
  "Entrega Expressa": "expressa",
  "Entrega Grande": "grande",
};

interface CategoriaTarifa { taxa_minima: number; distancia_km: number; taxa_km: number; }

const TARIFA_DEFAULTS: Record<string, CategoriaTarifa> = {
  padrao: { taxa_minima: 10, distancia_km: 3, taxa_km: 2 },
  expressa: { taxa_minima: 15, distancia_km: 3, taxa_km: 3 },
  grande: { taxa_minima: 20, distancia_km: 3, taxa_km: 4 },
};

const calcValor = (t: CategoriaTarifa, distanciaKm: number) => {
  const extra = Math.max(0, distanciaKm - t.distancia_km);
  return t.taxa_minima + extra * t.taxa_km;
};

function SimularEntregaModal({ entregador, token, onClose }: { entregador: Entregador; token: string; onClose: () => void }) {
  const [form, setForm] = useState<SimularForm>({
    tipo_servico: "entrega", categoria_nome: "Entrega Padrão", valor_estimado: "15.00",
    coleta_endereco: "R. Augusta, 500 — Consolação, São Paulo",
    entrega_endereco: "Av. Paulista, 1578 — Bela Vista, São Paulo",
    distancia_profissional_km: "0.8", tempo_profissional_min: "3",
    distancia_entrega_km: "2.4", tempo_entrega_min: "8",
    descricao_item: "Encomenda pequena",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [tarifas, setTarifas] = useState<Record<string, CategoriaTarifa>>(TARIFA_DEFAULTS);
  const [tarifasReady, setTarifasReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/configuracoes/admin`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          const s = data?.sistema || {};
          const next: Record<string, CategoriaTarifa> = {};
          for (const slug of Object.keys(TARIFA_DEFAULTS)) {
            const def = TARIFA_DEFAULTS[slug];
            const tm = Number(s[`entrega_${slug}_taxa_minima`]);
            const dk = Number(s[`entrega_${slug}_distancia_km`]);
            const tk = Number(s[`entrega_${slug}_taxa_km`]);
            next[slug] = {
              taxa_minima: Number.isFinite(tm) && tm >= 0 ? tm : def.taxa_minima,
              distancia_km: Number.isFinite(dk) && dk >= 0 ? dk : def.distancia_km,
              taxa_km: Number.isFinite(tk) && tk >= 0 ? tk : def.taxa_km,
            };
          }
          setTarifas(next);
        }
      } catch (_) {}
      setTarifasReady(true);
    })();
  }, [token]);

  // Recalcula valor sempre que tarifas/distância/categoria mudarem
  useEffect(() => {
    if (!tarifasReady) return;
    const slug = CATEGORIA_SLUG[form.categoria_nome];
    const tarifa = tarifas[slug];
    if (!tarifa) return;
    const dist = Number(String(form.distancia_entrega_km).replace(",", ".")) || 0;
    const valor = calcValor(tarifa, dist);
    setForm(f => ({ ...f, valor_estimado: valor.toFixed(2) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarifasReady, tarifas, form.categoria_nome, form.distancia_entrega_km]);

  const set = (k: keyof SimularForm, v: string) => setForm(f => ({ ...f, [k]: v }));
  const inp = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";
  const lbl = "block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide";

  const handleSend = async () => {
    setLoading(true); setResult(null);
    try {
      const res = await fetch(`${API}/motorista-app/entrega/simular`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          profissional_id: entregador.id, tipo_servico: form.tipo_servico,
          categoria_nome: form.categoria_nome, valor_estimado: parseFloat(form.valor_estimado),
          coleta_endereco: form.coleta_endereco, entrega_endereco: form.entrega_endereco,
          distancia_profissional_km: parseFloat(form.distancia_profissional_km),
          tempo_profissional_min: parseInt(form.tempo_profissional_min),
          distancia_entrega_km: parseFloat(form.distancia_entrega_km),
          tempo_entrega_min: parseInt(form.tempo_entrega_min),
          descricao_item: form.descricao_item,
        }),
      });
      if (res.ok) setResult({ ok: true, msg: "✅ Entrega enviada! O entregador receberá o popup em até 3 segundos." });
      else { const err = await res.json().catch(() => ({})); setResult({ ok: false, msg: `Erro: ${err.error || res.statusText}` }); }
    } catch { setResult({ ok: false, msg: "Falha de conexão com a API." }); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="text-lg font-bold text-foreground">Simular Entrega</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Para: <span className="font-semibold text-foreground">{entregador.nome}</span></p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/70 text-lg">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Tipo</label>
              <select value={form.tipo_servico} onChange={e => set("tipo_servico", e.target.value)} className={inp}>
                <option value="entrega">📦 Entrega</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Categoria</label>
              <select value={form.categoria_nome} onChange={e => set("categoria_nome", e.target.value)} className={inp}>
                {["Entrega Padrão", "Entrega Expressa", "Entrega Grande"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={lbl}>Valor (R$)</label>
            <input type="number" step="0.01" value={form.valor_estimado} onChange={e => set("valor_estimado", e.target.value)} className={inp} />
          </div>
          <div>
            <label className={lbl}>Descrição do item</label>
            <input type="text" value={form.descricao_item} onChange={e => set("descricao_item", e.target.value)} className={inp} />
          </div>
          <div className="bg-muted/40 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Rota</p>
            <div>
              <label className={lbl}>Local de Coleta</label>
              <input type="text" value={form.coleta_endereco} onChange={e => set("coleta_endereco", e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Local de Entrega</label>
              <input type="text" value={form.entrega_endereco} onChange={e => set("entrega_endereco", e.target.value)} className={inp} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Dist. até coleta (km)</label>
                <input type="number" step="0.1" value={form.distancia_profissional_km} onChange={e => set("distancia_profissional_km", e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Tempo até coleta (min)</label>
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
            <button onClick={handleSend} disabled={loading} className="flex-2 flex-grow px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-60">
              {loading ? "Enviando..." : "📦 Enviar Entrega"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Entregadores() {
  const { token } = useAuth();
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("todos");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [simularEntregador, setSimularEntregador] = useState<Entregador | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/motorista-app/admin/list?tipo=entregador`, { headers });
      if (res.ok) {
        const data: Entregador[] = await res.json();
        const arr = Array.isArray(data) ? data : [];
        arr.sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());
        setEntregadores(arr);
      } else {
        setEntregadores([]);
      }
    } catch (_) {
      setEntregadores([]);
    }
    setLoading(false);
  }, [token]);

  const isNovo = (criado_em?: string) => {
    if (!criado_em) return false;
    const diffH = (Date.now() - new Date(criado_em).getTime()) / 36e5;
    return diffH <= 24;
  };

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: number, status: string) => {
    setUpdatingId(id);
    try {
      await fetch(`${API}/motorista-app/admin/${id}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status }),
      });
      setEntregadores(prev => prev.map(e => e.id === id ? { ...e, status } : e));
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
      const res = await fetch(`${API}/motorista-app/admin/${e.id}`, {
        method: "DELETE",
        headers,
      });
      if (res.ok) {
        setEntregadores(prev => prev.filter(x => x.id !== e.id));
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
      setEntregadores(prev => prev.map(e => {
        if (e.id !== id) return e;
        const field = tipo === "cnh" ? "doc_cnh_status" : tipo === "veiculo" ? "doc_veiculo_status" : "doc_selfie_status";
        return { ...e, [field]: status };
      }));
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
          { label: "Total", value: counts.total, color: "#10B981" },
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
                filterStatus === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
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
                  <tr key={e.id} className={`hover:bg-muted/30 transition-colors ${isNovo(e.criado_em) ? "bg-emerald-50/40" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">{e.nome}</span>
                        {isNovo(e.criado_em) && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider bg-emerald-500 text-white animate-pulse">
                            Novo
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{e.telefone}</div>
                      {e.email && <div className="text-xs text-muted-foreground">{e.email}</div>}
                      {e.criado_em && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Cadastro: {new Date(e.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{TIPO_LABEL[e.tipo_veiculo] ?? e.tipo_veiculo}</div>
                      {e.veiculo_placa && (
                        <div className="text-xs text-muted-foreground font-mono">{e.veiculo_placa}</div>
                      )}
                      {e.veiculo_modelo && (
                        <div className="text-xs text-muted-foreground">{e.veiculo_marca} {e.veiculo_modelo}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-muted-foreground w-8">CNH</span>
                          <DocSelect id={e.id} tipo="cnh" status={e.doc_cnh_status} />
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-muted-foreground w-8">Doc</span>
                          <DocSelect id={e.id} tipo="veiculo" status={e.doc_veiculo_status} />
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-muted-foreground w-8">Selfie</span>
                          <DocSelect id={e.id} tipo="selfie" status={e.doc_selfie_status} />
                        </div>
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
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ color: sc.color, background: sc.color + "22", border: `1px solid ${sc.color}44` }}
                      >
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
                            className="px-2 py-1 bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded text-xs font-medium transition-colors">
                            📦 Simular
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
        <SimularEntregaModal
          entregador={simularEntregador}
          token={token!}
          onClose={() => setSimularEntregador(null)}
        />
      )}
    </div>
  );
}
