import type { Centro } from "@/lib/api";

export type CentroCampos = Partial<Centro> & { senha?: string };

const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");

export default function CentroForm({ v, set, cadastro }: { v: CentroCampos; set: (p: CentroCampos) => void; cadastro?: boolean }) {
  const campo = (k: keyof CentroCampos) => ({
    value: (v[k] as string | number | null | undefined) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set({ ...v, [k]: e.target.value }),
  });
  return (
    <div className="space-y-5">
      <fieldset className="space-y-3">
        <legend className="font-bold text-gray-900 mb-1">Dados da instituição</legend>
        <div><label className="label">Razão social *</label><input className="input" required {...campo("razao_social")} /></div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label">Nome fantasia</label><input className="input" {...campo("nome_fantasia")} /></div>
          <div>
            <label className="label">CNPJ *</label>
            <input className="input disabled:bg-gray-100" required disabled={!cadastro} inputMode="numeric" placeholder="00.000.000/0000-00" {...campo("cnpj")} />
          </div>
        </div>
        <div><label className="label">Endereço *</label><input className="input" required placeholder="Rua, número, bairro" {...campo("endereco")} /></div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2"><label className="label">Cidade</label><input className="input" {...campo("cidade")} /></div>
          <div>
            <label className="label">UF</label>
            <select className="input" {...campo("uf")}><option value="">—</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label">Telefone / WhatsApp *</label><input className="input" required inputMode="tel" placeholder="(11) 90000-0000" {...campo("telefone")} /></div>
          <div><label className="label">E-mail *</label><input className="input disabled:bg-gray-100" type="email" required disabled={!cadastro} {...campo("email")} /></div>
        </div>
        <div><label className="label">Quantidade de recuperandos</label><input className="input" type="number" min={0} {...campo("quantidade_recuperandos")} /></div>
        <div><label className="label">Sobre a instituição</label><textarea className="input" rows={3} {...campo("descricao")} /></div>
        <div><label className="label">Necessidades (resumo)</label><textarea className="input" rows={3} placeholder="Ex.: alimentos não perecíveis, produtos de limpeza, colchões" {...campo("necessidades")} /></div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-bold text-gray-900 mb-1">Conta bancária</legend>
        <p className="text-xs text-gray-500 -mt-1">Usada pela GoTaxi para repassar as doações em dinheiro. Não aparece para o público.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label">Banco</label><input className="input" {...campo("banco_nome")} /></div>
          <div>
            <label className="label">Tipo de conta</label>
            <select className="input" {...campo("banco_tipo_conta")}><option value="">—</option><option value="corrente">Corrente</option><option value="poupanca">Poupança</option></select>
          </div>
          <div><label className="label">Agência</label><input className="input" {...campo("banco_agencia")} /></div>
          <div><label className="label">Conta</label><input className="input" {...campo("banco_conta")} /></div>
          <div><label className="label">Titular</label><input className="input" {...campo("banco_titular")} /></div>
          <div><label className="label">Chave PIX da instituição</label><input className="input" {...campo("banco_chave_pix")} /></div>
        </div>
      </fieldset>

      {cadastro && (
        <fieldset className="space-y-3">
          <legend className="font-bold text-gray-900 mb-1">Acesso</legend>
          <div><label className="label">Senha * (mínimo 6 caracteres)</label><input className="input" type="password" required minLength={6} {...campo("senha")} /></div>
        </fieldset>
      )}
    </div>
  );
}
