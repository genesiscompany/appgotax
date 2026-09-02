import React, { useEffect, useState } from "react";
import { useRoute } from "wouter";

type OrderStatus = "novo" | "preparando" | "pronto" | "entregue" | "cancelado";

type TrackData = {
  id: number;
  status: OrderStatus;
  tipo: string;
  cliente_nome: string;
  total: string;
  criado_em: string;
  confirmado_em: string | null;
  preparando_em: string | null;
  pronto_em: string | null;
  entregue_em: string | null;
  cliente_endereco: string | null;
  empresa_nome: string;
  itens: { produto_nome: string; quantidade: number; preco_unitario: string; total: string }[];
};

const STATUS_ORDER: OrderStatus[] = ["novo", "preparando", "pronto", "entregue"];

function statusIndex(s: OrderStatus) {
  return STATUS_ORDER.indexOf(s);
}

function fmt(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function StepIcon({ step, done, active }: { step: number; done: boolean; active: boolean }) {
  const icons = [
    // Confirmado
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
      <polyline points="20 6 9 17 4 12" />
    </svg>,
    // Preparando
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
      <path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/>
    </svg>,
    // A caminho / Pronto
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>,
    // Entregue
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>,
  ];
  return (
    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
      done ? "bg-primary text-white shadow-md shadow-primary/30" :
      active ? "bg-primary/20 text-primary ring-2 ring-primary/40 ring-offset-2 ring-offset-background animate-pulse" :
      "bg-muted text-muted-foreground/50"
    }`}>
      {icons[step]}
    </div>
  );
}

export default function Track() {
  const [, params] = useRoute("/track/:id");
  const id = params?.id;
  const [data, setData] = useState<TrackData | null>(null);
  const [error, setError] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const fetch_ = async () => {
    try {
      const r = await fetch(`/api/public/pedido/${id}`);
      if (!r.ok) { setError(true); return; }
      setData(await r.json());
      setLastUpdate(new Date());
    } catch { setError(true); }
  };

  useEffect(() => { if (id) fetch_(); }, [id]);
  useEffect(() => {
    if (!id || data?.status === "entregue" || data?.status === "cancelado") return;
    const t = setInterval(fetch_, 12_000);
    return () => clearInterval(t);
  }, [id, data?.status]);

  if (error) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <h2 className="text-lg font-bold text-foreground">Pedido não encontrado</h2>
        <p className="text-sm text-muted-foreground">Verifique o link enviado pelo estabelecimento.</p>
      </div>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Carregando seu pedido...</p>
      </div>
    </div>
  );

  const isCanceled = data.status === "cancelado";
  const currentStep = isCanceled ? -1 : statusIndex(data.status);
  const isDelivery = data.tipo === "delivery";

  const STEPS = [
    { label: "Confirmado", sublabel: "Pedido recebido", time: data.confirmado_em ?? data.criado_em },
    { label: "Preparando", sublabel: "Na cozinha", time: data.preparando_em },
    { label: isDelivery ? "A Caminho" : "Pronto!", sublabel: isDelivery ? "Saiu para entrega" : "Pode retirar", time: data.pronto_em },
    { label: "Entregue", sublabel: isDelivery ? "Aproveite!" : "Finalizado", time: data.entregue_em },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <img src="/logo.png" alt="GoTaxi" className="h-7 object-contain" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">Rastreamento de Pedido</p>
          <p className="text-sm font-semibold text-foreground truncate">{data.empresa_nome}</p>
        </div>
        <span className="text-xs text-muted-foreground">
          #{data.id}
        </span>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Canceled */}
        {isCanceled && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-5 text-center">
            <div className="w-14 h-14 rounded-full bg-destructive/15 flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </div>
            <h2 className="text-lg font-bold text-foreground">Pedido Cancelado</h2>
            <p className="text-sm text-muted-foreground mt-1">Entre em contato com o estabelecimento para mais informações.</p>
          </div>
        )}

        {/* Status card */}
        {!isCanceled && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            {/* Current status banner */}
            <div className={`px-5 py-4 ${
              data.status === "entregue" ? "bg-green-500/10 border-b border-green-500/15" :
              data.status === "pronto" ? "bg-blue-500/10 border-b border-blue-500/15" :
              data.status === "preparando" ? "bg-amber-500/10 border-b border-amber-500/15" :
              "bg-primary/10 border-b border-primary/15"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  data.status === "entregue" ? "bg-green-500" :
                  data.status === "pronto" ? "bg-blue-500" :
                  data.status === "preparando" ? "bg-amber-500" :
                  "bg-primary"
                } ${data.status !== "entregue" ? "animate-pulse" : ""}`} />
                <div>
                  <p className="text-xs text-muted-foreground">Status atual</p>
                  <p className="font-bold text-foreground text-lg leading-tight">
                    {data.status === "novo" && "Confirmado! 🎉"}
                    {data.status === "preparando" && "Preparando... 🍳"}
                    {data.status === "pronto" && (isDelivery ? "A caminho! 🛵" : "Pronto para retirar! ✅")}
                    {data.status === "entregue" && "Entregue! 🎉"}
                  </p>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="p-5 space-y-1">
              {STEPS.map((step, i) => {
                const done = currentStep >= i;
                const active = currentStep === i;
                return (
                  <div key={i} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <StepIcon step={i} done={done} active={active} />
                      {i < STEPS.length - 1 && (
                        <div className={`w-0.5 flex-1 my-1 rounded-full transition-colors duration-500 ${done && currentStep > i ? "bg-primary" : "bg-border"}`} style={{ minHeight: 24 }} />
                      )}
                    </div>
                    <div className="pb-5 flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <p className={`font-semibold text-sm ${done ? "text-foreground" : "text-muted-foreground/50"}`}>{step.label}</p>
                        {step.time && done && (
                          <span className="text-xs text-muted-foreground">{fmt(step.time)}</span>
                        )}
                      </div>
                      <p className={`text-xs ${done ? "text-muted-foreground" : "text-muted-foreground/40"}`}>{step.sublabel}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Order summary */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-border">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Seu pedido</p>
              <span className="text-xs text-muted-foreground capitalize bg-secondary px-2.5 py-1 rounded-full">
                {data.tipo === "delivery" ? "🛵 Delivery" : data.tipo === "retirar" ? "🏃 Retirada" : data.tipo === "mesa" ? "🪑 Mesa" : "🏠 Local"}
              </span>
            </div>
            {data.cliente_nome && (
              <p className="text-xs text-muted-foreground mt-0.5">para {data.cliente_nome}</p>
            )}
          </div>
          <div className="divide-y divide-border/50">
            {data.itens.map((item, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{item.quantidade}</span>
                  <span className="text-sm text-foreground">{item.produto_nome}</span>
                </div>
                <span className="text-sm font-medium text-foreground shrink-0">R$ {Number(item.total).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="px-5 py-3.5 bg-secondary/30 flex items-center justify-between border-t border-border">
            <span className="text-sm font-semibold text-foreground">Total</span>
            <span className="text-lg font-bold text-foreground">R$ {Number(data.total).toFixed(2)}</span>
          </div>
        </div>

        {/* Delivery address */}
        {data.cliente_endereco && (
          <div className="bg-card border border-border rounded-2xl px-5 py-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Endereço de entrega</p>
              <p className="text-sm text-foreground mt-0.5">{data.cliente_endereco}</p>
            </div>
          </div>
        )}

        {/* Auto-refresh indicator */}
        {data.status !== "entregue" && data.status !== "cancelado" && (
          <p className="text-center text-xs text-muted-foreground/60">
            Atualização automática a cada 12 segundos · último às {lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
        )}

        {data.status === "entregue" && (
          <div className="text-center py-3">
            <p className="text-sm text-muted-foreground">Obrigado pela preferência!</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Powered by GoTaxi</p>
          </div>
        )}
      </div>
    </div>
  );
}
