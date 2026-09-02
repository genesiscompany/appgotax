import { Router } from "express";
import { db } from "@workspace/db";
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "dummy",
});

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

const DEFAULT_PROMPT = `Você é a Gô, assistente virtual da GoTaxi. Responda em português do Brasil, de forma simpática e direta, em no máximo 1 parágrafo curto. Nunca peça dados sensíveis como senhas. Se não souber a resposta com certeza, diga que um atendente irá ajudar em breve.`;

async function getSystemPrompt(): Promise<string> {
  try {
    const rows = await db.execute(
      `SELECT valor FROM gotatxi_config WHERE chave = 'ia_suporte_prompt'`
    );
    const val = (rows.rows[0] as any)?.valor;
    return val?.trim() ? val : DEFAULT_PROMPT;
  } catch {
    return DEFAULT_PROMPT;
  }
}

async function generateAiReply(ticketId: number, novaMsg: string): Promise<string | null> {
  try {
    const history = await db.execute(
      `SELECT remetente, mensagem FROM suporte_mensagens WHERE ticket_id = ${ticketId} ORDER BY created_at ASC LIMIT 20`
    );
    const systemPrompt = await getSystemPrompt();
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
    ];
    for (const row of history.rows as any[]) {
      const role = row.remetente === "loja" ? "user" : "assistant";
      messages.push({ role, content: row.mensagem });
    }
    messages.push({ role: "user", content: novaMsg });

    console.log("[suporte-ia] usando modelo gpt-4o-mini, key=" + (process.env.OPENAI_API_KEY ? "presente" : process.env.AI_INTEGRATIONS_OPENAI_API_KEY ? "integrations" : "ausente"));
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
    });
    return completion.choices[0]?.message?.content ?? null;
  } catch (err: any) {
    console.error("[suporte-ia] erro:", err?.message || err, err?.status || "", err?.response?.data || "");
    return null;
  }
}

// ── PDV Router (lojista) ─────────────────────────────────────────────────────
export const pdvRouter = Router();

// GET /api/pdv/suporte/tickets
pdvRouter.get("/tickets", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const rows = await db.execute(
      `SELECT id, titulo, status, prioridade, categoria, nao_lidas_loja, ultima_mensagem, ultima_at, created_at
       FROM suporte_tickets WHERE empresa_id = ${empresaId}
       ORDER BY ultima_at DESC LIMIT 50`
    );
    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// POST /api/pdv/suporte/tickets
pdvRouter.post("/tickets", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { titulo, categoria, prioridade, mensagem_inicial, empresa_nome } = req.body;
    if (!titulo?.trim() || !mensagem_inicial?.trim())
      return res.status(400).json({ error: "titulo e mensagem_inicial obrigatórios" });

    const nome = esc(empresa_nome || "Lojista");
    const tit = esc(titulo.trim());
    const cat = esc(categoria || "geral");
    const pri = ["baixa","normal","alta","urgente"].includes(prioridade) ? prioridade : "normal";
    const msgEsc = esc(mensagem_inicial.trim());

    const created = await db.execute(
      `INSERT INTO suporte_tickets (empresa_id, empresa_nome, titulo, categoria, prioridade, ultima_mensagem, nao_lidas_admin)
       VALUES (${empresaId}, '${nome}', '${tit}', '${cat}', '${pri}', '${msgEsc}', 1)
       RETURNING id`
    );
    const ticketId = (created.rows[0] as any).id;

    await db.execute(
      `INSERT INTO suporte_mensagens (ticket_id, remetente, mensagem)
       VALUES (${ticketId}, 'loja', '${msgEsc}')`
    );

    // Gerar resposta da IA de forma assíncrona
    (async () => {
      const aiReply = await generateAiReply(ticketId, mensagem_inicial.trim());
      if (aiReply) {
        const escaped = esc(aiReply);
        await db.execute(
          `INSERT INTO suporte_mensagens (ticket_id, remetente, mensagem)
           VALUES (${ticketId}, 'ia', '${escaped}')`
        );
        await db.execute(
          `UPDATE suporte_tickets SET ultima_mensagem = '${escaped}', ultima_at = NOW(), nao_lidas_loja = 1
           WHERE id = ${ticketId}`
        );
      }
    })().catch(console.error);

    return res.json({ id: ticketId, ia_respondeu: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// GET /api/pdv/suporte/tickets/:id/mensagens
pdvRouter.get("/tickets/:id/mensagens", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const ticketId = Number(req.params.id);

    const ticket = await db.execute(
      `SELECT id FROM suporte_tickets WHERE id = ${ticketId} AND empresa_id = ${empresaId}`
    );
    if (!ticket.rows[0]) return res.status(404).json({ error: "not_found" });

    await db.execute(`UPDATE suporte_tickets SET nao_lidas_loja = 0 WHERE id = ${ticketId}`);
    await db.execute(`UPDATE suporte_mensagens SET lida = TRUE WHERE ticket_id = ${ticketId} AND remetente != 'loja'`);

    const rows = await db.execute(
      `SELECT id, remetente, mensagem, lida, created_at FROM suporte_mensagens
       WHERE ticket_id = ${ticketId} ORDER BY created_at ASC`
    );
    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// POST /api/pdv/suporte/tickets/:id/mensagens
pdvRouter.post("/tickets/:id/mensagens", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const ticketId = Number(req.params.id);
    const { mensagem } = req.body;
    if (!mensagem?.trim()) return res.status(400).json({ error: "mensagem vazia" });

    const ticket = await db.execute(
      `SELECT id FROM suporte_tickets WHERE id = ${ticketId} AND empresa_id = ${empresaId}`
    );
    if (!ticket.rows[0]) return res.status(404).json({ error: "not_found" });

    const msg = esc(mensagem.trim());
    const row = await db.execute(
      `INSERT INTO suporte_mensagens (ticket_id, remetente, mensagem)
       VALUES (${ticketId}, 'loja', '${msg}') RETURNING id, remetente, mensagem, lida, created_at`
    );
    await db.execute(
      `UPDATE suporte_tickets SET ultima_mensagem = '${msg}', ultima_at = NOW(),
       nao_lidas_admin = nao_lidas_admin + 1,
       status = CASE WHEN status = 'fechado' THEN 'aberto' ELSE status END
       WHERE id = ${ticketId}`
    );

    // IA responde se não há atendente humano ainda
    const hasHuman = await db.execute(
      `SELECT id FROM suporte_mensagens WHERE ticket_id = ${ticketId} AND remetente = 'admin' LIMIT 1`
    );
    if (!hasHuman.rows[0]) {
      (async () => {
        const aiReply = await generateAiReply(ticketId, mensagem.trim());
        if (aiReply) {
          const escaped = esc(aiReply);
          await db.execute(
            `INSERT INTO suporte_mensagens (ticket_id, remetente, mensagem)
             VALUES (${ticketId}, 'ia', '${escaped}')`
          );
          await db.execute(
            `UPDATE suporte_tickets SET ultima_mensagem = '${escaped}', ultima_at = NOW(), nao_lidas_loja = nao_lidas_loja + 1
             WHERE id = ${ticketId}`
          );
        }
      })().catch(console.error);
    }

    return res.json(row.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// POST /api/pdv/suporte/tickets/:id/fechar
pdvRouter.post("/tickets/:id/fechar", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const ticketId = Number(req.params.id);
    await db.execute(
      `UPDATE suporte_tickets SET status = 'fechado' WHERE id = ${ticketId} AND empresa_id = ${empresaId}`
    );
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "server_error" });
  }
});

// GET /api/pdv/suporte/nao-lidas
pdvRouter.get("/nao-lidas", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.json({ total: 0 });
    const rows = await db.execute(
      `SELECT COALESCE(SUM(nao_lidas_loja),0) as total FROM suporte_tickets WHERE empresa_id = ${empresaId}`
    );
    return res.json({ total: Number((rows.rows[0] as any)?.total ?? 0) });
  } catch {
    return res.json({ total: 0 });
  }
});

// ── Admin Router ─────────────────────────────────────────────────────────────
export const adminRouter = Router();

// GET /api/admin/suporte/tickets
adminRouter.get("/tickets", async (req, res) => {
  try {
    const status = req.query.status ? `AND status = '${esc(String(req.query.status))}'` : "";
    const rows = await db.execute(
      `SELECT id, empresa_id, empresa_nome, titulo, status, prioridade, categoria,
              nao_lidas_admin, ultima_mensagem, ultima_at, created_at
       FROM suporte_tickets WHERE 1=1 ${status}
       ORDER BY prioridade = 'urgente' DESC, prioridade = 'alta' DESC, ultima_at DESC
       LIMIT 100`
    );
    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// GET /api/admin/suporte/tickets/:id/mensagens
adminRouter.get("/tickets/:id/mensagens", async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    await db.execute(`UPDATE suporte_tickets SET nao_lidas_admin = 0 WHERE id = ${ticketId}`);
    await db.execute(`UPDATE suporte_mensagens SET lida = TRUE WHERE ticket_id = ${ticketId} AND remetente = 'loja'`);
    const rows = await db.execute(
      `SELECT id, remetente, mensagem, lida, created_at FROM suporte_mensagens
       WHERE ticket_id = ${ticketId} ORDER BY created_at ASC`
    );
    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// POST /api/admin/suporte/tickets/:id/mensagens
adminRouter.post("/tickets/:id/mensagens", async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    const { mensagem } = req.body;
    if (!mensagem?.trim()) return res.status(400).json({ error: "mensagem vazia" });
    const msg = esc(mensagem.trim());
    const row = await db.execute(
      `INSERT INTO suporte_mensagens (ticket_id, remetente, mensagem)
       VALUES (${ticketId}, 'admin', '${msg}') RETURNING id, remetente, mensagem, lida, created_at`
    );
    await db.execute(
      `UPDATE suporte_tickets SET ultima_mensagem = '${msg}', ultima_at = NOW(),
       nao_lidas_loja = nao_lidas_loja + 1, status = 'em_andamento'
       WHERE id = ${ticketId}`
    );
    return res.json(row.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// PATCH /api/admin/suporte/tickets/:id
adminRouter.patch("/tickets/:id", async (req, res) => {
  try {
    const ticketId = Number(req.params.id);
    const { status, prioridade } = req.body;
    const sets: string[] = [];
    if (status && ["aberto","em_andamento","resolvido","fechado"].includes(status))
      sets.push(`status = '${status}'`);
    if (prioridade && ["baixa","normal","alta","urgente"].includes(prioridade))
      sets.push(`prioridade = '${prioridade}'`);
    if (!sets.length) return res.status(400).json({ error: "nothing to update" });
    await db.execute(`UPDATE suporte_tickets SET ${sets.join(", ")} WHERE id = ${ticketId}`);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "server_error" });
  }
});

// GET /api/admin/suporte/config/prompt
adminRouter.get("/config/prompt", async (req, res) => {
  try {
    const prompt = await getSystemPrompt();
    return res.json({ prompt });
  } catch {
    return res.status(500).json({ error: "server_error" });
  }
});

// PUT /api/admin/suporte/config/prompt
adminRouter.put("/config/prompt", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt?.trim()) return res.status(400).json({ error: "prompt vazio" });
    const escaped = esc(prompt.trim());
    await db.execute(
      `INSERT INTO gotatxi_config (chave, valor, updated_at)
       VALUES ('ia_suporte_prompt', '${escaped}', NOW())
       ON CONFLICT (chave) DO UPDATE SET valor = '${escaped}', updated_at = NOW()`
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// GET /api/admin/suporte/nao-lidas
adminRouter.get("/nao-lidas", async (req, res) => {
  try {
    const rows = await db.execute(
      `SELECT COALESCE(SUM(nao_lidas_admin),0) as total FROM suporte_tickets WHERE status != 'fechado'`
    );
    return res.json({ total: Number((rows.rows[0] as any)?.total ?? 0) });
  } catch {
    return res.json({ total: 0 });
  }
});
