import React, { useEffect, useState } from "react";
import { useAuth, API, authHeaders } from "@/lib/auth";

type Categoria = {
  id: number; nome: string; taxa_minima: number;
  taxa_por_km: number; dist_chamada_km: number;
};

type Modelo = {
  id: number; nome: string; ano_minimo: number;
  categorias: { id: number; nome: string }[];
};

function CategoriaModal({
  cat, onClose, onSave,
}: { cat: Partial<Categoria> | null; onClose: () => void; onSave: (d: any) => void }) {
  const [form, setForm] = useState({
    nome: cat?.nome || "",
    taxa_minima: String(cat?.taxa_minima ?? 5),
    taxa_por_km: String(cat?.taxa_por_km ?? 2.5),
    dist_chamada_km: String(cat?.dist_chamada_km ?? 5),
  });
  const isEdit = !!cat?.id;

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-foreground">{isEdit ? "Editar Categoria" : "Nova Categoria"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nome da Categoria</label>
            <input className="mt-1 w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Ex: GoTaxi Black" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Taxa Mínima (R$)</label>
              <input type="number" step="0.5" className="mt-1 w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={form.taxa_minima} onChange={e => setForm(p => ({ ...p, taxa_minima: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Taxa por KM (R$)</label>
              <input type="number" step="0.1" className="mt-1 w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={form.taxa_por_km} onChange={e => setForm(p => ({ ...p, taxa_por_km: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Distância de Chamada (KM)</label>
            <input type="number" step="1" className="mt-1 w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={form.dist_chamada_km} onChange={e => setForm(p => ({ ...p, dist_chamada_km: e.target.value }))} />
          </div>
        </div>

        <button
          onClick={() => { if (form.nome.trim()) onSave({ ...cat, ...form, taxa_minima: Number(form.taxa_minima), taxa_por_km: Number(form.taxa_por_km), dist_chamada_km: Number(form.dist_chamada_km) }); }}
          disabled={!form.nome.trim()}
          className="mt-6 w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 hover:bg-primary/90 transition-colors">
          {isEdit ? "Salvar Alterações" : "Criar Categoria"}
        </button>
      </div>
    </div>
  );
}

function ModeloModal({
  modelo, categorias, onClose, onSave,
}: { modelo: Partial<Modelo> | null; categorias: Categoria[]; onClose: () => void; onSave: (d: any) => void }) {
  const [nome, setNome] = useState(modelo?.nome || "");
  const [anoMin, setAnoMin] = useState(String(modelo?.ano_minimo || new Date().getFullYear() - 10));
  const [selectedCats, setSelectedCats] = useState<number[]>(modelo?.categorias?.map(c => c.id) || []);
  const isEdit = !!modelo?.id;

  const toggleCat = (id: number) =>
    setSelectedCats(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-foreground">{isEdit ? "Editar Modelo" : "Novo Modelo de Carro"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nome do Modelo</label>
            <input className="mt-1 w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Ex: Toyota Corolla" value={nome} onChange={e => setNome(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ano Mínimo de Fabricação</label>
            <input type="number" className="mt-1 w-full bg-secondary border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={anoMin} onChange={e => setAnoMin(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Categorias Permitidas</label>
            {categorias.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma categoria criada ainda.</p>
            ) : (
              <div className="space-y-2">
                {categorias.map(cat => (
                  <button key={cat.id} onClick={() => toggleCat(cat.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left ${
                      selectedCats.includes(cat.id)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary text-foreground hover:bg-accent"
                    }`}>
                    <div className={`w-5 h-5 rounded flex items-center justify-center border-2 shrink-0 ${
                      selectedCats.includes(cat.id) ? "border-primary bg-primary" : "border-muted-foreground"
                    }`}>
                      {selectedCats.includes(cat.id) && (
                        <svg className="w-3 h-3 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                    </div>
                    <span className="text-sm font-semibold">{cat.nome}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => { if (nome.trim()) onSave({ ...modelo, nome, ano_minimo: Number(anoMin), categoria_ids: selectedCats }); }}
          disabled={!nome.trim()}
          className="mt-6 w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50 hover:bg-primary/90 transition-colors">
          {isEdit ? "Salvar Modelo" : "Salvar Modelo"}
        </button>
      </div>
    </div>
  );
}

export default function CategoriasMotorista() {
  const { token } = useAuth();
  const [tab, setTab] = useState<"categorias" | "modelos">("categorias");
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editCat, setEditCat] = useState<Partial<Categoria> | null | false>(false);
  const [editModelo, setEditModelo] = useState<Partial<Modelo> | null | false>(false);
  const [salvando, setSalvando] = useState(false);

  const loadCategorias = async () => {
    const r = await fetch(`${API}/categorias-corrida`, { headers: authHeaders(token) });
    if (r.ok) setCategorias(await r.json());
  };
  const loadModelos = async () => {
    const r = await fetch(`${API}/modelos-veiculo`, { headers: authHeaders(token) });
    if (r.ok) setModelos(await r.json());
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadCategorias(), loadModelos()]).finally(() => setLoading(false));
  }, [token]);

  const handleSaveCat = async (data: any) => {
    setSalvando(true);
    const isEdit = !!data.id;
    const url = isEdit ? `${API}/categorias-corrida/${data.id}` : `${API}/categorias-corrida`;
    const method = isEdit ? "PUT" : "POST";
    const r = await fetch(url, { method, headers: { ...authHeaders(token), "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (r.ok) { await loadCategorias(); setEditCat(false); }
    else { const e = await r.json(); alert(e.error || "Erro ao salvar"); }
    setSalvando(false);
  };

  const handleDeleteCat = async (id: number) => {
    if (!confirm("Excluir esta categoria?")) return;
    await fetch(`${API}/categorias-corrida/${id}`, { method: "DELETE", headers: authHeaders(token) });
    await loadCategorias();
    await loadModelos();
  };

  const handleSaveModelo = async (data: any) => {
    setSalvando(true);
    const isEdit = !!data.id;
    const url = isEdit ? `${API}/modelos-veiculo/${data.id}` : `${API}/modelos-veiculo`;
    const method = isEdit ? "PUT" : "POST";
    const r = await fetch(url, { method, headers: { ...authHeaders(token), "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (r.ok) { await loadModelos(); setEditModelo(false); }
    else { const e = await r.json(); alert(e.error || "Erro ao salvar"); }
    setSalvando(false);
  };

  const handleDeleteModelo = async (id: number) => {
    if (!confirm("Excluir este modelo?")) return;
    await fetch(`${API}/modelos-veiculo/${id}`, { method: "DELETE", headers: authHeaders(token) });
    await loadModelos();
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">🚗 Categorias de Corrida</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure as categorias de serviço e defina quais modelos de carro se enquadram em cada uma.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl w-fit">
        <button onClick={() => setTab("categorias")}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab === "categorias" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          Categorias e Tarifas
        </button>
        <button onClick={() => setTab("modelos")}
          className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab === "modelos" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          Elegibilidade por Modelo
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground gap-3">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Carregando...
        </div>
      ) : tab === "categorias" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{categorias.length} categorias cadastradas</p>
            <button onClick={() => setEditCat({})}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Adicionar Categoria
            </button>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Categoria</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Taxa Mínima (R$)</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Taxa por KM (R$)</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Dist. Chamada (KM)</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {categorias.map(cat => (
                  <tr key={cat.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-4">
                      <span className="text-sm font-bold text-foreground">{cat.nome}</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="text-sm font-semibold text-foreground">{Number(cat.taxa_minima).toFixed(2)}</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="text-sm font-semibold text-foreground">{Number(cat.taxa_por_km).toFixed(2)}</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="text-sm font-semibold text-foreground">{Number(cat.dist_chamada_km).toFixed(0)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => setEditCat(cat)}
                          className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground" title="Editar">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button onClick={() => handleDeleteCat(cat.id)}
                          className="p-2 rounded-lg hover:bg-red-500/15 transition-colors text-muted-foreground hover:text-red-400" title="Excluir">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {categorias.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-12 text-center text-muted-foreground text-sm">
                    Nenhuma categoria cadastrada. Crie a primeira categoria clicando em "Adicionar Categoria".
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{modelos.length} modelos cadastrados</p>
            <button onClick={() => setEditModelo({})}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Adicionar Modelo
            </button>
          </div>

          {categorias.length === 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-sm text-yellow-400">
              ⚠️ Crie pelo menos uma categoria na aba "Categorias e Tarifas" antes de adicionar modelos de carro.
            </div>
          )}

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Modelo</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Ano Mínimo</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Categorias Permitidas</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {modelos.map(mod => (
                  <tr key={mod.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-4">
                      <span className="text-sm font-bold text-foreground">{mod.nome}</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="text-sm text-foreground/70">{mod.ano_minimo}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {mod.categorias?.length > 0 ? mod.categorias.map(c => (
                          <span key={c.id} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/15 text-primary border border-primary/20">
                            {c.nome}
                          </span>
                        )) : <span className="text-xs text-muted-foreground/50">—</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => setEditModelo(mod)}
                          className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground" title="Editar">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button onClick={() => handleDeleteModelo(mod.id)}
                          className="p-2 rounded-lg hover:bg-red-500/15 transition-colors text-muted-foreground hover:text-red-400" title="Excluir">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {modelos.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-12 text-center text-muted-foreground text-sm">
                    Nenhum modelo cadastrado ainda.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editCat !== false && (
        <CategoriaModal cat={editCat} onClose={() => setEditCat(false)} onSave={handleSaveCat} />
      )}
      {editModelo !== false && (
        <ModeloModal modelo={editModelo} categorias={categorias} onClose={() => setEditModelo(false)} onSave={handleSaveModelo} />
      )}
    </div>
  );
}
