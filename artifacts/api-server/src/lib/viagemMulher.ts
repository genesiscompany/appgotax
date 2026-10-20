import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export type Genero = "feminino" | "masculino";

export function normalizarGenero(v: unknown): Genero | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "feminino" || s === "f") return "feminino";
  if (s === "masculino" || s === "m") return "masculino";
  return null;
}

let schemaPronto = false;
export async function ensureViagemSchema() {
  if (schemaPronto) return;
  await db.execute(sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS genero VARCHAR(10)`);
  await db.execute(sql`ALTER TABLE motoristas_app ADD COLUMN IF NOT EXISTS genero VARCHAR(10)`);
  await db.execute(sql`ALTER TABLE motoristas_app ADD COLUMN IF NOT EXISTS aceita_passageiros VARCHAR(20) NOT NULL DEFAULT 'todos'`);
  await db.execute(sql`ALTER TABLE corridas ADD COLUMN IF NOT EXISTS somente_mulher BOOLEAN NOT NULL DEFAULT false`);
  await db.execute(sql`ALTER TABLE corridas ADD COLUMN IF NOT EXISTS aceita_em TIMESTAMP`);
  await db.execute(sql`ALTER TABLE corridas ADD COLUMN IF NOT EXISTS taxa_cancelamento_cobrada NUMERIC(10,2) NOT NULL DEFAULT 0`);
  await db.execute(sql`ALTER TABLE corridas ADD COLUMN IF NOT EXISTS simulada BOOLEAN NOT NULL DEFAULT false`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS taxas_cancelamento (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL,
      corrida_id INTEGER NOT NULL UNIQUE,
      motorista_id INTEGER,
      valor NUMERIC(10,2) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pendente',
      cobrada_corrida_id INTEGER,
      cobrada_motorista_id INTEGER,
      criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
      pago_em TIMESTAMP
    )
  `);
  try { await db.execute(sql`ALTER TABLE corridas_solicitadas ADD COLUMN IF NOT EXISTS taxa_cancelamento NUMERIC(10,2) NOT NULL DEFAULT 0`); } catch (_) {}
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_taxas_cancelamento_usuario ON taxas_cancelamento (usuario_id, status)`);
  await db.execute(sql`
    INSERT INTO configuracoes_sistema (chave, valor) VALUES
      ('taxa_cancelamento_valor', '0'),
      ('taxa_cancelamento_minutos', '2'),
      ('foto_motorista_obrigatoria', '0')
    ON CONFLICT (chave) DO NOTHING
  `);
  schemaPronto = true;
}

function numero(v: unknown, padrao: number) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : padrao;
}

export async function configCancelamento() {
  await ensureViagemSchema();
  const rows = (await db.execute(sql`SELECT chave, valor FROM configuracoes_sistema
    WHERE chave IN ('taxa_cancelamento_valor', 'taxa_cancelamento_minutos')`)).rows as any[];
  const m: Record<string, string> = {};
  for (const r of rows) m[r.chave] = r.valor;
  return {
    valor: Math.round(numero(m.taxa_cancelamento_valor, 0) * 100) / 100,
    minutos: numero(m.taxa_cancelamento_minutos, 2),
  };
}

export async function fotoMotoristaObrigatoria() {
  await ensureViagemSchema();
  const r = (await db.execute(sql`SELECT valor FROM configuracoes_sistema WHERE chave = 'foto_motorista_obrigatoria'`)).rows[0] as any;
  return ["1", "true", "sim"].includes(String(r?.valor ?? "").toLowerCase());
}

/** Filtro SQL (alias `ma`) com as regras de gênero do dispatch. */
export function filtroGeneroSql(passageiraMulher: boolean, somenteMulher: boolean) {
  const partes: string[] = [];
  if (!passageiraMulher) partes.push(`COALESCE(ma.aceita_passageiros, 'todos') <> 'somente_mulheres'`);
  if (somenteMulher) partes.push(`ma.genero = 'feminino'`);
  return partes.length ? `AND ${partes.join(" AND ")}` : "";
}

export async function generoDoUsuario(usuarioId: number | null | undefined): Promise<Genero | null> {
  if (!usuarioId) return null;
  await ensureViagemSchema();
  const r = (await db.execute(sql`SELECT genero FROM usuarios WHERE id = ${usuarioId}`)).rows[0] as any;
  return normalizarGenero(r?.genero);
}

/** Taxas pendentes do passageiro; libera reservas de corridas que não aconteceram. */
export async function taxasPendentesDoCliente(usuarioId: number) {
  await ensureViagemSchema();
  await db.execute(sql`
    UPDATE taxas_cancelamento t SET status = 'pendente', cobrada_corrida_id = NULL
    FROM corridas c
    WHERE c.id = t.cobrada_corrida_id AND t.usuario_id = ${usuarioId} AND t.status = 'reservada'
      AND (c.status = 'cancelada' OR (c.status = 'aguardando' AND c.criado_em < NOW() - INTERVAL '15 minutes'))
  `);
  const rows = (await db.execute(sql`SELECT id, valor FROM taxas_cancelamento
    WHERE usuario_id = ${usuarioId} AND status = 'pendente' ORDER BY id`)).rows as any[];
  const total = Math.round(rows.reduce((s, r) => s + Number(r.valor || 0), 0) * 100) / 100;
  return { ids: rows.map(r => Number(r.id)), total };
}

export async function reservarTaxas(ids: number[], corridaId: number) {
  if (!ids.length) return;
  await db.execute(sql`UPDATE taxas_cancelamento SET status = 'reservada', cobrada_corrida_id = ${corridaId}
    WHERE id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)}) AND status = 'pendente'`);
}

export async function liberarTaxasReservadas(tx: any, corridaId: number) {
  await tx.execute(sql`UPDATE taxas_cancelamento SET status = 'pendente', cobrada_corrida_id = NULL
    WHERE cobrada_corrida_id = ${corridaId} AND status = 'reservada'`);
}

/**
 * Chamado dentro da transação do cancelamento pelo passageiro, antes de mudar o status.
 * Gera a taxa se o motorista aceitou há mais que a tolerância configurada.
 */
export async function registrarTaxaCancelamento(tx: any, corridaId: number, usuarioId: number): Promise<number> {
  const { valor, minutos } = await configCancelamento();
  if (valor <= 0) return 0;
  const r = (await tx.execute(sql`
    SELECT motorista_app_id FROM corridas
    WHERE id = ${corridaId} AND status IN ('aceita', 'a_caminho')
      AND motorista_app_id IS NOT NULL AND COALESCE(simulada, false) = false
      AND aceita_em IS NOT NULL AND aceita_em < NOW() - (${minutos}::numeric * INTERVAL '1 minute')
  `)).rows[0] as any;
  if (!r) return 0;
  const ins = await tx.execute(sql`
    INSERT INTO taxas_cancelamento (usuario_id, corrida_id, motorista_id, valor)
    VALUES (${usuarioId}, ${corridaId}, ${Number(r.motorista_app_id)}, ${valor})
    ON CONFLICT (corrida_id) DO NOTHING RETURNING valor
  `);
  return ins.rows[0] ? valor : 0;
}

/** Na finalização da corrida que cobrou a taxa: marca como paga e credita o motorista que perdeu a viagem. */
export async function quitarTaxas(corridaId: number, motoristaQueCobrou: number) {
  await ensureViagemSchema();
  await db.transaction(async tx => {
    const pagas = (await tx.execute(sql`
      UPDATE taxas_cancelamento SET status = 'paga', pago_em = NOW(), cobrada_motorista_id = ${motoristaQueCobrou}
      WHERE cobrada_corrida_id = ${corridaId} AND status = 'reservada'
      RETURNING motorista_id, valor
    `)).rows as any[];
    for (const p of pagas) {
      if (!p.motorista_id) continue;
      await tx.execute(sql`UPDATE motoristas_app SET saldo = COALESCE(saldo, 0) + ${Number(p.valor)},
        total_ganhos = COALESCE(total_ganhos, 0) + ${Number(p.valor)} WHERE id = ${Number(p.motorista_id)}`);
    }
  });
}

/** Taxas recebidas em corridas finalizadas pelo motorista na semana (repasse integral à GoTaxi). */
export async function taxasCobradasNaSemana(motoristaId: number, inicio: string, fim: string) {
  await ensureViagemSchema();
  const r = (await db.execute(sql`
    SELECT COALESCE(SUM(t.valor), 0) AS total
    FROM taxas_cancelamento t
    JOIN corridas_solicitadas cs ON cs.corrida_id = t.cobrada_corrida_id AND cs.motorista_id = ${motoristaId}
    WHERE t.status = 'paga' AND cs.status = 'finalizada'
      AND cs.criado_em >= ${inicio}::date AND cs.criado_em < (${fim}::date + INTERVAL '1 day')
  `)).rows[0] as any;
  return Number(r?.total ?? 0);
}
