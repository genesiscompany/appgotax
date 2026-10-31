import { useCallback, useEffect, useState } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import { toast } from "sonner";
import { Home, Users, ListChecks, Gift, Settings, LogOut, Plus, Pencil, Trash2, Clock, CheckCircle2, Ban } from "lucide-react";
import Logo from "@/components/Logo";
import Modal from "@/components/Modal";
import CentroForm, { type CentroCampos } from "@/components/CentroForm";
import { api, clearToken, brl, dataBR, cnpjFmt, CATEGORIAS, PRIORIDADES, STATUS_RECUPERANDO, type Centro } from "@/lib/api";

type Me = { centro: Centro; stats: { recuperandos: number; necessidades_abertas: number; itens_a_receber: number; total_recebido: number } };
type Recuperando = {
  id: number; nome: string; idade: number | null; documento: string | null; motivo_internacao: string | null;
  status: string; progressao: string | null; data_entrada: string | null; atualizado_em: string;
};
type Necessidade = {
  id: number; titulo: string; descricao: string | null; categoria: string; quantidade: string | null; prioridade: string;
  status: string; recuperando_id: number | null; recuperando_nome: string | null;
};

const nav = [
  { href: "/painel", label: "Início", icon: Home },
  { href: "/painel/necessidades", label: "Necessidades", icon: ListChecks },
  { href: "/painel/recuperandos", label: "Recuperandos", icon: Users },
  { href: "/painel/doacoes", label: "Doações", icon: Gift },
  { href: "/painel/perfil", label: "Dados do centro", icon: Settings },
];

export default function Painel() {
  const [loc, navigate] = useLocation();
  const [me, setMe] = useState<Me | null>(null);
  const recarregar = useCallback(() => { api.get<Me>("/centro/me").then(setMe).catch((e) => toast.error(e.message)); }, []);
  useEffect(recarregar, [recarregar]);
  const sair = () => { clearToken(); navigate("/entrar"); };

  return (
    <div className="min-h-screen md:flex">
      <aside className="md:w-60 md:min-h-screen bg-gray-900 text-white md:flex md:flex-col">
        <div className="px-5 py-4 border-b border-white/10"><Logo claro /></div>
        <nav className="flex md:flex-col overflow-x-auto md:overflow-visible gap-1 p-2 md:p-3 md:flex-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const ativo = href === "/painel" ? loc === "/painel" : loc.startsWith(href);
            return (
              <Link key={href} href={href} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${ativo ? "bg-sos text-white" : "text-gray-300 hover:bg-white/10"}`}>
                <Icon size={16} />{label}
              </Link>
            );
          })}
          <button onClick={sair} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-red-500/20 md:mt-auto whitespace-nowrap"><LogOut size={16} />Sair</button>
        </nav>
      </aside>
      <main className="flex-1 p-4 sm:p-8 max-w-5xl">
        {me && me.centro.status !== "aprovado" && (
          <div className={`mb-5 rounded-xl p-4 text-sm flex gap-2 ${me.centro.status === "bloqueado" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"}`}>
            {me.centro.status === "bloqueado" ? <Ban size={18} /> : <Clock size={18} />}
            <div>
              {me.centro.status === "bloqueado" ? "Cadastro bloqueado pela GoTaxi." : "Cadastro em análise. Você já pode cadastrar necessidades e recuperandos; eles aparecem no SOS GoTaxi depois da aprovação."}
              {me.centro.motivo_status && <p className="mt-1">Motivo: {me.centro.motivo_status}</p>}
            </div>
          </div>
        )}
        <Switch>
          <Route path="/painel">{me ? <Inicio me={me} /> : <p className="text-gray-500">Carregando…</p>}</Route>
          <Route path="/painel/necessidades"><Necessidades onChange={recarregar} /></Route>
          <Route path="/painel/recuperandos"><Recuperandos onChange={recarregar} /></Route>
          <Route path="/painel/doacoes"><Doacoes /></Route>
          <Route path="/painel/perfil">{me ? <Perfil centro={me.centro} onSaved={recarregar} /> : null}</Route>
        </Switch>
      </main>
    </div>
  );
}

function Titulo({ children, acao }: { children: React.ReactNode; acao?: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3 mb-5"><h1 className="text-2xl font-bold">{children}</h1>{acao}</div>;
}

function Inicio({ me }: { me: Me }) {
  const c = me.centro;
  const cards = [
    { label: "Recuperandos cadastrados", valor: me.stats.recuperandos, href: "/painel/recuperandos" },
    { label: "Necessidades abertas", valor: me.stats.necessidades_abertas, href: "/painel/necessidades" },
    { label: "Itens a receber", valor: me.stats.itens_a_receber, href: "/painel/doacoes" },
    { label: "Repasses recebidos", valor: brl(me.stats.total_recebido), href: "/painel/doacoes" },
  ];
  return (
    <>
      <Titulo>{c.nome_fantasia || c.razao_social}</Titulo>
      <p className="text-sm text-gray-500 -mt-3 mb-6">CNPJ {cnpjFmt(c.cnpj)} · {c.email}</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((k) => (
          <Link key={k.label} href={k.href} className="card p-4 hover:border-sos/40">
            <p className="text-2xl font-extrabold">{k.valor}</p>
            <p className="text-xs text-gray-500 mt-1">{k.label}</p>
          </Link>
        ))}
      </div>
    </>
  );
}

const vazioNec = { titulo: "", descricao: "", categoria: "alimentos", quantidade: "", prioridade: "media", status: "aberta", recuperando_id: "" };

function Necessidades({ onChange }: { onChange: () => void }) {
  const [lista, setLista] = useState<Necessidade[]>([]);
  const [recs, setRecs] = useState<Recuperando[]>([]);
  const [edit, setEdit] = useState<{ id?: number; v: typeof vazioNec } | null>(null);
  const carregar = () => api.get<Necessidade[]>("/centro/necessidades").then(setLista).catch((e) => toast.error(e.message));
  useEffect(() => { carregar(); api.get<Recuperando[]>("/centro/recuperandos").then(setRecs).catch(() => {}); }, []);

  async function salvar() {
    if (!edit) return;
    try {
      const body = { ...edit.v, recuperando_id: edit.v.recuperando_id || null };
      if (edit.id) await api.put(`/centro/necessidades/${edit.id}`, body); else await api.post("/centro/necessidades", body);
      setEdit(null); carregar(); onChange(); toast.success("Necessidade salva");
    } catch (e: any) { toast.error(e.message); }
  }
  async function alternar(n: Necessidade) {
    await api.put(`/centro/necessidades/${n.id}`, { ...n, status: n.status === "aberta" ? "atendida" : "aberta" }).catch((e) => toast.error(e.message));
    carregar(); onChange();
  }
  async function excluir(n: Necessidade) {
    if (!confirm(`Excluir "${n.titulo}"?`)) return;
    await api.del(`/centro/necessidades/${n.id}`).catch((e) => toast.error(e.message));
    carregar(); onChange();
  }
  const set = (k: keyof typeof vazioNec) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setEdit((s) => (s ? { ...s, v: { ...s.v, [k]: e.target.value } } : s));

  return (
    <>
      <Titulo acao={<button className="btn" onClick={() => setEdit({ v: vazioNec })}><Plus size={16} />Nova</button>}>Necessidades</Titulo>
      <p className="text-sm text-gray-500 -mt-3 mb-5">O que estiver "aberta" aparece no Menu SOS GoTaxi dos apps e PDVs.</p>
      {lista.length === 0 ? <div className="card p-8 text-center text-gray-500">Nenhuma necessidade cadastrada.</div> : (
        <div className="card divide-y divide-gray-100">
          {lista.map((n) => (
            <div key={n.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <p className={`font-semibold ${n.status === "atendida" ? "line-through text-gray-400" : ""}`}>{n.titulo}{n.quantidade ? ` · ${n.quantidade}` : ""}</p>
                <p className="text-xs text-gray-500">{CATEGORIAS[n.categoria]} · {PRIORIDADES[n.prioridade]}{n.recuperando_nome ? ` · ${n.recuperando_nome}` : ""}</p>
              </div>
              <div className="flex gap-2">
                <button className="btn-outline px-3 py-1.5 text-xs" onClick={() => alternar(n)}>{n.status === "aberta" ? <><CheckCircle2 size={14} />Atendida</> : "Reabrir"}</button>
                <button className="btn-outline px-2 py-1.5" aria-label="Editar" onClick={() => setEdit({ id: n.id, v: { titulo: n.titulo, descricao: n.descricao ?? "", categoria: n.categoria, quantidade: n.quantidade ?? "", prioridade: n.prioridade, status: n.status, recuperando_id: n.recuperando_id ? String(n.recuperando_id) : "" } })}><Pencil size={14} /></button>
                <button className="btn-outline px-2 py-1.5 text-red-600" aria-label="Excluir" onClick={() => excluir(n)}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {edit && (
        <Modal titulo={edit.id ? "Editar necessidade" : "Nova necessidade"} onClose={() => setEdit(null)}>
          <div className="space-y-3">
            <div><label className="label">O que vocês precisam? *</label><input className="input" value={edit.v.titulo} onChange={set("titulo")} placeholder="Ex.: Cestas básicas" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Categoria</label><select className="input" value={edit.v.categoria} onChange={set("categoria")}>{Object.entries(CATEGORIAS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
              <div><label className="label">Quantidade</label><input className="input" value={edit.v.quantidade} onChange={set("quantidade")} placeholder="Ex.: 10 unidades" /></div>
              <div><label className="label">Prioridade</label><select className="input" value={edit.v.prioridade} onChange={set("prioridade")}>{Object.entries(PRIORIDADES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
              <div><label className="label">Para um recuperando?</label><select className="input" value={edit.v.recuperando_id} onChange={set("recuperando_id")}><option value="">Para o centro</option>{recs.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}</select></div>
            </div>
            <div><label className="label">Detalhes</label><textarea className="input" rows={3} value={edit.v.descricao} onChange={set("descricao")} /></div>
            <p className="text-xs text-gray-500">No Menu SOS, o recuperando aparece só como "Recuperando #número" e a idade.</p>
            <button className="btn w-full" onClick={salvar}>Salvar</button>
          </div>
        </Modal>
      )}
    </>
  );
}

const vazioRec = { nome: "", idade: "", documento: "", motivo_internacao: "", status: "em_tratamento", progressao: "", data_entrada: "" };

function Recuperandos({ onChange }: { onChange: () => void }) {
  const [lista, setLista] = useState<Recuperando[]>([]);
  const [edit, setEdit] = useState<{ id?: number; v: typeof vazioRec } | null>(null);
  const carregar = () => api.get<Recuperando[]>("/centro/recuperandos").then(setLista).catch((e) => toast.error(e.message));
  useEffect(() => { carregar(); }, []);

  async function salvar() {
    if (!edit) return;
    try {
      if (edit.id) await api.put(`/centro/recuperandos/${edit.id}`, edit.v); else await api.post("/centro/recuperandos", edit.v);
      setEdit(null); carregar(); onChange(); toast.success("Recuperando salvo");
    } catch (e: any) { toast.error(e.message); }
  }
  async function excluir(r: Recuperando) {
    if (!confirm(`Excluir ${r.nome}? Esta ação não pode ser desfeita.`)) return;
    await api.del(`/centro/recuperandos/${r.id}`).catch((e) => toast.error(e.message));
    carregar(); onChange();
  }
  const set = (k: keyof typeof vazioRec) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setEdit((s) => (s ? { ...s, v: { ...s.v, [k]: e.target.value } } : s));

  return (
    <>
      <Titulo acao={<button className="btn" onClick={() => setEdit({ v: vazioRec })}><Plus size={16} />Novo</button>}>Recuperandos</Titulo>
      <p className="text-sm text-gray-500 -mt-3 mb-5">Dados sigilosos: só a sua instituição e a GoTaxi veem esta lista.</p>
      {lista.length === 0 ? <div className="card p-8 text-center text-gray-500">Nenhum recuperando cadastrado.</div> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500 border-b border-gray-100">
              <tr><th className="p-3">Nome</th><th className="p-3">Idade</th><th className="p-3">Status</th><th className="p-3">Entrada</th><th className="p-3">Progressão</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lista.map((r) => (
                <tr key={r.id}>
                  <td className="p-3 font-medium">{r.nome}<p className="text-xs text-gray-400">#{r.id}</p></td>
                  <td className="p-3">{r.idade ?? "—"}</td>
                  <td className="p-3">{STATUS_RECUPERANDO[r.status] ?? r.status}</td>
                  <td className="p-3">{dataBR(r.data_entrada)}</td>
                  <td className="p-3 max-w-xs truncate text-gray-600">{r.progressao || "—"}</td>
                  <td className="p-3 whitespace-nowrap text-right">
                    <button className="btn-outline px-2 py-1.5 mr-1" aria-label="Editar" onClick={() => setEdit({ id: r.id, v: { nome: r.nome, idade: r.idade != null ? String(r.idade) : "", documento: r.documento ?? "", motivo_internacao: r.motivo_internacao ?? "", status: r.status, progressao: r.progressao ?? "", data_entrada: r.data_entrada ? String(r.data_entrada).slice(0, 10) : "" } })}><Pencil size={14} /></button>
                    <button className="btn-outline px-2 py-1.5 text-red-600" aria-label="Excluir" onClick={() => excluir(r)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && (
        <Modal titulo={edit.id ? "Editar recuperando" : "Novo recuperando"} onClose={() => setEdit(null)}>
          <div className="space-y-3">
            <div><label className="label">Nome *</label><input className="input" value={edit.v.nome} onChange={set("nome")} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Idade</label><input className="input" type="number" min={0} value={edit.v.idade} onChange={set("idade")} /></div>
              <div><label className="label">RG/CPF</label><input className="input" inputMode="numeric" value={edit.v.documento} onChange={set("documento")} /></div>
              <div><label className="label">Data de entrada</label><input className="input" type="date" value={edit.v.data_entrada} onChange={set("data_entrada")} /></div>
              <div><label className="label">Status</label><select className="input" value={edit.v.status} onChange={set("status")}>{Object.entries(STATUS_RECUPERANDO).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            </div>
            <div><label className="label">Motivo da internação</label><textarea className="input" rows={2} value={edit.v.motivo_internacao} onChange={set("motivo_internacao")} /></div>
            <div><label className="label">Progressão</label><textarea className="input" rows={4} value={edit.v.progressao} onChange={set("progressao")} placeholder="Evolução do tratamento, etapas concluídas…" /></div>
            <button className="btn w-full" onClick={salvar}>Salvar</button>
          </div>
        </Modal>
      )}
    </>
  );
}

type DoacoesResp = {
  itens: { id: number; descricao: string; doador_nome: string | null; doador_contato: string | null; status: string; criado_em: string; necessidade: string | null }[];
  repasses: { id: number; valor: number; observacao: string | null; criado_em: string }[];
};
const STATUS_ITEM: Record<string, string> = { informada: "A receber", recebida: "Recebida", nao_recebida: "Não recebida", cancelada: "Cancelada", confirmada: "Confirmada" };

function Doacoes() {
  const [d, setD] = useState<DoacoesResp | null>(null);
  const carregar = () => api.get<DoacoesResp>("/centro/doacoes").then(setD).catch((e) => toast.error(e.message));
  useEffect(() => { carregar(); }, []);
  async function marcar(id: number, status: string) {
    await api.patch(`/centro/doacoes/${id}`, { status }).catch((e) => toast.error(e.message));
    carregar();
  }
  if (!d) return <p className="text-gray-500">Carregando…</p>;
  return (
    <>
      <Titulo>Doações</Titulo>
      <h2 className="font-bold mb-2">Itens oferecidos ao centro</h2>
      {d.itens.length === 0 ? <div className="card p-6 text-center text-gray-500 mb-8">Nenhuma doação de itens ainda.</div> : (
        <div className="card divide-y divide-gray-100 mb-8">
          {d.itens.map((i) => (
            <div key={i.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <p className="font-semibold">{i.descricao}</p>
                <p className="text-xs text-gray-500">{dataBR(i.criado_em)} · {i.doador_nome || "Anônimo"}{i.doador_contato ? ` · ${i.doador_contato}` : ""}{i.necessidade ? ` · ${i.necessidade}` : ""}</p>
              </div>
              {i.status === "informada" ? (
                <div className="flex gap-2">
                  <button className="btn px-3 py-1.5 text-xs" onClick={() => marcar(i.id, "recebida")}>Recebi</button>
                  <button className="btn-outline px-3 py-1.5 text-xs" onClick={() => marcar(i.id, "nao_recebida")}>Não recebi</button>
                </div>
              ) : <span className="text-xs font-semibold text-gray-500">{STATUS_ITEM[i.status] ?? i.status}</span>}
            </div>
          ))}
        </div>
      )}
      <h2 className="font-bold mb-2">Repasses em dinheiro da GoTaxi</h2>
      {d.repasses.length === 0 ? <div className="card p-6 text-center text-gray-500">Nenhum repasse ainda.</div> : (
        <div className="card divide-y divide-gray-100">
          {d.repasses.map((r) => (
            <div key={r.id} className="p-4 flex justify-between gap-3">
              <div><p className="font-semibold">{brl(r.valor)}</p>{r.observacao && <p className="text-xs text-gray-500">{r.observacao}</p>}</div>
              <span className="text-sm text-gray-500">{dataBR(r.criado_em)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Perfil({ centro, onSaved }: { centro: Centro; onSaved: () => void }) {
  const [v, setV] = useState<CentroCampos>(centro);
  const [salvando, setSalvando] = useState(false);
  const [senha, setSenha] = useState({ senhaAtual: "", novaSenha: "" });
  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setSalvando(true);
    try { await api.patch("/centro/me", v); toast.success("Dados salvos"); onSaved(); }
    catch (err: any) { toast.error(err.message); } finally { setSalvando(false); }
  }
  async function trocarSenha(e: React.FormEvent) {
    e.preventDefault();
    try { await api.patch("/centro/senha", senha); toast.success("Senha alterada"); setSenha({ senhaAtual: "", novaSenha: "" }); }
    catch (err: any) { toast.error(err.message); }
  }
  return (
    <>
      <Titulo>Dados do centro</Titulo>
      <form onSubmit={salvar} className="card p-5 space-y-5">
        <CentroForm v={{ ...v, cnpj: cnpjFmt(String(v.cnpj ?? "")) }} set={setV} />
        <button className="btn" disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
      </form>
      <form onSubmit={trocarSenha} className="card p-5 mt-5 space-y-3 max-w-md">
        <h2 className="font-bold">Trocar senha</h2>
        <div><label className="label">Senha atual</label><input className="input" type="password" required value={senha.senhaAtual} onChange={(e) => setSenha({ ...senha, senhaAtual: e.target.value })} /></div>
        <div><label className="label">Nova senha</label><input className="input" type="password" required minLength={6} value={senha.novaSenha} onChange={(e) => setSenha({ ...senha, novaSenha: e.target.value })} /></div>
        <button className="btn-outline">Trocar senha</button>
      </form>
    </>
  );
}
