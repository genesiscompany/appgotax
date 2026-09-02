import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const router: IRouter = Router();

// IMPORTANTE: mesmos defaults usados em routes/admin.ts e routes/afiliados.ts
// para que tokens emitidos por aqueles módulos validem aqui mesmo sem JWT_SECRET.
const JWT_SECRET_AFIL = process.env.JWT_SECRET || "afiliados-gotaxi-secret-2024";
const JWT_SECRET_ADMIN = process.env["JWT_SECRET"] || "gotaxi-admin-secret-2024";

function requireAdmin(req: any, res: any): boolean {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) { res.status(401).json({ error: "unauthorized" }); return false; }
  try {
    const payload = jwt.verify(token, JWT_SECRET_ADMIN) as any;
    if (payload.papel !== "admin") { res.status(403).json({ error: "forbidden" }); return false; }
    return true;
  } catch { res.status(401).json({ error: "invalid_token" }); return false; }
}

function getAfiliadoId(req: any): number | null {
  const auth = req.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET_AFIL) as any;
    return payload.afiliadoId ?? null;
  } catch { return null; }
}

function s(v: any): string | null {
  if (v === undefined || v === null) return null;
  const t = String(v).trim();
  return t.length ? t : null;
}

function n(v: any): number | null {
  if (v === undefined || v === null || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function gerarSenha(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function gerarCodigoEmpresa(nome: string): string {
  const base = String(nome || "EMP").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  return `${base || "EMP"}-${Date.now().toString(36).toUpperCase()}`;
}

// ── POST /api/corporativo-cadastro/cadastrar ─────────────────────────────────
// Cadastro público: pode vir do admin (sem token afiliado) ou do afiliados-hub
// (com Bearer token afiliado — registra automaticamente quem indicou).
router.post("/cadastrar", async (req, res) => {
  try {
    const b = req.body ?? {};
    const nomeFantasia = s(b.nomeFantasia);
    const cnpj = s(b.cnpj);
    const emailEmpresa = s(b.emailEmpresa);

    if (!nomeFantasia || !cnpj || !emailEmpresa) {
      return res.status(400).json({
        error: "bad_request",
        message: "Nome fantasia, CNPJ e e-mail da empresa são obrigatórios",
      });
    }

    const afiliadoIdToken = getAfiliadoId(req);
    const origemRaw = String(b.origem || (afiliadoIdToken ? "afiliado" : "admin")).toLowerCase();
    const origem = origemRaw === "afiliado" ? "afiliado" : "admin";
    const afiliadoId = origem === "afiliado" ? afiliadoIdToken : null;

    const rows = await db.execute(sql`
      INSERT INTO empresas_corporativas_pendentes (
        nome_fantasia, razao_social, cnpj,
        email_empresa, telefone_empresa,
        cep, endereco_rua, endereco_numero, endereco_complemento,
        endereco_bairro, endereco_cidade, endereco_estado,
        responsavel_nome, responsavel_cpf, responsavel_cargo,
        responsavel_email, responsavel_telefone,
        qtde_funcionarios, limite_credito, observacoes,
        origem, afiliado_id, status
      ) VALUES (
        ${nomeFantasia}, ${s(b.razaoSocial)}, ${cnpj},
        ${emailEmpresa}, ${s(b.telefoneEmpresa)},
        ${s(b.cep)}, ${s(b.enderecoRua)}, ${s(b.enderecoNumero)}, ${s(b.enderecoComplemento)},
        ${s(b.enderecoBairro)}, ${s(b.enderecoCidade)}, ${s(b.enderecoEstado)},
        ${s(b.responsavelNome)}, ${s(b.responsavelCpf)}, ${s(b.responsavelCargo)},
        ${s(b.responsavelEmail)}, ${s(b.responsavelTelefone)},
        ${n(b.qtdeFuncionarios)}, ${n(b.limiteCredito) ?? 0}, ${s(b.observacoes)},
        ${origem}, ${afiliadoId}, 'pendente'
      )
      RETURNING id, nome_fantasia, status, criado_em
    `);

    return res.status(201).json({
      ok: true,
      message: "Cadastro recebido. Aguardando aprovação do super admin.",
      cadastro: rows.rows[0],
    });
  } catch (err: any) {
    console.error("corporativo-cadastro/cadastrar err:", err);
    return res.status(500).json({ error: "server_error", message: err?.message || "Erro interno" });
  }
});

// ── GET /api/corporativo-cadastro/admin/list ─────────────────────────────────
router.get("/admin/list", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const status = String(req.query.status || "").toLowerCase();
    const where = status && ["pendente", "aprovado", "rejeitado"].includes(status)
      ? sql`WHERE c.status = ${status}`
      : sql``;
    const rows = await db.execute(sql`
      SELECT
        c.*,
        u.nome AS afiliado_nome,
        u.email AS afiliado_email
      FROM empresas_corporativas_pendentes c
      LEFT JOIN afiliados a ON a.id = c.afiliado_id
      LEFT JOIN usuarios u ON u.id = a.usuario_id
      ${where}
      ORDER BY c.criado_em DESC
    `);
    return res.json(rows.rows);
  } catch (err: any) {
    console.error("corporativo-cadastro/admin/list err:", err);
    return res.status(500).json({ error: "server_error", message: err?.message });
  }
});

// ── POST /api/corporativo-cadastro/admin/:id/aprovar ─────────────────────────
// Cria empresa real, ativa módulo "motorista", cria usuário admin do PDV
// com login = email_empresa e senha gerada (ou enviada no body).
router.post("/admin/:id/aprovar", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "invalid_id" });

  try {
    const cad = (await db.execute(sql`
      SELECT * FROM empresas_corporativas_pendentes WHERE id = ${id}
    `)).rows[0] as any;
    if (!cad) return res.status(404).json({ error: "not_found" });
    if (cad.status !== "pendente") {
      return res.status(409).json({
        error: "already_decided",
        message: cad.status === "aprovado" ? "Cadastro já foi aprovado." : "Cadastro já foi rejeitado.",
      });
    }

    const loginPdv = String(req.body?.loginPdv || cad.email_empresa).trim();
    const senhaPdv = String(req.body?.senhaPdv || gerarSenha()).trim();

    // Verifica e-mail (login) único em usuarios
    const existing = (await db.execute(sql`
      SELECT id FROM usuarios WHERE email = ${loginPdv} LIMIT 1
    `)).rows[0] as any;
    if (existing) {
      return res.status(400).json({
        error: "email_in_use",
        message: `O e-mail "${loginPdv}" já está em uso. Informe outro login PDV.`,
      });
    }

    const codigo = gerarCodigoEmpresa(cad.nome_fantasia);
    const enderecoCompleto = [
      cad.endereco_rua,
      cad.endereco_numero,
      cad.endereco_bairro,
      cad.endereco_cidade,
      cad.endereco_estado,
    ].filter(Boolean).join(", ");
    const adminId = (req as any).adminId ?? null;
    const senhaHash = await bcrypt.hash(senhaPdv, 10);

    // ── Aprovação ATÔMICA: transação + lock + condição idempotente ──────────
    // Garante que duas aprovações concorrentes não criem empresa/usuário em duplicidade.
    let empresaInsert: any = null;
    let usuarioInsert: any = null;

    try {
      await db.transaction(async (tx) => {
        const lockRows = (await tx.execute(sql`
          SELECT id, status FROM empresas_corporativas_pendentes
          WHERE id = ${id}
          FOR UPDATE
        `)).rows as any[];
        if (!lockRows[0]) throw new Error("not_found");
        if (lockRows[0].status !== "pendente") throw new Error("already_decided");

        empresaInsert = (await tx.execute(sql`
          INSERT INTO empresas (
            nome, codigo, plano, cor_primaria, ativo,
            responsavel, email, telefone, endereco, cnpj, modulos_ativos
          ) VALUES (
            ${cad.nome_fantasia}, ${codigo}, 'corporativo', '#FF6B35', true,
            ${cad.responsavel_nome}, ${cad.email_empresa}, ${cad.telefone_empresa},
            ${enderecoCompleto || null}, ${cad.cnpj}, ${JSON.stringify(["motorista"])}::jsonb
          )
          RETURNING id, nome, codigo
        `)).rows[0];

        usuarioInsert = (await tx.execute(sql`
          INSERT INTO usuarios (nome, email, senha_hash, telefone, papel, empresa_id, ativo)
          VALUES (
            ${cad.responsavel_nome || cad.nome_fantasia},
            ${loginPdv},
            ${senhaHash},
            ${cad.responsavel_telefone || cad.telefone_empresa},
            'parceiro',
            ${empresaInsert.id},
            true
          )
          RETURNING id, nome, email
        `)).rows[0];

        // Senha em texto NÃO é persistida — só o login fica registrado.
        // O super admin recebe a senha em texto UMA vez na resposta abaixo.
        await tx.execute(sql`
          UPDATE empresas_corporativas_pendentes
          SET status = 'aprovado',
              empresa_id_aprovada = ${empresaInsert.id},
              usuario_id_aprovado = ${usuarioInsert.id},
              login_pdv = ${loginPdv},
              senha_pdv = NULL,
              decidido_em = NOW(),
              decidido_por = ${adminId}
          WHERE id = ${id} AND status = 'pendente'
        `);
      });
    } catch (txErr: any) {
      if (txErr?.message === "not_found") return res.status(404).json({ error: "not_found" });
      if (txErr?.message === "already_decided") {
        return res.status(409).json({ error: "already_decided", message: "Cadastro já foi decidido por outro administrador." });
      }
      throw txErr;
    }

    return res.json({
      ok: true,
      message: "Empresa aprovada com sucesso!",
      empresa: empresaInsert,
      acessoPdv: { login: loginPdv, senha: senhaPdv },
    });
  } catch (err: any) {
    console.error("corporativo-cadastro/admin/aprovar err:", err);
    return res.status(500).json({ error: "server_error", message: err?.message });
  }
});

// ── POST /api/corporativo-cadastro/admin/:id/rejeitar ────────────────────────
router.post("/admin/:id/rejeitar", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "invalid_id" });
  try {
    const motivo = s(req.body?.motivo) || "Cadastro não aprovado pelo super admin.";
    const rows = await db.execute(sql`
      UPDATE empresas_corporativas_pendentes
      SET status = 'rejeitado',
          motivo_rejeicao = ${motivo},
          decidido_em = NOW()
      WHERE id = ${id}
      RETURNING id, status
    `);
    if (!rows.rows[0]) return res.status(404).json({ error: "not_found" });
    return res.json({ ok: true, cadastro: rows.rows[0] });
  } catch (err: any) {
    console.error("corporativo-cadastro/admin/rejeitar err:", err);
    return res.status(500).json({ error: "server_error", message: err?.message });
  }
});

// ── GET /api/corporativo-cadastro/afiliado/meus ──────────────────────────────
router.get("/afiliado/meus", async (req, res) => {
  const afiliadoId = getAfiliadoId(req);
  if (!afiliadoId) return res.status(401).json({ error: "unauthorized" });
  try {
    const rows = await db.execute(sql`
      SELECT id, nome_fantasia, cnpj, email_empresa, status, criado_em,
             decidido_em, motivo_rejeicao
      FROM empresas_corporativas_pendentes
      WHERE afiliado_id = ${afiliadoId}
      ORDER BY criado_em DESC
    `);
    return res.json(rows.rows);
  } catch (err: any) {
    console.error("corporativo-cadastro/afiliado/meus err:", err);
    return res.status(500).json({ error: "server_error", message: err?.message });
  }
});

export default router;
