import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, formatBRL, formatDate } from "@/lib/api";
import { DollarSign, Filter } from "lucide-react";

const statusColors: Record<string, string> = {
  pendente: "bg-yellow-100 text-yellow-700",
  aprovado: "bg-green-100 text-green-700",
  pago: "bg-blue-100 text-blue-700",
  cancelado: "bg-red-100 text-red-600",
};

const FILTROS = [
  { id: "todos", label: "Todos" },
  { id: "aprovado", label: "Aprovado" },
  { id: "pendente", label: "Pendente" },
  { id: "pago", label: "Pago" },
  { id: "cancelado", label: "Cancelado" },
];

export default function Comissoes() {
  const { data = [], isLoading } = useQuery({ queryKey: ["comissoes"], queryFn: api.comissoes });
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");

  const lista = useMemo(() => {
    let rows = data as any[];
    if (filtro !== "todos") rows = rows.filter(r => r.status === filtro);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      rows = rows.filter(r =>
        (r.nome_indicado || "").toLowerCase().includes(q) ||
        (r.tipo_evento || "").toLowerCase().includes(q) ||
        (r.descricao || "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [data, filtro, busca]);

  const total = (data as any[]).filter(r => r.status === "aprovado").reduce((s: number, r: any) => s + Number(r.valor_comissao), 0);
  const pendente = (data as any[]).filter(r => r.status === "pendente").reduce((s: number, r: any) => s + Number(r.valor_comissao), 0);
  const totalFiltrado = lista.reduce((s: number, r: any) => s + Number(r.valor_comissao ?? 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Comissões</h1>
        <p className="text-gray-500 text-sm mt-1">Histórico de comissões geradas pelos seus indicados</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Aprovadas</p>
          <p className="text-2xl font-bold text-green-600">{formatBRL(total)}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Em análise</p>
          <p className="text-2xl font-bold text-yellow-600">{formatBRL(pendente)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <span className="text-xs font-medium text-gray-500">Filtrar por status</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTROS.map(f => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filtro === f.id
                  ? "bg-[hsl(var(--primary))] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label}
              {f.id !== "todos" && (
                <span className="ml-1.5 opacity-70">
                  ({(data as any[]).filter(r => r.status === f.id).length})
                </span>
              )}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por indicado, evento ou descrição..."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
        />
      </div>

      {lista.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
          <div className="inline-flex p-4 bg-gray-100 rounded-full mb-4">
            <DollarSign size={28} className="text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-700 mb-1">
            {(data as any[]).length === 0 ? "Nenhuma comissão ainda" : "Nenhuma comissão neste filtro"}
          </h3>
          <p className="text-sm text-gray-500">
            {(data as any[]).length === 0
              ? "As comissões aparecem quando seus indicados geram receita para o GoTaxi"
              : "Tente mudar os filtros acima"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3.5 font-medium text-gray-600">Indicado</th>
                  <th className="text-left px-5 py-3.5 font-medium text-gray-600">Evento</th>
                  <th className="text-right px-5 py-3.5 font-medium text-gray-600">Transação</th>
                  <th className="text-right px-5 py-3.5 font-medium text-gray-600">%</th>
                  <th className="text-right px-5 py-3.5 font-medium text-gray-600">Comissão</th>
                  <th className="text-left px-5 py-3.5 font-medium text-gray-600">Status</th>
                  <th className="text-right px-5 py-3.5 font-medium text-gray-600">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lista.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4 text-gray-900">{r.nome_indicado || "—"}</td>
                    <td className="px-5 py-4 text-gray-600 capitalize">{r.tipo_evento?.replace(/_/g, " ") || "—"}</td>
                    <td className="px-5 py-4 text-right text-gray-600">{formatBRL(r.valor_transacao)}</td>
                    <td className="px-5 py-4 text-right text-gray-500">{r.percentual}%</td>
                    <td className="px-5 py-4 text-right font-semibold text-green-600">{formatBRL(r.valor_comissao)}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[r.status] || "bg-gray-100 text-gray-500"}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-gray-400">{formatDate(r.criado_em)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>{lista.length} de {(data as any[]).length} registro(s)</span>
            {filtro !== "todos" && (
              <span className="font-medium text-gray-700">Total: {formatBRL(totalFiltrado)}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
