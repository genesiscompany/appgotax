import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { produtosTable, pedidosTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import jwt from "jsonwebtoken";

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

async function ensureEcommerceColumns() {
  await db.execute(sql`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS ecommerce_status TEXT NOT NULL DEFAULT 'ativo'`);
  await db.execute(sql`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS ecommerce_taxa_comissao REAL NOT NULL DEFAULT 3`);
  await db.execute(sql`ALTER TABLE empresas ALTER COLUMN ecommerce_taxa_comissao SET DEFAULT 3`);
  await db.execute(sql`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS ecommerce_categoria TEXT`);
  await db.execute(sql`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS responsavel TEXT`);
  await db.execute(sql`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS cnpj TEXT`);
  await db.execute(sql`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS telefone TEXT`);
  await db.execute(sql`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS email TEXT`);
  await db.execute(sql`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS endereco TEXT`);
  await db.execute(sql`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS tipo_pessoa TEXT NOT NULL DEFAULT 'empresa'`);
  await db.execute(sql`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS doc_rg TEXT`);
  await db.execute(sql`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS doc_rg_status TEXT NOT NULL DEFAULT 'pendente'`);
  await db.execute(sql`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS doc_cnpj TEXT`);
  await db.execute(sql`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS doc_cnpj_status TEXT NOT NULL DEFAULT 'pendente'`);
  await db.execute(sql`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS doc_selfie TEXT`);
  await db.execute(sql`ALTER TABLE empresas ADD COLUMN IF NOT EXISTS doc_selfie_status TEXT NOT NULL DEFAULT 'pendente'`);
}

const router: IRouter = Router();

router.get("/produtos", async (req, res) => {
  const empresaId = Number(req.headers["x-empresa-id"] || 1);
  const produtos = await db.select().from(produtosTable).where(eq(produtosTable.empresaId, empresaId));
  return res.json(produtos.map(p => ({ ...p, criadoEm: p.criadoEm.toISOString() })));
});

router.post("/produtos", async (req, res) => {
  try {
    const empresaId = Number(req.headers["x-empresa-id"] || 1);
    const { nome, descricao, preco, estoque, categoria } = req.body;
    const [produto] = await db.insert(produtosTable).values({
      empresaId,
      nome,
      descricao,
      preco: Number(preco),
      estoque: Number(estoque),
      categoria,
      ativo: true,
    }).returning();
    return res.status(201).json({ ...produto, criadoEm: produto.criadoEm.toISOString() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error", message: "Erro interno" });
  }
});

router.get("/pedidos", async (req, res) => {
  const empresaId = Number(req.headers["x-empresa-id"] || 1);
  const pedidos = await db.select().from(pedidosTable).where(eq(pedidosTable.empresaId, empresaId));
  return res.json(pedidos.map(p => ({ ...p, criadoEm: p.criadoEm.toISOString() })));
});

router.post("/pedidos", async (req, res) => {
  try {
    const empresaId = Number(req.headers["x-empresa-id"] || 1);
    const { clienteNome, clienteTelefone, itens, total, enderecoEntrega } = req.body;
    const [pedido] = await db.insert(pedidosTable).values({
      empresaId,
      clienteNome,
      clienteTelefone,
      itens: itens || [],
      total: Number(total),
      enderecoEntrega,
      status: "pendente",
    }).returning();
    return res.status(201).json({ ...pedido, criadoEm: pedido.criadoEm.toISOString() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error", message: "Erro interno" });
  }
});

// ── GET /api/ecommerce/admin/list ─────────────────────────────────────────
router.get("/admin/list", requireAdmin, async (_req: Request, res: Response) => {
  try {
    await ensureEcommerceColumns();
    const rows = await db.execute(sql`
      SELECT
        e.id, e.nome,
        COALESCE(e.ecommerce_categoria, 'outro') as categoria,
        e.cnpj, e.telefone, e.email, e.responsavel,
        COALESCE(e.ecommerce_status, CASE WHEN e.ativo THEN 'ativo' ELSE 'suspenso' END) as status,
        e.plano,
        e.ecommerce_taxa_comissao as taxa_comissao,
        COALESCE((
          SELECT AVG(pe.total) FROM pedidos pe
          WHERE pe.empresa_id = e.id AND pe.status = 'entregue'
        ), 0) as avaliacao_media,
        COALESCE((SELECT COUNT(*) FROM pedidos pe WHERE pe.empresa_id = e.id), 0) as total_pedidos,
        COALESCE((SELECT SUM(pe.total) FROM pedidos pe WHERE pe.empresa_id = e.id AND pe.status = 'entregue'), 0) as receita_total,
        e.criado_em
      FROM empresas e
      WHERE e.modulos_ativos::text LIKE '%ecommerce%'
      ORDER BY e.criado_em DESC
    `);
    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /api/ecommerce/admin/empresas (alias of /admin/list) ──────────────
router.get("/admin/empresas", requireAdmin, async (_req: Request, res: Response) => {
  try {
    await ensureEcommerceColumns();
    const rows = await db.execute(sql`
      SELECT
        e.id, e.nome,
        COALESCE(e.ecommerce_categoria, 'outro') as categoria,
        e.cnpj, e.telefone, e.email, e.responsavel, e.endereco,
        COALESCE(e.ecommerce_status, CASE WHEN e.ativo THEN 'ativo' ELSE 'suspenso' END) as status,
        e.plano,
        e.ecommerce_taxa_comissao as taxa_comissao,
        COALESCE((SELECT COUNT(*) FROM pedidos pe WHERE pe.empresa_id = e.id), 0) as total_pedidos,
        COALESCE((SELECT SUM(pe.total) FROM pedidos pe WHERE pe.empresa_id = e.id AND pe.status = 'entregue'), 0) as receita_total,
        e.criado_em
      FROM empresas e
      WHERE e.modulos_ativos::text LIKE '%ecommerce%'
      ORDER BY e.criado_em DESC
    `);
    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── PATCH /api/ecommerce/admin/:id/status ─────────────────────────────────
router.patch("/admin/:id/status", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureEcommerceColumns();
    const { status } = req.body;
    const ativo = status === "ativo";
    const rows = await db.execute(sql`
      UPDATE empresas
      SET ecommerce_status = ${status}, ativo = ${ativo}
      WHERE id = ${Number(req.params.id)}
      RETURNING id, nome, ativo
    `);
    if (!rows.rows.length) return res.status(404).json({ error: "not_found" });
    return res.json({ ...(rows.rows[0] as any), status });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── PATCH /api/ecommerce/admin/empresas/:id/status ─────────────────────────
router.patch("/admin/empresas/:id/status", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureEcommerceColumns();
    const { status } = req.body;
    const ativo = status === "ativo";
    const rows = await db.execute(sql`
      UPDATE empresas
      SET ecommerce_status = ${status}, ativo = ${ativo}
      WHERE id = ${Number(req.params.id)}
      RETURNING id, nome, ativo
    `);
    if (!rows.rows.length) return res.status(404).json({ error: "not_found" });
    return res.json({ ...(rows.rows[0] as any), status });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /api/ecommerce/admin/pedidos ──────────────────────────────────────
router.get("/admin/pedidos", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        p.id, p.status, p.total as valor, p.criado_em,
        p.cliente_nome, p.cliente_telefone, p.endereco_entrega,
        e.nome as loja_nome,
        CASE p.status
          WHEN 'pendente' THEN 'novo'
          WHEN 'entregue' THEN 'entregue'
          ELSE p.status
        END as status_display
      FROM pedidos p
      LEFT JOIN empresas e ON e.id = p.empresa_id
      ORDER BY p.criado_em DESC
      LIMIT 300
    `);
    return res.json(rows.rows.map((row: any) => ({
      ...row,
      status: row.status_display ?? row.status,
      taxa_entrega: 0,
      forma_pagamento: "pix",
      itens_resumo: "Ver detalhes",
      codigo_rastreio: null,
    })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /api/ecommerce/admin/pedidos/stats ────────────────────────────────
router.get("/admin/pedidos/stats", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const rows = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pendente') as novos,
        COUNT(*) FILTER (WHERE status = 'processando') as preparando,
        COUNT(*) FILTER (WHERE status = 'enviado') as enviados,
        COUNT(*) FILTER (WHERE status = 'entregue' AND DATE(criado_em) = ${today}::date) as entregues_hoje,
        COUNT(*) FILTER (WHERE status = 'cancelado' AND DATE(criado_em) = ${today}::date) as cancelados_hoje,
        COALESCE(SUM(total) FILTER (WHERE DATE(criado_em) = ${today}::date AND status != 'cancelado'), 0) as receita_hoje
      FROM pedidos
    `);
    const s = rows.rows[0] as any ?? {};
    return res.json({
      novos: Number(s.novos ?? 0),
      preparando: Number(s.preparando ?? 0),
      enviados: Number(s.enviados ?? 0),
      entregues_hoje: Number(s.entregues_hoje ?? 0),
      cancelados_hoje: Number(s.cancelados_hoje ?? 0),
      receita_hoje: Number(s.receita_hoje ?? 0),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /api/ecommerce/admin/documentos ───────────────────────────────────
router.get("/admin/documentos", requireAdmin, async (_req: Request, res: Response) => {
  try {
    await ensureEcommerceColumns();
    const rows = await db.execute(sql`
      SELECT id, nome, ecommerce_status as status, tipo_pessoa, telefone, email, responsavel, cnpj,
             doc_rg, doc_rg_status, doc_cnpj, doc_cnpj_status, doc_selfie, doc_selfie_status,
             criado_em
      FROM empresas ORDER BY criado_em DESC
    `);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── PATCH /api/ecommerce/admin/:id/documentos/:tipo/status ─────────────────
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
    await db.execute(sql.raw(`UPDATE empresas SET ${col} = '${safeStatus}' WHERE id = ${Number(id)}`));
    return res.json({ id: Number(id), tipo, status });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

export default router;
