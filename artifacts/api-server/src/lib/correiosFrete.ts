// Frete Correios estimado por tabela (sem API dos Correios).
// A zona é derivada das faixas oficiais de CEP por UF; o preço vem da tabela da loja.

export type ZonaCorreios = "local" | "estadual" | "regional" | "nacional";
export type ServicoCorreios = "pac" | "sedex";

export type FaixaPreco = { base: number; kg_adicional: number; prazo_dias: number };
export type TabelaCorreios = Record<ServicoCorreios, Record<ZonaCorreios, FaixaPreco>>;

export const ZONAS: ZonaCorreios[] = ["local", "estadual", "regional", "nacional"];
export const SERVICOS: ServicoCorreios[] = ["pac", "sedex"];

export const ZONA_LABEL: Record<ZonaCorreios, string> = {
  local: "Mesma região",
  estadual: "Mesmo estado",
  regional: "Mesma região do país",
  nacional: "Outras regiões",
};

export const SERVICO_LABEL: Record<ServicoCorreios, string> = { pac: "PAC", sedex: "SEDEX" };

export const TABELA_PADRAO: TabelaCorreios = {
  pac: {
    local:    { base: 19.9, kg_adicional: 2.5, prazo_dias: 3 },
    estadual: { base: 24.9, kg_adicional: 3.5, prazo_dias: 5 },
    regional: { base: 32.9, kg_adicional: 5,   prazo_dias: 7 },
    nacional: { base: 42.9, kg_adicional: 7,   prazo_dias: 10 },
  },
  sedex: {
    local:    { base: 24.9, kg_adicional: 3,   prazo_dias: 1 },
    estadual: { base: 34.9, kg_adicional: 5,   prazo_dias: 2 },
    regional: { base: 49.9, kg_adicional: 8,   prazo_dias: 3 },
    nacional: { base: 69.9, kg_adicional: 12,  prazo_dias: 5 },
  },
};

export const PESO_MAXIMO_KG = 30;

// Faixas de CEP (5 primeiros dígitos) por UF, conforme Correios.
const FAIXAS_UF: Array<[number, number, string]> = [
  [1000, 19999, "SP"], [20000, 28999, "RJ"], [29000, 29999, "ES"], [30000, 39999, "MG"],
  [40000, 48999, "BA"], [49000, 49999, "SE"], [50000, 56999, "PE"], [57000, 57999, "AL"],
  [58000, 58999, "PB"], [59000, 59999, "RN"], [60000, 63999, "CE"], [64000, 64999, "PI"],
  [65000, 65999, "MA"], [66000, 68899, "PA"], [68900, 68999, "AP"], [69000, 69299, "AM"],
  [69300, 69399, "RR"], [69400, 69899, "AM"], [69900, 69999, "AC"], [70000, 72799, "DF"],
  [72800, 72999, "GO"], [73000, 73699, "DF"], [73700, 76799, "GO"], [76800, 76999, "RO"],
  [77000, 77999, "TO"], [78000, 78899, "MT"], [79000, 79999, "MS"], [80000, 87999, "PR"],
  [88000, 89999, "SC"], [90000, 99999, "RS"],
];

const REGIAO_UF: Record<string, string> = {
  AC: "N", AP: "N", AM: "N", PA: "N", RO: "N", RR: "N", TO: "N",
  AL: "NE", BA: "NE", CE: "NE", MA: "NE", PB: "NE", PE: "NE", PI: "NE", RN: "NE", SE: "NE",
  DF: "CO", GO: "CO", MT: "CO", MS: "CO",
  ES: "SE", MG: "SE", RJ: "SE", SP: "SE",
  PR: "S", RS: "S", SC: "S",
};

export function normalizarCep(cep: unknown): string | null {
  const digits = String(cep ?? "").replace(/\D/g, "");
  return digits.length === 8 ? digits : null;
}

export function ufDoCep(cep: string): string | null {
  const prefixo = Number(cep.slice(0, 5));
  const faixa = FAIXAS_UF.find(([ini, fim]) => prefixo >= ini && prefixo <= fim);
  return faixa ? faixa[2] : null;
}

export function zonaEnvio(cepOrigem: string, cepDestino: string): ZonaCorreios | null {
  const ufO = ufDoCep(cepOrigem);
  const ufD = ufDoCep(cepDestino);
  if (!ufO || !ufD) return null;
  if (ufO === ufD && cepOrigem.slice(0, 3) === cepDestino.slice(0, 3)) return "local";
  if (ufO === ufD) return "estadual";
  if (REGIAO_UF[ufO] === REGIAO_UF[ufD]) return "regional";
  return "nacional";
}

function num(v: unknown, fallback: number, min = 0, max = 100000): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
}

// Mescla a tabela salva (possivelmente parcial/antiga) com a padrão.
export function normalizarTabela(raw: unknown): TabelaCorreios {
  const src = (raw && typeof raw === "object" ? raw : {}) as any;
  const out = {} as TabelaCorreios;
  for (const s of SERVICOS) {
    out[s] = {} as Record<ZonaCorreios, FaixaPreco>;
    for (const z of ZONAS) {
      const def = TABELA_PADRAO[s][z];
      const v = src?.[s]?.[z] ?? {};
      out[s][z] = {
        base: Math.round(num(v.base, def.base) * 100) / 100,
        kg_adicional: Math.round(num(v.kg_adicional, def.kg_adicional) * 100) / 100,
        prazo_dias: Math.round(num(v.prazo_dias, def.prazo_dias, 0, 90)),
      };
    }
  }
  return out;
}

export function precoFrete(faixa: FaixaPreco, pesoKg: number): number {
  const kgExtra = Math.max(0, Math.ceil(pesoKg - 1));
  return Math.round((faixa.base + kgExtra * faixa.kg_adicional) * 100) / 100;
}

export type OpcaoFrete = { servico: ServicoCorreios; nome: string; valor: number; prazo_dias: number };

export function cotarCorreios(tabela: TabelaCorreios, zona: ZonaCorreios, pesoKg: number): OpcaoFrete[] {
  return SERVICOS.map((s) => ({
    servico: s,
    nome: SERVICO_LABEL[s],
    valor: precoFrete(tabela[s][zona], pesoKg),
    prazo_dias: tabela[s][zona].prazo_dias,
  }));
}
