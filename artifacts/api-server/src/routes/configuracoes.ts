import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import jwt from "jsonwebtoken";

const router: IRouter = Router();

function requireAdmin(req: any, res: any): boolean {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) { res.status(401).json({ error: "unauthorized" }); return false; }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "gotaxi-admin-secret-2024") as any;
    if (payload.papel !== "admin") { res.status(403).json({ error: "forbidden" }); return false; }
    return true;
  } catch { res.status(401).json({ error: "invalid_token" }); return false; }
}

// GET /api/configuracoes/sistema — retorna todas as configs (público, para páginas legais)
router.get("/sistema", async (_req, res) => {
  try {
    const rows = (await db.execute(sql`SELECT chave, valor FROM configuracoes_sistema`)).rows as any[];
    const map: Record<string, string> = {};
    for (const r of rows) map[r.chave] = r.valor;
    res.json(map);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/configuracoes/admin — retorna todas as configs + afiliados_config (admin)
router.get("/admin", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const [sysRows, afilRows] = await Promise.all([
      db.execute(sql`SELECT chave, valor FROM configuracoes_sistema`),
      db.execute(sql`SELECT percentual_comissao, valor_minimo_saque FROM afiliados_config LIMIT 1`),
    ]);
    const sistema: Record<string, string> = {};
    for (const r of (sysRows.rows as any[])) sistema[r.chave] = r.valor;
    const afil = (afilRows.rows as any[])[0] || { percentual_comissao: 10, valor_minimo_saque: 50 };
    res.json({ sistema, afiliados: afil });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/configuracoes/admin — atualiza configs (admin)
router.patch("/admin", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { sistema, afiliados } = req.body as {
      sistema?: Record<string, string>;
      afiliados?: { percentual_comissao?: number; valor_minimo_saque?: number };
    };

    if (sistema && typeof sistema === "object") {
      for (const [chave, valor] of Object.entries(sistema)) {
        await db.execute(sql`
          INSERT INTO configuracoes_sistema (chave, valor, atualizado_em)
          VALUES (${chave}, ${valor}, NOW())
          ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = NOW()
        `);
      }
    }

    if (afiliados) {
      const rows = (await db.execute(sql`SELECT id FROM afiliados_config LIMIT 1`)).rows as any[];
      if (rows.length > 0) {
        await db.execute(sql`
          UPDATE afiliados_config SET
            percentual_comissao = COALESCE(${afiliados.percentual_comissao ?? null}, percentual_comissao),
            valor_minimo_saque = COALESCE(${afiliados.valor_minimo_saque ?? null}, valor_minimo_saque),
            atualizado_em = NOW()
        `);
      } else {
        await db.execute(sql`
          INSERT INTO afiliados_config (percentual_comissao, valor_minimo_saque)
          VALUES (${afiliados.percentual_comissao ?? 10}, ${afiliados.valor_minimo_saque ?? 50})
        `);
      }
    }

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
