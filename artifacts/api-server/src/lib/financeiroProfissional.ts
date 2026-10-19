import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export const CATEGORIAS_DESPESA = ["combustivel", "manutencao", "outras"] as const;
export type CategoriaDespesa = typeof CATEGORIAS_DESPESA[number];

let ready = false;
export async function ensureDespesasTable() {
  if (ready) return;
  await db.execute(sql`CREATE TABLE IF NOT EXISTS motorista_despesas (
    id SERIAL PRIMARY KEY,
    motorista_id INTEGER NOT NULL,
    categoria VARCHAR(20) NOT NULL,
    valor NUMERIC(10,2) NOT NULL,
    data DATE NOT NULL DEFAULT CURRENT_DATE,
    descricao VARCHAR(300),
    criado_em TIMESTAMP NOT NULL DEFAULT NOW()
  )`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_motorista_despesas_motorista_data ON motorista_despesas (motorista_id, data)`);
  ready = true;
}

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function hojeIso() { return iso(new Date()); }

/** Período inclusivo em datas YYYY-MM-DD; padrão = mês atual até hoje. */
export function lerPeriodo(query: any): { de: string; ate: string } {
  const hoje = new Date();
  let de = DATA_RE.test(String(query?.de ?? "")) ? String(query.de) : iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  let ate = DATA_RE.test(String(query?.ate ?? "")) ? String(query.ate) : iso(hoje);
  if (de > ate) [de, ate] = [ate, de];
  return { de, ate };
}

export function lerDespesa(body: any): { categoria: CategoriaDespesa; valor: number; data: string; descricao: string | null } | string {
  const categoria = String(body?.categoria ?? "") as CategoriaDespesa;
  if (!CATEGORIAS_DESPESA.includes(categoria)) return "categoria_invalida";
  const valor = Math.round(Number(String(body?.valor ?? "").replace(",", ".")) * 100) / 100;
  if (!Number.isFinite(valor) || valor <= 0 || valor > 100000) return "valor_invalido";
  const data = DATA_RE.test(String(body?.data ?? "")) ? String(body.data) : hojeIso();
  if (data > hojeIso()) return "data_futura";
  const descricao = String(body?.descricao ?? "").trim().slice(0, 300) || null;
  return { categoria, valor, data, descricao };
}

async function somar(query: ReturnType<typeof sql>): Promise<{ total: number; qtd: number }> {
  try {
    const r = (await db.execute(query)).rows[0] as any;
    return { total: Number(r?.total ?? 0), qtd: Number(r?.qtd ?? 0) };
  } catch {
    return { total: 0, qtd: 0 };
  }
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Lucro do profissional no período: ganho líquido (mesma regra da tela Ganhos:
 * corridas/entregas menos o repasse; entregas do PDV são isentas) menos as despesas.
 */
export async function calcularFinanceiro(motoristaId: number, de: string, ate: string) {
  await ensureDespesasTable();
  const perfil = (await db.execute(sql`SELECT tipo_profissional, percentual_repasse FROM motoristas_app WHERE id = ${motoristaId}`)).rows[0] as any;
  const repassePct = Number(perfil?.percentual_repasse) || 3;
  const isEntregador = perfil?.tipo_profissional === "entregador" || perfil?.tipo_profissional === "delivery";

  const taxavel = isEntregador
    ? await somar(sql`SELECT COALESCE(SUM(valor_estimado), 0) AS total, COUNT(*) AS qtd FROM entregas_solicitadas
        WHERE status = 'finalizada' AND profissional_id = ${motoristaId} AND pedido_pdv_id IS NULL
          AND COALESCE(tipo_servico, '') <> 'delivery'
          AND criado_em >= ${de}::date AND criado_em < ${ate}::date + 1`)
    : await somar(sql`SELECT COALESCE(SUM(valor_estimado), 0) AS total, COUNT(*) AS qtd FROM corridas_solicitadas
        WHERE status = 'finalizada' AND motorista_id = ${motoristaId}
          AND criado_em >= ${de}::date AND criado_em < ${ate}::date + 1`);
  const pdv = await somar(sql`SELECT COALESCE(SUM(COALESCE(NULLIF(p.taxa_entrega, 0), c.taxa_minima, c.taxa_fixa, 0)), 0) AS total, COUNT(*) AS qtd
    FROM pedidos_pdv p LEFT JOIN config_entrega_pdv c ON c.empresa_id = p.empresa_id
    WHERE p.boy_id = ${motoristaId} AND p.status = 'entregue'
      AND COALESCE(p.entregue_em, p.criado_em) >= ${de}::date AND COALESCE(p.entregue_em, p.criado_em) < ${ate}::date + 1`);

  const desp = (await db.execute(sql`SELECT categoria, COALESCE(SUM(valor), 0) AS total FROM motorista_despesas
    WHERE motorista_id = ${motoristaId} AND data >= ${de}::date AND data <= ${ate}::date GROUP BY categoria`)).rows as any[];
  const despesas = { combustivel: 0, manutencao: 0, outras: 0, total: 0 };
  for (const d of desp) {
    if (CATEGORIAS_DESPESA.includes(d.categoria)) despesas[d.categoria as CategoriaDespesa] = r2(Number(d.total));
  }
  despesas.total = r2(despesas.combustivel + despesas.manutencao + despesas.outras);

  const ganhoBruto = r2(taxavel.total + pdv.total);
  const repasse = r2(taxavel.total * repassePct / 100);
  const ganhoLiquido = r2(ganhoBruto - repasse);
  return {
    periodo: { de, ate },
    servicos: taxavel.qtd + pdv.qtd,
    ganho_bruto: ganhoBruto,
    repasse,
    ganho_liquido: ganhoLiquido,
    despesas,
    lucro: r2(ganhoLiquido - despesas.total),
  };
}

export async function listarDespesas(motoristaId: number, de: string, ate: string) {
  await ensureDespesasTable();
  return (await db.execute(sql`SELECT id, categoria, valor::float AS valor, to_char(data, 'YYYY-MM-DD') AS data, descricao
    FROM motorista_despesas WHERE motorista_id = ${motoristaId} AND data >= ${de}::date AND data <= ${ate}::date
    ORDER BY data DESC, id DESC`)).rows;
}
