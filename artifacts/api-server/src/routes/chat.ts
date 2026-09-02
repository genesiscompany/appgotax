import { Router } from "express";
import { db } from "@workspace/db";

const router = Router();

function getEmpresaId(req: any): number | null {
  const raw = req.headers["x-empresa-id"] || req.headers["authorization"]?.replace("Bearer ", "");
  if (!raw) return null;
  try {
    const decoded = Buffer.from(String(raw), "base64").toString();
    const parts = decoded.split(":");
    if (parts.length >= 2) return Number(parts[1]);
  } catch {}
  return Number(req.headers["x-empresa-id"]) || null;
}

function esc(s: string) { return String(s ?? "").replace(/'/g, "''"); }

// POST /api/chat/conversa — get or create conversation (public, from mobile)
router.post("/conversa", async (req, res) => {
  try {
    const { empresa_id, cliente_nome, cliente_token } = req.body;
    if (!empresa_id || !cliente_token) return res.status(400).json({ error: "empresa_id e cliente_token obrigatórios" });
    const nome = esc(cliente_nome || "Cliente");
    const token = esc(cliente_token);
    const existing = await db.execute(`SELECT id FROM chat_conversas WHERE empresa_id = ${Number(empresa_id)} AND cliente_token = '${token}' LIMIT 1`);
    if (existing.rows[0]) return res.json({ id: (existing.rows[0] as any).id });
    const created = await db.execute(`INSERT INTO chat_conversas (empresa_id, cliente_nome, cliente_token) VALUES (${Number(empresa_id)}, '${nome}', '${token}') RETURNING id`);
    return res.json({ id: (created.rows[0] as any).id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// GET /api/chat/conversa/:id/mensagens — get messages (public, cliente polls)
router.get("/conversa/:id/mensagens", async (req, res) => {
  try {
    const conversaId = Number(req.params.id);
    const since = req.query.since ? `AND created_at > '${String(req.query.since)}'` : "";
    const rows = await db.execute(`SELECT id, remetente, mensagem, lida, created_at FROM chat_mensagens WHERE conversa_id = ${conversaId} ${since} ORDER BY created_at ASC LIMIT 200`);
    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// POST /api/chat/conversa/:id/mensagem — send message (public — cliente or loja)
router.post("/conversa/:id/mensagem", async (req, res) => {
  try {
    const conversaId = Number(req.params.id);
    const { remetente, mensagem } = req.body;
    if (!mensagem?.trim()) return res.status(400).json({ error: "mensagem vazia" });
    if (!["cliente", "loja"].includes(remetente)) return res.status(400).json({ error: "remetente inválido" });
    const msg = esc(mensagem.trim());
    const row = await db.execute(`INSERT INTO chat_mensagens (conversa_id, remetente, mensagem) VALUES (${conversaId}, '${remetente}', '${msg}') RETURNING id, remetente, mensagem, lida, created_at`);
    // Update conversa metadata
    if (remetente === "cliente") {
      await db.execute(`UPDATE chat_conversas SET ultima_mensagem = '${msg}', ultima_at = NOW(), nao_lidas_loja = nao_lidas_loja + 1 WHERE id = ${conversaId}`);
    } else {
      await db.execute(`UPDATE chat_mensagens SET lida = TRUE WHERE conversa_id = ${conversaId} AND remetente = 'cliente' AND lida = FALSE`);
      await db.execute(`UPDATE chat_conversas SET ultima_mensagem = '${msg}', ultima_at = NOW(), nao_lidas_loja = 0 WHERE id = ${conversaId}`);
    }
    return res.json(row.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// GET /api/chat/conversas — list all conversations for this empresa (authenticated PDV)
router.get("/conversas", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const rows = await db.execute(`SELECT id, cliente_nome, ultima_mensagem, ultima_at, nao_lidas_loja, created_at FROM chat_conversas WHERE empresa_id = ${empresaId} ORDER BY ultima_at DESC LIMIT 100`);
    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// GET /api/chat/total-nao-lidas — total unread for badge (authenticated PDV)
router.get("/total-nao-lidas", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const rows = await db.execute(`SELECT COALESCE(SUM(nao_lidas_loja), 0) as total FROM chat_conversas WHERE empresa_id = ${empresaId}`);
    return res.json({ total: Number((rows.rows[0] as any)?.total ?? 0) });
  } catch (err) {
    return res.json({ total: 0 });
  }
});

// POST /api/chat/conversa/:id/lida — mark all cliente messages as read (authenticated PDV)
router.post("/conversa/:id/lida", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const conversaId = Number(req.params.id);
    await db.execute(`UPDATE chat_mensagens SET lida = TRUE WHERE conversa_id = ${conversaId} AND remetente = 'cliente' AND lida = FALSE`);
    await db.execute(`UPDATE chat_conversas SET nao_lidas_loja = 0 WHERE id = ${conversaId} AND empresa_id = ${empresaId}`);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "server_error" });
  }
});

export default router;
