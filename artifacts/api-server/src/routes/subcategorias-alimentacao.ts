import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { subcategoriasAlimentacaoTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import jwt from "jsonwebtoken";

const router: IRouter = Router();
const JWT_SECRET = process.env["JWT_SECRET"] || "gotaxi-admin-secret-2024";

// ── Admin auth middleware (mesmo padrão do admin.ts) ──────────────────────────
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

// ── GET /api/subcategorias-alimentacao (público) ──────────────────────────────
// Retorna apenas as subcategorias ativas, ordenadas
router.get("/", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(subcategoriasAlimentacaoTable)
      .where(eq(subcategoriasAlimentacaoTable.ativo, true))
      .orderBy(asc(subcategoriasAlimentacaoTable.ordem), asc(subcategoriasAlimentacaoTable.nome));
    res.json(rows);
  } catch (err: any) {
    console.error("[subcategorias-alimentacao] GET / erro:", err?.message || err);
    res.status(500).json({ error: "internal_error" });
  }
});

// ── GET /api/subcategorias-alimentacao/admin (admin) ──────────────────────────
// Retorna todas (incluindo inativas) — para o painel admin
router.get("/admin", requireAdmin, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(subcategoriasAlimentacaoTable)
      .orderBy(asc(subcategoriasAlimentacaoTable.ordem), asc(subcategoriasAlimentacaoTable.nome));
    res.json(rows);
  } catch (err: any) {
    console.error("[subcategorias-alimentacao] GET /admin erro:", err?.message || err);
    res.status(500).json({ error: "internal_error" });
  }
});

function slugify(input: string): string {
  return String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── POST /api/subcategorias-alimentacao/admin ─────────────────────────────────
router.post("/admin", requireAdmin, async (req, res) => {
  try {
    const { nome, emoji, ordem, ativo } = req.body || {};
    if (!nome || typeof nome !== "string" || !nome.trim()) {
      return res.status(400).json({ error: "nome_required" });
    }
    const slug = slugify(nome);
    if (!slug) return res.status(400).json({ error: "nome_invalido" });

    const [row] = await db
      .insert(subcategoriasAlimentacaoTable)
      .values({
        nome: nome.trim(),
        slug,
        emoji: emoji || null,
        ordem: Number.isFinite(Number(ordem)) ? Number(ordem) : 0,
        ativo: ativo !== false,
      })
      .returning();
    return res.json(row);
  } catch (err: any) {
    console.error("[subcategorias-alimentacao] POST /admin erro:", err?.message || err);
    if (String(err?.message || "").includes("duplicate")) {
      return res.status(409).json({ error: "duplicada" });
    }
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── PATCH /api/subcategorias-alimentacao/admin/:id ────────────────────────────
router.patch("/admin/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "id_invalido" });
    const { nome, emoji, ordem, ativo } = req.body || {};

    const updates: Record<string, any> = {};
    if (typeof nome === "string" && nome.trim()) {
      updates.nome = nome.trim();
      updates.slug = slugify(nome);
    }
    if (emoji !== undefined) updates.emoji = emoji || null;
    if (ordem !== undefined && Number.isFinite(Number(ordem))) updates.ordem = Number(ordem);
    if (typeof ativo === "boolean") updates.ativo = ativo;

    if (Object.keys(updates).length === 0) return res.status(400).json({ error: "sem_alteracoes" });

    const [row] = await db
      .update(subcategoriasAlimentacaoTable)
      .set(updates)
      .where(eq(subcategoriasAlimentacaoTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "nao_encontrada" });
    return res.json(row);
  } catch (err: any) {
    console.error("[subcategorias-alimentacao] PATCH erro:", err?.message || err);
    if (String(err?.message || "").includes("duplicate")) {
      return res.status(409).json({ error: "duplicada" });
    }
    return res.status(500).json({ error: "internal_error" });
  }
});

// ── DELETE /api/subcategorias-alimentacao/admin/:id (soft delete) ─────────────
// Desativa em vez de deletar (preserva FK em restaurantes)
router.delete("/admin/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "id_invalido" });
    const [row] = await db
      .update(subcategoriasAlimentacaoTable)
      .set({ ativo: false })
      .where(eq(subcategoriasAlimentacaoTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "nao_encontrada" });
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[subcategorias-alimentacao] DELETE erro:", err?.message || err);
    return res.status(500).json({ error: "internal_error" });
  }
});

export default router;
