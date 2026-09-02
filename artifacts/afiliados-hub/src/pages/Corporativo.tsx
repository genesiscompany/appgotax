import { useEffect, useState } from "react";
import { Building2, Plus, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";
import { getToken } from "@/lib/api";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API_CORP = `${BASE.replace("/afiliados", "")}/api/corporativo-cadastro`;

type Cadastro = {
  id: number;
  nome_fantasia: string;
  cnpj: string;
  email_empresa: string;
  status: "pendente" | "aprovado" | "rejeitado";
  criado_em: string;
  decidido_em: string | null;
  motivo_rejeicao: string | null;
};

const STATUS_CFG: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
  pendente: { label: "Pendente", cls: "bg-yellow-50 text-yellow-700 border-yellow-200", Icon: Clock },
  aprovado: { label: "Aprovado", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", Icon: CheckCircle2 },
  rejeitado: { label: "Rejeitado", cls: "bg-red-50 text-red-700 border-red-200", Icon: XCircle },
};

function fmt(s: string | null) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("pt-BR"); } catch { return s; }
}

async function req(method: string, path: string, body?: any) {
  const r = await fetch(`${API_CORP}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.message || data?.error || "Erro");
  return data;
}

export default function Corporativo() {
  const [lista, setLista] = useState<Cadastro[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNova, setShowNova] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try { setLista(await req("GET", "/afiliado/meus")); }
    catch { /* noop */ }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Building2 className="text-[hsl(var(--primary))]" /> Plataforma Corporativa
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Cadastre empresas para a Plataforma Corporativa GoTaxi. Após aprovação do super admin,
              o parceiro acessa via <strong>PDV → Motorista</strong> com os dados gerados.
            </p>
          </div>
          <button onClick={() => setShowNova(true)}
            className="bg-[hsl(var(--primary))] hover:opacity-90 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            <Plus size={16} /> Cadastrar empresa
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <AlertCircle className="text-blue-500 shrink-0 mt-0.5" size={20} />
        <div className="text-sm text-blue-900">
          <strong>Como funciona:</strong> envie os dados da empresa, do responsável e o limite de crédito desejado.
          O super admin GoTaxi analisa e, se aprovar, envia o login e a senha de acesso ao PDV — você acompanha o status nesta página.
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Meus cadastros</h2>
        </div>
        {loading ? (
          <div className="p-10 text-center text-gray-500 text-sm">Carregando...</div>
        ) : lista.length === 0 ? (
          <div className="p-10 text-center text-gray-500 text-sm">
            Você ainda não cadastrou nenhuma empresa. Clique em "Cadastrar empresa" para começar.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {lista.map(c => {
              const st = STATUS_CFG[c.status] || STATUS_CFG.pendente;
              const Icon = st.Icon;
              return (
                <div key={c.id} className="p-4 flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{c.nome_fantasia}</div>
                    <div className="text-xs text-gray-500 truncate">CNPJ {c.cnpj} · {c.email_empresa}</div>
                    <div className="text-xs text-gray-400 mt-0.5">Enviado em {fmt(c.criado_em)}</div>
                    {c.status === "rejeitado" && c.motivo_rejeicao && (
                      <div className="text-xs text-red-600 mt-1.5 bg-red-50 border border-red-100 rounded px-2 py-1">
                        Motivo: {c.motivo_rejeicao}
                      </div>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full border font-medium flex items-center gap-1 ${st.cls}`}>
                    <Icon size={12} /> {st.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showNova && <NovaCadastroModal onClose={() => setShowNova(false)} onSaved={() => { setShowNova(false); carregar(); }} />}
    </div>
  );
}

function NovaCadastroModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
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
  const [sucesso, setSucesso] = useState(false);

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
      await req("POST", "/cadastrar", { ...f, origem: "afiliado" });
      setSucesso(true);
    } catch (e: any) {
      setErro(e?.message || "Erro ao enviar cadastro");
    } finally { setSaving(false); }
  };

  const Field = ({ label, k, type = "text", colSpan = 1 }: { label: string; k: keyof typeof f; type?: string; colSpan?: number }) => (
    <div className={colSpan === 2 ? "md:col-span-2" : ""}>
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <input type={type} value={f[k]} onChange={set(k)}
        className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40" />
    </div>
  );

  if (sucesso) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl text-center" onClick={e => e.stopPropagation()}>
          <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-3" />
          <h2 className="text-lg font-bold text-gray-900">Cadastro enviado!</h2>
          <p className="text-sm text-gray-600 mt-2">
            O super admin GoTaxi vai analisar o cadastro e enviar o acesso PDV. Você acompanha o status na lista.
          </p>
          <button onClick={onSaved}
            className="mt-5 px-5 py-2 rounded-lg bg-[hsl(var(--primary))] text-white text-sm font-medium hover:opacity-90">
            Fechar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-3xl shadow-2xl my-8" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900">Cadastrar empresa corporativa</h2>
        <p className="text-xs text-gray-500 mb-4">Preencha os dados — o cadastro fica pendente até aprovação do super admin.</p>

        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Dados da empresa</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Nome fantasia *" k="nomeFantasia" colSpan={2} />
              <Field label="Razão social" k="razaoSocial" />
              <Field label="CNPJ *" k="cnpj" />
              <Field label="E-mail da empresa *" k="emailEmpresa" type="email" />
              <Field label="Telefone" k="telefoneEmpresa" />
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Endereço</h3>
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
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Responsável</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Nome" k="responsavelNome" />
              <Field label="CPF" k="responsavelCpf" />
              <Field label="Cargo" k="responsavelCargo" />
              <Field label="Telefone" k="responsavelTelefone" />
              <Field label="E-mail" k="responsavelEmail" type="email" colSpan={2} />
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Operacional</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Qtde de funcionários" k="qtdeFuncionarios" type="number" />
              <Field label="Limite de crédito (R$)" k="limiteCredito" type="number" />
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-gray-600">Observações</label>
                <textarea value={f.observacoes} onChange={set("observacoes")} rows={3}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 text-sm" />
              </div>
            </div>
          </section>
        </div>

        {erro && <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 p-2 rounded-lg">{erro}</div>}

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm">Cancelar</button>
          <button onClick={handleSalvar} disabled={saving}
            className="px-4 py-2 rounded-lg bg-[hsl(var(--primary))] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {saving ? "Enviando..." : "Enviar cadastro"}
          </button>
        </div>
      </div>
    </div>
  );
}
