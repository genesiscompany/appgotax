import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PackageCheck, Search, Plus, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";

const BASE = "/api";

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-yellow-100 text-yellow-800",
  coletado: "bg-blue-100 text-blue-800",
  em_transporte: "bg-indigo-100 text-indigo-800",
  saiu_entrega: "bg-purple-100 text-purple-800",
  entregue: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800",
};
const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente", coletado: "Coletado", em_transporte: "Em Transporte",
  saiu_entrega: "Saiu p/ Entrega", entregue: "Entregue", cancelado: "Cancelado",
};
const TIPO_PACOTE_LABEL: Record<string, string> = {
  documento: "📄 Documento", pequeno: "📦 Pequeno", medio: "📦 Médio",
  grande: "📦 Grande", fragil: "🥚 Frágil", volumoso: "🏗️ Volumoso",
};
const FORMA_PAG_LABEL: Record<string, string> = {
  dinheiro: "💵 Dinheiro", pix: "🔑 PIX", credito: "💳 Crédito",
  debito: "💳 Débito", faturado: "📋 Faturado",
};

function fmtR(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function fmtDt(v: string) { return v ? new Date(v).toLocaleDateString("pt-BR") : ""; }

export default function EncomendaRecebimentos() {
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [dateFiltro, setDateFiltro] = useState("");

  const { data: encomendas, isLoading } = useQuery({
    queryKey: ["enc-recebimentos", statusFiltro, busca, dateFiltro],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFiltro !== "todos") params.set("status", statusFiltro);
      if (busca) params.set("busca", busca);
      if (dateFiltro) params.set("data", dateFiltro);
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
      qc.invalidateQueries({ queryKey: ["enc-recebimentos"] });
      qc.invalidateQueries({ queryKey: ["enc-dashboard"] });
    },
    onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
  });

  const total = encomendas?.reduce((s: number, e: any) => e.status !== "cancelado" ? s + Number(e.valor_frete) : s, 0) ?? 0;
  const qtdEntregues = encomendas?.filter((e: any) => e.status === "entregue").length ?? 0;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><PackageCheck className="w-6 h-6 text-orange-500" />Recebimentos</h1>
          <p className="text-muted-foreground text-sm">Controle de encomendas recebidas e pendentes</p>
        </div>
        <Link href="/encomendas/nova">
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white"><Plus className="w-4 h-4 mr-1" />Nova</Button>
        </Link>
      </div>

      {encomendas && (
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="pt-3 pb-3"><p className="text-2xl font-bold">{encomendas.length}</p><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
          <Card><CardContent className="pt-3 pb-3"><p className="text-2xl font-bold text-green-600">{qtdEntregues}</p><p className="text-xs text-muted-foreground">Entregues</p></CardContent></Card>
          <Card><CardContent className="pt-3 pb-3"><p className="text-lg font-bold text-orange-600">{fmtR(total)}</p><p className="text-xs text-muted-foreground">Faturamento</p></CardContent></Card>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input className="pl-8 h-9" placeholder="Buscar…" value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
          <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input className="h-9 w-36" type="date" value={dateFiltro} onChange={e => setDateFiltro(e.target.value)} />
      </div>

      {isLoading && <div className="text-center py-12 text-muted-foreground">Carregando…</div>}
      {!isLoading && !encomendas?.length && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
          Nenhuma encomenda encontrada
        </CardContent></Card>
      )}
      {!isLoading && encomendas?.length > 0 && (
        <div className="space-y-2">
          {encomendas.map((e: any) => (
            <Card key={e.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="py-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm">{e.codigo}</span>
                      <Badge className={`${STATUS_COLORS[e.status] ?? "bg-gray-100 text-gray-600"} border-0 text-xs`}>{STATUS_LABEL[e.status] ?? e.status}</Badge>
                      <Badge variant="outline" className="text-xs">{TIPO_PACOTE_LABEL[e.tipo_pacote] ?? e.tipo_pacote}</Badge>
                    </div>
                    <p className="text-sm font-medium mt-0.5">{e.cliente_nome || "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground">→ {e.destino_cidade || "Destino"} · {fmtDt(e.criado_em)} · {FORMA_PAG_LABEL[e.forma_pagamento] ?? e.forma_pagamento}</p>
                    {e.observacoes && <p className="text-xs text-muted-foreground italic mt-1">"{e.observacoes}"</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold">{fmtR(Number(e.valor_frete))}</p>
                    {e.peso_kg && <p className="text-xs text-muted-foreground">{e.peso_kg}kg</p>}
                  </div>
                  {e.status === "pendente" && (
                    <Button size="sm" variant="outline" className="flex-shrink-0" onClick={() => mutation.mutate({ id: e.id, status: "coletado" })}>
                      Confirmar Recebimento
                    </Button>
                  )}
                  {e.status === "coletado" && (
                    <Button size="sm" variant="outline" className="flex-shrink-0" onClick={() => mutation.mutate({ id: e.id, status: "em_transporte" })}>
                      Enviar p/ Transporte
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
