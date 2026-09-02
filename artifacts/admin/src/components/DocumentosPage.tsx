import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";

export interface DocField {
  tipo: string;
  label: string;
  descricao: string;
  somentePara?: (p: any) => boolean;
}

interface DocumentosPageProps {
  titulo: string;
  subtitulo: string;
  fetchUrl: string;
  patchUrlBase: string;
  docFields: DocField[];
  pessoaLabel?: string;
  tipoPessoaLabel?: string;
}

const DOC_STATUS: Record<string, { label: string; color: string; bg: string; ring: string }> = {
  pendente:   { label: "Aguardando",  color: "#94A3B8", bg: "#F1F5F9", ring: "#CBD5E1" },
  em_analise: { label: "Em análise",  color: "#8B5CF6", bg: "#EDE9FE", ring: "#C4B5FD" },
  aprovado:   { label: "Aprovado",    color: "#10B981", bg: "#D1FAE5", ring: "#6EE7B7" },
  rejeitado:  { label: "Rejeitado",   color: "#EF4444", bg: "#FEE2E2", ring: "#FCA5A5" },
};

const PERSON_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pendente:   { label: "Pendente",    color: "#F59E0B", bg: "#FEF3C7" },
  em_analise: { label: "Em Análise",  color: "#8B5CF6", bg: "#EDE9FE" },
  ativo:      { label: "Ativo",       color: "#10B981", bg: "#D1FAE5" },
  aprovado:   { label: "Aprovado",    color: "#10B981", bg: "#D1FAE5" },
  suspenso:   { label: "Suspenso",    color: "#F97316", bg: "#FEE9D1" },
  bloqueado:  { label: "Bloqueado",   color: "#EF4444", bg: "#FEE2E2" },
};

const IconDoc = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);

const IconEye = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const IconCheck = () => (
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
);
const IconX = () => (
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);

export default function DocumentosPage({
  titulo, subtitulo, fetchUrl, patchUrlBase, docFields, pessoaLabel = "Parceiro",
}: DocumentosPageProps) {
  const { token } = useAuth();
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };

  const [pessoas, setPessoas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [updating, setUpdating] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(fetchUrl, { headers });
      if (res.ok) setPessoas(await res.json());
    } catch (_) {}
    setLoading(false);
  }, [token, fetchUrl]);

  useEffect(() => { load(); }, [load]);

  const handleDocStatus = async (id: number, tipo: string, status: string) => {
    const key = `${id}_${tipo}`;
    setUpdating(key);
    try {
      await fetch(`${patchUrlBase}/${id}/documentos/${tipo}/status`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (_) {}
    setUpdating(null);
  };

  function getDocStatus(p: any, tipo: string): string {
    return p[`doc_${tipo}_status`] || "pendente";
  }
  function getDocUrl(p: any, tipo: string): string | null {
    return p[`doc_${tipo}`] || null;
  }
  function getApplicableDocs(p: any): DocField[] {
    return docFields.filter(df => !df.somentePara || df.somentePara(p));
  }
  function getPersonDocSummary(p: any): { pendente: number; em_analise: number; aprovado: number; rejeitado: number } {
    const docs = getApplicableDocs(p);
    return {
      pendente:   docs.filter(df => getDocStatus(p, df.tipo) === "pendente").length,
      em_analise: docs.filter(df => getDocStatus(p, df.tipo) === "em_analise").length,
      aprovado:   docs.filter(df => getDocStatus(p, df.tipo) === "aprovado").length,
      rejeitado:  docs.filter(df => getDocStatus(p, df.tipo) === "rejeitado").length,
    };
  }

  const allDocStatuses = pessoas.flatMap(p =>
    getApplicableDocs(p).map(df => getDocStatus(p, df.tipo))
  );
  const stats = {
    total: pessoas.length,
    pendente:   allDocStatuses.filter(s => s === "pendente").length,
    em_analise: allDocStatuses.filter(s => s === "em_analise").length,
    aprovado:   allDocStatuses.filter(s => s === "aprovado").length,
    rejeitado:  allDocStatuses.filter(s => s === "rejeitado").length,
  };

  const filtered = pessoas
    .filter(p => {
      if (filterStatus === "todos") return true;
      return getApplicableDocs(p).some(df => getDocStatus(p, df.tipo) === filterStatus);
    })
    .filter(p => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (p.nome || "").toLowerCase().includes(s) || (p.telefone || "").toLowerCase().includes(s);
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{titulo}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{subtitulo}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { key: "total",     label: "Total",       color: "#64748B", bg: "#F8FAFC" },
          { key: "pendente",  label: "Aguardando",  color: "#94A3B8", bg: "#F1F5F9" },
          { key: "em_analise",label: "Em Análise",  color: "#8B5CF6", bg: "#EDE9FE" },
          { key: "aprovado",  label: "Aprovados",   color: "#10B981", bg: "#D1FAE5" },
          { key: "rejeitado", label: "Rejeitados",  color: "#EF4444", bg: "#FEE2E2" },
        ].map(s => (
          <button key={s.key}
            onClick={() => setFilterStatus(filterStatus === s.key ? "todos" : s.key)}
            className={`rounded-xl p-4 border text-left transition-all ${filterStatus === s.key ? "ring-2 ring-offset-1" : ""}`}
            style={{ borderColor: filterStatus === s.key ? s.color : "transparent", backgroundColor: s.bg }}>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{stats[s.key as keyof typeof stats]}</p>
            <p className="text-xs font-medium mt-1" style={{ color: s.color }}>{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder={`Buscar por nome, telefone...`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground flex-1 min-w-[240px] max-w-xs"
        />
        <button onClick={load} className="text-xs text-primary hover:underline">Atualizar</button>
        <p className="text-sm text-muted-foreground ml-auto">{filtered.length} {pessoaLabel.toLowerCase()}{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-muted-foreground gap-3">
          <IconDoc />
          <p className="text-sm font-medium">Nenhum documento encontrado</p>
          <p className="text-xs text-center max-w-xs">
            Os documentos enviados pelos parceiros durante o cadastro aparecerão aqui para revisão.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => {
            const pConf = PERSON_STATUS[p.status] || PERSON_STATUS.pendente;
            const summary = getPersonDocSummary(p);
            const applicableDocs = getApplicableDocs(p);
            const isExpanded = expanded === p.id;
            const allApproved = summary.aprovado === applicableDocs.length;
            const hasRejected = summary.rejeitado > 0;

            return (
              <div key={p.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="h-1" style={{ backgroundColor: hasRejected ? "#EF4444" : allApproved ? "#10B981" : pConf.color }} />
                <div className="p-5">
                  {/* Person header row */}
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold shrink-0"
                        style={{ backgroundColor: pConf.color }}>
                        {(p.nome || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-foreground truncate">{p.nome}</p>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                            style={{ color: pConf.color, backgroundColor: pConf.bg }}>
                            {pConf.label}
                          </span>
                          {p.tipo_pessoa && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                              {p.tipo_pessoa === "empresa" ? "Empresa" : "Pessoa Física"}
                            </span>
                          )}
                          {p.tipo_veiculo && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0 capitalize">
                              {p.tipo_veiculo}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5 truncate">
                          {[p.telefone, p.email].filter(Boolean).join(" · ")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Cadastro: {new Date(p.criado_em).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>

                    {/* Doc summary badges + expand button */}
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      {summary.aprovado > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium text-green-700 bg-green-100">
                          ✓ {summary.aprovado} aprovado{summary.aprovado !== 1 ? "s" : ""}
                        </span>
                      )}
                      {summary.rejeitado > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium text-red-700 bg-red-100">
                          ✗ {summary.rejeitado} rejeitado{summary.rejeitado !== 1 ? "s" : ""}
                        </span>
                      )}
                      {summary.em_analise > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium text-violet-700 bg-violet-100">
                          ⏳ {summary.em_analise} em análise
                        </span>
                      )}
                      {summary.pendente > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium text-slate-600 bg-slate-100">
                          {summary.pendente} aguardando
                        </span>
                      )}
                      <button
                        onClick={() => setExpanded(isExpanded ? null : p.id)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        {isExpanded ? "Recolher" : "Ver Docs"}
                      </button>
                    </div>
                  </div>

                  {/* Document review grid — expanded */}
                  {isExpanded && (
                    <div className="mt-5 pt-4 border-t border-border">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Documentos Necessários
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {applicableDocs.map(df => {
                          const docStatus = getDocStatus(p, df.tipo);
                          const docUrl = getDocUrl(p, df.tipo);
                          const dConf = DOC_STATUS[docStatus] || DOC_STATUS.pendente;
                          const updKey = `${p.id}_${df.tipo}`;
                          const isUpdating = updating === updKey;

                          return (
                            <div key={df.tipo} className="rounded-lg border p-3 space-y-2"
                              style={{ borderColor: dConf.ring, backgroundColor: dConf.bg + "66" }}>
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-foreground">{df.label}</p>
                                  <p className="text-xs text-muted-foreground">{df.descricao}</p>
                                </div>
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                                  style={{ color: dConf.color, backgroundColor: dConf.bg }}>
                                  {dConf.label}
                                </span>
                              </div>

                              {/* Doc URL preview */}
                              {docUrl ? (
                                <div className="flex items-center gap-2">
                                  <a href={docUrl} target="_blank" rel="noreferrer"
                                    className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium">
                                    <IconEye /> Ver documento
                                  </a>
                                  <span className="text-xs text-green-600">· Enviado</span>
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground italic">Documento não enviado ainda</p>
                              )}

                              {/* Action buttons */}
                              <div className="flex gap-1.5 flex-wrap">
                                <button
                                  disabled={isUpdating || docStatus === "aprovado"}
                                  onClick={() => handleDocStatus(p.id, df.tipo, "aprovado")}
                                  className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-40">
                                  <IconCheck /> Aprovar
                                </button>
                                <button
                                  disabled={isUpdating || docStatus === "rejeitado"}
                                  onClick={() => handleDocStatus(p.id, df.tipo, "rejeitado")}
                                  className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-40">
                                  <IconX /> Recusar
                                </button>
                                {docStatus !== "em_analise" && docStatus !== "pendente" && (
                                  <button
                                    disabled={isUpdating}
                                    onClick={() => handleDocStatus(p.id, df.tipo, "pendente")}
                                    className="px-2.5 py-1 text-xs rounded-lg font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-40">
                                    Resetar
                                  </button>
                                )}
                                {docStatus === "pendente" && (
                                  <button
                                    disabled={isUpdating}
                                    onClick={() => handleDocStatus(p.id, df.tipo, "em_analise")}
                                    className="px-2.5 py-1 text-xs rounded-lg font-medium bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors disabled:opacity-40">
                                    Analisar
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
