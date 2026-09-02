import React, { useEffect, useState } from "react";
import { useAuth, authHeaders } from "@/lib/auth";

const API_CORP = "/api/corporativo-cadastro";

type Cadastro = {
  id: number;
  nome_fantasia: string;
  razao_social: string | null;
  cnpj: string;
  email_empresa: string;
  telefone_empresa: string | null;
  cep: string | null;
  endereco_rua: string | null;
  endereco_numero: string | null;
  endereco_complemento: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
  responsavel_nome: string | null;
  responsavel_cpf: string | null;
  responsavel_cargo: string | null;
  responsavel_email: string | null;
  responsavel_telefone: string | null;
  qtde_funcionarios: number | null;
  limite_credito: string | null;
  observacoes: string | null;
  origem: string;
  afiliado_id: number | null;
  afiliado_nome: string | null;
  afiliado_email: string | null;
  status: "pendente" | "aprovado" | "rejeitado";
  empresa_id_aprovada: number | null;
  login_pdv: string | null;
  senha_pdv: string | null;
  motivo_rejeicao: string | null;
  criado_em: string;
  decidido_em: string | null;
};

const STATUS_BADGE: Record<string, string> = {
  pendente: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  aprovado: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  rejeitado: "bg-red-500/15 text-red-700 dark:text-red-400",
};

function fmtData(s: string | null) {
  if (!s) return "—";
  try { return new Date(s).toLocaleString("pt-BR"); } catch { return s; }
}
function fmtDinheiro(v: string | null) {
  const n = Number(v ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function EmpresasCorporativas() {
  const { token } = useAuth();
  const [aba, setAba] = useState<"pendente" | "aprovado" | "rejeitado">("pendente");
  const [lista, setLista] = useState<Cadastro[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNova, setShowNova] = useState(false);
  const [detalhe, setDetalhe] = useState<Cadastro | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_CORP}/admin/list?status=${aba}`, { headers: authHeaders(token) });
      if (r.ok) setLista(await r.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { if (token) carregar(); /* eslint-disable-next-line */ }, [token, aba]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Empresas Corporativas</h1>
          <p className="text-sm text-muted-foreground">Cadastros para a Plataforma Corporativa (acesso via PDV → Motorista).</p>
        </div>
        <button onClick={() => setShowNova(true)}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
          + Novo cadastro
        </button>
      </div>

      <div className="flex gap-1 border-b border-border">
        {(["pendente", "aprovado", "rejeitado"] as const).map(t => (
          <button key={t} onClick={() => setAba(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px capitalize ${
              aba === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {t === "pendente" ? "Pendentes" : t === "aprovado" ? "Aprovados" : "Rejeitados"}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : lista.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Nenhum cadastro {aba}.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3">Empresa</th>
                  <th className="text-left px-4 py-3">CNPJ</th>
                  <th className="text-left px-4 py-3">Responsável</th>
                  <th className="text-left px-4 py-3">Origem</th>
                  <th className="text-left px-4 py-3">Limite</th>
                  <th className="text-left px-4 py-3">Criado</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map(c => (
                  <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{c.nome_fantasia}</div>
                      <div className="text-xs text-muted-foreground">{c.email_empresa}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">{c.cnpj}</td>
                    <td className="px-4 py-3">
                      <div>{c.responsavel_nome || "—"}</div>
                      <div className="text-xs text-muted-foreground">{c.responsavel_telefone || ""}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {c.origem === "afiliado"
                        ? <span title={c.afiliado_email || ""}>Afiliado: {c.afiliado_nome || `#${c.afiliado_id}`}</span>
                        : "Admin"}
                    </td>
                    <td className="px-4 py-3 text-xs">{fmtDinheiro(c.limite_credito)}</td>
                    <td className="px-4 py-3 text-xs">{fmtData(c.criado_em)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_BADGE[c.status]}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setDetalhe(c)}
                        className="px-3 py-1.5 rounded-md text-xs bg-muted hover:bg-muted/70">
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNova && <NovaCadastroModal token={token} onClose={() => setShowNova(false)} onSaved={() => { setShowNova(false); carregar(); }} />}
      {detalhe && <DetalheModal cadastro={detalhe} token={token} onClose={() => setDetalhe(null)} onChanged={() => { setDetalhe(null); carregar(); }} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function NovaCadastroModal({ token, onClose, onSaved }: { token: string | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    nomeFantasia: "", razaoSocial: "", cnpj: "",
    emailEmpresa: "", telefoneEmpresa: "",
    cep: "", enderecoRua: "", enderecoNumero: "", enderecoComplemento: "",
    enderecoBairro: "", enderecoCidade: "", enderecoEstado: "",
    responsavelNome: "", responsavelCpf: "", responsavelCargo: "",
    responsavelEmail: "", responsavelTelefone: "",
    qtdeFuncionarios: "", limiteCredito: "0", observacoes: "",
  });
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF(prev => ({ ...prev, [k]: e.target.value }));

  const handleSalvar = async () => {
    setErro("");
    if (!f.nomeFantasia.trim() || !f.cnpj.trim() || !f.emailEmpresa.trim()) {
      setErro("Preencha nome fantasia, CNPJ e e-mail da empresa.");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch(`${API_CORP}/cadastrar`, {
        method: "POST",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, origem: "admin" }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.message || "Erro ao salvar");
      onSaved();
    } catch (e: any) {
      setErro(e?.message || "Erro ao salvar");
    } finally { setSaving(false); }
  };

  const Field = ({ label, k, type = "text", colSpan = 1 }: { label: string; k: keyof typeof f; type?: string; colSpan?: number }) => (
    <div className={colSpan === 2 ? "md:col-span-2" : ""}>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input type={type} value={f[k]} onChange={set(k)}
        className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-3xl shadow-2xl my-8" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold">Novo cadastro de empresa corporativa</h2>
        <p className="text-xs text-muted-foreground mb-4">Após salvar, o cadastro fica pendente até você aprovar.</p>

        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
          <section>
            <h3 className="text-sm font-semibold mb-2">Dados da empresa</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Nome fantasia *" k="nomeFantasia" colSpan={2} />
              <Field label="Razão social" k="razaoSocial" />
              <Field label="CNPJ *" k="cnpj" />
              <Field label="E-mail da empresa *" k="emailEmpresa" type="email" />
              <Field label="Telefone" k="telefoneEmpresa" />
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-2">Endereço</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="CEP" k="cep" />
              <Field label="Rua" k="enderecoRua" colSpan={2} />
              <Field label="Número" k="enderecoNumero" />
              <Field label="Complemento" k="enderecoComplemento" />
              <Field label="Bairro" k="enderecoBairro" />
              <Field label="Cidade" k="enderecoCidade" />
              <Field label="Estado (UF)" k="enderecoEstado" />
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-2">Responsável</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Nome" k="responsavelNome" />
              <Field label="CPF" k="responsavelCpf" />
              <Field label="Cargo" k="responsavelCargo" />
              <Field label="Telefone" k="responsavelTelefone" />
              <Field label="E-mail" k="responsavelEmail" type="email" colSpan={2} />
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-2">Operacional</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Qtde de funcionários" k="qtdeFuncionarios" type="number" />
              <Field label="Limite de crédito (R$)" k="limiteCredito" type="number" />
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Observações</label>
                <textarea value={f.observacoes} onChange={set("observacoes")} rows={3}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm" />
              </div>
            </div>
          </section>
        </div>

        {erro && <div className="mt-3 text-sm text-red-500 bg-red-500/10 p-2 rounded-lg">{erro}</div>}

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-muted text-sm">Cancelar</button>
          <button onClick={handleSalvar} disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
            {saving ? "Salvando..." : "Salvar cadastro"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function DetalheModal({ cadastro, token, onClose, onChanged }: { cadastro: Cadastro; token: string | null; onClose: () => void; onChanged: () => void }) {
  const [aprovando, setAprovando] = useState(false);
  const [rejeitando, setRejeitando] = useState(false);
  const [mostrarRej, setMostrarRej] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<{ login: string; senha: string } | null>(null);
  const [loginPdv, setLoginPdv] = useState(cadastro.email_empresa || "");
  const [senhaPdv, setSenhaPdv] = useState("");

  const aprovar = async () => {
    setErro(""); setAprovando(true);
    try {
      const r = await fetch(`${API_CORP}/admin/${cadastro.id}/aprovar`, {
        method: "POST",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ loginPdv, senhaPdv: senhaPdv || undefined }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.message || "Erro ao aprovar");
      setResultado(data.acessoPdv);
    } catch (e: any) { setErro(e?.message || "Erro ao aprovar"); }
    finally { setAprovando(false); }
  };

  const rejeitar = async () => {
    setErro(""); setRejeitando(true);
    try {
      const r = await fetch(`${API_CORP}/admin/${cadastro.id}/rejeitar`, {
        method: "POST",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ motivo }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.message || "Erro ao rejeitar");
      onChanged();
    } catch (e: any) { setErro(e?.message || "Erro ao rejeitar"); }
    finally { setRejeitando(false); }
  };

  const Linha = ({ k, v }: { k: string; v: any }) => (
    <div className="text-sm">
      <span className="text-muted-foreground">{k}: </span>
      <span className="font-medium">{v ?? "—"}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-2xl shadow-2xl my-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">{cadastro.nome_fantasia}</h2>
            <p className="text-xs text-muted-foreground">CNPJ {cadastro.cnpj} · {cadastro.email_empresa}</p>
          </div>
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_BADGE[cadastro.status]}`}>
            {cadastro.status}
          </span>
        </div>

        {resultado ? (
          <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mb-2">✓ Empresa aprovada!</h3>
            <p className="text-xs text-muted-foreground mb-3">Repasse esses dados de acesso ao parceiro. Acesso via PDV → Motorista.</p>
            <Linha k="Login (e-mail)" v={resultado.login} />
            <Linha k="Senha" v={<span className="font-mono">{resultado.senha}</span>} />
            <div className="flex justify-end mt-4">
              <button onClick={onChanged} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Fechar</button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto pr-2">
              <section className="space-y-1">
                <h4 className="text-xs uppercase text-muted-foreground font-semibold">Empresa</h4>
                <Linha k="Razão social" v={cadastro.razao_social} />
                <Linha k="Telefone" v={cadastro.telefone_empresa} />
                <Linha k="Funcionários" v={cadastro.qtde_funcionarios} />
                <Linha k="Limite de crédito" v={fmtDinheiro(cadastro.limite_credito)} />
                <Linha k="Origem" v={cadastro.origem === "afiliado" ? `Afiliado: ${cadastro.afiliado_nome || cadastro.afiliado_id}` : "Admin"} />
              </section>
              <section className="space-y-1">
                <h4 className="text-xs uppercase text-muted-foreground font-semibold">Endereço</h4>
                <Linha k="CEP" v={cadastro.cep} />
                <Linha k="Rua" v={`${cadastro.endereco_rua || "—"}, ${cadastro.endereco_numero || "—"}`} />
                <Linha k="Complemento" v={cadastro.endereco_complemento} />
                <Linha k="Bairro" v={cadastro.endereco_bairro} />
                <Linha k="Cidade/UF" v={`${cadastro.endereco_cidade || "—"} / ${cadastro.endereco_estado || "—"}`} />
              </section>
              <section className="space-y-1 md:col-span-2">
                <h4 className="text-xs uppercase text-muted-foreground font-semibold">Responsável</h4>
                <div className="grid grid-cols-2 gap-2">
                  <Linha k="Nome" v={cadastro.responsavel_nome} />
                  <Linha k="CPF" v={cadastro.responsavel_cpf} />
                  <Linha k="Cargo" v={cadastro.responsavel_cargo} />
                  <Linha k="Telefone" v={cadastro.responsavel_telefone} />
                  <Linha k="E-mail" v={cadastro.responsavel_email} />
                </div>
              </section>
              {cadastro.observacoes && (
                <section className="md:col-span-2">
                  <h4 className="text-xs uppercase text-muted-foreground font-semibold">Observações</h4>
                  <p className="text-sm whitespace-pre-wrap">{cadastro.observacoes}</p>
                </section>
              )}
              {cadastro.status === "aprovado" && cadastro.login_pdv && (
                <section className="md:col-span-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                  <h4 className="text-xs uppercase text-emerald-700 dark:text-emerald-400 font-semibold mb-1">Acesso PDV</h4>
                  <Linha k="Login" v={cadastro.login_pdv} />
                  <Linha k="Senha" v={<span className="font-mono">{cadastro.senha_pdv}</span>} />
                </section>
              )}
              {cadastro.status === "rejeitado" && cadastro.motivo_rejeicao && (
                <section className="md:col-span-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <h4 className="text-xs uppercase text-red-700 dark:text-red-400 font-semibold mb-1">Motivo da rejeição</h4>
                  <p className="text-sm">{cadastro.motivo_rejeicao}</p>
                </section>
              )}
            </div>

            {cadastro.status === "pendente" && (
              <div className="mt-5 pt-4 border-t border-border space-y-3">
                {!mostrarRej ? (
                  <>
                    <h4 className="text-sm font-semibold">Aprovar e gerar acesso ao PDV</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Login (e-mail)</label>
                        <input value={loginPdv} onChange={e => setLoginPdv(e.target.value)}
                          className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Senha (vazio = gerar automático)</label>
                        <input value={senhaPdv} onChange={e => setSenhaPdv(e.target.value)} placeholder="auto"
                          className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm font-mono" />
                      </div>
                    </div>
                    {erro && <div className="text-sm text-red-500 bg-red-500/10 p-2 rounded-lg">{erro}</div>}
                    <div className="flex justify-between gap-2">
                      <button onClick={() => setMostrarRej(true)}
                        className="px-4 py-2 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 text-sm font-medium">
                        Rejeitar
                      </button>
                      <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg bg-muted text-sm">Fechar</button>
                        <button onClick={aprovar} disabled={aprovando}
                          className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-50">
                          {aprovando ? "Aprovando..." : "✓ Aprovar empresa"}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <h4 className="text-sm font-semibold text-red-600">Rejeitar cadastro</h4>
                    <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3}
                      placeholder="Motivo da rejeição (será mostrado ao afiliado)"
                      className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm" />
                    {erro && <div className="text-sm text-red-500 bg-red-500/10 p-2 rounded-lg">{erro}</div>}
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setMostrarRej(false)} className="px-4 py-2 rounded-lg bg-muted text-sm">Voltar</button>
                      <button onClick={rejeitar} disabled={rejeitando}
                        className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium disabled:opacity-50">
                        {rejeitando ? "Rejeitando..." : "Confirmar rejeição"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {cadastro.status !== "pendente" && (
              <div className="flex justify-end mt-4">
                <button onClick={onClose} className="px-4 py-2 rounded-lg bg-muted text-sm">Fechar</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
