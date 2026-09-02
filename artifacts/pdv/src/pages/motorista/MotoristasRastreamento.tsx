import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Car, MapPin, Clock, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";

const API = import.meta.env.BASE_URL.replace(/\/$/, "").replace("/pdv", "") + "/api";
function apiHeaders(token: string | null) { return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }; }
function fmtDate(d: string) { return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }

export default function MotoristasRastreamento() {
  const { token } = useAuth();
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapsKey, setMapsKey] = useState("");
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const { data: corridasData, refetch, isFetching } = useQuery({
    queryKey: ["corp-rastreamento"],
    queryFn: async () => {
      const r = await fetch(`${API}/pdv/corporativo/corridas?status=em_andamento`, { headers: apiHeaders(token) });
      return r.json();
    },
    refetchInterval: 15000,
  });

  const { data: aprovadas } = useQuery({
    queryKey: ["corp-rastreamento-aprovadas"],
    queryFn: async () => {
      const r = await fetch(`${API}/pdv/corporativo/corridas?status=aprovada`, { headers: apiHeaders(token) });
      return r.json();
    },
    refetchInterval: 15000,
  });

  useEffect(() => {
    fetch(`${API}/pdv/corporativo/maps-config`, { headers: apiHeaders(token) })
      .then(r => r.json()).then(d => setMapsKey(d.key));
  }, []);

  useEffect(() => {
    if (!mapsKey || !mapRef.current || mapLoaded) return;
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${mapsKey}&libraries=places`;
    script.async = true;
    script.onload = () => {
      const gm = (window as any).google.maps;
      mapInstance.current = new gm.Map(mapRef.current, {
        center: { lat: -15.7801, lng: -47.9292 },
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
      });
      setMapLoaded(true);
    };
    document.head.appendChild(script);
  }, [mapsKey]);

  const emAndamento: any[] = corridasData?.corridas ?? [];
  const aprovs: any[] = aprovadas?.corridas ?? [];
  const todas = [...emAndamento, ...aprovs];

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" /> Rastreamento
          </h1>
          <p className="text-sm text-muted-foreground">Corridas em andamento e aprovadas aguardando motorista</p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching}
          className="flex items-center gap-2 h-9 px-4 rounded-lg border border-border text-sm hover:bg-secondary transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {/* Mapa */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div ref={mapRef} className="w-full h-80" />
        {!mapsKey && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/80 rounded-xl">
            <p className="text-sm text-muted-foreground">Mapa não disponível (chave não configurada)</p>
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="space-y-3">
        <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
          Corridas ativas — {emAndamento.length} em andamento · {aprovs.length} aguardando motorista
        </h2>
        {todas.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground bg-card border border-border rounded-xl">
            <Car className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>Nenhuma corrida ativa no momento</p>
          </div>
        ) : (
          todas.map((c: any) => (
            <div key={c.id} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${c.status === "em_andamento" ? "bg-green-500/10" : "bg-blue-500/10"}`}>
                  <Car className={`w-5 h-5 ${c.status === "em_andamento" ? "text-green-500" : "text-blue-500"}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold">{c.passageiro_nome}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.status === "em_andamento" ? "bg-green-500/10 text-green-600" : "bg-blue-500/10 text-blue-600"}`}>
                      {c.status === "em_andamento" ? "🚗 Em andamento" : "⏳ Aguard. motorista"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex gap-2"><span className="text-green-500">📍</span>{c.origem}</div>
                    <div className="flex gap-2"><span className="text-red-500">🏁</span>{c.destino}</div>
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDate(c.criado_em)}</span>
                    {c.funcionario_nome && <span>{c.funcionario_nome}</span>}
                    {c.centro_custo_nome && <span>{c.centro_custo_nome}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
