import { useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import Logo from "@/components/Logo";
import CentroForm, { type CentroCampos } from "@/components/CentroForm";
import { api, setToken } from "@/lib/api";

export default function Entrar() {
  const [, navigate] = useLocation();
  const [aba, setAba] = useState<"login" | "cadastro">("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [form, setForm] = useState<CentroCampos>({});
  const [carregando, setCarregando] = useState(false);
  const [aceite, setAceite] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    try {
      const r = await api.post<{ token: string }>("/centros/login", { email, senha });
      setToken(r.token);
      navigate("/painel");
    } catch (err: any) { toast.error(err.message); } finally { setCarregando(false); }
  }

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    if (!aceite) { toast.error("Confirme a declaração sobre os dados dos recuperandos."); return; }
    setCarregando(true);
    try {
      const r = await api.post<{ token: string }>("/centros/cadastro", form);
      setToken(r.token);
      toast.success("Cadastro enviado! A GoTaxi vai analisar e aprovar.");
      navigate("/painel");
    } catch (err: any) { toast.error(err.message); } finally { setCarregando(false); }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-[#2a0a0a] to-gray-900 px-4 py-10">
      <div className={`mx-auto ${aba === "cadastro" ? "max-w-2xl" : "max-w-sm"}`}>
        <div className="flex justify-center mb-6"><Link href="/"><Logo claro /></Link></div>
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="grid grid-cols-2 gap-1 bg-gray-100 rounded-xl p-1 mb-6">
            {(["login", "cadastro"] as const).map((a) => (
              <button key={a} onClick={() => setAba(a)} className={`py-2 rounded-lg text-sm font-semibold ${aba === a ? "bg-white shadow text-gray-900" : "text-gray-500"}`}>
                {a === "login" ? "Entrar" : "Cadastrar centro"}
              </button>
            ))}
          </div>
          {aba === "login" ? (
            <form onSubmit={entrar} className="space-y-4">
              <div><label className="label">E-mail ou CNPJ</label><input className="input" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><label className="label">Senha</label><input className="input" type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} /></div>
              <button className="btn w-full" disabled={carregando}>{carregando ? "Entrando…" : "Entrar"}</button>
              <p className="text-xs text-center text-gray-500">Esqueceu a senha? Fale com o suporte GoTaxi.</p>
            </form>
          ) : (
            <form onSubmit={cadastrar} className="space-y-5">
              <p className="text-sm text-gray-600">Centros de recuperação, ONGs e institutos. Depois do cadastro, a GoTaxi confere os dados e aprova a instituição para aparecer no SOS GoTaxi.</p>
              <CentroForm v={form} set={setForm} cadastro />
              <label className="flex items-start gap-2 text-xs text-gray-600">
                <input type="checkbox" className="mt-0.5" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
                Declaro que a instituição tem autorização dos recuperandos (ou responsáveis) para registrar seus dados nesta plataforma. Documento e motivo da internação ficam visíveis só para a instituição e para a GoTaxi.
              </label>
              <button className="btn w-full" disabled={carregando}>{carregando ? "Enviando…" : "Enviar cadastro"}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
