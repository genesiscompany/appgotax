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

async function ensureStatus() {
  await db.execute(sql`ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ativo'`);
  await db.execute(sql`ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS plano TEXT NOT NULL DEFAULT 'free'`);
  await db.execute(sql`ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS taxa_comissao REAL NOT NULL DEFAULT 10`);
  await db.execute(sql`ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS telefone TEXT`);
  await db.execute(sql`ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS email TEXT`);
  await db.execute(sql`ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS responsavel TEXT`);
  await db.execute(sql`ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS cnpj TEXT`);
  await db.execute(sql`ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS endereco TEXT`);
  await db.execute(sql`ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS tipo_pessoa TEXT NOT NULL DEFAULT 'empresa'`);
  await db.execute(sql`ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS doc_rg TEXT`);
  await db.execute(sql`ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS doc_rg_status TEXT NOT NULL DEFAULT 'pendente'`);
  await db.execute(sql`ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS doc_cnpj TEXT`);
  await db.execute(sql`ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS doc_cnpj_status TEXT NOT NULL DEFAULT 'pendente'`);
  await db.execute(sql`ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS doc_selfie TEXT`);
  await db.execute(sql`ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS doc_selfie_status TEXT NOT NULL DEFAULT 'pendente'`);
}

// ── GET /api/empresas-alimentos/admin/list ─────────────────────────────────
router.get("/admin/list", requireAdmin, async (_req: Request, res: Response) => {
  try {
    await ensureStatus();
    const rows = await db.execute(sql`
      SELECT
        e.id,
        COALESCE(r.nome, e.nome) as nome,
        COALESCE(r.categoria, 'Geral') as categoria,
        COALESCE(r.status, CASE WHEN e.ativo THEN 'ativo' ELSE 'pendente' END) as status,
        COALESCE(r.plano, e.plano, 'free') as plano,
        COALESCE(r.taxa_comissao, e.taxa_app, 10) as taxa_comissao,
        COALESCE(r.telefone, e.telefone) as telefone,
        COALESCE(r.email, e.email) as email,
        COALESCE(r.responsavel, e.responsavel) as responsavel,
        COALESCE(r.cnpj, e.cnpj) as cnpj,
        COALESCE(r.endereco, e.endereco) as endereco,
        COALESCE(r.avaliacao_media, 0) as avaliacao_media,
        COALESCE(r.criado_em, e.criado_em) as criado_em,
        COALESCE(r.aberto, false) as aberto,
        e.nome as empresa_nome,
        COALESCE((
          SELECT COUNT(*) FROM pedidos_pdv p WHERE p.empresa_id = e.id
          AND p.status = 'entregue'
        ), 0) as total_pedidos,
        COALESCE((
          SELECT SUM(p.total) FROM pedidos_pdv p WHERE p.empresa_id = e.id
          AND p.status = 'entregue'
        ), 0) as receita_total,
        CASE WHEN r.id IS NULL THEN true ELSE false END as sem_perfil
      FROM empresas e
      LEFT JOIN restaurantes r ON r.empresa_id = e.id
      WHERE e.modulos_ativos::text LIKE '%food%'
      ORDER BY e.criado_em DESC
    `);
    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── PATCH /api/empresas-alimentos/admin/:id/status ─────────────────────────
router.patch("/admin/:id/status", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureStatus();
    const { status } = req.body;
    const aberto = status === "ativo";
    const empresaId = Number(req.params.id);

    const empresa = await db.execute(sql`SELECT id, nome FROM empresas WHERE id = ${empresaId}`);
    if (!empresa.rows.length) return res.status(404).json({ error: "not_found" });

    const existing = await db.execute(sql`SELECT id FROM restaurantes WHERE empresa_id = ${empresaId} LIMIT 1`);
    let rows;
    if (existing.rows.length) {
      rows = await db.execute(sql`
        UPDATE restaurantes
        SET status = ${status}, aberto = ${aberto}
        WHERE empresa_id = ${empresaId}
        RETURNING id, nome, status, aberto
      `);
    } else {
      const nomeEmp = (empresa.rows[0] as any).nome;
      rows = await db.execute(sql`
        INSERT INTO restaurantes (empresa_id, nome, categoria, status, aberto)
        VALUES (${empresaId}, ${nomeEmp}, 'Geral', ${status}, ${aberto})
        RETURNING id, nome, status, aberto
      `);
    }
    return res.json(rows.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /api/empresas-alimentos/admin/pedidos ──────────────────────────────
router.get("/admin/pedidos", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        p.id, p.status, p.total, p.criado_em, p.tipo,
        p.cliente_nome, p.cliente_whatsapp, p.cliente_endereco,
        e.nome as empresa_nome,
        COALESCE(r.nome, e.nome) as restaurante_nome,
        COUNT(i.id) as total_itens
      FROM pedidos_pdv p
      LEFT JOIN empresas e ON e.id = p.empresa_id
      LEFT JOIN restaurantes r ON r.empresa_id = p.empresa_id
      LEFT JOIN itens_pedido_pdv i ON i.pedido_id = p.id
      GROUP BY p.id, e.nome, r.nome
      ORDER BY p.criado_em DESC
      LIMIT 300
    `);
    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /api/empresas-alimentos/admin/pedidos/stats ────────────────────────
router.get("/admin/pedidos/stats", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const rows = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'novo') as novos,
        COUNT(*) FILTER (WHERE status = 'preparando') as preparando,
        COUNT(*) FILTER (WHERE status = 'pronto') as prontos,
        COUNT(*) FILTER (WHERE status = 'entregue' AND DATE(criado_em) = ${today}::date) as entregues_hoje,
        COUNT(*) FILTER (WHERE status = 'cancelado' AND DATE(criado_em) = ${today}::date) as cancelados_hoje,
        COALESCE(SUM(total) FILTER (WHERE status = 'entregue' AND DATE(criado_em) = ${today}::date), 0) as receita_hoje
      FROM pedidos_pdv
    `);
    return res.json(rows.rows[0] ?? {});
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /api/empresas-alimentos/admin/documentos ───────────────────────────
router.get("/admin/documentos", requireAdmin, async (_req: Request, res: Response) => {
  try {
    await ensureStatus();
    const rows = await db.execute(sql`
      SELECT id, nome, status, tipo_pessoa, telefone, email, responsavel,
             doc_rg, doc_rg_status, doc_cnpj, doc_cnpj_status, doc_selfie, doc_selfie_status,
             criado_em
      FROM restaurantes ORDER BY criado_em DESC
    `);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── PATCH /api/empresas-alimentos/admin/:id/documentos/:tipo/status ────────
router.patch("/admin/:id/documentos/:tipo/status", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const { id, tipo } = req.params;
    const ALLOWED: Record<string, string> = {
      rg: "doc_rg_status", cnpj: "doc_cnpj_status", selfie: "doc_selfie_status",
    };
    const VALID = ["pendente", "em_analise", "aprovado", "rejeitado"];
    if (!ALLOWED[String(tipo)]) return res.status(400).json({ error: "invalid_tipo" });
    if (!VALID.includes(status)) return res.status(400).json({ error: "invalid_status" });
    const col = ALLOWED[String(tipo)]!;
    const safeStatus = String(status).replace(/'/g, "''");
    await db.execute(sql.raw(`UPDATE restaurantes SET ${col} = '${safeStatus}' WHERE id = ${Number(id)}`));
    return res.json({ id: Number(id), tipo, status });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

export default router;
