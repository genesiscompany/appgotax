import React, { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, Send, RefreshCw, ChevronLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";

const API_BASE = "/api";

type Conversa = {
  id: number;
  cliente_nome: string;
  ultima_mensagem: string | null;
  ultima_at: string;
  nao_lidas_loja: number;
};

type Mensagem = {
  id: number;
  remetente: "cliente" | "loja";
  mensagem: string;
  lida: boolean;
  created_at: string;
};

function normalizeDate(iso: string): Date {
  return new Date(iso.replace(" ", "T").replace("+00", "Z"));
}

function timeAgo(iso: string) {
  const d = normalizeDate(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
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

export default function Chat() {
  const { token } = useAuth();
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [selecionada, setSelecionada] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchConversas = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/chat/conversas`, { headers });
      if (r.ok) setConversas(await r.json());
    } catch {}
    setLoading(false);
  }, [token]);

  const fetchMensagens = useCallback(async (conversaId: number) => {
    try {
      const r = await fetch(`${API_BASE}/chat/conversa/${conversaId}/mensagens`);
      if (r.ok) {
        const data: Mensagem[] = await r.json();
        setMensagens(data);
      }
    } catch {}
  }, []);

  useEffect(() => { fetchConversas(); }, [fetchConversas]);

  // Poll conversas every 5s for badges
  useEffect(() => {
    const t = setInterval(fetchConversas, 5000);
    return () => clearInterval(t);
  }, [fetchConversas]);

  // Poll messages every 3s when conversation is open
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!selecionada) return;
    fetchMensagens(selecionada.id);
    // Mark as read
    fetch(`${API_BASE}/chat/conversa/${selecionada.id}/lida`, { method: "POST", headers });
    pollRef.current = setInterval(() => {
      fetchMensagens(selecionada.id);
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selecionada?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  const abrirConversa = (c: Conversa) => {
    setSelecionada(c);
    // Clear unread badge locally
    setConversas(prev => prev.map(x => x.id === c.id ? { ...x, nao_lidas_loja: 0 } : x));
  };

  const enviar = async () => {
    if (!texto.trim() || !selecionada || enviando) return;
    setEnviando(true);
    const msg = texto.trim();
    setTexto("");
    try {
      const r = await fetch(`${API_BASE}/chat/conversa/${selecionada.id}/mensagem`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ remetente: "loja", mensagem: msg }),
      });
      if (r.ok) {
        const nova = await r.json();
        setMensagens(prev => [...prev, nova]);
        setConversas(prev => prev.map(c => c.id === selecionada.id ? { ...c, ultima_mensagem: msg, ultima_at: nova.created_at } : c));
      }
    } catch {}
    setEnviando(false);
  };

  const totalNaoLidas = conversas.reduce((s, c) => s + (c.nao_lidas_loja || 0), 0);

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 rounded-xl overflow-hidden border border-border bg-card shadow-sm">
      {/* ── Conversations sidebar ─────────────────────────────────────── */}
      <div className={`flex flex-col border-r border-border bg-background ${selecionada ? "hidden md:flex" : "flex"} w-full md:w-80 flex-shrink-0`}>
        <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">Chat com Clientes</h2>
          {totalNaoLidas > 0 && (
            <span className="ml-auto bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
              {totalNaoLidas}
            </span>
          )}
          <button onClick={fetchConversas} className="ml-auto p-1 hover:bg-secondary rounded-lg transition-colors">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : conversas.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-6">
            <MessageSquare className="w-12 h-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Nenhuma conversa ainda</p>
            <p className="text-xs text-muted-foreground">Quando clientes enviarem mensagens pelo app, elas aparecerão aqui.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-border/50">
            {conversas.map(c => (
              <button
                key={c.id}
                onClick={() => abrirConversa(c)}
                className={`w-full text-left px-4 py-3 hover:bg-secondary/60 transition-colors flex gap-3 items-start ${selecionada?.id === c.id ? "bg-primary/5 border-l-2 border-primary" : ""}`}
              >
                <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-sm font-bold text-primary">{c.cliente_nome[0]?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm text-foreground truncate">{c.cliente_nome}</span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">{timeAgo(c.ultima_at)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{c.ultima_mensagem ?? "Conversa iniciada"}</p>
                </div>
                {c.nao_lidas_loja > 0 && (
                  <span className="w-5 h-5 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-[9px] font-bold text-primary-foreground">{c.nao_lidas_loja}</span>
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Chat area ─────────────────────────────────────────────────── */}
      <div className={`flex flex-col flex-1 ${selecionada ? "flex" : "hidden md:flex"}`}>
        {!selecionada ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
            <MessageSquare className="w-16 h-16 text-muted-foreground/20" />
            <p className="text-muted-foreground text-sm">Selecione uma conversa para responder</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background">
              <button onClick={() => setSelecionada(null)} className="md:hidden p-1 hover:bg-secondary rounded-lg">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">{selecionada.cliente_nome[0]?.toUpperCase()}</span>
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">{selecionada.cliente_nome}</p>
                <p className="text-[11px] text-muted-foreground">Cliente</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              {mensagens.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-8">Sem mensagens ainda. Aguardando o cliente...</div>
              )}
              {mensagens.map((m) => (
                <div key={m.id} className={`flex ${m.remetente === "loja" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
                    m.remetente === "loja"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-secondary text-foreground rounded-bl-sm"
                  }`}>
                    <p className="break-words">{m.mensagem}</p>
                    <p className={`text-[10px] mt-1 ${m.remetente === "loja" ? "text-primary-foreground/70 text-right" : "text-muted-foreground"}`}>
                      {formatTime(m.created_at)}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-border bg-background">
              <div className="flex gap-2 items-end">
                <textarea
                  className="flex-1 resize-none rounded-xl border border-border bg-secondary/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors min-h-[42px] max-h-[120px]"
                  placeholder="Digite sua resposta..."
                  rows={1}
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                />
                <button
                  onClick={enviar}
                  disabled={!texto.trim() || enviando}
                  className="p-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
                >
                  {enviando
                    ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    : <Send className="w-4 h-4" />
                  }
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 pl-1">Enter para enviar • Shift+Enter para nova linha</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
