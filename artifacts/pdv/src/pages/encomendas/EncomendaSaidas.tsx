import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Truck, MapPin, Search, CheckCircle, Navigation } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const BASE = "/api";

const STATUS_COLORS: Record<string, string> = {
  em_transporte: "bg-indigo-100 text-indigo-800",
  saiu_entrega: "bg-purple-100 text-purple-800",
  entregue: "bg-green-100 text-green-800",
  pendente: "bg-yellow-100 text-yellow-800",
};
const STATUS_LABEL: Record<string, string> = {
  em_transporte: "Em Transporte",
  saiu_entrega: "Saiu p/ Entrega",
  entregue: "Entregue",
  pendente: "Pendente",
  coletado: "Coletado",
};

function fmtR(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function fmtDt(v: string) {
  if (!v) return "";
  return new Date(v).toLocaleDateString("pt-BR");
}

export default function EncomendaSaidas() {
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("saiu_entrega");
  const [data, setData] = useState("");

  const { data: encomendas, isLoading } = useQuery({
    queryKey: ["enc-saidas", statusFiltro, busca, data],
    queryFn: async () => {
      const params = new URLSearchParams({ status: statusFiltro });
      if (busca) params.set("busca", busca);
      if (data) params.set("data", data);
      const r = await fetch(`${BASE}/pdv/encomendas?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      return r.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const r = await fetch(`${BASE}/pdv/encomendas/${id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status, operador_nome: "Operador PDV" }),
      });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Status atualizado!" });
      qc.invalidateQueries({ queryKey: ["enc-saidas"] });
      qc.invalidateQueries({ queryKey: ["enc-dashboard"] });
    },
    onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
  });

  const hoje = new Date().toISOString().split("T")[0];

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Truck className="w-6 h-6 text-orange-500" />Saídas e Entregas</h1>
        <p className="text-muted-foreground text-sm">Gerenciar encomendas em rota</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input className="pl-8 h-9" placeholder="Buscar por código ou cliente…" value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
          <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="coletado">Coletado</SelectItem>
            <SelectItem value="em_transporte">Em Transporte</SelectItem>
            <SelectItem value="saiu_entrega">Saiu p/ Entrega</SelectItem>
            <SelectItem value="entregue">Entregue</SelectItem>
          </SelectContent>
        </Select>
        <Input className="h-9 w-36" type="date" value={data} onChange={e => setData(e.target.value)} max={hoje} />
      </div>

      {isLoading && <div className="text-center py-12 text-muted-foreground">Carregando…</div>}
      {!isLoading && !encomendas?.length && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma encomenda encontrada</CardContent></Card>
      )}
      {!isLoading && encomendas?.length > 0 && (
        <div className="space-y-2">
          {encomendas.map((e: any) => (
            <Card key={e.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="py-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm">{e.codigo}</span>
                      <Badge className={`${STATUS_COLORS[e.status] ?? "bg-gray-100 text-gray-600"} border-0 text-xs`}>{STATUS_LABEL[e.status] ?? e.status}</Badge>
                    </div>
                    <p className="text-sm font-medium truncate mt-0.5">{e.cliente_nome || "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" />{e.destino_endereco || e.destino_cidade || "Destino"}
                      {e.destino_cidade && ` — ${e.destino_cidade}`}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold">{fmtR(Number(e.valor_frete))}</p>
                    <p className="text-xs text-muted-foreground">{fmtDt(e.criado_em)}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0 flex-wrap">
                    {(e.destino_endereco || e.destino_cidade) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                        onClick={() => {
                          const addr = [e.destino_endereco, e.destino_bairro, e.destino_cidade].filter(Boolean).join(", ");
                          window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`, "_blank");
                        }}
                      >
                        <Navigation className="w-3 h-3 mr-1" />Navegar
                      </Button>
                    )}
                    {e.status === "coletado" && (
                      <Button size="sm" variant="outline" onClick={() => mutation.mutate({ id: e.id, status: "em_transporte" })}>
                        <Truck className="w-3 h-3 mr-1" />Em Rota
                      </Button>
                    )}
                    {e.status === "em_transporte" && (
                      <Button size="sm" variant="outline" onClick={() => mutation.mutate({ id: e.id, status: "saiu_entrega" })}>
                        <Truck className="w-3 h-3 mr-1" />Saiu Entrega
                      </Button>
                    )}
                    {e.status === "saiu_entrega" && (
                      <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white" onClick={() => mutation.mutate({ id: e.id, status: "entregue" })}>
                        <CheckCircle className="w-3 h-3 mr-1" />Entregue
                      </Button>
                    )}
                    {e.status === "pendente" && (
                      <Button size="sm" variant="outline" onClick={() => mutation.mutate({ id: e.id, status: "coletado" })}>
                        <CheckCircle className="w-3 h-3 mr-1" />Coletar
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
