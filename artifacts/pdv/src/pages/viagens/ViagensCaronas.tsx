import React, { useState, useEffect } from "react";
import {
  CarFront, Plus, MapPin, Clock, Users, Banknote, ChevronRight,
  X, Check, Trash2, Pencil, ArrowRight, AlertCircle, User, Phone,
  CreditCard, Calendar, Navigation, Bus
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { fetchCityPredictions } from "@/lib/useGooglePlaces";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");
const headers = (token: string) => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` });
const fmtBRL  = (v: number | string) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string) => { if (!d) return ""; const [y, m, dd] = d.split("-"); return `${dd}/${m}/${y}`; };

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ativa:     { label: "Ativa",     color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  lotada:    { label: "Lotada",    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  realizada: { label: "Realizada", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  cancelada: { label: "Cancelada", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

const RESERVA_STATUS: Record<string, { label: string; color: string }> = {
  confirmada: { label: "Confirmada", color: "bg-emerald-100 text-emerald-700" },
  pendente:   { label: "Pendente",   color: "bg-amber-100 text-amber-700" },
  cancelada:  { label: "Cancelada",  color: "bg-red-100 text-red-700" },
};

const PAGAMENTOS = ["pix", "dinheiro", "cartão de crédito", "cartão de débito", "transferência"];

// ── Types ────────────────────────────────────────────────────────────────────
interface Parada { cidade: string; hora_prevista: string; aceita_embarque: boolean; aceita_desembarque: boolean; }
interface Carona {
  id: number; origem: string; destino: string; distancia_km: number; data_viagem: string;
  hora_partida: string; vagas_total: number; vagas_ocupadas: number; valor_por_vaga: string;
  tipo: string; status: string; observacoes: string; veiculo_id: number | null;
  veiculo_modelo?: string; veiculo_placa?: string; veiculo_cor?: string; paradas?: Parada[];
}
interface Veiculo { id: number; modelo: string; placa: string; vagas: number; }
interface Reserva {
  id: number; passageiro_nome: string; passageiro_telefone: string; passageiro_cpf: string;
  parada_embarque: string; parada_desembarque: string; valor: string; forma_pagamento: string;
  status: string; observacoes: string;
}

// ── CityInput ────────────────────────────────────────────────────────────────
function CityInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [suggestions, setSuggestions] = useState<{ description: string; placeId: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(v: string) {
    onChange(v);
    if (timer) clearTimeout(timer);
    if (v.length < 2) { setSuggestions([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      const preds = await fetchCityPredictions(v);
      setSuggestions(preds.slice(0, 5));
      setOpen(preds.length > 0);
    }, 300);
    setTimer(t);
  }

  return (
    <div className="relative">
      <Input placeholder={placeholder} value={value} onChange={e => handleChange(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-xl shadow-xl overflow-hidden">
          {suggestions.map(s => (
            <button key={s.placeId} type="button"
              onMouseDown={() => { onChange(s.description); setSuggestions([]); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate">{s.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Form parada ───────────────────────────────────────────────────────────────
const PARADA_EMPTY: Parada = { cidade: "", hora_prevista: "", aceita_embarque: true, aceita_desembarque: true };

// ── Main Component ────────────────────────────────────────────────────────────
export default function ViagensCaronas() {
  const { token } = useAuth();
  const hdrs = headers(token!);

  const [caronas,  setCaronas]  = useState<Carona[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [view,     setView]     = useState<"lista" | "detalhe">("lista");
  const [detalhe,  setDetalhe]  = useState<(Carona & { paradas: Parada[]; reservas: Reserva[] }) | null>(null);
  const [modalCarona, setModalCarona] = useState<false | "novo" | Carona>(false);
  const [modalReserva, setModalReserva] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [erro,     setErro]     = useState("");

  // Carona form
  const [cForm, setCForm] = useState({
    origem: "", destino: "", distancia_km: "", data_viagem: "", hora_partida: "",
    vagas_total: "3", valor_por_vaga: "0", tipo: "com_paradas", observacoes: "", veiculo_id: "",
  });
  const [paradas, setParadas] = useState<Parada[]>([{ ...PARADA_EMPTY }]);

  // Reserva form
  const [rForm, setRForm] = useState({
    passageiro_nome: "", passageiro_telefone: "", passageiro_cpf: "",
    parada_embarque: "", parada_desembarque: "", valor: "", forma_pagamento: "pix", observacoes: "",
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [cr, vr] = await Promise.all([
        fetch(`${API}/api/pdv/viagens/caronas`, { headers: hdrs }).then(r => r.json()),
        fetch(`${API}/api/pdv/viagens/veiculos`, { headers: hdrs }).then(r => r.json()),
      ]);
      setCaronas(Array.isArray(cr) ? cr : []);
      setVeiculos(Array.isArray(vr) ? vr : []);
    } catch { } finally { setLoading(false); }
  }

  async function abrirDetalhe(c: Carona) {
    const r = await fetch(`${API}/api/pdv/viagens/caronas/${c.id}`, { headers: hdrs });
    const d = await r.json();
    setDetalhe(d);
    setView("detalhe");
  }

  function abrirNovaCarona() {
    setCForm({ origem: "", destino: "", distancia_km: "", data_viagem: "", hora_partida: "", vagas_total: "3", valor_por_vaga: "0", tipo: "com_paradas", observacoes: "", veiculo_id: "" });
    setParadas([{ ...PARADA_EMPTY }]);
    setErro(""); setModalCarona("novo");
  }

  function abrirEditarCarona(c: Carona) {
    setCForm({
      origem: c.origem, destino: c.destino, distancia_km: String(c.distancia_km || ""),
      data_viagem: c.data_viagem?.split("T")[0] ?? "", hora_partida: c.hora_partida ?? "",
      vagas_total: String(c.vagas_total), valor_por_vaga: String(c.valor_por_vaga),
      tipo: c.tipo, observacoes: c.observacoes || "", veiculo_id: String(c.veiculo_id || ""),
    });
    setParadas(c.paradas?.length ? c.paradas : [{ ...PARADA_EMPTY }]);
    setErro(""); setModalCarona(c);
  }

  async function salvarCarona() {
    if (!cForm.origem || !cForm.destino || !cForm.data_viagem || !cForm.hora_partida) {
      setErro("Preencha: origem, destino, data e horário"); return;
    }
    setSaving(true); setErro("");
    const pList = paradas.filter(p => p.cidade.trim());
    const body = { ...cForm, distancia_km: cForm.distancia_km ? Number(cForm.distancia_km) : undefined,
      vagas_total: Number(cForm.vagas_total), valor_por_vaga: Number(cForm.valor_por_vaga),
      veiculo_id: cForm.veiculo_id ? Number(cForm.veiculo_id) : undefined,
      paradas: pList };
    try {
      let r;
      if (modalCarona === "novo") {
        r = await fetch(`${API}/api/pdv/viagens/caronas`, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
      } else {
        r = await fetch(`${API}/api/pdv/viagens/caronas/${(modalCarona as Carona).id}`, { method: "PUT", headers: hdrs, body: JSON.stringify(body) });
      }
      if (!r.ok) { const e = await r.json(); setErro(e.error || "Erro ao salvar"); return; }
      setModalCarona(false); loadData();
    } catch { setErro("Falha de conexão"); } finally { setSaving(false); }
  }

  async function cancelarCarona(id: number) {
    await fetch(`${API}/api/pdv/viagens/caronas/${id}`, { method: "DELETE", headers: hdrs });
    loadData();
    if (detalhe?.id === id) setView("lista");
  }

  async function salvarReserva() {
    if (!rForm.passageiro_nome) { setErro("Nome do passageiro obrigatório"); return; }
    setSaving(true); setErro("");
    try {
      const r = await fetch(`${API}/api/pdv/viagens/caronas/${detalhe!.id}/reservas`, {
        method: "POST", headers: hdrs,
        body: JSON.stringify({ ...rForm, valor: rForm.valor ? Number(rForm.valor) : Number(detalhe!.valor_por_vaga) }),
      });
      if (!r.ok) { const e = await r.json(); setErro(e.error || "Erro"); return; }
      setModalReserva(false);
      setRForm({ passageiro_nome: "", passageiro_telefone: "", passageiro_cpf: "", parada_embarque: "", parada_desembarque: "", valor: "", forma_pagamento: "pix", observacoes: "" });
      const updated = await fetch(`${API}/api/pdv/viagens/caronas/${detalhe!.id}`, { headers: hdrs }).then(r => r.json());
      setDetalhe(updated);
      loadData();
    } catch { setErro("Falha de conexão"); } finally { setSaving(false); }
  }

  async function atualizarStatusReserva(rid: number, status: string) {
    await fetch(`${API}/api/pdv/viagens/caronas/${detalhe!.id}/reservas/${rid}/status`, {
      method: "PATCH", headers: hdrs, body: JSON.stringify({ status }),
    });
    const updated = await fetch(`${API}/api/pdv/viagens/caronas/${detalhe!.id}`, { headers: hdrs }).then(r => r.json());
    setDetalhe(updated);
    loadData();
  }

  const vagasLivres = detalhe ? detalhe.vagas_total - detalhe.vagas_ocupadas : 0;
  const todasParadas = detalhe ? [{ cidade: detalhe.origem }, ...(detalhe.paradas ?? []), { cidade: detalhe.destino }] : [];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {view === "detalhe" && (
            <button onClick={() => setView("lista")} className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors">
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <CarFront className="w-6 h-6 text-primary" />
              {view === "detalhe" && detalhe ? (
                <span className="flex items-center gap-2 text-xl">
                  {detalhe.origem.split(",")[0]}
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  {detalhe.destino.split(",")[0]}
                </span>
              ) : "Caronas"}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {view === "detalhe" && detalhe
                ? `${fmtDate(detalhe.data_viagem)} • ${detalhe.hora_partida}`
                : "Ofereça viagens e gerencie as reservas de assentos"}
            </p>
          </div>
        </div>
        {view === "lista" && (
          <button onClick={abrirNovaCarona}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Nova Carona
          </button>
        )}
        {view === "detalhe" && detalhe && detalhe.status === "ativa" && (
          <button onClick={() => { setRForm(f => ({ ...f, valor: String(detalhe.valor_por_vaga), parada_embarque: detalhe.origem, parada_desembarque: detalhe.destino })); setErro(""); setModalReserva(true); }}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /> Reservar Vaga
          </button>
        )}
      </div>

      {/* Lista de caronas */}
      {view === "lista" && (
        <>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-muted/40 animate-pulse" />)}
            </div>
          ) : caronas.length === 0 ? (
            <Card className="border-dashed border-2 border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <CarFront className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Nenhuma carona cadastrada</p>
                  <p className="text-sm text-muted-foreground">Crie ofertas de caronas para seus passageiros</p>
                </div>
                <button onClick={abrirNovaCarona}
                  className="bg-primary text-primary-foreground px-5 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
                  Criar primeira carona
                </button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {caronas.map((c, i) => {
                const livres = c.vagas_total - c.vagas_ocupadas;
                const st = STATUS_LABELS[c.status] ?? STATUS_LABELS.ativa;
                return (
                  <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                    <Card className="hover:shadow-md transition-shadow border-border/50 cursor-pointer group" onClick={() => abrirDetalhe(c)}>
                      <CardContent className="p-5">
                        <div className="flex items-center gap-4">
                          {/* Rota */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                              {c.tipo === "direto" && <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full font-semibold">Direto</span>}
                            </div>
                            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                              <span className="truncate max-w-[140px]">{c.origem.split(",")[0]}</span>
                              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <span className="truncate max-w-[140px]">{c.destino.split(",")[0]}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(c.data_viagem)}</span>
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{c.hora_partida}</span>
                              {c.distancia_km && <span className="flex items-center gap-1"><Navigation className="w-3 h-3" />{c.distancia_km} km</span>}
                            </div>
                          </div>

                          {/* Stats */}
                          <div className="flex gap-4 text-center shrink-0">
                            <div>
                              <p className="text-lg font-black text-primary">{fmtBRL(c.valor_por_vaga)}</p>
                              <p className="text-xs text-muted-foreground">por vaga</p>
                            </div>
                            <div>
                              <p className={`text-lg font-black ${livres === 0 ? "text-destructive" : "text-emerald-600"}`}>{livres}</p>
                              <p className="text-xs text-muted-foreground">vagas livres</p>
                            </div>
                            {c.veiculo_modelo && (
                              <div className="hidden sm:block">
                                <p className="text-sm font-semibold text-foreground truncate max-w-[100px]">{c.veiculo_modelo}</p>
                                <p className="text-xs text-muted-foreground">{c.veiculo_placa}</p>
                              </div>
                            )}
                          </div>

                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Detalhe da carona */}
      {view === "detalhe" && detalhe && (
        <div className="space-y-5">
          {/* Info cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: <Users className="w-4 h-4" />, label: "Vagas livres", value: `${vagasLivres} / ${detalhe.vagas_total}`, color: vagasLivres === 0 ? "text-destructive" : "text-emerald-600" },
              { icon: <Banknote className="w-4 h-4" />, label: "Valor por vaga", value: fmtBRL(detalhe.valor_por_vaga), color: "text-primary" },
              { icon: <Navigation className="w-4 h-4" />, label: "Distância", value: detalhe.distancia_km ? `${detalhe.distancia_km} km` : "—", color: "text-foreground" },
              { icon: <CarFront className="w-4 h-4" />, label: "Veículo", value: detalhe.veiculo_modelo ?? "Não informado", color: "text-foreground" },
            ].map(s => (
              <Card key={s.label} className="border-border/50">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">{s.icon}</div>
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className={`font-bold text-sm ${s.color}`}>{s.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Rota com paradas */}
          <Card className="border-border/50">
            <CardContent className="p-5">
              <p className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" /> Rota da viagem
              </p>
              <div className="space-y-0">
                {todasParadas.map((p, i) => {
                  const isFirst = i === 0;
                  const isLast  = i === todasParadas.length - 1;
                  const parada  = detalhe.paradas?.[i - 1];
                  return (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full shrink-0 mt-1 ${isFirst || isLast ? "bg-primary" : "bg-muted-foreground/40"}`} />
                        {!isLast && <div className="w-0.5 bg-border flex-1 my-0.5 min-h-[20px]" />}
                      </div>
                      <div className="pb-3">
                        <p className={`text-sm font-semibold ${isFirst || isLast ? "text-foreground" : "text-muted-foreground"}`}>
                          {p.cidade}
                        </p>
                        {parada?.hora_prevista && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" /> {parada.hora_prevista}
                            {parada.aceita_embarque && <span className="ml-1 bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-xs">↑ Embarque</span>}
                            {parada.aceita_desembarque && <span className="ml-1 bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs">↓ Desembarque</span>}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Reservas */}
          <Card className="border-border/50">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" /> Reservas ({detalhe.reservas?.length ?? 0})
                </p>
              </div>
              {!detalhe.reservas?.length ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground text-sm">Nenhuma reserva ainda</p>
                  {detalhe.status === "ativa" && vagasLivres > 0 && (
                    <button onClick={() => { setRForm(f => ({ ...f, valor: String(detalhe.valor_por_vaga), parada_embarque: detalhe.origem, parada_desembarque: detalhe.destino })); setErro(""); setModalReserva(true); }}
                      className="mt-3 text-sm text-primary hover:underline">
                      + Adicionar reserva
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {detalhe.reservas.map(r => {
                    const st = RESERVA_STATUS[r.status] ?? RESERVA_STATUS.confirmada;
                    return (
                      <div key={r.id} className="flex items-center gap-4 p-3 rounded-xl bg-muted/30 border border-border/40">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm text-foreground">{r.passageiro_nome}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${st.color}`}>{st.label}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                            {r.passageiro_telefone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{r.passageiro_telefone}</span>}
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{r.parada_embarque?.split(",")[0]} → {r.parada_desembarque?.split(",")[0]}</span>
                            <span className="flex items-center gap-1"><Banknote className="w-3 h-3" />{fmtBRL(r.valor)} ({r.forma_pagamento})</span>
                          </div>
                        </div>
                        {r.status !== "cancelada" && (
                          <button onClick={() => atualizarStatusReserva(r.id, "cancelada")}
                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors" title="Cancelar reserva">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ações */}
          {detalhe.status === "ativa" && (
            <div className="flex gap-3">
              <button onClick={() => abrirEditarCarona(detalhe)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">
                <Pencil className="w-4 h-4" /> Editar carona
              </button>
              <button onClick={() => cancelarCarona(detalhe.id)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-destructive/40 text-sm text-destructive hover:bg-destructive/10 transition-colors">
                <Trash2 className="w-4 h-4" /> Cancelar carona
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Modal Nova/Editar Carona ─────────────────────────────────────────── */}
      <AnimatePresence>
        {modalCarona !== false && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-border">
                <h2 className="text-lg font-bold text-foreground">{modalCarona === "novo" ? "Nova Carona" : "Editar Carona"}</h2>
                <button onClick={() => setModalCarona(false)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-5">

                {/* Origem / Destino */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-primary" /> Partindo de *</label>
                    <CityInput value={cForm.origem} onChange={v => setCForm(f => ({ ...f, origem: v }))} placeholder="Cidade de origem" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-destructive" /> Indo para *</label>
                    <CityInput value={cForm.destino} onChange={v => setCForm(f => ({ ...f, destino: v }))} placeholder="Cidade de destino" />
                  </div>
                </div>

                {/* Data / Hora / Distância */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-primary" /> Data *</label>
                    <Input type="date" value={cForm.data_viagem} onChange={e => setCForm(f => ({ ...f, data_viagem: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-primary" /> Partida *</label>
                    <Input type="time" value={cForm.hora_partida} onChange={e => setCForm(f => ({ ...f, hora_partida: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5"><Navigation className="w-3.5 h-3.5 text-primary" /> Distância (km)</label>
                    <Input type="number" placeholder="Ex: 780" value={cForm.distancia_km} onChange={e => setCForm(f => ({ ...f, distancia_km: e.target.value }))} />
                  </div>
                </div>

                {/* Veículo / Vagas / Valor */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5 col-span-1">
                    <label className="text-sm font-medium flex items-center gap-1.5"><Bus className="w-3.5 h-3.5 text-primary" /> Veículo</label>
                    <select value={cForm.veiculo_id} onChange={e => {
                      const v = veiculos.find(v => String(v.id) === e.target.value);
                      setCForm(f => ({ ...f, veiculo_id: e.target.value, vagas_total: v ? String(v.vagas - 1) : f.vagas_total }));
                    }}
                      className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                      <option value="">Sem veículo</option>
                      {veiculos.map(v => <option key={v.id} value={v.id}>{v.modelo} {v.placa ? `(${v.placa})` : ""}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-primary" /> Vagas</label>
                    <Input type="number" min="1" value={cForm.vagas_total} onChange={e => setCForm(f => ({ ...f, vagas_total: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5"><Banknote className="w-3.5 h-3.5 text-primary" /> Valor/vaga (R$)</label>
                    <Input type="number" min="0" step="0.50" value={cForm.valor_por_vaga} onChange={e => setCForm(f => ({ ...f, valor_por_vaga: e.target.value }))} />
                  </div>
                </div>

                {/* Tipo */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipo de viagem</label>
                  <div className="flex gap-2">
                    {[{ k: "direto", l: "Direto (sem paradas)" }, { k: "com_paradas", l: "Com paradas" }].map(t => (
                      <button key={t.k} type="button" onClick={() => setCForm(f => ({ ...f, tipo: t.k }))}
                        className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${cForm.tipo === t.k ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}>
                        {t.l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Paradas */}
                {cForm.tipo === "com_paradas" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Paradas intermediárias</label>
                      <button type="button" onClick={() => setParadas(p => [...p, { ...PARADA_EMPTY }])}
                        className="text-xs text-primary hover:underline flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Adicionar parada
                      </button>
                    </div>
                    <div className="space-y-2">
                      {paradas.map((p, i) => (
                        <div key={i} className="bg-muted/30 rounded-xl p-3 space-y-2">
                          <div className="flex gap-2 items-start">
                            <div className="flex-1 space-y-1.5">
                              <CityInput value={p.cidade} onChange={v => setParadas(ps => ps.map((pp, ii) => ii === i ? { ...pp, cidade: v } : pp))} placeholder={`Parada ${i + 1}`} />
                            </div>
                            <Input type="time" value={p.hora_prevista}
                              onChange={e => setParadas(ps => ps.map((pp, ii) => ii === i ? { ...pp, hora_prevista: e.target.value } : pp))}
                              className="w-28" />
                            <button type="button" onClick={() => setParadas(ps => ps.filter((_, ii) => ii !== i))}
                              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg mt-0.5 transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex gap-3">
                            {[{ k: "aceita_embarque" as keyof Parada, l: "↑ Embarque" }, { k: "aceita_desembarque" as keyof Parada, l: "↓ Desembarque" }].map(o => (
                              <label key={o.k} className="flex items-center gap-1.5 text-xs cursor-pointer">
                                <input type="checkbox" checked={!!p[o.k]}
                                  onChange={e => setParadas(ps => ps.map((pp, ii) => ii === i ? { ...pp, [o.k]: e.target.checked } : pp))}
                                  className="rounded" />
                                {o.l}
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Observações */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Observações</label>
                  <textarea rows={2} placeholder="Informações adicionais sobre a viagem..."
                    value={cForm.observacoes} onChange={e => setCForm(f => ({ ...f, observacoes: e.target.value }))}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>

                {erro && (
                  <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {erro}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button onClick={() => setModalCarona(false)}
                    className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">
                    Cancelar
                  </button>
                  <button onClick={salvarCarona} disabled={saving}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                    {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                    {saving ? "Salvando…" : "Publicar Carona"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal Reserva ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modalReserva && detalhe && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-background rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-border">
                <h2 className="text-lg font-bold text-foreground">Reservar Vaga</h2>
                <button onClick={() => setModalReserva(false)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-sm">
                  <p className="font-semibold text-foreground">{detalhe.origem.split(",")[0]} → {detalhe.destino.split(",")[0]}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">{fmtDate(detalhe.data_viagem)} às {detalhe.hora_partida} • {vagasLivres} vaga(s) disponível(is)</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-primary" /> Nome do passageiro *</label>
                  <Input placeholder="Nome completo" value={rForm.passageiro_nome} onChange={e => setRForm(f => ({ ...f, passageiro_nome: e.target.value }))} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-primary" /> Telefone</label>
                    <Input placeholder="(11) 99999-9999" value={rForm.passageiro_telefone} onChange={e => setRForm(f => ({ ...f, passageiro_telefone: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5 text-primary" /> CPF</label>
                    <Input placeholder="000.000.000-00" value={rForm.passageiro_cpf} onChange={e => setRForm(f => ({ ...f, passageiro_cpf: e.target.value }))} />
                  </div>
                </div>

                {/* Embarque / Desembarque */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Embarque em</label>
                    <select value={rForm.parada_embarque} onChange={e => setRForm(f => ({ ...f, parada_embarque: e.target.value }))}
                      className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                      {todasParadas.filter((_, i) => i < todasParadas.length - 1).map((p, i) => (
                        <option key={i} value={p.cidade}>{p.cidade.split(",")[0]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Desembarque em</label>
                    <select value={rForm.parada_desembarque} onChange={e => setRForm(f => ({ ...f, parada_desembarque: e.target.value }))}
                      className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                      {todasParadas.filter((_, i) => i > 0).map((p, i) => (
                        <option key={i} value={p.cidade}>{p.cidade.split(",")[0]}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5"><Banknote className="w-3.5 h-3.5 text-primary" /> Valor cobrado (R$)</label>
                    <Input type="number" min="0" step="0.50" value={rForm.valor} onChange={e => setRForm(f => ({ ...f, valor: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Forma de pagamento</label>
                    <select value={rForm.forma_pagamento} onChange={e => setRForm(f => ({ ...f, forma_pagamento: e.target.value }))}
                      className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                      {PAGAMENTOS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Observações</label>
                  <textarea rows={2} placeholder="Bagagens, necessidades especiais..."
                    value={rForm.observacoes} onChange={e => setRForm(f => ({ ...f, observacoes: e.target.value }))}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>

                {erro && (
                  <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {erro}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button onClick={() => setModalReserva(false)}
                    className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">
                    Cancelar
                  </button>
                  <button onClick={salvarReserva} disabled={saving}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                    {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                    {saving ? "Salvando…" : "Confirmar Reserva"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
