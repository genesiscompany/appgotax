import React, { useEffect, useState, useCallback, useRef } from "react";
import type { RepasseStatus } from "@/hooks/useBloqueioCheck";

type Props = { token: string | null; onDesbloqueado?: () => void };

const TIPO_PIX_LABEL: Record<string, string> = {
  aleatoria: "Chave Aleatória", cpf: "CPF", cnpj: "CNPJ", email: "E-mail", telefone: "Telefone",
};

export function BloqueadoScreen({ token, onDesbloqueado }: Props) {
  const [status, setStatus] = useState<RepasseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadOk, setUploadOk] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [observacao, setObservacao] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchStatus = useCallback(async () => {
    if (!token) return;
    const r = await fetch("/api/pdv/repasse-status", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) {
      const d = await r.json();
      setStatus(d);
      if (!d.bloqueado && onDesbloqueado) onDesbloqueado();
    }
    setLoading(false);
  }, [token, onDesbloqueado]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => {
    const timer = setInterval(fetchStatus, 60_000);
    return () => clearInterval(timer);
  }, [fetchStatus]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setUploadError("");
    setUploadOk(false);
    // Preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = ev => setPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !status?.repasse?.id) return;
    setUploading(true); setUploadError("");
    const form = new FormData();
    form.append("comprovante", selectedFile);
    form.append("observacao", observacao);
    const r = await fetch(`/api/pdv/repasse/${status.repasse.id}/comprovante`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (r.ok) {
      setUploadOk(true);
      setSelectedFile(null);
      setPreview(null);
      await fetchStatus();
    } else {
      const d = await r.json().catch(() => ({}));
      setUploadError(d.error || "Erro ao enviar. Tente novamente.");
    }
    setUploading(false);
  };

  const handleVerificar = async () => {
    setChecking(true);
    await fetchStatus();
    setChecking(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const rep = status?.repasse;
  const cfg = status?.config;
  const valorRepasse = rep ? Number(rep.valor_repasse).toFixed(2) : "0.00";
  const semana = rep
    ? `${new Date(rep.semana_inicio + "T00:00:00").toLocaleDateString("pt-BR")} – ${new Date(rep.semana_fim + "T00:00:00").toLocaleDateString("pt-BR")}`
    : "—";
  const vencimento = cfg?.vencimento ? new Date(cfg.vencimento).toLocaleString("pt-BR") : "—";
  const jaEnviou = !!rep?.comprovante_path;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-5">
          <img src="/logo.png" alt="Go Taxi" className="h-9 object-contain mx-auto" />
        </div>

        {/* Block card */}
        <div className="bg-card border border-red-500/30 rounded-2xl overflow-hidden shadow-2xl shadow-red-500/5">
          {/* Header */}
          <div className="bg-red-500/10 border-b border-red-500/20 p-5 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-2.5">
              <svg className="w-6 h-6 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h1 className="text-lg font-bold text-foreground">Acesso Bloqueado</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Pagamento do repasse semanal pendente</p>
          </div>

          <div className="p-5 space-y-4">
            {/* Debt info */}
            <div className="bg-secondary/50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Semana</span>
                <span className="text-foreground">{semana}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Receita do período</span>
                <span className="text-foreground">R$ {rep ? Number(rep.receita_total).toFixed(2) : "0.00"}</span>
              </div>
              <div className="flex justify-between items-center border-t border-border/50 pt-2 mt-1">
                <span className="text-sm text-muted-foreground">Taxa ({rep?.taxa_percentual ?? "3"}%)</span>
                <span className="text-xl font-bold text-red-400">R$ {valorRepasse}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Vencimento</span><span>{vencimento}</span>
              </div>
            </div>

            {/* PIX */}
            {cfg?.chave_pix ? (
              <div className="border border-green-500/25 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-green-500/15 flex items-center justify-center">
                    <svg className="w-3 h-3 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                  </div>
                  <span className="text-sm font-semibold text-foreground">Pague via PIX</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tipo</span>
                    <span className="text-foreground">{TIPO_PIX_LABEL[cfg.tipo_chave_pix ?? "aleatoria"] ?? cfg.tipo_chave_pix}</span>
                  </div>
                  {cfg.nome_beneficiario && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Beneficiário</span>
                      <span className="text-foreground font-medium">{cfg.nome_beneficiario}</span>
                    </div>
                  )}
                </div>
                <div className="bg-background border border-border rounded-lg p-3 flex items-center gap-3">
                  <span className="font-mono text-sm text-foreground break-all flex-1">{cfg.chave_pix}</span>
                  <button onClick={() => { navigator.clipboard?.writeText(cfg.chave_pix!); setCopied(true); setTimeout(() => setCopied(false), 2500); }}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 text-xs font-semibold hover:bg-green-500/25 transition-colors border border-green-500/20">
                    {copied ? "✓ Copiado" : "Copiar"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-center">
                <p className="text-sm text-yellow-400">Chave PIX não configurada.</p>
                <p className="text-xs text-muted-foreground mt-1">Entre em contato com o suporte GoTaxi.</p>
              </div>
            )}

            {/* Comprovante upload */}
            <div className="border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-blue-500/15 flex items-center justify-center">
                    <svg className="w-3 h-3 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  </div>
                  <span className="text-sm font-semibold text-foreground">Enviar Comprovante</span>
                </div>
                {jaEnviou && (
                  <span className="text-xs bg-blue-500/15 text-blue-400 border border-blue-500/20 px-2 py-1 rounded-md font-semibold">
                    Enviado ✓
                  </span>
                )}
              </div>

              {jaEnviou && (
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 text-sm">
                  <p className="text-blue-400 font-medium">Comprovante enviado!</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Enviado em {rep?.comprovante_enviado_em ? new Date(rep.comprovante_enviado_em).toLocaleString("pt-BR") : "—"}.
                    Aguarde a confirmação do suporte GoTaxi.
                  </p>
                  <button onClick={() => { setUploadOk(false); setSelectedFile(null); setPreview(null); }}
                    className="text-xs text-blue-400 underline mt-2 hover:text-blue-300">
                    Enviar outro comprovante
                  </button>
                </div>
              )}

              {!jaEnviou && (
                <>
                  {/* File drop area */}
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-border hover:border-primary/50 rounded-lg p-4 text-center cursor-pointer transition-colors group">
                    {preview ? (
                      <img src={preview} alt="preview" className="max-h-32 mx-auto rounded object-contain" />
                    ) : selectedFile ? (
                      <div className="flex flex-col items-center gap-1">
                        <svg className="w-8 h-8 text-primary/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <p className="text-xs text-foreground font-medium">{selectedFile.name}</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5">
                        <svg className="w-7 h-7 text-muted-foreground group-hover:text-primary/70 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        <p className="text-xs text-muted-foreground">Clique para selecionar o comprovante</p>
                        <p className="text-[10px] text-muted-foreground/60">JPG, PNG, PDF — máx 10MB</p>
                      </div>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />

                  {selectedFile && (
                    <textarea value={observacao} onChange={e => setObservacao(e.target.value)}
                      placeholder="Observação opcional (ex: pix enviado às 17:30 de segunda)"
                      rows={2}
                      className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
                  )}

                  {uploadError && (
                    <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{uploadError}</p>
                  )}
                  {uploadOk && (
                    <p className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">Comprovante enviado com sucesso! Aguarde a aprovação.</p>
                  )}

                  <button onClick={handleUpload} disabled={!selectedFile || uploading}
                    className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-500 disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
                    {uploading
                      ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Enviando...</>
                      : <><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Enviar comprovante</>
                    }
                  </button>
                </>
              )}
            </div>

            {/* Check access button */}
            <button onClick={handleVerificar} disabled={checking}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {checking
                ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Verificando...</>
                : <><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3"/></svg> Verificar acesso</>
              }
            </button>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-4">Suporte: suporte@gotaxi.com</p>
      </div>
    </div>
  );
}
