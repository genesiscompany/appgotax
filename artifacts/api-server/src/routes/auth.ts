import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usuariosTable, empresasTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads", "avatares");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".jpg";
      cb(null, `avatar_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Apenas imagens são aceitas"));
  },
});

const router: IRouter = Router();

router.post("/login", async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) {
      return res.status(400).json({ error: "bad_request", message: "Email e senha são obrigatórios" });
    }

    const usuario = await db.select().from(usuariosTable).where(eq(usuariosTable.email, email)).limit(1);
    if (!usuario[0]) {
      return res.status(401).json({ error: "unauthorized", message: "Credenciais inválidas" });
    }

    const empresa = await db.select().from(empresasTable).where(eq(empresasTable.id, usuario[0].empresaId)).limit(1);

    const token = Buffer.from(`${usuario[0].id}:${usuario[0].empresaId}:${Date.now()}`).toString("base64");

    return res.json({
      token,
      usuario: {
        id: usuario[0].id,
        nome: usuario[0].nome,
        email: usuario[0].email,
        telefone: usuario[0].telefone,
        avatar: usuario[0].avatar,
        papel: usuario[0].papel,
        empresaId: usuario[0].empresaId,
        ativo: usuario[0].ativo,
        criadoEm: usuario[0].criadoEm.toISOString(),
      },
      empresa: empresa[0] ? {
        id: empresa[0].id,
        nome: empresa[0].nome,
        codigo: empresa[0].codigo,
        logo: empresa[0].logo,
        corPrimaria: empresa[0].corPrimaria,
        plano: empresa[0].plano,
        modulosAtivos: empresa[0].modulosAtivos,
        ativo: empresa[0].ativo,
        criadoEm: empresa[0].criadoEm.toISOString(),
      } : null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error", message: "Erro interno" });
  }
});

router.patch("/cliente-perfil", async (req, res) => {
  try {
    const { token, nome, telefone, novaSenha, endereco, formaPagamento } = req.body;
    if (!token) return res.status(401).json({ error: "unauthorized", message: "Token obrigatório" });
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const match = decoded.match(/^cl_(\d+):/);
    if (!match) return res.status(401).json({ error: "unauthorized", message: "Token inválido" });
    const userId = Number(match[1]);

    const drizzleUpdates: Record<string, string | null> = {};
    if (nome?.trim()) drizzleUpdates.nome = nome.trim();
    if (telefone) drizzleUpdates.telefone = String(telefone).replace(/\D/g, "");
    if (novaSenha && novaSenha.length >= 4) drizzleUpdates.senhaHash = novaSenha;
    if (endereco !== undefined) drizzleUpdates.endereco = endereco || null;
    if (formaPagamento !== undefined) drizzleUpdates.formaPagamento = formaPagamento || null;

    if (Object.keys(drizzleUpdates).length === 0) {
      return res.status(400).json({ error: "bad_request", message: "Nenhum campo para atualizar" });
    }

    if (drizzleUpdates.telefone) {
      const existing = await db.select().from(usuariosTable).where(eq(usuariosTable.telefone, drizzleUpdates.telefone)).limit(1);
      if (existing[0] && existing[0].id !== userId) {
        return res.status(400).json({ error: "conflict", message: "Telefone já usado por outra conta" });
      }
    }

    await db.update(usuariosTable).set(drizzleUpdates as any).where(eq(usuariosTable.id, userId));

    const [updated] = await db.select().from(usuariosTable).where(eq(usuariosTable.id, userId)).limit(1);
    return res.json({
      usuario: {
        id: updated.id,
        nome: updated.nome,
        telefone: updated.telefone,
        avatar: updated.avatar,
        endereco: updated.endereco,
        forma_pagamento: updated.formaPagamento,
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error", message: "Erro interno" });
  }
});

router.get("/cliente-validar", async (req, res) => {
  try {
    const token = String(req.query.token || "");
    if (!token) return res.status(401).json({ error: "unauthorized", message: "Token ausente" });
    let decoded = "";
    try { decoded = Buffer.from(token, "base64").toString("utf-8"); } catch { return res.status(401).json({ error: "unauthorized" }); }
    const match = decoded.match(/^cl_(\d+):/);
    if (!match) return res.status(401).json({ error: "unauthorized", message: "Token inválido" });
    const userId = Number(match[1]);
    if (!userId || userId <= 0) return res.status(401).json({ error: "unauthorized" });
    const [usuario] = await db.select().from(usuariosTable).where(eq(usuariosTable.id, userId)).limit(1);
    if (!usuario || usuario.papel !== "cliente") return res.status(401).json({ error: "unauthorized", message: "Cadastro não encontrado" });
    const refRow = (await db.execute(sql`
      SELECT u.codigo_referral, EXISTS(SELECT 1 FROM afiliados a WHERE a.usuario_id = u.id) AS is_afiliado
      FROM usuarios u WHERE u.id = ${usuario.id}
    `)).rows[0] as any;
    return res.json({
      ok: true,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        telefone: usuario.telefone,
        avatar: usuario.avatar,
        endereco: usuario.endereco,
        forma_pagamento: usuario.formaPagamento,
        codigo_referral: refRow?.codigo_referral ?? null,
        is_afiliado: !!refRow?.is_afiliado,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error" });
  }
});

router.post("/cliente-login", async (req, res) => {
  try {
    const { telefone, senha } = req.body;
    if (!telefone || !senha) {
      return res.status(400).json({ error: "bad_request", message: "Telefone e senha são obrigatórios" });
    }
    const num = String(telefone).replace(/\D/g, "");
    const [usuario] = await db.select().from(usuariosTable)
      .where(eq(usuariosTable.telefone, num))
      .limit(1);
    if (!usuario || usuario.papel !== "cliente") {
      return res.status(401).json({ error: "unauthorized", message: "Telefone não encontrado" });
    }
    if (usuario.senhaHash !== senha) {
      return res.status(401).json({ error: "unauthorized", message: "Senha incorreta" });
    }
    const token = Buffer.from(`cl_${usuario.id}:${Date.now()}`).toString("base64");
    const referralRow = (await db.execute(sql`
      SELECT u.codigo_referral, EXISTS(SELECT 1 FROM afiliados a WHERE a.usuario_id = u.id) AS is_afiliado
      FROM usuarios u WHERE u.id = ${usuario.id}
    `)).rows[0] as any;
    return res.json({
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        telefone: usuario.telefone,
        avatar: usuario.avatar,
        endereco: usuario.endereco,
        forma_pagamento: usuario.formaPagamento,
        codigo_referral: referralRow?.codigo_referral ?? null,
        is_afiliado: !!referralRow?.is_afiliado,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error", message: "Erro interno" });
  }
});

async function ensureUsuariosReferral() {
  try {
    await db.execute(sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS codigo_referral VARCHAR(20) UNIQUE`);
    await db.execute(sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS indicado_por VARCHAR(20)`);
    await db.execute(sql`
      UPDATE usuarios SET
        codigo_referral = UPPER(LEFT(REGEXP_REPLACE(nome, '[^A-Za-z0-9]', '', 'g'), 4)) || LPAD(id::text, 4, '0')
      WHERE codigo_referral IS NULL
    `);
  } catch (_) {}
}

function gerarCodigoReferralU(nome: string, id: number): string {
  const prefix = (nome || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "GT";
  return `${prefix}${String(id).padStart(4, "0")}`;
}

router.post("/cliente-register", async (req, res) => {
  try {
    const { nome, telefone, senha, indicado_por } = req.body;
    if (!nome || !telefone || !senha) {
      return res.status(400).json({ error: "bad_request", message: "Dados obrigatórios ausentes" });
    }
    if (senha.length < 4) {
      return res.status(400).json({ error: "bad_request", message: "Senha deve ter ao menos 4 caracteres" });
    }
    await ensureUsuariosReferral();
    const num = String(telefone).replace(/\D/g, "");
    const existing = await db.select().from(usuariosTable).where(eq(usuariosTable.telefone, num)).limit(1);
    if (existing[0]) {
      return res.status(409).json({ error: "conflict", message: "Telefone já cadastrado" });
    }
    const [novoUsuario] = await db.insert(usuariosTable).values({
      nome: nome.trim(),
      email: `${num}@cliente.gotaxi`,
      senhaHash: senha,
      telefone: num,
      empresaId: 1,
      papel: "cliente",
      ativo: true,
    }).returning();
    const codigo_referral = gerarCodigoReferralU(novoUsuario.nome, novoUsuario.id);
    await db.execute(sql`UPDATE usuarios SET codigo_referral = ${codigo_referral}, indicado_por = ${indicado_por || null} WHERE id = ${novoUsuario.id} AND codigo_referral IS NULL`);
    const token = Buffer.from(`cl_${novoUsuario.id}:${Date.now()}`).toString("base64");
    return res.status(201).json({
      token,
      usuario: {
        id: novoUsuario.id,
        nome: novoUsuario.nome,
        telefone: novoUsuario.telefone,
        avatar: novoUsuario.avatar,
        endereco: novoUsuario.endereco,
        forma_pagamento: novoUsuario.formaPagamento,
        codigo_referral,
        is_afiliado: false,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error", message: "Erro interno" });
  }
});

router.post("/register", async (req, res) => {
  try {
    const { nome, email, senha, telefone, empresaId } = req.body;
    if (!nome || !email || !senha || !empresaId) {
      return res.status(400).json({ error: "bad_request", message: "Dados obrigatórios ausentes" });
    }

    const existing = await db.select().from(usuariosTable).where(eq(usuariosTable.email, email)).limit(1);
    if (existing[0]) {
      return res.status(400).json({ error: "conflict", message: "Email já cadastrado" });
    }

    const [novoUsuario] = await db.insert(usuariosTable).values({
      nome,
      email,
      senhaHash: senha,
      telefone: telefone || null,
      empresaId: Number(empresaId),
      papel: "cliente",
      ativo: true,
    }).returning();

    const empresa = await db.select().from(empresasTable).where(eq(empresasTable.id, novoUsuario.empresaId)).limit(1);
    const token = Buffer.from(`${novoUsuario.id}:${novoUsuario.empresaId}:${Date.now()}`).toString("base64");

    return res.status(201).json({
      token,
      usuario: {
        ...novoUsuario,
        criadoEm: novoUsuario.criadoEm.toISOString(),
      },
      empresa: empresa[0] ? { ...empresa[0], criadoEm: empresa[0].criadoEm.toISOString() } : null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error", message: "Erro interno" });
  }
});

// ── POST /api/auth/cliente-avatar — upload avatar ────────────────────────────
router.post("/cliente-avatar", avatarUpload.single("avatar"), async (req: any, res: any) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(401).json({ error: "unauthorized", message: "Token obrigatório" });
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const match = decoded.match(/^cl_(\d+):/);
    if (!match) return res.status(401).json({ error: "unauthorized", message: "Token inválido" });
    const userId = Number(match[1]);

    if (!req.file) return res.status(400).json({ error: "bad_request", message: "Nenhuma imagem enviada" });

    const avatarPath = `/uploads/avatares/${req.file.filename}`;

    await db.update(usuariosTable).set({ avatar: avatarPath } as any).where(eq(usuariosTable.id, userId));
    return res.json({ avatar: avatarPath });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "server_error", message: "Erro interno" });
  }
});

export default router;
