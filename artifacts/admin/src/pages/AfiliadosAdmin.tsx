import { useState, useEffect } from "react";
import { useAuth, API, authHeaders } from "@/lib/auth";
import { Download, CheckCircle, Users, DollarSign, Wallet, Settings, RefreshCcw, UserCheck, Trash2 } from "lucide-react";

function fmt(v: number | string) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

const statusColors: Record<string, string> = {
  pendente: "bg-yellow-100 text-yellow-700 border border-yellow-200",
  processando: "bg-blue-100 text-blue-700 border border-blue-200",
  pago: "bg-green-100 text-green-700 border border-green-200",
  cancelado: "bg-red-100 text-red-600 border border-red-200",
};

type Tab = "saques" | "afiliados" | "indicacoes" | "config";

const indicacaoStatusColors: Record<string, string> = {
  ativo: "bg-green-100 text-green-700 border border-green-200",
  inativo: "bg-gray-100 text-gray-600 border border-gray-200",
  pendente: "bg-yellow-100 text-yellow-700 border border-yellow-200",
  sem_cadastro: "bg-orange-100 text-orange-700 border border-orange-200",
};

export default function AfiliadosAdmin() {
  const { token } = useAuth();
  const hdrs = { ...authHeaders(token), "Content-Type": "application/json" };

  const [tab, setTab] = useState<Tab>("saques");
  const [saques, setSaques] = useState<any[]>([]);
  const [afiliados, setAfiliados] = useState<any[]>([]);
  const [indicacoes, setIndicacoes] = useState<any[]>([]);
  const [buscaInd, setBuscaInd] = useState("");
  const [removendoInd, setRemovendoInd] = useState<number | null>(null);
  const [config, setConfig] = useState<any>({ percentual_comissao: 10, valor_minimo_saque: 50 });
  const [loading, setLoading] = useState(false);
  const [pagando, setPagando] = useState<number | null>(null);
  const [savedConfig, setSavedConfig] = useState(false);
  const [filterStatus, setFilterStatus] = useState("pendente");

  const AFIL_API = API.replace("/admin", "/afiliados");

  async function loadSaques() {
    setLoading(true);
    try {
      const r = await fetch(`${AFIL_API}/admin/saques?status=${filterStatus}`, { headers: hdrs });
      if (r.ok) setSaques(await r.json());
    } finally { setLoading(false); }
  }

  async function loadAfiliados() {
    setLoading(true);
    try {
      const r = await fetch(`${AFIL_API}/admin/lista`, { headers: hdrs });
      if (r.ok) setAfiliados(await r.json());
    } finally { setLoading(false); }
  }

  async function loadIndicacoes() {
    setLoading(true);
    try {
      const r = await fetch(`${AFIL_API}/admin/indicacoes`, { headers: hdrs });
      if (r.ok) setIndicacoes(await r.json());
    } finally { setLoading(false); }
  }

  async function loadConfig() {
    const r = await fetch(`${AFIL_API}/admin/config`, { headers: hdrs });
    if (r.ok) setConfig(await r.json());
  }

  useEffect(() => {
    if (tab === "saques") loadSaques();
    else if (tab === "afiliados") loadAfiliados();
    else if (tab === "indicacoes") loadIndicacoes();
    else loadConfig();
  }, [tab, filterStatus]);

  async function handleExcluirIndicacao(id: number, nome: string) {
    if (!confirm(`Excluir a indicação "${nome}"?\n\nEsta ação não pode ser desfeita.`)) return;
    setRemovendoInd(id);
    try {
      const r = await fetch(`${AFIL_API}/admin/indicacoes/${id}`, {
        method: "DELETE",
        headers: hdrs,
      });
      if (r.ok) {
        setIndicacoes(curr => curr.filter(i => i.id !== id));
      } else {
        alert("Erro ao excluir indicação");
      }
    } catch {
      alert("Erro de conexão ao excluir");
    } finally {
      setRemovendoInd(null);
    }
  }

  async function handlePagar(id: number) {
    if (!confirm("Confirmar pagamento deste saque?")) return;
    setPagando(id);
    try {
      await fetch(`${AFIL_API}/admin/pagar`, {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify({ resgate_id: id, observacao: "Pago via admin" }),
      });
      loadSaques();
    } finally { setPagando(null); }
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`${AFIL_API}/admin/config`, {
      method: "PATCH",
      headers: hdrs,
      body: JSON.stringify({ percentual_comissao: Number(config.percentual_comissao), valor_minimo_saque: Number(config.valor_minimo_saque) }),
    });
    setSavedConfig(true);
    setTimeout(() => setSavedConfig(false), 2000);
  }

  function downloadCSV() {
    fetch(`${AFIL_API}/admin/relatorio.csv`, { headers: hdrs })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "afiliados-gotaxi.csv";
        a.click();
        URL.revokeObjectURL(url);
      });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Programa de Afiliados</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie saques, afiliados e configurações do programa</p>
        </div>
        <button onClick={downloadCSV} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition">
          <Download size={16} />
          Exportar CSV
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit">
        {([
          { id: "saques", label: "Saques Pendentes", icon: Wallet },
          { id: "afiliados", label: "Todos Afiliados", icon: Users },
          { id: "indicacoes", label: "Indicações", icon: UserCheck },
          { id: "config", label: "Configurações", icon: Settings },
        ] as { id: Tab; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* SAQUES */}
      {tab === "saques" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {["pendente", "processando", "pago", "cancelado"].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                  filterStatus === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
            <button onClick={loadSaques} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-muted text-muted-foreground hover:text-foreground">
              <RefreshCcw size={13} />
              Atualizar
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : saques.length === 0 ? (
            <div className="bg-card border rounded-xl p-16 text-center">
              <Wallet size={36} className="text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">Nenhum saque com status "{filterStatus}"</p>
              <p className="text-sm text-muted-foreground mt-1">Os saques aparecerão aqui quando solicitados</p>
            </div>
          ) : (
            <div className="bg-card border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-5 py-3.5 font-medium text-muted-foreground">Afiliado</th>
                    <th className="text-left px-5 py-3.5 font-medium text-muted-foreground">Código</th>
                    <th className="text-right px-5 py-3.5 font-medium text-muted-foreground">Valor</th>
                    <th className="text-left px-5 py-3.5 font-medium text-muted-foreground">Chave Pix</th>
                    <th className="text-left px-5 py-3.5 font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-5 py-3.5 font-medium text-muted-foreground">Solicitado</th>
                    <th className="text-center px-5 py-3.5 font-medium text-muted-foreground">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {saques.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-medium">{s.nome}</div>
                        <div className="text-xs text-muted-foreground">{s.email}</div>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-primary font-bold">{s.codigo}</td>
                      <td className="px-5 py-4 text-right font-bold text-lg">{fmt(s.valor)}</td>
                      <td className="px-5 py-4 font-mono text-xs">{s.chave_pix || "—"}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[s.status] || "bg-gray-100 text-gray-600"}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right text-muted-foreground">{fmtDate(s.criado_em)}</td>
                      <td className="px-5 py-4 text-center">
                        {s.status === "pendente" && (
                          <button
                            onClick={() => handlePagar(s.id)}
                            disabled={pagando === s.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600 transition disabled:opacity-50 mx-auto"
                          >
                            <CheckCircle size={13} />
                            {pagando === s.id ? "..." : "Pago"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-3 bg-muted/20 border-t text-xs text-muted-foreground">
                {saques.length} saque(s) · Total: {fmt(saques.reduce((s, r) => s + Number(r.valor), 0))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AFILIADOS */}
      {tab === "afiliados" && (
        <div>
          {loading ? (
            <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : afiliados.length === 0 ? (
            <div className="bg-card border rounded-xl p-16 text-center">
              <Users size={36} className="text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">Nenhum afiliado cadastrado ainda</p>
            </div>
          ) : (
            <div className="bg-card border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-5 py-3.5 font-medium text-muted-foreground">Afiliado</th>
                    <th className="text-left px-5 py-3.5 font-medium text-muted-foreground">Código</th>
                    <th className="text-right px-5 py-3.5 font-medium text-muted-foreground">Indicados</th>
                    <th className="text-right px-5 py-3.5 font-medium text-muted-foreground">Comissões</th>
                    <th className="text-right px-5 py-3.5 font-medium text-muted-foreground">Saldo</th>
                    <th className="text-right px-5 py-3.5 font-medium text-muted-foreground">Total Ganho</th>
                    <th className="text-right px-5 py-3.5 font-medium text-muted-foreground">Saque Pend.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {afiliados.map((a) => (
                    <tr key={a.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-medium">{a.nome}</div>
                        <div className="text-xs text-muted-foreground">{a.email}</div>
                        {a.telefone && <div className="text-xs text-muted-foreground">{a.telefone}</div>}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-primary font-bold">{a.codigo}</td>
                      <td className="px-5 py-4 text-right">{a.qtd_indicados ?? 0}</td>
                      <td className="px-5 py-4 text-right">{a.qtd_comissoes ?? 0}</td>
                      <td className="px-5 py-4 text-right font-medium text-green-600">{fmt(a.saldo)}</td>
                      <td className="px-5 py-4 text-right font-medium">{fmt(a.total_ganhos)}</td>
                      <td className="px-5 py-4 text-right text-amber-600 font-medium">
                        {Number(a.saldo_pendente_saque) > 0 ? fmt(a.saldo_pendente_saque) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-3 bg-muted/20 border-t text-xs text-muted-foreground">
                {afiliados.length} afiliado(s) · Total ganho: {fmt(afiliados.reduce((s, a) => s + Number(a.total_ganhos ?? 0), 0))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* INDICAÇÕES */}
      {tab === "indicacoes" && (
        <div className="space-y-4">
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={buscaInd}
              onChange={e => setBuscaInd(e.target.value)}
              placeholder="Buscar por nome, e-mail ou afiliado..."
              className="flex-1 px-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button onClick={loadIndicacoes} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs bg-muted text-muted-foreground hover:text-foreground">
              <RefreshCcw size={13} />
              Atualizar
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
          ) : indicacoes.length === 0 ? (
            <div className="bg-card border rounded-xl p-16 text-center">
              <UserCheck size={36} className="text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">Nenhuma indicação cadastrada</p>
            </div>
          ) : (
            (() => {
              const q = buscaInd.trim().toLowerCase();
              const filtered = q
                ? indicacoes.filter(i =>
                    (i.nome_indicado || "").toLowerCase().includes(q) ||
                    (i.email_indicado || "").toLowerCase().includes(q) ||
                    (i.afiliado_nome || "").toLowerCase().includes(q)
                  )
                : indicacoes;
              return (
                <div className="bg-card border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-5 py-3.5 font-medium text-muted-foreground">Indicado</th>
                        <th className="text-left px-5 py-3.5 font-medium text-muted-foreground">Afiliado</th>
                        <th className="text-left px-5 py-3.5 font-medium text-muted-foreground">Tipo</th>
                        <th className="text-left px-5 py-3.5 font-medium text-muted-foreground">Status</th>
                        <th className="text-right px-5 py-3.5 font-medium text-muted-foreground">Data</th>
                        <th className="text-center px-5 py-3.5 font-medium text-muted-foreground">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filtered.map((i) => (
                        <tr key={i.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-4">
                            <div className="font-medium">{i.nome_indicado || "—"}</div>
                            {i.email_indicado && <div className="text-xs text-muted-foreground">{i.email_indicado}</div>}
                          </td>
                          <td className="px-5 py-4">
                            <div className="font-medium">{i.afiliado_nome || "—"}</div>
                            {i.afiliado_codigo && <div className="text-xs font-mono text-primary">{i.afiliado_codigo}</div>}
                          </td>
                          <td className="px-5 py-4 text-muted-foreground capitalize">{i.tipo_indicado || "usuário"}</td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${indicacaoStatusColors[i.status] || "bg-gray-100 text-gray-600"}`}>
                              {i.status === "sem_cadastro" ? "sem cadastro" : i.status}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right text-muted-foreground">{fmtDate(i.criado_em)}</td>
                          <td className="px-5 py-4 text-center">
                            <button
                              onClick={() => handleExcluirIndicacao(i.id, i.nome_indicado || `#${i.id}`)}
                              disabled={removendoInd === i.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-medium transition disabled:opacity-50"
                              title="Excluir indicação"
                            >
                              <Trash2 size={13} />
                              {removendoInd === i.id ? "..." : "Excluir"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-5 py-3 bg-muted/20 border-t text-xs text-muted-foreground">
                    {filtered.length} de {indicacoes.length} indicação(ões)
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* CONFIG */}
      {tab === "config" && (
        <div className="max-w-md">
          <div className="bg-card border rounded-xl p-6">
            <h2 className="text-base font-semibold mb-5">Configurações do Programa</h2>
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Percentual de Comissão do Afiliado (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={config.percentual_comissao}
                  onChange={e => setConfig({ ...config, percentual_comissao: e.target.value })}
                  className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  % do <strong>lucro GoTaxi</strong> que vai para o afiliado. O GoTaxi cobra 3% de cada corrida/pedido, e o afiliado recebe este % sobre esse valor.
                  <br />Exemplo: corrida R$ 100 → GoTaxi = R$ 3 → afiliado ({config.percentual_comissao ?? 10}%) = R$ {((3 * Number(config.percentual_comissao ?? 10)) / 100).toFixed(2)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Valor Mínimo para Saque (R$)</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={config.valor_minimo_saque}
                  onChange={e => setConfig({ ...config, valor_minimo_saque: e.target.value })}
                  className="w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <button
                type="submit"
                className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  savedConfig ? "bg-green-500 text-white" : "bg-primary text-primary-foreground hover:opacity-90"
                }`}
              >
                {savedConfig ? "✓ Salvo!" : "Salvar Configurações"}
              </button>
            </form>
          </div>

          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
            <strong>Modelo de comissão:</strong> O afiliado recebe <strong>{config.percentual_comissao ?? 10}%</strong> do lucro GoTaxi (3% de cada transação). Não é sobre o valor total da corrida.
          </div>
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            <strong>Atenção:</strong> Alterar o percentual afeta apenas novas comissões. Comissões já aprovadas não são recalculadas.
          </div>
        </div>
      )}
    </div>
  );
}
