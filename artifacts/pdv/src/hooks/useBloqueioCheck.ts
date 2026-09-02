import { useState, useCallback, useEffect } from "react";

export type RepasseStatus = {
  bloqueado: boolean;
  repasse: {
    id: number; valor_repasse: string; semana_inicio: string; semana_fim: string;
    receita_total: string; taxa_percentual: string; status: string;
    comprovante_path?: string; comprovante_enviado_em?: string;
  } | null;
  config: {
    taxa_repasse: number; chave_pix: string | null;
    tipo_chave_pix: string | null; nome_beneficiario: string | null; vencimento: string;
  };
};

export function useBloqueioCheck(token: string | null) {
  const [status, setStatus] = useState<RepasseStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      const r = await fetch("/api/pdv/repasse-status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setStatus(await r.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { check(); }, [check]);

  return { status, loading, recheck: check };
}
