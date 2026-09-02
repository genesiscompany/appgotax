const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE.replace("/afiliados", "")}/api/afiliados`;

export function getToken() {
  return localStorage.getItem("afiliado_token");
}
export function setToken(t: string) {
  localStorage.setItem("afiliado_token", t);
}
export function clearToken() {
  localStorage.removeItem("afiliado_token");
  localStorage.removeItem("afiliado_usuario");
  localStorage.removeItem("afiliado_data");
}

function headers() {
  const t = getToken();
  return {
    "Content-Type": "application/json",
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

async function req(method: string, path: string, body?: any) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: headers(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(err.error || err.message || "Erro na requisição");
  }
  return r.json();
}

export const api = {
  login: (identificador: string, senha: string) => req("POST", "/login", { identificador, senha }),
  cadastrarIndicado: (data: any) => req("POST", "/cadastrar-indicado", data),
  dashboard: () => req("GET", "/dashboard"),
  indicados: () => req("GET", "/indicados"),
  comissoes: () => req("GET", "/comissoes"),
  resgates: () => req("GET", "/resgates"),
  resgatar: (valor: number, chave_pix: string) => req("POST", "/resgatar", { valor, chave_pix }),
  updatePerfil: (data: any) => req("PATCH", "/perfil", data),
  qrcodeLink: () => req("GET", "/qrcode-link"),
  relatorioUrl: () => `${API}/relatorio.csv`,
  publicReferral: (codigo: string) => fetch(`${API}/r/${codigo}`).then(r => r.json()),
  registrarIndicacao: (data: any) => req("POST", "/registrar-indicacao", data),
};

export function formatBRL(v: number | string | null | undefined) {
  const n = Number(v ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}
