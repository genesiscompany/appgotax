import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { api } from "@/lib/api";
import { toast } from "sonner";
import layoutImg from "@assets/login.png";

const CATEGORIAS = [
  { value: "cliente", label: "Usuário do app" },
  { value: "motorista", label: "Motorista de app" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "food", label: "Food delivery" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "servicos", label: "Prestadores de serviços" },
  { value: "encomendas", label: "Entrega e encomenda" },
  { value: "tur", label: "Tur viagens e caronas" },
];

export default function Landing() {
  const params = useParams();
  const [, navigate] = useLocation();
  const codigo = (params.codigo as string)?.toUpperCase();

  const [afiliado, setAfiliado] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [sending, setSending] = useState(false);

  const [whatsapp, setWhatsapp] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [categoria, setCategoria] = useState("");
  const [senha, setSenha] = useState("");

  useEffect(() => {
    if (!codigo) { setNotFound(true); setLoading(false); return; }
    api.publicReferral(codigo)
      .then(d => {
        if (d.error) setNotFound(true);
        else setAfiliado(d);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [codigo]);

  function formatWhatsapp(v: string) {
    const n = v.replace(/\D/g, "").slice(0, 11);
    if (n.length <= 2) return n;
    if (n.length <= 7) return `(${n.slice(0, 2)})${n.slice(2)}`;
    return `(${n.slice(0, 2)})${n.slice(2, 7)}-${n.slice(7)}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoria) { toast.error("Selecione a categoria"); return; }
    if (!nome.trim()) { toast.error("Informe seu nome"); return; }
    if (whatsapp.replace(/\D/g, "").length < 10) { toast.error("WhatsApp inválido"); return; }
    const isPin = categoria === "motorista" || categoria === "encomendas" || categoria === "food";
    if (isPin) {
      if (!/^\d{4}$/.test(senha)) { toast.error("PIN deve ter exatamente 4 dígitos numéricos"); return; }
    } else {
      if (senha.length < 4) { toast.error("Senha deve ter ao menos 4 caracteres"); return; }
    }
    setSending(true);
    try {
      const resp = await api.cadastrarIndicado({
        codigo,
        categoria,
        nome: nome.trim(),
        whatsapp,
        email: email.trim() || null,
        senha,
      });
      toast.success("Cadastro concluído!");
      const login = resp.login || "";
      if (resp.redirect_to === "pdv") {
        setTimeout(() => {
          const domain = import.meta.env.VITE_PUBLIC_DOMAIN || "gotaxi.com.br";
          window.location.href = `https://pdv.${domain}/login?email=${encodeURIComponent(login)}`;
        }, 800);
      } else {
        setTimeout(() => {
          navigate(`/baixar-app?tipo=${categoria}`);
        }, 600);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#7C5CFC]">
        <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#7C5CFC] px-4">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-white mb-2">Link inválido</h1>
          <p className="text-white/80 text-sm">Este link de indicação não existe ou expirou.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-6 px-3">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Header roxo */}
        <div className="bg-[#7C5CFC] px-6 pt-6 pb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-full bg-yellow-400 flex items-center justify-center text-[#7C5CFC]">
              <span className="text-lg">🚖</span>
            </div>
            <span className="text-white font-bold text-xl">Go Taxi</span>
          </div>

          <div className="flex justify-center my-6">
            <img
              src={layoutImg}
              alt=""
              className="h-48 object-contain opacity-95 pointer-events-none select-none"
              style={{ mixBlendMode: "multiply" }}
            />
          </div>

          <h1 className="text-white text-4xl font-bold text-center">Cadastre-se</h1>
          <p className="text-white/90 text-sm text-center mt-4 font-medium">
            Obs. olá você está a convite de;{" "}
            <strong className="font-semibold">{afiliado?.nome || "um parceiro GoTaxi"}</strong>
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="px-6 pt-6 pb-8 space-y-3">
          <input
            type="tel"
            value={whatsapp}
            onChange={e => setWhatsapp(formatWhatsapp(e.target.value))}
            placeholder="Whatsapp: (11)90000-0000"
            className="w-full px-4 py-3 bg-gray-100 rounded-lg text-sm text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]"
            required
          />
          <input
            type="text"
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Nome:"
            className="w-full px-4 py-3 bg-gray-100 rounded-lg text-sm text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]"
            required
          />
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email:"
            className="w-full px-4 py-3 bg-gray-100 rounded-lg text-sm text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]"
          />
          <select
            value={categoria}
            onChange={e => setCategoria(e.target.value)}
            className="w-full px-4 py-3 bg-gray-100 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]"
            required
          >
            <option value="">Selecione a categoria:</option>
            {CATEGORIAS.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          {(categoria === "motorista" || categoria === "encomendas" || categoria === "food") ? (
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              value={senha}
              onChange={e => setSenha(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="PIN de 4 dígitos (para login no app GoTaxi Pro):"
              className="w-full px-4 py-3 bg-gray-100 rounded-lg text-sm text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]"
              required
            />
          ) : (
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              placeholder="Senha:"
              className="w-full px-4 py-3 bg-gray-100 rounded-lg text-sm text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#7C5CFC]"
              required
            />
          )}

          {/* Ícones informativos */}
          <div className="flex items-center justify-around pt-5 pb-2">
            <div className="flex flex-col items-center gap-1">
              <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-2xl">
                🖥️
              </div>
              <span className="text-xs text-gray-600 font-medium">PDV acesso</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="bg-black text-white px-3 py-2 rounded-lg flex items-center gap-2 h-14">
                <div className="text-2xl">▶</div>
                <div className="text-left leading-tight">
                  <div className="text-[9px] opacity-80">DISPONÍVEL NO</div>
                  <div className="text-sm font-semibold">Google Play</div>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="bg-black text-white px-3 py-2 rounded-lg flex items-center gap-2 h-14">
                <div className="text-2xl"></div>
                <div className="text-left leading-tight">
                  <div className="text-[9px] opacity-80">Disponível na</div>
                  <div className="text-sm font-semibold">App Store</div>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={sending}
            className="w-full mt-6 py-3 px-4 rounded-lg bg-[#7C5CFC] text-white font-semibold text-base hover:bg-[#6B4CE8] transition disabled:opacity-60"
          >
            {sending ? "Cadastrando..." : "Cadastrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
