import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Heart, MapPin, Users, HandHeart, Copy, Building2, Search } from "lucide-react";
import Logo from "@/components/Logo";
import Modal from "@/components/Modal";
import { api, brl, CATEGORIAS, PRIORIDADES } from "@/lib/api";

type Necessidade = {
  id: number; centro_id: number; titulo: string; descricao: string | null; categoria: string; quantidade: string | null;
  prioridade: string; recuperando: string | null; recuperando_idade: number | null;
};
type CentroPublico = {
  id: number; nome: string; cidade: string | null; uf: string | null; descricao: string | null; necessidades: string | null;
  quantidade_recuperandos: number; necessidades_lista: Necessidade[];
};
type Pix = { configurado: boolean; chave?: string; nome?: string; texto?: string; brcode?: string; valor?: number | null };

const origemAtual = () => {
  const o = new URLSearchParams(window.location.search).get("origem");
  return o && ["app_cliente", "app_pro", "pdv"].includes(o) ? o : "site";
};
const corPrioridade: Record<string, string> = {
  alta: "bg-red-100 text-red-700", media: "bg-amber-100 text-amber-700", baixa: "bg-gray-100 text-gray-600",
};

export default function Publico() {
  const [centros, setCentros] = useState<CentroPublico[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [doarDinheiro, setDoarDinheiro] = useState(false);
  const [doarItem, setDoarItem] = useState<{ centro: CentroPublico; necessidade?: Necessidade } | null>(null);
  const embutido = origemAtual() !== "site";

  useEffect(() => {
    api.get<CentroPublico[]>("/publico/centros").then(setCentros).catch(() => toast.error("Não foi possível carregar os centros.")).finally(() => setLoading(false));
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return centros;
    return centros.filter((c) => [c.nome, c.cidade, c.uf, ...c.necessidades_lista.map((n) => n.titulo)].join(" ").toLowerCase().includes(q));
  }, [centros, busca]);

  return (
    <div className="min-h-screen">
      <header className="bg-gradient-to-br from-sos to-sos-dark text-white">
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between gap-3">
          <Logo claro />
          {!embutido && <Link href="/entrar" className="text-sm font-semibold bg-white/15 hover:bg-white/25 px-3 py-2 rounded-xl">Área do centro</Link>}
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-10 pt-4">
          <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight">Ajude quem está recomeçando</h1>
          <p className="mt-2 text-red-100 max-w-2xl">Centros de recuperação, ONGs e institutos parceiros da GoTaxi mostram aqui o que precisam. Doe dinheiro pelo PIX da GoTaxi ou ofereça itens direto para um centro.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => setDoarDinheiro(true)} className="inline-flex items-center gap-2 bg-white text-sos font-bold px-5 py-3 rounded-xl shadow-lg"><Heart size={18} /> Doar dinheiro (PIX)</button>
            <a href="#centros" className="inline-flex items-center gap-2 border border-white/40 font-semibold px-5 py-3 rounded-xl"><HandHeart size={18} /> Doar itens</a>
            {!embutido && <Link href="/cadastro" className="inline-flex items-center gap-2 border border-white/40 font-semibold px-5 py-3 rounded-xl"><Building2 size={18} /> Cadastrar meu centro / ONG</Link>}
          </div>
        </div>
      </header>

      <main id="centros" className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <h2 className="text-xl font-bold">Centros e necessidades</h2>
          <div className="relative sm:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-9" placeholder="Buscar por cidade, centro ou item" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </div>

        {loading ? <p className="text-gray-500">Carregando…</p> : filtrados.length === 0 ? (
          <div className="card p-8 text-center text-gray-500">
            <Building2 className="mx-auto mb-2 text-gray-300" size={36} />
            Nenhum centro encontrado.
          </div>
        ) : (
          <div className="space-y-5">
            {filtrados.map((c) => (
              <section key={c.id} className="card p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-lg">{c.nome}</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 mt-1">
                      {(c.cidade || c.uf) && <span className="inline-flex items-center gap-1"><MapPin size={14} />{[c.cidade, c.uf].filter(Boolean).join(" / ")}</span>}
                      <span className="inline-flex items-center gap-1"><Users size={14} />{c.quantidade_recuperandos} recuperandos</span>
                    </div>
                    {c.descricao && <p className="text-sm text-gray-600 mt-2 whitespace-pre-line">{c.descricao}</p>}
                  </div>
                  <button className="btn-outline shrink-0" onClick={() => setDoarItem({ centro: c })}><HandHeart size={16} /> Quero doar</button>
                </div>
                {c.necessidades && <p className="mt-3 text-sm bg-red-50 text-red-900 rounded-xl p-3 whitespace-pre-line"><b>O que mais precisamos:</b> {c.necessidades}</p>}
                {c.necessidades_lista.length > 0 && (
                  <div className="mt-4 grid sm:grid-cols-2 gap-3">
                    {c.necessidades_lista.map((n) => (
                      <div key={n.id} className="border border-gray-100 rounded-xl p-3 flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-sm">{n.titulo}{n.quantidade ? <span className="text-gray-500 font-normal"> · {n.quantidade}</span> : null}</p>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${corPrioridade[n.prioridade] ?? ""}`}>{PRIORIDADES[n.prioridade]}</span>
                        </div>
                        <p className="text-xs text-gray-500">{CATEGORIAS[n.categoria] ?? n.categoria}{n.recuperando ? ` · ${n.recuperando}${n.recuperando_idade ? `, ${n.recuperando_idade} anos` : ""}` : ""}</p>
                        {n.descricao && <p className="text-sm text-gray-600">{n.descricao}</p>}
                        <button className="text-sm font-semibold text-sos self-start hover:underline" onClick={() => n.categoria === "dinheiro" ? setDoarDinheiro(true) : setDoarItem({ centro: c, necessidade: n })}>
                          {n.categoria === "dinheiro" ? "Doar pelo PIX" : "Quero doar este item"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </main>

      {!embutido && (
        <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-500">
          SOS GoTaxi · Uma iniciativa GoTaxi Brasil Plus · <Link href="/entrar" className="underline">Área do centro</Link>
        </footer>
      )}

      {doarDinheiro && <DoarDinheiro onClose={() => setDoarDinheiro(false)} />}
      {doarItem && <DoarItem {...doarItem} onClose={() => setDoarItem(null)} />}
    </div>
  );
}

function DoarDinheiro({ onClose }: { onClose: () => void }) {
  const [valor, setValor] = useState("");
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [pix, setPix] = useState<Pix | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const valorNum = Number(valor.replace(/\./g, "").replace(",", "."));

  useEffect(() => {
    const t = setTimeout(() => {
      const q = valorNum > 0 ? `?valor=${valorNum.toFixed(2)}` : "";
      api.get<Pix>(`/publico/pix${q}`).then(setPix).catch(() => setPix({ configurado: false }));
    }, 300);
    return () => clearTimeout(t);
  }, [valorNum]);

  async function informar() {
    if (!(valorNum > 0)) { toast.error("Digite o valor que você doou."); return; }
    setEnviando(true);
    try {
      await api.post("/publico/doacoes", { tipo: "dinheiro", valor: valorNum.toFixed(2), doador_nome: nome, doador_contato: contato, origem: origemAtual() });
      setConcluido(true);
    } catch (e: any) { toast.error(e.message); } finally { setEnviando(false); }
  }

  if (concluido) return (
    <Modal titulo="Obrigado!" onClose={onClose}>
      <div className="text-center py-4">
        <Heart className="mx-auto text-sos mb-3" size={40} />
        <p className="font-semibold">Sua doação de {brl(valorNum)} foi registrada.</p>
        <p className="text-sm text-gray-500 mt-1">A GoTaxi distribui os valores recebidos entre os centros parceiros.</p>
        <button className="btn mt-5" onClick={onClose}>Fechar</button>
      </div>
    </Modal>
  );

  return (
    <Modal titulo="Doar dinheiro pelo PIX" onClose={onClose}>
      {pix && !pix.configurado ? (
        <p className="text-sm text-gray-600">A chave PIX de doação ainda não foi cadastrada. Volte em breve.</p>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="label">Valor da doação (R$)</label>
            <input className="input text-lg font-semibold" inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value.replace(/[^\d,.]/g, ""))} />
            <div className="flex gap-2 mt-2">
              {[10, 25, 50, 100].map((v) => <button key={v} className="btn-outline px-3 py-1.5 text-xs" onClick={() => setValor(String(v))}>{brl(v)}</button>)}
            </div>
          </div>
          {pix?.brcode && (
            <div className="text-center bg-gray-50 rounded-2xl p-4">
              <div className="inline-block bg-white p-3 rounded-xl"><QRCodeSVG value={pix.brcode} size={190} /></div>
              <p className="text-xs text-gray-500 mt-2">{pix.nome} · Chave: <b>{pix.chave}</b></p>
              <button className="btn-outline mt-3 text-xs" onClick={() => { navigator.clipboard.writeText(pix.brcode!); toast.success("PIX copia e cola copiado"); }}>
                <Copy size={14} /> Copiar PIX copia e cola
              </button>
              {pix.texto && <p className="text-xs text-gray-500 mt-3 whitespace-pre-line">{pix.texto}</p>}
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="label">Seu nome (opcional)</label><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <div><label className="label">WhatsApp ou e-mail (opcional)</label><input className="input" value={contato} onChange={(e) => setContato(e.target.value)} /></div>
          </div>
          <button className="btn w-full" disabled={enviando} onClick={informar}>{enviando ? "Registrando…" : "Já fiz o PIX — registrar doação"}</button>
        </div>
      )}
    </Modal>
  );
}

function DoarItem({ centro, necessidade, onClose }: { centro: CentroPublico; necessidade?: Necessidade; onClose: () => void }) {
  const [necessidadeId, setNecessidadeId] = useState<number | "">(necessidade?.id ?? "");
  const [descricao, setDescricao] = useState(necessidade ? `${necessidade.titulo}${necessidade.quantidade ? ` (${necessidade.quantidade})` : ""}` : "");
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState(false);

  async function enviar() {
    if (!descricao.trim()) { toast.error("Descreva o que você vai doar."); return; }
    if (!nome.trim() || !contato.trim()) { toast.error("Informe seu nome e contato para o centro combinar a entrega."); return; }
    setEnviando(true);
    try {
      await api.post("/publico/doacoes", { tipo: "item", centro_id: centro.id, necessidade_id: necessidadeId || undefined, descricao, doador_nome: nome, doador_contato: contato, origem: origemAtual() });
      setConcluido(true);
    } catch (e: any) { toast.error(e.message); } finally { setEnviando(false); }
  }

  if (concluido) return (
    <Modal titulo="Obrigado!" onClose={onClose}>
      <div className="text-center py-4">
        <HandHeart className="mx-auto text-sos mb-3" size={40} />
        <p className="font-semibold">Sua doação para {centro.nome} foi registrada.</p>
        <p className="text-sm text-gray-500 mt-1">O centro vai entrar em contato para combinar a entrega.</p>
        <button className="btn mt-5" onClick={onClose}>Fechar</button>
      </div>
    </Modal>
  );

  return (
    <Modal titulo={`Doar itens para ${centro.nome}`} onClose={onClose}>
      <div className="space-y-3">
        {centro.necessidades_lista.length > 0 && (
          <div>
            <label className="label">Para qual necessidade?</label>
            <select className="input" value={necessidadeId} onChange={(e) => setNecessidadeId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Doação geral</option>
              {centro.necessidades_lista.filter((n) => n.categoria !== "dinheiro").map((n) => <option key={n.id} value={n.id}>{n.titulo}</option>)}
            </select>
          </div>
        )}
        <div><label className="label">O que você vai doar?</label><textarea className="input" rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: 2 cestas básicas, 10 kits de higiene" /></div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label">Seu nome</label><input className="input" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div><label className="label">WhatsApp ou e-mail</label><input className="input" value={contato} onChange={(e) => setContato(e.target.value)} /></div>
        </div>
        <button className="btn w-full" disabled={enviando} onClick={enviar}>{enviando ? "Enviando…" : "Registrar doação"}</button>
      </div>
    </Modal>
  );
}
