import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";

const API = import.meta.env.BASE_URL.replace(/\/$/, "").replace("/admin", "") + "/api/admin";

const MODULOS = [
  { id: "todos", label: "Todos os usuários", emoji: "📣", cor: "bg-gray-100 text-gray-700 border-gray-200" },
  { id: "motorista", label: "Viagens", emoji: "🚗", cor: "bg-orange-50 text-orange-700 border-orange-200" },
  { id: "food", label: "Alimentação", emoji: "🍕", cor: "bg-purple-50 text-purple-700 border-purple-200" },
  { id: "entrega", label: "Entregas", emoji: "📦", cor: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  { id: "servicos", label: "Serviços", emoji: "🔧", cor: "bg-blue-50 text-blue-700 border-blue-200" },
  { id: "ecommerce", label: "E-commerce", emoji: "🛒", cor: "bg-teal-50 text-teal-700 border-teal-200" },
  { id: "passagens", label: "Passagens", emoji: "🎫", cor: "bg-green-50 text-green-700 border-green-200" },
];

type Stats = { total: string; motorista: string; food: string; entrega: string; servicos: string; ecommerce: string; passagens: string };
type Historico = { id: number; titulo: string; mensagem: string; modulo: string; total_tokens: number; total_enviado: number; criado_em: string };

export default function PushNotifications() {
  const { token } = useAuth() as any;
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [moduloSel, setModuloSel] = useState("todos");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; tokens: number; enviado: number } | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [historico, setHistorico] = useState<Historico[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  const authHeader = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const r = await fetch(`${API}/push/stats`, { headers: authHeader });
      if (r.ok) setStats(await r.json());
    } catch {}
    setLoadingStats(false);
  };

  const loadHistorico = async () => {
    try {
      const r = await fetch(`${API}/push/historico`, { headers: authHeader });
      if (r.ok) setHistorico(await r.json());
    } catch {}
  };

  useEffect(() => {
    loadStats();
    loadHistorico();
  }, []);

  const handleEnviar = async () => {
    if (!titulo.trim() || !mensagem.trim()) return;
    setEnviando(true);
    setResultado(null);
    try {
      const r = await fetch(`${API}/push/send`, {
        method: "POST",
        headers: authHeader,
        body: JSON.stringify({ titulo: titulo.trim(), mensagem: mensagem.trim(), modulo: moduloSel }),
      });
      const data = await r.json();
      setResultado(data);
      if (data.ok) {
        setTitulo("");
        setMensagem("");
        setTimeout(() => { loadStats(); loadHistorico(); }, 500);
      }
    } catch { setResultado({ ok: false, tokens: 0, enviado: 0 }); }
    setEnviando(false);
  };

  const getStatForModulo = (id: string) => {
    if (!stats) return "—";
    if (id === "todos") return stats.total ?? "0";
    return (stats as any)[id] ?? "0";
  };

  const formatModuloLabel = (id: string) => MODULOS.find(m => m.id === id)?.label ?? id;
  const formatDate = (d: string) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Push Notifications</h1>
        <p className="text-muted-foreground mt-1">Envie notificações para todos os clientes ou por módulo específico.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {MODULOS.map(m => (
          <div key={m.id} className={`rounded-xl border p-3 text-center ${m.cor}`}>
            <div className="text-xl mb-1">{m.emoji}</div>
            <div className="text-xl font-bold">
              {loadingStats ? <span className="animate-pulse text-sm">...</span> : getStatForModulo(m.id)}
            </div>
            <div className="text-xs mt-0.5 font-medium">{m.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Formulário de envio */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <span className="text-xl">📤</span> Enviar notificação
          </h2>

          {/* Seletor de módulo */}
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">Destinatários</label>
            <div className="flex flex-wrap gap-2">
              {MODULOS.map(m => (
                <button
                  key={m.id}
                  onClick={() => setModuloSel(m.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    moduloSel === m.id
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  <span>{m.emoji}</span>
                  {m.label}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${moduloSel === m.id ? "bg-white/20" : "bg-muted"}`}>
                    {getStatForModulo(m.id)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Título */}
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">Título</label>
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              maxLength={80}
              placeholder="Ex: Nova promoção disponível!"
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">{titulo.length}/80</p>
          </div>

          {/* Mensagem */}
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">Mensagem</label>
            <textarea
              value={mensagem}
              onChange={e => setMensagem(e.target.value)}
              maxLength={250}
              rows={3}
              placeholder="Ex: Aproveite 20% de desconto em corridas esse fim de semana..."
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">{mensagem.length}/250</p>
          </div>

          {/* Preview */}
          {(titulo || mensagem) && (
            <div className="bg-gray-900 rounded-xl p-4 text-white">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Preview da notificação</p>
              <div className="bg-white/10 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 bg-green-500 rounded-md flex items-center justify-center text-[10px]">G</div>
                  <span className="text-xs text-gray-300">GoTaxi</span>
                  <span className="text-xs text-gray-500 ml-auto">agora</span>
                </div>
                <p className="text-sm font-semibold">{titulo || "Título da notificação"}</p>
                <p className="text-xs text-gray-300 mt-0.5">{mensagem || "Texto da mensagem aqui..."}</p>
              </div>
            </div>
          )}

          {/* Resultado */}
          {resultado && (
            <div className={`rounded-lg p-3 text-sm flex items-center gap-2 ${resultado.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {resultado.ok ? (
                <>✅ Enviado para <strong>{resultado.enviado}</strong> dispositivo{resultado.enviado !== 1 ? "s" : ""} de <strong>{resultado.tokens}</strong> registrado{resultado.tokens !== 1 ? "s" : ""}</>
              ) : (
                <>❌ Erro ao enviar a notificação. Tente novamente.</>
              )}
            </div>
          )}

          <button
            onClick={handleEnviar}
            disabled={enviando || !titulo.trim() || !mensagem.trim()}
            className="w-full h-11 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {enviando ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Enviando...
              </>
            ) : (
              <>📤 Enviar para {MODULOS.find(m => m.id === moduloSel)?.label} · {getStatForModulo(moduloSel)} dispositivo{Number(getStatForModulo(moduloSel)) !== 1 ? "s" : ""}</>
            )}
          </button>
        </div>

        {/* Histórico */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <span className="text-xl">📋</span> Histórico de envios
          </h2>
          {historico.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="text-4xl mb-3">🔔</div>
              <p className="text-sm">Nenhuma notificação enviada ainda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historico.map(h => {
                const mod = MODULOS.find(m => m.id === h.modulo);
                return (
                  <div key={h.id} className="border border-border rounded-xl p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm truncate">{h.titulo}</p>
                        <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2">{h.mensagem}</p>
                      </div>
                      <span className={`shrink-0 text-xs px-2 py-1 rounded-lg border ${mod?.cor ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                        {mod?.emoji} {mod?.label ?? h.modulo}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatDate(h.criado_em)}</span>
                      <span className="font-medium text-green-600">{h.total_enviado}/{h.total_tokens} enviados</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
