import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export function decodeClienteToken(token: string | undefined | null): number | null {
  if (!token) return null;
  try {
    const decoded = Buffer.from(String(token), "base64").toString("utf-8");
    const m = decoded.match(/^cl_(\d+):/);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

export function decodeClienteTokenFromReq(req: any): number | null {
  const auth = req?.headers?.authorization;
  let token: string | null = null;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) token = auth.slice(7);
  if (!token) token = req?.body?.cliente_token ?? req?.body?.clienteToken ?? req?.body?.token ?? null;
  return decodeClienteToken(token);
}

async function resolveAfiliadoByCode(
  codigo: string,
): Promise<{ afiliadoId: number; ownerUsuarioId: number } | null> {
  const cod = String(codigo || "").trim().toUpperCase();
  if (!cod) return null;

  const direct = (await db.execute(sql`
    SELECT id, usuario_id FROM afiliados
    WHERE UPPER(codigo) = ${cod} AND status = 'ativo'
    LIMIT 1
  `)).rows as any[];
  if (direct.length) return { afiliadoId: direct[0].id, ownerUsuarioId: direct[0].usuario_id };

  const byUser = (await db.execute(sql`
    SELECT id FROM usuarios WHERE UPPER(codigo_referral) = ${cod} AND ativo = true LIMIT 1
  `)).rows as any[];
  if (byUser.length) {
    const uid = byUser[0].id;
    const ins = (await db.execute(sql`
      INSERT INTO afiliados (usuario_id, codigo, status)
      VALUES (${uid}, ${cod}, 'ativo')
      ON CONFLICT (usuario_id) DO UPDATE SET codigo = EXCLUDED.codigo, status = 'ativo'
      RETURNING id, usuario_id
    `)).rows as any[];
    return { afiliadoId: ins[0].id, ownerUsuarioId: ins[0].usuario_id };
  }

  const byMoto = (await db.execute(sql`
    SELECT id, nome, email, telefone, senha_pin
    FROM motoristas_app WHERE UPPER(codigo_referral) = ${cod} AND ativo = true LIMIT 1
  `)).rows as any[];
  if (byMoto.length) {
    const m = byMoto[0];
    const emailShadow = (m.email || `mot${m.id}@motorista.gotaxi`).toLowerCase();
    let shadow = (await db.execute(sql`
      SELECT id FROM usuarios WHERE LOWER(email) = ${emailShadow} OR telefone = ${m.telefone} LIMIT 1
    `)).rows as any[];
    if (!shadow.length) {
      shadow = (await db.execute(sql`
        INSERT INTO usuarios (nome, email, senha_hash, telefone, empresa_id, papel, ativo)
        VALUES (${m.nome}, ${emailShadow}, ${String(m.senha_pin)}, ${m.telefone}, 1, 'cliente', true)
        RETURNING id
      `)).rows as any[];
    }
    const uid = shadow[0].id;
    const ins = (await db.execute(sql`
      INSERT INTO afiliados (usuario_id, codigo, status)
      VALUES (${uid}, ${cod}, 'ativo')
      ON CONFLICT (usuario_id) DO UPDATE SET codigo = EXCLUDED.codigo
      RETURNING id, usuario_id
    `)).rows as any[];
    return { afiliadoId: ins[0].id, ownerUsuarioId: ins[0].usuario_id };
  }

  return null;
}

export interface GerarComissaoOpts {
  usuarioId: number | null | undefined;
  valor: number | null | undefined;
  tipoEvento: string;
  referenciaId?: number | null;
  descricao?: string | null;
}

/**
 * Generate an affiliate commission record when a logged-in customer completes
 * a purchase/booking. Safe to call from any order endpoint - never throws.
 *
 * Looks up the customer's `indicado_por` referral code, resolves it to an
 * affiliate (auto-creating one from usuarios/motoristas_app codigo_referral if
 * needed), reads the percentual_comissao (per-affiliate or global default),
 * and inserts a pending commission row in afiliado_comissoes.
 *
 * Skips silently when:
 *  - customer is unknown
 *  - customer has no referral
 *  - referral code does not resolve
 *  - the customer is the affiliate themselves (self-referral)
 *  - valor <= 0
 */
export async function gerarComissaoCliente(opts: GerarComissaoOpts): Promise<void> {
  try {
    const { usuarioId, valor, tipoEvento, referenciaId, descricao } = opts;
    const valorNum = Number(valor || 0);
    if (!usuarioId || valorNum <= 0) return;

    const u = (await db.execute(sql`
      SELECT indicado_por FROM usuarios WHERE id = ${usuarioId} LIMIT 1
    `)).rows as any[];
    const codigo = u[0]?.indicado_por;
    if (!codigo) return;

    const afi = await resolveAfiliadoByCode(String(codigo));
    if (!afi) return;
    if (afi.ownerUsuarioId === usuarioId) return;

    const pctRows = (await db.execute(sql`
      SELECT
        COALESCE(
          (SELECT a.percentual_comissao FROM afiliados a WHERE a.id = ${afi.afiliadoId}),
          (SELECT c.percentual_comissao FROM afiliados_config c LIMIT 1),
          10
        ) AS pct
    `)).rows as any[];
    const pct = Number(pctRows[0]?.pct ?? 10);
    const valorComissao = Math.round(valorNum * pct) / 100;
    if (valorComissao <= 0) return;

    await db.execute(sql`
      INSERT INTO afiliado_comissoes
        (afiliado_id, tipo_evento, valor_transacao, percentual, valor_comissao,
         status, referencia_id, descricao)
      VALUES
        (${afi.afiliadoId}, ${tipoEvento}, ${valorNum}, ${pct}, ${valorComissao},
         'pendente', ${referenciaId ?? null}, ${descricao ?? null})
    `);
  } catch (err) {
    console.error("[comissaoAfiliado] erro:", err);
  }
}
