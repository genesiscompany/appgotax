import React, { useEffect, useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Search, MapPin, Clock, Users, DollarSign, User, CreditCard, Phone, CheckCircle2, Bus, Plane, Truck, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { loadGoogleMaps, fetchCityPredictions, type PlacePrediction } from "@/lib/useGooglePlaces";

const API = "/api/pdv/viagens";
const fmt = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtHora = (h: string) => h ? h.slice(0, 5) : "—";
const TIPO_ICON: Record<string, React.ElementType> = { onibus: Bus, voo: Plane, van: Truck };
const TIPO_COR: Record<string, string> = { onibus: "#3B82F6", voo: "#8B5CF6", van: "#F97316" };

type Rota = { id: number; origem: string; destino: string; duracao_minutos: number | null; tipo: string };
type Horario = { id: number; rota_id: number; data_partida: string; hora_partida: string; hora_chegada: string | null; vagas_total: number; vagas_ocupadas: number; vagas_livres: number; preco: number; veiculo: string | null; origem: string; destino: string };
type Cliente = { id: number; nome: string; cpf: string | null; telefone: string | null; email: string | null };

const STEPS = ["Rota", "Horário", "Passageiro", "Pagamento", "Confirmado"];
const PAGAMENTOS = [
  { id: "pix", label: "PIX" },
  { id: "dinheiro", label: "Dinheiro" },
  { id: "credito", label: "Crédito" },
  { id: "debito", label: "Débito" },
];

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {STEPS.map((s, i) => (
        <React.Fragment key={s}>
          <div className={cn("flex items-center gap-2", i <= step ? "text-primary" : "text-muted-foreground")}>
            <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
              i < step ? "bg-primary border-primary text-primary-foreground" :
              i === step ? "border-primary text-primary bg-primary/10" :
              "border-border text-muted-foreground"
            )}>
              {i < step ? "✓" : i + 1}
            </div>
            <span className={cn("text-xs font-medium hidden sm:block", i === step ? "text-primary" : "")}>{s}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={cn("flex-1 h-0.5 rounded", i < step ? "bg-primary" : "bg-border")} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Inline city autocomplete ─────────────────────────────────────────────────
function CityAutocomplete({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [inputVal, setInputVal] = useState(value);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadGoogleMaps().then(() => setMapsReady(true)); }, []);
  useEffect(() => { setInputVal(value); }, [value]);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleInput = (val: string) => {
    setInputVal(val);
    onChange(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!mapsReady || val.length < 2) { setOpen(false); setPredictions([]); return; }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      const res = await fetchCityPredictions(val);
      setPredictions(res);
      setOpen(res.length > 0);
      setLoading(false);
    }, 300);
  };

  const handleSelect = (pred: PlacePrediction) => {
    const city = pred.mainText;
    setInputVal(city);
    onChange(city);
    setPredictions([]);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />}
        {!loading && inputVal && (
          <button type="button" onClick={() => { setInputVal(""); onChange(""); setPredictions([]); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <input type="text" autoComplete="off" value={inputVal} onChange={e => handleInput(e.target.value)}
          onFocus={() => predictions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
      </div>
      {open && predictions.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-[9999] bg-popover border border-border rounded-xl shadow-xl overflow-hidden">
          {predictions.map(pred => (
            <button key={pred.placeId} type="button"
              onMouseDown={e => { e.preventDefault(); handleSelect(pred); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-accent transition-colors">
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{pred.mainText}</p>
                <p className="text-xs text-muted-foreground truncate">{pred.secondaryText}</p>
              </div>
            </button>
          ))}
          <div className="px-3 py-1 border-t border-border/40 flex justify-end">
            <span className="text-[10px] text-muted-foreground">powered by Google</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ViagensNovaVenda() {
  const { token, user } = useAuth();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);

  // Step 0 — Rota
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [origemSearch, setOrigemSearch] = useState("");
  const [destinoSearch, setDestinoSearch] = useState("");
  const [rotaSel, setRotaSel] = useState<Rota | null>(null);

  // Step 1 — Horário
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split("T")[0]);
  const [horarioSel, setHorarioSel] = useState<Horario | null>(null);
  const [assento, setAssento] = useState("");

  // Step 2 — Passageiro
  const [clienteSearch, setClienteSearch] = useState("");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSel, setClienteSel] = useState<Cliente | null>(null);
  const [novoCliente, setNovoCliente] = useState({ nome: "", cpf: "", telefone: "" });
  const [modoNovo, setModoNovo] = useState(false);

  // Step 3 — Pagamento
  const [pagamento, setPagamento] = useState("pix");
  const [observacoes, setObservacoes] = useState("");

  // Step 4 — Resultado
  const [passagemId, setPassagemId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carrega rotas
  useEffect(() => {
    fetch(`${API}/rotas`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setRotas(Array.isArray(d) ? d : []));
  }, [token]);

  // Carrega horários quando seleciona rota ou muda data
  useEffect(() => {
    if (!rotaSel) return;
    const params = new URLSearchParams({ rota_id: String(rotaSel.id), data: dataFiltro });
    fetch(`${API}/horarios?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setHorarios(Array.isArray(d) ? d : []));
  }, [rotaSel, dataFiltro, token]);

  // Busca clientes
  const buscarClientes = useCallback(() => {
    if (clienteSearch.length < 2) { setClientes([]); return; }
    fetch(`${API}/clientes?q=${encodeURIComponent(clienteSearch)}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setClientes(Array.isArray(d) ? d : []));
  }, [clienteSearch, token]);

  useEffect(() => { const t = setTimeout(buscarClientes, 350); return () => clearTimeout(t); }, [buscarClientes]);

  const rotasFiltradas = rotas.filter(r => {
    const orig = origemSearch.trim().toLowerCase();
    const dest = destinoSearch.trim().toLowerCase();
    const matchOrigem = !orig || r.origem.toLowerCase().includes(orig);
    const matchDestino = !dest || r.destino.toLowerCase().includes(dest);
    return matchOrigem && matchDestino;
  });

  const handleSubmit = async () => {
    setSubmitting(true); setError(null);
    try {
      let clienteId = clienteSel?.id ?? null;
      if (modoNovo && novoCliente.nome) {
        const res = await fetch(`${API}/clientes`, {
          method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ nome: novoCliente.nome, cpf: novoCliente.cpf || null, telefone: novoCliente.telefone || null }),
        });
        const c = await res.json();
        clienteId = c.id;
      }
      const res = await fetch(`${API}/passagens`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: clienteId,
          horario_id: horarioSel?.id,
          assento: assento || null,
          valor: horarioSel?.preco,
          forma_pagamento: pagamento,
          status: "confirmado",
          observacoes: observacoes || null,
          operador_nome: user?.nome,
        }),
      });
      if (!res.ok) throw new Error("Erro ao registrar venda");
      const data = await res.json();
      setPassagemId(data.id);
      setStep(4);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── STEPS ──────────────────────────────────────────────────────────────────

  const stepRotas = (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-foreground mb-1">Selecionar Rota</h2>
        <p className="text-sm text-muted-foreground">Busque a cidade de origem e destino</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Partindo de</label>
          <CityAutocomplete value={origemSearch} onChange={setOrigemSearch} placeholder="Ex: São Paulo" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Indo para</label>
          <CityAutocomplete value={destinoSearch} onChange={setDestinoSearch} placeholder="Ex: Rio de Janeiro" />
        </div>
      </div>
      {!rotasFiltradas.length ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma rota encontrada</div>
      ) : (
        <div className="space-y-2">
          {rotasFiltradas.map(r => {
            const Icon = TIPO_ICON[r.tipo] ?? Bus;
            const cor = TIPO_COR[r.tipo] ?? "#3B82F6";
            return (
              <button key={r.id} onClick={() => { setRotaSel(r); setHorarioSel(null); }}
                className={cn("w-full flex items-center gap-4 p-4 bg-card border rounded-2xl text-left transition-all hover:border-primary/50",
                  rotaSel?.id === r.id ? "border-primary bg-primary/5" : "border-border")}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: cor + "20" }}>
                  <Icon className="w-5 h-5" style={{ color: cor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <span>{r.origem}</span>
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                    <span>{r.destino}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize flex items-center gap-1.5">
                    <span>{r.tipo}</span>
                    {r.duracao_minutos && <><Clock className="w-3 h-3" />{Math.floor(r.duracao_minutos/60)}h{r.duracao_minutos%60>0?`${r.duracao_minutos%60}min`:""}</>}
                  </p>
                </div>
                {rotaSel?.id === r.id && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const stepHorarios = (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-foreground mb-1">Selecionar Horário</h2>
        <p className="text-sm text-muted-foreground">{rotaSel?.origem} → {rotaSel?.destino}</p>
      </div>
      <div>
        <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Data da viagem</label>
        <input type="date" value={dataFiltro} min={new Date().toISOString().split("T")[0]}
          onChange={e => setDataFiltro(e.target.value)}
          className="bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
      </div>
      {!horarios.length ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Nenhum horário disponível nesta data</div>
      ) : (
        <div className="space-y-2">
          {horarios.map(h => {
            const lotado = h.vagas_livres === 0;
            return (
              <button key={h.id} disabled={lotado} onClick={() => setHorarioSel(h)}
                className={cn("w-full flex items-center gap-4 p-4 bg-card border rounded-2xl text-left transition-all",
                  lotado ? "opacity-50 cursor-not-allowed border-border" :
                  horarioSel?.id === h.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50")}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-foreground text-lg">{fmtHora(h.hora_partida)}</span>
                    {h.hora_chegada && <><span className="text-muted-foreground">→</span><span className="text-muted-foreground">{fmtHora(h.hora_chegada)}</span></>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" />{h.vagas_livres} vagas livres</span>
                    {h.veiculo && <span>{h.veiculo}</span>}
                    {lotado && <span className="text-red-400 font-semibold">Lotado</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-primary text-lg">{fmt(h.preco)}</p>
                  <p className="text-xs text-muted-foreground">por pessoa</p>
                </div>
                {horarioSel?.id === h.id && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
      {horarioSel && (
        <div>
          <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Número do assento (opcional)</label>
          <input type="text" placeholder="Ex: 12A" value={assento} onChange={e => setAssento(e.target.value)}
            className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
      )}
    </div>
  );

  const stepPassageiro = (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-foreground mb-1">Passageiro</h2>
        <p className="text-sm text-muted-foreground">Busque um cliente cadastrado ou preencha os dados</p>
      </div>
      {!modoNovo && (
        <>
          <div className="flex items-center gap-2 bg-secondary border border-border rounded-xl px-3 py-2.5">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input type="text" placeholder="Buscar por nome, CPF ou telefone..." value={clienteSearch} onChange={e => { setClienteSearch(e.target.value); setClienteSel(null); }}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
          </div>
          {clientes.length > 0 && !clienteSel && (
            <div className="space-y-1.5">
              {clientes.map(c => (
                <button key={c.id} onClick={() => { setClienteSel(c); setClienteSearch(c.nome); }}
                  className="w-full flex items-center gap-3 p-3 bg-card border border-border rounded-xl text-left hover:border-primary/50 transition-all">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-primary font-bold text-xs">{c.nome.charAt(0)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">{c.cpf ?? c.telefone ?? ""}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {clienteSel && (
            <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/30 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="font-semibold text-foreground">{clienteSel.nome}</p>
                <p className="text-xs text-muted-foreground">{clienteSel.cpf ?? clienteSel.telefone ?? ""}</p>
              </div>
              <button onClick={() => { setClienteSel(null); setClienteSearch(""); }} className="ml-auto text-muted-foreground hover:text-foreground text-lg leading-none">✕</button>
            </div>
          )}
          <button onClick={() => setModoNovo(true)} className="text-sm text-primary hover:underline">
            + Cadastrar novo passageiro
          </button>
        </>
      )}
      {modoNovo && (
        <div className="space-y-3 p-4 bg-secondary/30 border border-border/60 rounded-xl">
          <p className="text-sm font-semibold text-foreground">Novo passageiro</p>
          {[
            { label: "Nome completo *", key: "nome", placeholder: "Nome do passageiro" },
            { label: "CPF", key: "cpf", placeholder: "000.000.000-00" },
            { label: "Telefone", key: "telefone", placeholder: "(00) 00000-0000" },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs text-muted-foreground font-medium mb-1 block">{f.label}</label>
              <input type="text" placeholder={f.placeholder} value={(novoCliente as any)[f.key]}
                onChange={e => setNovoCliente(n => ({ ...n, [f.key]: e.target.value }))}
                className="w-full bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
          ))}
          <button onClick={() => { setModoNovo(false); setNovoCliente({ nome: "", cpf: "", telefone: "" }); }}
            className="text-xs text-muted-foreground hover:text-foreground">← Buscar cadastrado</button>
        </div>
      )}
    </div>
  );

  const stepPagamento = (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-foreground mb-1">Forma de Pagamento</h2>
        <p className="text-sm text-muted-foreground">Confirme o valor e escolha como pagar</p>
      </div>

      {/* Resumo */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resumo da venda</p>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Rota</span><span className="font-medium text-foreground">{rotaSel?.origem} → {rotaSel?.destino}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Data / Hora</span><span className="font-medium text-foreground">{new Date(horarioSel?.data_partida+"T00:00:00").toLocaleDateString("pt-BR")} {fmtHora(horarioSel?.hora_partida ?? "")}</span></div>
          {assento && <div className="flex justify-between"><span className="text-muted-foreground">Assento</span><span className="font-medium text-foreground">{assento}</span></div>}
          <div className="flex justify-between"><span className="text-muted-foreground">Passageiro</span><span className="font-medium text-foreground">{clienteSel?.nome ?? (modoNovo ? novoCliente.nome : "Não informado")}</span></div>
        </div>
        <div className="h-px bg-border/60" />
        <div className="flex justify-between items-center">
          <span className="font-semibold text-foreground">Total</span>
          <span className="text-2xl font-bold text-primary">{fmt(horarioSel?.preco ?? 0)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {PAGAMENTOS.map(p => (
          <button key={p.id} onClick={() => setPagamento(p.id)}
            className={cn("p-3 rounded-xl border text-sm font-semibold transition-all",
              pagamento === p.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-border/80")}>
            {p.label}
          </button>
        ))}
      </div>

      <div>
        <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Observações (opcional)</label>
        <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} placeholder="Ex: Passageiro com necessidade especial..."
          className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
      </div>

      {error && <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">{error}</div>}
    </div>
  );

  const stepConfirmado = (
    <div className="flex flex-col items-center text-center gap-6 py-6">
      <div className="w-20 h-20 rounded-full bg-green-500/15 border-2 border-green-500/30 flex items-center justify-center">
        <CheckCircle2 className="w-10 h-10 text-green-400" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-foreground">Venda realizada!</h2>
        <p className="text-muted-foreground mt-1">Passagem V-{String(passagemId).padStart(3,"0")} emitida com sucesso</p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Rota</span><span className="font-medium">{rotaSel?.origem} → {rotaSel?.destino}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Partida</span><span className="font-medium">{fmtHora(horarioSel?.hora_partida ?? "")}</span></div>
        {assento && <div className="flex justify-between"><span className="text-muted-foreground">Assento</span><span className="font-medium">{assento}</span></div>}
        <div className="flex justify-between"><span className="text-muted-foreground">Valor</span><span className="font-bold text-primary">{fmt(horarioSel?.preco ?? 0)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Pagamento</span><span className="font-medium">{PAGAMENTOS.find(p => p.id === pagamento)?.label}</span></div>
      </div>
      <div className="flex gap-3 w-full max-w-sm">
        <button onClick={() => { setStep(0); setRotaSel(null); setHorarioSel(null); setClienteSel(null); setClienteSearch(""); setAssento(""); setPagamento("pix"); setObservacoes(""); setPassagemId(null); setModoNovo(false); setNovoCliente({ nome: "", cpf: "", telefone: "" }); setOrigemSearch(""); setDestinoSearch(""); }}
          className="flex-1 bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold hover:bg-primary/90 transition-colors">
          Nova Venda
        </button>
        <button onClick={() => navigate("/viagens/vendas")}
          className="flex-1 bg-secondary text-muted-foreground rounded-xl py-3 text-sm font-semibold hover:bg-secondary/80 transition-colors">
          Ver Vendas
        </button>
      </div>
    </div>
  );

  const canNext = [
    !!rotaSel,
    !!horarioSel,
    !!(clienteSel || (modoNovo && novoCliente.nome)),
    true,
  ];

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        {step > 0 && step < 4 && (
          <button onClick={() => setStep(s => s - 1)} className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nova Venda</h1>
          <p className="text-muted-foreground text-sm">Emissão de passagem</p>
        </div>
      </div>

      <StepIndicator step={step} />

      <div className="bg-card border border-border rounded-2xl p-6">
        {step === 0 && stepRotas}
        {step === 1 && stepHorarios}
        {step === 2 && stepPassageiro}
        {step === 3 && stepPagamento}
        {step === 4 && stepConfirmado}

        {step < 4 && (
          <div className="mt-6 flex justify-end">
            {step < 3 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canNext[step]}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continuar
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 bg-green-500 text-white px-8 py-2.5 rounded-xl text-sm font-semibold hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                {submitting ? "Emitindo..." : "Confirmar Venda"}
                {!submitting && <CheckCircle2 className="w-4 h-4" />}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
