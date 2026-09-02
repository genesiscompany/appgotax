import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Calendar, Copy, CheckCircle2, Clock, AlertCircle, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const API = import.meta.env.BASE_URL.replace(/\/$/, "").replace("/pdv", "") + "/api";
const apiHeaders = (token: string | null) => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

const STATUS_MAP: Record<string, { label: string; cls: string; icon: any }> = {
  pendente: { label: "Pendente", cls: "text-amber-600 bg-amber-500/10", icon: Clock },
  paga: { label: "Paga", cls: "text-green-600 bg-green-500/10", icon: CheckCircle2 },
  atrasada: { label: "Atrasada", cls: "text-red-600 bg-red-500/10", icon: AlertCircle },
  em_aberto: { label: "Em aberto", cls: "text-blue-600 bg-blue-500/10", icon: Clock },
};

export default function MotoristasRepasses() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: pix, isLoading: pixLoading } = useQuery({
    queryKey: ["corp-pix"],
    queryFn: async () => {
      const r = await fetch(`${API}/pdv/corporativo/pix-config`, { headers: apiHeaders(token) });
      return r.json();
    },
  });

  const { data: rep, isLoading: repLoading } = useQuery({
    queryKey: ["corp-repasses"],
    queryFn: async () => {
      const r = await fetch(`${API}/pdv/corporativo/repasses`, { headers: apiHeaders(token) });
      return r.json();
    },
  });

  const copiar = async () => {
    if (!pix?.br_code) return;
    try {
      await navigator.clipboard.writeText(pix.br_code);
      setCopied(true);
      toast({ title: "Código PIX copiado!" });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  if (pixLoading || repLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const semAtual = rep?.semana_atual;
  const historico: any[] = rep?.historico ?? [];
  const valorDevido = Number(pix?.valor_total_devido ?? 0);
  const semCobranca = valorDevido <= 0;

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary" /> Repasses GoTaxi
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pague o repasse semanal das corridas corporativas via PIX. Vencimento toda {pix?.dia_vencimento ?? "segunda-feira"} às {pix?.hora_vencimento ?? "18h"}.
        </p>
      </div>

      {/* Card de cobrança em aberto */}
      <div className="bg-gradient-to-br from-primary/5 via-card to-card border border-primary/20 rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Valor a pagar (esta semana)</p>
            <p className="text-3xl font-bold text-primary">{fmt(valorDevido)}</p>
            {semAtual && (
              <p className="text-xs text-muted-foreground mt-2">
                {semAtual.total_corridas} corrida(s) · {fmtDate(semAtual.inicio)} → {fmtDate(semAtual.fim)}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Taxa de repasse</p>
            <p className="text-lg font-semibold">{Number(pix?.taxa_repasse_pct ?? 20)}%</p>
          </div>
        </div>

        {semCobranca ? (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center text-sm text-green-700">
            <CheckCircle2 className="w-6 h-6 mx-auto mb-1" />
            Sem cobrança em aberto. Bom trabalho!
          </div>
        ) : !pix?.chave_pix ? (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 text-center text-sm text-amber-700">
            <AlertCircle className="w-5 h-5 mx-auto mb-1" />
            A chave PIX da GoTaxi ainda não foi configurada. Entre em contato com o suporte.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6 items-center">
            {/* QR Code */}
            <div className="bg-white p-4 rounded-xl flex items-center justify-center mx-auto">
              <QRCodeSVG value={pix.br_code} size={200} level="M" includeMargin={false} />
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Beneficiário</p>
                <p className="font-semibold">{pix.nome_beneficiario}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Chave PIX ({pix.tipo_chave || "—"})</p>
                <p className="font-mono text-sm break-all">{pix.chave_pix}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">PIX Copia e Cola</p>
                <div className="bg-muted rounded-lg p-2 text-xs font-mono break-all max-h-20 overflow-auto">
                  {pix.br_code}
                </div>
              </div>
              <Button onClick={copiar} className="w-full" variant={copied ? "outline" : "default"}>
                {copied ? <><CheckCircle2 className="w-4 h-4 mr-2" /> Copiado!</> : <><Copy className="w-4 h-4 mr-2" /> Copiar código PIX</>}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Histórico de repasses */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" /> Histórico de Repasses
          </h2>
        </div>
        {historico.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nenhum repasse fechado ainda. A primeira semana fecha automaticamente no domingo.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {historico.map((r: any) => {
              const s = STATUS_MAP[r.status] ?? STATUS_MAP.pendente;
              const Icon = s.icon;
              return (
                <div key={r.id} className="p-4 flex items-center justify-between hover:bg-muted/40 transition-colors">
                  <div>
                    <p className="text-sm font-medium">
                      Semana de {fmtDate(r.semana_inicio)} a {fmtDate(r.semana_fim)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {r.total_corridas} corridas
                      {r.vencimento && ` · vence em ${fmtDate(r.vencimento)}`}
                      {r.pago_em && ` · pago em ${fmtDate(r.pago_em)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${s.cls}`}>
                      <Icon className="w-3 h-3" />
                      {s.label}
                    </span>
                    <p className="font-bold text-sm w-24 text-right">{fmt(Number(r.valor_total))}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
