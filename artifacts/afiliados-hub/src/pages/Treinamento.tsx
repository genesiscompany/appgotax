import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PlayCircle } from "lucide-react";

type Video = { id: number; titulo: string; descricao: string | null; youtube_id: string; categoria: string; ordem: number };

export default function Treinamento() {
  const { data = [], isLoading, error } = useQuery<Video[]>({ queryKey: ["videos"], queryFn: api.videos });
  const [categoria, setCategoria] = useState("todas");

  const categorias = useMemo(() => Array.from(new Set(data.map(v => v.categoria))), [data]);
  const grupos = useMemo(() => {
    const visiveis = categoria === "todas" ? categorias : categorias.filter(c => c === categoria);
    return visiveis.map(c => ({ categoria: c, videos: data.filter(v => v.categoria === c) }));
  }, [data, categorias, categoria]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Treinamento</h1>
        <p className="text-sm text-gray-500 mt-1">Vídeos para ajudar você a convidar empresas, usuários e motoristas para a GoTaxi.</p>
      </div>

      {categorias.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {["todas", ...categorias].map(c => (
            <button
              key={c}
              onClick={() => setCategoria(c)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                categoria === c ? "bg-[hsl(var(--primary))] text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100"
              }`}
            >
              {c === "todas" ? "Todas" : c}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500">Carregando vídeos...</p>
      ) : error ? (
        <p className="text-sm text-red-600">Não foi possível carregar os vídeos.</p>
      ) : data.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <PlayCircle className="mx-auto text-gray-300" size={40} />
          <p className="text-sm text-gray-500 mt-2">Nenhum vídeo disponível ainda.</p>
        </div>
      ) : (
        grupos.map(g => (
          <section key={g.categoria} className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">{g.categoria}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {g.videos.map(v => (
                <div key={v.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="aspect-video bg-black">
                    <iframe
                      className="w-full h-full"
                      src={`https://www.youtube-nocookie.com/embed/${v.youtube_id}?rel=0`}
                      title={v.titulo}
                      loading="lazy"
                      allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                      allowFullScreen
                    />
                  </div>
                  <div className="p-4">
                    <p className="font-semibold text-gray-900 text-sm">{v.titulo}</p>
                    {v.descricao && <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">{v.descricao}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
