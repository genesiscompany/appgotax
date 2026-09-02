import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  LifeBuoy, Send, ChevronLeft, Bot, Headphones, User,
  CheckCircle, Clock, AlertCircle, X, Tag, Filter, RefreshCw,
  Settings, Save, RotateCcw
} from "lucide-react";

const API = "/api";
const ADMIN_TOKEN = btoa("superadmin");

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
  empresa_id: number;
  empresa_nome: string;
  titulo: string;
  status: string;
  prioridade: string;
  categoria: string;
  nao_lidas_admin: number;
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
const PRIO_MAP: Record<string, { label: string; color: string }> = {
  baixa: { label: "Baixa", color: "text-gray-500" },
  normal: { label: "Normal", color: "text-blue-500" },
  alta: { label: "Alta", color: "text-orange-500" },
  urgente: { label: "URGENTE", color: "text-red-600 font-bold" },
};

const DEFAULT_PROMPT = `Você é o assistente virtual de suporte da GoTaxi, uma plataforma SaaS de gestão para lojistas e parceiros (restaurantes, delivery, e-commerce, mototaxistas etc.).

Você responde dúvidas dos lojistas de forma clara, objetiva e em português do Brasil.

Tópicos que você conhece:
- PDV (painel do parceiro): pedidos, cardápio, produtos, pagamentos, configurações
- Financeiro: como interpretar relatórios, lançamentos, receitas e despesas
- Chat com clientes: como responder, quando aparecem as mensagens
- Módulos disponíveis: Food Delivery, E-commerce, Motoristas, Encomendas, Caronas
- Conta e acesso: senha, email, perfil, planos
- Integrações: Google Maps, métodos de pagamento

Quando não souber a resposta com certeza, diga que vai verificar e que um atendente humano irá ajudar em breve.

Seja sempre cordial, use no máximo 3 parágrafos curtos por resposta e nunca peça dados sensíveis como senhas.`;

// ── Aba Configurações IA ─────────────────────────────────────────────────────
function ConfiguracaoIA() {
  const [prompt, setPrompt] = useState("");
  const [original, setOriginal] = useState("");
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: "ok" | "erro"; msg: string } | null>(null);

  useEffect(() => {
    fetch(`${API}/admin/suporte/config/prompt`)
      .then(r => r.json())
      .then(d => {
        setPrompt(d.prompt ?? DEFAULT_PROMPT);
        setOriginal(d.prompt ?? DEFAULT_PROMPT);
      })
      .catch(() => {
        setPrompt(DEFAULT_PROMPT);
        setOriginal(DEFAULT_PROMPT);
      })
      .finally(() => setLoading(false));
  }, []);

  const salvar = async () => {
    if (!prompt.trim() || salvando) return;
    setSalvando(true);
    setFeedback(null);
    try {
      const r = await fetch(`${API}/admin/suporte/config/prompt`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      if (r.ok) {
        setOriginal(prompt.trim());
        setFeedback({ tipo: "ok", msg: "Prompt salvo com sucesso! A IA já está usando o novo texto." });
      } else {
        setFeedback({ tipo: "erro", msg: "Erro ao salvar. Tente novamente." });
      }
    } catch {
      setFeedback({ tipo: "erro", msg: "Sem conexão com o servidor." });
    }
    setSalvando(false);
    setTimeout(() => setFeedback(null), 4000);
  };

  const restaurar = () => {
    setPrompt(DEFAULT_PROMPT);
    setFeedback(null);
  };

  const alterado = prompt !== original;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
          <Bot className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">Prompt da IA de Suporte</h2>
          <p className="text-xs text-muted-foreground">Este texto define como a IA se comporta ao responder tickets dos lojistas.</p>
        </div>
      </div>

      {/* Dicas */}
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-5 text-xs text-violet-800 space-y-1">
        <p className="font-semibold mb-1.5">Dicas para um bom prompt:</p>
        <p>• Defina <strong>quem a IA é</strong> (nome, plataforma, tom de voz)</p>
        <p>• Liste os <strong>tópicos que ela deve conhecer</strong> e o que <strong>não deve responder</strong></p>
        <p>• Instrua sobre o que fazer quando <strong>não souber a resposta</strong></p>
        <p>• Defina o <strong>tamanho ideal das respostas</strong> (ex.: máximo 3 parágrafos)</p>
        <p>• Nunca inclua senhas, tokens ou dados sensíveis</p>
      </div>

      {/* Editor */}
      <div className="relative">
        <textarea
          className="w-full min-h-[380px] rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y font-mono leading-relaxed"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Digite aqui as instruções para a IA..."
        />
        <div className="absolute bottom-3 right-3 text-[10px] text-muted-foreground">
          {prompt.length} caracteres
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`mt-3 px-4 py-2.5 rounded-xl text-sm font-medium ${
          feedback.tipo === "ok"
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {feedback.msg}
        </div>
      )}

      {/* Ações */}
      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={salvar}
          disabled={!alterado || salvando}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-all"
        >
          {salvando
            ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            : <Save className="w-4 h-4" />
          }
          {salvando ? "Salvando..." : "Salvar prompt"}
        </button>
        <button
          onClick={restaurar}
          className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          Restaurar padrão
        </button>
        {alterado && (
          <span className="text-xs text-amber-600 font-medium">• Alterações não salvas</span>
        )}
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function Suporte() {
  const [aba, setAba] = useState<"tickets" | "config">("tickets");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selecionado, setSelecionado] = useState<Ticket | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTickets = useCallback(async () => {
    try {
      const qs = filtroStatus ? `?status=${filtroStatus}` : "";
      const r = await fetch(`${API}/admin/suporte/tickets${qs}`);
      if (r.ok) setTickets(await r.json());
    } catch {}
    setLoading(false);
  }, [filtroStatus]);

  const fetchMensagens = useCallback(async (tid: number) => {
    try {
      const r = await fetch(`${API}/admin/suporte/tickets/${tid}/mensagens`);
      if (r.ok) setMensagens(await r.json());
    } catch {}
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);
  useEffect(() => {
    const t = setInterval(fetchTickets, 6000);
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

  const enviar = async () => {
    if (!texto.trim() || !selecionado || enviando) return;
    const msg = texto.trim();
    setTexto("");
    setEnviando(true);
    try {
      const r = await fetch(`${API}/admin/suporte/tickets/${selecionado.id}/mensagens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem: msg }),
      });
      if (r.ok) {
        const nova = await r.json();
        setMensagens(prev => [...prev, nova]);
        setSelecionado(prev => prev ? { ...prev, status: "em_andamento" } : prev);
        fetchTickets();
      }
    } catch {}
    setEnviando(false);
  };

  const updateStatus = async (status: string) => {
    if (!selecionado) return;
    await fetch(`${API}/admin/suporte/tickets/${selecionado.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setSelecionado(prev => prev ? { ...prev, status } : prev);
    setTickets(prev => prev.map(t => t.id === selecionado.id ? { ...t, status } : t));
  };

  const updatePrioridade = async (prioridade: string) => {
    if (!selecionado) return;
    await fetch(`${API}/admin/suporte/tickets/${selecionado.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prioridade }),
    });
    setSelecionado(prev => prev ? { ...prev, prioridade } : prev);
    setTickets(prev => prev.map(t => t.id === selecionado.id ? { ...t, prioridade } : t));
  };

  const totalNaoLidas = tickets.reduce((s, t) => s + (t.nao_lidas_admin || 0), 0);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Abas */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-border bg-background">
        <button
          onClick={() => setAba("tickets")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
            aba === "tickets"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <LifeBuoy className="w-4 h-4" />
          Tickets
          {totalNaoLidas > 0 && (
            <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
              {totalNaoLidas}
            </span>
          )}
        </button>
        <button
          onClick={() => setAba("config")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
            aba === "config"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Settings className="w-4 h-4" />
          Configurações da IA
        </button>
      </div>

      {/* Conteúdo */}
      {aba === "config" ? (
        <ConfiguracaoIA />
      ) : (
        <div className="flex flex-1 overflow-hidden rounded-b-xl border-x border-b border-border bg-card shadow-sm">
          {/* ── Lista ─────────────────────────────────── */}
          <div className={`flex flex-col border-r border-border bg-background ${selecionado ? "hidden md:flex" : "flex"} w-full md:w-80 flex-shrink-0`}>
            <div className="px-4 py-4 border-b border-border">
              <div className="flex items-center gap-2 mb-3">
                <LifeBuoy className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-sm text-foreground flex-1">Tickets de Suporte</h2>
                {totalNaoLidas > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{totalNaoLidas}</span>
                )}
                <button onClick={fetchTickets} className="p-1 hover:bg-secondary rounded-lg transition-colors">
                  <RefreshCw className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                <select
                  className="flex-1 text-xs border border-border rounded-lg px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  value={filtroStatus}
                  onChange={e => setFiltroStatus(e.target.value)}
                >
                  <option value="">Todos os tickets</option>
                  <option value="aberto">Abertos</option>
                  <option value="em_andamento">Em andamento</option>
                  <option value="resolvido">Resolvidos</option>
                  <option value="fechado">Fechados</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-6">
                <LifeBuoy className="w-12 h-12 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Nenhum ticket{filtroStatus ? " neste status" : ""}</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto divide-y divide-border/50">
                {tickets.map(t => {
                  const st = STATUS_MAP[t.status] ?? STATUS_MAP.aberto;
                  const pr = PRIO_MAP[t.prioridade] ?? PRIO_MAP.normal;
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
                        <p className="text-[10px] text-primary/80 font-medium mt-0.5">{t.empresa_nome || `Empresa #${t.empresa_id}`}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${st.color}`}>
                            {st.icon}{st.label}
                          </span>
                          <span className={`text-[9px] ${pr.color}`}>{pr.label}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{t.ultima_mensagem ?? "Ticket aberto"}</p>
                      </div>
                      {t.nao_lidas_admin > 0 && (
                        <span className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                          <span className="text-[8px] font-bold text-white">{t.nao_lidas_admin}</span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Chat ─────────────────────────────────── */}
          <div className={`flex flex-col flex-1 ${selecionado ? "flex" : "hidden md:flex"}`}>
            {!selecionado ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
                <LifeBuoy className="w-16 h-16 text-muted-foreground/20" />
                <p className="text-muted-foreground text-sm">Selecione um ticket para atender</p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-start gap-3 px-4 py-3 border-b border-border bg-background">
                  <button onClick={() => setSelecionado(null)} className="md:hidden p-1 hover:bg-secondary rounded-lg mt-0.5">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground">{selecionado.titulo}</p>
                    <p className="text-xs text-primary/80 font-medium">{selecionado.empresa_nome || `Empresa #${selecionado.empresa_id}`}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Tag className="w-3 h-3" />{selecionado.categoria}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
                    <select
                      className="text-xs border border-border rounded-lg px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      value={selecionado.status}
                      onChange={e => updateStatus(e.target.value)}
                    >
                      <option value="aberto">Aberto</option>
                      <option value="em_andamento">Em andamento</option>
                      <option value="resolvido">Resolvido</option>
                      <option value="fechado">Fechado</option>
                    </select>
                    <select
                      className="text-xs border border-border rounded-lg px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      value={selecionado.prioridade}
                      onChange={e => updatePrioridade(e.target.value)}
                    >
                      <option value="baixa">Baixa</option>
                      <option value="normal">Normal</option>
                      <option value="alta">Alta</option>
                      <option value="urgente">Urgente</option>
                    </select>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {mensagens.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-8">Carregando mensagens...</div>
                  )}
                  {mensagens.map(m => (
                    <div key={m.id} className={`flex gap-2 ${m.remetente === "admin" ? "justify-end" : "justify-start"}`}>
                      {m.remetente !== "admin" && (
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${m.remetente === "ia" ? "bg-violet-100" : "bg-secondary"}`}>
                          {m.remetente === "ia"
                            ? <Bot className="w-4 h-4 text-violet-600" />
                            : <User className="w-4 h-4 text-muted-foreground" />
                          }
                        </div>
                      )}
                      <div className="max-w-[72%]">
                        {m.remetente !== "admin" && (
                          <p className="text-[10px] text-muted-foreground mb-0.5 pl-1">
                            {m.remetente === "ia" ? "🤖 Assistente IA" : "🏪 Lojista"}
                          </p>
                        )}
                        <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                          m.remetente === "admin"
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : m.remetente === "ia"
                            ? "bg-violet-50 text-foreground border border-violet-200 rounded-bl-sm"
                            : "bg-secondary text-foreground rounded-bl-sm"
                        }`}>
                          <p className="break-words whitespace-pre-wrap">{m.mensagem}</p>
                          <p className={`text-[10px] mt-1 ${m.remetente === "admin" ? "text-primary-foreground/70 text-right" : "text-muted-foreground"}`}>
                            {formatTime(m.created_at)}
                          </p>
                        </div>
                      </div>
                      {m.remetente === "admin" && (
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Headphones className="w-4 h-4 text-primary" />
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                {selecionado.status === "fechado" ? (
                  <div className="px-4 py-3 border-t border-border bg-secondary/30 text-center text-sm text-muted-foreground">
                    Ticket fechado. Altere o status para reabrir.
                  </div>
                ) : (
                  <div className="px-4 py-3 border-t border-border bg-background">
                    <div className="flex gap-2 items-end">
                      <textarea
                        className="flex-1 resize-none rounded-xl border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors min-h-[42px] max-h-[120px]"
                        placeholder="Responda ao lojista..."
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
                    <p className="text-[10px] text-muted-foreground mt-1.5 pl-1">Respondendo como Atendente GoTaxi • Enter para enviar</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
