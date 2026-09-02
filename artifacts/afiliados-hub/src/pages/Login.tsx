import { useState } from "react";
import { useLocation } from "wouter";
import { api, setToken } from "@/lib/api";
import { toast } from "sonner";

export default function Login() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await api.login(email.trim(), senha);
      setToken(data.token);
      localStorage.setItem("afiliado_usuario", JSON.stringify(data.usuario));
      localStorage.setItem("afiliado_data", JSON.stringify(data.afiliado));
      toast.success("Bem-vindo(a) ao Hub de Afiliados!");
      navigate("/");
    } catch (err: any) {
      toast.error(err.message || "Erro ao entrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-[#1a0a0a] to-gray-900 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[hsl(var(--primary))] mb-4 shadow-lg shadow-red-500/30">
            <span className="text-white font-black text-2xl">G</span>
          </div>
          <h1 className="text-2xl font-bold text-white">GoTaxi Afiliados</h1>
          <p className="text-gray-400 text-sm mt-1">Acesse o seu hub de parceiro</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail ou WhatsApp</label>
              <input
                type="text"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com ou (11)90000-0000"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha</label>
              <input
                type="password"
                required
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-transparent transition"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-[hsl(var(--primary))] text-white font-semibold text-sm hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-gray-500">
            Use as mesmas credenciais do aplicativo GoTaxi
          </p>
        </div>
      </div>
    </div>
  );
}
