import { useQuery } from "@tanstack/react-query";
import { api, formatBRL, formatDate } from "@/lib/api";
import { Wallet } from "lucide-react";

const statusColors: Record<string, string> = {
  pendente: "bg-yellow-100 text-yellow-700",
  processando: "bg-blue-100 text-blue-700",
  pago: "bg-green-100 text-green-700",
  cancelado: "bg-red-100 text-red-600",
};

export default function Resgates() {
  const { data = [], isLoading } = useQuery({ queryKey: ["resgates"], queryFn: api.resgates });

  const totalPago = (data as any[]).filter(r => r.status === "pago").reduce((s: number, r: any) => s + Number(r.valor), 0);

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
        <h1 className="text-2xl font-bold text-gray-900">Saques</h1>
        <p className="text-gray-500 text-sm mt-1">Histórico das suas solicitações de saque</p>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <p className="text-xs text-gray-500 mb-1">Total já sacado</p>
        <p className="text-2xl font-bold text-green-600">{formatBRL(totalPago)}</p>
      </div>

      {data.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
          <div className="inline-flex p-4 bg-gray-100 rounded-full mb-4">
            <Wallet size={28} className="text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-700 mb-1">Nenhum saque ainda</h3>
          <p className="text-sm text-gray-500">Seus saques aparecerão aqui após solicitá-los no Dashboard</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-right px-5 py-3.5 font-medium text-gray-600">Valor</th>
                  <th className="text-left px-5 py-3.5 font-medium text-gray-600">Chave Pix</th>
                  <th className="text-left px-5 py-3.5 font-medium text-gray-600">Status</th>
                  <th className="text-right px-5 py-3.5 font-medium text-gray-600">Solicitado em</th>
                  <th className="text-right px-5 py-3.5 font-medium text-gray-600">Processado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(data as any[]).map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4 text-right font-bold text-gray-900">{formatBRL(r.valor)}</td>
                    <td className="px-5 py-4 text-gray-600 font-mono text-xs">{r.chave_pix || "—"}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[r.status] || "bg-gray-100 text-gray-500"}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-gray-400">{formatDate(r.criado_em)}</td>
                    <td className="px-5 py-4 text-right text-gray-400">{formatDate(r.processado_em)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
            {data.length} saque(s) registrado(s)
          </div>
        </div>
      )}
    </div>
  );
}
