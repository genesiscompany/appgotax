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

// ── GET /api/food-delivery/admin/pedidos ───────────────────────────────────
// Lists all food delivery orders (pedidos_pdv of tipo 'delivery' or 'food')
router.get("/admin/pedidos", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        p.id, p.status, p.total, p.criado_em, p.tipo,
        p.cliente_nome, p.cliente_whatsapp, p.cliente_endereco,
        p.observacoes, p.forma_pagamento, p.taxa_entrega,
        e.nome as empresa_nome,
        COUNT(i.id) as total_itens
      FROM pedidos_pdv p
      LEFT JOIN empresas e ON e.id = p.empresa_id
      LEFT JOIN itens_pedido_pdv i ON i.pedido_id = p.id
      GROUP BY p.id, e.nome
      ORDER BY p.criado_em DESC
      LIMIT 300
    `);
    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /api/food-delivery/admin/stats ─────────────────────────────────────
router.get("/admin/stats", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const rows = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'novo') as novos,
        COUNT(*) FILTER (WHERE status = 'preparando') as preparando,
        COUNT(*) FILTER (WHERE status = 'saiu_entrega') as saiu_entrega,
        COUNT(*) FILTER (WHERE status = 'entregue' AND DATE(criado_em) = ${today}::date) as entregues_hoje,
        COUNT(*) FILTER (WHERE status = 'cancelado' AND DATE(criado_em) = ${today}::date) as cancelados_hoje,
        COALESCE(SUM(total) FILTER (WHERE status = 'entregue' AND DATE(criado_em) = ${today}::date), 0) as receita_hoje
      FROM pedidos_pdv
    `);
    const s = rows.rows[0] as any ?? {};
    return res.json({
      novos: Number(s.novos ?? 0),
      preparando: Number(s.preparando ?? 0),
      saiu_entrega: Number(s.saiu_entrega ?? 0),
      entregues_hoje: Number(s.entregues_hoje ?? 0),
      cancelados_hoje: Number(s.cancelados_hoje ?? 0),
      receita_hoje: Number(s.receita_hoje ?? 0),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

export default router;
