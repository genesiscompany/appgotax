import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, TrendingUp, MapPin, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";

const BASE = "/api";

function fmtR(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function fmtDt(v: string) { return v ? new Date(v + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : ""; }

const SERVICO_LABEL: Record<string, string> = { normal: "Normal", expresso: "Expresso", agendado: "Agendado", moto: "Motoboy" };

export default function EncomendaRelatorios() {
  const { token } = useAuth();
  const [periodo, setPeriodo] = useState("30");

  const { data, isLoading } = useQuery({
    queryKey: ["enc-relatorios", periodo],
    queryFn: async () => {
      const r = await fetch(`${BASE}/pdv/encomendas/relatorios?periodo=${periodo}`, { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
  });

  const totalFat = data?.diario?.reduce((s: number, d: any) => s + Number(d.faturamento), 0) ?? 0;
  const totalEnc = data?.diario?.reduce((s: number, d: any) => s + Number(d.total), 0) ?? 0;
  const totalEnt = data?.diario?.reduce((s: number, d: any) => s + Number(d.entregues), 0) ?? 0;
  const txEntrega = totalEnc > 0 ? Math.round((totalEnt / totalEnc) * 100) : 0;

  const maxFat = Math.max(...(data?.diario?.map((d: any) => Number(d.faturamento)) ?? [1]));

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6 text-orange-500" />Relatórios</h1>
          <p className="text-muted-foreground text-sm">Performance do módulo de encomendas</p>
        </div>
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && <div className="text-center py-12 text-muted-foreground">Carregando relatório…</div>}

      {!isLoading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="pt-4">
              <p className="text-2xl font-bold">{totalEnc}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Package className="w-3 h-3" />Total encomendas</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <p className="text-2xl font-bold text-green-600">{totalEnt}</p>
              <p className="text-xs text-muted-foreground">Entregues</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <p className="text-2xl font-bold text-blue-600">{txEntrega}%</p>
              <p className="text-xs text-muted-foreground">Taxa de entrega</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4">
              <p className="text-xl font-bold text-orange-600">{fmtR(totalFat)}</p>
              <p className="text-xs text-muted-foreground">Faturamento total</p>
            </CardContent></Card>
          </div>

          {data?.diario?.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4" />Faturamento Diário</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[...(data.diario)].slice(0, 14).map((d: any) => {
                    const w = maxFat > 0 ? (Number(d.faturamento) / maxFat) * 100 : 0;
                    return (
                      <div key={d.dia} className="flex items-center gap-2 text-sm">
                        <span className="w-16 text-right text-muted-foreground flex-shrink-0">{fmtDt(d.dia)}</span>
                        <div className="flex-1 bg-secondary rounded-full h-5 relative overflow-hidden">
                          <div className="h-full bg-orange-400 rounded-full" style={{ width: `${w}%` }} />
                          <span className="absolute inset-0 flex items-center px-2 text-xs font-medium text-gray-700">
                            {d.total} enc · {fmtR(Number(d.faturamento))}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {data?.destinos?.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><MapPin className="w-4 h-4" />Top Destinos</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.destinos.map((d: any, i: number) => (
                    <div key={d.destino_cidade ?? i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-xs flex items-center justify-center font-bold">{i + 1}</span>
                        <span>{d.destino_cidade || "Não informado"}</span>
                      </div>
                      <div className="flex gap-4 text-right">
                        <span className="text-muted-foreground">{d.qtd} env.</span>
                        <span className="font-bold">{fmtR(Number(d.faturamento))}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {data?.por_servico?.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Por Tipo de Serviço</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.por_servico.map((s: any) => (
                    <div key={s.tipo_servico} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{SERVICO_LABEL[s.tipo_servico] ?? s.tipo_servico}</span>
                      <div className="flex gap-4">
                        <span className="text-muted-foreground">{s.qtd} encomendas</span>
                        <span className="font-bold">{fmtR(Number(s.faturamento))}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
