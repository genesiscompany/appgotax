import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import jwt from "jsonwebtoken";

const router: IRouter = Router();
const JWT_SECRET = process.env["JWT_SECRET"] || "gotaxi-admin-secret-2024";

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) { res.status(401).json({ error: "unauthorized" }); return; }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as any;
    if (payload.papel !== "admin") { res.status(403).json({ error: "forbidden" }); return; }
    (req as any).adminUser = payload;
    next();
  } catch {
    res.status(401).json({ error: "invalid_token" });
  }
}

async function ensureColumns() {
  await db.execute(sql`ALTER TABLE rotas ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ativo'`);
  await db.execute(sql`ALTER TABLE rotas ADD COLUMN IF NOT EXISTS plano TEXT NOT NULL DEFAULT 'free'`);
  await db.execute(sql`ALTER TABLE rotas ADD COLUMN IF NOT EXISTS taxa_comissao REAL NOT NULL DEFAULT 8`);
  await db.execute(sql`ALTER TABLE rotas ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'rodoviaria'`);
  await db.execute(sql`ALTER TABLE rotas ADD COLUMN IF NOT EXISTS telefone TEXT`);
  await db.execute(sql`ALTER TABLE rotas ADD COLUMN IF NOT EXISTS email TEXT`);
  await db.execute(sql`ALTER TABLE rotas ADD COLUMN IF NOT EXISTS responsavel TEXT`);
  await db.execute(sql`ALTER TABLE rotas ADD COLUMN IF NOT EXISTS cnpj TEXT`);
  await db.execute(sql`ALTER TABLE rotas ADD COLUMN IF NOT EXISTS cidade TEXT`);
  await db.execute(sql`ALTER TABLE rotas ADD COLUMN IF NOT EXISTS estado TEXT`);
  await db.execute(sql`ALTER TABLE rotas ADD COLUMN IF NOT EXISTS doc_cnpj TEXT`);
  await db.execute(sql`ALTER TABLE rotas ADD COLUMN IF NOT EXISTS doc_cnpj_status TEXT NOT NULL DEFAULT 'pendente'`);
  await db.execute(sql`ALTER TABLE rotas ADD COLUMN IF NOT EXISTS doc_cnh TEXT`);
  await db.execute(sql`ALTER TABLE rotas ADD COLUMN IF NOT EXISTS doc_cnh_status TEXT NOT NULL DEFAULT 'pendente'`);
  await db.execute(sql`ALTER TABLE rotas ADD COLUMN IF NOT EXISTS doc_crlv TEXT`);
  await db.execute(sql`ALTER TABLE rotas ADD COLUMN IF NOT EXISTS doc_crlv_status TEXT NOT NULL DEFAULT 'pendente'`);
  await db.execute(sql`ALTER TABLE rotas ADD COLUMN IF NOT EXISTS doc_selfie TEXT`);
  await db.execute(sql`ALTER TABLE rotas ADD COLUMN IF NOT EXISTS doc_selfie_status TEXT NOT NULL DEFAULT 'pendente'`);
}

// ── GET /api/tur-viagens/admin/list ───────────────────────────────────────
// Lists all companies with passagens module, showing real route + sales data
router.get("/admin/list", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        e.id,
        e.nome,
        COALESCE(e.responsavel, u.nome) as responsavel,
        COALESCE(e.telefone, u.telefone) as telefone,
        COALESCE(e.email, u.email) as email,
        e.cnpj,
        e.ativo,
        e.plano,
        COALESCE(e.taxa_app, 8) as taxa_comissao,
        e.criado_em,
        COUNT(DISTINCT vr.id) as total_rotas,
        COUNT(DISTINCT vp.id) as total_passagens,
        COALESCE(SUM(vp.valor) FILTER (WHERE vp.status = 'confirmada'), 0) as receita_total
      FROM empresas e
      LEFT JOIN usuarios u ON u.empresa_id = e.id AND u.papel = 'admin'
      LEFT JOIN viagens_rotas vr ON vr.empresa_id = e.id AND vr.ativo = true
      LEFT JOIN viagens_passagens vp ON vp.empresa_id = e.id
      WHERE e.modulos_ativos::text LIKE '%passagens%' OR e.modulos_ativos::text LIKE '%tur%'
      GROUP BY e.id, e.nome, e.responsavel, u.nome, e.telefone, u.telefone, e.email, u.email,
               e.cnpj, e.ativo, e.plano, e.taxa_app, e.criado_em
      ORDER BY e.criado_em DESC
    `);
    return res.json(rows.rows.map((r: any) => ({
      id: r.id,
      nome: r.nome,
      tipo: "agencia",
      responsavel: r.responsavel || null,
      telefone: r.telefone || null,
      email: r.email || null,
      cnpj: r.cnpj || null,
      cidade: null,
      estado: null,
      status: r.ativo ? "ativo" : "pendente",
      plano: r.plano || "free",
      taxa_comissao: Number(r.taxa_comissao) || 8,
      avaliacao_media: 0,
      total_rotas: Number(r.total_rotas),
      total_passagens: Number(r.total_passagens),
      receita_total: Number(r.receita_total),
      criado_em: r.criado_em,
    })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── PATCH /api/tur-viagens/admin/:id/status ────────────────────────────────
// :id is empresa_id
router.patch("/admin/:id/status", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const validStatuses = ["pendente", "em_analise", "ativo", "suspenso", "bloqueado"];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: "invalid_status" });
    const ativo = status === "ativo";
    await db.execute(sql`
      UPDATE empresas SET ativo = ${ativo}
      WHERE id = ${Number(req.params.id)}
    `);
    return res.json({ empresa_id: Number(req.params.id), status });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /api/tur-viagens/admin/passagens ──────────────────────────────────
router.get("/admin/passagens", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        vp.id, vp.status, vp.valor, vp.forma_pagamento, vp.assento as poltrona, vp.vendido_em as criado_em,
        vp.operador_nome as passageiro_nome,
        vr.origem, vr.destino,
        vh.data_partida, vh.hora_partida as data_partida_hora, vh.hora_chegada as data_chegada,
        e.nome as empresa_nome
      FROM viagens_passagens vp
      LEFT JOIN viagens_horarios vh ON vh.id = vp.horario_id
      LEFT JOIN viagens_rotas vr ON vr.id = vh.rota_id
      LEFT JOIN empresas e ON e.id = vp.empresa_id
      ORDER BY vp.vendido_em DESC
      LIMIT 300
    `);
    return res.json(rows.rows.map((row: any) => ({
      ...row,
      codigo_reserva: `TUR-${String(row.id).padStart(4, "0")}`,
      taxa_servico: 0,
      modal: "rodoviario",
    })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /api/tur-viagens/admin/passagens/stats ─────────────────────────────
router.get("/admin/passagens/stats", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const rows = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pendente') as reservados,
        COUNT(*) FILTER (WHERE status = 'confirmada') as confirmados,
        0 as embarcados,
        COUNT(*) FILTER (WHERE status = 'confirmada' AND DATE(vendido_em) = ${today}::date) as concluidos_hoje,
        COUNT(*) FILTER (WHERE status = 'cancelada') as cancelados_hoje,
        COALESCE(SUM(valor) FILTER (WHERE DATE(vendido_em) = ${today}::date AND status != 'cancelada'), 0) as receita_hoje
      FROM viagens_passagens
    `);
    const s = rows.rows[0] as any ?? {};
    return res.json({
      reservados: Number(s.reservados ?? 0),
      confirmados: Number(s.confirmados ?? 0),
      embarcados: 0,
      concluidos_hoje: Number(s.concluidos_hoje ?? 0),
      cancelados_hoje: Number(s.cancelados_hoje ?? 0),
      receita_hoje: Number(s.receita_hoje ?? 0),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /api/tur-viagens/admin/documentos ─────────────────────────────────
router.get("/admin/documentos", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await db.execute(sql`
      SELECT e.id, e.nome,
             CASE WHEN e.ativo THEN 'ativo' ELSE 'pendente' END as status,
             e.telefone, e.email, e.responsavel, e.cnpj,
             'agencia' as tipo,
             e.doc_cnpj, e.doc_cnpj_status,
             null as doc_cnh, 'pendente' as doc_cnh_status,
             null as doc_crlv, 'pendente' as doc_crlv_status,
             e.doc_selfie, e.doc_selfie_status
      FROM empresas e
      WHERE e.modulos_ativos::text LIKE '%passagens%' OR e.modulos_ativos::text LIKE '%tur%'
      ORDER BY e.id DESC
    `);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── PATCH /api/tur-viagens/admin/:id/documentos/:tipo/status ──────────────
router.patch("/admin/:id/documentos/:tipo/status", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const { id, tipo } = req.params;
    const ALLOWED: Record<string, string> = {
      cnpj: "doc_cnpj_status", selfie: "doc_selfie_status",
    };
    const VALID = ["pendente", "em_analise", "aprovado", "rejeitado"];
    if (!ALLOWED[String(tipo)]) return res.status(400).json({ error: "invalid_tipo" });
    if (!VALID.includes(status)) return res.status(400).json({ error: "invalid_status" });
    const col = ALLOWED[String(tipo)]!;
    const safeStatus = String(status).replace(/'/g, "''");
    await db.execute(sql.raw(`UPDATE empresas SET ${col} = '${safeStatus}' WHERE id = ${Number(id)}`));
    return res.json({ id: Number(id), tipo, status });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

export default router;
