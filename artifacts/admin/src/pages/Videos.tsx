import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";

interface Video { id: number; titulo: string; descricao: string | null; youtube_id: string; categoria: string; ordem: number; ativo: boolean }
type Form = { titulo: string; youtube_url: string; categoria: string; descricao: string; ordem: string };
const EMPTY: Form = { titulo: "", youtube_url: "", categoria: "", descricao: "", ordem: "0" };
const ERROS: Record<string, string> = { titulo_obrigatorio: "Informe o título.", link_youtube_invalido: "Link do YouTube inválido." };
const input = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary";

export default function Videos() {
  const { token } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form>(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [erro, setErro] = useState("");
  const [saving, setSaving] = useState(false);
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/videos", { headers });
      if (res.ok) setVideos(await res.json());
    } catch {}
    setLoading(false);
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const categorias = Array.from(new Set(videos.map(v => v.categoria)));

  const salvar = async () => {
    setErro(""); setSaving(true);
    try {
      const res = await fetch(editId ? `/api/admin/videos/${editId}` : "/api/admin/videos", {
        method: editId ? "PUT" : "POST", headers,
        body: JSON.stringify({ ...form, ordem: Number(form.ordem) || 0 }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setErro(ERROS[body?.error] ?? "Não foi possível salvar.");
      } else { setForm(EMPTY); setEditId(null); await load(); }
    } catch { setErro("Não foi possível salvar."); }
    setSaving(false);
  };

  const editar = (v: Video) => {
    setEditId(v.id); setErro("");
    setForm({ titulo: v.titulo, youtube_url: `https://youtu.be/${v.youtube_id}`, categoria: v.categoria, descricao: v.descricao ?? "", ordem: String(v.ordem) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const toggle = async (v: Video) => {
    await fetch(`/api/admin/videos/${v.id}`, { method: "PUT", headers, body: JSON.stringify({ ativo: !v.ativo }) }).catch(() => null);
    await load();
  };
  const excluir = async (v: Video) => {
    if (!confirm(`Excluir o vídeo "${v.titulo}"?`)) return;
    await fetch(`/api/admin/videos/${v.id}`, { method: "DELETE", headers }).catch(() => null);
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Vídeos de Treinamento</h1>
        <p className="text-sm text-muted-foreground mt-1">Vídeos do YouTube exibidos no Hub de Afiliados (página Treinamento), separados por categoria.</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <p className="font-semibold text-foreground text-sm">{editId ? "Editar vídeo" : "Novo vídeo"}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className={input} placeholder="Título" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} />
          <input className={input} placeholder="Link do YouTube (https://youtu.be/...)" value={form.youtube_url} onChange={e => setForm({ ...form, youtube_url: e.target.value })} />
          <input className={input} list="video-categorias" placeholder="Categoria (ex.: Convidar empresas)" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} />
          <datalist id="video-categorias">{categorias.map(c => <option key={c} value={c} />)}</datalist>
          <input className={input} type="number" placeholder="Ordem" value={form.ordem} onChange={e => setForm({ ...form, ordem: e.target.value })} />
        </div>
        <textarea className={input} rows={2} placeholder="Descrição (opcional)" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        <div className="flex gap-2">
          <button onClick={salvar} disabled={saving} className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-primary/90">
            {saving ? "Salvando..." : editId ? "Salvar alterações" : "Adicionar vídeo"}
          </button>
          {editId && <button onClick={() => { setEditId(null); setForm(EMPTY); setErro(""); }} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted">Cancelar</button>}
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Carregando...</p>
        : videos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum vídeo cadastrado.</p>
        : categorias.map(c => (
          <section key={c} className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{c}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {videos.filter(v => v.categoria === c).map(v => (
                <div key={v.id} className={`bg-card border border-border rounded-xl overflow-hidden ${v.ativo ? "" : "opacity-50"}`}>
                  <img src={`https://img.youtube.com/vi/${v.youtube_id}/hqdefault.jpg`} alt={v.titulo} className="w-full aspect-video object-cover bg-black" />
                  <div className="p-3 space-y-2">
                    <p className="font-semibold text-sm text-foreground">{v.titulo}</p>
                    <p className="text-xs text-muted-foreground">Ordem {v.ordem} · {v.ativo ? "Visível" : "Oculto"}</p>
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
