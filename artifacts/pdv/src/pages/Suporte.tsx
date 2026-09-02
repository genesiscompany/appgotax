import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  LifeBuoy, Plus, Send, ChevronLeft, Bot, User, Headphones,
  CheckCircle, Clock, AlertCircle, X, Tag
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const API = "/api";

function normalizeDate(iso: string): Date {
  return new Date(iso.replace(" ", "T").replace("+00", "Z"));
}
function timeAgo(iso: string) {
  const d = normalizeDate(iso);
  if (isNaN(d.getTime())) return "";
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function formatTime(iso: string) {
  const d = normalizeDate(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

type Ticket = {
  id: number;
  titulo: string;
  status: string;
  prioridade: string;
  categoria: string;
  nao_lidas_loja: number;
  ultima_mensagem: string | null;
  ultima_at: string;
  created_at: string;
};
type Mensagem = {
  id: number;
  remetente: "loja" | "admin" | "ia";
  mensagem: string;
  lida: boolean;
  created_at: string;
};

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  aberto: { label: "Aberto", color: "text-blue-600 bg-blue-50", icon: <Clock className="w-3 h-3" /> },
  em_andamento: { label: "Em andamento", color: "text-amber-600 bg-amber-50", icon: <AlertCircle className="w-3 h-3" /> },
  resolvido: { label: "Resolvido", color: "text-green-600 bg-green-50", icon: <CheckCircle className="w-3 h-3" /> },
  fechado: { label: "Fechado", color: "text-gray-500 bg-gray-100", icon: <X className="w-3 h-3" /> },
};
const PRIO_MAP: Record<string, string> = {
  baixa: "text-gray-500", normal: "text-blue-500", alta: "text-orange-500", urgente: "text-red-600"
};
const CATEGORIAS = ["geral", "pedidos", "pagamento", "cardapio", "financeiro", "acesso", "tecnico", "outro"];

export default function Suporte() {
  const { token, empresa } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selecionado, setSelecionado] = useState<Ticket | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNovo, setShowNovo] = useState(false);
  const [iaDigitando, setIaDigitando] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [novoTitulo, setNovoTitulo] = useState("");
  const [novoCategoria, setNovoCategoria] = useState("geral");
  const [novoPrioridade, setNovoPrioridade] = useState("normal");
  const [novaMensagem, setNovaMensagem] = useState("");
  const [criando, setCriando] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchTickets = useCallback(async () => {
    try {
      const r = await fetch(`${API}/pdv/suporte/tickets`, { headers });
      if (r.ok) setTickets(await r.json());
    } catch {}
    setLoading(false);
  }, [token]);

  const fetchMensagens = useCallback(async (tid: number) => {
    try {
      const r = await fetch(`${API}/pdv/suporte/tickets/${tid}/mensagens`, { headers });
      if (r.ok) {
        const data: Mensagem[] = await r.json();
        setMensagens(data);
        setIaDigitando(false);
      }
    } catch {}
  }, [token]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);
  useEffect(() => {
    const t = setInterval(fetchTickets, 8000);
    return () => clearInterval(t);
  }, [fetchTickets]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!selecionado) return;
    fetchMensagens(selecionado.id);
    pollRef.current = setInterval(() => fetchMensagens(selecionado.id), 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selecionado?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  const criarTicket = async () => {
    if (!novoTitulo.trim() || !novaMensagem.trim()) return;
    setCriando(true);
    setIaDigitando(true);
    try {
      const r = await fetch(`${API}/pdv/suporte/tickets`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          titulo: novoTitulo.trim(),
          categoria: novoCategoria,
          prioridade: novoPrioridade,
          mensagem_inicial: novaMensagem.trim(),
          empresa_nome: empresa?.nome ?? "",
        }),
      });
      if (r.ok) {
        const data = await r.json();
        setShowNovo(false);
        setNovoTitulo(""); setNovaMensagem(""); setNovoCategoria("geral"); setNovoPrioridade("normal");
        await fetchTickets();
        const newTickets = await fetch(`${API}/pdv/suporte/tickets`, { headers }).then(x => x.json());
        const found = newTickets.find((t: Ticket) => t.id === data.id);
        if (found) {
          setSelecionado(found);
          await fetchMensagens(data.id);
        }
      }
    } catch {}
    setCriando(false);
    setIaDigitando(false);
  };

  const enviar = async () => {
    if (!texto.trim() || !selecionado || enviando) return;
    const msg = texto.trim();
    setTexto("");
    setEnviando(true);
    setIaDigitando(true);
    try {
      const r = await fetch(`${API}/pdv/suporte/tickets/${selecionado.id}/mensagens`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem: msg }),
      });
      if (r.ok) {
        const nova = await r.json();
        setMensagens(prev => [...prev, nova]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    } catch {}
    setEnviando(false);
  };

  const fecharTicket = async () => {
    if (!selecionado) return;
    await fetch(`${API}/pdv/suporte/tickets/${selecionado.id}/fechar`, { method: "POST", headers });
    setSelecionado(null);
    fetchTickets();
  };

  const totalNaoLidas = tickets.reduce((s, t) => s + (t.nao_lidas_loja || 0), 0);

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 rounded-xl overflow-hidden border border-border bg-card shadow-sm">
      {/* ── Lista de tickets ─────────────────────────────────── */}
      <div className={`flex flex-col border-r border-border bg-background ${selecionado ? "hidden md:flex" : "flex"} w-full md:w-80 flex-shrink-0`}>
        <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
          <LifeBuoy className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-sm text-foreground flex-1">Suporte GoTaxi</h2>
          {totalNaoLidas > 0 && (
            <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">{totalNaoLidas}</span>
          )}
          <button
            onClick={() => setShowNovo(true)}
            className="flex items-center gap-1 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Novo
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-6">
            <LifeBuoy className="w-12 h-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground font-medium">Nenhum ticket ainda</p>
            <p className="text-xs text-muted-foreground">Clique em "Novo" para abrir um chamado de suporte.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-border/50">
            {tickets.map(t => {
              const st = STATUS_MAP[t.status] ?? STATUS_MAP.aberto;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelecionado(t)}
                  className={`w-full text-left px-4 py-3 hover:bg-secondary/60 transition-colors flex gap-3 items-start ${selecionado?.id === t.id ? "bg-primary/5 border-l-2 border-primary" : ""}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-xs text-foreground truncate flex-1">{t.titulo}</span>
                      <span className="text-[9px] text-muted-foreground flex-shrink-0">{timeAgo(t.ultima_at)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${st.color}`}>
                        {st.icon}{st.label}
                      </span>
                      <span className={`text-[9px] font-semibold ${PRIO_MAP[t.prioridade]}`}>
                        {t.prioridade.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{t.ultima_mensagem ?? "Ticket aberto"}</p>
                  </div>
                  {t.nao_lidas_loja > 0 && (
                    <span className="w-4 h-4 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-[8px] font-bold text-primary-foreground">{t.nao_lidas_loja}</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Área de chat ─────────────────────────────────────── */}
      <div className={`flex flex-col flex-1 ${selecionado ? "flex" : "hidden md:flex"}`}>
        {!selecionado ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <LifeBuoy className="w-8 h-8 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Suporte GoTaxi</p>
              <p className="text-sm text-muted-foreground mt-1">Selecione um ticket ou crie um novo para começar.</p>
            </div>
            <button
              onClick={() => setShowNovo(true)}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Abrir novo ticket
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background">
              <button onClick={() => setSelecionado(null)} className="md:hidden p-1 hover:bg-secondary rounded-lg">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">{selecionado.titulo}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {(() => { const st = STATUS_MAP[selecionado.status] ?? STATUS_MAP.aberto; return (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.color}`}>
                      {st.icon}{st.label}
                    </span>
                  ); })()}
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Tag className="w-3 h-3" />{selecionado.categoria}
                  </span>
                </div>
              </div>
              {selecionado.status !== "fechado" && (
                <button
                  onClick={fecharTicket}
                  className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors"
                >
                  Fechar ticket
                </button>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {mensagens.map(m => (
                <div key={m.id} className={`flex gap-2 ${m.remetente === "loja" ? "justify-end" : "justify-start"}`}>
                  {m.remetente !== "loja" && (
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${m.remetente === "ia" ? "bg-violet-100" : "bg-primary/10"}`}>
                      {m.remetente === "ia"
                        ? <Bot className="w-4 h-4 text-violet-600" />
                        : <Headphones className="w-4 h-4 text-primary" />
                      }
                    </div>
                  )}
                  <div className={`max-w-[72%] ${m.remetente === "loja" ? "" : ""}`}>
                    {m.remetente !== "loja" && (
                      <p className="text-[10px] text-muted-foreground mb-0.5 pl-1">
                        {m.remetente === "ia" ? "🤖 Assistente IA" : "👤 Atendente GoTaxi"}
                      </p>
                    )}
                    <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                      m.remetente === "loja"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : m.remetente === "ia"
                        ? "bg-violet-50 text-foreground border border-violet-200 rounded-bl-sm"
                        : "bg-secondary text-foreground rounded-bl-sm"
                    }`}>
                      <p className="break-words whitespace-pre-wrap">{m.mensagem}</p>
                      <p className={`text-[10px] mt-1 ${m.remetente === "loja" ? "text-primary-foreground/70 text-right" : "text-muted-foreground"}`}>
                        {formatTime(m.created_at)}
                      </p>
                    </div>
                  </div>
                  {m.remetente === "loja" && (
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                  )}
                </div>
              ))}
              {iaDigitando && (
                <div className="flex gap-2 justify-start">
                  <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5 pl-1">🤖 Assistente IA</p>
                    <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-violet-50 border border-violet-200">
                      <div className="flex gap-1 items-center">
                        <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            {selecionado.status === "fechado" ? (
              <div className="px-4 py-3 border-t border-border bg-secondary/30 text-center text-sm text-muted-foreground">
                Este ticket está fechado.
              </div>
            ) : (
              <div className="px-4 py-3 border-t border-border bg-background">
                <div className="flex gap-2 items-end">
                  <textarea
                    className="flex-1 resize-none rounded-xl border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors min-h-[42px] max-h-[120px]"
                    placeholder="Digite sua mensagem..."
                    rows={1}
                    value={texto}
                    onChange={e => setTexto(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                  />
                  <button
                    onClick={enviar}
                    disabled={!texto.trim() || enviando}
                    className="p-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-40 transition-all flex-shrink-0"
                  >
                    {enviando
                      ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      : <Send className="w-4 h-4" />
                    }
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 pl-1">Enter para enviar • Shift+Enter para nova linha</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modal novo ticket ────────────────────────────────── */}
      {showNovo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-background rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <LifeBuoy className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-foreground">Abrir novo ticket</h3>
              <button onClick={() => setShowNovo(false)} className="ml-auto p-1 hover:bg-secondary rounded-lg">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Assunto *</label>
                <input
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Ex: Problema ao cadastrar produto"
                  value={novoTitulo}
                  onChange={e => setNovoTitulo(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-foreground mb-1 block">Categoria</label>
                  <select
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    value={novoCategoria}
                    onChange={e => setNovoCategoria(e.target.value)}
                  >
                    {CATEGORIAS.map(c => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-foreground mb-1 block">Prioridade</label>
                  <select
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    value={novoPrioridade}
                    onChange={e => setNovoPrioridade(e.target.value)}
                  >
                    <option value="baixa">Baixa</option>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Descreva o problema *</label>
                <textarea
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  rows={4}
                  placeholder="Descreva sua dúvida ou problema com o máximo de detalhes..."
                  value={novaMensagem}
                  onChange={e => setNovaMensagem(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowNovo(false)} className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-secondary transition-colors">
                Cancelar
              </button>
              <button
                onClick={criarTicket}
                disabled={criando || !novoTitulo.trim() || !novaMensagem.trim()}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors flex items-center gap-2"
              >
                {criando
                  ? <><div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> Abrindo...</>
                  : <><Send className="w-3.5 h-3.5" /> Abrir ticket</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
