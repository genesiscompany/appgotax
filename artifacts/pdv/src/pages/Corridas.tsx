import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Car, Clock, CheckCircle2, XCircle, Navigation, User,
  Phone, Star, DollarSign, RefreshCw, X, Loader2,
  TrendingUp, MapPin, AlertCircle, ChevronDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";

type Status = "aguardando" | "aceita" | "a_caminho" | "em_andamento" | "concluida" | "cancelada";

interface Corrida {
  id: number;
  empresa_id: number;
  passageiro_nome: string;
  passageiro_telefone?: string;
  origem_endereco: string;
  destino_endereco: string;
  tipo_veiculo: string;
  forma_pagamento: string;
  status: Status;
  valor: number;
  distancia_km?: number;
  motorista_nome?: string;
  motorista_nome_real?: string;
  motorista_telefone?: string;
  motorista_veiculo?: string;
  motorista_placa?: string;
  avaliacao?: number;
  tempo_espera_min?: number;
  criado_em: string;
  concluido_em?: string;
}

interface Stats {
  aguardando: string;
  aceitas: string;
  em_andamento: string;
  concluidas_hoje: string;
  canceladas_hoje: string;
  receita_hoje: string;
  avaliacao_media: string;
  total_concluidas: string;
}

interface Motorista { id: number; nome: string; veiculo?: string; placa?: string; telefone?: string; }

const STATUS_LABELS: Record<Status, string> = {
  aguardando: "Aguardando",
  aceita: "Aceita",
  a_caminho: "A Caminho",
  em_andamento: "Em Andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const STATUS_COLORS: Record<Status, string> = {
  aguardando: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  aceita: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  a_caminho: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  em_andamento: "bg-primary/15 text-primary",
  concluida: "bg-green-500/15 text-green-700 dark:text-green-400",
  cancelada: "bg-red-500/15 text-red-700 dark:text-red-400",
};

const TIPO_LABELS: Record<string, string> = {
  economico: "Econômico", conforto: "Conforto", premium: "Premium"
};

const NEXT_STATUS: Record<Status, Status | null> = {
  aguardando: "aceita",
  aceita: "a_caminho",
  a_caminho: "em_andamento",
  em_andamento: "concluida",
  concluida: null,
  cancelada: null,
};

const NEXT_LABEL: Record<Status, string> = {
  aguardando: "Aceitar",
  aceita: "A Caminho",
  a_caminho: "Em Andamento",
  em_andamento: "Concluir",
  concluida: "",
  cancelada: "",
};

const FILTER_TABS = [
  { key: "ativas", label: "Ativas" },
  { key: "aguardando", label: "Aguardando" },
  { key: "concluida", label: "Concluídas" },
  { key: "cancelada", label: "Canceladas" },
];

export default function Corridas() {
  const { token, empresa } = useAuth();
  const empresaId = empresa?.id;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [corridas, setCorridas] = useState<Corrida[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ativas");
  const [assignMap, setAssignMap] = useState<Record<number, string>>({});
  const [actionMap, setActionMap] = useState<Record<number, boolean>>({});
  const sseRef = useRef<EventSource | null>(null);

  const load = async () => {
    const [corridasRes, statsRes, motoristasRes] = await Promise.all([
      fetch(`/api/motorista/corridas?empresa_id=${empresaId}`, { headers }),
      fetch(`/api/motorista/stats?empresa_id=${empresaId}`, { headers }),
      fetch(`/api/motorista/motoristas-disponiveis?empresa_id=${empresaId}`, { headers }),
    ]);
    const [c, s, m] = await Promise.all([corridasRes.json(), statsRes.json(), motoristasRes.json()]);
    setCorridas(Array.isArray(c) ? c : []);
    setStats(s || null);
    setMotoristas(Array.isArray(m) ? m : []);
    setLoading(false);
  };

  useEffect(() => {
    if (!empresaId) return;
    load();
    const es = new EventSource(`/api/motorista/stream?empresa_id=${empresaId}`);
    sseRef.current = es;
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.corrida) {
          setCorridas(prev => {
            const idx = prev.findIndex(c => c.id === data.corrida.id);
            if (idx >= 0) { const next = [...prev]; next[idx] = data.corrida; return next; }
            return [data.corrida, ...prev];
          });
          load();
        }
      } catch (_) {}
    };
    return () => es.close();
  }, [empresaId]);

  const filteredCorridas = corridas.filter(c => {
    if (filter === "ativas") return !["concluida", "cancelada"].includes(c.status);
    return c.status === filter;
  });

  const handleStatusChange = async (corrida: Corrida, nextStatus: Status) => {
    setActionMap(m => ({ ...m, [corrida.id]: true }));
    const motorId = assignMap[corrida.id];
    const motor = motoristas.find(m => String(m.id) === motorId);
    await fetch(`/api/motorista/corridas/${corrida.id}/status`, {
      method: "PATCH", headers,
      body: JSON.stringify({
        status: nextStatus,
        motorista_id: motor?.id,
        motorista_nome: motor?.nome,
      }),
    });
    setActionMap(m => ({ ...m, [corrida.id]: false }));
    load();
  };

  const handleCancel = async (id: number) => {
    if (!confirm("Cancelar esta corrida?")) return;
    await fetch(`/api/motorista/corridas/${id}/status`, {
      method: "PATCH", headers, body: JSON.stringify({ status: "cancelada" }),
    });
    load();
  };

  const statCard = (label: string, value: string | number, icon: React.ReactNode, color: string) => (
    <Card className="shadow-sm border-border/50">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground leading-none mb-1">{label}</p>
          <p className="text-xl font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Car className="w-7 h-7 text-primary" /> Central de Corridas
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie todas as corridas em tempo real.</p>
        </div>
        <Button variant="outline" onClick={load} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCard("Aguardando", stats.aguardando, <Clock className="w-5 h-5 text-yellow-600" />, "bg-yellow-500/10")}
          {statCard("Em Andamento", stats.em_andamento, <Navigation className="w-5 h-5 text-primary" />, "bg-primary/10")}
          {statCard("Concluídas Hoje", stats.concluidas_hoje, <CheckCircle2 className="w-5 h-5 text-green-600" />, "bg-green-500/10")}
          {statCard("Receita Hoje", `R$ ${Number(stats.receita_hoje).toFixed(2)}`, <DollarSign className="w-5 h-5 text-emerald-600" />, "bg-emerald-500/10")}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-border pb-1">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
              filter === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.key === "aguardando" && Number(stats?.aguardando) > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-yellow-500 text-white rounded-full">
                {stats?.aguardando}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Corridas list */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
        </div>
      ) : filteredCorridas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Car className="w-8 h-8 text-primary/60" />
          </div>
          <p className="font-semibold text-foreground">Nenhuma corrida {filter === "ativas" ? "ativa" : ""}</p>
          <p className="text-sm text-muted-foreground">As corridas aparecerão aqui em tempo real.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filteredCorridas.map(corrida => {
              const nextStatus = NEXT_STATUS[corrida.status];
              const isActive = actionMap[corrida.id];
              const motorNome = corrida.motorista_nome_real || corrida.motorista_nome;

              return (
                <motion.div
                  key={corrida.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                >
                  <Card className="shadow-sm border-border/50 overflow-hidden">
                    <div className={`h-1 ${corrida.status === "aguardando" ? "bg-yellow-400" : corrida.status === "concluida" ? "bg-green-500" : corrida.status === "cancelada" ? "bg-red-500" : "bg-primary"}`} />
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${corrida.tipo_veiculo === "premium" ? "bg-amber-500/15" : corrida.tipo_veiculo === "conforto" ? "bg-blue-500/15" : "bg-secondary"}`}>
                            <Car className={`w-5 h-5 ${corrida.tipo_veiculo === "premium" ? "text-amber-600" : corrida.tipo_veiculo === "conforto" ? "text-blue-600" : "text-muted-foreground"}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-semibold text-foreground">{corrida.passageiro_nome}</span>
                              <Badge className={`text-[10px] border-0 ${STATUS_COLORS[corrida.status]}`}>
                                {STATUS_LABELS[corrida.status]}
                              </Badge>
                              <span className="text-xs text-muted-foreground">#{corrida.id}</span>
                            </div>
                            <div className="space-y-1 text-xs text-muted-foreground">
                              <div className="flex items-start gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-green-500 mt-0.5 shrink-0" />
                                <span className="truncate">{corrida.origem_endereco}</span>
                              </div>
                              <div className="flex items-start gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-primary mt-0.5 shrink-0" />
                                <span className="truncate">{corrida.destino_endereco}</span>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-3 mt-2 text-xs">
                              <span className="text-muted-foreground">{TIPO_LABELS[corrida.tipo_veiculo] || corrida.tipo_veiculo}</span>
                              <span className="font-semibold text-foreground">R$ {Number(corrida.valor).toFixed(2)}</span>
                              {corrida.distancia_km && <span className="text-muted-foreground">{Number(corrida.distancia_km).toFixed(1)} km</span>}
                              <span className="text-muted-foreground">{corrida.forma_pagamento}</span>
                              {corrida.avaliacao && (
                                <span className="flex items-center gap-1 text-amber-500">
                                  <Star className="w-3 h-3 fill-current" />{corrida.avaliacao}
                                </span>
                              )}
                            </div>
                            {motorNome && (
                              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                                <User className="w-3 h-3" />
                                <span>{motorNome}</span>
                                {corrida.motorista_veiculo && <span>· {corrida.motorista_veiculo}</span>}
                                {corrida.motorista_placa && <span className="font-mono">· {corrida.motorista_placa}</span>}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2 items-end shrink-0">
                          {!motorNome && corrida.status === "aguardando" && motoristas.length > 0 && (
                            <div className="relative">
                              <select
                                className="text-xs border border-border rounded-lg px-2 py-1.5 bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none pr-6"
                                value={assignMap[corrida.id] || ""}
                                onChange={e => setAssignMap(m => ({ ...m, [corrida.id]: e.target.value }))}
                              >
                                <option value="">Selecionar motorista</option>
                                {motoristas.map(m => (
                                  <option key={m.id} value={String(m.id)}>{m.nome}</option>
                                ))}
                              </select>
                              <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            </div>
                          )}

                          {nextStatus && (
                            <Button
                              size="sm"
                              onClick={() => handleStatusChange(corrida, nextStatus)}
                              disabled={isActive}
                              className="text-xs bg-primary hover:bg-primary/90 h-8"
                            >
                              {isActive ? <Loader2 className="w-3 h-3 animate-spin" /> : NEXT_LABEL[corrida.status]}
                            </Button>
                          )}

                          {["aguardando", "aceita", "a_caminho"].includes(corrida.status) && (
                            <button
                              onClick={() => handleCancel(corrida.id)}
                              className="text-xs text-destructive hover:text-destructive/80 transition-colors"
                            >
                              Cancelar
                            </button>
                          )}

                          <span className="text-[10px] text-muted-foreground">
                            {new Date(corrida.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
