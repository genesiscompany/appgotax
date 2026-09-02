import { useQuery } from "@tanstack/react-query";
import { api, formatBRL, getToken } from "@/lib/api";
import { BarChart3, Download, TrendingUp, Users, DollarSign } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function Relatorios() {
  const { data: indicados = [] } = useQuery({ queryKey: ["indicados"], queryFn: api.indicados });
  const { data: comissoes = [] } = useQuery({ queryKey: ["comissoes"], queryFn: api.comissoes });
  const { data: resgates = [] } = useQuery({ queryKey: ["resgates"], queryFn: api.resgates });

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace("/afiliados", "");
  const csvUrl = `${BASE}/api/afiliados/relatorio.csv`;

  function downloadCSV() {
    const token = getToken();
    const a = document.createElement("a");
    a.href = csvUrl;
    a.download = "relatorio-afiliados.csv";
    const form = document.createElement("form");
    form.method = "GET";
    form.action = csvUrl;
    document.body.appendChild(form);

    fetch(csvUrl, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "relatorio-afiliados.csv";
        link.click();
        URL.revokeObjectURL(url);
      });
  }

  // Group comissoes by month
  const byMonth: Record<string, number> = {};
  (comissoes as any[]).forEach(c => {
    if (c.status !== "aprovado") return;
    const m = new Date(c.criado_em).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
    byMonth[m] = (byMonth[m] || 0) + Number(c.valor_comissao);
  });
  const chartData = Object.entries(byMonth).slice(-6).map(([mes, valor]) => ({ mes, valor }));

  const totalComissoes = (comissoes as any[]).filter(r => r.status === "aprovado").reduce((s: number, r: any) => s + Number(r.valor_comissao), 0);
  const totalSacado = (resgates as any[]).filter(r => r.status === "pago").reduce((s: number, r: any) => s + Number(r.valor), 0);

  const resumo = [
    { label: "Total de Indicados", value: String((indicados as any[]).length), icon: Users, color: "text-blue-600" },
    { label: "Indicados Convertidos", value: String((indicados as any[]).filter((r: any) => r.status === "convertido" || r.status === "ativo").length), icon: TrendingUp, color: "text-green-600" },
    { label: "Comissões Aprovadas", value: formatBRL(totalComissoes), icon: DollarSign, color: "text-purple-600" },
    { label: "Total Sacado", value: formatBRL(totalSacado), icon: BarChart3, color: "text-orange-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-gray-500 text-sm mt-1">Resumo completo da sua performance como afiliado</p>
        </div>
        <button
          onClick={downloadCSV}
          className="flex items-center gap-2 px-4 py-2.5 bg-[hsl(var(--primary))] text-white rounded-xl text-sm font-medium hover:opacity-90 transition shadow-sm"
        >
          <Download size={16} />
          Exportar CSV
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {resumo.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <Icon size={20} className={`${color} mb-3`} />
            <p className="text-xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Gráfico */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-5">Comissões por Mês</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#9ca3af" }} />
              <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} tickFormatter={v => `R$${v}`} />
              <Tooltip
                formatter={(v: any) => [formatBRL(v), "Comissão"]}
                contentStyle={{ borderRadius: 12, border: "1px solid #f0f0f0", fontSize: 13 }}
              />
              <Bar dataKey="valor" fill="hsl(358, 80%, 46%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabela indicados */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Taxa de Conversão</h2>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-[hsl(var(--primary))] rounded-full transition-all"
                style={{
                  width: `${(indicados as any[]).length > 0
                    ? Math.min(100, Math.round(((indicados as any[]).filter((r: any) => r.status === "convertido" || r.status === "ativo").length / (indicados as any[]).length) * 100))
                    : 0}%`
                }}
              />
            </div>
            <span className="text-sm font-bold text-gray-700 w-12 text-right">
              {(indicados as any[]).length > 0
                ? Math.round(((indicados as any[]).filter((r: any) => r.status === "convertido" || r.status === "ativo").length / (indicados as any[]).length) * 100)
                : 0}%
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {(indicados as any[]).filter((r: any) => r.status === "convertido" || r.status === "ativo").length} de {(indicados as any[]).length} indicados convertidos
          </p>
        </div>
      </div>
    </div>
  );
}
