import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { pedidosPdvTable, itensPedidoPdvTable, usuariosTable, empresasTable, restaurantesTable, itensCardapioTable } from "@workspace/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import { sendFcmNotification } from "./motorista-app";

const uploadsDir = path.resolve(process.cwd(), "uploads/comprovantes");
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `comp_${Date.now()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_req, file, cb) => {
  const allowed = ["image/jpeg","image/png","image/webp","image/gif","application/pdf"];
  cb(null, allowed.includes(file.mimetype));
}});

const productImagesDir = path.resolve(process.cwd(), "public", "uploads", "produtos");
fs.mkdirSync(productImagesDir, { recursive: true });
const productImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, productImagesDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".jpg";
      cb(null, `produto_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    cb(null, allowed.includes(file.mimetype));
  },
});

const router: IRouter = Router();

// ── MIGRATIONS (idempotentes) ────────────────────────────────────────────────
(async () => {
  try {
    await db.execute(sql`ALTER TABLE promocoes_pdv ADD COLUMN IF NOT EXISTS produto_id INTEGER REFERENCES produtos_pdv(id) ON DELETE SET NULL`);
    await db.execute(sql`ALTER TABLE promocoes_pdv ADD COLUMN IF NOT EXISTS preco_promocional NUMERIC(10,2)`);
    await db.execute(sql`ALTER TABLE promocoes_pdv ADD COLUMN IF NOT EXISTS quantidade_disponivel INTEGER`);
  } catch (e) { console.error("[pdv migrations promocoes]", e); }
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS grupos_extras_pdv (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER NOT NULL,
        nome TEXT NOT NULL,
        min_selecoes INTEGER NOT NULL DEFAULT 0,
        max_selecoes INTEGER NOT NULL DEFAULT 1,
        obrigatorio BOOLEAN NOT NULL DEFAULT false,
        ordem INTEGER NOT NULL DEFAULT 0,
        ativo BOOLEAN NOT NULL DEFAULT true,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS opcoes_grupo_extras_pdv (
        id SERIAL PRIMARY KEY,
        grupo_id INTEGER NOT NULL REFERENCES grupos_extras_pdv(id) ON DELETE CASCADE,
        nome TEXT NOT NULL,
        preco_adicional NUMERIC(10,2) NOT NULL DEFAULT 0,
        ordem INTEGER NOT NULL DEFAULT 0,
        ativo BOOLEAN NOT NULL DEFAULT true
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS produto_grupos_extras_pdv (
        produto_id INTEGER NOT NULL REFERENCES produtos_pdv(id) ON DELETE CASCADE,
        grupo_id INTEGER NOT NULL REFERENCES grupos_extras_pdv(id) ON DELETE CASCADE,
        ordem INTEGER NOT NULL DEFAULT 0
      )
    `);
    await db.execute(sql`ALTER TABLE produto_grupos_extras_pdv ADD COLUMN IF NOT EXISTS min_selecoes INTEGER`);
    await db.execute(sql`ALTER TABLE produto_grupos_extras_pdv ADD COLUMN IF NOT EXISTS max_selecoes INTEGER`);
    await db.execute(sql`ALTER TABLE produto_grupos_extras_pdv ADD COLUMN IF NOT EXISTS obrigatorio BOOLEAN`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_pgpe_produto_grupo ON produto_grupos_extras_pdv (produto_id, grupo_id)`);
  } catch (e) { console.error("[pdv migrations grupos]", e); }
})();

// ── SSE clients map: empresaId → Set<res> ──────────────────────────────────
const sseClients = new Map<number, Set<Response>>();

export function broadcastToEmpresa(empresaId: number, data: object) {
  const clients = sseClients.get(empresaId);
  if (!clients) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(res => {
    try { res.write(payload); } catch { clients.delete(res); }
  });
}

export async function sendExpoPushToEmpresa(empresaId: number, title: string, body: string, data?: object) {
  try {
    const result = await db.execute(sql`
      SELECT DISTINCT pt.token
      FROM push_tokens pt
      JOIN usuarios u ON u.id = pt.usuario_id
      WHERE u.empresa_id = ${empresaId} AND pt.ativo = true
      LIMIT 50
    `);
    const rows = result.rows as any[];
    if (!rows.length) return;
    const messages = rows.map((row: any) => ({
      to: row.token,
      title,
      body,
      sound: "default",
      channelId: "corrida_channel",
      priority: "high",
      data: data ?? {},
    }));
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
    });
  } catch (e) {
    console.warn("[sendExpoPushToEmpresa] error:", e);
  }
}

// ── Auth helper ─────────────────────────────────────────────────────────────
function getEmpresaId(req: Request): number | null {
  const raw = req.headers["x-empresa-id"] || req.headers["authorization"]?.replace("Bearer ", "");
  if (!raw) return null;
  // token format: base64(userId:empresaId:timestamp)
  try {
    const decoded = Buffer.from(String(raw), "base64").toString();
    const parts = decoded.split(":");
    if (parts.length >= 2) return Number(parts[1]);
  } catch { /* fall through */ }
  return Number(req.headers["x-empresa-id"]) || null;
}

function getPdvUserId(req: Request): number | null {
  const raw = req.headers["authorization"]?.replace("Bearer ", "");
  if (!raw) return null;
  try {
    const decoded = Buffer.from(String(raw), "base64").toString();
    const parts = decoded.split(":");
    if (parts.length >= 1) return Number(parts[0]) || null;
  } catch { /* fall through */ }
  return null;
}

// ── POST /api/pdv/login ─────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ error: "bad_request", message: "Email e senha obrigatórios" });

    const [usuario] = await db.select().from(usuariosTable).where(eq(usuariosTable.email, email)).limit(1);
    if (!usuario) return res.status(401).json({ error: "unauthorized", message: "Credenciais inválidas" });
    const bcrypt = await import("bcryptjs");
    const senhaOk = usuario.senhaHash.startsWith("$2")
      ? await bcrypt.compare(senha, usuario.senhaHash)
      : usuario.senhaHash === senha;
    if (!senhaOk) return res.status(401).json({ error: "unauthorized", message: "Credenciais inválidas" });
    if (usuario.papel !== "parceiro" && usuario.papel !== "admin") {
      return res.status(403).json({ error: "forbidden", message: "Acesso permitido apenas para parceiros" });
    }

    const [empresa] = await db.select().from(empresasTable).where(eq(empresasTable.id, usuario.empresaId)).limit(1);
    const token = Buffer.from(`${usuario.id}:${usuario.empresaId}:${Date.now()}`).toString("base64");
    const referralRow = (await db.execute(sql`
      SELECT u.codigo_referral, EXISTS(SELECT 1 FROM afiliados a WHERE a.usuario_id = u.id) AS is_afiliado
      FROM usuarios u WHERE u.id = ${usuario.id}
    `)).rows[0] as any;

    return res.json({
      token,
      usuario: {
        ...usuario,
        criadoEm: usuario.criadoEm.toISOString(),
        codigo_referral: referralRow?.codigo_referral ?? null,
        is_afiliado: !!referralRow?.is_afiliado,
      },
      empresa: empresa ? { ...empresa, criadoEm: empresa.criadoEm.toISOString() } : null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /api/pdv/me ─────────────────────────────────────────────────────────
router.get("/me", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const [empresa] = await db.select().from(empresasTable).where(eq(empresasTable.id, empresaId)).limit(1);
    if (!empresa) return res.status(404).json({ error: "not_found" });
    const usuarioId = getPdvUserId(req);
    let usuarioRow: any = null;
    if (usuarioId) {
      usuarioRow = (await db.execute(sql`
        SELECT u.codigo_referral, EXISTS(SELECT 1 FROM afiliados a WHERE a.usuario_id = u.id) AS is_afiliado
        FROM usuarios u WHERE u.id = ${usuarioId}
      `)).rows[0] ?? null;
    }
    return res.json({
      ...empresa,
      criadoEm: empresa.criadoEm.toISOString(),
      usuario: usuarioRow ? {
        codigo_referral: usuarioRow.codigo_referral ?? null,
        is_afiliado: !!usuarioRow.is_afiliado,
      } : null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── PATCH /api/pdv/alterar-senha — PDV partner changes own password ──────────
router.patch("/alterar-senha", async (req, res) => {
  try {
    const usuarioId = getPdvUserId(req);
    if (!usuarioId) return res.status(401).json({ error: "unauthorized" });
    const { senhaAtual, novaSenha } = req.body;
    if (!senhaAtual || !novaSenha) return res.status(400).json({ error: "bad_request", message: "senhaAtual e novaSenha são obrigatórios" });
    if (novaSenha.length < 6) return res.status(400).json({ error: "bad_request", message: "A nova senha deve ter pelo menos 6 caracteres" });
    const [user] = await db.select().from(usuariosTable).where(eq(usuariosTable.id, usuarioId)).limit(1);
    if (!user) return res.status(404).json({ error: "not_found" });
    const bcrypt = await import("bcryptjs");
    const senhaOk = user.senhaHash.startsWith("$2")
      ? await bcrypt.compare(senhaAtual, user.senhaHash)
      : user.senhaHash === senhaAtual;
    if (!senhaOk) return res.status(401).json({ error: "senha_incorreta", message: "Senha atual incorreta" });
    const novoHash = await bcrypt.hash(novaSenha, 10);
    await db.execute(`UPDATE usuarios SET senha_hash = '${novoHash}' WHERE id = ${usuarioId}`);
    return res.json({ ok: true, message: "Senha alterada com sucesso" });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/pdv/clientes?telefone=xxx ─────────────────────────────────────
router.get("/clientes", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { telefone } = req.query as { telefone?: string };
    if (!telefone || String(telefone).length < 3) return res.json([]);

    const clean = String(telefone).replace(/\D/g, "");
    const pedidos = await db.select({
      clienteNome: pedidosPdvTable.clienteNome,
      clienteWhatsapp: pedidosPdvTable.clienteWhatsapp,
      clienteEndereco: pedidosPdvTable.clienteEndereco,
      criadoEm: pedidosPdvTable.criadoEm,
    }).from(pedidosPdvTable)
      .where(and(eq(pedidosPdvTable.empresaId, empresaId), eq(pedidosPdvTable.clienteWhatsapp, clean)))
      .orderBy(desc(pedidosPdvTable.criadoEm))
      .limit(1);

    if (pedidos.length === 0) return res.json(null);
    const p = pedidos[0];
    return res.json({ clienteNome: p.clienteNome, clienteWhatsapp: p.clienteWhatsapp, clienteEndereco: p.clienteEndereco });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /api/pdv/pedidos ────────────────────────────────────────────────────
router.get("/pedidos", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });

    const pedidos = await db.select().from(pedidosPdvTable)
      .where(eq(pedidosPdvTable.empresaId, empresaId))
      .orderBy(desc(pedidosPdvTable.criadoEm))
      .limit(50);

    const result = await Promise.all(pedidos.map(async p => {
      const itens = await db.select().from(itensPedidoPdvTable).where(eq(itensPedidoPdvTable.pedidoId, p.id));
      return { ...p, criadoEm: p.criadoEm.toISOString(), atualizadoEm: p.atualizadoEm.toISOString(), itens };
    }));

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── POST /api/pdv/pedidos ───────────────────────────────────────────────────
router.post("/pedidos", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });

    const { modulo, tipo, clienteNome, clienteWhatsapp, clienteEndereco, mesa, total, taxa_entrega, distancia_km, observacoes, formaPagamento, itens } = req.body;

    const [pedido] = await db.insert(pedidosPdvTable).values({
      empresaId,
      modulo: modulo || "food",
      tipo: tipo || "delivery",
      status: "novo",
      clienteNome,
      clienteWhatsapp: clienteWhatsapp || null,
      clienteEndereco: clienteEndereco || null,
      mesa: mesa || null,
      total: Number(total) || 0,
      taxaEntrega: taxa_entrega != null ? String(Number(taxa_entrega)) : "0",
      distanciaKm: distancia_km != null ? String(Number(distancia_km)) : null,
      observacoes: observacoes || null,
      formaPagamento: formaPagamento || "dinheiro",
    } as any).returning();

    const itensSalvos = [];
    if (itens && Array.isArray(itens)) {
      for (const item of itens) {
        const [salvo] = await db.insert(itensPedidoPdvTable).values({
          pedidoId: pedido.id,
          produtoNome: item.nome,
          quantidade: Number(item.quantidade),
          precoUnitario: Number(item.preco),
          total: Number(item.quantidade) * Number(item.preco),
          observacoes: item.obs || null,
        }).returning();
        itensSalvos.push(salvo);
      }
    }

    const novoPedido = { ...pedido, criadoEm: pedido.criadoEm.toISOString(), atualizadoEm: pedido.atualizadoEm.toISOString(), itens: itensSalvos };
    broadcastToEmpresa(empresaId, { event: "novo_pedido", pedido: novoPedido });
    sendExpoPushToEmpresa(empresaId, "🛎️ Novo Pedido!", `${novoPedido.clienteNome || "Cliente"} — R$ ${Number(novoPedido.total).toFixed(2)}`);

    return res.status(201).json(novoPedido);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── PATCH /api/pdv/pedidos/:id/status ──────────────────────────────────────
router.patch("/pedidos/:id/status", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });

    const { status } = req.body;
    const id = Number(req.params.id);

    // Record status timestamp
    const tsCol: Record<string, string> = { preparando: "preparando_em", pronto: "pronto_em", entregue: "entregue_em" };
    const tsSet = tsCol[status] ? `, ${tsCol[status]} = NOW()` : "";
    await db.execute(`UPDATE pedidos_pdv SET status = '${status}', atualizado_em = NOW()${tsSet} WHERE id = ${id} AND empresa_id = ${empresaId}`);

    const rows = await db.execute(`SELECT * FROM pedidos_pdv WHERE id = ${id}`);
    const pedido = rows.rows[0] as any;
    if (!pedido) return res.status(404).json({ error: "not_found" });

    // When order becomes ready for delivery, trigger auto-dispatch if timeline is inactive
    if (status === "pronto" && pedido.tipo === "delivery") {
      autoDispatchBoy(empresaId, id).catch(() => {});
    }

    // When order is delivered, update the current week's repasse in real time
    if (status === "entregue") {
      try {
        const cfgRows = await db.execute(`SELECT taxa_repasse FROM configuracoes_plataforma LIMIT 1`);
        const taxa = Number((cfgRows.rows[0] as any)?.taxa_repasse ?? 3);
        const now = new Date();
        const dayOfWeek = now.getDay();
        const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(now); monday.setDate(now.getDate() + diffToMon); monday.setHours(0,0,0,0);
        const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
        await upsertRepasseEmpresa(empresaId, monday.toISOString().split("T")[0], sunday.toISOString().split("T")[0], taxa);
      } catch { /* non-critical — don't fail the request */ }
    }

    broadcastToEmpresa(empresaId, { event: "status_atualizado", pedidoId: id, status });
    return res.json(pedido);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── DELETE /api/pdv/pedidos/:id ─────────────────────────────────────────────
router.delete("/pedidos/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    await db.delete(itensPedidoPdvTable).where(eq(itensPedidoPdvTable.pedidoId, Number(req.params.id)));
    await db.delete(pedidosPdvTable).where(and(eq(pedidosPdvTable.id, Number(req.params.id)), eq(pedidosPdvTable.empresaId, empresaId)));
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /api/pdv/stream — SSE real-time ────────────────────────────────────
router.get("/stream", (req, res) => {
  const empresaId = getEmpresaId(req) || Number(req.query.empresaId);
  if (!empresaId) { res.status(401).end(); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.write("data: {\"event\":\"connected\"}\n\n");

  if (!sseClients.has(empresaId)) sseClients.set(empresaId, new Set());
  sseClients.get(empresaId)!.add(res);

  const heartbeat = setInterval(() => { try { res.write(": ping\n\n"); } catch { clearInterval(heartbeat); } }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.get(empresaId)?.delete(res);
  });
});

// ── GET /api/pdv/cardapio ───────────────────────────────────────────────────
router.get("/cardapio", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const restaurantes = await db.select().from(restaurantesTable).where(eq(restaurantesTable.empresaId, empresaId));
    if (!restaurantes.length) return res.json([]);
    const rest = restaurantes[0];
    const itens = await db.select().from(itensCardapioTable).where(eq(itensCardapioTable.restauranteId, rest.id));
    return res.json(itens);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── PATCH /api/pdv/empresa/destaque ────────────────────────────────────────
router.patch("/empresa/destaque", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { ativo } = req.body;
    // store in modulosAtivos for now (we extend empresas with destaque flag via modulosAtivos trick)
    const [empresa] = await db.select().from(empresasTable).where(eq(empresasTable.id, empresaId)).limit(1);
    if (!empresa) return res.status(404).json({ error: "not_found" });
    // We encode destaque status by adding/removing "destaque_ativo" from modulosAtivos
    let modulos = [...(empresa.modulosAtivos || [])].filter(m => !m.startsWith("destaque:"));
    modulos.push(`destaque:${ativo ? "on" : "off"}`);
    const [updated] = await db.update(empresasTable).set({ modulosAtivos: modulos }).where(eq(empresasTable.id, empresaId)).returning();
    return res.json({ destaqueAtivo: ativo, empresa: { ...updated, criadoEm: updated.criadoEm.toISOString() } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  CATALOG: CATEGORIAS, PRODUTOS, EXTRAS
// ══════════════════════════════════════════════════════════════════════════════

// ── Categorias ───────────────────────────────────────────────────────────────
router.get("/categorias", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const rows = await db.execute(
      `SELECT id, nome, ordem FROM categorias_pdv WHERE empresa_id = ${empresaId} ORDER BY ordem, id`
    );
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.post("/categorias", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ error: "nome required" });
    const rows = await db.execute(
      `INSERT INTO categorias_pdv (empresa_id, nome) VALUES (${empresaId}, '${String(nome).replace(/'/g, "''")}') RETURNING id, nome, ordem`
    );
    return res.status(201).json(rows.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.delete("/categorias/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    await db.execute(`DELETE FROM categorias_pdv WHERE id = ${Number(req.params.id)} AND empresa_id = ${empresaId}`);
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── Extras ───────────────────────────────────────────────────────────────────
router.get("/extras", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const rows = await db.execute(`SELECT id, nome, preco, ativo, obrigatorio FROM extras_pdv WHERE empresa_id = ${empresaId} ORDER BY id`);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.post("/extras", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { nome, preco, obrigatorio } = req.body;
    if (!nome) return res.status(400).json({ error: "nome required" });
    const rows = await db.execute(
      `INSERT INTO extras_pdv (empresa_id, nome, preco, obrigatorio) VALUES (${empresaId}, '${String(nome).replace(/'/g, "''")}', ${Number(preco) || 0}, ${obrigatorio ? "true" : "false"}) RETURNING id, nome, preco, ativo, obrigatorio`
    );
    return res.status(201).json(rows.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.patch("/extras/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { nome, preco, ativo, obrigatorio } = req.body;
    const sets: string[] = [];
    if (nome !== undefined) sets.push(`nome = '${String(nome).replace(/'/g, "''")}'`);
    if (preco !== undefined) sets.push(`preco = ${Number(preco)}`);
    if (ativo !== undefined) sets.push(`ativo = ${ativo ? "true" : "false"}`);
    if (obrigatorio !== undefined) sets.push(`obrigatorio = ${obrigatorio ? "true" : "false"}`);
    if (!sets.length) return res.status(400).json({ error: "nothing to update" });
    const rows = await db.execute(
      `UPDATE extras_pdv SET ${sets.join(", ")} WHERE id = ${Number(req.params.id)} AND empresa_id = ${empresaId} RETURNING id, nome, preco, ativo, obrigatorio`
    );
    return res.json(rows.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.delete("/extras/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    await db.execute(`DELETE FROM extras_pdv WHERE id = ${Number(req.params.id)} AND empresa_id = ${empresaId}`);
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── Grupos de Adicionais ──────────────────────────────────────────────────────
const esc = (s: string) => String(s).replace(/'/g, "''");

router.get("/grupos", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const grupos = await db.execute(`
      SELECT g.id, g.nome, g.min_selecoes, g.max_selecoes, g.obrigatorio, g.ordem, g.ativo,
        COALESCE(json_agg(json_build_object('id', o.id, 'nome', o.nome, 'preco_adicional', o.preco_adicional, 'ativo', o.ativo, 'ordem', o.ordem)
          ORDER BY o.ordem, o.id) FILTER (WHERE o.id IS NOT NULL), '[]') as opcoes
      FROM grupos_extras_pdv g
      LEFT JOIN opcoes_grupo_extras_pdv o ON o.grupo_id = g.id
      WHERE g.empresa_id = ${empresaId}
      GROUP BY g.id ORDER BY g.ordem, g.id
    `);
    return res.json(grupos.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.post("/grupos", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { nome, min_selecoes = 0, max_selecoes = 1, obrigatorio = false } = req.body;
    if (!nome) return res.status(400).json({ error: "nome required" });
    const rows = await db.execute(
      `INSERT INTO grupos_extras_pdv (empresa_id, nome, min_selecoes, max_selecoes, obrigatorio)
       VALUES (${empresaId}, '${esc(nome)}', ${Number(min_selecoes)}, ${Number(max_selecoes)}, ${obrigatorio ? "true" : "false"})
       RETURNING id, nome, min_selecoes, max_selecoes, obrigatorio, ordem, ativo`
    );
    return res.status(201).json({ ...rows.rows[0], opcoes: [] });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.patch("/grupos/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { nome, min_selecoes, max_selecoes, obrigatorio, ativo } = req.body;
    const sets: string[] = [];
    if (nome !== undefined) sets.push(`nome = '${esc(nome)}'`);
    if (min_selecoes !== undefined) sets.push(`min_selecoes = ${Number(min_selecoes)}`);
    if (max_selecoes !== undefined) sets.push(`max_selecoes = ${Number(max_selecoes)}`);
    if (obrigatorio !== undefined) sets.push(`obrigatorio = ${obrigatorio ? "true" : "false"}`);
    if (ativo !== undefined) sets.push(`ativo = ${ativo ? "true" : "false"}`);
    if (!sets.length) return res.status(400).json({ error: "nothing to update" });
    const rows = await db.execute(
      `UPDATE grupos_extras_pdv SET ${sets.join(", ")} WHERE id = ${Number(req.params.id)} AND empresa_id = ${empresaId}
       RETURNING id, nome, min_selecoes, max_selecoes, obrigatorio, ordem, ativo`
    );
    return res.json(rows.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.delete("/grupos/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    await db.execute(`DELETE FROM grupos_extras_pdv WHERE id = ${Number(req.params.id)} AND empresa_id = ${empresaId}`);
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.post("/grupos/:id/duplicar", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const grupoId = Number(req.params.id);
    const orig = await db.execute(
      `SELECT * FROM grupos_extras_pdv WHERE id = ${grupoId} AND empresa_id = ${empresaId}`
    );
    if (!orig.rows[0]) return res.status(404).json({ error: "not_found" });
    const g = orig.rows[0] as any;
    const novo = await db.execute(
      `INSERT INTO grupos_extras_pdv (empresa_id, nome, min_selecoes, max_selecoes, obrigatorio)
       VALUES (${empresaId}, '${esc(g.nome + " (cópia)")}', ${g.min_selecoes}, ${g.max_selecoes}, ${g.obrigatorio})
       RETURNING id`
    );
    const novoId = (novo.rows[0] as any).id;
    const opcoes = await db.execute(`SELECT * FROM opcoes_grupo_extras_pdv WHERE grupo_id = ${grupoId}`);
    for (const op of opcoes.rows as any[]) {
      await db.execute(
        `INSERT INTO opcoes_grupo_extras_pdv (grupo_id, nome, preco_adicional, ordem)
         VALUES (${novoId}, '${esc(op.nome)}', ${op.preco_adicional}, ${op.ordem})`
      );
    }
    const result = await db.execute(`
      SELECT g.id, g.nome, g.min_selecoes, g.max_selecoes, g.obrigatorio, g.ordem, g.ativo,
        COALESCE(json_agg(json_build_object('id', o.id, 'nome', o.nome, 'preco_adicional', o.preco_adicional, 'ativo', o.ativo, 'ordem', o.ordem)
          ORDER BY o.ordem, o.id) FILTER (WHERE o.id IS NOT NULL), '[]') as opcoes
      FROM grupos_extras_pdv g LEFT JOIN opcoes_grupo_extras_pdv o ON o.grupo_id = g.id
      WHERE g.id = ${novoId} GROUP BY g.id
    `);
    return res.status(201).json(result.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// Opções de grupo
router.post("/grupos/:id/opcoes", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const grupoId = Number(req.params.id);
    const g = await db.execute(`SELECT id FROM grupos_extras_pdv WHERE id = ${grupoId} AND empresa_id = ${empresaId}`);
    if (!g.rows[0]) return res.status(403).json({ error: "forbidden" });
    const { nome, preco_adicional = 0 } = req.body;
    if (!nome) return res.status(400).json({ error: "nome required" });
    const rows = await db.execute(
      `INSERT INTO opcoes_grupo_extras_pdv (grupo_id, nome, preco_adicional)
       VALUES (${grupoId}, '${esc(nome)}', ${Number(preco_adicional) || 0})
       RETURNING id, grupo_id, nome, preco_adicional, ativo, ordem`
    );
    return res.status(201).json(rows.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.patch("/grupos/opcoes/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { nome, preco_adicional, ativo } = req.body;
    const sets: string[] = [];
    if (nome !== undefined) sets.push(`nome = '${esc(nome)}'`);
    if (preco_adicional !== undefined) sets.push(`preco_adicional = ${Number(preco_adicional)}`);
    if (ativo !== undefined) sets.push(`ativo = ${ativo ? "true" : "false"}`);
    if (!sets.length) return res.status(400).json({ error: "nothing to update" });
    const rows = await db.execute(
      `UPDATE opcoes_grupo_extras_pdv SET ${sets.join(", ")}
       WHERE id = ${Number(req.params.id)} AND grupo_id IN (SELECT id FROM grupos_extras_pdv WHERE empresa_id = ${empresaId})
       RETURNING id, grupo_id, nome, preco_adicional, ativo, ordem`
    );
    return res.json(rows.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.delete("/grupos/opcoes/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    await db.execute(
      `DELETE FROM opcoes_grupo_extras_pdv WHERE id = ${Number(req.params.id)}
       AND grupo_id IN (SELECT id FROM grupos_extras_pdv WHERE empresa_id = ${empresaId})`
    );
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// Buscar grupos vinculados a um produto (com overrides por produto)
router.get("/produtos/:id/grupos", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const produtoId = Number(req.params.id);
    const result = await db.execute(
      `SELECT pg.grupo_id as id, pg.min_selecoes, pg.max_selecoes, pg.obrigatorio
       FROM produto_grupos_extras_pdv pg
       JOIN grupos_extras_pdv g ON g.id = pg.grupo_id
       WHERE pg.produto_id = ${produtoId} AND g.empresa_id = ${empresaId}
       ORDER BY pg.ordem, pg.grupo_id`
    );
    return res.json(result.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// Vincular grupos a produto (com overrides individuais por produto)
router.put("/produtos/:id/grupos", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const produtoId = Number(req.params.id);
    const { grupoIds, overrides } = req.body;
    await db.execute(`DELETE FROM produto_grupos_extras_pdv WHERE produto_id = ${produtoId}`);
    if (Array.isArray(grupoIds)) {
      for (let i = 0; i < grupoIds.length; i++) {
        const gid = Number(grupoIds[i]);
        const ov = (overrides && overrides[String(gid)]) ? overrides[String(gid)] : {};
        const min = ov.min_selecoes !== undefined ? Number(ov.min_selecoes) : "NULL";
        const max = ov.max_selecoes !== undefined ? Number(ov.max_selecoes) : "NULL";
        const obrig = ov.obrigatorio !== undefined ? (ov.obrigatorio ? "true" : "false") : "NULL";
        await db.execute(
          `INSERT INTO produto_grupos_extras_pdv (produto_id, grupo_id, ordem, min_selecoes, max_selecoes, obrigatorio)
           VALUES (${produtoId}, ${gid}, ${i}, ${min}, ${max}, ${obrig}) ON CONFLICT (produto_id, grupo_id) DO UPDATE
           SET ordem = ${i}, min_selecoes = ${min}, max_selecoes = ${max}, obrigatorio = ${obrig}`
        );
      }
    }
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── Produtos ─────────────────────────────────────────────────────────────────
router.get("/produtos", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const rows = await db.execute(`
      SELECT p.id, p.nome, p.descricao, p.preco, p.imagem, p.ativo,
             p.categoria_id, p.tamanhos, c.nome as categoria_nome,
             COALESCE(
               json_agg(json_build_object('id', e.id, 'nome', e.nome, 'preco', e.preco))
               FILTER (WHERE e.id IS NOT NULL), '[]'
             ) as extras
      FROM produtos_pdv p
      LEFT JOIN categorias_pdv c ON c.id = p.categoria_id
      LEFT JOIN produto_extras_pdv pe ON pe.produto_id = p.id
      LEFT JOIN extras_pdv e ON e.id = pe.extra_id
      WHERE p.empresa_id = ${empresaId}
      GROUP BY p.id, c.nome
      ORDER BY c.nome NULLS LAST, p.nome
    `);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.post("/produtos", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { nome, categoriaId, descricao, preco, extraIds, tamanhos } = req.body;
    if (!nome) return res.status(400).json({ error: "nome required" });
    const tamanhosClean = Array.isArray(tamanhos)
      ? tamanhos
          .map((t: any) => ({ nome: String(t?.nome ?? "").trim(), preco: Number(t?.preco) || 0 }))
          .filter((t) => t.nome.length > 0)
      : [];
    const tamanhosSql = tamanhosClean.length > 0
      ? `'${JSON.stringify(tamanhosClean).replace(/'/g, "''")}'::jsonb`
      : "NULL";
    const rows = await db.execute(`
      INSERT INTO produtos_pdv (empresa_id, categoria_id, nome, descricao, preco, tamanhos)
      VALUES (${empresaId}, ${categoriaId ? Number(categoriaId) : "NULL"}, '${String(nome).replace(/'/g, "''")}', ${descricao ? `'${String(descricao).replace(/'/g, "''")}'` : "NULL"}, ${Number(preco) || 0}, ${tamanhosSql})
      RETURNING id, nome, descricao, preco, imagem, ativo, categoria_id, tamanhos
    `);
    const produto = rows.rows[0] as any;
    if (extraIds && Array.isArray(extraIds) && extraIds.length > 0) {
      for (const eid of extraIds) {
        await db.execute(`INSERT INTO produto_extras_pdv (produto_id, extra_id) VALUES (${produto.id}, ${Number(eid)}) ON CONFLICT DO NOTHING`);
      }
    }
    return res.status(201).json({ ...produto, extras: [] });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.post("/produtos/:id/imagem", productImageUpload.single("imagem"), async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: "no_file", message: "Nenhum ficheiro enviado" });
    const imageUrl = `/uploads/produtos/${file.filename}`;
    await db.execute(`UPDATE produtos_pdv SET imagem = '${imageUrl}' WHERE id = ${Number(req.params.id)} AND empresa_id = ${empresaId}`);
    return res.json({ imagem: imageUrl });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.patch("/produtos/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { nome, categoriaId, descricao, preco, ativo, extraIds, tamanhos } = req.body;
    const sets: string[] = [];
    if (nome !== undefined) sets.push(`nome = '${String(nome).replace(/'/g, "''")}'`);
    if (categoriaId !== undefined) sets.push(`categoria_id = ${categoriaId ? Number(categoriaId) : "NULL"}`);
    if (descricao !== undefined) sets.push(`descricao = ${descricao ? `'${String(descricao).replace(/'/g, "''")}'` : "NULL"}`);
    if (preco !== undefined) sets.push(`preco = ${Number(preco)}`);
    if (ativo !== undefined) sets.push(`ativo = ${Boolean(ativo)}`);
    if (tamanhos !== undefined) {
      const tamanhosClean = Array.isArray(tamanhos)
        ? tamanhos
            .map((t: any) => ({ nome: String(t?.nome ?? "").trim(), preco: Number(t?.preco) || 0 }))
            .filter((t) => t.nome.length > 0)
        : [];
      sets.push(
        tamanhosClean.length > 0
          ? `tamanhos = '${JSON.stringify(tamanhosClean).replace(/'/g, "''")}'::jsonb`
          : `tamanhos = NULL`
      );
    }
    let rows;
    if (sets.length > 0) {
      rows = await db.execute(
        `UPDATE produtos_pdv SET ${sets.join(", ")} WHERE id = ${Number(req.params.id)} AND empresa_id = ${empresaId} RETURNING id, nome, descricao, preco, imagem, ativo, categoria_id, tamanhos`
      );
    }
    if (extraIds !== undefined && Array.isArray(extraIds)) {
      await db.execute(`DELETE FROM produto_extras_pdv WHERE produto_id = ${Number(req.params.id)}`);
      for (const eid of extraIds) {
        await db.execute(`INSERT INTO produto_extras_pdv (produto_id, extra_id) VALUES (${Number(req.params.id)}, ${Number(eid)}) ON CONFLICT DO NOTHING`);
      }
    }
    return res.json(rows?.rows[0] ?? { ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.delete("/produtos/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    await db.execute(`DELETE FROM produto_extras_pdv WHERE produto_id = ${Number(req.params.id)}`);
    await db.execute(`DELETE FROM produtos_pdv WHERE id = ${Number(req.params.id)} AND empresa_id = ${empresaId}`);
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── POST /api/pdv/repasse/:id/comprovante ─────────────────────────────────────
router.post("/repasse/:id/comprovante", upload.single("comprovante"), async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: "Arquivo inválido ou muito grande (máx 10MB)" });

    const { observacao } = req.body;
    const rows = await db.execute(`
      UPDATE repasses
      SET comprovante_path = '${file.filename}',
          comprovante_enviado_em = NOW(),
          comprovante_observacao = '${String(observacao || "").replace(/'/g, "''")}'
      WHERE id = ${Number(req.params.id)} AND empresa_id = ${empresaId}
      RETURNING id, status, comprovante_path, comprovante_enviado_em
    `);
    if (!rows.rows.length) return res.status(404).json({ error: "repasse not found" });
    return res.json(rows.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── Helper: upsert repasse for a given empresa + week ───────────────────────
// Soma a receita semanal da empresa nos 3 módulos que geram comissão para a GoTaxi:
//   • Alimentação + E-commerce → pedidos_pdv (status='entregue')
//   • Encomendas               → encomendas.valor_frete (status='entregue')
//   • Tur Viagens (passagens)  → viagens_passagens.valor (status='confirmado')
async function upsertRepasseEmpresa(empresaId: number, semanaInicio: string, semanaFim: string, taxa: number) {
  const rec = await db.execute(`
    SELECT
      COALESCE((SELECT SUM(total) FROM pedidos_pdv
        WHERE empresa_id = ${empresaId} AND status = 'entregue'
        AND criado_em >= '${semanaInicio}' AND criado_em <= '${semanaFim} 23:59:59'), 0)
      +
      COALESCE((SELECT SUM(valor_frete) FROM encomendas
        WHERE empresa_id = ${empresaId} AND status = 'entregue'
        AND criado_em >= '${semanaInicio}' AND criado_em <= '${semanaFim} 23:59:59'), 0)
      +
      COALESCE((SELECT SUM(valor) FROM viagens_passagens
        WHERE empresa_id = ${empresaId} AND status = 'confirmado'
        AND vendido_em >= '${semanaInicio}' AND vendido_em <= '${semanaFim} 23:59:59'), 0)
      AS receita
  `);
  const receita = Number((rec.rows[0] as any)?.receita ?? 0);
  const valor = parseFloat((receita * taxa / 100).toFixed(2));
  await db.execute(`
    INSERT INTO repasses (empresa_id, semana_inicio, semana_fim, receita_total, taxa_percentual, valor_repasse, status)
    VALUES (${empresaId}, '${semanaInicio}', '${semanaFim}', ${receita}, ${taxa}, ${valor}, 'pendente')
    ON CONFLICT (empresa_id, semana_inicio) DO UPDATE SET
      receita_total = EXCLUDED.receita_total,
      valor_repasse = EXCLUDED.valor_repasse,
      taxa_percentual = EXCLUDED.taxa_percentual
    WHERE repasses.status = 'pendente'
  `);
  const r = await db.execute(`SELECT * FROM repasses WHERE empresa_id = ${empresaId} AND semana_inicio = '${semanaInicio}' LIMIT 1`);
  return r.rows[0] as any ?? null;
}

// ── GET /api/pdv/repasse-status ───────────────────────────────────────────────
// Auto-calculates and upserts repasse records from real order data, then checks if blocked.
router.get("/repasse-status", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });

    const cfg = await db.execute(`SELECT * FROM configuracoes_plataforma LIMIT 1`);
    const config = cfg.rows[0] as any;
    const taxa = Number(config?.taxa_repasse ?? 3);

    const now = new Date();
    const dayOfWeek = now.getDay();

    // Current week (Mon–Sun)
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now); monday.setDate(now.getDate() + diffToMon); monday.setHours(0,0,0,0);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const semanaInicio = monday.toISOString().split("T")[0];
    const semanaFim = sunday.toISOString().split("T")[0];

    // Previous week (the one that is due for payment)
    const lastMonday = new Date(monday); lastMonday.setDate(monday.getDate() - 7);
    const lastSunday = new Date(monday); lastSunday.setDate(monday.getDate() - 1);
    const semanaPassadaInicio = lastMonday.toISOString().split("T")[0];
    const semanaPassadaFim = lastSunday.toISOString().split("T")[0];

    // Vencimento deadline (e.g. Monday 18:00 of current week)
    const [hh, mm] = String(config?.hora_vencimento ?? "18:00").split(":").map(Number);
    const diaVen = Number(config?.dia_vencimento ?? 1);
    const vencimento = new Date(monday);
    vencimento.setDate(monday.getDate() + (diaVen === 1 ? 0 : diaVen - 1));
    vencimento.setHours(hh, mm, 0, 0);

    // Auto-upsert BOTH weeks from real pedidos_pdv data
    await upsertRepasseEmpresa(empresaId, semanaInicio, semanaFim, taxa);
    const repassePassado = await upsertRepasseEmpresa(empresaId, semanaPassadaInicio, semanaPassadaFim, taxa);

    // Auto-unblock repasses with valor = 0 (nenhuma receita no período → sem cobrança)
    if (repassePassado && repassePassado.status === "bloqueado" && parseFloat(repassePassado.valor_repasse) <= 0) {
      await db.execute(`UPDATE repasses SET status = 'pago', pago_em = NOW() WHERE id = ${repassePassado.id}`);
      repassePassado.status = "pago";
      // Reativa a empresa se ela não tem nenhum outro repasse bloqueado com valor > 0
      const stillBlocked = await db.execute(`
        SELECT 1 FROM repasses
        WHERE empresa_id = ${empresaId} AND status = 'bloqueado' AND valor_repasse > 0
        LIMIT 1
      `);
      if (!stillBlocked.rows.length) {
        await db.execute(`UPDATE empresas SET ativo = true, ecommerce_status = 'ativo' WHERE id = ${empresaId}`);
      }
    }

    // Auto-block if deadline passed, last week still pending AND valor > 0
    if (now > vencimento && repassePassado && repassePassado.status === "pendente" && parseFloat(repassePassado.valor_repasse) > 0) {
      await db.execute(`UPDATE repasses SET status = 'bloqueado' WHERE id = ${repassePassado.id}`);
      repassePassado.status = "bloqueado";
    }

    // Also auto-block current week repasse if past deadline, pendente AND valor > 0
    const repasseAtual = await db.execute(`SELECT * FROM repasses WHERE empresa_id = ${empresaId} AND semana_inicio = '${semanaInicio}' LIMIT 1`);
    const repAtual = repasseAtual.rows[0] as any;

    // Auto-unblock current week repasse if valor = 0
    if (repAtual && repAtual.status === "bloqueado" && parseFloat(repAtual.valor_repasse) <= 0) {
      await db.execute(`UPDATE repasses SET status = 'pago', pago_em = NOW() WHERE id = ${repAtual.id}`);
      repAtual.status = "pago";
    }

    if (now > vencimento && repAtual && repAtual.status === "pendente" && parseFloat(repAtual.valor_repasse) > 0) {
      await db.execute(`UPDATE repasses SET status = 'bloqueado' WHERE id = ${repAtual.id}`);
      repAtual.status = "bloqueado";
    }

    // Blocked only if either week is blocked AND valor > 0
    const bloqueado = (repassePassado?.status === "bloqueado" && parseFloat(repassePassado?.valor_repasse ?? "0") > 0)
                   || (repAtual?.status === "bloqueado" && parseFloat(repAtual?.valor_repasse ?? "0") > 0);

    // Return the blocking repasse (previous week takes priority for payment)
    const repasseExibido = repassePassado?.status === "bloqueado" ? repassePassado :
                           repAtual?.status === "bloqueado" ? repAtual :
                           repassePassado ?? repAtual ?? null;

    return res.json({
      bloqueado,
      repasse: repasseExibido,
      repasse_semana_atual: repAtual ?? null,
      config: {
        taxa_repasse: taxa,
        chave_pix: config?.chave_pix ?? null,
        tipo_chave_pix: config?.tipo_chave_pix ?? null,
        nome_beneficiario: config?.nome_beneficiario ?? null,
        vencimento: vencimento.toISOString(),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── PROMOÇÕES CRUD ────────────────────────────────────────────────────────────
router.get("/promocoes", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const rows = await db.execute(`
      SELECT pr.*, p.nome AS produto_nome, p.preco AS produto_preco, p.imagem AS produto_imagem
      FROM promocoes_pdv pr
      LEFT JOIN produtos_pdv p ON p.id = pr.produto_id
      WHERE pr.empresa_id = ${empresaId}
      ORDER BY pr.criado_em DESC
    `);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.post("/promocoes", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { nome, descricao, tipo, valor, codigo_cupom, min_pedido, validade,
            produto_id, preco_promocional, quantidade_disponivel } = req.body;
    const rows = await db.execute(`
      INSERT INTO promocoes_pdv (empresa_id, nome, descricao, tipo, valor, codigo_cupom, min_pedido, validade,
                                 produto_id, preco_promocional, quantidade_disponivel)
      VALUES (${empresaId}, '${String(nome).replace(/'/g,"''")}', ${descricao ? `'${String(descricao).replace(/'/g,"''")}'` : 'NULL'},
        '${tipo || 'percentual'}', ${Number(valor) || 0},
        ${codigo_cupom ? `'${String(codigo_cupom).replace(/'/g,"''").toUpperCase()}'` : 'NULL'},
        ${min_pedido ? Number(min_pedido) : 0},
        ${validade ? `'${validade}'` : 'NULL'},
        ${produto_id ? Number(produto_id) : 'NULL'},
        ${preco_promocional !== undefined && preco_promocional !== null && preco_promocional !== "" ? Number(preco_promocional) : 'NULL'},
        ${quantidade_disponivel !== undefined && quantidade_disponivel !== null && quantidade_disponivel !== "" ? Number(quantidade_disponivel) : 'NULL'})
      RETURNING *
    `);
    return res.status(201).json(rows.rows[0]);
  } catch (err: any) {
    const pg = err?.cause ?? err;
    if (pg?.code === "23505") return res.status(409).json({ error: "cupom_duplicado", message: "Código de cupom já existe" });
    console.error(err); return res.status(500).json({ error: "server_error" });
  }
});

router.patch("/promocoes/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { nome, descricao, tipo, valor, codigo_cupom, min_pedido, validade, ativo,
            produto_id, preco_promocional, quantidade_disponivel } = req.body;
    const sets: string[] = [];
    if (nome !== undefined) sets.push(`nome = '${String(nome).replace(/'/g,"''")}'`);
    if (descricao !== undefined) sets.push(`descricao = ${descricao ? `'${String(descricao).replace(/'/g,"''")}'` : 'NULL'}`);
    if (tipo !== undefined) sets.push(`tipo = '${tipo}'`);
    if (valor !== undefined) sets.push(`valor = ${Number(valor) || 0}`);
    if (codigo_cupom !== undefined) sets.push(`codigo_cupom = ${codigo_cupom ? `'${String(codigo_cupom).toUpperCase().replace(/'/g,"''")}'` : 'NULL'}`);
    if (min_pedido !== undefined) sets.push(`min_pedido = ${Number(min_pedido) || 0}`);
    if (validade !== undefined) sets.push(`validade = ${validade ? `'${validade}'` : 'NULL'}`);
    if (ativo !== undefined) sets.push(`ativo = ${ativo ? 'true' : 'false'}`);
    if (produto_id !== undefined) sets.push(`produto_id = ${produto_id ? Number(produto_id) : 'NULL'}`);
    if (preco_promocional !== undefined) sets.push(`preco_promocional = ${preco_promocional !== null && preco_promocional !== "" ? Number(preco_promocional) : 'NULL'}`);
    if (quantidade_disponivel !== undefined) sets.push(`quantidade_disponivel = ${quantidade_disponivel !== null && quantidade_disponivel !== "" ? Number(quantidade_disponivel) : 'NULL'}`);
    if (sets.length === 0) return res.status(400).json({ error: "no_changes" });
    const rows = await db.execute(`UPDATE promocoes_pdv SET ${sets.join(", ")} WHERE id = ${req.params.id} AND empresa_id = ${empresaId} RETURNING *`);
    return res.json(rows.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.delete("/promocoes/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    await db.execute(`DELETE FROM promocoes_pdv WHERE id = ${req.params.id} AND empresa_id = ${empresaId}`);
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── MOTORISTAS CRUD ───────────────────────────────────────────────────────────
router.get("/motoristas", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const rows = await db.execute(`SELECT * FROM motoristas_pdv WHERE empresa_id = ${empresaId} ORDER BY nome`);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.post("/motoristas", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { nome, telefone, veiculo, placa } = req.body;
    const rows = await db.execute(`
      INSERT INTO motoristas_pdv (empresa_id, nome, telefone, veiculo, placa)
      VALUES (${empresaId}, '${String(nome).replace(/'/g,"''")}',
        ${telefone ? `'${String(telefone).replace(/'/g,"''")}'` : 'NULL'},
        ${veiculo ? `'${String(veiculo).replace(/'/g,"''")}'` : 'NULL'},
        ${placa ? `'${String(placa).toUpperCase().replace(/'/g,"''")}'` : 'NULL'})
      RETURNING *
    `);
    return res.status(201).json(rows.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.patch("/motoristas/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { nome, telefone, veiculo, placa, ativo } = req.body;
    const sets: string[] = [];
    if (nome !== undefined) sets.push(`nome = '${String(nome).replace(/'/g,"''")}'`);
    if (telefone !== undefined) sets.push(`telefone = ${telefone ? `'${String(telefone).replace(/'/g,"''")}'` : 'NULL'}`);
    if (veiculo !== undefined) sets.push(`veiculo = ${veiculo ? `'${String(veiculo).replace(/'/g,"''")}'` : 'NULL'}`);
    if (placa !== undefined) sets.push(`placa = ${placa ? `'${String(placa).toUpperCase().replace(/'/g,"''")}'` : 'NULL'}`);
    if (ativo !== undefined) sets.push(`ativo = ${ativo ? 'true' : 'false'}`);
    if (sets.length === 0) return res.status(400).json({ error: "no_changes" });
    const rows = await db.execute(`UPDATE motoristas_pdv SET ${sets.join(", ")} WHERE id = ${req.params.id} AND empresa_id = ${empresaId} RETURNING *`);
    return res.json(rows.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.delete("/motoristas/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    await db.execute(`DELETE FROM motoristas_pdv WHERE id = ${req.params.id} AND empresa_id = ${empresaId}`);
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── Endpoint to save restaurant location + visibility radius ──────────────────
router.put("/config-area", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { lat_loja, lng_loja, raio_visibilidade_km } = req.body;
    const rows = await db.execute(`
      INSERT INTO restaurantes (empresa_id, nome, categoria, lat_loja, lng_loja, raio_visibilidade_km, aberto)
      VALUES (${empresaId}, (SELECT nome FROM empresas WHERE id = ${empresaId}), 'Geral',
        ${lat_loja ?? 'NULL'}, ${lng_loja ?? 'NULL'}, ${Number(raio_visibilidade_km) || 50}, true)
      ON CONFLICT (empresa_id) DO UPDATE SET
        lat_loja = EXCLUDED.lat_loja, lng_loja = EXCLUDED.lng_loja,
        raio_visibilidade_km = EXCLUDED.raio_visibilidade_km
      RETURNING *
    `);
    return res.json(rows.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.get("/config-area", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const rows = await db.execute(`SELECT lat_loja, lng_loja, raio_visibilidade_km FROM restaurantes WHERE empresa_id = ${empresaId}`);
    return res.json(rows.rows[0] ?? null);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/pdv/config-subcategoria ─────────────────────────────────────────
router.get("/config-subcategoria", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const rows = await db.execute(`SELECT subcategoria_id FROM restaurantes WHERE empresa_id = ${empresaId}`);
    return res.json(rows.rows[0] ?? { subcategoria_id: null });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── PUT /api/pdv/config-subcategoria ─────────────────────────────────────────
router.put("/config-subcategoria", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { subcategoria_id } = req.body;
    const sidVal = subcategoria_id ? Number(subcategoria_id) : null;
    await db.execute(`
      INSERT INTO restaurantes (empresa_id, nome, categoria, aberto, subcategoria_id)
      VALUES (${empresaId}, (SELECT nome FROM empresas WHERE id = ${empresaId}), 'food', true, ${sidVal ?? 'NULL'})
      ON CONFLICT (empresa_id) DO UPDATE SET
        subcategoria_id = ${sidVal ?? 'NULL'}
    `);
    return res.json({ subcategoria_id: sidVal });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/pdv/config-entrega ──────────────────────────────────────────────
router.get("/config-entrega", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const rows = await db.execute(`SELECT * FROM config_entrega_pdv WHERE empresa_id = ${empresaId}`);
    return res.json(rows.rows[0] ?? null);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── PUT /api/pdv/config-entrega ───────────────────────────────────────────────
router.put("/config-entrega", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { tipo, taxa_fixa, taxa_por_km, km_minimo, raio_max_km, taxa_minima, endereco_restaurante, lat_restaurante, lng_restaurante, ativo } = req.body;
    const rows = await db.execute(`
      INSERT INTO config_entrega_pdv (empresa_id, tipo, taxa_fixa, taxa_por_km, km_minimo, raio_max_km, taxa_minima, endereco_restaurante, lat_restaurante, lng_restaurante, ativo)
      VALUES (${empresaId}, '${tipo}', ${Number(taxa_fixa)}, ${Number(taxa_por_km)}, ${Number(km_minimo)}, ${Number(raio_max_km)}, ${Number(taxa_minima)},
        ${endereco_restaurante ? `'${String(endereco_restaurante).replace(/'/g,"''")}'` : 'NULL'},
        ${lat_restaurante ?? 'NULL'}, ${lng_restaurante ?? 'NULL'}, ${ativo ? 'true' : 'false'})
      ON CONFLICT (empresa_id) DO UPDATE SET
        tipo = EXCLUDED.tipo, taxa_fixa = EXCLUDED.taxa_fixa, taxa_por_km = EXCLUDED.taxa_por_km,
        km_minimo = EXCLUDED.km_minimo, raio_max_km = EXCLUDED.raio_max_km, taxa_minima = EXCLUDED.taxa_minima,
        endereco_restaurante = EXCLUDED.endereco_restaurante, lat_restaurante = EXCLUDED.lat_restaurante,
        lng_restaurante = EXCLUDED.lng_restaurante, ativo = EXCLUDED.ativo, atualizado_em = NOW()
      RETURNING *
    `);
    return res.json(rows.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── POST /api/pdv/calcular-frete ─────────────────────────────────────────────
router.post("/calcular-frete", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });

    const { endereco_destino } = req.body;
    if (!endereco_destino) return res.status(400).json({ error: "endereco_destino required" });

    const cfgRows = await db.execute(`SELECT * FROM config_entrega_pdv WHERE empresa_id = ${empresaId}`);
    const cfg = cfgRows.rows[0] as any;
    if (!cfg || !cfg.ativo) return res.json({ taxa_entrega: 0, distancia_km: null, mensagem: "Entrega não configurada" });

    // Fixed fee mode
    if (cfg.tipo === "fixa") {
      return res.json({ taxa_entrega: Number(cfg.taxa_fixa), distancia_km: null, tipo: "fixa" });
    }

    // KM mode — use Google Distance Matrix API
    const apiKey = process.env.GOOGLE_MAPS_KEY;
    if (!apiKey || !cfg.endereco_restaurante) {
      return res.json({ taxa_entrega: Number(cfg.taxa_fixa || 0), distancia_km: null, mensagem: "Configuração incompleta — usando taxa fixa" });
    }

    const origin = encodeURIComponent(cfg.endereco_restaurante);
    const destination = encodeURIComponent(endereco_destino);
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&key=${apiKey}&language=pt-BR&units=metric`;

    const response = await fetch(url);
    const data = await response.json() as any;

    if (data.status !== "OK" || data.rows[0]?.elements[0]?.status !== "OK") {
      return res.json({ taxa_entrega: Number(cfg.taxa_minima || cfg.taxa_fixa || 0), distancia_km: null, mensagem: "Não foi possível calcular a distância" });
    }

    const distMeters = data.rows[0].elements[0].distance.value;
    const distKm = distMeters / 1000;
    const duracao = data.rows[0].elements[0].duration.text;

    if (cfg.raio_max_km && distKm > Number(cfg.raio_max_km)) {
      return res.json({ taxa_entrega: null, distancia_km: distKm, duracao, fora_raio: true, mensagem: `Endereço fora do raio de entrega (${Number(cfg.raio_max_km)} km)` });
    }

    const kmCobrado = Math.max(0, distKm - Number(cfg.km_minimo || 0));
    const taxa = Math.max(Number(cfg.taxa_minima || 0), Number(cfg.taxa_por_km) * kmCobrado);

    return res.json({ taxa_entrega: Math.round(taxa * 100) / 100, distancia_km: Math.round(distKm * 10) / 10, duracao, tipo: "km" });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── Timeline: Google Maps Key ─────────────────────────────────────────────
router.get("/maps-key", (req, res) => {
  const empresaId = getEmpresaId(req);
  if (!empresaId) return res.status(401).json({ error: "unauthorized" });
  // GOOGLE_MAPS_WEB_KEY é a chave configurada para uso em browser (HTTP referrer)
  // Fallback para GOOGLE_MAPS_KEY se a web key não estiver definida
  const key = process.env.GOOGLE_MAPS_WEB_KEY || process.env.GOOGLE_MAPS_KEY || "";
  return res.json({ key });
});

// ── Timeline: Config do restaurante (lat/lng) ─────────────────────────────
router.get("/delivery/restaurante-config", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const rows = await db.execute(sql`SELECT lat_restaurante, lng_restaurante, endereco_restaurante FROM config_entrega_pdv WHERE empresa_id = ${empresaId}`);
    return res.json((rows.rows[0] as any) || { lat_restaurante: null, lng_restaurante: null, endereco_restaurante: null });
  } catch { return res.json({ lat_restaurante: null, lng_restaurante: null, endereco_restaurante: null }); }
});

// ── Timeline: GET/PUT config (Ativo/Inativo) ──────────────────────────────
router.get("/delivery/timeline-config", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const row = await db.execute(`SELECT timeline_ativo FROM config_entrega_pdv WHERE empresa_id = ${empresaId} LIMIT 1`);
    const timelineAtivo = (row.rows[0] as any)?.timeline_ativo ?? true;
    return res.json({ timelineAtivo });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.put("/delivery/timeline-config", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { timelineAtivo } = req.body;
    await db.execute(`
      INSERT INTO config_entrega_pdv (empresa_id, timeline_ativo)
      VALUES (${empresaId}, ${!!timelineAtivo})
      ON CONFLICT (empresa_id) DO UPDATE SET timeline_ativo = EXCLUDED.timeline_ativo, atualizado_em = NOW()
    `);
    return res.json({ ok: true, timelineAtivo: !!timelineAtivo });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── Notify a boy that a delivery was assigned to him ──────────────────────
async function notifyBoyOfDelivery(boyId: number, pedidoId: number, empresaId: number) {
  try {
    // Tenant-safe: pedido must belong to the same empresa, otherwise no row returned.
    const r = await db.execute(`
      SELECT m.fcm_token, p.cliente_nome, p.cliente_endereco, p.total, e.nome AS empresa_nome
      FROM pedidos_pdv p
      JOIN empresas e ON e.id = p.empresa_id
      JOIN motoristas_app m ON m.id = ${boyId}
      WHERE p.id = ${pedidoId} AND p.empresa_id = ${empresaId}
      LIMIT 1
    `);
    const row = r.rows[0] as any;
    if (!row) {
      console.log(`[notify-boy] pedido ${pedidoId} não pertence à empresa ${empresaId} ou boy ${boyId} inexistente`);
      return;
    }
    if (!row.fcm_token) {
      console.log(`[notify-boy] boy ${boyId} sem fcm_token — push não enviado`);
      return;
    }
    const valor = row.total ? `R$ ${Number(row.total).toFixed(2).replace(".", ",")}` : "";
    const cliente = row.cliente_nome || "Cliente";
    const empresa = row.empresa_nome || "Restaurante";
    const title = "🛵 Nova entrega!";
    const body = `${empresa} → ${cliente}${valor ? ` • ${valor}` : ""}`;
    await sendFcmNotification(row.fcm_token, title, body, {
      type: "nova_entrega_pdv",
      pedido_id: String(pedidoId),
      empresa_id: String(empresaId),
    });
  } catch (e) {
    console.error("[notify-boy]", e);
  }
}

// ── Auto-dispatch helper: broadcast a TODOS os motoboys próximos (race-to-accept) ─
// Quando o Timeline está inativo e o pedido fica "pronto", a corrida é
// disparada para todos os motoboys aprovados, online, dentro do raio
// configurado. O primeiro que aceitar (POST /motorista-app/entrega/:id/aceitar)
// vence — os outros recebem 409 e a entregas_solicitadas vira 'cancelada'.
async function autoDispatchBoy(empresaId: number, pedidoId: number) {
  try {
    const cfgRow = await db.execute(`
      SELECT lat_restaurante, lng_restaurante, timeline_ativo,
             COALESCE(raio_motoboy_km, 5)::float AS raio_km
      FROM config_entrega_pdv WHERE empresa_id = ${empresaId} LIMIT 1
    `);
    const cfg = cfgRow.rows[0] as any;
    if (!cfg || cfg.timeline_ativo !== false) return; // only auto-dispatch when inactive
    const lat = Number(cfg.lat_restaurante ?? 0);
    const lng = Number(cfg.lng_restaurante ?? 0);
    const raioKm = Number(cfg.raio_km ?? 5);
    const hasCoords = !!lat && !!lng;

    // Tenant-isolated: pedido must belong to this empresa AND not yet have a boy assigned.
    const pedRes = await db.execute(`
      SELECT p.id, p.cliente_nome, p.cliente_endereco, p.total, p.taxa_entrega,
             p.observacoes, e.nome AS empresa_nome, e.telefone AS empresa_telefone,
             cep.endereco_restaurante
      FROM pedidos_pdv p
      JOIN empresas e ON e.id = p.empresa_id
      LEFT JOIN config_entrega_pdv cep ON cep.empresa_id = p.empresa_id
      WHERE p.id = ${pedidoId} AND p.empresa_id = ${empresaId}
        AND p.boy_id IS NULL AND p.status NOT IN ('entregue','cancelado')
      LIMIT 1
    `);
    const pedido = pedRes.rows[0] as any;
    if (!pedido) {
      console.log(`[auto-dispatch] pedido ${pedidoId} já tem boy ou não existe`);
      return;
    }

    // Find ALL nearby boys (broadcast). Filtro: aprovado, online, ping < 5min,
    // capacidade (< 3 entregas ativas), e — se temos coords — dentro do raio.
    const distSelect = hasCoords
      ? `(6371 * acos(cos(radians(${lat})) * cos(radians(CAST(m.lat AS float))) *
         cos(radians(CAST(m.lng AS float)) - radians(${lng})) +
         sin(radians(${lat})) * sin(radians(CAST(m.lat AS float))))) AS dist_km`
      : `0::float AS dist_km`;
    const distFilter = hasCoords
      ? `AND m.lat IS NOT NULL AND m.lng IS NOT NULL
         AND (6371 * acos(cos(radians(${lat})) * cos(radians(CAST(m.lat AS float))) *
              cos(radians(CAST(m.lng AS float)) - radians(${lng})) +
              sin(radians(${lat})) * sin(radians(CAST(m.lat AS float))))) <= ${raioKm}`
      : ``;
    const boysRes = await db.execute(`
      SELECT m.id, m.nome, m.fcm_token, ${distSelect}
      FROM motoristas_app m
      WHERE m.status = 'aprovado'
        AND m.tipo_profissional IN ('entregador','delivery','motorista')
        AND m.online = true
        AND m.ultimo_ping > NOW() - INTERVAL '5 minutes'
        ${distFilter}
        AND (SELECT COUNT(*) FROM pedidos_pdv WHERE boy_id = m.id AND status NOT IN ('entregue','cancelado')) < 3
      ORDER BY dist_km ASC
      LIMIT 50
    `);
    const boys = boysRes.rows as any[];
    if (!boys.length) {
      console.log(`[auto-dispatch] pedido ${pedidoId} — nenhum boy disponível (raio ${raioKm}km, hasCoords=${hasCoords})`);
      return;
    }

    // Cancela qualquer broadcast anterior do mesmo pedido (re-tentativa segura).
    await db.execute(`
      UPDATE entregas_solicitadas SET status = 'cancelada'
      WHERE pedido_pdv_id = ${pedidoId} AND status = 'aguardando'
    `);

    // Inserir uma "solicitação de entrega" por motoboy (60s para aceitar).
    const taxa = Number(pedido.taxa_entrega ?? 0);
    const total = Number(pedido.total ?? 0);
    const valorEstimado = taxa > 0 ? taxa : Math.max(5, Number((total * 0.1).toFixed(2)));
    const cliente = String(pedido.cliente_nome || "Cliente").replace(/'/g, "''");
    const empresaNome = String(pedido.empresa_nome || "Restaurante").replace(/'/g, "''");
    const restEnd = String(pedido.endereco_restaurante || "").replace(/'/g, "''");
    const cliEnd = String(pedido.cliente_endereco || "").replace(/'/g, "''");
    const descricao = String(`Pedido #${pedidoId} • ${empresaNome}` + (pedido.observacoes ? ` — ${pedido.observacoes}` : "")).replace(/'/g, "''");

    let pushed = 0;
    for (const b of boys) {
      const distKm = Number(b.dist_km ?? 0);
      try {
        await db.execute(`
          INSERT INTO entregas_solicitadas
            (profissional_id, pedido_pdv_id, empresa_id, tipo_servico, categoria_nome, valor_estimado,
             coleta_endereco, entrega_endereco,
             distancia_profissional_km, tempo_profissional_min,
             distancia_entrega_km, tempo_entrega_min,
             cliente_nome, cliente_rating, cliente_avaliacoes, descricao_item,
             status, expira_em)
          VALUES (
            ${Number(b.id)}, ${pedidoId}, ${empresaId}, 'delivery',
            'Delivery — ${empresaNome.slice(0, 80)}', ${valorEstimado},
            '${restEnd.slice(0, 500)}', '${cliEnd.slice(0, 500)}',
            ${distKm.toFixed(2)}, ${Math.max(1, Math.round(distKm * 3))},
            0, 0,
            '${cliente.slice(0, 140)}', 5.0, 0, '${descricao.slice(0, 500)}',
            'aguardando', NOW() + INTERVAL '60 seconds'
          )
        `);
        if (b.fcm_token) {
          const valorFmt = `R$ ${valorEstimado.toFixed(2).replace(".", ",")}`;
          await sendFcmNotification(
            String(b.fcm_token),
            "🛵 Nova entrega disponível!",
            `${empresaNome} → ${cliente}${distKm > 0 ? ` • ${distKm.toFixed(1)}km` : ""} • ${valorFmt}`,
            { type: "nova_entrega_pdv", pedido_id: String(pedidoId), empresa_id: String(empresaId) }
          ).catch(() => {});
        }
        pushed++;
      } catch (e) {
        console.error(`[auto-dispatch] insert/push boy ${b.id} falhou:`, e);
      }
    }

    broadcastToEmpresa(empresaId, { event: "auto_despacho_broadcast", pedidoId, motoboysChamados: pushed });
    console.log(`[auto-dispatch] pedido ${pedidoId} → broadcast a ${pushed} motoboys (raio ${raioKm}km)`);
  } catch (e) {
    console.error("[auto-dispatch]", e);
  }
}

// ── Timeline: Boys delivery disponíveis ──────────────────────────────────
router.get("/delivery/boys", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const rows = await db.execute(sql`
      SELECT id, nome, telefone, tipo_profissional, tipo_veiculo, veiculo_modelo, lat, lng, ultimo_ping, online
      FROM motoristas_app
      WHERE status = 'aprovado'
        AND tipo_profissional IN ('entregador','delivery','motorista')
        AND online = true
        AND ultimo_ping > NOW() - INTERVAL '5 minutes'
        AND lat IS NOT NULL AND lng IS NOT NULL
      ORDER BY ultimo_ping DESC
    `);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── Timeline: Pedidos prontos para delivery ───────────────────────────────
router.get("/delivery/pedidos-prontos", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    await db.execute(sql`ALTER TABLE pedidos_pdv ADD COLUMN IF NOT EXISTS boy_id INTEGER`);
    const rows = await db.execute(sql`
      SELECT p.id, p.cliente_nome, p.cliente_whatsapp, p.cliente_endereco,
             p.total, p.taxa_entrega, p.status, p.criado_em, p.observacoes, p.boy_id,
             COALESCE(json_agg(json_build_object('nome', i.produto_nome, 'qtd', i.quantidade)) FILTER (WHERE i.id IS NOT NULL), '[]') AS itens
      FROM pedidos_pdv p
      LEFT JOIN itens_pedido_pdv i ON i.pedido_id = p.id
      WHERE p.empresa_id = ${empresaId} AND p.tipo = 'delivery' AND p.status IN ('novo','preparando','pronto')
      GROUP BY p.id ORDER BY p.criado_em DESC LIMIT 50
    `);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── Timeline: Atribuir boy ao pedido ──────────────────────────────────────
router.post("/delivery/atribuir", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { pedidoId, boyId } = req.body;
    if (!pedidoId || !boyId) return res.status(400).json({ error: "bad_request" });
    await db.execute(sql`ALTER TABLE pedidos_pdv ADD COLUMN IF NOT EXISTS boy_id INTEGER`);
    const countRes = await db.execute(sql`SELECT COUNT(*) AS cnt FROM pedidos_pdv WHERE boy_id = ${Number(boyId)} AND status NOT IN ('entregue','cancelado')`);
    if (Number((countRes.rows[0] as any).cnt) >= 3) return res.status(409).json({ error: "max_deliveries", message: "Boy já tem 3 entregas atribuídas" });
    await db.execute(sql`UPDATE pedidos_pdv SET boy_id = ${Number(boyId)} WHERE id = ${Number(pedidoId)} AND empresa_id = ${empresaId}`);
    notifyBoyOfDelivery(Number(boyId), Number(pedidoId), empresaId).catch(() => {});
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── Timeline: Remover boy do pedido ───────────────────────────────────────
router.post("/delivery/desatribuir", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { pedidoId } = req.body;
    if (!pedidoId) return res.status(400).json({ error: "bad_request" });
    await db.execute(sql`UPDATE pedidos_pdv SET boy_id = NULL WHERE id = ${Number(pedidoId)} AND empresa_id = ${empresaId}`);
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── Ensure config_pagamento_pdv table ─────────────────────────────────────
async function ensureConfigPagamento() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS config_pagamento_pdv (
      empresa_id INTEGER PRIMARY KEY,
      metodos TEXT[] NOT NULL DEFAULT '{}',
      atualizado_em TIMESTAMP DEFAULT NOW()
    )
  `);
}

// ── GET /api/pdv/config-pagamento ─────────────────────────────────────────
router.get("/config-pagamento", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    await ensureConfigPagamento();
    const rows = await db.execute(`SELECT metodos FROM config_pagamento_pdv WHERE empresa_id = ${empresaId}`);
    const row = rows.rows[0] as any;
    return res.json({ metodos: row?.metodos ?? ["pix", "dinheiro", "credito", "debito"] });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── PUT /api/pdv/config-pagamento ─────────────────────────────────────────
router.put("/config-pagamento", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { metodos } = req.body;
    if (!Array.isArray(metodos)) return res.status(400).json({ error: "metodos must be an array" });
    await ensureConfigPagamento();
    const ALLOWED = ["pix", "dinheiro", "credito", "debito", "vr", "sodexo"];
    const safe = (metodos as string[]).filter(m => ALLOWED.includes(m));
    const arrayLiteral = safe.length > 0
      ? `ARRAY[${safe.map(m => `'${m}'`).join(",")}]`
      : `ARRAY[]::text[]`;
    const rows = await db.execute(`
      INSERT INTO config_pagamento_pdv (empresa_id, metodos)
      VALUES (${empresaId}, ${arrayLiteral})
      ON CONFLICT (empresa_id) DO UPDATE SET metodos = EXCLUDED.metodos, atualizado_em = NOW()
      RETURNING metodos
    `);
    return res.json(rows.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// MÓDULO TUR VIAGENS
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /api/pdv/dashboard-stats ─────────────────────────────────────────────
router.get("/dashboard-stats", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const r = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN DATE(criado_em) = CURRENT_DATE AND status <> 'cancelado' THEN total ELSE 0 END), 0) AS vendas_hoje,
        COALESCE(SUM(CASE WHEN DATE(criado_em) = CURRENT_DATE - INTERVAL '1 day' AND status <> 'cancelado' THEN total ELSE 0 END), 0) AS vendas_ontem,
        COUNT(*) FILTER (WHERE DATE(criado_em) = CURRENT_DATE AND status <> 'cancelado') AS pedidos_hoje,
        COUNT(*) FILTER (WHERE DATE(criado_em) = CURRENT_DATE - INTERVAL '1 day' AND status <> 'cancelado') AS pedidos_ontem,
        COUNT(*) FILTER (WHERE status NOT IN ('entregue','cancelado')) AS em_aberto
      FROM pedidos_pdv WHERE empresa_id = ${empresaId}
    `);
    const row = r.rows[0] as any;
    const vendasHoje = Number(row.vendas_hoje) || 0;
    const pedidosHoje = Number(row.pedidos_hoje) || 0;
    return res.json({
      vendas_hoje: vendasHoje,
      vendas_ontem: Number(row.vendas_ontem) || 0,
      pedidos_hoje: pedidosHoje,
      pedidos_ontem: Number(row.pedidos_ontem) || 0,
      ticket_medio: pedidosHoje > 0 ? vendasHoje / pedidosHoje : 0,
      em_aberto: Number(row.em_aberto) || 0,
    });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/pdv/viagens/dashboard ────────────────────────────────────────────
router.get("/viagens/dashboard", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const today = new Date().toISOString().split("T")[0];
    const [vendas, faturamento, clientes, pendentes, recentes] = await Promise.all([
      db.execute(`SELECT COUNT(*) FROM viagens_passagens WHERE empresa_id=${empresaId} AND DATE(vendido_em)='${today}'`),
      db.execute(`SELECT COALESCE(SUM(valor),0) as total FROM viagens_passagens WHERE empresa_id=${empresaId} AND DATE(vendido_em)='${today}' AND status!='cancelado'`),
      db.execute(`SELECT COUNT(DISTINCT cliente_id) FROM viagens_passagens WHERE empresa_id=${empresaId} AND DATE(vendido_em)='${today}'`),
      db.execute(`SELECT COUNT(*) FROM viagens_passagens WHERE empresa_id=${empresaId} AND status='pendente'`),
      db.execute(`
        SELECT p.id, c.nome as cliente_nome, r.destino, p.valor, h.hora_partida, p.status, p.vendido_em
        FROM viagens_passagens p
        LEFT JOIN viagens_clientes c ON c.id=p.cliente_id
        LEFT JOIN viagens_horarios h ON h.id=p.horario_id
        LEFT JOIN viagens_rotas r ON r.id=h.rota_id
        WHERE p.empresa_id=${empresaId}
        ORDER BY p.vendido_em DESC LIMIT 8
      `),
    ]);
    return res.json({
      vendas_hoje: Number((vendas.rows[0] as any).count),
      faturamento_hoje: Number((faturamento.rows[0] as any).total),
      clientes_hoje: Number((clientes.rows[0] as any).count),
      pendentes: Number((pendentes.rows[0] as any).count),
      recentes: recentes.rows,
    });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/pdv/viagens/rotas ─────────────────────────────────────────────────
router.get("/viagens/rotas", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const rows = await db.execute(`SELECT * FROM viagens_rotas WHERE empresa_id=${empresaId} ORDER BY destino`);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── POST /api/pdv/viagens/rotas ───────────────────────────────────────────────
router.post("/viagens/rotas", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { origem, destino, duracao_minutos, tipo = "onibus" } = req.body;
    if (!origem || !destino) return res.status(400).json({ error: "origem e destino obrigatórios" });
    const rows = await db.execute(`
      INSERT INTO viagens_rotas (empresa_id,origem,destino,duracao_minutos,tipo)
      VALUES (${empresaId},'${String(origem).replace(/'/g,"''")}','${String(destino).replace(/'/g,"''")}',${duracao_minutos?Number(duracao_minutos):"NULL"},'${tipo}')
      RETURNING *
    `);
    return res.status(201).json(rows.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── PUT /api/pdv/viagens/rotas/:id ────────────────────────────────────────────
router.put("/viagens/rotas/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { origem, destino, duracao_minutos, tipo, ativo } = req.body;
    const sets: string[] = [];
    if (origem !== undefined) sets.push(`origem='${String(origem).replace(/'/g,"''")}'`);
    if (destino !== undefined) sets.push(`destino='${String(destino).replace(/'/g,"''")}'`);
    if (duracao_minutos !== undefined) sets.push(`duracao_minutos=${duracao_minutos?Number(duracao_minutos):"NULL"}`);
    if (tipo !== undefined) sets.push(`tipo='${tipo}'`);
    if (ativo !== undefined) sets.push(`ativo=${Boolean(ativo)}`);
    if (!sets.length) return res.status(400).json({ error: "nothing to update" });
    const rows = await db.execute(`UPDATE viagens_rotas SET ${sets.join(",")} WHERE id=${Number(req.params.id)} AND empresa_id=${empresaId} RETURNING *`);
    return res.json(rows.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── DELETE /api/pdv/viagens/rotas/:id ─────────────────────────────────────────
router.delete("/viagens/rotas/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    await db.execute(`DELETE FROM viagens_rotas WHERE id=${Number(req.params.id)} AND empresa_id=${empresaId}`);
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/pdv/viagens/horarios ─────────────────────────────────────────────
router.get("/viagens/horarios", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { rota_id, data } = req.query as any;
    let where = `h.empresa_id=${empresaId}`;
    if (rota_id) where += ` AND h.rota_id=${Number(rota_id)}`;
    if (data) where += ` AND h.data_partida='${data}'`;
    const rows = await db.execute(`
      SELECT h.*, r.origem, r.destino, r.tipo, r.duracao_minutos,
             (h.vagas_total - h.vagas_ocupadas) AS vagas_livres
      FROM viagens_horarios h
      JOIN viagens_rotas r ON r.id=h.rota_id
      WHERE ${where} AND h.ativo=true
      ORDER BY h.data_partida, h.hora_partida
    `);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── POST /api/pdv/viagens/horarios ────────────────────────────────────────────
router.post("/viagens/horarios", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { rota_id, data_partida, hora_partida, hora_chegada, vagas_total=40, preco, veiculo } = req.body;
    if (!rota_id || !data_partida || !hora_partida || !preco) return res.status(400).json({ error: "campos obrigatórios" });
    const chegada = hora_chegada ? `'${hora_chegada}'` : "NULL";
    const veic = veiculo ? `'${String(veiculo).replace(/'/g,"''")}'` : "NULL";
    const rows = await db.execute(`
      INSERT INTO viagens_horarios (rota_id,empresa_id,data_partida,hora_partida,hora_chegada,vagas_total,preco,veiculo)
      VALUES (${Number(rota_id)},${empresaId},'${data_partida}','${hora_partida}',${chegada},${Number(vagas_total)},${Number(preco)},${veic})
      RETURNING *
    `);
    return res.status(201).json(rows.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── PUT /api/pdv/viagens/horarios/:id ─────────────────────────────────────────
router.put("/viagens/horarios/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { ativo, preco, vagas_total, veiculo } = req.body;
    const sets: string[] = [];
    if (ativo !== undefined) sets.push(`ativo=${Boolean(ativo)}`);
    if (preco !== undefined) sets.push(`preco=${Number(preco)}`);
    if (vagas_total !== undefined) sets.push(`vagas_total=${Number(vagas_total)}`);
    if (veiculo !== undefined) sets.push(`veiculo='${String(veiculo).replace(/'/g,"''")}'`);
    if (!sets.length) return res.status(400).json({ error: "nothing" });
    const rows = await db.execute(`UPDATE viagens_horarios SET ${sets.join(",")} WHERE id=${Number(req.params.id)} AND empresa_id=${empresaId} RETURNING *`);
    return res.json(rows.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/pdv/viagens/clientes ─────────────────────────────────────────────
router.get("/viagens/clientes", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { q } = req.query as any;
    let where = `empresa_id=${empresaId}`;
    if (q) where += ` AND (nome ILIKE '%${String(q).replace(/'/g,"''")}%' OR cpf ILIKE '%${String(q).replace(/'/g,"''")}%' OR telefone ILIKE '%${String(q).replace(/'/g,"''")}%')`;
    const rows = await db.execute(`SELECT * FROM viagens_clientes WHERE ${where} ORDER BY nome LIMIT 50`);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── POST /api/pdv/viagens/clientes ────────────────────────────────────────────
router.post("/viagens/clientes", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { nome, cpf, telefone, email, data_nascimento } = req.body;
    if (!nome) return res.status(400).json({ error: "nome obrigatório" });
    const cpfVal = cpf ? `'${String(cpf).replace(/'/g,"''")}'` : "NULL";
    const telVal = telefone ? `'${String(telefone).replace(/'/g,"''")}'` : "NULL";
    const emailVal = email ? `'${String(email).replace(/'/g,"''")}'` : "NULL";
    const nascVal = data_nascimento ? `'${data_nascimento}'` : "NULL";
    const rows = await db.execute(`
      INSERT INTO viagens_clientes (empresa_id,nome,cpf,telefone,email,data_nascimento)
      VALUES (${empresaId},'${String(nome).replace(/'/g,"''")}',${cpfVal},${telVal},${emailVal},${nascVal})
      RETURNING *
    `);
    return res.status(201).json(rows.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── PUT /api/pdv/viagens/clientes/:id ─────────────────────────────────────────
router.put("/viagens/clientes/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { nome, cpf, telefone, email, data_nascimento } = req.body;
    const sets: string[] = [];
    if (nome) sets.push(`nome='${String(nome).replace(/'/g,"''")}'`);
    if (cpf !== undefined) sets.push(`cpf=${cpf?`'${String(cpf).replace(/'/g,"''")}'`:"NULL"}`);
    if (telefone !== undefined) sets.push(`telefone=${telefone?`'${String(telefone).replace(/'/g,"''")}'`:"NULL"}`);
    if (email !== undefined) sets.push(`email=${email?`'${String(email).replace(/'/g,"''")}'`:"NULL"}`);
    if (data_nascimento !== undefined) sets.push(`data_nascimento=${data_nascimento?`'${data_nascimento}'`:"NULL"}`);
    if (!sets.length) return res.status(400).json({ error: "nothing" });
    const rows = await db.execute(`UPDATE viagens_clientes SET ${sets.join(",")} WHERE id=${Number(req.params.id)} AND empresa_id=${empresaId} RETURNING *`);
    return res.json(rows.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── DELETE /api/pdv/viagens/clientes/:id ──────────────────────────────────────
router.delete("/viagens/clientes/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    await db.execute(`DELETE FROM viagens_clientes WHERE id=${Number(req.params.id)} AND empresa_id=${empresaId}`);
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/pdv/viagens/passagens ────────────────────────────────────────────
router.get("/viagens/passagens", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { status, q, data } = req.query as any;
    let where = `p.empresa_id=${empresaId}`;
    if (status && status !== "todos") where += ` AND p.status='${status}'`;
    if (data) where += ` AND DATE(p.vendido_em)='${data}'`;
    if (q) where += ` AND c.nome ILIKE '%${String(q).replace(/'/g,"''")}%'`;
    const rows = await db.execute(`
      SELECT p.*, c.nome as cliente_nome, c.cpf as cliente_cpf, c.telefone as cliente_telefone,
             r.origem, r.destino, r.tipo,
             h.hora_partida, h.hora_chegada, h.data_partida, h.preco as preco_horario
      FROM viagens_passagens p
      LEFT JOIN viagens_clientes c ON c.id=p.cliente_id
      LEFT JOIN viagens_horarios h ON h.id=p.horario_id
      LEFT JOIN viagens_rotas r ON r.id=h.rota_id
      WHERE ${where}
      ORDER BY p.vendido_em DESC
      LIMIT 100
    `);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── POST /api/pdv/viagens/passagens ───────────────────────────────────────────
router.post("/viagens/passagens", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { cliente_id, horario_id, assento, valor, forma_pagamento="pix", status="confirmado", observacoes, operador_nome } = req.body;
    if (!horario_id || !valor) return res.status(400).json({ error: "horario_id e valor obrigatórios" });
    // Whitelist enums para evitar SQL injection
    const STATUS_OK = new Set(["confirmado","pendente","cancelado"]);
    const FP_OK = new Set(["pix","dinheiro","credito","debito","cartao"]);
    const statusSafe = STATUS_OK.has(String(status)) ? String(status) : "confirmado";
    const fpSafe = FP_OK.has(String(forma_pagamento)) ? String(forma_pagamento) : "pix";
    const assentoVal = assento ? `'${String(assento).replace(/'/g,"''")}'` : "NULL";
    const clienteVal = cliente_id ? Number(cliente_id) : "NULL";
    const obsVal = observacoes ? `'${String(observacoes).replace(/'/g,"''")}'` : "NULL";
    const opVal = operador_nome ? `'${String(operador_nome).replace(/'/g,"''")}'` : "NULL";
    const rows = await db.execute(`
      INSERT INTO viagens_passagens (empresa_id,cliente_id,horario_id,assento,valor,forma_pagamento,status,observacoes,operador_nome)
      VALUES (${empresaId},${clienteVal},${Number(horario_id)},${assentoVal},${Number(valor)},'${fpSafe}','${statusSafe}',${obsVal},${opVal})
      RETURNING *
    `);
    if (horario_id) await db.execute(`UPDATE viagens_horarios SET vagas_ocupadas=vagas_ocupadas+1 WHERE id=${Number(horario_id)}`);
    // Recalcula repasse da semana com a nova passagem (Tur Viagens)
    if (statusSafe === "confirmado") {
      try {
        const cfgRows = await db.execute(`SELECT taxa_repasse FROM configuracoes_plataforma LIMIT 1`);
        const taxa = Number((cfgRows.rows[0] as any)?.taxa_repasse ?? 3);
        const now = new Date();
        const dayOfWeek = now.getDay();
        const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(now); monday.setDate(now.getDate() + diffToMon); monday.setHours(0,0,0,0);
        const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
        const semanaInicio = monday.toISOString().slice(0,10);
        const semanaFim = sunday.toISOString().slice(0,10);
        await upsertRepasseEmpresa(empresaId, semanaInicio, semanaFim, taxa);
      } catch (e) { console.error("[passagens pdv] repasse erro:", e); }
    }
    return res.status(201).json(rows.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── PUT /api/pdv/viagens/passagens/:id ────────────────────────────────────────
router.put("/viagens/passagens/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { status, observacoes } = req.body;
    // Whitelist status para evitar SQL injection
    const STATUS_OK = new Set(["confirmado","pendente","cancelado"]);
    const statusSafe = status && STATUS_OK.has(String(status)) ? String(status) : null;
    const sets: string[] = [];
    if (statusSafe) sets.push(`status='${statusSafe}'`);
    if (observacoes !== undefined) sets.push(`observacoes=${observacoes?`'${String(observacoes).replace(/'/g,"''")}'`:"NULL"}`);
    if (!sets.length) return res.status(400).json({ error: "nothing" });
    const [old] = (await db.execute(`SELECT status, horario_id FROM viagens_passagens WHERE id=${Number(req.params.id)} AND empresa_id=${empresaId}`)).rows as any[];
    const rows = await db.execute(`UPDATE viagens_passagens SET ${sets.join(",")} WHERE id=${Number(req.params.id)} AND empresa_id=${empresaId} RETURNING *`);
    // Ajusta vagas se cancelar
    if (statusSafe === "cancelado" && old?.status !== "cancelado" && old?.horario_id) {
      await db.execute(`UPDATE viagens_horarios SET vagas_ocupadas=GREATEST(vagas_ocupadas-1,0) WHERE id=${old.horario_id}`);
    }
    // Recalcula repasse semanal se o status mudou (cancelar tira da receita; confirmar adiciona)
    if (statusSafe && statusSafe !== old?.status) {
      try {
        const cfgRows = await db.execute(`SELECT taxa_repasse FROM configuracoes_plataforma LIMIT 1`);
        const taxa = Number((cfgRows.rows[0] as any)?.taxa_repasse ?? 3);
        const now = new Date();
        const dayOfWeek = now.getDay();
        const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(now); monday.setDate(now.getDate() + diffToMon); monday.setHours(0,0,0,0);
        const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
        await upsertRepasseEmpresa(empresaId, monday.toISOString().slice(0,10), sunday.toISOString().slice(0,10), taxa);
      } catch (e) { console.error("[passagens pdv PUT] repasse erro:", e); }
    }
    return res.json(rows.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/pdv/ecommerce/config ─────────────────────────────────────────────
router.get("/ecommerce/config", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const rows = await db.execute(`SELECT * FROM config_ecommerce_pdv WHERE empresa_id = ${empresaId}`);
    if (rows.rows.length === 0) {
      return res.json({ venda_local_ativo: true, raio_km: 15, venda_nacional_ativo: false, jadlog_contrato: null });
    }
    return res.json(rows.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── PUT /api/pdv/ecommerce/config ─────────────────────────────────────────────
router.put("/ecommerce/config", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { venda_local_ativo, raio_km, venda_nacional_ativo, jadlog_contrato, jadlog_senha } = req.body;

    const localAtivo   = venda_local_ativo   !== undefined ? Boolean(venda_local_ativo)   : true;
    const raio         = raio_km             !== undefined ? Math.min(Math.max(Number(raio_km), 1), 100) : 15;
    const nacionalAtivo = venda_nacional_ativo !== undefined ? Boolean(venda_nacional_ativo) : false;
    const contrato     = jadlog_contrato ? `'${String(jadlog_contrato).replace(/'/g,"''")}'` : "NULL";
    const senha        = jadlog_senha    ? `'${String(jadlog_senha).replace(/'/g,"''")}'`    : "NULL";

    const rows = await db.execute(`
      INSERT INTO config_ecommerce_pdv (empresa_id, venda_local_ativo, raio_km, venda_nacional_ativo, jadlog_contrato, jadlog_senha)
      VALUES (${empresaId}, ${localAtivo}, ${raio}, ${nacionalAtivo}, ${contrato}, ${senha})
      ON CONFLICT (empresa_id) DO UPDATE SET
        venda_local_ativo    = EXCLUDED.venda_local_ativo,
        raio_km              = EXCLUDED.raio_km,
        venda_nacional_ativo = EXCLUDED.venda_nacional_ativo,
        jadlog_contrato      = EXCLUDED.jadlog_contrato,
        jadlog_senha         = EXCLUDED.jadlog_senha
      RETURNING *
    `);
    return res.json(rows.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/pdv/config-pix ───────────────────────────────────────────────
// Returns the empresa's PIX key for direct payment by customers
router.get("/config-pix", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const rows = await db.execute(`SELECT chave_pix, tipo_chave_pix FROM empresas WHERE id = ${empresaId} LIMIT 1`);
    const emp = rows.rows[0] as any ?? {};
    return res.json({ chave_pix: emp.chave_pix ?? "", tipo_chave_pix: emp.tipo_chave_pix ?? "aleatoria" });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── PUT /api/pdv/config-pix ───────────────────────────────────────────────
router.put("/config-pix", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { chave_pix, tipo_chave_pix } = req.body;
    const ALLOWED_TIPOS = ["cpf", "cnpj", "email", "telefone", "aleatoria"];
    const tipo = ALLOWED_TIPOS.includes(tipo_chave_pix) ? tipo_chave_pix : "aleatoria";
    const chave = String(chave_pix ?? "").replace(/'/g, "''");
    await db.execute(`
      UPDATE empresas SET chave_pix = '${chave}', tipo_chave_pix = '${tipo}' WHERE id = ${empresaId}
    `);
    return res.json({ ok: true, chave_pix: chave, tipo_chave_pix: tipo });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/pdv/perfil ───────────────────────────────────────────────────────
router.get("/perfil", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const [emp, rest] = await Promise.all([
      db.execute(`SELECT nome, telefone, cnpj, logo FROM empresas WHERE id = ${empresaId} LIMIT 1`),
      db.execute(`SELECT nome, categoria, descricao FROM restaurantes WHERE empresa_id = ${empresaId} LIMIT 1`),
    ]);
    const e = (emp.rows[0] as any) ?? {};
    const r = (rest.rows[0] as any) ?? {};
    return res.json({
      nome: r.nome ?? e.nome ?? "",
      categoria: r.categoria ?? "",
      descricao: r.descricao ?? "",
      telefone: e.telefone ?? "",
      cnpj: e.cnpj ?? "",
      logo: e.logo ?? "",
    });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── PUT /api/pdv/perfil ───────────────────────────────────────────────────────
router.put("/perfil", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { nome, categoria, descricao, telefone, cnpj, logo } = req.body;
    const safe = (v: unknown) => String(v ?? "").replace(/'/g, "''");

    const logoSet = logo !== undefined ? `, logo = ${logo ? `'${safe(logo)}'` : "NULL"}` : "";
    await db.execute(`UPDATE empresas SET nome = '${safe(nome)}', telefone = '${safe(telefone)}', cnpj = '${safe(cnpj)}'${logoSet} WHERE id = ${empresaId}`);

    const existing = await db.execute(`SELECT id FROM restaurantes WHERE empresa_id = ${empresaId} LIMIT 1`);
    if ((existing.rows as any[]).length > 0) {
      await db.execute(`UPDATE restaurantes SET nome = '${safe(nome)}', categoria = '${safe(categoria)}', descricao = '${safe(descricao)}' WHERE empresa_id = ${empresaId}`);
    } else {
      await db.execute(`INSERT INTO restaurantes (empresa_id, nome, categoria, descricao, aberto) VALUES (${empresaId}, '${safe(nome)}', '${safe(categoria)}', '${safe(descricao)}', true)`);
    }

    return res.json({ ok: true, nome: safe(nome), categoria: safe(categoria), descricao: safe(descricao), telefone: safe(telefone), cnpj: safe(cnpj), logo: logo ?? "" });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── POST /api/pdv/perfil/imagem ──────────────────────────────────────────────
// Upload da foto/logo da empresa (exibida nos cards do app mobile)
const empresaImagesDir = path.resolve(process.cwd(), "public", "uploads", "empresas");
fs.mkdirSync(empresaImagesDir, { recursive: true });
const empresaImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, empresaImagesDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".jpg";
      cb(null, `empresa_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    cb(null, allowed.includes(file.mimetype));
  },
});
router.post("/perfil/imagem", empresaImageUpload.single("imagem"), async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: "no_file", message: "Nenhum ficheiro enviado" });
    const imageUrl = `/uploads/empresas/${file.filename}`;
    await db.execute(`UPDATE empresas SET logo = '${imageUrl}' WHERE id = ${empresaId}`);
    return res.json({ logo: imageUrl });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── DELETE /api/pdv/perfil/imagem ────────────────────────────────────────────
router.delete("/perfil/imagem", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    await db.execute(`UPDATE empresas SET logo = NULL WHERE id = ${empresaId}`);
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ════════════════════════════════════════════════════════════════════════════
// CARONAS — BlaBlaCar-like ride sharing
// ════════════════════════════════════════════════════════════════════════════

const safe = (v: unknown) => String(v ?? "").replace(/'/g, "''");
const num  = (v: unknown, d = 0) => isNaN(Number(v)) ? d : Number(v);

// ── Veículos ─────────────────────────────────────────────────────────────────
router.get("/viagens/veiculos", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const rows = await db.execute(`SELECT * FROM carona_veiculos WHERE empresa_id=${empresaId} AND ativo=true ORDER BY modelo`);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.post("/viagens/veiculos", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { modelo, placa, ano, cor, vagas, combustivel, consumo_km_l, observacoes } = req.body;
    if (!modelo) return res.status(400).json({ error: "modelo obrigatório" });
    const row = await db.execute(`
      INSERT INTO carona_veiculos (empresa_id, modelo, placa, ano, cor, vagas, combustivel, consumo_km_l, observacoes)
      VALUES (${empresaId}, '${safe(modelo)}', '${safe(placa)}', ${num(ano, 0) || 'NULL'}, '${safe(cor)}',
              ${num(vagas, 4)}, '${safe(combustivel || "gasolina")}', ${num(consumo_km_l, 10)}, '${safe(observacoes)}')
      RETURNING *`);
    return res.json((row.rows as any[])[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.put("/viagens/veiculos/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { modelo, placa, ano, cor, vagas, combustivel, consumo_km_l, observacoes } = req.body;
    const row = await db.execute(`
      UPDATE carona_veiculos SET
        modelo='${safe(modelo)}', placa='${safe(placa)}', ano=${num(ano, 0) || 'NULL'}, cor='${safe(cor)}',
        vagas=${num(vagas, 4)}, combustivel='${safe(combustivel)}', consumo_km_l=${num(consumo_km_l, 10)}, observacoes='${safe(observacoes)}'
      WHERE id=${Number(req.params.id)} AND empresa_id=${empresaId} RETURNING *`);
    return res.json((row.rows as any[])[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.delete("/viagens/veiculos/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    await db.execute(`UPDATE carona_veiculos SET ativo=false WHERE id=${Number(req.params.id)} AND empresa_id=${empresaId}`);
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── Caronas ───────────────────────────────────────────────────────────────────
router.get("/viagens/caronas", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const rows = await db.execute(`
      SELECT c.*, v.modelo as veiculo_modelo, v.placa as veiculo_placa, v.cor as veiculo_cor
      FROM caronas c
      LEFT JOIN carona_veiculos v ON v.id = c.veiculo_id
      WHERE c.empresa_id=${empresaId}
      ORDER BY c.data_viagem DESC, c.hora_partida DESC`);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.post("/viagens/caronas", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { origem, destino, distancia_km, data_viagem, hora_partida, vagas_total, valor_por_vaga, tipo, observacoes, veiculo_id, paradas } = req.body;
    if (!origem || !destino || !data_viagem || !hora_partida) return res.status(400).json({ error: "campos obrigatórios: origem, destino, data_viagem, hora_partida" });

    const row = await db.execute(`
      INSERT INTO caronas (empresa_id, veiculo_id, origem, destino, distancia_km, data_viagem, hora_partida, vagas_total, valor_por_vaga, tipo, observacoes)
      VALUES (${empresaId}, ${veiculo_id ? Number(veiculo_id) : 'NULL'}, '${safe(origem)}', '${safe(destino)}',
              ${distancia_km ? Number(distancia_km) : 'NULL'}, '${safe(data_viagem)}', '${safe(hora_partida)}',
              ${num(vagas_total, 3)}, ${num(valor_por_vaga, 0)}, '${safe(tipo || "com_paradas")}', '${safe(observacoes)}')
      RETURNING *`);
    const carona = (row.rows as any[])[0];

    if (Array.isArray(paradas) && paradas.length > 0) {
      for (let i = 0; i < paradas.length; i++) {
        const p = paradas[i];
        await db.execute(`
          INSERT INTO carona_paradas (carona_id, cidade, hora_prevista, ordem, aceita_embarque, aceita_desembarque)
          VALUES (${carona.id}, '${safe(p.cidade)}', ${p.hora_prevista ? `'${safe(p.hora_prevista)}'` : 'NULL'},
                  ${i}, ${p.aceita_embarque !== false}, ${p.aceita_desembarque !== false})`);
      }
    }
    return res.json(carona);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.get("/viagens/caronas/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const cId = Number(req.params.id);
    const [carRow, paradasRow, reservasRow] = await Promise.all([
      db.execute(`SELECT c.*, v.modelo as veiculo_modelo, v.placa as veiculo_placa, v.vagas as veiculo_vagas, v.combustivel as veiculo_combustivel, v.consumo_km_l as veiculo_consumo FROM caronas c LEFT JOIN carona_veiculos v ON v.id=c.veiculo_id WHERE c.id=${cId} AND c.empresa_id=${empresaId}`),
      db.execute(`SELECT * FROM carona_paradas WHERE carona_id=${cId} ORDER BY ordem`),
      db.execute(`SELECT * FROM carona_reservas WHERE carona_id=${cId} ORDER BY created_at DESC`),
    ]);
    const carona = (carRow.rows as any[])[0];
    if (!carona) return res.status(404).json({ error: "not_found" });
    return res.json({ ...carona, paradas: paradasRow.rows, reservas: reservasRow.rows });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.put("/viagens/caronas/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const cId = Number(req.params.id);
    const { origem, destino, distancia_km, data_viagem, hora_partida, vagas_total, valor_por_vaga, tipo, observacoes, veiculo_id, status, paradas } = req.body;
    await db.execute(`
      UPDATE caronas SET
        origem='${safe(origem)}', destino='${safe(destino)}', distancia_km=${distancia_km ? Number(distancia_km) : 'NULL'},
        data_viagem='${safe(data_viagem)}', hora_partida='${safe(hora_partida)}',
        vagas_total=${num(vagas_total, 3)}, valor_por_vaga=${num(valor_por_vaga, 0)},
        tipo='${safe(tipo || "com_paradas")}', observacoes='${safe(observacoes)}',
        veiculo_id=${veiculo_id ? Number(veiculo_id) : 'NULL'}, status='${safe(status || "ativa")}'
      WHERE id=${cId} AND empresa_id=${empresaId}`);
    if (Array.isArray(paradas)) {
      await db.execute(`DELETE FROM carona_paradas WHERE carona_id=${cId}`);
      for (let i = 0; i < paradas.length; i++) {
        const p = paradas[i];
        await db.execute(`INSERT INTO carona_paradas (carona_id, cidade, hora_prevista, ordem, aceita_embarque, aceita_desembarque) VALUES (${cId}, '${safe(p.cidade)}', ${p.hora_prevista ? `'${safe(p.hora_prevista)}'` : 'NULL'}, ${i}, ${p.aceita_embarque !== false}, ${p.aceita_desembarque !== false})`);
      }
    }
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.delete("/viagens/caronas/:id", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    await db.execute(`UPDATE caronas SET status='cancelada' WHERE id=${Number(req.params.id)} AND empresa_id=${empresaId}`);
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.post("/viagens/caronas/:id/reservas", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const cId = Number(req.params.id);
    const { passageiro_nome, passageiro_telefone, passageiro_cpf, parada_embarque, parada_desembarque, valor, forma_pagamento, observacoes } = req.body;
    if (!passageiro_nome) return res.status(400).json({ error: "nome do passageiro obrigatório" });
    // Reserva atômica: só insere se a carona pertence à empresa, está ativa e tem vaga.
    const upd = await db.execute(`
      UPDATE caronas SET vagas_ocupadas = vagas_ocupadas + 1
      WHERE id=${cId} AND empresa_id=${empresaId} AND status='ativa' AND vagas_ocupadas < vagas_total
      RETURNING id`);
    if ((upd.rows as any[]).length === 0) {
      return res.status(409).json({ error: "carona_indisponivel_ou_sem_vagas" });
    }
    const row = await db.execute(`
      INSERT INTO carona_reservas (carona_id, passageiro_nome, passageiro_telefone, passageiro_cpf, parada_embarque, parada_desembarque, valor, forma_pagamento, observacoes)
      VALUES (${cId}, '${safe(passageiro_nome)}', '${safe(passageiro_telefone)}', '${safe(passageiro_cpf)}',
              '${safe(parada_embarque)}', '${safe(parada_desembarque)}', ${num(valor, 0)}, '${safe(forma_pagamento || "pix")}', '${safe(observacoes)}')
      RETURNING *`);
    return res.json((row.rows as any[])[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.patch("/viagens/caronas/:id/reservas/:rid/status", async (req, res) => {
  try {
    const empresaId = getEmpresaId(req);
    if (!empresaId) return res.status(401).json({ error: "unauthorized" });
    const { status } = req.body;
    const rId = Number(req.params.rid);
    const cId = Number(req.params.id);
    // Garante que a reserva pertence a uma carona da empresa do token.
    const prev = await db.execute(`
      SELECT r.status FROM carona_reservas r
      JOIN caronas c ON c.id = r.carona_id
      WHERE r.id=${rId} AND r.carona_id=${cId} AND c.empresa_id=${empresaId}`);
    if ((prev.rows as any[]).length === 0) return res.status(404).json({ error: "reserva_not_found" });
    const prevStatus = (prev.rows as any[])[0]?.status;
    await db.execute(`
      UPDATE carona_reservas SET status='${safe(status)}'
      WHERE id=${rId} AND carona_id IN (SELECT id FROM caronas WHERE id=${cId} AND empresa_id=${empresaId})`);
    if (prevStatus === "confirmada" && status === "cancelada") {
      await db.execute(`UPDATE caronas SET vagas_ocupadas = GREATEST(0, vagas_ocupadas - 1) WHERE id=${cId} AND empresa_id=${empresaId}`);
    }
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

export default router;
