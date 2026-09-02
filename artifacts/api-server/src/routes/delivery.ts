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

// ── GET /api/delivery/admin/list ───────────────────────────────────────────
// Lists all 'delivery' type professionals from motoristas_app table
router.get("/admin/list", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        id, nome, cpf, telefone, email, status, tipo_profissional,
        cidade, estado,
        veiculo_marca, veiculo_modelo, veiculo_placa, tipo_veiculo,
        doc_cnh_status, doc_veiculo_status, doc_selfie_status,
        avaliacao_media, total_corridas, total_ganhos, saldo,
        percentual_repasse,
        criado_em
      FROM motoristas_app
      WHERE tipo_profissional = 'delivery'
      ORDER BY criado_em DESC
    `);
    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /api/delivery/admin/documentos ────────────────────────────────────
router.get("/admin/documentos", requireAdmin, async (_req: Request, res: Response) => {
  try {
    await db.execute(sql`ALTER TABLE motoristas_app ADD COLUMN IF NOT EXISTS doc_rg TEXT`);
    await db.execute(sql`ALTER TABLE motoristas_app ADD COLUMN IF NOT EXISTS doc_rg_status TEXT NOT NULL DEFAULT 'pendente'`);
    const rows = await db.execute(sql`
      SELECT id, nome, telefone, email, status, tipo_veiculo, tipo_profissional,
             doc_cnh, doc_cnh_status, doc_veiculo, doc_veiculo_status,
             doc_selfie, doc_selfie_status, doc_rg, doc_rg_status, criado_em
      FROM motoristas_app WHERE tipo_profissional = 'delivery'
      ORDER BY criado_em DESC
    `);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── PATCH /api/delivery/admin/:id/documentos/:tipo/status ─────────────────
router.patch("/admin/:id/documentos/:tipo/status", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const { id, tipo } = req.params;
    const ALLOWED: Record<string, string> = {
      cnh: "doc_cnh_status", veiculo: "doc_veiculo_status",
      selfie: "doc_selfie_status", rg: "doc_rg_status",
    };
    const VALID = ["pendente", "em_analise", "aprovado", "rejeitado"];
    if (!ALLOWED[String(tipo)]) return res.status(400).json({ error: "invalid_tipo" });
    if (!VALID.includes(status)) return res.status(400).json({ error: "invalid_status" });
    const col = ALLOWED[String(tipo)]!;
    const safeStatus = String(status).replace(/'/g, "''");
    await db.execute(sql.raw(`UPDATE motoristas_app SET ${col} = '${safeStatus}' WHERE id = ${Number(id)}`));
    return res.json({ id: Number(id), tipo, status });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── PATCH /api/delivery/admin/:id/status ──────────────────────────────────
router.patch("/admin/:id/status", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const validStatuses = ["pendente", "em_analise", "aprovado", "ativo", "suspenso", "bloqueado"];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: "invalid_status" });
    const rows = await db.execute(sql`
      UPDATE motoristas_app
      SET status = ${status}, atualizado_em = NOW()
      WHERE id = ${Number(req.params.id)} AND tipo_profissional = 'delivery'
      RETURNING id, nome, status, tipo_profissional
    `);
    if (!rows.rows.length) return res.status(404).json({ error: "not_found" });
    return res.json(rows.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── DELETE /api/delivery/admin/:id — Excluir entregador (boy delivery) ────
router.delete("/admin/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "ID inválido" });
  try {
    // Limpa vínculos antes de remover
    try { await db.execute(sql`DELETE FROM motorista_categorias WHERE motorista_id = ${id}`); } catch (_) {}
    try { await db.execute(sql`DELETE FROM repasses_pro WHERE profissional_id = ${id}`); } catch (_) {}
    const result = await db.execute(sql`
      DELETE FROM motoristas_app
      WHERE id = ${id} AND tipo_profissional = 'delivery'
      RETURNING id
    `);
    if (!result.rows.length) return res.status(404).json({ error: "Entregador não encontrado" });
    return res.json({ ok: true, id });
  } catch (err) {
    console.error("delivery/admin/delete error:", err);
    return res.status(500).json({ error: "Erro ao excluir entregador" });
  }
});

export default router;
