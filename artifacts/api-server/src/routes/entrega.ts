import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { entregasTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { customerIdFromRequest } from "../lib/customerToken";

const router: IRouter = Router();

// ── ADMIN: list all entregas (with empresa info) ────────────────────────────
router.get("/admin/list", async (_req: Request, res: Response) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        e.id,
        e.remetente_nome,
        e.remetente_telefone,
        e.destinatario_nome,
        e.destinatario_telefone,
        e.endereco_coleta   AS origem_endereco,
        e.endereco_entrega  AS destino_endereco,
        COALESCE(e.descricao_pacote, '') AS descricao_pacote,
        'pix'               AS forma_pagamento,
        COALESCE(e.status, 'aguardando') AS status,
        COALESCE(e.valor, 0) AS valor,
        NULL::numeric       AS distancia_km,
        e.entregador_nome,
        NULL                AS entregador_veiculo,
        NULL::int           AS avaliacao,
        e.criado_em,
        NULL                AS entregue_em,
        NULL                AS cancelada_em,
        emp.nome            AS empresa_nome
      FROM entregas e
      LEFT JOIN empresas emp ON emp.id = e.empresa_id
      ORDER BY e.criado_em DESC
      LIMIT 500
    `);
    return res.json(rows.rows);
  } catch (err: any) {
    console.error("[entregas/admin/list] erro:", err?.message);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── ADMIN: stats (totals + today) ────────────────────────────────────────────
router.get("/admin/stats", async (_req: Request, res: Response) => {
  try {
    const r = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'aguardando')                                              AS aguardando,
        COUNT(*) FILTER (WHERE status IN ('aceita','coletado','em_transito'))                      AS em_transito,
        COUNT(*) FILTER (WHERE status = 'entregue'   AND criado_em::date = CURRENT_DATE)           AS entregues_hoje,
        COUNT(*) FILTER (WHERE status = 'cancelada'  AND criado_em::date = CURRENT_DATE)           AS canceladas_hoje,
        COALESCE(SUM(valor) FILTER (WHERE status = 'entregue' AND criado_em::date = CURRENT_DATE), 0) AS receita_hoje,
        0::numeric                                                                                  AS avaliacao_media
      FROM entregas
    `);
    const row = (r.rows[0] || {}) as any;
    return res.json({
      aguardando: Number(row.aguardando || 0),
      em_transito: Number(row.em_transito || 0),
      entregues_hoje: Number(row.entregues_hoje || 0),
      canceladas_hoje: Number(row.canceladas_hoje || 0),
      receita_hoje: Number(row.receita_hoje || 0),
      avaliacao_media: Number(row.avaliacao_media || 0),
    });
  } catch (err: any) {
    console.error("[entregas/admin/stats] erro:", err?.message);
    return res.status(500).json({ error: "server_error" });
  }
});

router.get("/entregas", async (req, res) => {
  const empresaId = Number(req.headers["x-empresa-id"] || 1);
  const entregas = await db.select().from(entregasTable).where(eq(entregasTable.empresaId, empresaId));
  return res.json(entregas.map(e => ({ ...e, criadoEm: e.criadoEm.toISOString() })));
});

router.post("/entregas", async (req, res) => {
  try {
    const empresaId = Number(req.headers["x-empresa-id"] || 1);
    const { remetenteNome, remetenteTelefone, destinatarioNome, destinatarioTelefone, enderecoColeta, enderecoEntrega, descricaoPacote, valor, payment_source } = req.body;
    const rawPaymentSource = payment_source === undefined ? "direto" : String(payment_source);
    const paymentSource = rawPaymentSource === "carteira" ? "wallet" : rawPaymentSource;
    if (!["direto", "mercado_pago", "wallet"].includes(paymentSource)) {
      return res.status(400).json({ error: "payment_source_invalido", message: "payment_source deve ser direto, mercado_pago ou wallet" });
    }
    await db.execute(sql`ALTER TABLE entregas ADD COLUMN IF NOT EXISTS customer_id INTEGER`);
    const owner = customerIdFromRequest(req);
    if (paymentSource !== "direto" && !owner) return res.status(401).json({ error: "signed_customer_token_required" });
    const [entrega] = await db.insert(entregasTable).values({
      empresaId,
      customerId: owner,
      remetenteNome,
      remetenteTelefone,
      destinatarioNome,
      destinatarioTelefone,
      enderecoColeta,
      enderecoEntrega,
      descricaoPacote,
      valor: Number(valor),
      status: "aguardando",
      paymentSource,
    }).returning();
    return res.status(201).json({ ...entrega, criadoEm: entrega.criadoEm.toISOString(), paymentSource: entrega.paymentSource, paymentStatus: entrega.paymentSource === "direto" ? "direto" : "pendente" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error", message: "Erro interno" });
  }
});

router.patch("/entregas/:id/status", async (req, res) => {
  res.status(403).json({ error: "status_transition_restricted", message: "Use o fluxo autenticado de motorista ou cancelamento do cliente" });
});

export default router;
