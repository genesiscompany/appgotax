import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, formatBRL } from "@/lib/api";
import { Receipt, ChevronDown, ChevronUp } from "lucide-react";

const CAT: Record<string, string> = { combustivel: "Combustível", manutencao: "Manutenção", outras: "Outras despesas" };
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const brData = (s: string) => s.split("-").reverse().join("/");

function Detalhe({ id, de, ate }: { id: number; de: string; ate: string }) {
  const { data, isLoading } = useQuery({ queryKey: ["fin-ind", id, de, ate], queryFn: () => api.financeiroIndicado(id, de, ate) });
  if (isLoading) return <p className="text-sm text-gray-400 px-4 pb-4">Carregando despesas...</p>;
  const lista = (data?.lista_despesas ?? []) as any[];
  if (!lista.length) return <p className="text-sm text-gray-400 px-4 pb-4">Nenhuma despesa lançada no período.</p>;
  return (
    <div className="px-4 pb-4">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-gray-400 text-xs"><th className="py-1">Data</th><th>Categoria</th><th>Observação</th><th className="text-right">Valor</th></tr></thead>
        <tbody>
          {lista.map(d => (
            <tr key={d.id} className="border-t border-gray-100">
              <td className="py-1.5">{brData(d.data)}</td><td>{CAT[d.categoria] ?? d.categoria}</td>
              <td className="text-gray-500">{d.descricao ?? "—"}</td><td className="text-right text-red-600">− {formatBRL(d.valor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Financeiro() {
  const hoje = new Date();
  const [de, setDe] = useState(iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)));
  const [ate, setAte] = useState(iso(hoje));
  const [aberto, setAberto] = useState<number | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ["fin-indicados", de, ate], queryFn: () => api.financeiroIndicados(de, ate) });
  const lista = (data?.profissionais ?? []) as any[];
  const soma = (k: string) => lista.reduce((s, p) => s + Number(k === "despesas" ? p.despesas.total : p[k]), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financeiro dos indicados</h1>
          <p className="text-gray-500 text-sm mt-1">Ganho líquido, despesas e lucro dos motoristas e boys que você indicou</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={de} max={ate} onChange={e => e.target.value && setDe(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5" />
          <span className="text-gray-400">até</span>
          <input type="date" value={ate} min={de} onChange={e => e.target.value && setAte(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[["Ganho líquido", soma("ganho_liquido"), "text-gray-900"], ["Despesas", soma("despesas"), "text-red-600"], ["Lucro", soma("lucro"), "text-green-600"]].map(([t, v, c]) => (
          <div key={t as string} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500">{t as string}</p>
            <p className={`text-2xl font-bold ${c}`}>{formatBRL(v as number)}</p>
          </div>
        ))}
      </div>

      {isLoading ? <p className="text-sm text-gray-400">Carregando...</p>
        : error ? <p className="text-sm text-red-600">Não foi possível carregar o financeiro.</p>
        : !lista.length ? (
          <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center text-gray-400">
            <Receipt className="mx-auto mb-2" /> Nenhum motorista ou boy indicado por você.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
            {lista.map(p => (
              <div key={p.id}>
                <button onClick={() => setAberto(aberto === p.id ? null : p.id)} className="w-full text-left p-4 hover:bg-gray-50 grid grid-cols-2 md:grid-cols-6 gap-2 items-center text-sm">
                  <div className="col-span-2">
                    <p className="font-semibold text-gray-900">{p.nome}</p>
                    <p className="text-xs text-gray-400">{p.tipo_profissional === "motorista" ? "Motorista" : "Boy / entregador"} · {p.servicos} serviço(s)</p>
                  </div>
                  <div><p className="text-xs text-gray-400">Ganho líquido</p>{formatBRL(p.ganho_liquido)}</div>
                  <div><p className="text-xs text-gray-400">Combustível</p>{formatBRL(p.despesas.combustivel)}</div>
                  <div><p className="text-xs text-gray-400">Manut. + outras</p>{formatBRL(p.despesas.manutencao + p.despesas.outras)}</div>
                  <div className="flex items-center justify-between">
                    <div><p className="text-xs text-gray-400">Lucro</p><span className={p.lucro < 0 ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>{formatBRL(p.lucro)}</span></div>
                    {aberto === p.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </button>
                {aberto === p.id && <Detalhe id={p.id} de={de} ate={ate} />}
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
