import React, { useEffect, useState } from "react";
import { useAuth, API, authHeaders } from "@/lib/auth";

type RepassePDV = {
  id: number; empresa_id: number; empresa_nome: string;
  semana_inicio: string; semana_fim: string;
  receita_total: string; taxa_percentual: string;
  valor_repasse: string; status: string;
  pago_em?: string; criado_em: string;
  comprovante_path?: string; comprovante_enviado_em?: string; comprovante_observacao?: string;
};

type RepassePro = {
  id: number; profissional_id: number; profissional_nome: string;
  telefone: string; tipo_profissional: string;
  semana_inicio: string; semana_fim: string;
  total_ganhos: number; percentual: number; valor_repasse: number;
  status: string; comprovante?: string; pago_em?: string;
};

const STATUS_CFG: Record<string, { label: string; color: string; dot: string }> = {
  pendente:   { label: "Pendente",   color: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20", dot: "bg-yellow-400" },
  aguardando: { label: "Aguardando", color: "bg-blue-500/15 text-blue-400 border border-blue-500/20",    dot: "bg-blue-400" },
  pago:       { label: "Pago",       color: "bg-green-500/15 text-green-400 border border-green-500/20",   dot: "bg-green-400" },
  bloqueado:  { label: "Bloqueado",  color: "bg-red-500/15 text-red-400 border border-red-500/20",         dot: "bg-red-400" },
};

const TIPO_LABELS: Record<string, string> = {
  motorista:  "🚗 Motoristas (Viagens)",
  delivery:   "🍔 Delivery",
  entregador: "📦 Entregadores",
};

function fmtDate(d: string) { return new Date(d).toLocaleDateString("pt-BR"); }
function fmtBRL(v: number | string) { return `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}` }

function ComprovanteModal({ url, nome, onClose }: { url: string; nome: string; onClose: () => void }) {
  const isPdf = url.endsWith(".pdf");
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-bold text-foreground">Comprovante — {nome}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/20">
          {isPdf ? (
            <div className="text-center space-y-3">
              <svg className="w-16 h-16 text-muted-foreground mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <a href={url} target="_blank" rel="noopener noreferrer" className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold">Abrir PDF</a>
            </div>
          ) : (
            <img src={url} alt="Comprovante" className="max-w-full max-h-[50vh] object-contain rounded-lg shadow-lg" />
          )}
        </div>
        <div className="px-5 py-4 border-t border-border flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-secondary border border-border rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors">Fechar</button>
        </div>
      </div>
    </div>
  );
}

function TabelaPDV({ token }: { token: string | null }) {
  const [repasses, setRepasses] = useState<RepassePDV[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("todos");
  const [atualizando, setAtualizando] = useState<number | null>(null);
  const [viewingComprovante, setViewingComprovante] = useState<RepassePDV | null>(null);

  const fetch_ = async () => {
    setLoading(true);
    const r = await fetch(`${API}/repasses`, { headers: authHeaders(token) });
    const d = await r.json();
    setRepasses(Array.isArray(d) ? d : []);
    setLoading(false);
  };
  useEffect(() => { fetch_(); }, [token]);

  const handlePagar = async (rep: RepassePDV) => {
    if (!confirm(`Confirmar pagamento de ${fmtBRL(rep.valor_repasse)} para ${rep.empresa_nome}?`)) return;
    setAtualizando(rep.id);
    await fetch(`${API}/repasses/${rep.id}/pagar`, { method: "PATCH", headers: authHeaders(token) });
    await fetch_();
    setAtualizando(null);
  };
  const handleBloquear = async (rep: RepassePDV) => {
    if (!confirm(`Bloquear acesso de ${rep.empresa_nome}?`)) return;
    setAtualizando(rep.id);
    await fetch(`${API}/repasses/${rep.id}/bloquear`, { method: "PATCH", headers: authHeaders(token) });
    await fetch_();
    setAtualizando(null);
  };

  const filtered = repasses.filter(r => filterStatus === "todos" || r.status === filterStatus);
  const totalPendente = repasses.filter(r => r.status === "pendente").reduce((s, r) => s + Number(r.valor_repasse), 0);
  const totalPago = repasses.filter(r => r.status === "pago").reduce((s, r) => s + Number(r.valor_repasse), 0);
  const totalBloqueado = repasses.filter(r => r.status === "bloqueado").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-yellow-500/20 rounded-xl p-4">
          <p className="text-xl font-bold text-yellow-400">{fmtBRL(totalPendente)}</p>
          <p className="text-xs text-muted-foreground mt-1">{repasses.filter(r => r.status === "pendente").length} pendentes</p>
        </div>
        <div className="bg-card border border-green-500/20 rounded-xl p-4">
          <p className="text-xl font-bold text-green-400">{fmtBRL(totalPago)}</p>
          <p className="text-xs text-muted-foreground mt-1">{repasses.filter(r => r.status === "pago").length} pagos</p>
        </div>
        <div className="bg-card border border-red-500/20 rounded-xl p-4">
          <p className="text-xl font-bold text-red-400">{totalBloqueado}</p>
          <p className="text-xs text-muted-foreground mt-1">empresas bloqueadas</p>
        </div>
      </div>

      <div className="flex gap-2">
        {["todos", "pendente", "pago", "bloqueado"].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors capitalize ${filterStatus === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
            {s === "todos" ? "Todos" : STATUS_CFG[s]?.label}
            {s !== "todos" && ` (${repasses.filter(r => r.status === s).length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground gap-3">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Calculando repasses...
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Empresa</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase hidden sm:table-cell">Semana</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase hidden md:table-cell">Receita</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">Taxa ({repasses[0]?.taxa_percentual ?? "3"}%)</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Comprovante</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Status</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map(rep => {
                const sc = STATUS_CFG[rep.status] ?? STATUS_CFG.pendente;
                const isLoading = atualizando === rep.id;
                return (
                  <tr key={rep.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${sc.dot}`} />
                        <span className="text-sm font-semibold text-foreground">{rep.empresa_nome}</span>
                      </div>
                      {rep.pago_em && <p className="text-xs text-muted-foreground ml-4 mt-0.5">Pago em {new Date(rep.pago_em).toLocaleString("pt-BR")}</p>}
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <p className="text-xs text-foreground/70">{fmtDate(rep.semana_inicio)} – {fmtDate(rep.semana_fim)}</p>
                    </td>
                    <td className="px-5 py-4 text-right hidden md:table-cell">
                      <span className="text-sm text-foreground/70">{fmtBRL(rep.receita_total)}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-sm font-bold text-foreground">{fmtBRL(rep.valor_repasse)}</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {rep.comprovante_path ? (
                        <button onClick={() => setViewingComprovante(rep)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/20 hover:bg-blue-500/25">
                          Ver
                        </button>
                      ) : <span className="text-xs text-muted-foreground/50">—</span>}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${sc.color}`}>{sc.label}</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {rep.status !== "pago" && (
                          <button onClick={() => handlePagar(rep)} disabled={isLoading}
                            className="px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 border border-green-500/20 text-xs font-semibold hover:bg-green-500/25 disabled:opacity-50">
                            {isLoading ? "..." : "Pago ✓"}
                          </button>
                        )}
                        {rep.status === "pendente" && (
                          <button onClick={() => handleBloquear(rep)} disabled={isLoading}
                            className="px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/20 text-xs font-semibold hover:bg-red-500/25 disabled:opacity-50">
                            Bloquear
                          </button>
                        )}
                        {rep.status === "bloqueado" && (
                          <button onClick={() => handlePagar(rep)} disabled={isLoading}
                            className="px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/20 text-xs font-semibold hover:bg-blue-500/25 disabled:opacity-50">
                            {isLoading ? "..." : "Reativar"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-muted-foreground text-sm">Nenhum repasse encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {viewingComprovante && (
        <ComprovanteModal
          url={`${API}/repasses/${viewingComprovante.id}/comprovante`}
          nome={viewingComprovante.empresa_nome}
          onClose={() => setViewingComprovante(null)}
        />
      )}
    </div>
  );
}

function TabelaPro({ token }: { token: string | null }) {
  const [repasses, setRepasses] = useState<RepassePro[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipoTab, setTipoTab] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [atualizando, setAtualizando] = useState<number | null>(null);
  const [viewingUrl, setViewingUrl] = useState<{ url: string; nome: string } | null>(null);

  const fetch_ = async () => {
    setLoading(true);
    const r = await fetch(`${API}/repasses/pro`, { headers: authHeaders(token) });
    const d = await r.json();
    setRepasses(Array.isArray(d) ? d : []);
    setLoading(false);
  };
  useEffect(() => { fetch_(); }, [token]);

  const handlePagar = async (rep: RepassePro) => {
    if (!confirm(`Confirmar pagamento de ${fmtBRL(rep.valor_repasse)} para ${rep.profissional_nome}?`)) return;
    setAtualizando(rep.id);
    await fetch(`${API}/repasses/pro/${rep.id}/pagar`, { method: "PATCH", headers: authHeaders(token) });
    await fetch_();
    setAtualizando(null);
  };
  const handleBloquear = async (rep: RepassePro) => {
    if (!confirm(`Bloquear ${rep.profissional_nome}?`)) return;
    setAtualizando(rep.id);
    await fetch(`${API}/repasses/pro/${rep.id}/bloquear`, { method: "PATCH", headers: authHeaders(token) });
    await fetch_();
    setAtualizando(null);
  };

  const byTipo = tipoTab === "todos" ? repasses : repasses.filter(r => r.tipo_profissional === tipoTab);
  const filtered = byTipo.filter(r => filterStatus === "todos" || r.status === filterStatus);

  const totalPendente = byTipo.filter(r => r.status === "pendente").reduce((s, r) => s + Number(r.valor_repasse), 0);
  const totalPago = byTipo.filter(r => r.status === "pago").reduce((s, r) => s + Number(r.valor_repasse), 0);
  const totalBloqueado = byTipo.filter(r => r.status === "bloqueado").length;

  const TIPOS = ["todos", "motorista", "delivery", "entregador"];

  return (
    <div className="space-y-4">
      {/* Sub-tabs por módulo */}
      <div className="flex gap-2 flex-wrap">
        {TIPOS.map(t => (
          <button key={t} onClick={() => setTipoTab(t)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${tipoTab === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
            {t === "todos" ? `Todos (${repasses.length})` : `${TIPO_LABELS[t]} (${repasses.filter(r => r.tipo_profissional === t).length})`}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-yellow-500/20 rounded-xl p-4">
          <p className="text-xl font-bold text-yellow-400">{fmtBRL(totalPendente)}</p>
          <p className="text-xs text-muted-foreground mt-1">{byTipo.filter(r => r.status === "pendente").length} pendentes</p>
        </div>
        <div className="bg-card border border-green-500/20 rounded-xl p-4">
          <p className="text-xl font-bold text-green-400">{fmtBRL(totalPago)}</p>
          <p className="text-xs text-muted-foreground mt-1">{byTipo.filter(r => r.status === "pago").length} pagos</p>
        </div>
        <div className="bg-card border border-red-500/20 rounded-xl p-4">
          <p className="text-xl font-bold text-red-400">{totalBloqueado}</p>
          <p className="text-xs text-muted-foreground mt-1">profissionais bloqueados</p>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-2">
        {["todos", "pendente", "aguardando", "pago", "bloqueado"].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors capitalize ${filterStatus === s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
            {s === "todos" ? "Todos" : STATUS_CFG[s]?.label}
            {s !== "todos" && ` (${byTipo.filter(r => r.status === s).length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground gap-3">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Carregando repasses...
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Profissional</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase hidden sm:table-cell">Semana</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase hidden md:table-cell">Ganhos</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">Taxa (3%)</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Comprovante</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Status</th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.map(rep => {
                const sc = STATUS_CFG[rep.status] ?? STATUS_CFG.pendente;
                const isLoading = atualizando === rep.id;
                return (
                  <tr key={rep.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${sc.dot}`} />
                        <div>
                          <p className="text-sm font-semibold text-foreground">{rep.profissional_nome}</p>
                          <p className="text-xs text-muted-foreground">{TIPO_LABELS[rep.tipo_profissional] || rep.tipo_profissional} · {rep.telefone}</p>
                        </div>
                      </div>
                      {rep.pago_em && <p className="text-xs text-muted-foreground ml-4 mt-0.5">Pago em {new Date(rep.pago_em).toLocaleString("pt-BR")}</p>}
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell">
                      <p className="text-xs text-foreground/70">{fmtDate(rep.semana_inicio)} – {fmtDate(rep.semana_fim)}</p>
                    </td>
                    <td className="px-5 py-4 text-right hidden md:table-cell">
                      <span className="text-sm text-foreground/70">{fmtBRL(rep.total_ganhos)}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-sm font-bold text-foreground">{fmtBRL(rep.valor_repasse)}</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {rep.comprovante ? (
                        <button onClick={() => setViewingUrl({ url: rep.comprovante!, nome: rep.profissional_nome })}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/20 hover:bg-blue-500/25">
                          Ver
                        </button>
                      ) : <span className="text-xs text-muted-foreground/50">—</span>}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${sc.color}`}>{sc.label}</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {(rep.status === "aguardando" || rep.status === "pendente") && (
                          <button onClick={() => handlePagar(rep)} disabled={isLoading}
                            className="px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 border border-green-500/20 text-xs font-semibold hover:bg-green-500/25 disabled:opacity-50">
                            {isLoading ? "..." : "Pago ✓"}
                          </button>
                        )}
                        {rep.status === "pendente" && (
                          <button onClick={() => handleBloquear(rep)} disabled={isLoading}
                            className="px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/20 text-xs font-semibold hover:bg-red-500/25 disabled:opacity-50">
                            Bloquear
                          </button>
                        )}
                        {rep.status === "bloqueado" && (
                          <button onClick={() => handlePagar(rep)} disabled={isLoading}
                            className="px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/20 text-xs font-semibold hover:bg-blue-500/25 disabled:opacity-50">
                            {isLoading ? "..." : "Reativar"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-muted-foreground text-sm">Nenhum repasse encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {viewingUrl && (
        <ComprovanteModal url={viewingUrl.url} nome={viewingUrl.nome} onClose={() => setViewingUrl(null)} />
      )}
    </div>
  );
}

export default function Repasses() {
  const { token } = useAuth();
  const [mainTab, setMainTab] = useState<"pdv" | "pro">("pdv");

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Repasses</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestão de taxas e pagamentos semanais. Taxa: 3% dos ganhos. Vencimento toda segunda-feira.
          </p>
        </div>
      </div>

      {/* Abas principais */}
      <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl w-fit">
        <button onClick={() => setMainTab("pdv")}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${mainTab === "pdv" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          🏪 Empresas (PDV)
        </button>
        <button onClick={() => setMainTab("pro")}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${mainTab === "pro" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          🚗 GoTaxi Pro
        </button>
      </div>

      {mainTab === "pdv" ? <TabelaPDV token={token} /> : <TabelaPro token={token} />}
    </div>
  );
}
