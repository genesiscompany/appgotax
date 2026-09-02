import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Bike, RefreshCcw, AlertTriangle, CheckCircle2, X, User, Package, Zap, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

interface Boy {
  id: number;
  nome: string;
  telefone: string;
  tipo_veiculo: string | null;
  veiculo_modelo: string | null;
  lat: number;
  lng: number;
  ultimo_ping: string;
}

interface Pedido {
  id: number;
  cliente_nome: string;
  cliente_whatsapp: string | null;
  cliente_endereco: string | null;
  total: number;
  taxa_entrega: number | null;
  status: string;
  criado_em: string;
  observacoes: string | null;
  boy_id: number | null;
  itens: { nome: string; qtd: number }[];
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  novo: { label: "Novo", color: "bg-blue-500 text-white" },
  preparando: { label: "Preparando", color: "bg-amber-100 text-amber-700 border border-amber-200" },
  pronto: { label: "Pronto 🟢", color: "bg-emerald-500 text-white" },
};

function extractArea(address: string | null): string {
  if (!address) return "";
  return address.split(",").slice(0, 2).join(",").toLowerCase().trim();
}

function routesDiverge(existing: (string | null)[], newAddr: string | null): boolean {
  const newArea = extractArea(newAddr);
  if (!newArea) return false;
  return existing.some(addr => { const a = extractArea(addr); return a && a !== newArea; });
}

// ── Boy picker dropdown ──────────────────────────────────────────────────────
function BoyPicker({ boys, pedido, pedidos, onAtribuir, assigning }: {
  boys: Boy[]; pedido: Pedido; pedidos: Pedido[];
  onAtribuir: (pedido: Pedido, boy: Boy) => void; assigning: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        disabled={assigning || boys.length === 0}
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold text-sm transition-colors"
      >
        <Bike className="w-4 h-4" />
        Adicionar para boy delivery
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute bottom-full mb-2 left-0 right-0 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden"
          >
            {boys.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground text-center">Nenhum boy disponível</div>
            ) : (
              boys.map(boy => {
                const cnt = pedidos.filter(p => p.boy_id === boy.id).length;
                const full = cnt >= 3;
                const existingAddresses = pedidos.filter(p => p.boy_id === boy.id).map(p => p.cliente_endereco);
                const diverge = cnt >= 1 && routesDiverge(existingAddresses, pedido.cliente_endereco);
                return (
                  <button
                    key={boy.id}
                    disabled={full || assigning}
                    onClick={() => { setOpen(false); onAtribuir(pedido, boy); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary transition-colors border-b border-border/50 last:border-0 ${full ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    <span className="text-xl">🛵</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{boy.nome}</p>
                      <p className="text-xs text-muted-foreground">{cnt}/3 entregas · {boy.tipo_veiculo || "moto"}</p>
                    </div>
                    {diverge && !full && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Rota diferente</span>
                    )}
                    {full && (
                      <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">Cheio</span>
                    )}
                    {!full && cnt > 0 && (
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center font-bold">{cnt}</span>
                    )}
                  </button>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function TimeLine() {
  const { token } = useAuth();
  const { toast } = useToast();
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const markersRef = useRef<Map<number, any>>(new Map());

  const [boys, setBoys] = useState<Boy[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [mapsReady, setMapsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [timelineAtivo, setTimelineAtivo] = useState(true);
  const [togglingTimeline, setTogglingTimeline] = useState(false);
  const [warnDialog, setWarnDialog] = useState<{ pedido: Pedido; boy: Boy } | null>(null);
  const [boyPicker, setBoyPicker] = useState<Boy | null>(null);

  const authHeaders = { Authorization: `Bearer ${token}` };

  const fetchBoys = useCallback(async () => {
    try {
      const res = await fetch("/api/pdv/delivery/boys", { headers: authHeaders });
      if (res.ok) setBoys(await res.json());
    } catch { }
  }, [token]);

  const fetchPedidos = useCallback(async () => {
    try {
      const res = await fetch("/api/pdv/delivery/pedidos-prontos", { headers: authHeaders });
      if (res.ok) setPedidos(await res.json());
    } catch { }
    setLoading(false);
  }, [token]);

  const fetchTimelineConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/pdv/delivery/timeline-config", { headers: authHeaders });
      if (res.ok) { const d = await res.json(); setTimelineAtivo(d.timelineAtivo); }
    } catch { }
  }, [token]);

  // Load Google Maps
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const res = await fetch("/api/pdv/maps-key", { headers: authHeaders });
        const { key } = await res.json();
        if (!key || cancelled) return;
        if ((window as any).google?.maps?.Map) { setMapsReady(true); return; }
        // Callback chamado quando Maps está totalmente pronto
        (window as any).__mapsReady = () => { if (!cancelled) setMapsReady(true); };
        (window as any).gm_authFailure = () => {
          console.error("[TimeLine] Google Maps auth error — verifique as restrições da chave no Google Cloud Console");
        };
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&loading=async&callback=__mapsReady`;
        script.async = true;
        script.defer = true;
        script.onerror = () => { console.error("[TimeLine] Falha ao carregar script do Google Maps"); };
        document.head.appendChild(script);
      } catch { }
    }
    init();
    return () => { cancelled = true; };
  }, [token]);

  // Initialize map
  useEffect(() => {
    if (!mapsReady || !mapRef.current || googleMapRef.current) return;
    const map = new (window as any).google.maps.Map(mapRef.current, {
      zoom: 14, center: { lat: -22.9, lng: -47.06 },
      mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
    });
    googleMapRef.current = map;
    fetch("/api/pdv/delivery/restaurante-config", { headers: authHeaders })
      .then(r => r.json()).then(cfg => {
        if (cfg.lat_restaurante && cfg.lng_restaurante) {
          map.setCenter({ lat: Number(cfg.lat_restaurante), lng: Number(cfg.lng_restaurante) });
          new (window as any).google.maps.Marker({
            position: { lat: Number(cfg.lat_restaurante), lng: Number(cfg.lng_restaurante) },
            map, title: "Minha Loja",
            icon: { url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png" },
          });
        }
      }).catch(() => { });
  }, [mapsReady]);

  // Update boy markers
  useEffect(() => {
    if (!googleMapRef.current || !mapsReady) return;
    const G = (window as any).google.maps;
    const map = googleMapRef.current;
    const currentIds = new Set(boys.map(b => b.id));
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) { marker.setMap(null); markersRef.current.delete(id); }
    });
    boys.forEach(boy => {
      const lat = Number(boy.lat); const lng = Number(boy.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const pos = { lat, lng };
      const cnt = pedidos.filter(p => p.boy_id === boy.id).length;
      const initial = (boy.nome || "?").trim().charAt(0).toUpperCase();
      // Plain SVG (no emoji) — renders reliably on every browser
      const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r="24" fill="#22c55e" stroke="white" stroke-width="4"/>
        <text x="28" y="36" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="white">${initial}</text>
        ${cnt > 0 ? `<circle cx="44" cy="12" r="11" fill="#ef4444" stroke="white" stroke-width="2"/><text x="44" y="16" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" fill="white" font-weight="bold">${cnt}</text>` : ""}
      </svg>`;
      const icon = { url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svgIcon), scaledSize: new G.Size(56, 56), anchor: new G.Point(28, 28) };
      const existing = markersRef.current.get(boy.id);
      if (existing) { existing.setPosition(pos); existing.setIcon(icon); }
      else {
        const marker = new G.Marker({ position: pos, map, title: boy.nome, icon, zIndex: 1000 });
        markersRef.current.set(boy.id, marker);
      }
    });

    // Auto-fit map bounds to include all boys (and restaurant if present)
    const validBoys = boys.filter(b => Number.isFinite(Number(b.lat)) && Number.isFinite(Number(b.lng)));
    if (validBoys.length > 0) {
      const bounds = new G.LatLngBounds();
      validBoys.forEach(b => bounds.extend({ lat: Number(b.lat), lng: Number(b.lng) }));
      const c = map.getCenter();
      if (c) bounds.extend(c); // include current center (restaurant or default)
      map.fitBounds(bounds, 80);
      // Don't zoom in too far if only one boy
      const z = map.getZoom();
      if (z && z > 15) map.setZoom(15);
    }
  }, [boys, pedidos, mapsReady]);

  useEffect(() => {
    fetchBoys(); fetchPedidos(); fetchTimelineConfig();
    const interval = setInterval(() => { fetchBoys(); fetchPedidos(); }, 30_000);
    return () => clearInterval(interval);
  }, [fetchBoys, fetchPedidos, fetchTimelineConfig]);

  async function handleToggleTimeline() {
    setTogglingTimeline(true);
    const novo = !timelineAtivo;
    try {
      const res = await fetch("/api/pdv/delivery/timeline-config", {
        method: "PUT",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ timelineAtivo: novo }),
      });
      if (res.ok) {
        setTimelineAtivo(novo);
        toast({
          title: novo ? "Timeline Manual Ativado" : "Auto-despacho Ativado",
          description: novo ? "Você atribuirá manualmente os pedidos aos boys." : "Boys serão chamados automaticamente em até 2km.",
        });
      }
    } catch { }
    setTogglingTimeline(false);
  }

  async function handleAtribuir(pedido: Pedido, boy: Boy) {
    const boyPedidos = pedidos.filter(p => p.boy_id === boy.id);
    if (boyPedidos.length >= 3) {
      toast({ title: "Limite atingido", description: `${boy.nome} já tem 3 entregas.`, variant: "destructive" });
      return;
    }
    const existingAddresses = boyPedidos.map(p => p.cliente_endereco);
    if (boyPedidos.length >= 1 && routesDiverge(existingAddresses, pedido.cliente_endereco)) {
      setWarnDialog({ pedido, boy }); return;
    }
    await doAtribuir(pedido.id, boy.id);
  }

  async function doAtribuir(pedidoId: number, boyId: number) {
    setAssigning(true);
    try {
      const res = await fetch("/api/pdv/delivery/atribuir", {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoId, boyId }),
      });
      const data = await res.json();
      if (!res.ok) toast({ title: "Erro", description: data.message || "Não foi possível atribuir.", variant: "destructive" });
      else { toast({ title: "✅ Atribuído!", description: "Entrega adicionada ao boy." }); await fetchPedidos(); }
    } catch { toast({ title: "Erro de conexão", variant: "destructive" }); }
    setAssigning(false); setWarnDialog(null);
  }

  async function handleDesatribuir(pedidoId: number) {
    try {
      await fetch("/api/pdv/delivery/desatribuir", {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoId }),
      });
      await fetchPedidos();
      toast({ title: "Removido", description: "Atribuição cancelada." });
    } catch { }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="h-[calc(100vh-4rem)] flex flex-col gap-4">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Time Line — Delivery</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {boys.length} boy{boys.length !== 1 ? "s" : ""} disponíve{boys.length !== 1 ? "is" : "l"} · {pedidos.length} pedido{pedidos.length !== 1 ? "s" : ""} aguardando
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => { fetchBoys(); fetchPedidos(); }}>
            <RefreshCcw className="w-4 h-4 mr-1.5" /> Atualizar
          </Button>

          {/* Timeline toggle */}
          <button
            onClick={handleToggleTimeline}
            disabled={togglingTimeline}
            className={`relative flex items-center gap-2.5 px-4 py-2 rounded-xl border-2 font-semibold text-sm transition-all duration-200 ${
              timelineAtivo
                ? "bg-primary/10 border-primary text-primary hover:bg-primary/15"
                : "bg-orange-500/10 border-orange-400 text-orange-600 hover:bg-orange-500/15"
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${timelineAtivo ? "bg-primary animate-pulse" : "bg-orange-400 animate-pulse"}`} />
            <span>Timeline {timelineAtivo ? "Ativo" : "Inativo"}</span>
            <span className="text-[10px] font-normal opacity-70">
              {timelineAtivo ? "(Manual)" : "(Auto 2km)"}
            </span>
          </button>
        </div>
      </div>

      {/* ── Mode banner ──────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {!timelineAtivo && (
          <motion.div
            key="auto-banner"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 bg-orange-500/10 border border-orange-400/30 rounded-xl px-4 py-3 flex-shrink-0"
          >
            <Zap className="w-5 h-5 text-orange-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-orange-600">Auto-despacho ativo</p>
              <p className="text-xs text-muted-foreground">Pedidos prontos para delivery são atribuídos automaticamente ao boy disponível mais próximo (até 2km). Ative o Timeline para atribuição manual.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* ── Left: Pedidos list ──────────────────────────────────────── */}
        <div className="w-[360px] flex-shrink-0 flex flex-col min-h-0">
          <ScrollArea className="flex-1">
            <div className="space-y-3 pr-1">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-48 rounded-xl bg-secondary animate-pulse" />
                ))
              ) : pedidos.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Nenhum pedido delivery pendente</p>
                  <p className="text-xs mt-1 opacity-70">Os pedidos do tipo delivery aparecerão aqui</p>
                </div>
              ) : (
                pedidos.map(pedido => {
                  const assignedBoy = pedido.boy_id ? boys.find(b => b.id === pedido.boy_id) : null;

                  return (
                    <motion.div key={pedido.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                      <Card className={`p-4 transition-all ${assignedBoy ? "border-emerald-400/50 bg-emerald-500/5" : ""}`}>
                        {/* Customer info */}
                        <div className="mb-3">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <span className="font-bold text-sm text-foreground">{pedido.cliente_nome}</span>
                            </div>
                            <Badge className={`text-[10px] px-1.5 py-0.5 shrink-0 ${STATUS_LABEL[pedido.status]?.color || "bg-secondary"}`}>
                              {STATUS_LABEL[pedido.status]?.label || pedido.status}
                            </Badge>
                          </div>

                          {pedido.cliente_endereco && (
                            <p className="text-xs text-muted-foreground flex items-start gap-1 mt-1">
                              <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-muted-foreground" />
                              <span>{pedido.cliente_endereco}</span>
                            </p>
                          )}
                        </div>

                        {/* Order info */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2 border-t border-border/50 pt-2">
                          <span>Pedido <strong className="text-foreground">#{pedido.id}</strong></span>
                          <span className="font-bold text-emerald-600 text-sm">R$ {pedido.total.toFixed(2)}</span>
                        </div>

                        {/* Items */}
                        {pedido.itens?.length > 0 && (
                          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                            {pedido.itens.map((item, i) => (
                              <span key={i}>{item.qtd}x {item.nome}{i < pedido.itens.length - 1 ? ", " : ""}</span>
                            ))}
                          </p>
                        )}

                        {/* Action */}
                        {assignedBoy ? (
                          <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl px-3 py-2">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                🛵 {assignedBoy.nome.split(" ")[0]}
                              </span>
                            </div>
                            <button onClick={() => handleDesatribuir(pedido.id)} className="text-xs text-destructive hover:underline">
                              Remover
                            </button>
                          </div>
                        ) : !timelineAtivo ? (
                          <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-400/20 rounded-xl px-3 py-2">
                            <Zap className="w-3.5 h-3.5 text-orange-500" />
                            <span className="text-xs text-orange-600 font-medium">Auto-despacho quando ficar pronto</span>
                          </div>
                        ) : (
                          <BoyPicker
                            boys={boys}
                            pedido={pedido}
                            pedidos={pedidos}
                            onAtribuir={handleAtribuir}
                            assigning={assigning}
                          />
                        )}
                      </Card>
                    </motion.div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* ── Right: Map ──────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          <div className="flex-1 rounded-2xl overflow-hidden border border-border relative min-h-0">
            {!mapsReady && (
              <div className="absolute inset-0 bg-secondary flex items-center justify-center z-10">
                <div className="text-center text-muted-foreground">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm">Carregando mapa...</p>
                </div>
              </div>
            )}
            <div ref={mapRef} className="w-full h-full" />
            <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-card/90 backdrop-blur rounded-xl p-3 shadow-lg text-xs space-y-1.5">
              <div className="flex items-center gap-2"><span className="text-base">🛵</span><span className="text-green-700 font-medium">Boy disponível</span></div>
              <div className="flex items-center gap-2"><span className="text-red-500 text-base">●</span><span>Número = entregas atribuídas</span></div>
              {boys.length === 0 && <p className="text-muted-foreground pt-1 border-t">Nenhum boy online no momento</p>}
            </div>
          </div>

          {/* Boys bottom bar — clicáveis pra atribuir um pedido pelo lado do boy */}
          {boys.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 flex-shrink-0">
              {boys.map(boy => {
                const cnt = pedidos.filter(p => p.boy_id === boy.id).length;
                const full = cnt >= 3;
                return (
                  <button
                    key={boy.id}
                    onClick={() => setBoyPicker(boy)}
                    disabled={full || assigning}
                    title={full ? "Boy já com 3 entregas" : "Clique para atribuir um pedido a este boy"}
                    className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border bg-card text-sm transition-all hover:bg-emerald-500/10 hover:border-emerald-400 ${full ? "opacity-50 cursor-not-allowed border-border" : "border-emerald-300/40 cursor-pointer"}`}
                  >
                    <span className="text-base">🛵</span>
                    <div className="text-left">
                      <p className="font-medium leading-none text-foreground">{boy.nome.split(" ")[0]}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {full ? "Cheio" : `${cnt}/3 entregas · clique p/ atribuir`}
                      </p>
                    </div>
                    {cnt > 0 && (
                      <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">{cnt}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal: escolher pedido para atribuir ao boy ──────────────── */}
      {boyPicker && (() => {
        const livres = pedidos.filter(p => !p.boy_id);
        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setBoyPicker(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-card rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between p-5 border-b border-border">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🛵</span>
                  <div>
                    <h3 className="font-bold text-lg text-foreground">{boyPicker.nome}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Escolha qual pedido atribuir</p>
                  </div>
                </div>
                <button onClick={() => setBoyPicker(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto p-3 flex-1">
                {livres.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">Nenhum pedido livre</p>
                    <p className="text-xs mt-1 opacity-70">Todos os pedidos prontos já foram atribuídos.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {livres.map(pedido => (
                      <button
                        key={pedido.id}
                        disabled={assigning}
                        onClick={() => { setBoyPicker(null); handleAtribuir(pedido, boyPicker); }}
                        className="w-full text-left flex items-center gap-3 p-3 rounded-xl border border-border bg-secondary/30 hover:bg-emerald-500/10 hover:border-emerald-400 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-sm font-bold text-foreground truncate">{pedido.cliente_nome}</span>
                            <span className="text-xs font-bold text-emerald-600">R$ {Number(pedido.total).toFixed(2)}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground flex items-start gap-1">
                            <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                            <span className="truncate">{pedido.cliente_endereco || "Sem endereço"}</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">Pedido #{pedido.id} · {STATUS_LABEL[pedido.status]?.label || pedido.status}</p>
                        </div>
                        <Bike className="w-5 h-5 text-emerald-500 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        );
      })()}

      {/* ── Route warning dialog ─────────────────────────────────────── */}
      {warnDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card rounded-2xl shadow-2xl max-w-md w-full p-6"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Rota diferente — pode chegar frio! 🥶</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  Esta entrega está em uma área diferente das outras já atribuídas ao <strong>{warnDialog.boy.nome.split(" ")[0]}</strong>.
                </p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
              <p className="text-xs font-semibold text-amber-800 mb-1">Endereço do pedido #{warnDialog.pedido.id}:</p>
              <p className="text-sm text-amber-700">{warnDialog.pedido.cliente_endereco || "Endereço não informado"}</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setWarnDialog(null)}>Cancelar</Button>
              <Button
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                onClick={() => doAtribuir(warnDialog.pedido.id, warnDialog.boy.id)}
                disabled={assigning}
              >
                {assigning ? "Atribuindo..." : "Atribuir mesmo assim"}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
