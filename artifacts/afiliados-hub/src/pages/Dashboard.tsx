import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { api, formatBRL } from "@/lib/api";
import { Users, DollarSign, TrendingUp, Wallet, Copy, Share2, ExternalLink, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: api.dashboard,
    retry: 1,
  });

  const [showQR, setShowQR] = useState(false);
  const [showSaque, setShowSaque] = useState(false);
  const [valor, setValor] = useState("");
  const [chavePix, setChavePix] = useState("");
  const [saving, setSaving] = useState(false);

  const afiliado = data?.afiliado || {};
  const config = data?.config || {};
  const comissoes = data?.comissoes || {};
  const saques = data?.saquesPendentes || {};

  const { data: qrData } = useQuery({
    queryKey: ["qrcode-link"],
    queryFn: api.qrcodeLink,
    enabled: !!afiliado.codigo,
    staleTime: Infinity,
  });

  // Use link from API (correct production domain) — fall back to window.location if unavailable
  const linkAfiliado = qrData?.url
    || (() => {
        const publicDomain = (import.meta.env.VITE_PUBLIC_DOMAIN as string) || window.location.origin;
        const base = publicDomain + import.meta.env.BASE_URL.replace(/\/$/, "");
        return `${base}/r/${afiliado.codigo || ""}`;
      })();

  const minimo = Number(config.valor_minimo_saque ?? 50);
  const saldo = Number(afiliado.saldo ?? 0);

  function copyLink() {
    navigator.clipboard.writeText(linkAfiliado);
    toast.success("Link copiado!");
  }

  async function handleSaque(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.resgatar(Number(valor), chavePix);
      toast.success("Saque solicitado com sucesso!");
      setShowSaque(false);
      setValor("");
      setChavePix("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500 text-sm">
        Erro ao carregar dados. Tente novamente.
      </div>
    );
  }

  const stats = [
    {
      label: "Saldo Disponível",
      value: formatBRL(saldo),
      icon: Wallet,
      color: "bg-green-50 text-green-600",
      highlight: true,
    },
    {
      label: "Total Indicados",
      value: String(afiliado.total_indicados ?? 0),
      icon: Users,
      color: "bg-blue-50 text-blue-600",
    },
    {
      label: "Comissões Aprovadas",
      value: formatBRL(comissoes.soma ?? 0),
      icon: DollarSign,
      color: "bg-purple-50 text-purple-600",
    },
    {
      label: "Total Ganho",
      value: formatBRL(afiliado.total_ganhos ?? 0),
      icon: TrendingUp,
      color: "bg-orange-50 text-orange-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          Bem-vindo(a), <strong>{afiliado.nome || "Afiliado"}</strong>! Seu código: <strong className="text-[hsl(var(--primary))]">{afiliado.codigo}</strong>
          {" "}· Comissão: <strong>{config.percentual_comissao ?? 10}%</strong> do lucro GoTaxi (3% de cada transação)
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, highlight }) => (
          <div
            key={label}
            className={`bg-white rounded-2xl p-5 shadow-sm border ${highlight ? "border-green-200 ring-1 ring-green-100" : "border-gray-100"}`}
          >
            <div className={`inline-flex p-2.5 rounded-xl ${color} mb-3`}>
              <Icon size={20} />
            </div>
            <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Como funciona a comissão */}
      <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-100 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <span className="text-base">💡</span> Como sua comissão é calculada
        </h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-white rounded-xl px-3 py-3 shadow-sm">
            <p className="text-lg font-black text-gray-900">Corrida</p>
            <p className="text-xs text-gray-500 mt-0.5">valor total</p>
          </div>
          <div className="flex flex-col items-center justify-center">
            <p className="text-xs text-gray-400 mb-1">GoTaxi cobra</p>
            <span className="font-black text-[hsl(var(--primary))] text-lg">3%</span>
            <p className="text-xs text-gray-400 mt-1">da corrida</p>
          </div>
          <div className="bg-white rounded-xl px-3 py-3 shadow-sm border border-green-100">
            <p className="text-lg font-black text-green-600">{config.percentual_comissao ?? 10}%</p>
            <p className="text-xs text-gray-500 mt-0.5">desse valor</p>
            <p className="text-xs font-medium text-green-600 mt-0.5">= sua comissão</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3 text-center">
          Ex.: corrida de <strong>R$ 100</strong> → GoTaxi recebe R$ 3 → você ganha <strong>R$ {((3 * Number(config.percentual_comissao ?? 10)) / 100).toFixed(2).replace(".", ",")}</strong>
        </p>
      </div>

      {/* Link de afiliado + QR */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Seu Link de Indicação</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
            <ExternalLink size={16} className="text-gray-400 shrink-0" />
            <span className="text-sm text-gray-700 truncate">{linkAfiliado}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={copyLink}
              className="flex items-center gap-2 px-4 py-3 bg-[hsl(var(--primary))] text-white rounded-xl text-sm font-medium hover:opacity-90 transition"
            >
              <Copy size={16} />
              Copiar
            </button>
            <button
              onClick={() => setShowQR(!showQR)}
              className="flex items-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition"
            >
              <Share2 size={16} />
              QR Code
            </button>
            <a
              href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/r/${afiliado.codigo || ""}`}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition"
            >
              <UserPlus size={16} />
              Cadastrar indicado
            </a>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Use "Cadastrar indicado" para cadastrar alguém diretamente pelo seu link — qualquer cadastro feito aqui já fica atrelado à sua equipe.
        </p>

        {showQR && (
          <div className="mt-5 flex flex-col items-center">
            <div className="p-5 bg-white border-2 border-gray-100 rounded-2xl shadow-sm">
              <QRCodeSVG value={linkAfiliado} size={200} level="H" includeMargin />
            </div>
            <p className="text-xs text-gray-500 mt-3 text-center">
              Escaneie para acessar seu link de indicação
            </p>
            <p className="text-xs font-medium text-[hsl(var(--primary))] mt-1">{afiliado.codigo}</p>
          </div>
        )}
      </div>

      {/* Saque rápido */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Solicitar Saque</h2>
            <p className="text-xs text-gray-500 mt-0.5">Mínimo: {formatBRL(minimo)} · Processado em até 3 dias úteis</p>
          </div>
          {!showSaque && (
            <button
              onClick={() => { setShowSaque(true); setChavePix(afiliado.chave_pix || ""); }}
              disabled={saldo < minimo}
              className="px-4 py-2 bg-[hsl(var(--primary))] text-white rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saldo < minimo ? `Saldo insuficiente` : "Solicitar"}
            </button>
          )}
        </div>

        {showSaque && (
          <form onSubmit={handleSaque} className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Valor (máx. {formatBRL(saldo)})</label>
                <input
                  type="number"
                  step="0.01"
                  min={minimo}
                  max={saldo}
                  required
                  value={valor}
                  onChange={e => setValor(e.target.value)}
                  placeholder={String(minimo)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Chave Pix</label>
                <input
                  type="text"
                  required
                  value={chavePix}
                  onChange={e => setChavePix(e.target.value)}
                  placeholder="CPF, e-mail ou telefone"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-[hsl(var(--primary))] text-white rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {saving ? "Enviando..." : "Confirmar Saque"}
              </button>
              <button
                type="button"
                onClick={() => setShowSaque(false)}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Saques pendentes aviso */}
      {Number(saques.total ?? 0) > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <strong>{saques.total} saque(s)</strong> totalizando <strong>{formatBRL(saques.soma)}</strong> aguardando processamento.
        </div>
      )}
    </div>
  );
}
