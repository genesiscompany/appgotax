import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Package, CheckCircle, Truck, Clock, XCircle, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";

const BASE = "/api";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any; bg: string }> = {
  pendente: { label: "Pendente", color: "text-yellow-600", icon: Clock, bg: "bg-yellow-50 border-yellow-200" },
  coletado: { label: "Coletado", color: "text-blue-600", icon: Package, bg: "bg-blue-50 border-blue-200" },
  em_transporte: { label: "Em Transporte", color: "text-indigo-600", icon: Truck, bg: "bg-indigo-50 border-indigo-200" },
  saiu_entrega: { label: "Saiu p/ Entrega", color: "text-purple-600", icon: Truck, bg: "bg-purple-50 border-purple-200" },
  entregue: { label: "Entregue", color: "text-green-600", icon: CheckCircle, bg: "bg-green-50 border-green-200" },
  cancelado: { label: "Cancelado", color: "text-red-600", icon: XCircle, bg: "bg-red-50 border-red-200" },
};

const STATUS_STEPS = ["pendente", "coletado", "em_transporte", "saiu_entrega", "entregue"];

function fmtDt(v: string) {
  if (!v) return "";
  return new Date(v).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function fmtR(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

export default function EncomendaRastreamento() {
  const { token } = useAuth();
  const [search, setSearch] = useState("");
  const [codigo, setCodigo] = useState("");

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["enc-rastrear", codigo],
    queryFn: async () => {
      if (!codigo) return null;
      const r = await fetch(`${BASE}/pdv/encomendas/rastrear/${encodeURIComponent(codigo)}`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.status === 404) return null;
      return r.json();
    },
    enabled: !!codigo,
  });

  const handleSearch = () => {
    const c = search.trim().toUpperCase();
    if (!c) return;
    if (!c.startsWith("ENK-") && !c.match(/^\d+$/)) {
      const padded = "ENK-" + c.padStart(5, "0");
      setCodigo(padded);
    } else {
      setCodigo(c);
    }
  };

  const statusCfg = data ? (STATUS_CONFIG[data.status] ?? STATUS_CONFIG.pendente) : null;
  const currentStep = data ? STATUS_STEPS.indexOf(data.status) : -1;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Search className="w-6 h-6 text-orange-500" />Rastrear Encomenda</h1>
        <p className="text-muted-foreground text-sm">Digite o código para verificar o status</p>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-2">
            <Input
              className="h-11 font-mono text-base"
              placeholder="ENK-00001 ou número"
              value={search}
              onChange={e => setSearch(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
            />
            <Button className="h-11 px-5 bg-orange-500 hover:bg-orange-600 text-white" onClick={handleSearch} disabled={isFetching}>
              {isFetching ? "…" : <Search className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {codigo && !isLoading && !data && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4 text-center text-red-700">
            <XCircle className="w-8 h-8 mx-auto mb-2" />
            Nenhuma encomenda encontrada com o código <strong>{codigo}</strong>
          </CardContent>
        </Card>
      )}

      {data && statusCfg && (
        <div className="space-y-4">
          <Card className={`border ${statusCfg.bg}`}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono font-bold text-lg">{data.codigo}</p>
                  <p className="font-medium">{data.cliente_nome || "Remetente"}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3" />{data.destino_cidade || "Destino"} {data.destino_bairro ? `— ${data.destino_bairro}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <Badge className={`${statusCfg.color} bg-white border text-sm font-semibold`}>{statusCfg.label}</Badge>
                  <p className="text-sm font-bold mt-1">{fmtR(Number(data.valor_frete))}</p>
                </div>
              </div>

              {data.status !== "cancelado" && (
                <div className="mt-4">
                  <div className="flex items-center gap-1">
                    {STATUS_STEPS.map((s, i) => {
                      const done = i <= currentStep;
                      return (
                        <React.Fragment key={s}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2
                            ${done ? "bg-orange-500 border-orange-500 text-white" : "bg-white border-gray-300 text-gray-400"}`}>
                            {i + 1}
                          </div>
                          {i < STATUS_STEPS.length - 1 && <div className={`flex-1 h-1 rounded ${done && i < currentStep ? "bg-orange-500" : "bg-gray-200"}`} />}
                        </React.Fragment>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-1">
                    {STATUS_STEPS.map((s) => (
                      <span key={s} className="text-xs text-muted-foreground text-center" style={{ width: "20%" }}>
                        {STATUS_CONFIG[s]?.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {data.data_previsao && (
            <Card>
              <CardContent className="pt-3 pb-3 flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-orange-500" />
                Previsão de entrega: <strong>{new Date(data.data_previsao).toLocaleDateString("pt-BR")}</strong>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-sm">Histórico de Eventos</CardTitle></CardHeader>
            <CardContent>
              {!data.historico?.length && <p className="text-muted-foreground text-sm text-center py-4">Nenhum evento registrado</p>}
              <div className="space-y-3">
                {[...(data.historico || [])].reverse().map((h: any) => {
                  const sc = STATUS_CONFIG[h.status] ?? STATUS_CONFIG.pendente;
                  const Icon = sc.icon;
                  return (
                    <div key={h.id} className="flex gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border ${sc.bg}`}>
                        <Icon className={`w-4 h-4 ${sc.color}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{h.descricao || sc.label}</p>
                        <p className="text-xs text-muted-foreground">{fmtDt(h.registrado_em)}{h.operador_nome ? ` · ${h.operador_nome}` : ""}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
