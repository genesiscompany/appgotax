import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router: IRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET || "afiliados-gotaxi-secret-2024";

// ── Auth helper ───────────────────────────────────────────────────────────────
function requireAfiliado(req: any, res: any): number | null {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) { res.status(401).json({ error: "unauthorized" }); return null; }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    return payload.afiliadoId ?? null;
  } catch { res.status(401).json({ error: "invalid_token" }); return null; }
}

function requireAdmin(req: any, res: any): boolean {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) { res.status(401).json({ error: "unauthorized" }); return false; }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "gotaxi-admin-secret") as any;
    if (payload.papel !== "admin") { res.status(403).json({ error: "forbidden" }); return false; }
    return true;
  } catch { res.status(401).json({ error: "invalid_token" }); return false; }
}

function gerarCodigo(nome: string, userId: number): string {
  const prefix = (nome || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "GO";
  const suffix = String(userId).padStart(4, "0");
  return `${prefix}${suffix}`;
}

// ── POST /api/afiliados/login ─────────────────────────────────────────────────
// Aceita qualquer conta GoTaxi: usuário do app (email/telefone), parceiro PDV (email),
// motorista de app (telefone + PIN). Cria perfil de afiliado on-demand.
router.post("/login", async (req, res) => {
  try {
    const { email, senha, identificador } = req.body;
    const ident = (identificador ?? email ?? "").toString().trim();
    if (!ident || !senha) return res.status(400).json({ error: "Informe usuário e senha" });

    const isEmail = ident.includes("@");
    const telefoneNum = ident.replace(/\D/g, "");

    // 1) Tenta em usuarios por email OU telefone
    let users: any[] = [];
    if (isEmail) {
      users = (await db.execute(sql`
        SELECT id, nome, email, senha_hash, avatar FROM usuarios
        WHERE LOWER(email) = ${ident.toLowerCase()} AND ativo = true
        LIMIT 1
      `)).rows as any[];
    }
    if (!users.length && telefoneNum.length >= 8) {
      users = (await db.execute(sql`
        SELECT id, nome, email, senha_hash, avatar FROM usuarios
        WHERE telefone = ${telefoneNum} AND ativo = true
        LIMIT 1
      `)).rows as any[];
    }

    let user: any = null;
    if (users.length) {
      const candidate = users[0];
      const hash = candidate.senha_hash || "";
      // Senhas de cliente são texto plano; senhas PDV admin são bcrypt
      const okBcrypt = hash.startsWith("$2") ? await bcrypt.compare(senha, hash).catch(() => false) : false;
      const okPlain = hash === senha;
      if (okBcrypt || okPlain) user = candidate;
    }

    // 2) Fallback: motoristas_app por telefone + senha_pin
    if (!user && telefoneNum.length >= 8) {
      const motoRows = (await db.execute(sql`
        SELECT id, nome, email, telefone, senha_pin
        FROM motoristas_app
        WHERE telefone = ${telefoneNum} AND ativo = true
        LIMIT 1
      `)).rows as any[];
      if (motoRows.length && String(motoRows[0].senha_pin) === String(senha)) {
        const moto = motoRows[0];
        const emailShadow = (moto.email || `mot${moto.id}@motorista.gotaxi`).toLowerCase();
        const existing = (await db.execute(sql`
          SELECT id, nome, email, senha_hash, avatar FROM usuarios
          WHERE LOWER(email) = ${emailShadow} OR telefone = ${moto.telefone}
          LIMIT 1
        `)).rows as any[];
        if (existing.length) {
          user = existing[0];
        } else {
          const ins = (await db.execute(sql`
            INSERT INTO usuarios (nome, email, senha_hash, telefone, empresa_id, papel, ativo)
            VALUES (${moto.nome}, ${emailShadow}, ${String(moto.senha_pin)}, ${moto.telefone}, 1, 'cliente', true)
            RETURNING id, nome, email, senha_hash, avatar
          `)).rows as any[];
          user = ins[0];
        }
      }
    }

    if (!user) return res.status(401).json({ error: "Usuário ou senha inválidos" });

    // Get or create afiliado profile
    let afiliadoRows = (await db.execute(sql`
      SELECT * FROM afiliados WHERE usuario_id = ${user.id}
    `)).rows as any[];

    if (!afiliadoRows.length) {
      // Retry up to 3x in case `codigo` UNIQUE conflicts (different user, same prefix)
      for (let attempt = 0; attempt < 3 && !afiliadoRows.length; attempt++) {
        const base = gerarCodigo(user.nome, user.id);
        const codigo = attempt === 0 ? base : `${base}${Math.floor(Math.random() * 900) + 100}`;
        try {
          const inserted = (await db.execute(sql`
            INSERT INTO afiliados (usuario_id, codigo)
            VALUES (${user.id}, ${codigo})
            ON CONFLICT (usuario_id) DO NOTHING
            RETURNING *
          `)).rows;
          if (inserted.length) {
            afiliadoRows = inserted as any[];
          } else {
            // usuario_id already existed (race condition) — fetch it
            afiliadoRows = (await db.execute(sql`
              SELECT * FROM afiliados WHERE usuario_id = ${user.id}
            `)).rows as any[];
          }
        } catch (e: any) {
          if (e.code === "23505" && attempt < 2) continue; // codigo conflict, retry
          throw e;
        }
      }
    }

    const afiliado = afiliadoRows[0];
    const token = jwt.sign({ afiliadoId: afiliado.id, usuarioId: user.id }, JWT_SECRET, { expiresIn: "30d" });

    return res.json({
      token,
      usuario: { id: user.id, nome: user.nome, email: user.email, avatar: user.avatar },
      afiliado,
    });
  } catch (err) {
    console.error("afiliados/login err:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /api/afiliados/dashboard ─────────────────────────────────────────────
router.get("/dashboard", async (req, res) => {
  try {
    const afiliadoId = requireAfiliado(req, res);
    if (!afiliadoId) return;

    const [afilRows, configRows, comissaoRows, resgateRows] = await Promise.all([
      db.execute(sql`SELECT a.*, u.nome, u.email, u.avatar FROM afiliados a JOIN usuarios u ON u.id = a.usuario_id WHERE a.id = ${afiliadoId}`),
      db.execute(sql`SELECT * FROM afiliados_config LIMIT 1`),
      db.execute(sql`SELECT COUNT(*) as total, SUM(valor_comissao) as soma FROM afiliado_comissoes WHERE afiliado_id = ${afiliadoId} AND status = 'aprovado'`),
      db.execute(sql`SELECT COUNT(*) as total, SUM(valor) as soma FROM afiliado_resgates WHERE afiliado_id = ${afiliadoId} AND status IN ('pendente', 'processando')`),
    ]);

    const afiliado = (afilRows.rows as any[])[0];
    const config = (configRows.rows as any[])[0];

    return res.json({
      afiliado,
      config,
      comissoes: (comissaoRows.rows as any[])[0],
      saquesPendentes: (resgateRows.rows as any[])[0],
    });
  } catch (err) {
    console.error("afiliados/dashboard err:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /api/afiliados/indicados ─────────────────────────────────────────────
// Status é calculado AO VIVO via JOIN com a tabela `usuarios` (match por email).
// Assim, quando o super admin ativa/inativa/apaga um usuário, o painel do
// afiliado reflete imediatamente — sem desync entre tabelas.
//   • usuário existe e ativo=true   → "ativo"
//   • usuário existe e ativo=false  → "inativo"
//   • usuário não existe (deletado) → linha é OMITIDA
//   • email_indicado vazio (link compartilhado mas sem cadastro ainda)
//                                    → mantém status original (geralmente "pendente")
router.get("/indicados", async (req, res) => {
  try {
    const afiliadoId = requireAfiliado(req, res);
    if (!afiliadoId) return;

    const rows = (await db.execute(sql`
      SELECT ai.id, ai.afiliado_id, ai.usuario_indicado_id, ai.nome_indicado,
        ai.email_indicado, ai.tipo_indicado, ai.tipo_dispositivo, ai.bonus_valor,
        ai.criado_em,
        CASE
          WHEN u.id IS NULL AND ai.email_indicado IS NOT NULL
            AND ai.email_indicado <> '' THEN NULL
          WHEN u.id IS NOT NULL AND u.ativo = true THEN 'ativo'
          WHEN u.id IS NOT NULL AND u.ativo = false THEN 'inativo'
          ELSE ai.status
        END AS status,
        (SELECT SUM(ac.valor_comissao) FROM afiliado_comissoes ac
          WHERE ac.indicado_id = ai.id AND ac.status = 'aprovado') AS total_comissao
      FROM afiliado_indicacoes ai
      LEFT JOIN usuarios u ON LOWER(u.email) = LOWER(ai.email_indicado)
      WHERE ai.afiliado_id = ${afiliadoId}
      ORDER BY ai.criado_em DESC LIMIT 100
    `)).rows;

    // Filtra fora as linhas cujo usuário foi deletado (status calculado = NULL)
    const visiveis = (rows as any[]).filter(r => r.status !== null);

    return res.json(visiveis);
  } catch (err) {
    console.error("afiliados/indicados err:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /api/afiliados/comissoes ─────────────────────────────────────────────
router.get("/comissoes", async (req, res) => {
  try {
    const afiliadoId = requireAfiliado(req, res);
    if (!afiliadoId) return;

    const rows = (await db.execute(sql`
      SELECT ac.*, ai.nome_indicado
      FROM afiliado_comissoes ac
      LEFT JOIN afiliado_indicacoes ai ON ai.id = ac.indicado_id
      WHERE ac.afiliado_id = ${afiliadoId}
      ORDER BY ac.criado_em DESC LIMIT 100
    `)).rows;

    return res.json(rows);
  } catch (err) {
    console.error("afiliados/comissoes err:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /api/afiliados/resgates ──────────────────────────────────────────────
router.get("/resgates", async (req, res) => {
  try {
    const afiliadoId = requireAfiliado(req, res);
    if (!afiliadoId) return;

    const rows = (await db.execute(sql`
      SELECT * FROM afiliado_resgates WHERE afiliado_id = ${afiliadoId}
      ORDER BY criado_em DESC LIMIT 50
    `)).rows;

    return res.json(rows);
  } catch (err) {
    console.error("afiliados/resgates err:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── POST /api/afiliados/resgatar ─────────────────────────────────────────────
router.post("/resgatar", async (req, res) => {
  try {
    const afiliadoId = requireAfiliado(req, res);
    if (!afiliadoId) return;

    const { valor, chave_pix } = req.body;
    if (!valor || Number(valor) <= 0) return res.status(400).json({ error: "Valor inválido" });
    if (!chave_pix?.trim()) return res.status(400).json({ error: "Informe a chave Pix" });

    const configRows = (await db.execute(sql`SELECT valor_minimo_saque FROM afiliados_config LIMIT 1`)).rows as any[];
    const minimo = Number(configRows[0]?.valor_minimo_saque ?? 50);

    if (Number(valor) < minimo) return res.status(400).json({ error: `Valor mínimo para saque é R$ ${minimo.toFixed(2).replace(".", ",")}` });

    const afilRows = (await db.execute(sql`SELECT * FROM afiliados WHERE id = ${afiliadoId}`)).rows as any[];
    if (!afilRows.length) return res.status(404).json({ error: "Afiliado não encontrado" });

    const afiliado = afilRows[0] as any;
    if (Number(afiliado.saldo) < Number(valor)) return res.status(400).json({ error: "Saldo insuficiente" });

    await db.execute(sql`UPDATE afiliados SET saldo = saldo - ${Number(valor)}, chave_pix = ${chave_pix} WHERE id = ${afiliadoId}`);
    await db.execute(sql`INSERT INTO afiliado_resgates (afiliado_id, valor, chave_pix) VALUES (${afiliadoId}, ${Number(valor)}, ${chave_pix})`);

    return res.json({ ok: true, message: "Saque solicitado! Processado em até 3 dias úteis." });
  } catch (err) {
    console.error("afiliados/resgatar err:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── PATCH /api/afiliados/perfil ──────────────────────────────────────────────
router.patch("/perfil", async (req, res) => {
  try {
    const afiliadoId = requireAfiliado(req, res);
    if (!afiliadoId) return;

    const { chave_pix, tipo_pessoa, banco_nome } = req.body;
    await db.execute(sql`
      UPDATE afiliados SET
        chave_pix = COALESCE(${chave_pix ?? null}, chave_pix),
        tipo_pessoa = COALESCE(${tipo_pessoa ?? null}, tipo_pessoa),
        banco_nome = COALESCE(${banco_nome ?? null}, banco_nome)
      WHERE id = ${afiliadoId}
    `);

    return res.json({ ok: true });
  } catch (err) {
    console.error("afiliados/perfil patch err:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── GET /api/afiliados/relatorio.csv ─────────────────────────────────────────
router.get("/relatorio.csv", async (req, res) => {
  try {
    const afiliadoId = requireAfiliado(req, res);
    if (!afiliadoId) return;

    const [indicados, comissoes, resgates] = await Promise.all([
      db.execute(sql`SELECT nome_indicado, email_indicado, tipo_indicado, tipo_dispositivo, status, criado_em FROM afiliado_indicacoes WHERE afiliado_id = ${afiliadoId} ORDER BY criado_em DESC`),
      db.execute(sql`SELECT tipo_evento, valor_transacao, percentual, valor_comissao, status, descricao, criado_em FROM afiliado_comissoes WHERE afiliado_id = ${afiliadoId} ORDER BY criado_em DESC`),
      db.execute(sql`SELECT valor, chave_pix, status, criado_em, processado_em FROM afiliado_resgates WHERE afiliado_id = ${afiliadoId} ORDER BY criado_em DESC`),
    ]);

    let csv = "SEP=;\r\n";
    csv += "INDICADOS\r\n";
    csv += "Nome;Email;Tipo;Dispositivo;Status;Data\r\n";
    for (const r of indicados.rows as any[]) {
      csv += `${r.nome_indicado || ""};${r.email_indicado || ""};${r.tipo_indicado || ""};${r.tipo_dispositivo || ""};${r.status};${new Date(r.criado_em).toLocaleDateString("pt-BR")}\r\n`;
    }
    csv += "\r\nCOMISSÕES\r\n";
    csv += "Evento;Valor Transação;%;Comissão;Status;Descrição;Data\r\n";
    for (const r of comissoes.rows as any[]) {
      csv += `${r.tipo_evento};R$ ${Number(r.valor_transacao).toFixed(2)};${r.percentual}%;R$ ${Number(r.valor_comissao).toFixed(2)};${r.status};${r.descricao || ""};${new Date(r.criado_em).toLocaleDateString("pt-BR")}\r\n`;
    }
    csv += "\r\nSAQUES\r\n";
    csv += "Valor;Chave Pix;Status;Solicitado;Processado\r\n";
    for (const r of resgates.rows as any[]) {
      csv += `R$ ${Number(r.valor).toFixed(2)};${r.chave_pix || ""};${r.status};${new Date(r.criado_em).toLocaleDateString("pt-BR")};${r.processado_em ? new Date(r.processado_em).toLocaleDateString("pt-BR") : ""}\r\n`;
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="relatorio-afiliados.csv"`);
    res.setHeader("BOM", "\uFEFF");
    return res.send("\uFEFF" + csv);
  } catch (err) {
    console.error("afiliados/relatorio err:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── ADMIN: GET /api/afiliados/admin/lista ────────────────────────────────────
router.get("/admin/lista", async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const rows = (await db.execute(sql`
      SELECT a.*, u.nome, u.email, u.telefone,
        (SELECT COUNT(*) FROM afiliado_indicacoes WHERE afiliado_id = a.id) as qtd_indicados,
        (SELECT COUNT(*) FROM afiliado_comissoes WHERE afiliado_id = a.id AND status = 'aprovado') as qtd_comissoes,
        (SELECT COALESCE(SUM(valor), 0) FROM afiliado_resgates WHERE afiliado_id = a.id AND status = 'pendente') as saldo_pendente_saque
      FROM afiliados a JOIN usuarios u ON u.id = a.usuario_id
      ORDER BY a.total_ganhos DESC
    `)).rows;

    return res.json(rows);
  } catch (err) {
    console.error("afiliados/admin/lista err:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── ADMIN: GET /api/afiliados/admin/indicacoes ──────────────────────────────
// Lista todas as indicações com nome do afiliado dono. Status é AO VIVO
// (mesma lógica do GET /indicados): consulta usuarios via email.
router.get("/admin/indicacoes", async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const rows = (await db.execute(sql`
      SELECT ai.id, ai.afiliado_id, ai.nome_indicado, ai.email_indicado,
        ai.tipo_indicado, ai.tipo_dispositivo, ai.criado_em,
        u_afil.nome AS afiliado_nome, a.codigo AS afiliado_codigo,
        CASE
          WHEN u.id IS NULL AND ai.email_indicado IS NOT NULL
            AND ai.email_indicado <> '' THEN 'sem_cadastro'
          WHEN u.id IS NOT NULL AND u.ativo = true THEN 'ativo'
          WHEN u.id IS NOT NULL AND u.ativo = false THEN 'inativo'
          ELSE ai.status
        END AS status
      FROM afiliado_indicacoes ai
      LEFT JOIN usuarios u ON LOWER(u.email) = LOWER(ai.email_indicado)
      LEFT JOIN afiliados a ON a.id = ai.afiliado_id
      LEFT JOIN usuarios u_afil ON u_afil.id = a.usuario_id
      ORDER BY ai.criado_em DESC LIMIT 500
    `)).rows;

    return res.json(rows);
  } catch (err) {
    console.error("afiliados/admin/indicacoes err:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── ADMIN: DELETE /api/afiliados/admin/indicacoes/:id ───────────────────────
// Remove uma indicação específica e suas comissões associadas.
router.delete("/admin/indicacoes/:id", async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "id inválido" });

    await db.execute(sql`DELETE FROM afiliado_comissoes WHERE indicado_id = ${id}`);
    const result = await db.execute(sql`DELETE FROM afiliado_indicacoes WHERE id = ${id} RETURNING id, nome_indicado`);

    if (!result.rows.length) return res.status(404).json({ error: "não encontrado" });
    return res.json({ ok: true, removido: result.rows[0] });
  } catch (err) {
    console.error("afiliados/admin/indicacoes DELETE err:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── ADMIN: GET /api/afiliados/admin/saques ───────────────────────────────────
router.get("/admin/saques", async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const { status = "pendente" } = req.query;
    const rows = (await db.execute(sql`
      SELECT ar.*, u.nome, u.email, u.telefone, a.codigo
      FROM afiliado_resgates ar
      JOIN afiliados a ON a.id = ar.afiliado_id
      JOIN usuarios u ON u.id = a.usuario_id
      WHERE ar.status = ${status as string}
      ORDER BY ar.criado_em ASC
    `)).rows;

    return res.json(rows);
  } catch (err) {
    console.error("afiliados/admin/saques err:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── ADMIN: POST /api/afiliados/admin/pagar ───────────────────────────────────
router.post("/admin/pagar", async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const { resgate_id, observacao } = req.body;
    if (!resgate_id) return res.status(400).json({ error: "resgate_id obrigatório" });

    await db.execute(sql`
      UPDATE afiliado_resgates SET
        status = 'pago',
        processado_em = NOW(),
        observacao = ${observacao ?? null}
      WHERE id = ${resgate_id} AND status IN ('pendente', 'processando')
    `);

    return res.json({ ok: true });
  } catch (err) {
    console.error("afiliados/admin/pagar err:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── ADMIN: GET/PATCH /api/afiliados/admin/config ─────────────────────────────
router.get("/admin/config", async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const rows = (await db.execute(sql`SELECT * FROM afiliados_config LIMIT 1`)).rows;
    return res.json(rows[0] ?? {});
  } catch (err) { return res.status(500).json({ error: "server_error" }); }
});

router.patch("/admin/config", async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const { percentual_comissao, valor_minimo_saque } = req.body;
    await db.execute(sql`
      UPDATE afiliados_config SET
        percentual_comissao = COALESCE(${percentual_comissao ?? null}, percentual_comissao),
        valor_minimo_saque = COALESCE(${valor_minimo_saque ?? null}, valor_minimo_saque),
        atualizado_em = NOW()
    `);
    return res.json({ ok: true });
  } catch (err) { return res.status(500).json({ error: "server_error" }); }
});

// ── ADMIN: GET /api/afiliados/admin/relatorio.csv ────────────────────────────
router.get("/admin/relatorio.csv", async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const rows = (await db.execute(sql`
      SELECT u.nome, u.email, a.codigo, a.saldo, a.total_indicados, a.total_ganhos, a.status,
        (SELECT COALESCE(SUM(valor), 0) FROM afiliado_resgates WHERE afiliado_id = a.id AND status = 'pago') as total_sacado,
        (SELECT COALESCE(SUM(valor), 0) FROM afiliado_resgates WHERE afiliado_id = a.id AND status = 'pendente') as saldo_pendente_saque
      FROM afiliados a JOIN usuarios u ON u.id = a.usuario_id
      ORDER BY a.total_ganhos DESC
    `)).rows as any[];

    let csv = "\uFEFFNome;Email;Código;Saldo Atual;Indicados;Total Ganho;Total Sacado;Saque Pendente;Status\r\n";
    for (const r of rows) {
      csv += `${r.nome};${r.email};${r.codigo};R$ ${Number(r.saldo).toFixed(2)};${r.total_indicados};R$ ${Number(r.total_ganhos).toFixed(2)};R$ ${Number(r.total_sacado).toFixed(2)};R$ ${Number(r.saldo_pendente_saque).toFixed(2)};${r.status}\r\n`;
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="afiliados-gotaxi.csv"`);
    return res.send(csv);
  } catch (err) { return res.status(500).json({ error: "server_error" }); }
});

// ── GET /api/afiliados/qrcode-link ───────────────────────────────────────────
router.get("/qrcode-link", async (req, res) => {
  try {
    const afiliadoId = requireAfiliado(req, res);
    if (!afiliadoId) return;
    const rows = (await db.execute(sql`SELECT codigo FROM afiliados WHERE id = ${afiliadoId}`)).rows as any[];
    if (!rows.length) return res.status(404).json({ error: "not_found" });
    const codigo = rows[0].codigo;
    const domain = process.env.PUBLIC_DOMAIN
      || (req.headers["x-forwarded-host"] ? `https://${req.headers["x-forwarded-host"]}` : null)
      || req.headers.origin
      || `https://${process.env.REPL_SLUG ?? "gotaxiplus"}.replit.app`;
    const url = `${domain}/afiliados/r/${codigo}`;
    return res.json({ url, codigo });
  } catch (err) {
    console.error("afiliados/qrcode-link err:", err);
    return res.status(500).json({ error: "server_error" });
  }
});

// ── PUBLIC: GET /api/afiliados/r/:codigo ─────────────────────────────────────
router.get("/r/:codigo", async (req, res) => {
  try {
    const { codigo } = req.params;
    const cod = String(codigo).trim().toUpperCase();

    // 1) Afiliados table (programa de comissão)
    const afiliadoRows = (await db.execute(sql`
      SELECT a.codigo, a.status, u.nome, 'afiliado' as tipo FROM afiliados a
      JOIN usuarios u ON u.id = a.usuario_id
      WHERE UPPER(a.codigo) = ${cod} AND a.status = 'ativo'
    `)).rows as any[];
    if (afiliadoRows.length) return res.json(afiliadoRows[0]);

    // 2) Motoristas/entregadores (codigo_referral)
    const motoristaRows = (await db.execute(sql`
      SELECT codigo_referral as codigo, 'ativo' as status, nome, tipo_profissional as tipo
      FROM motoristas_app
      WHERE UPPER(codigo_referral) = ${cod} AND ativo = true
      LIMIT 1
    `)).rows as any[];
    if (motoristaRows.length) return res.json(motoristaRows[0]);

    // 3) Clientes (codigo_referral em usuarios)
    const usuarioRows = (await db.execute(sql`
      SELECT codigo_referral as codigo, 'ativo' as status, nome, 'cliente' as tipo
      FROM usuarios
      WHERE UPPER(codigo_referral) = ${cod} AND ativo = true
      LIMIT 1
    `)).rows as any[];
    if (usuarioRows.length) return res.json(usuarioRows[0]);

    return res.status(404).json({ error: "Código não encontrado" });
  } catch (err) { return res.status(500).json({ error: "server_error" }); }
});

// ── PUBLIC: POST /api/afiliados/cadastrar-indicado ───────────────────────────
// Cadastra um novo indicado criando a conta real (cliente / motorista / empresa)
// e vinculando ao código do afiliado. Retorna redirect_to ('pdv' ou 'app').
router.post("/cadastrar-indicado", async (req, res) => {
  try {
    const { codigo, categoria, nome, whatsapp, email, senha } = req.body ?? {};
    if (!codigo || !categoria || !nome || !whatsapp || !senha) {
      return res.status(400).json({ error: "Dados obrigatórios ausentes" });
    }
    const telefoneNum = String(whatsapp).replace(/\D/g, "");
    if (telefoneNum.length < 8) return res.status(400).json({ error: "WhatsApp inválido" });
    if (String(senha).length < 4) return res.status(400).json({ error: "Senha deve ter ao menos 4 caracteres" });

    const cod = String(codigo).trim().toUpperCase();
    const catsPdv = new Set(["alimentacao", "ecommerce", "servicos", "encomendas", "tur"]);
    const catsApp = new Set(["cliente", "motorista", "food"]);
    if (!catsPdv.has(categoria) && !catsApp.has(categoria)) {
      return res.status(400).json({ error: "Categoria inválida" });
    }

    // Localiza/garante afiliado para este código
    let afiliadoId: number | null = null;
    let afiliadoNome = "";
    const afRows = (await db.execute(sql`
      SELECT a.id, u.nome FROM afiliados a
      JOIN usuarios u ON u.id = a.usuario_id
      WHERE UPPER(a.codigo) = ${cod} AND a.status = 'ativo'
      LIMIT 1
    `)).rows as any[];
    if (afRows.length) {
      afiliadoId = afRows[0].id;
      afiliadoNome = afRows[0].nome;
    } else {
      // Tenta auto-criar afiliado a partir de usuarios.codigo_referral
      const uRows = (await db.execute(sql`
        SELECT id, nome FROM usuarios WHERE UPPER(codigo_referral) = ${cod} AND ativo = true LIMIT 1
      `)).rows as any[];
      if (uRows.length) {
        const u = uRows[0];
        const ins = (await db.execute(sql`
          INSERT INTO afiliados (usuario_id, codigo)
          VALUES (${u.id}, ${cod})
          ON CONFLICT (usuario_id) DO UPDATE SET codigo = EXCLUDED.codigo
          RETURNING id
        `)).rows as any[];
        afiliadoId = ins[0].id;
        afiliadoNome = u.nome;
      } else {
        // Tenta a partir de motoristas_app.codigo_referral → cria shadow user + afiliado
        const mRows = (await db.execute(sql`
          SELECT id, nome, email, telefone, senha_pin
          FROM motoristas_app WHERE UPPER(codigo_referral) = ${cod} AND ativo = true LIMIT 1
        `)).rows as any[];
        if (mRows.length) {
          const m = mRows[0];
          const emailShadow = (m.email || `mot${m.id}@motorista.gotaxi`).toLowerCase();
          let shadow = (await db.execute(sql`
            SELECT id, nome FROM usuarios WHERE LOWER(email) = ${emailShadow} OR telefone = ${m.telefone} LIMIT 1
          `)).rows as any[];
          if (!shadow.length) {
            shadow = (await db.execute(sql`
              INSERT INTO usuarios (nome, email, senha_hash, telefone, empresa_id, papel, ativo)
              VALUES (${m.nome}, ${emailShadow}, ${String(m.senha_pin)}, ${m.telefone}, 1, 'cliente', true)
              RETURNING id, nome
            `)).rows as any[];
          }
          const uid = shadow[0].id;
          const ins = (await db.execute(sql`
            INSERT INTO afiliados (usuario_id, codigo)
            VALUES (${uid}, ${cod})
            ON CONFLICT (usuario_id) DO UPDATE SET codigo = EXCLUDED.codigo
            RETURNING id
          `)).rows as any[];
          afiliadoId = ins[0].id;
          afiliadoNome = shadow[0].nome;
        }
      }
    }

    if (!afiliadoId) return res.status(404).json({ error: "Código de indicação não encontrado" });

    // ── Cria a conta real conforme categoria ──────────────────────────────────
    let redirectTo: "pdv" | "app" = "app";
    let contaLogin = "";

    if (categoria === "cliente") {
      // Evita duplicidade
      const existe = (await db.execute(sql`
        SELECT id FROM usuarios WHERE telefone = ${telefoneNum} LIMIT 1
      `)).rows as any[];
      if (existe.length) return res.status(409).json({ error: "Já existe uma conta com este WhatsApp" });

      const emailFinal = (email?.trim() || `${telefoneNum}@cliente.gotaxi`).toLowerCase();
      const novo = (await db.execute(sql`
        INSERT INTO usuarios (nome, email, senha_hash, telefone, empresa_id, papel, ativo, indicado_por)
        VALUES (${nome.trim()}, ${emailFinal}, ${String(senha)}, ${telefoneNum}, 1, 'cliente', true, ${cod})
        RETURNING id, nome
      `)).rows as any[];
      const novoId = novo[0].id;
      const codRef = gerarCodigo(nome, novoId);
      await db.execute(sql`UPDATE usuarios SET codigo_referral = ${codRef} WHERE id = ${novoId} AND codigo_referral IS NULL`);
      contaLogin = telefoneNum;
      redirectTo = "app";
    } else if (categoria === "motorista") {
      const existe = (await db.execute(sql`
        SELECT id FROM motoristas_app WHERE telefone = ${telefoneNum} LIMIT 1
      `)).rows as any[];
      if (existe.length) return res.status(409).json({ error: "Já existe um motorista com este WhatsApp" });

      const emailFinal = email?.trim() ? email.trim().toLowerCase() : null;
      const novo = (await db.execute(sql`
        INSERT INTO motoristas_app (nome, telefone, senha_pin, email, tipo_profissional, indicado_por, ativo, status)
        VALUES (${nome.trim()}, ${telefoneNum}, ${String(senha)}, ${emailFinal}, 'motorista', ${cod}, true, 'pendente')
        RETURNING id
      `)).rows as any[];
      const novoId = novo[0].id;
      const codRef = gerarCodigo(nome, novoId);
      await db.execute(sql`UPDATE motoristas_app SET codigo_referral = ${codRef} WHERE id = ${novoId} AND codigo_referral IS NULL`);
      contaLogin = telefoneNum;
      redirectTo = "app";
    } else if (categoria === "food") {
      // Boy Delivery (motoristas_app com tipo_profissional='delivery') — aparece em /admin/delivery
      const existe = (await db.execute(sql`
        SELECT id FROM motoristas_app WHERE telefone = ${telefoneNum} LIMIT 1
      `)).rows as any[];
      if (existe.length) return res.status(409).json({ error: "Já existe um cadastro com este WhatsApp" });

      const emailFinal = email?.trim() ? email.trim().toLowerCase() : null;
      const novo = (await db.execute(sql`
        INSERT INTO motoristas_app (nome, telefone, senha_pin, email, tipo_profissional, indicado_por, ativo, status)
        VALUES (${nome.trim()}, ${telefoneNum}, ${String(senha)}, ${emailFinal}, 'delivery', ${cod}, true, 'pendente')
        RETURNING id
      `)).rows as any[];
      const novoId = novo[0].id;
      const codRef = gerarCodigo(nome, novoId);
      await db.execute(sql`UPDATE motoristas_app SET codigo_referral = ${codRef} WHERE id = ${novoId} AND codigo_referral IS NULL`);
      contaLogin = telefoneNum;
      redirectTo = "app";
    } else if (categoria === "encomendas") {
      // Entregador: cria registro em motoristas_app E uma empresa-espelho
      // pra também aparecer em /admin/empresas com o badge "Entregas".
      const existe = (await db.execute(sql`
        SELECT id FROM motoristas_app WHERE telefone = ${telefoneNum} LIMIT 1
      `)).rows as any[];
      if (existe.length) return res.status(409).json({ error: "Já existe um entregador com este WhatsApp" });

      const emailFinal = email?.trim() ? email.trim().toLowerCase() : null;
      const novo = (await db.execute(sql`
        INSERT INTO motoristas_app (nome, telefone, senha_pin, email, tipo_profissional, indicado_por, ativo, status)
        VALUES (${nome.trim()}, ${telefoneNum}, ${String(senha)}, ${emailFinal}, 'entregador', ${cod}, true, 'pendente')
        RETURNING id
      `)).rows as any[];
      const novoId = novo[0].id;
      const codRef = gerarCodigo(nome, novoId);
      await db.execute(sql`UPDATE motoristas_app SET codigo_referral = ${codRef} WHERE id = ${novoId} AND codigo_referral IS NULL`);

      // Empresa-espelho na lista de parceiros
      const codigoEmp = String(nome).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) + Date.now().toString(36).toUpperCase().slice(-4);
      const emailEmpresa = (email?.trim() || `${telefoneNum}@entregador.gotaxi`).toLowerCase();
      await db.execute(sql`
        INSERT INTO empresas (nome, codigo, responsavel, email, telefone, plano, cor_primaria, ativo, modulos_ativos, indicado_por)
        VALUES (${nome.trim()}, ${codigoEmp}, ${nome.trim()}, ${emailEmpresa}, ${telefoneNum}, 'basico', '#F59E0B', true, ${JSON.stringify(["encomendas"])}::json, ${cod})
        ON CONFLICT DO NOTHING
      `);

      contaLogin = telefoneNum;
      redirectTo = "app";
    } else {
      // Empresas PDV (alimentacao / ecommerce / servicos / tur)
      const emailFinal = (email?.trim() || `${telefoneNum}@empresa.gotaxi`).toLowerCase();
      const existe = (await db.execute(sql`
        SELECT id FROM usuarios WHERE LOWER(email) = ${emailFinal} LIMIT 1
      `)).rows as any[];
      if (existe.length) return res.status(409).json({ error: "Já existe uma conta com este e-mail" });

      const codigoEmp = String(nome).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) + Date.now().toString(36).toUpperCase().slice(-4);
      const modulo = categoria; // 'alimentacao' | 'ecommerce' | 'servicos' | 'tur'
      const empRow = (await db.execute(sql`
        INSERT INTO empresas (nome, codigo, responsavel, email, telefone, plano, cor_primaria, ativo, modulos_ativos, indicado_por)
        VALUES (${nome.trim()}, ${codigoEmp}, ${nome.trim()}, ${emailFinal}, ${telefoneNum}, 'basico', '#7C3AED', true, ${JSON.stringify([modulo])}::json, ${cod})
        RETURNING id
      `)).rows as any[];
      const empresaId = empRow[0].id;

      // Senha bcrypt para PDV admin (auth.ts compara texto plano; usamos bcrypt e o login foi ajustado para aceitar ambos)
      const senhaHash = await bcrypt.hash(String(senha), 10);
      const novoUserRow = (await db.execute(sql`
        INSERT INTO usuarios (nome, email, senha_hash, telefone, empresa_id, papel, ativo, indicado_por)
        VALUES (${nome.trim()}, ${emailFinal}, ${senhaHash}, ${telefoneNum}, ${empresaId}, 'parceiro', true, ${cod})
        RETURNING id
      `)).rows as any[];
      // Gera codigo_referral imediatamente para que o link de afiliado apareça
      // no PDV (ReferralShareCard) sem precisar reiniciar o servidor.
      const novoUserId = novoUserRow[0]?.id;
      if (novoUserId) {
        const codRef = gerarCodigo(nome, novoUserId);
        await db.execute(sql`UPDATE usuarios SET codigo_referral = ${codRef} WHERE id = ${novoUserId} AND codigo_referral IS NULL`);
      }
      if (categoria === "servicos") {
        contaLogin = telefoneNum;
        redirectTo = "app";
      } else {
        contaLogin = emailFinal;
        redirectTo = "pdv";
      }
    }

    // Registra a indicação e incrementa contador
    await db.execute(sql`
      INSERT INTO afiliado_indicacoes (afiliado_id, nome_indicado, email_indicado, tipo_indicado, tipo_dispositivo, status, bonus_valor)
      VALUES (${afiliadoId}, ${nome.trim()}, ${email?.trim() || null}, ${categoria}, ${redirectTo}, 'pendente', 0)
    `);
    await db.execute(sql`UPDATE afiliados SET total_indicados = total_indicados + 1 WHERE id = ${afiliadoId}`);

    return res.json({ ok: true, redirect_to: redirectTo, login: contaLogin, afiliado_nome: afiliadoNome });
  } catch (err: any) {
    console.error("afiliados/cadastrar-indicado err:", err);
    return res.status(500).json({ error: "server_error", message: err?.message ?? "erro" });
  }
});

// ── PUBLIC: POST /api/afiliados/registrar-indicacao ──────────────────────────
router.post("/registrar-indicacao", async (req, res) => {
  try {
    const { codigo, nome_indicado, email_indicado, tipo_indicado, tipo_dispositivo } = req.body;
    if (!codigo) return res.status(400).json({ error: "Código inválido" });

    const afiliadoRows = (await db.execute(sql`
      SELECT * FROM afiliados WHERE UPPER(codigo) = UPPER(${codigo}) AND status = 'ativo'
    `)).rows as any[];

    if (!afiliadoRows.length) return res.status(404).json({ error: "Código não encontrado" });
    const afiliado = afiliadoRows[0];

    await db.execute(sql`
      INSERT INTO afiliado_indicacoes (afiliado_id, nome_indicado, email_indicado, tipo_indicado, tipo_dispositivo, status, bonus_valor)
      VALUES (${afiliado.id}, ${nome_indicado ?? "Novo usuário"}, ${email_indicado ?? null}, ${tipo_indicado ?? "usuario"}, ${tipo_dispositivo ?? null}, 'pendente', 0)
    `);

    await db.execute(sql`UPDATE afiliados SET total_indicados = total_indicados + 1 WHERE id = ${afiliado.id}`);

    return res.json({ ok: true, afiliado_nome: afiliado.nome ?? "" });
  } catch (err) { return res.status(500).json({ error: "server_error" }); }
});

export default router;
