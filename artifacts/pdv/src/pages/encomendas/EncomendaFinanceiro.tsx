import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, TrendingUp, AlertTriangle, CheckCircle, Upload, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";

const BASE = "/api";

function fmtR(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function fmtDt(v: string) { return v ? new Date(v).toLocaleDateString("pt-BR") : ""; }

const REP_STATUS: Record<string, { label: string; color: string; icon: any }> = {
  pendente: { label: "Pendente", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  pago: { label: "Pago", color: "bg-green-100 text-green-800", icon: CheckCircle },
  bloqueado: { label: "BLOQUEADO", color: "bg-red-100 text-red-800", icon: AlertTriangle },
  vencido: { label: "Vencido", color: "bg-orange-100 text-orange-800", icon: AlertTriangle },
};

export default function EncomendaFinanceiro() {
  const { token } = useAuth();
  const [periodo, setPeriodo] = useState("30");

  const { data, isLoading } = useQuery({
    queryKey: ["enc-financeiro", periodo],
    queryFn: async () => {
      const r = await fetch(`${BASE}/pdv/encomendas/financeiro?periodo=${periodo}`, { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
  });

  const { data: repasseStatus } = useQuery({
    queryKey: ["repasse-status"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/pdv/repasse-status`, { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
    refetchInterval: 60000,
  });

  const fat = data?.faturamento;
  const repasses = data?.repasses ?? [];

  const handleUploadComprovante = async (repasseId: number) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,application/pdf";
    input.onchange = async () => {
      if (!input.files?.[0]) return;
      const fd = new FormData();
      fd.append("comprovante", input.files[0]);
      await fetch(`${BASE}/pdv/repasse/${repasseId}/comprovante`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      window.location.reload();
    };
    input.click();
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><DollarSign className="w-6 h-6 text-orange-500" />Financeiro</h1>
          <p className="text-muted-foreground text-sm">Faturamento de encomendas e repasses GoTaxi</p>
        </div>
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {repasseStatus?.bloqueado && (
        <div className="rounded-xl bg-red-50 border-2 border-red-400 p-4">
          <div className="flex items-center gap-2 text-red-700 font-bold mb-1">
            <AlertTriangle className="w-5 h-5" />CONTA BLOQUEADA — Repasse pendente
          </div>
          <p className="text-sm text-red-600">Envie o comprovante PIX para reativar o acesso completo.</p>
          {repasseStatus?.semanaPassada?.status === "bloqueado" && (
            <Button size="sm" className="mt-2 bg-red-600 hover:bg-red-700 text-white" onClick={() => handleUploadComprovante(repasseStatus.semanaPassada.id)}>
              <Upload className="w-4 h-4 mr-1" />Enviar Comprovante de Pagamento
            </Button>
          )}
        </div>
      )}

      {isLoading && <div className="text-center py-8 text-muted-foreground">Carregando…</div>}

      {fat && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="pt-4">
            <p className="text-xl font-bold">{fmtR(fat.entregue)}</p>
            <p className="text-xs text-muted-foreground">Recebido (entregues)</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="text-xl font-bold text-yellow-600">{fmtR(fat.em_aberto)}</p>
            <p className="text-xs text-muted-foreground">Em aberto</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="text-xl font-bold text-orange-600">{fmtR(fat.comissao_gotaxi)}</p>
            <p className="text-xs text-muted-foreground">Comissão GoTaxi (3%)</p>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <p className="text-xl font-bold text-green-600">{fmtR(fat.entregue - fat.comissao_gotaxi)}</p>
            <p className="text-xs text-muted-foreground">Líquido (após repasse)</p>
          </CardContent></Card>
        </div>
      )}

      {fat && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1 grid grid-cols-3 gap-4 text-center">
                <div><p className="text-xl font-bold">{fat.total_encomendas}</p><p className="text-xs text-muted-foreground">Total encomendas</p></div>
                <div><p className="text-xl font-bold text-green-600">{fat.entregues}</p><p className="text-xs text-muted-foreground">Entregues</p></div>
                <div><p className="text-xl font-bold text-red-500">{fat.canceladas}</p><p className="text-xs text-muted-foreground">Canceladas</p></div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Repasses para GoTaxi (3%)</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 mb-4 text-sm text-orange-800">
            <p className="font-medium">📋 Como funciona o repasse:</p>
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs text-orange-700">
              <li>Calculado semanalmente (segunda a domingo)</li>
              <li>Taxa de 3% sobre faturamento de encomendas entregues</li>
              <li>Vencimento toda segunda-feira às 18h</li>
              <li>Atraso no pagamento bloqueia o sistema automaticamente</li>
            </ul>
          </div>
          {repasses.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum repasse gerado ainda</p>}
          <div className="space-y-2">
            {repasses.map((r: any) => {
              const sc = REP_STATUS[r.status] ?? REP_STATUS.pendente;
              const Icon = sc.icon;
              return (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">{fmtDt(r.semana_inicio)} – {fmtDt(r.semana_fim)}</p>
                    <p className="text-xs text-muted-foreground">Receita: {fmtR(Number(r.receita_total))} · Taxa: {r.taxa_percentual}%</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold">{fmtR(Number(r.valor_repasse))}</p>
                    <Badge className={`${sc.color} border-0 flex items-center gap-1 text-xs`}>
                      <Icon className="w-3 h-3" />{sc.label}
                    </Badge>
                    {r.status === "pendente" && (
                      <Button size="sm" variant="outline" onClick={() => handleUploadComprovante(r.id)}>
                        <Upload className="w-3 h-3 mr-1" />Pagar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {data?.por_status?.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Faturamento por Status</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.por_status.map((s: any) => (
                <div key={s.status} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground capitalize">{s.status.replace("_", " ")}</span>
                  <div className="flex gap-4">
                    <span className="font-medium">{s.qtd} encomendas</span>
                    <span className="font-bold">{fmtR(Number(s.total))}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
