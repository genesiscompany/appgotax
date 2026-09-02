import React, { useEffect, useState } from "react";
import { useAuth, API, authHeaders } from "@/lib/auth";

type Config = {
  id?: number;
  taxa_repasse: number;
  chave_pix: string;
  tipo_chave_pix: string;
  nome_beneficiario: string;
  dia_vencimento: number;
  hora_vencimento: string;
  whatsapp_suporte: string;
};

const TIPO_PIX = [
  { value: "aleatoria", label: "Chave Aleatória" },
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "telefone", label: "Telefone" },
];

const DIAS = [
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

const inputCls = "w-full bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors";

export default function Configuracoes() {
  const { token } = useAuth();
  const [config, setConfig] = useState<Config>({
    taxa_repasse: 3, chave_pix: "", tipo_chave_pix: "aleatoria",
    nome_beneficiario: "", dia_vencimento: 1, hora_vencimento: "18:00",
    whatsapp_suporte: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmaSenha, setConfirmaSenha] = useState("");
  const [savingSenha, setSavingSenha] = useState(false);
  const [senhaMsg, setSenhaMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch(`${API}/configuracoes`, { headers: authHeaders(token) })
      .then(r => r.json()).then(d => {
        if (d?.id) setConfig({
          taxa_repasse: Number(d.taxa_repasse) || 3,
          chave_pix: d.chave_pix || "",
          tipo_chave_pix: d.tipo_chave_pix || "aleatoria",
          nome_beneficiario: d.nome_beneficiario || "",
          dia_vencimento: Number(d.dia_vencimento) || 1,
          hora_vencimento: d.hora_vencimento || "18:00",
          whatsapp_suporte: d.whatsapp_suporte || "",
        });
        setLoading(false);
      }).catch(() => setLoading(false));
  }, [token]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await fetch(`${API}/configuracoes`, {
      method: "PUT", headers: authHeaders(token),
      body: JSON.stringify(config),
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleAlterarSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    setSenhaMsg(null);
    if (novaSenha !== confirmaSenha) { setSenhaMsg({ ok: false, text: "As senhas não coincidem." }); return; }
    if (novaSenha.length < 6) { setSenhaMsg({ ok: false, text: "A nova senha deve ter pelo menos 6 caracteres." }); return; }
    setSavingSenha(true);
    try {
      const res = await fetch(`${API}/alterar-senha`, {
        method: "PATCH", headers: authHeaders(token),
        body: JSON.stringify({ senhaAtual, novaSenha }),
      });
      const data = await res.json();
      if (res.ok) {
        setSenhaMsg({ ok: true, text: "Senha alterada com sucesso!" });
        setSenhaAtual(""); setNovaSenha(""); setConfirmaSenha("");
      } else {
        setSenhaMsg({ ok: false, text: data.message || "Erro ao alterar senha." });
      }
    } catch { setSenhaMsg({ ok: false, text: "Erro de rede. Tente novamente." }); }
    setSavingSenha(false);
    setTimeout(() => setSenhaMsg(null), 4000);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-muted-foreground gap-3">
      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      Carregando configurações...
    </div>
  );

  const diaLabel = DIAS.find(d => d.value === config.dia_vencimento)?.label ?? "Segunda-feira";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure taxas de repasse, chave PIX e vencimento.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        {/* Taxa de repasse */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <h2 className="font-semibold text-foreground">Taxa de Repasse</h2>
          </div>
          <Field label="Percentual da taxa (%)" hint="Porcentagem cobrada sobre a receita bruta de cada parceiro.">
            <div className="relative">
              <input type="number" min={0} max={100} step={0.1} value={config.taxa_repasse}
                onChange={e => setConfig(c => ({ ...c, taxa_repasse: Number(e.target.value) }))}
                className={`${inputCls} pr-8`} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
          </Field>
          <div className="bg-secondary/50 rounded-lg p-3 text-sm text-muted-foreground">
            Exemplo: parceiro com <strong className="text-foreground">R$ 1.000</strong> de receita pagará{" "}
            <strong className="text-primary">R$ {(1000 * config.taxa_repasse / 100).toFixed(2)}</strong> de repasse.
          </div>
        </div>

        {/* PIX */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            </div>
            <h2 className="font-semibold text-foreground">Chave PIX para Recebimento</h2>
          </div>
          <Field label="Nome do beneficiário">
            <input type="text" value={config.nome_beneficiario} placeholder="Seu nome ou razão social"
              onChange={e => setConfig(c => ({ ...c, nome_beneficiario: e.target.value }))}
              className={inputCls} />
          </Field>
          <Field label="Tipo da chave">
            <select value={config.tipo_chave_pix} onChange={e => setConfig(c => ({ ...c, tipo_chave_pix: e.target.value }))} className={inputCls}>
              {TIPO_PIX.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Chave PIX" hint="Esta chave será exibida na tela de bloqueio para os parceiros realizarem o pagamento.">
            <input type="text" value={config.chave_pix} placeholder="Ex: email@exemplo.com"
              onChange={e => setConfig(c => ({ ...c, chave_pix: e.target.value }))}
              className={inputCls} />
          </Field>
          {config.chave_pix && (
            <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
              <p className="text-xs font-semibold text-green-400 mb-1">Prévia — como os parceiros verão:</p>
              <p className="text-sm text-foreground">Tipo: <strong>{TIPO_PIX.find(t => t.value === config.tipo_chave_pix)?.label}</strong></p>
              <p className="text-sm text-foreground font-mono mt-1">{config.chave_pix}</p>
              {config.nome_beneficiario && <p className="text-sm text-foreground mt-1">Beneficiário: <strong>{config.nome_beneficiario}</strong></p>}
            </div>
          )}
        </div>

        {/* Vencimento */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <h2 className="font-semibold text-foreground">Prazo de Vencimento</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Dia da semana">
              <select value={config.dia_vencimento} onChange={e => setConfig(c => ({ ...c, dia_vencimento: Number(e.target.value) }))} className={inputCls}>
                {DIAS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </Field>
            <Field label="Horário limite">
              <input type="time" value={config.hora_vencimento}
                onChange={e => setConfig(c => ({ ...c, hora_vencimento: e.target.value }))}
                className={inputCls} />
            </Field>
          </div>
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
            <p className="text-xs text-yellow-400 font-semibold mb-1">Regra atual:</p>
            <p className="text-sm text-foreground/80">
              O repasse deve ser pago toda <strong className="text-foreground">{diaLabel}</strong> até as <strong className="text-foreground">{config.hora_vencimento}h</strong>.
              Após este horário, o sistema bloqueia automaticamente o acesso do parceiro.
            </p>
          </div>
        </div>

        {/* Suporte WhatsApp */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.71 3.4 2 2 0 0 1 3.68 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6 6l1.12-1.12a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            </div>
            <h2 className="font-semibold text-foreground">Suporte WhatsApp (App Cliente)</h2>
          </div>
          <Field label="Número do WhatsApp de suporte" hint="Número completo com DDI e DDD. Ex: 5511900000000. Será exibido para clientes no app.">
            <div className="relative">
              <input
                type="text"
                value={config.whatsapp_suporte}
                placeholder="5511900000000"
                onChange={e => setConfig(c => ({ ...c, whatsapp_suporte: e.target.value.replace(/\D/g, "") }))}
                className={inputCls}
                maxLength={20}
              />
            </div>
          </Field>
          {config.whatsapp_suporte && (
            <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
              <p className="text-xs font-semibold text-green-400 mb-1">Link gerado:</p>
              <p className="text-sm font-mono text-foreground">wa.me/{config.whatsapp_suporte}</p>
            </div>
          )}
        </div>

        {/* Save button */}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving}
            className="px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm">
            {saving ? "Salvando..." : "Salvar configurações"}
          </button>
          {saved && (
            <span className="text-sm text-green-400 flex items-center gap-1.5">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
              Configurações salvas!
            </span>
          )}
        </div>
      </form>

      {/* Alterar Senha */}
      <form onSubmit={handleAlterarSenha} className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <h2 className="font-semibold text-foreground">Alterar Senha do Super Admin</h2>
        </div>
        <Field label="Senha atual">
          <input type="password" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)}
            placeholder="••••••••" className={inputCls} autoComplete="current-password" />
        </Field>
        <Field label="Nova senha" hint="Mínimo de 6 caracteres.">
          <input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)}
            placeholder="••••••••" className={inputCls} autoComplete="new-password" />
        </Field>
        <Field label="Confirmar nova senha">
          <input type="password" value={confirmaSenha} onChange={e => setConfirmaSenha(e.target.value)}
            placeholder="••••••••" className={inputCls} autoComplete="new-password" />
        </Field>
        {senhaMsg && (
          <div className={`rounded-lg px-3 py-2.5 text-sm font-medium ${senhaMsg.ok ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-destructive/10 text-destructive border border-destructive/20"}`}>
            {senhaMsg.text}
          </div>
        )}
        <button type="submit" disabled={savingSenha || !senhaAtual || !novaSenha || !confirmaSenha}
          className="px-6 py-2.5 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors text-sm">
          {savingSenha ? "Alterando..." : "Alterar Senha"}
        </button>
      </form>
    </div>
  );
}
