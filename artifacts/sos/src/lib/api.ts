const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api/sos`;
const TOKEN_KEY = "sos_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function req<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const t = getToken();
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && t) {
    clearToken();
    window.location.href = `${BASE}/entrar`;
  }
  if (!r.ok) throw new Error(data.error || "Erro na requisição");
  return data as T;
}

export const api = {
  get: <T = any>(p: string) => req<T>("GET", p),
  post: <T = any>(p: string, b?: unknown) => req<T>("POST", p, b),
  put: <T = any>(p: string, b?: unknown) => req<T>("PUT", p, b),
  patch: <T = any>(p: string, b?: unknown) => req<T>("PATCH", p, b),
  del: <T = any>(p: string) => req<T>("DELETE", p),
};

export type Centro = {
  id: number; razao_social: string; nome_fantasia: string | null; cnpj: string; endereco: string; cidade: string | null;
  uf: string | null; telefone: string; email: string; descricao: string | null; necessidades: string | null;
  quantidade_recuperandos: number; banco_nome: string | null; banco_agencia: string | null; banco_conta: string | null;
  banco_tipo_conta: string | null; banco_titular: string | null; banco_chave_pix: string | null;
  status: "pendente" | "aprovado" | "bloqueado"; motivo_status: string | null;
};

export const CATEGORIAS: Record<string, string> = {
  alimentos: "Alimentos", higiene: "Higiene", limpeza: "Limpeza", roupas: "Roupas", remedios: "Remédios",
  moveis: "Móveis/Utensílios", dinheiro: "Dinheiro", outros: "Outros",
};
export const PRIORIDADES: Record<string, string> = { alta: "Urgente", media: "Média", baixa: "Baixa" };
export const STATUS_RECUPERANDO: Record<string, string> = {
  em_tratamento: "Em tratamento", em_observacao: "Em observação", concluido: "Concluiu o tratamento",
  desistente: "Desistiu", transferido: "Transferido",
};

export const brl = (v: number | string | null | undefined) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dataBR = (d: string | null | undefined) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
export const cnpjFmt = (c: string) => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
