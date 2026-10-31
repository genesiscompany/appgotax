import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

const API = "/api/sos/admin";
const input = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary";
const btn = "px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50";
const btnOutline = "px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted";
const brl = (v: number | null | undefined) => Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const data = (d: string | null | undefined) => (d ? new Date(d).toLocaleString("pt-BR") : "—");
const cnpjFmt = (c: string) => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

type Resumo = { centros_pendentes: number; centros_aprovados: number; recuperandos: number; total_informado: number; total_confirmado: number; total_distribuido: number };
type Centro = {
  id: number; razao_social: string; nome_fantasia: string | null; cnpj: string; endereco: string; cidade: string | null; uf: string | null;
  telefone: string; email: string; descricao: string | null; necessidades: string | null; quantidade_recuperandos: number;
  banco_nome: string | null; banco_agencia: string | null; banco_conta: string | null; banco_tipo_conta: string | null; banco_titular: string | null;
  banco_chave_pix: string | null; status: string; motivo_status: string | null; criado_em: string;
  total_recuperandos_cadastrados?: number; necessidades_abertas?: number; total_distribuido?: number;
};
type Detalhe = {
  centro: Centro;
  recuperandos: { id: number; nome: string; idade: number | null; documento: string | null; motivo_internacao: string | null; status: string; progressao: string | null; data_entrada: string | null }[];
  necessidades: { id: number; titulo: string; categoria: string; quantidade: string | null; prioridade: string; status: string }[];
};
type Doacao = { id: number; tipo: string; valor: number | null; descricao: string | null; doador_nome: string | null; doador_contato: string | null; origem: string; status: string; criado_em: string; centro: string | null; necessidade: string | null };
type Distribuicao = { id: number; centro_id: number; valor: number; observacao: string | null; criado_em: string; centro: string };
type Config = { chave: string; nome: string; cidade: string; texto: string };

const STATUS_CENTRO: Record<string, string> = { pendente: "Pendente", aprovado: "Aprovado", bloqueado: "Bloqueado" };
const COR_CENTRO: Record<string, string> = { pendente: "bg-amber-500/15 text-amber-500", aprovado: "bg-green-500/15 text-green-500", bloqueado: "bg-red-500/15 text-red-500" };
const STATUS_DOACAO: Record<string, string> = { informada: "Informada", confirmada: "Confirmada", cancelada: "Cancelada", recebida: "Recebida", nao_recebida: "Não recebida" };
const ORIGEM: Record<string, string> = { site: "Site", app_cliente: "App cliente", app_pro: "GoTaxi Pro", pdv: "PDV" };

export default function Sos() {
  const { token } = useAuth();
  const [aba, setAba] = useState<"centros" | "doacoes" | "distribuicoes" | "pix">("centros");
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const call = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const r = await fetch(`${API}${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Erro");
    return j as T;
  }, [token]);
  const carregarResumo = useCallback(() => { call<Resumo>("/resumo").then(setResumo).catch(() => {}); }, [call]);
  useEffect(carregarResumo, [carregarResumo]);

  const saldo = resumo ? resumo.total_confirmado - resumo.total_distribuido : 0;
  const cards = resumo ? [
    { l: "Centros pendentes", v: resumo.centros_pendentes },
    { l: "Centros aprovados", v: resumo.centros_aprovados },
    { l: "Recuperandos", v: resumo.recuperandos },
    { l: "Doações informadas", v: brl(resumo.total_informado) },
    { l: "Doações confirmadas", v: brl(resumo.total_confirmado) },
    { l: "Distribuído aos centros", v: brl(resumo.total_distribuido) },
    { l: "Saldo a distribuir", v: brl(saldo) },
  ] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">SOS GoTaxi</h1>
        <p className="text-sm text-muted-foreground">Centros de recuperação, ONGs e institutos · sos.gotaxi.com.br</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        {cards.map((c) => (
          <div key={c.l} className="bg-card border border-border rounded-xl p-3">
            <p className="text-lg font-bold text-foreground">{c.v}</p>
            <p className="text-xs text-muted-foreground">{c.l}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {([["centros", "Centros"], ["doacoes", "Doações"], ["distribuicoes", "Distribuições"], ["pix", "Chave PIX"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setAba(k)} className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap ${aba === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
      </div>
      {aba === "centros" && <Centros call={call} onChange={carregarResumo} />}
      {aba === "doacoes" && <Doacoes call={call} token={token} onChange={carregarResumo} />}
      {aba === "distribuicoes" && <Distribuicoes call={call} onChange={carregarResumo} saldo={saldo} />}
      {aba === "pix" && <ChavePix call={call} headers={headers} />}
    </div>
  );
}

type Call = <T>(path: string, init?: RequestInit) => Promise<T>;

function Centros({ call, onChange }: { call: Call; onChange: () => void }) {
  const [lista, setLista] = useState<Centro[]>([]);
  const [filtro, setFiltro] = useState("");
  const [det, setDet] = useState<Detalhe | null>(null);
  const [erro, setErro] = useState("");
  const carregar = useCallback(() => {
    call<Centro[]>(`/centros${filtro ? `?status=${filtro}` : ""}`).then(setLista).catch((e) => setErro(e.message));
  }, [call, filtro]);
  useEffect(carregar, [carregar]);

  async function mudarStatus(c: Centro, status: string) {
    let motivo: string | null = null;
    if (status === "bloqueado") { motivo = prompt("Motivo do bloqueio (o centro verá esta mensagem):") ; if (motivo === null) return; }
    try {
      await call(`/centros/${c.id}/status`, { method: "PATCH", body: JSON.stringify({ status, motivo }) });
      carregar(); onChange();
      if (det?.centro.id === c.id) abrir(c.id);
    } catch (e: any) { alert(e.message); }
  }
  async function abrir(id: number) {
    try { setDet(await call<Detalhe>(`/centros/${id}`)); } catch (e: any) { alert(e.message); }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <select className={`${input} w-48`} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="">Todos</option>
          {Object.entries(STATUS_CENTRO).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {erro && <span className="text-sm text-red-500">{erro}</span>}
      </div>
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground border-b border-border">
            <tr><th className="p-3">Centro</th><th className="p-3">CNPJ</th><th className="p-3">Cidade</th><th className="p-3">Recuperandos</th><th className="p-3">Necessidades</th><th className="p-3">Distribuído</th><th className="p-3">Status</th><th className="p-3" /></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lista.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhum centro.</td></tr>}
            {lista.map((c) => (
              <tr key={c.id}>
                <td className="p-3"><button className="font-semibold text-foreground hover:text-primary text-left" onClick={() => abrir(c.id)}>{c.nome_fantasia || c.razao_social}</button><p className="text-xs text-muted-foreground">{c.email} · {c.telefone}</p></td>
                <td className="p-3 whitespace-nowrap">{cnpjFmt(c.cnpj)}</td>
                <td className="p-3">{[c.cidade, c.uf].filter(Boolean).join("/") || "—"}</td>
                <td className="p-3">{c.total_recuperandos_cadastrados} / {c.quantidade_recuperandos}</td>
                <td className="p-3">{c.necessidades_abertas}</td>
                <td className="p-3">{brl(c.total_distribuido)}</td>
                <td className="p-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${COR_CENTRO[c.status]}`}>{STATUS_CENTRO[c.status]}</span></td>
                <td className="p-3 whitespace-nowrap text-right space-x-1">
                  {c.status !== "aprovado" && <button className={btnOutline} onClick={() => mudarStatus(c, "aprovado")}>Aprovar</button>}
                  {c.status !== "bloqueado" && <button className={`${btnOutline} text-red-500`} onClick={() => mudarStatus(c, "bloqueado")}>Bloquear</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {det && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setDet(null)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-foreground">{det.centro.razao_social}</h2>
                <p className="text-xs text-muted-foreground">{det.centro.nome_fantasia} · CNPJ {cnpjFmt(det.centro.cnpj)} · cadastrado em {data(det.centro.criado_em)}</p>
              </div>
              <button className={btnOutline} onClick={() => setDet(null)}>Fechar</button>
            </div>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p><b>Endereço:</b> {det.centro.endereco}{det.centro.cidade ? `, ${det.centro.cidade}` : ""}{det.centro.uf ? `/${det.centro.uf}` : ""}</p>
                <p><b>Telefone/WhatsApp:</b> {det.centro.telefone}</p>
                <p><b>E-mail:</b> {det.centro.email}</p>
                <p><b>Recuperandos declarados:</b> {det.centro.quantidade_recuperandos}</p>
                {det.centro.necessidades && <p><b>Necessidades:</b> {det.centro.necessidades}</p>}
                {det.centro.descricao && <p><b>Sobre:</b> {det.centro.descricao}</p>}
              </div>
              <div className="space-y-1 bg-muted/40 rounded-lg p-3">
                <p className="font-semibold">Conta bancária</p>
                <p>Banco: {det.centro.banco_nome || "—"} · {det.centro.banco_tipo_conta || "—"}</p>
                <p>Agência: {det.centro.banco_agencia || "—"} · Conta: {det.centro.banco_conta || "—"}</p>
                <p>Titular: {det.centro.banco_titular || "—"}</p>
                <p>Chave PIX: {det.centro.banco_chave_pix || "—"}</p>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Recuperandos ({det.recuperandos.length}) <span className="text-xs text-muted-foreground font-normal">— dados sigilosos</span></h3>
              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="text-left text-muted-foreground border-b border-border"><tr><th className="p-2">#</th><th className="p-2">Nome</th><th className="p-2">Idade</th><th className="p-2">RG/CPF</th><th className="p-2">Motivo</th><th className="p-2">Status</th><th className="p-2">Progressão</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {det.recuperandos.map((r) => (
                      <tr key={r.id}><td className="p-2">{r.id}</td><td className="p-2">{r.nome}</td><td className="p-2">{r.idade ?? "—"}</td><td className="p-2">{r.documento || "—"}</td><td className="p-2">{r.motivo_internacao || "—"}</td><td className="p-2">{r.status}</td><td className="p-2 max-w-xs">{r.progressao || "—"}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Necessidades ({det.necessidades.length})</h3>
              <ul className="text-sm space-y-1">
                {det.necessidades.map((n) => <li key={n.id}>{n.status === "aberta" ? "•" : "✓"} {n.titulo}{n.quantidade ? ` (${n.quantidade})` : ""} — {n.categoria}, {n.prioridade}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Doacoes({ call, token, onChange }: { call: Call; token: string | null; onChange: () => void }) {
  const [lista, setLista] = useState<Doacao[]>([]);
  const [tipo, setTipo] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const qs = new URLSearchParams({ ...(tipo ? { tipo } : {}), ...(de ? { de } : {}), ...(ate ? { ate } : {}) }).toString();
  const carregar = useCallback(() => { call<Doacao[]>(`/doacoes${qs ? `?${qs}` : ""}`).then(setLista).catch(() => {}); }, [call, qs]);
  useEffect(carregar, [carregar]);

  async function status(d: Doacao, s: string) {
    try { await call(`/doacoes/${d.id}`, { method: "PATCH", body: JSON.stringify({ status: s }) }); carregar(); onChange(); }
    catch (e: any) { alert(e.message); }
  }
  async function exportar() {
    const r = await fetch(`${API}/doacoes.csv${qs ? `?${qs}` : ""}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) { alert("Erro ao exportar"); return; }
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement("a");
    a.href = url; a.download = `sos-doacoes-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }
  const total = lista.filter((d) => d.tipo === "dinheiro" && d.status !== "cancelada").reduce((s, d) => s + (d.valor ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-end">
        <div><label className="text-xs text-muted-foreground">Tipo</label><select className={`${input} w-36`} value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="">Todos</option><option value="dinheiro">Dinheiro</option><option value="item">Itens</option></select></div>
        <div><label className="text-xs text-muted-foreground">De</label><input type="date" className={input} value={de} onChange={(e) => setDe(e.target.value)} /></div>
        <div><label className="text-xs text-muted-foreground">Até</label><input type="date" className={input} value={ate} onChange={(e) => setAte(e.target.value)} /></div>
        <button className={btn} onClick={exportar}>Exportar CSV</button>
        <p className="text-sm text-muted-foreground ml-auto">Total em dinheiro (sem canceladas): <b className="text-foreground">{brl(total)}</b></p>
      </div>
      <p className="text-xs text-muted-foreground">O valor em dinheiro é informado pelo doador. Confira no extrato da conta GoTaxi e marque "Confirmar"; só valores confirmados entram no saldo a distribuir.</p>
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground border-b border-border">
            <tr><th className="p-3">Data</th><th className="p-3">Tipo</th><th className="p-3">Valor / Item</th><th className="p-3">Doador</th><th className="p-3">Centro</th><th className="p-3">Origem</th><th className="p-3">Status</th><th className="p-3" /></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lista.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhuma doação.</td></tr>}
            {lista.map((d) => (
              <tr key={d.id}>
                <td className="p-3 whitespace-nowrap">{data(d.criado_em)}</td>
                <td className="p-3">{d.tipo === "dinheiro" ? "Dinheiro" : "Item"}</td>
                <td className="p-3">{d.tipo === "dinheiro" ? <b>{brl(d.valor)}</b> : d.descricao}{d.necessidade && <p className="text-xs text-muted-foreground">{d.necessidade}</p>}</td>
                <td className="p-3">{d.doador_nome || "Anônimo"}{d.doador_contato && <p className="text-xs text-muted-foreground">{d.doador_contato}</p>}</td>
                <td className="p-3">{d.centro || (d.tipo === "dinheiro" ? "GoTaxi" : "—")}</td>
                <td className="p-3">{ORIGEM[d.origem] ?? d.origem}</td>
                <td className="p-3">{STATUS_DOACAO[d.status] ?? d.status}</td>
                <td className="p-3 whitespace-nowrap text-right space-x-1">
                  {d.tipo === "dinheiro" && d.status === "informada" && <button className={btnOutline} onClick={() => status(d, "confirmada")}>Confirmar</button>}
                  {d.status !== "cancelada" && <button className={`${btnOutline} text-red-500`} onClick={() => status(d, "cancelada")}>Cancelar</button>}
                  {d.status === "cancelada" && <button className={btnOutline} onClick={() => status(d, "informada")}>Reabrir</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Distribuicoes({ call, onChange, saldo }: { call: Call; onChange: () => void; saldo: number }) {
  const [lista, setLista] = useState<Distribuicao[]>([]);
  const [centros, setCentros] = useState<Centro[]>([]);
  const [form, setForm] = useState({ centro_id: "", valor: "", observacao: "" });
  const [salvando, setSalvando] = useState(false);
  const carregar = useCallback(() => { call<Distribuicao[]>("/distribuicoes").then(setLista).catch(() => {}); }, [call]);
  useEffect(() => { carregar(); call<Centro[]>("/centros?status=aprovado").then(setCentros).catch(() => {}); }, [carregar, call]);
  const centroSel = centros.find((c) => String(c.id) === form.centro_id);

  async function registrar() {
    if (!form.centro_id || !form.valor) { alert("Escolha o centro e o valor."); return; }
    setSalvando(true);
    try {
      await call("/distribuicoes", { method: "POST", body: JSON.stringify(form) });
      setForm({ centro_id: "", valor: "", observacao: "" }); carregar(); onChange();
    } catch (e: any) { alert(e.message); } finally { setSalvando(false); }
  }
  async function excluir(d: Distribuicao) {
    if (!confirm(`Excluir o registro de ${brl(d.valor)} para ${d.centro}?`)) return;
    await call(`/distribuicoes/${d.id}`, { method: "DELETE" }).catch((e) => alert(e.message));
    carregar(); onChange();
  }

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex justify-between items-center"><h2 className="font-semibold text-foreground">Registrar repasse a um centro</h2><span className="text-sm text-muted-foreground">Saldo a distribuir: <b className="text-foreground">{brl(saldo)}</b></span></div>
        <p className="text-xs text-muted-foreground">Faça a transferência pelo banco da GoTaxi e registre aqui. O centro vê o repasse no painel dele.</p>
        <div className="grid md:grid-cols-4 gap-2">
          <select className={input} value={form.centro_id} onChange={(e) => setForm({ ...form, centro_id: e.target.value })}>
            <option value="">Centro aprovado…</option>
            {centros.map((c) => <option key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</option>)}
          </select>
          <input className={input} inputMode="decimal" placeholder="Valor (R$)" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
          <input className={input} placeholder="Observação (ex.: PIX 12/10)" value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          <button className={btn} disabled={salvando} onClick={registrar}>Registrar</button>
        </div>
        {centroSel && <p className="text-xs text-muted-foreground">Dados bancários: {centroSel.banco_nome || "—"} · Ag {centroSel.banco_agencia || "—"} · Conta {centroSel.banco_conta || "—"} · Titular {centroSel.banco_titular || "—"} · PIX {centroSel.banco_chave_pix || "—"}</p>}
      </div>
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground border-b border-border"><tr><th className="p-3">Data</th><th className="p-3">Centro</th><th className="p-3">Valor</th><th className="p-3">Observação</th><th className="p-3" /></tr></thead>
          <tbody className="divide-y divide-border">
            {lista.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum repasse registrado.</td></tr>}
            {lista.map((d) => (
              <tr key={d.id}><td className="p-3 whitespace-nowrap">{data(d.criado_em)}</td><td className="p-3">{d.centro}</td><td className="p-3 font-semibold">{brl(d.valor)}</td><td className="p-3">{d.observacao || "—"}</td><td className="p-3 text-right"><button className={`${btnOutline} text-red-500`} onClick={() => excluir(d)}>Excluir</button></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChavePix({ call }: { call: Call; headers: Record<string, string> }) {
  const [cfg, setCfg] = useState<Config>({ chave: "", nome: "", cidade: "", texto: "" });
  const [msg, setMsg] = useState("");
  useEffect(() => { call<Config>("/config").then(setCfg).catch(() => {}); }, [call]);
  async function salvar() {
    setMsg("");
    try { setCfg(await call<Config>("/config", { method: "PATCH", body: JSON.stringify(cfg) })); setMsg("Salvo."); }
    catch (e: any) { setMsg(e.message); }
  }
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3 max-w-xl">
      <p className="text-sm text-muted-foreground">Chave PIX da GoTaxi que aparece com o QR Code no Menu SOS GoTaxi (apps, PDV e site). As doações em dinheiro caem nesta conta e depois são distribuídas aos centros.</p>
      <div><label className="text-xs text-muted-foreground">Chave PIX</label><input className={input} value={cfg.chave} onChange={(e) => setCfg({ ...cfg, chave: e.target.value })} placeholder="CNPJ, e-mail, telefone ou chave aleatória" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs text-muted-foreground">Nome do recebedor (até 25 letras)</label><input className={input} maxLength={25} value={cfg.nome} onChange={(e) => setCfg({ ...cfg, nome: e.target.value })} /></div>
        <div><label className="text-xs text-muted-foreground">Cidade (até 15 letras)</label><input className={input} maxLength={15} value={cfg.cidade} onChange={(e) => setCfg({ ...cfg, cidade: e.target.value })} /></div>
      </div>
      <div><label className="text-xs text-muted-foreground">Texto para o doador</label><textarea className={input} rows={3} value={cfg.texto} onChange={(e) => setCfg({ ...cfg, texto: e.target.value })} placeholder="Ex.: 100% das doações são repassadas aos centros parceiros." /></div>
      <div className="flex items-center gap-3"><button className={btn} onClick={salvar}>Salvar</button>{msg && <span className="text-sm text-muted-foreground">{msg}</span>}</div>
    </div>
  );
}
