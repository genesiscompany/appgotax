import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth";

interface Material {
  id: number; tipo: "video" | "pdf"; titulo: string; descricao: string | null; youtube_id: string | null;
  arquivo_url: string | null; arquivo_nome: string | null; categoria: string; ordem: number; ativo: boolean;
}
type Form = { titulo: string; youtube_url: string; categoria: string; descricao: string; ordem: string };
const EMPTY: Form = { titulo: "", youtube_url: "", categoria: "", descricao: "", ordem: "0" };
const ERROS: Record<string, string> = {
  titulo_obrigatorio: "Informe o título.",
  link_youtube_invalido: "Link do YouTube inválido.",
  pdf_invalido: "Escolha um arquivo PDF válido.",
  pdf_muito_grande: "O PDF passa de 10 MB.",
};
const input = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary";

export default function Videos() {
  const { token } = useAuth();
  const [itens, setItens] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipo, setTipo] = useState<"video" | "pdf">("video");
  const [form, setForm] = useState<Form>(EMPTY);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [saving, setSaving] = useState(false);
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/videos", { headers });
      if (res.ok) setItens(await res.json());
    } catch {}
    setLoading(false);
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const categorias = Array.from(new Set(itens.map(v => v.categoria)));

  const limpar = () => {
    setEditId(null); setForm(EMPTY); setArquivo(null); setErro("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const salvar = async () => {
    setErro("");
    if (tipo === "pdf" && !editId) {
      if (!arquivo) { setErro("Escolha o arquivo PDF."); return; }
      if (arquivo.size > 10 * 1024 * 1024) { setErro(ERROS.pdf_muito_grande); return; }
    }
    setSaving(true);
    try {
      let res: Response;
      if (tipo === "pdf" && !editId) {
        const fd = new FormData();
        fd.append("titulo", form.titulo); fd.append("categoria", form.categoria);
        fd.append("descricao", form.descricao); fd.append("ordem", String(Number(form.ordem) || 0));
        fd.append("arquivo", arquivo as File);
        res = await fetch("/api/admin/videos/pdf", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      } else {
        res = await fetch(editId ? `/api/admin/videos/${editId}` : "/api/admin/videos", {
          method: editId ? "PUT" : "POST", headers,
          body: JSON.stringify({ ...form, ordem: Number(form.ordem) || 0 }),
        });
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setErro(ERROS[body?.error] ?? (res.status === 404
          ? "Não foi possível salvar: a API ainda não tem esta função (faça o deploy da api)."
          : `Não foi possível salvar (${body?.error ?? `erro ${res.status}`}).`));
      } else { limpar(); await load(); }
    } catch { setErro("Não foi possível salvar: sem conexão com a API."); }
    setSaving(false);
  };

  const editar = (v: Material) => {
    setEditId(v.id); setErro(""); setTipo(v.tipo); setArquivo(null);
    setForm({ titulo: v.titulo, youtube_url: v.youtube_id ? `https://youtu.be/${v.youtube_id}` : "", categoria: v.categoria, descricao: v.descricao ?? "", ordem: String(v.ordem) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const toggle = async (v: Material) => {
    await fetch(`/api/admin/videos/${v.id}`, { method: "PUT", headers, body: JSON.stringify({ ativo: !v.ativo }) }).catch(() => null);
    await load();
  };
  const excluir = async (v: Material) => {
    if (!confirm(`Excluir "${v.titulo}"?`)) return;
    await fetch(`/api/admin/videos/${v.id}`, { method: "DELETE", headers }).catch(() => null);
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Vídeos e Folhetos de Treinamento</h1>
        <p className="text-sm text-muted-foreground mt-1">Vídeos do YouTube e folhetos em PDF exibidos no Hub de Afiliados (página Treinamento), separados por categoria.</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-foreground text-sm mr-2">{editId ? "Editar" : "Novo"}</p>
          {(["video", "pdf"] as const).map(t => (
            <button key={t} disabled={!!editId} onClick={() => { setTipo(t); setErro(""); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold disabled:opacity-60 ${tipo === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
              {t === "video" ? "🎬 Vídeo do YouTube" : "📄 Folheto PDF"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className={input} placeholder="Título" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} />
          {tipo === "video" ? (
            <input className={input} placeholder="Link do YouTube (https://youtu.be/...)" value={form.youtube_url} onChange={e => setForm({ ...form, youtube_url: e.target.value })} />
          ) : editId ? (
            <p className="text-xs text-muted-foreground self-center">Para trocar o arquivo, exclua e envie de novo.</p>
          ) : (
            <input ref={fileRef} className={input} type="file" accept="application/pdf,.pdf" onChange={e => setArquivo(e.target.files?.[0] ?? null)} />
          )}
          <input className={input} list="video-categorias" placeholder="Categoria (ex.: Convidar empresas)" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} />
          <datalist id="video-categorias">{categorias.map(c => <option key={c} value={c} />)}</datalist>
          <input className={input} type="number" placeholder="Ordem" value={form.ordem} onChange={e => setForm({ ...form, ordem: e.target.value })} />
        </div>
        <textarea className={input} rows={2} placeholder="Descrição (opcional)" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
        {tipo === "pdf" && !editId && <p className="text-xs text-muted-foreground">Somente PDF, até 10 MB.</p>}
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        <div className="flex gap-2">
          <button onClick={salvar} disabled={saving} className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-primary/90">
            {saving ? "Salvando..." : editId ? "Salvar alterações" : tipo === "pdf" ? "Enviar folheto" : "Adicionar vídeo"}
          </button>
          {editId && <button onClick={limpar} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted">Cancelar</button>}
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Carregando...</p>
        : itens.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum vídeo ou folheto cadastrado.</p>
        : categorias.map(c => (
          <section key={c} className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{c}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {itens.filter(v => v.categoria === c).map(v => (
                <div key={v.id} className={`bg-card border border-border rounded-xl overflow-hidden ${v.ativo ? "" : "opacity-50"}`}>
                  {v.tipo === "pdf" ? (
                    <a href={v.arquivo_url ?? "#"} target="_blank" rel="noreferrer" className="w-full aspect-video bg-muted flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground">
                      <span className="text-4xl">📄</span>
                      <span className="text-xs truncate max-w-[90%]">{v.arquivo_nome ?? "Folheto PDF"}</span>
                    </a>
                  ) : (
                    <img src={`https://img.youtube.com/vi/${v.youtube_id}/hqdefault.jpg`} alt={v.titulo} className="w-full aspect-video object-cover bg-black" />
                  )}
                  <div className="p-3 space-y-2">
                    <p className="font-semibold text-sm text-foreground">{v.titulo}</p>
                    <p className="text-xs text-muted-foreground">{v.tipo === "pdf" ? "Folheto PDF" : "Vídeo"} · Ordem {v.ordem} · {v.ativo ? "Visível" : "Oculto"}</p>
                    <div className="flex gap-2">
                      <button onClick={() => editar(v)} className="text-xs px-3 py-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">Editar</button>
                      <button onClick={() => toggle(v)} className="text-xs px-3 py-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">{v.ativo ? "Ocultar" : "Mostrar"}</button>
                      <button onClick={() => excluir(v)} className="text-xs px-3 py-1.5 rounded-lg hover:bg-destructive/10 text-destructive">Excluir</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}
