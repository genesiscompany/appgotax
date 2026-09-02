import React, { useState } from "react";
import { motion } from "framer-motion";
import { Search, Eye, RefreshCcw, CheckCircle2, Printer, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { useOrders, Order } from "@/lib/useOrders";
import { printCupom } from "@/lib/print";

const STATUS_OPTIONS = [
  { value: "novo",         label: "Novo",            color: "bg-blue-500 text-white" },
  { value: "preparando",   label: "Preparando",      color: "bg-amber-400 text-amber-900" },
  { value: "pronto",       label: "Pronto",          color: "bg-emerald-500 text-white" },
  { value: "saiu_entrega", label: "Saiu p/ entrega", color: "bg-purple-500 text-white" },
  { value: "entregue",     label: "Entregue",        color: "bg-slate-400 text-white" },
  { value: "cancelado",    label: "Cancelado",       color: "bg-red-500 text-white" },
];

function statusColor(status: string) {
  return STATUS_OPTIONS.find(s => s.value === status || (status === "pendente" && s.value === "novo"))?.color
    ?? "bg-slate-200 text-slate-700";
}

function statusLabel(status: string) {
  return STATUS_OPTIONS.find(s => s.value === status || (status === "pendente" && s.value === "novo"))?.label
    ?? status;
}

const TIPO_MAP: Record<string, string> = {
  delivery: "Delivery",
  balcao: "Balcão",
  mesa: "Mesa",
  retirar: "Retirar",
  local: "Local",
};

export default function Pedidos() {
  const { token, user } = useAuth();
  const { orders, isLoading, fetchOrders, updateStatus } = useOrders(token, user?.empresaId ?? null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [pedidoCompartilhar, setPedidoCompartilhar] = useState<Order | null>(null);
  const [linkCopiado, setLinkCopiado] = useState(false);

  const filtered = orders.filter(o => {
    const matchStatus =
      filterStatus === "todos" ||
      o.status === filterStatus ||
      (filterStatus === "novo" && (o.status === "pendente" || o.status === "novo"));
    const matchSearch =
      !search ||
      o.clienteNome.toLowerCase().includes(search.toLowerCase()) ||
      String(o.id).includes(search);
    return matchStatus && matchSearch;
  });

  const novo      = orders.filter(o => o.status === "novo" || o.status === "pendente").length;
  const preparando = orders.filter(o => o.status === "preparando").length;
  const pronto    = orders.filter(o => o.status === "pronto").length;
  const entregues = orders.filter(o => o.status === "entregue").length;

  const trackingUrl = pedidoCompartilhar
    ? `${window.location.origin}${import.meta.env.BASE_URL}track/${pedidoCompartilhar.id}`
    : "";

  async function handleStatusChange(orderId: number, newStatus: string) {
    setUpdatingId(orderId);
    try {
      await updateStatus(orderId, newStatus);
      const order = orders.find(o => o.id === orderId);
      const wasNovo = order?.status === "novo" || order?.status === "pendente";
      if (order && wasNovo && newStatus !== "cancelado" && order.clienteWhatsapp) {
        setPedidoCompartilhar(order);
      }
    } finally {
      setUpdatingId(null);
    }
  }

  function handlePrint(order: Order) {
    printCupom({
      empresaNome: user?.nome ?? "GoTaxi",
      pedidoId: order.id,
      tipo: order.tipo,
      clienteNome: order.clienteNome,
      clienteEndereco: order.clienteEndereco,
      mesa: order.mesa,
      itens: order.itens.map(i => ({
        nome: i.produtoNome,
        quantidade: i.quantidade,
        precoUnitario: i.precoUnitario,
        total: i.total,
      })),
      total: order.total,
      formaPagamento: order.formaPagamento,
      observacoes: order.observacoes,
      criadoEm: order.criadoEm,
    });
  }

  function handleShareWhatsApp() {
    if (!pedidoCompartilhar) return;
    const msg = encodeURIComponent(
      `✅ Olá *${pedidoCompartilhar.clienteNome}*! Seu pedido *#${pedidoCompartilhar.id}* foi confirmado em *${user?.nome ?? "GoTaxi"}*.\n\nAcompanhe o status em tempo real:\n${trackingUrl}`
    );
    const tel = pedidoCompartilhar.clienteWhatsapp?.replace(/\D/g, "");
    window.open(`https://wa.me/${tel ? `55${tel}` : ""}?text=${msg}`, "_blank");
  }

  function handleFecharPopup() {
    setPedidoCompartilhar(null);
    setLinkCopiado(false);
  }

  return (
    <>
      {/* WhatsApp share popup */}
      {pedidoCompartilhar && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={handleFecharPopup}
        >
          <div
            className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-green-500/10 border-b border-green-500/20 p-5 text-center relative">
              <button
                onClick={handleFecharPopup}
                className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-2.5">
                <svg className="w-7 h-7 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-foreground">
                Pedido #{pedidoCompartilhar.id} aceito!
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Avise o cliente que o pedido foi confirmado
              </p>
            </div>

            <div className="p-5 space-y-4">
              {/* Cliente info */}
              <div className="flex items-center gap-3 p-3 bg-secondary/50 border border-border rounded-xl">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">
                    {pedidoCompartilhar.clienteNome.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{pedidoCompartilhar.clienteNome}</p>
                  <p className="text-xs text-muted-foreground">{pedidoCompartilhar.clienteWhatsapp}</p>
                </div>
                <div className="ml-auto shrink-0 text-right">
                  <p className="text-sm font-bold text-foreground">R$ {pedidoCompartilhar.total.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground capitalize">{TIPO_MAP[pedidoCompartilhar.tipo] ?? pedidoCompartilhar.tipo}</p>
                </div>
              </div>

              {/* Tracking link */}
              <div className="bg-secondary/50 border border-border rounded-xl p-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Link de rastreamento
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-foreground font-mono break-all flex-1 leading-relaxed">{trackingUrl}</p>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(trackingUrl);
                      setLinkCopiado(true);
                      setTimeout(() => setLinkCopiado(false), 2500);
                    }}
                    className="shrink-0 px-2.5 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-semibold hover:bg-primary/20 transition-colors border border-primary/20"
                  >
                    {linkCopiado ? "✓" : "Copiar"}
                  </button>
                </div>
              </div>

              {/* WhatsApp button */}
              <button
                onClick={handleShareWhatsApp}
                className="w-full py-3 rounded-xl bg-[#25D366] hover:bg-[#22c55e] text-white font-bold text-sm flex items-center justify-center gap-2.5 transition-colors shadow-md shadow-green-500/20"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                  <path d="M11.99 2C6.469 2 2 6.476 2 12.005c0 1.768.462 3.43 1.264 4.878L2 22l5.266-1.243A9.956 9.956 0 0 0 12.01 22C17.531 22 22 17.524 22 12 22 6.476 17.521 2 11.99 2zm.02 18c-1.591 0-3.088-.44-4.37-1.198l-.313-.185-3.124.738.779-3.04-.203-.32A8.01 8.01 0 0 1 4 12.005C4 7.584 7.578 4 11.99 4 16.411 4 20 7.582 20 12c0 4.418-3.589 8-8.01 8z" />
                </svg>
                Enviar via WhatsApp
              </button>

              <button
                onClick={handleFecharPopup}
                className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6 max-w-7xl mx-auto"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Gestão de Pedidos</h1>
            <p className="text-muted-foreground mt-1">Acompanhe e gerencie todos os pedidos em tempo real.</p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar pedido ou cliente..."
                className="pl-9 bg-card"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" className="shrink-0 bg-card" onClick={fetchOrders} disabled={isLoading}>
              <RefreshCcw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {[
            { key: "todos",      label: "Todos",      count: orders.length },
            { key: "novo",       label: "Novos",      count: novo },
            { key: "preparando", label: "Preparando", count: preparando },
            { key: "pronto",     label: "Prontos",    count: pronto },
            { key: "entregue",   label: "Entregues",  count: entregues },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilterStatus(f.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                filterStatus === f.key
                  ? "bg-foreground text-background border-foreground shadow-sm"
                  : "bg-card text-muted-foreground border-border/50 hover:bg-secondary"
              }`}
            >
              {f.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                filterStatus === f.key ? "bg-background/20" : "bg-secondary"
              }`}>{f.count}</span>
            </button>
          ))}
        </div>

        <Card className="shadow-sm border-border/50">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground gap-3">
                <RefreshCcw className="w-5 h-5 animate-spin" />
                <span>Carregando pedidos...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                <CheckCircle2 className="w-10 h-10 opacity-20" />
                <p className="font-medium">Nenhum pedido encontrado</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-secondary/50">
                  <TableRow className="hover:bg-transparent border-border/50">
                    <TableHead className="w-[90px] font-semibold">Pedido</TableHead>
                    <TableHead className="font-semibold">Cliente</TableHead>
                    <TableHead className="font-semibold hidden md:table-cell">Módulo</TableHead>
                    <TableHead className="font-semibold hidden sm:table-cell">Tipo</TableHead>
                    <TableHead className="text-center font-semibold">Itens</TableHead>
                    <TableHead className="text-right font-semibold">Valor</TableHead>
                    <TableHead className="font-semibold hidden sm:table-cell">Pagamento</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="text-right font-semibold">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(order => {
                    const currentStatus = order.status === "pendente" ? "novo" : order.status;
                    const isUpdating = updatingId === order.id;
                    return (
                      <TableRow key={order.id} className="hover:bg-muted/30 border-border/50 transition-colors">
                        <TableCell className="font-medium text-foreground">#{order.id}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{order.clienteNome}</p>
                            {order.clienteWhatsapp && (
                              <p className="text-xs text-muted-foreground">{order.clienteWhatsapp}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground capitalize">{order.modulo}</TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">{TIPO_MAP[order.tipo] ?? order.tipo}</TableCell>
                        <TableCell className="text-center">{order.itens.length}</TableCell>
                        <TableCell className="text-right font-medium">R$ {order.total.toFixed(2)}</TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground capitalize">{order.formaPagamento}</TableCell>
                        <TableCell>
                          <Select
                            value={currentStatus}
                            onValueChange={val => handleStatusChange(order.id, val)}
                            disabled={isUpdating}
                          >
                            <SelectTrigger className={`h-8 w-40 text-xs font-semibold border-0 rounded-full px-3 focus:ring-1 ${statusColor(currentStatus)} ${isUpdating ? "opacity-60" : ""}`}>
                              <SelectValue>
                                {isUpdating ? "Salvando..." : statusLabel(currentStatus)}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  <div className="flex items-center gap-2">
                                    <span className={`inline-block w-2 h-2 rounded-full ${opt.color.split(" ")[0]}`} />
                                    {opt.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => handlePrint(order)}
                              title="Imprimir cupom"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </>
  );
}
