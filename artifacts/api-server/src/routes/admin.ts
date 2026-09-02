import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { usuariosTable, empresasTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";

const router: IRouter = Router();
const JWT_SECRET = process.env["JWT_SECRET"] || "gotaxi-admin-secret-2024";

// ── Auth middleware ────────────────────────────────────────────────────────────
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


// ── POST /api/admin/login ─────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, senha } = req.body;
    const [user] = await db.select().from(usuariosTable).where(eq(usuariosTable.email, email)).limit(1);
    if (!user) return res.status(401).json({ error: "invalid_credentials" });
    // simple password check (bcrypt would be used in production)
    const bcrypt = await import("bcryptjs");
    const ok = await bcrypt.compare(senha, user.senhaHash);
    if (!ok) return res.status(401).json({ error: "invalid_credentials" });
    if (user.papel !== "admin") return res.status(403).json({ error: "not_admin" });
    const token = jwt.sign({ id: user.id, nome: user.nome, email: user.email, papel: user.papel }, JWT_SECRET, { expiresIn: "24h" });
    return res.json({ token, user: { id: user.id, nome: user.nome, email: user.email, papel: user.papel } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /api/admin/me ─────────────────────────────────────────────────────────
router.get("/me", requireAdmin, (req, res) => {
  return res.json((req as any).adminUser);
});

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get("/stats", requireAdmin, async (_req, res) => {
  try {
    const stats = await db.execute(`
      SELECT
        (SELECT COUNT(*) FROM empresas WHERE ativo = true) as empresas_ativas,
        (SELECT COUNT(*) FROM empresas) as total_empresas,
        (SELECT COUNT(*) FROM usuarios) as total_usuarios,
        (SELECT COUNT(*) FROM usuarios WHERE papel = 'parceiro') as total_parceiros,
        (SELECT COUNT(*) FROM usuarios WHERE papel = 'admin') as total_admins,
        (SELECT COUNT(*) FROM pedidos_pdv) as total_pedidos,
        (SELECT COUNT(*) FROM pedidos_pdv WHERE status = 'entregue') as pedidos_entregues,
        (SELECT COALESCE(SUM(total), 0) FROM pedidos_pdv WHERE status = 'entregue') as receita_total,
        (SELECT COUNT(*) FROM produtos_pdv WHERE ativo = true) as produtos_ativos,
        (SELECT COUNT(*) FROM categorias_pdv) as total_categorias,
        (SELECT COALESCE(SUM(total_ganhos), 0) FROM afiliados) as comissao_afiliados,
        (SELECT COUNT(*) FROM afiliados WHERE status = 'ativo') as afiliados_ativos
    `);
    return res.json(stats.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── PATCH /api/admin/alterar-senha — Super admin changes own password ─────────
router.patch("/alterar-senha", requireAdmin, async (req, res) => {
  try {
    const adminUser = (req as any).adminUser;
    const { senhaAtual, novaSenha } = req.body;
    if (!senhaAtual || !novaSenha) return res.status(400).json({ error: "bad_request", message: "senhaAtual e novaSenha são obrigatórios" });
    if (novaSenha.length < 6) return res.status(400).json({ error: "bad_request", message: "A nova senha deve ter pelo menos 6 caracteres" });
    const [user] = await db.select().from(usuariosTable).where(eq(usuariosTable.id, adminUser.id)).limit(1);
    if (!user) return res.status(404).json({ error: "not_found" });
    const bcrypt = await import("bcryptjs");
    const ok = await bcrypt.compare(senhaAtual, user.senhaHash);
    if (!ok) return res.status(401).json({ error: "senha_incorreta", message: "Senha atual incorreta" });
    const novoHash = await bcrypt.hash(novaSenha, 10);
    await db.execute(`UPDATE usuarios SET senha_hash = '${novoHash}' WHERE id = ${adminUser.id}`);
    return res.json({ ok: true, message: "Senha alterada com sucesso" });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── PATCH /api/admin/usuarios/:id/alterar-senha — Admin resets partner password
router.patch("/usuarios/:id/alterar-senha", requireAdmin, async (req, res) => {
  try {
    const usuarioId = Number(req.params.id);
    const { novaSenha } = req.body;
    if (!novaSenha) return res.status(400).json({ error: "bad_request", message: "novaSenha é obrigatório" });
    if (novaSenha.length < 6) return res.status(400).json({ error: "bad_request", message: "A senha deve ter pelo menos 6 caracteres" });
    const [user] = await db.select().from(usuariosTable).where(eq(usuariosTable.id, usuarioId)).limit(1);
    if (!user) return res.status(404).json({ error: "not_found", message: "Usuário não encontrado" });
    const bcrypt = await import("bcryptjs");
    const novoHash = await bcrypt.hash(novaSenha, 10);
    await db.execute(`UPDATE usuarios SET senha_hash = '${novoHash}' WHERE id = ${usuarioId}`);
    return res.json({ ok: true, message: "Senha redefinida com sucesso" });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/admin/empresas ───────────────────────────────────────────────────
router.get("/empresas", requireAdmin, async (_req, res) => {
  try {
    const rows = await db.execute(`
      SELECT
        e.id, e.nome, e.plano, e.ativo, e.cor_primaria, e.criado_em,
        e.modulos_ativos, e.taxa_app,
        COUNT(DISTINCT u.id) as total_usuarios,
        COUNT(DISTINCT p.id) as total_pedidos,
        COALESCE(SUM(p.total) FILTER (WHERE p.status = 'entregue'), 0) as receita,
        up.id as usuario_principal_id,
        up.nome as usuario_principal_nome,
        up.email as usuario_principal_email
      FROM empresas e
      LEFT JOIN usuarios u ON u.empresa_id = e.id
      LEFT JOIN pedidos_pdv p ON p.empresa_id = e.id
      LEFT JOIN LATERAL (
        SELECT id, nome, email
        FROM usuarios
        WHERE empresa_id = e.id
        ORDER BY (papel = 'parceiro') DESC, criado_em ASC
        LIMIT 1
      ) up ON true
      GROUP BY e.id, up.id, up.nome, up.email
      ORDER BY e.criado_em DESC
    `);
    const mapped = (rows.rows as any[]).map((r) => ({
      ...r,
      taxaApp: r.taxa_app != null ? Number(r.taxa_app) : null,
      usuarioPrincipal: r.usuario_principal_id
        ? { id: r.usuario_principal_id, nome: r.usuario_principal_nome, email: r.usuario_principal_email }
        : null,
    }));
    return res.json(mapped);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── POST /api/admin/empresas ──────────────────────────────────────────────────
router.post("/empresas", requireAdmin, async (req, res) => {
  try {
    const { nome, plano = "basico", corPrimaria = "#3B82F6" } = req.body;
    if (!nome) return res.status(400).json({ error: "nome required" });
    const codigo = String(nome).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16) + "-" + Date.now().toString(36).toUpperCase();
    const rows = await db.execute(`
      INSERT INTO empresas (nome, codigo, plano, cor_primaria, ativo)
      VALUES ('${String(nome).replace(/'/g, "''")}', '${codigo}', '${plano}', '${corPrimaria}', true)
      RETURNING id, nome, plano, ativo, cor_primaria, criado_em
    `);
    return res.status(201).json(rows.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── PATCH /api/admin/empresas/:id ─────────────────────────────────────────────
router.patch("/empresas/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid_id" });

    const { ativo, plano, nome, taxaApp, corPrimaria, modulosAtivos } = req.body;
    const sets: string[] = [];
    const ALLOWED_MODULOS = ["food", "ecommerce", "motorista", "servicos", "entrega", "passagens", "tur"];

    if (ativo !== undefined) sets.push(`ativo = ${Boolean(ativo)}`);
    if (plano !== undefined) sets.push(`plano = '${String(plano).replace(/'/g, "''")}'`);
    if (nome !== undefined) {
      const trimmed = String(nome).trim();
      if (!trimmed) return res.status(400).json({ error: "nome_vazio" });
      sets.push(`nome = '${trimmed.replace(/'/g, "''")}'`);
    }
    if (taxaApp !== undefined) {
      const taxa = Number(taxaApp);
      if (isNaN(taxa) || taxa < 0 || taxa > 100) return res.status(400).json({ error: "taxa_invalida" });
      sets.push(`taxa_app = ${taxa}`);
    }
    if (corPrimaria !== undefined) {
      const cor = String(corPrimaria).trim();
      if (!/^#[0-9A-Fa-f]{6}$/.test(cor)) return res.status(400).json({ error: "cor_invalida" });
      sets.push(`cor_primaria = '${cor}'`);
    }
    if (modulosAtivos !== undefined) {
      if (!Array.isArray(modulosAtivos)) return res.status(400).json({ error: "modulos_invalidos" });
      const asStr = modulosAtivos.map(String);
      if (asStr.some(m => !ALLOWED_MODULOS.includes(m))) {
        return res.status(400).json({ error: "modulos_invalidos" });
      }
      const unique = Array.from(new Set(asStr));
      sets.push(`modulos_ativos = '${JSON.stringify(unique)}'::json`);
    }

    if (!sets.length) return res.status(400).json({ error: "nothing to update" });
    const rows = await db.execute(
      `UPDATE empresas SET ${sets.join(", ")} WHERE id = ${id} RETURNING id, nome, plano, ativo, taxa_app, cor_primaria, modulos_ativos`
    );
    if (!rows.rows[0]) return res.status(404).json({ error: "not_found" });
    return res.json(rows.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── DELETE /api/admin/empresas/:id — cascade-delete empresa and all its data ──
router.delete("/empresas/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "invalid_id" });
  try {
    // Verify empresa exists
    const [empresa] = (await db.execute(`SELECT id, nome FROM empresas WHERE id = ${id}`)).rows as any[];
    if (!empresa) return res.status(404).json({ error: "not_found", message: "Empresa não encontrada" });

    // Cascade delete — ordered to respect FK dependencies
    const tables = [
      // Viagens / passagens
      "viagens_passagens",
      "viagens_horarios",
      "viagens_rotas",
      "viagens_clientes",
      // Pedidos e entregas
      "pedidos_pdv",
      "pedidos",
      "entregas",
      "encomendas",
      "encomendas_clientes",
      // Produtos / categorias
      "extras_pdv",
      "produtos_pdv",
      "categorias_pdv",
      "promocoes_pdv",
      // Config loja
      "config_entrega_pdv",
      "config_pagamento_pdv",
      "config_ecommerce_pdv",
      "config_area_pdv",
      "config_pix_pdv",
      // Restaurante / food
      "restaurantes",
      // Motoristas e serviços
      "motoristas_pdv",
      "servicos_catalogo",
      "servicos_prestadores",
      "categorias_servicos",
      "agendamentos",
      "corridas",
      "pro_corridas",
      "caronas",
      "carona_veiculos",
      // Pro (RH)
      "pro_funcionarios",
      "pro_centros_custo",
      "pro_faturas",
      // Financeiro
      "repasses",
      // Usuários da empresa
      "usuarios",
    ];

    for (const table of tables) {
      try {
        await db.execute(`DELETE FROM ${table} WHERE empresa_id = ${id}`);
      } catch { /* table may not exist — skip */ }
    }

    // Finally delete the empresa itself
    await db.execute(`DELETE FROM empresas WHERE id = ${id}`);

    return res.json({ ok: true, message: `Empresa "${empresa.nome}" e todos os seus dados foram excluídos.` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── PUT /api/admin/empresas/:id/modulos ───────────────────────────────────────
router.put("/empresas/:id/modulos", requireAdmin, async (req, res) => {
  try {
    const { modulos } = req.body;
    if (!Array.isArray(modulos)) return res.status(400).json({ error: "modulos must be array" });
    const safe = modulos.map(String).filter(m => ["food","ecommerce","motorista","servicos","entrega","passagens"].includes(m));
    const rows = await db.execute(
      `UPDATE empresas SET modulos_ativos = '${JSON.stringify(safe)}'::json WHERE id = ${Number(req.params.id)} RETURNING id, nome, modulos_ativos`
    );
    return res.json(rows.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /api/admin/usuarios ───────────────────────────────────────────────────
router.get("/usuarios", requireAdmin, async (_req, res) => {
  try {
    const rows = await db.execute(`
      SELECT u.id, u.nome, u.email, u.papel, u.empresa_id, e.nome as empresa_nome, u.criado_em
      FROM usuarios u
      LEFT JOIN empresas e ON e.id = u.empresa_id
      ORDER BY u.criado_em DESC
    `);
    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── DELETE /api/admin/usuarios/:id ────────────────────────────────────────────
router.delete("/usuarios/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "id inválido" });
    // Limpa vínculos do programa de afiliados (FK)
    await db.execute(`DELETE FROM afiliado_resgates WHERE afiliado_id IN (SELECT id FROM afiliados WHERE usuario_id = ${id})`);
    await db.execute(`DELETE FROM afiliado_comissoes WHERE afiliado_id IN (SELECT id FROM afiliados WHERE usuario_id = ${id})`);
    await db.execute(`DELETE FROM afiliado_indicacoes WHERE afiliado_id IN (SELECT id FROM afiliados WHERE usuario_id = ${id})`);
    await db.execute(`DELETE FROM afiliados WHERE usuario_id = ${id}`);
    const out = await db.execute(`DELETE FROM usuarios WHERE id = ${id} RETURNING id`);
    if (!(out as any).rows?.length) return res.status(404).json({ error: "Usuário não encontrado" });
    return res.json({ ok: true, id });
  } catch (err: any) {
    console.error("admin/usuarios DELETE err:", err);
    const msg = String(err?.cause?.message || err?.message || "erro");
    return res.status(500).json({ error: "server_error", message: msg });
  }
});

// ── PATCH /api/admin/usuarios/:id ─────────────────────────────────────────────
router.patch("/usuarios/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "invalid_id" });

    const { papel, ativo, empresa_id, email, nome } = req.body;
    const sets: string[] = [];

    if (papel !== undefined) sets.push(`papel = '${String(papel).replace(/'/g,"''")}'`);
    if (ativo !== undefined) sets.push(`ativo = ${Boolean(ativo)}`);
    if (empresa_id !== undefined) sets.push(`empresa_id = ${Number(empresa_id)}`);
    if (nome !== undefined) {
      const trimmed = String(nome).trim();
      if (!trimmed) return res.status(400).json({ error: "nome_vazio" });
      sets.push(`nome = '${trimmed.replace(/'/g, "''")}'`);
    }
    if (email !== undefined) {
      const e = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return res.status(400).json({ error: "email_invalido" });
      // Verifica duplicado em outro usuário
      const dup = await db.execute(
        `SELECT id FROM usuarios WHERE email = '${e.replace(/'/g, "''")}' AND id <> ${id} LIMIT 1`
      );
      if ((dup as any).rows?.length) return res.status(409).json({ error: "email_em_uso" });
      sets.push(`email = '${e.replace(/'/g, "''")}'`);
    }

    if (!sets.length) return res.status(400).json({ error: "nothing to update" });
    try {
      const rows = await db.execute(
        `UPDATE usuarios SET ${sets.join(", ")} WHERE id = ${id} RETURNING id, nome, email, papel, empresa_id, ativo`
      );
      const out = (rows as any).rows?.[0] ?? (rows as any)[0];
      if (!out) return res.status(404).json({ error: "not_found" });
      return res.json(out);
    } catch (e: any) {
      // PostgreSQL unique violation on email
      const msg = String(e?.cause?.message || e?.message || "");
      if (e?.code === "23505" || /duplicate key|unique constraint/i.test(msg)) {
        return res.status(409).json({ error: "email_em_uso" });
      }
      throw e;
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /api/admin/pedidos ────────────────────────────────────────────────────
router.get("/pedidos", requireAdmin, async (_req, res) => {
  try {
    const rows = await db.execute(`
      SELECT
        p.id, p.status, p.total, p.criado_em,
        p.empresa_id, e.nome as empresa_nome,
        p.cliente_nome, p.cliente_telefone,
        COUNT(i.id) as total_itens
      FROM pedidos_pdv p
      LEFT JOIN empresas e ON e.id = p.empresa_id
      LEFT JOIN itens_pedido_pdv i ON i.pedido_id = p.id
      GROUP BY p.id, e.nome
      ORDER BY p.criado_em DESC
      LIMIT 200
    `);
    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /api/admin/repasses/:id/comprovante ──────────────────────────────────
router.get("/repasses/:id/comprovante", requireAdmin, async (req, res) => {
  try {
    const rows = await db.execute(`SELECT comprovante_path FROM repasses WHERE id = ${Number(req.params.id)}`);
    const row = rows.rows[0] as any;
    if (!row?.comprovante_path) return res.status(404).json({ error: "no_comprovante" });
    const filePath = require("path").resolve(process.cwd(), "uploads/comprovantes", row.comprovante_path);
    if (!require("fs").existsSync(filePath)) return res.status(404).json({ error: "file_not_found" });
    return res.sendFile(filePath);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/admin/configuracoes ──────────────────────────────────────────────
router.get("/configuracoes", requireAdmin, async (_req, res) => {
  try {
    const rows = await db.execute(`SELECT * FROM configuracoes_plataforma LIMIT 1`);
    return res.json(rows.rows[0] ?? {});
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── PUT /api/admin/configuracoes ──────────────────────────────────────────────
router.put("/configuracoes", requireAdmin, async (req, res) => {
  try {
    const { taxa_repasse, chave_pix, tipo_chave_pix, nome_beneficiario, dia_vencimento, hora_vencimento, whatsapp_suporte } = req.body;
    const sets: string[] = [`atualizado_em = NOW()`];
    if (taxa_repasse !== undefined) sets.push(`taxa_repasse = ${Number(taxa_repasse)}`);
    if (chave_pix !== undefined) sets.push(`chave_pix = '${String(chave_pix).replace(/'/g, "''")}'`);
    if (tipo_chave_pix !== undefined) sets.push(`tipo_chave_pix = '${tipo_chave_pix}'`);
    if (nome_beneficiario !== undefined) sets.push(`nome_beneficiario = '${String(nome_beneficiario).replace(/'/g, "''")}'`);
    if (dia_vencimento !== undefined) sets.push(`dia_vencimento = ${Number(dia_vencimento)}`);
    if (hora_vencimento !== undefined) sets.push(`hora_vencimento = '${hora_vencimento}'`);
    if (whatsapp_suporte !== undefined) sets.push(`whatsapp_suporte = '${String(whatsapp_suporte).replace(/\D/g, "").slice(0, 20)}'`);

    const exists = await db.execute(`SELECT id FROM configuracoes_plataforma LIMIT 1`);
    let rows;
    if (exists.rows.length === 0) {
      rows = await db.execute(`INSERT INTO configuracoes_plataforma (taxa_repasse, chave_pix, tipo_chave_pix, nome_beneficiario, dia_vencimento, hora_vencimento) VALUES (${Number(taxa_repasse) || 3}, '${chave_pix || ''}', '${tipo_chave_pix || 'aleatoria'}', '${nome_beneficiario || ''}', ${Number(dia_vencimento) || 1}, '${hora_vencimento || '18:00'}') RETURNING *`);
    } else {
      rows = await db.execute(`UPDATE configuracoes_plataforma SET ${sets.join(", ")} WHERE id = (SELECT id FROM configuracoes_plataforma LIMIT 1) RETURNING *`);
    }
    return res.json(rows.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/admin/repasses ───────────────────────────────────────────────────
router.get("/repasses", requireAdmin, async (_req, res) => {
  try {
    // Auto-generate current week repasse records for all active empresas
    const cfg = await db.execute(`SELECT * FROM configuracoes_plataforma LIMIT 1`);
    const taxa = Number((cfg.rows[0] as any)?.taxa_repasse ?? 3);

    // Calculate current week bounds (Monday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now); monday.setDate(now.getDate() + diffToMon); monday.setHours(0,0,0,0);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23,59,59,999);
    const semanaInicio = monday.toISOString().split("T")[0];
    const semanaFim = sunday.toISOString().split("T")[0];

    // Upsert repasse for each active empresa
    const empresas = await db.execute(`SELECT id FROM empresas WHERE ativo = true`);
    for (const emp of empresas.rows as any[]) {
      const rec = await db.execute(`
        SELECT
          COALESCE(
            (SELECT SUM(total) FROM pedidos_pdv
             WHERE empresa_id = ${emp.id} AND status = 'entregue'
             AND criado_em >= '${semanaInicio}' AND criado_em <= '${semanaFim} 23:59:59'),
            0
          ) +
          COALESCE(
            (SELECT SUM(total) FROM pedidos
             WHERE empresa_id = ${emp.id} AND status = 'entregue'
             AND criado_em >= '${semanaInicio}' AND criado_em <= '${semanaFim} 23:59:59'),
            0
          ) +
          COALESCE(
            (SELECT SUM(valor) FROM corridas
             WHERE empresa_id = ${emp.id} AND status = 'concluida'
             AND criado_em >= '${semanaInicio}' AND criado_em <= '${semanaFim} 23:59:59'),
            0
          ) as receita
      `);
      const receita = Number((rec.rows[0] as any)?.receita ?? 0);
      const valor = parseFloat((receita * taxa / 100).toFixed(2));
      await db.execute(`
        INSERT INTO repasses (empresa_id, semana_inicio, semana_fim, receita_total, taxa_percentual, valor_repasse, status)
        VALUES (${emp.id}, '${semanaInicio}', '${semanaFim}', ${receita}, ${taxa}, ${valor}, 'pendente')
        ON CONFLICT (empresa_id, semana_inicio) DO UPDATE SET
          receita_total = EXCLUDED.receita_total,
          valor_repasse = EXCLUDED.valor_repasse,
          taxa_percentual = EXCLUDED.taxa_percentual
        WHERE repasses.status = 'pendente'
      `);
    }

    // Check auto-block: if Monday 18:00 passed and still pendente → bloqueado
    const [diaVen, horaVen] = [(cfg.rows[0] as any)?.dia_vencimento ?? 1, (cfg.rows[0] as any)?.hora_vencimento ?? "18:00"];
    const [hh, mm] = String(horaVen).split(":").map(Number);
    const vencimento = new Date(monday); vencimento.setDate(monday.getDate() + (Number(diaVen) === 1 ? 0 : Number(diaVen) - 1)); vencimento.setHours(hh, mm, 0, 0);
    if (now > vencimento) {
      // Auto-block repasses and sync ecommerce_status for affected empresas.
      // IMPORTANTE: só bloqueia se houver valor a pagar (> 0). Empresas novas
      // sem receita no período continuam ativas (não há nada a cobrar).
      const toBlock = await db.execute(`
        UPDATE repasses SET status = 'bloqueado'
        WHERE semana_inicio = '${semanaInicio}'
          AND status = 'pendente'
          AND valor_repasse > 0
        RETURNING empresa_id
      `);
      for (const row of toBlock.rows as any[]) {
        await db.execute(`UPDATE empresas SET ativo = false, ecommerce_status = 'bloqueado' WHERE id = ${row.empresa_id}`);
      }

      // Auto-unblock: zera repasses com valor 0 que tenham sido bloqueados
      // por código antigo (status='bloqueado' AND valor_repasse <= 0) e
      // reativa as empresas afetadas se elas não tiverem nenhum outro
      // repasse bloqueado com valor > 0.
      const toUnblock = await db.execute(`
        UPDATE repasses SET status = 'pago', pago_em = NOW()
        WHERE status = 'bloqueado' AND valor_repasse <= 0
        RETURNING empresa_id
      `);
      for (const row of toUnblock.rows as any[]) {
        const stillBlocked = await db.execute(`
          SELECT 1 FROM repasses
          WHERE empresa_id = ${row.empresa_id}
            AND status = 'bloqueado'
            AND valor_repasse > 0
          LIMIT 1
        `);
        if (!stillBlocked.rows.length) {
          await db.execute(`UPDATE empresas SET ativo = true, ecommerce_status = 'ativo' WHERE id = ${row.empresa_id}`);
        }
      }
    }

    const rows = await db.execute(`
      SELECT r.*, e.nome as empresa_nome, e.ativo as empresa_ativa
      FROM repasses r
      LEFT JOIN empresas e ON e.id = r.empresa_id
      ORDER BY r.semana_inicio DESC, e.nome
    `);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── PATCH /api/admin/repasses/:id/pagar ──────────────────────────────────────
router.patch("/repasses/:id/pagar", requireAdmin, async (req, res) => {
  try {
    const adminId = (req as any).adminUser.id;
    const rows = await db.execute(`
      UPDATE repasses SET status = 'pago', pago_em = NOW(), ativado_por = ${adminId}
      WHERE id = ${Number(req.params.id)}
      RETURNING *
    `);
    if (!rows.rows.length) return res.status(404).json({ error: "not_found" });
    const r = rows.rows[0] as any;
    // Re-activate: food PDV + ecommerce
    await db.execute(`UPDATE empresas SET ativo = true, ecommerce_status = 'ativo' WHERE id = ${r.empresa_id}`);
    return res.json(rows.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── PATCH /api/admin/repasses/:id/bloquear ────────────────────────────────────
router.patch("/repasses/:id/bloquear", requireAdmin, async (req, res) => {
  try {
    const rows = await db.execute(`
      UPDATE repasses SET status = 'bloqueado'
      WHERE id = ${Number(req.params.id)}
      RETURNING *
    `);
    if (!rows.rows.length) return res.status(404).json({ error: "not_found" });
    const r = rows.rows[0] as any;
    // Block: food PDV (via ativo=false) + ecommerce
    await db.execute(`UPDATE empresas SET ativo = false, ecommerce_status = 'bloqueado' WHERE id = ${r.empresa_id}`);
    return res.json(rows.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── Categorias de Corrida ─────────────────────────────────────────────────────
async function ensureCategoriasTable() {
  await db.execute(`CREATE TABLE IF NOT EXISTS categorias_corrida (
    id SERIAL PRIMARY KEY, nome TEXT NOT NULL UNIQUE,
    taxa_minima REAL NOT NULL DEFAULT 5, taxa_por_km REAL NOT NULL DEFAULT 2.5,
    dist_chamada_km REAL NOT NULL DEFAULT 5, ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW()
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS modelos_veiculo (
    id SERIAL PRIMARY KEY, nome TEXT NOT NULL UNIQUE,
    ano_minimo INTEGER NOT NULL DEFAULT 2015, ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW()
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS modelo_categorias (
    modelo_id INTEGER NOT NULL, categoria_id INTEGER NOT NULL,
    PRIMARY KEY (modelo_id, categoria_id)
  )`);
}

router.get("/categorias-corrida", requireAdmin, async (_req, res) => {
  try {
    await ensureCategoriasTable();
    const rows = await db.execute(`SELECT * FROM categorias_corrida WHERE ativo = true ORDER BY id`);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.post("/categorias-corrida", requireAdmin, async (req, res) => {
  try {
    await ensureCategoriasTable();
    const { nome, taxa_minima, taxa_por_km, dist_chamada_km } = req.body;
    if (!nome) return res.status(400).json({ error: "nome obrigatório" });
    const rows = await db.execute(`
      INSERT INTO categorias_corrida (nome, taxa_minima, taxa_por_km, dist_chamada_km)
      VALUES ('${nome.replace(/'/g,"''")}', ${Number(taxa_minima)||5}, ${Number(taxa_por_km)||2.5}, ${Number(dist_chamada_km)||5})
      RETURNING *
    `);
    return res.status(201).json(rows.rows[0]);
  } catch (err: any) {
    if (err?.code === "23505") return res.status(409).json({ error: "Categoria já existe" });
    return res.status(500).json({ error: "server_error" });
  }
});

router.put("/categorias-corrida/:id", requireAdmin, async (req, res) => {
  try {
    const { taxa_minima, taxa_por_km, dist_chamada_km, nome } = req.body;
    const rows = await db.execute(`
      UPDATE categorias_corrida SET
        nome = '${(nome||"").replace(/'/g,"''")}',
        taxa_minima = ${Number(taxa_minima)||5},
        taxa_por_km = ${Number(taxa_por_km)||2.5},
        dist_chamada_km = ${Number(dist_chamada_km)||5}
      WHERE id = ${Number(req.params.id)} RETURNING *
    `);
    return res.json(rows.rows[0]);
  } catch (err) { return res.status(500).json({ error: "server_error" }); }
});

router.delete("/categorias-corrida/:id", requireAdmin, async (req, res) => {
  try {
    await db.execute(`UPDATE categorias_corrida SET ativo = false WHERE id = ${Number(req.params.id)}`);
    return res.json({ ok: true });
  } catch (err) { return res.status(500).json({ error: "server_error" }); }
});

// ── Modelos de Veículo ────────────────────────────────────────────────────────
router.get("/modelos-veiculo", requireAdmin, async (_req, res) => {
  try {
    await ensureCategoriasTable();
    const rows = await db.execute(`
      SELECT m.*, COALESCE(
        json_agg(json_build_object('id', c.id, 'nome', c.nome) ORDER BY c.id) FILTER (WHERE c.id IS NOT NULL), '[]'
      ) as categorias
      FROM modelos_veiculo m
      LEFT JOIN modelo_categorias mc ON mc.modelo_id = m.id
      LEFT JOIN categorias_corrida c ON c.id = mc.categoria_id AND c.ativo = true
      WHERE m.ativo = true
      GROUP BY m.id ORDER BY m.nome
    `);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// Public endpoint for Pro app — includes taxa_minima per category
router.get("/modelos-veiculo/publico", async (_req, res) => {
  try {
    await ensureCategoriasTable();
    const rows = await db.execute(`
      SELECT m.*, COALESCE(
        json_agg(
          json_build_object('id', c.id, 'nome', c.nome, 'taxa_minima', c.taxa_minima, 'taxa_por_km', c.taxa_por_km)
          ORDER BY c.id
        ) FILTER (WHERE c.id IS NOT NULL), '[]'
      ) as categorias
      FROM modelos_veiculo m
      LEFT JOIN modelo_categorias mc ON mc.modelo_id = m.id
      LEFT JOIN categorias_corrida c ON c.id = mc.categoria_id AND c.ativo = true
      WHERE m.ativo = true
      GROUP BY m.id ORDER BY m.nome
    `);
    return res.json(rows.rows);
  } catch (err) { return res.status(500).json({ error: "server_error" }); }
});

router.post("/modelos-veiculo", requireAdmin, async (req, res) => {
  try {
    await ensureCategoriasTable();
    const { nome, ano_minimo, categoria_ids } = req.body;
    if (!nome) return res.status(400).json({ error: "nome obrigatório" });
    const rows = await db.execute(`
      INSERT INTO modelos_veiculo (nome, ano_minimo)
      VALUES ('${nome.replace(/'/g,"''")}', ${Number(ano_minimo)||2015})
      RETURNING *
    `);
    const modelo = rows.rows[0] as any;
    if (Array.isArray(categoria_ids)) {
      for (const cid of categoria_ids) {
        await db.execute(`INSERT INTO modelo_categorias (modelo_id, categoria_id) VALUES (${modelo.id}, ${Number(cid)}) ON CONFLICT DO NOTHING`);
      }
    }
    const full = await db.execute(`
      SELECT m.*, COALESCE(json_agg(json_build_object('id',c.id,'nome',c.nome)) FILTER (WHERE c.id IS NOT NULL),'[]') as categorias
      FROM modelos_veiculo m LEFT JOIN modelo_categorias mc ON mc.modelo_id=m.id LEFT JOIN categorias_corrida c ON c.id=mc.categoria_id
      WHERE m.id=${modelo.id} GROUP BY m.id
    `);
    return res.status(201).json(full.rows[0]);
  } catch (err: any) {
    if (err?.code === "23505") return res.status(409).json({ error: "Modelo já existe" });
    return res.status(500).json({ error: "server_error" });
  }
});

router.put("/modelos-veiculo/:id", requireAdmin, async (req, res) => {
  try {
    const { nome, ano_minimo, categoria_ids } = req.body;
    const id = Number(req.params.id);
    await db.execute(`UPDATE modelos_veiculo SET nome='${(nome||"").replace(/'/g,"''")}', ano_minimo=${Number(ano_minimo)||2015} WHERE id=${id}`);
    await db.execute(`DELETE FROM modelo_categorias WHERE modelo_id=${id}`);
    if (Array.isArray(categoria_ids)) {
      for (const cid of categoria_ids) {
        await db.execute(`INSERT INTO modelo_categorias (modelo_id, categoria_id) VALUES (${id}, ${Number(cid)}) ON CONFLICT DO NOTHING`);
      }
    }
    // Recalculate eligibility for all motoristas with this car model
    await recalcMotoristasCategorias(id, Number(ano_minimo) || 2015);
    const full = await db.execute(`
      SELECT m.*, COALESCE(json_agg(json_build_object('id',c.id,'nome',c.nome)) FILTER (WHERE c.id IS NOT NULL),'[]') as categorias
      FROM modelos_veiculo m LEFT JOIN modelo_categorias mc ON mc.modelo_id=m.id LEFT JOIN categorias_corrida c ON c.id=mc.categoria_id
      WHERE m.id=${id} GROUP BY m.id
    `);
    return res.json(full.rows[0]);
  } catch (err) { return res.status(500).json({ error: "server_error" }); }
});

// Recalculate motorista_categorias for all drivers using a given car model
async function recalcMotoristasCategorias(modeloId: number, anoMinimo: number) {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS motorista_categorias (
        motorista_id INTEGER NOT NULL, categoria_id INTEGER NOT NULL, categoria_nome TEXT NOT NULL,
        PRIMARY KEY (motorista_id, categoria_id)
      )
    `);
    const modeloRows = await db.execute(`SELECT nome FROM modelos_veiculo WHERE id = ${modeloId} LIMIT 1`);
    if (!modeloRows.rows.length) return;
    const modeloNome = (modeloRows.rows[0] as any).nome;
    const catRows = await db.execute(`
      SELECT c.id, c.nome FROM modelo_categorias mc
      JOIN categorias_corrida c ON c.id = mc.categoria_id AND c.ativo = true
      WHERE mc.modelo_id = ${modeloId}
    `);
    const motoristas = await db.execute(`
      SELECT id, veiculo_ano FROM motoristas_app
      WHERE LOWER(veiculo_modelo) = LOWER('${modeloNome.replace(/'/g, "''")}')
    `);
    for (const mot of motoristas.rows as any[]) {
      await db.execute(`DELETE FROM motorista_categorias WHERE motorista_id = ${mot.id}`);
      if (!mot.veiculo_ano || mot.veiculo_ano >= anoMinimo) {
        for (const cat of catRows.rows as any[]) {
          await db.execute(`
            INSERT INTO motorista_categorias (motorista_id, categoria_id, categoria_nome)
            VALUES (${mot.id}, ${cat.id}, '${cat.nome.replace(/'/g, "''")}')
            ON CONFLICT DO NOTHING
          `);
        }
      }
    }
  } catch (err) { console.error("recalcMotoristasCategorias error:", err); }
}

router.delete("/modelos-veiculo/:id", requireAdmin, async (req, res) => {
  try {
    await db.execute(`UPDATE modelos_veiculo SET ativo = false WHERE id = ${Number(req.params.id)}`);
    return res.json({ ok: true });
  } catch (err) { return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/admin/repasses/pro ───────────────────────────────────────────────
router.get("/repasses/pro", requireAdmin, async (req, res) => {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS repasses_pro (
        id SERIAL PRIMARY KEY,
        profissional_id INTEGER NOT NULL,
        tipo_profissional TEXT NOT NULL,
        semana_inicio DATE NOT NULL,
        semana_fim DATE NOT NULL,
        total_ganhos REAL NOT NULL DEFAULT 0,
        percentual REAL NOT NULL DEFAULT 3,
        valor_repasse REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pendente',
        comprovante TEXT,
        pago_em TIMESTAMP,
        criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(profissional_id, semana_inicio)
      )
    `);
    // Auto-generate current week records for all approved professionals
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now); monday.setDate(now.getDate() + diffToMon); monday.setHours(0,0,0,0);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const semanaInicio = monday.toISOString().split("T")[0];
    const semanaFim = sunday.toISOString().split("T")[0];
    const pros = await db.execute(`SELECT id, tipo_profissional, total_ganhos FROM motoristas_app WHERE status = 'aprovado'`);
    for (const p of pros.rows as any[]) {
      const valor = parseFloat((Number(p.total_ganhos || 0) * 3 / 100).toFixed(2));
      await db.execute(`
        INSERT INTO repasses_pro (profissional_id, tipo_profissional, semana_inicio, semana_fim, total_ganhos, percentual, valor_repasse, status)
        VALUES (${p.id}, '${p.tipo_profissional}', '${semanaInicio}', '${semanaFim}', ${Number(p.total_ganhos||0)}, 3, ${valor}, 'pendente')
        ON CONFLICT (profissional_id, semana_inicio) DO UPDATE SET
          total_ganhos = EXCLUDED.total_ganhos, valor_repasse = EXCLUDED.valor_repasse
        WHERE repasses_pro.status = 'pendente'
      `);
    }
    // Auto-block past-due ones
    const lastMonday = new Date(monday); lastMonday.setDate(monday.getDate() - 7);
    const semanaPassada = lastMonday.toISOString().split("T")[0];
    await db.execute(`UPDATE repasses_pro SET status = 'bloqueado' WHERE semana_inicio = '${semanaPassada}' AND status = 'pendente'`);
    await db.execute(`
      UPDATE motoristas_app SET status_repasse = 'bloqueado'
      WHERE id IN (SELECT profissional_id FROM repasses_pro WHERE semana_inicio = '${semanaPassada}' AND status = 'bloqueado')
    `);

    const tipo = req.query.tipo as string | undefined;
    const tipoFilter = tipo && tipo !== "todos" ? `AND rp.tipo_profissional = '${tipo}'` : "";
    const rows = await db.execute(`
      SELECT rp.*, m.nome as profissional_nome, m.telefone, m.status as profissional_status, m.status_repasse
      FROM repasses_pro rp
      LEFT JOIN motoristas_app m ON m.id = rp.profissional_id
      WHERE 1=1 ${tipoFilter}
      ORDER BY rp.semana_inicio DESC, m.nome
    `);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── PATCH /api/admin/repasses/pro/:id/pagar ──────────────────────────────────
router.patch("/repasses/pro/:id/pagar", requireAdmin, async (req, res) => {
  try {
    const rows = await db.execute(`
      UPDATE repasses_pro SET status = 'pago', pago_em = NOW()
      WHERE id = ${Number(req.params.id)} RETURNING *
    `);
    if (!rows.rows.length) return res.status(404).json({ error: "not_found" });
    const r = rows.rows[0] as any;
    await db.execute(`UPDATE motoristas_app SET status_repasse = 'ok' WHERE id = ${r.profissional_id}`);
    return res.json(r);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── PATCH /api/admin/repasses/pro/:id/bloquear ───────────────────────────────
router.patch("/repasses/pro/:id/bloquear", requireAdmin, async (req, res) => {
  try {
    const rows = await db.execute(`
      UPDATE repasses_pro SET status = 'bloqueado'
      WHERE id = ${Number(req.params.id)} RETURNING *
    `);
    if (!rows.rows.length) return res.status(404).json({ error: "not_found" });
    const r = rows.rows[0] as any;
    await db.execute(`UPDATE motoristas_app SET status_repasse = 'bloqueado' WHERE id = ${r.profissional_id}`);
    return res.json(r);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/admin/push/historico ───────────────────────────────────────────
router.get("/push/historico", requireAdmin, async (_req, res) => {
  try {
    const rows = await db.execute(`SELECT * FROM push_historico ORDER BY criado_em DESC LIMIT 50`);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/admin/push/stats ───────────────────────────────────────────────
router.get("/push/stats", requireAdmin, async (_req, res) => {
  try {
    const rows = await db.execute(`
      SELECT
        COUNT(*) FILTER (WHERE ativo = true) AS total,
        COUNT(*) FILTER (WHERE ativo = true AND 'motorista' = ANY(modulos)) AS motorista,
        COUNT(*) FILTER (WHERE ativo = true AND 'food' = ANY(modulos)) AS food,
        COUNT(*) FILTER (WHERE ativo = true AND 'entrega' = ANY(modulos)) AS entrega,
        COUNT(*) FILTER (WHERE ativo = true AND 'servicos' = ANY(modulos)) AS servicos,
        COUNT(*) FILTER (WHERE ativo = true AND 'ecommerce' = ANY(modulos)) AS ecommerce,
        COUNT(*) FILTER (WHERE ativo = true AND 'passagens' = ANY(modulos)) AS passagens
      FROM push_tokens
    `);
    return res.json(rows.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── POST /api/admin/push/send ────────────────────────────────────────────────
router.post("/push/send", requireAdmin, async (req, res) => {
  try {
    const { titulo, mensagem, modulo, dados } = req.body;
    if (!titulo || !mensagem) return res.status(400).json({ error: "bad_request", message: "Título e mensagem obrigatórios" });

    let whereClause = "WHERE ativo = true AND token IS NOT NULL";
    if (modulo && modulo !== "todos") whereClause += ` AND '${modulo}' = ANY(modulos)`;

    const tokensResult = await db.execute(`SELECT DISTINCT token FROM push_tokens ${whereClause} LIMIT 1000`);
    const tokens: string[] = tokensResult.rows.map((r: any) => r.token).filter(Boolean);

    if (tokens.length === 0) return res.json({ ok: true, enviado: 0, tokens: 0 });

    const chunks: string[][] = [];
    for (let i = 0; i < tokens.length; i += 100) chunks.push(tokens.slice(i, i + 100));

    let enviados = 0;
    for (const chunk of chunks) {
      const messages = chunk.map(token => ({
        to: token,
        title: titulo,
        body: mensagem,
        data: { modulo: modulo || "todos", ...dados },
        sound: "default",
        badge: 1,
      }));
      try {
        const r = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json", "Accept-Encoding": "gzip, deflate" },
          body: JSON.stringify(messages),
        });
        if (r.ok) {
          const result = await r.json() as { data?: { status: string }[] };
          if (result?.data && Array.isArray(result.data)) {
            enviados += result.data.filter((d: { status: string }) => d.status === "ok").length;
          } else {
            enviados += chunk.length;
          }
        }
      } catch (e) { console.error("Expo push error:", e); }
    }

    await db.execute(`
      INSERT INTO push_historico (titulo, mensagem, modulo, total_tokens, total_enviado, criado_em)
      VALUES ('${titulo.replace(/'/g, "''")}', '${mensagem.replace(/'/g, "''")}', '${modulo || "todos"}', ${tokens.length}, ${enviados}, NOW())
    `).catch((e) => { console.error("push_historico insert error:", e); });

    return res.json({ ok: true, tokens: tokens.length, enviado: enviados });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── Motivos de Cancelamento (Admin CRUD) ──────────────────────────────────────
router.get("/motivos-cancelamento", async (req: Request, res: Response) => {
  try {
    const rows = await db.execute(`SELECT * FROM motivos_cancelamento ORDER BY id`);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.post("/motivos-cancelamento", async (req: Request, res: Response) => {
  try {
    const { texto } = req.body;
    if (!texto?.trim()) return res.status(400).json({ error: "texto_required" });
    const r = await db.execute(`INSERT INTO motivos_cancelamento (texto) VALUES ('${String(texto).replace(/'/g, "''")}') RETURNING *`);
    return res.json(r.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.put("/motivos-cancelamento/:id", async (req: Request, res: Response) => {
  try {
    const { texto, ativo } = req.body;
    const parts: string[] = [];
    if (texto !== undefined) parts.push(`texto = '${String(texto).replace(/'/g, "''")}'`);
    if (ativo !== undefined) parts.push(`ativo = ${ativo ? "true" : "false"}`);
    if (!parts.length) return res.status(400).json({ error: "nothing_to_update" });
    const r = await db.execute(`UPDATE motivos_cancelamento SET ${parts.join(", ")} WHERE id = ${Number(req.params.id)} RETURNING *`);
    return res.json(r.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

router.delete("/motivos-cancelamento/:id", async (req: Request, res: Response) => {
  try {
    await db.execute(`DELETE FROM motivos_cancelamento WHERE id = ${Number(req.params.id)}`);
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── PATCH /api/admin/empresas/:id/destaque ─────────────────────────────────
router.patch("/empresas/:id/destaque", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { destaque } = req.body;
    if (typeof destaque !== "boolean") return res.status(400).json({ error: "destaque must be boolean" });
    const r = await db.execute(`UPDATE empresas SET destaque = ${destaque} WHERE id = ${id} RETURNING id, nome, destaque`);
    if (!r.rows.length) return res.status(404).json({ error: "not_found" });
    return res.json(r.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/admin/destaques ───────────────────────────────────────────────
router.get("/destaques", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const r = await db.execute(`
      SELECT id, nome, cor_primaria as cor, ativo, destaque, modulos_ativos, ecommerce_categoria as categoria
      FROM empresas
      ORDER BY destaque DESC, nome
    `);
    return res.json(r.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

export default router;
