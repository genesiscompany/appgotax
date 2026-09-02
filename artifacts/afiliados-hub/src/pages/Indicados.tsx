import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, formatBRL, formatDate } from "@/lib/api";
import { Users, Smartphone, Monitor, Globe, Filter } from "lucide-react";

const statusColors: Record<string, string> = {
  pendente: "bg-yellow-100 text-yellow-700",
  ativo: "bg-green-100 text-green-700",
  qualificado: "bg-blue-100 text-blue-700",
  inativo: "bg-gray-100 text-gray-500",
  convertido: "bg-purple-100 text-purple-600",
};

const deviceIcon = (tipo: string) => {
  if (tipo === "android" || tipo === "ios") return <Smartphone size={14} />;
  if (tipo === "pdv") return <Monitor size={14} />;
  return <Globe size={14} />;
};

const TIPOS = [
  { id: "todos", label: "Todos" },
  { id: "usuario", label: "Usuário" },
  { id: "motorista", label: "Motorista" },
  { id: "empresa", label: "Empresa" },
];

const DISPOSITIVOS = [
  { id: "todos", label: "Todos" },
  { id: "android", label: "Android" },
  { id: "ios", label: "iPhone" },
  { id: "pdv", label: "PDV" },
];

export default function Indicados() {
  const { data = [], isLoading } = useQuery({ queryKey: ["indicados"], queryFn: api.indicados });
  const [filtrTipo, setFiltrTipo] = useState("todos");
  const [filtrDisp, setFiltrDisp] = useState("todos");
  const [busca, setBusca] = useState(""); 

  const lista = useMemo(() => {
    let rows = data as any[];
    if (filtrTipo !== "todos") rows = rows.filter(r => (r.tipo_indicado || "usuario") === filtrTipo);
    if (filtrDisp !== "todos") rows = rows.filter(r => (r.tipo_dispositivo || "") === filtrDisp);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      rows = rows.filter(r =>
        (r.nome_indicado || "").toLowerCase().includes(q) ||
        (r.email_indicado || "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [data, filtrTipo, filtrDisp, busca]);

  const totalComissao = lista.reduce((s: number, r: any) => s + Number(r.total_comissao ?? 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meus Indicados</h1>
          <p className="text-gray-500 text-sm mt-1">Pessoas que se cadastraram usando seu link</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">{(data as any[]).length}</p>
          <p className="text-xs text-gray-500">indicados</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <span className="text-xs font-medium text-gray-500">Filtros</span>
        </div>

        <div>
          <p className="text-xs text-gray-400 mb-1.5">Tipo de indicado</p>
          <div className="flex flex-wrap gap-2">
            {TIPOS.map(f => (
              <button
                key={f.id}
                onClick={() => setFiltrTipo(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filtrTipo === f.id
                    ? "bg-[hsl(var(--primary))] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-400 mb-1.5">Dispositivo</p>
          <div className="flex flex-wrap gap-2">
            {DISPOSITIVOS.map(f => (
              <button
                key={f.id}
                onClick={() => setFiltrDisp(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filtrDisp === f.id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <input
          type="text"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome ou e-mail..."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
        />
      </div>

      {lista.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
          <div className="inline-flex p-4 bg-gray-100 rounded-full mb-4">
            <Users size={28} className="text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-700 mb-1">
            {(data as any[]).length === 0 ? "Nenhum indicado ainda" : "Nenhum resultado"}
          </h3>
          <p className="text-sm text-gray-500">
            {(data as any[]).length === 0
              ? "Compartilhe seu link e comece a ganhar comissões!"
              : "Tente outros filtros acima"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3.5 font-medium text-gray-600">Nome</th>
                  <th className="text-left px-5 py-3.5 font-medium text-gray-600">Tipo</th>
                  <th className="text-left px-5 py-3.5 font-medium text-gray-600">Dispositivo</th>
                  <th className="text-left px-5 py-3.5 font-medium text-gray-600">Status</th>
                  <th className="text-right px-5 py-3.5 font-medium text-gray-600">Comissão</th>
                  <th className="text-right px-5 py-3.5 font-medium text-gray-600">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lista.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-medium text-gray-900">{r.nome_indicado || "—"}</div>
                      {r.email_indicado && <div className="text-xs text-gray-400">{r.email_indicado}</div>}
                    </td>
                    <td className="px-5 py-4 text-gray-600 capitalize">{r.tipo_indicado || "usuário"}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 text-gray-500">
                        {deviceIcon(r.tipo_dispositivo)}
                        <span className="capitalize">{r.tipo_dispositivo || "web"}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[r.status] || "bg-gray-100 text-gray-500"}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-medium text-green-600">
                      {Number(r.total_comissao ?? 0) > 0 ? formatBRL(r.total_comissao) : "—"}
                    </td>
                    <td className="px-5 py-4 text-right text-gray-400">{formatDate(r.criado_em)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>{lista.length} de {(data as any[]).length} indicado(s)</span>
            {totalComissao > 0 && (
              <span className="font-medium text-green-600">Comissão total: {formatBRL(totalComissao)}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
