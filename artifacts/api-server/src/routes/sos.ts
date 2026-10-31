import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { buildPixBrCode } from "../lib/pixBrCode";
import { normalizarTelefone } from "../lib/telefone";
import {
  ensureSosSchema, cnpjValido, somenteDigitos,
  SOS_CATEGORIAS, SOS_PRIORIDADES, SOS_STATUS_RECUPERANDO, SOS_ORIGENS,
} from "../lib/sos";

const router: IRouter = Router();
const SOS_SECRET = process.env["JWT_SECRET"] || "gotaxi-sos-secret-2024";
const ADMIN_SECRET = process.env["JWT_SECRET"] || "gotaxi-admin-secret-2024";

router.use(async (_req, res, next) => {
  try { await ensureSosSchema(); next(); }
  catch (e) { console.error("[sos] schema", e); res.status(500).json({ error: "server_error" }); }
});

function bearer(req: Request): string | null {
  const auth = req.headers.authorization;
  return auth?.startsWith("Bearer ") ? auth.slice(7) : null;
}

function requireCentro(req: Request, res: Response): number | null {
  const token = bearer(req);
  if (!token) { res.status(401).json({ error: "unauthorized" }); return null; }
  try {
    const p = jwt.verify(token, SOS_SECRET) as any;
    if (p.tipo !== "sos_centro" || !p.sosCentroId) throw new Error("tipo");
    return Number(p.sosCentroId);
  } catch { res.status(401).json({ error: "invalid_token" }); return null; }
}

function requireAdmin(req: Request, res: Response): number | null {
  const token = bearer(req);
  if (!token) { res.status(401).json({ error: "unauthorized" }); return null; }
  try {
    const p = jwt.verify(token, ADMIN_SECRET) as any;
    if (p.papel !== "admin") { res.status(403).json({ error: "forbidden" }); return null; }
    return Number(p.id) || 0;
  } catch { res.status(401).json({ error: "invalid_token" }); return null; }
}

const txt = (v: unknown, max = 500) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
};
const int = (v: unknown) => {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows as any[];

function falha(res: Response, e: unknown) {
  console.error("[sos]", e);
  res.status(500).json({ error: "server_error" });
}

async function lerConfigPix() {
  const r = await rows(sql`SELECT chave, valor FROM configuracoes_sistema WHERE chave IN ('sos_pix_chave','sos_pix_nome','sos_pix_cidade','sos_texto')`);
  const m: Record<string, string> = {};
  for (const x of r) m[x.chave] = x.valor;
  return { chave: m.sos_pix_chave || "", nome: m.sos_pix_nome || "GOTAXI SOS", cidade: m.sos_pix_cidade || "BRASIL", texto: m.sos_texto || "" };
}

function camposCentro(b: any) {
  return {
    razao_social: txt(b.razao_social, 200),
    nome_fantasia: txt(b.nome_fantasia, 200),
    endereco: txt(b.endereco, 300),
    cidade: txt(b.cidade, 100),
    uf: txt(b.uf, 2)?.toUpperCase() ?? null,
    telefone: b.telefone ? normalizarTelefone(String(b.telefone)) : null,
    descricao: txt(b.descricao, 2000),
    necessidades: txt(b.necessidades, 2000),
    quantidade_recuperandos: int(b.quantidade_recuperandos) ?? 0,
    banco_nome: txt(b.banco_nome, 100),
    banco_agencia: txt(b.banco_agencia, 20),
    banco_conta: txt(b.banco_conta, 30),
    banco_tipo_conta: txt(b.banco_tipo_conta, 20),
    banco_titular: txt(b.banco_titular, 200),
    banco_chave_pix: txt(b.banco_chave_pix, 120),
  };
}

const CENTRO_PUBLICO = sql`id, razao_social, nome_fantasia, cnpj, endereco, cidade, uf, telefone, email, descricao, necessidades,
  quantidade_recuperandos, banco_nome, banco_agencia, banco_conta, banco_tipo_conta, banco_titular, banco_chave_pix,
  status, motivo_status, criado_em`;

// ── Centro: cadastro e login ─────────────────────────────────────────────────
router.post("/centros/cadastro", async (req, res) => {
  try {
    const b = req.body ?? {};
    const c = camposCentro(b);
    const cnpj = somenteDigitos(b.cnpj);
    const email = String(b.email ?? "").trim().toLowerCase();
    const senha = String(b.senha ?? "");
    if (!c.razao_social) return void res.status(400).json({ error: "Informe a razão social." });
    if (!cnpjValido(cnpj)) return void res.status(400).json({ error: "CNPJ inválido." });
    if (!c.endereco) return void res.status(400).json({ error: "Informe o endereço." });
    if (!c.telefone || c.telefone.length < 10) return void res.status(400).json({ error: "Informe o telefone/WhatsApp com DDD." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return void res.status(400).json({ error: "E-mail inválido." });
    if (senha.length < 6) return void res.status(400).json({ error: "A senha precisa ter pelo menos 6 caracteres." });
    const dup = await rows(sql`SELECT cnpj, email FROM sos_centros WHERE cnpj = ${cnpj} OR LOWER(email) = ${email} LIMIT 1`);
    if (dup.length) return void res.status(409).json({ error: dup[0].cnpj === cnpj ? "CNPJ já cadastrado." : "E-mail já cadastrado." });
    const hash = await bcrypt.hash(senha, 10);
    const [centro] = await rows(sql`
      INSERT INTO sos_centros (razao_social, nome_fantasia, cnpj, endereco, cidade, uf, telefone, email, senha_hash, descricao,
        necessidades, quantidade_recuperandos, banco_nome, banco_agencia, banco_conta, banco_tipo_conta, banco_titular, banco_chave_pix)
      VALUES (${c.razao_social}, ${c.nome_fantasia}, ${cnpj}, ${c.endereco}, ${c.cidade}, ${c.uf}, ${c.telefone}, ${email}, ${hash},
        ${c.descricao}, ${c.necessidades}, ${c.quantidade_recuperandos}, ${c.banco_nome}, ${c.banco_agencia}, ${c.banco_conta},
        ${c.banco_tipo_conta}, ${c.banco_titular}, ${c.banco_chave_pix})
      RETURNING ${CENTRO_PUBLICO}`);
    const token = jwt.sign({ sosCentroId: centro.id, tipo: "sos_centro" }, SOS_SECRET, { expiresIn: "30d" });
    res.status(201).json({ token, centro });
  } catch (e) { falha(res, e); }
});

router.post("/centros/login", async (req, res) => {
  try {
    const ident = String(req.body?.email ?? "").trim().toLowerCase();
    const senha = String(req.body?.senha ?? "");
    if (!ident || !senha) return void res.status(400).json({ error: "Informe e-mail (ou CNPJ) e senha." });
    const cnpj = somenteDigitos(ident);
    const [c] = await rows(sql`SELECT id, senha_hash, status FROM sos_centros
      WHERE LOWER(email) = ${ident} OR (${cnpj.length === 14} AND cnpj = ${cnpj}) LIMIT 1`);
    if (!c || !(await bcrypt.compare(senha, c.senha_hash))) return void res.status(401).json({ error: "E-mail ou senha inválidos." });
    if (c.status === "bloqueado") return void res.status(403).json({ error: "Cadastro bloqueado. Fale com a GoTaxi." });
    const [centro] = await rows(sql`SELECT ${CENTRO_PUBLICO} FROM sos_centros WHERE id = ${c.id}`);
    const token = jwt.sign({ sosCentroId: c.id, tipo: "sos_centro" }, SOS_SECRET, { expiresIn: "30d" });
    res.json({ token, centro });
  } catch (e) { falha(res, e); }
});

// ── Centro: área logada ──────────────────────────────────────────────────────
router.get("/centro/me", async (req, res) => {
  const id = requireCentro(req, res); if (!id) return;
  try {
    const [centro] = await rows(sql`SELECT ${CENTRO_PUBLICO} FROM sos_centros WHERE id = ${id}`);
    if (!centro) return void res.status(404).json({ error: "not_found" });
    const [stats] = await rows(sql`SELECT
      (SELECT COUNT(*) FROM sos_recuperandos WHERE centro_id = ${id})::int AS recuperandos,
      (SELECT COUNT(*) FROM sos_necessidades WHERE centro_id = ${id} AND status = 'aberta')::int AS necessidades_abertas,
      (SELECT COUNT(*) FROM sos_doacoes WHERE centro_id = ${id} AND tipo = 'item' AND status = 'informada')::int AS itens_a_receber,
      (SELECT COALESCE(SUM(valor),0) FROM sos_distribuicoes WHERE centro_id = ${id})::float AS total_recebido`);
    res.json({ centro, stats });
  } catch (e) { falha(res, e); }
});

router.patch("/centro/me", async (req, res) => {
  const id = requireCentro(req, res); if (!id) return;
  try {
    const c = camposCentro(req.body ?? {});
    if (!c.razao_social || !c.endereco || !c.telefone) return void res.status(400).json({ error: "Razão social, endereço e telefone são obrigatórios." });
    const [centro] = await rows(sql`UPDATE sos_centros SET
      razao_social = ${c.razao_social}, nome_fantasia = ${c.nome_fantasia}, endereco = ${c.endereco}, cidade = ${c.cidade}, uf = ${c.uf},
      telefone = ${c.telefone}, descricao = ${c.descricao}, necessidades = ${c.necessidades},
      quantidade_recuperandos = ${c.quantidade_recuperandos}, banco_nome = ${c.banco_nome}, banco_agencia = ${c.banco_agencia},
      banco_conta = ${c.banco_conta}, banco_tipo_conta = ${c.banco_tipo_conta}, banco_titular = ${c.banco_titular},
      banco_chave_pix = ${c.banco_chave_pix}, atualizado_em = NOW()
      WHERE id = ${id} RETURNING ${CENTRO_PUBLICO}`);
    res.json(centro);
  } catch (e) { falha(res, e); }
});

router.patch("/centro/senha", async (req, res) => {
  const id = requireCentro(req, res); if (!id) return;
  try {
    const { senhaAtual, novaSenha } = req.body ?? {};
    if (String(novaSenha ?? "").length < 6) return void res.status(400).json({ error: "A nova senha precisa ter pelo menos 6 caracteres." });
    const [c] = await rows(sql`SELECT senha_hash FROM sos_centros WHERE id = ${id}`);
    if (!c || !(await bcrypt.compare(String(senhaAtual ?? ""), c.senha_hash))) return void res.status(400).json({ error: "Senha atual incorreta." });
    await db.execute(sql`UPDATE sos_centros SET senha_hash = ${await bcrypt.hash(String(novaSenha), 10)}, atualizado_em = NOW() WHERE id = ${id}`);
    res.json({ ok: true });
  } catch (e) { falha(res, e); }
});

function camposRecuperando(b: any) {
  const status = SOS_STATUS_RECUPERANDO.includes(b.status) ? b.status : "em_tratamento";
  const doc = somenteDigitos(b.documento);
  return {
    nome: txt(b.nome, 200),
    idade: int(b.idade),
    documento: doc ? doc.slice(0, 20) : null,
    motivo_internacao: txt(b.motivo_internacao, 2000),
    status,
    progressao: txt(b.progressao, 4000),
    data_entrada: /^\d{4}-\d{2}-\d{2}$/.test(String(b.data_entrada ?? "")) ? String(b.data_entrada) : null,
  };
}

router.get("/centro/recuperandos", async (req, res) => {
  const id = requireCentro(req, res); if (!id) return;
  try {
    res.json(await rows(sql`SELECT * FROM sos_recuperandos WHERE centro_id = ${id} ORDER BY criado_em DESC`));
  } catch (e) { falha(res, e); }
});

router.post("/centro/recuperandos", async (req, res) => {
  const id = requireCentro(req, res); if (!id) return;
  try {
    const r = camposRecuperando(req.body ?? {});
    if (!r.nome) return void res.status(400).json({ error: "Informe o nome." });
    const [novo] = await rows(sql`INSERT INTO sos_recuperandos (centro_id, nome, idade, documento, motivo_internacao, status, progressao, data_entrada)
      VALUES (${id}, ${r.nome}, ${r.idade}, ${r.documento}, ${r.motivo_internacao}, ${r.status}, ${r.progressao}, ${r.data_entrada})
      RETURNING *`);
    res.status(201).json(novo);
  } catch (e) { falha(res, e); }
});

router.put("/centro/recuperandos/:rid", async (req, res) => {
  const id = requireCentro(req, res); if (!id) return;
  try {
    const r = camposRecuperando(req.body ?? {});
    if (!r.nome) return void res.status(400).json({ error: "Informe o nome." });
    const [up] = await rows(sql`UPDATE sos_recuperandos SET nome = ${r.nome}, idade = ${r.idade}, documento = ${r.documento},
      motivo_internacao = ${r.motivo_internacao}, status = ${r.status}, progressao = ${r.progressao}, data_entrada = ${r.data_entrada},
      atualizado_em = NOW()
      WHERE id = ${Number(req.params.rid)} AND centro_id = ${id} RETURNING *`);
    if (!up) return void res.status(404).json({ error: "not_found" });
    res.json(up);
  } catch (e) { falha(res, e); }
});

router.delete("/centro/recuperandos/:rid", async (req, res) => {
  const id = requireCentro(req, res); if (!id) return;
  try {
    const r = await rows(sql`DELETE FROM sos_recuperandos WHERE id = ${Number(req.params.rid)} AND centro_id = ${id} RETURNING id`);
    if (!r.length) return void res.status(404).json({ error: "not_found" });
    res.json({ ok: true });
  } catch (e) { falha(res, e); }
});

async function camposNecessidade(b: any, centroId: number) {
  let recuperandoId = int(b.recuperando_id);
  if (recuperandoId) {
    const ok = await rows(sql`SELECT 1 FROM sos_recuperandos WHERE id = ${recuperandoId} AND centro_id = ${centroId}`);
    if (!ok.length) recuperandoId = null;
  }
  return {
    titulo: txt(b.titulo, 200),
    descricao: txt(b.descricao, 2000),
    categoria: SOS_CATEGORIAS.includes(b.categoria) ? b.categoria : "outros",
    quantidade: txt(b.quantidade, 100),
    prioridade: SOS_PRIORIDADES.includes(b.prioridade) ? b.prioridade : "media",
    status: b.status === "atendida" ? "atendida" : "aberta",
    recuperando_id: recuperandoId,
  };
}

router.get("/centro/necessidades", async (req, res) => {
  const id = requireCentro(req, res); if (!id) return;
  try {
    res.json(await rows(sql`SELECT n.*, r.nome AS recuperando_nome FROM sos_necessidades n
      LEFT JOIN sos_recuperandos r ON r.id = n.recuperando_id
      WHERE n.centro_id = ${id} ORDER BY (n.status = 'aberta') DESC, n.criado_em DESC`));
  } catch (e) { falha(res, e); }
});

router.post("/centro/necessidades", async (req, res) => {
  const id = requireCentro(req, res); if (!id) return;
  try {
    const n = await camposNecessidade(req.body ?? {}, id);
    if (!n.titulo) return void res.status(400).json({ error: "Informe o que o centro precisa." });
    const [novo] = await rows(sql`INSERT INTO sos_necessidades (centro_id, recuperando_id, titulo, descricao, categoria, quantidade, prioridade, status)
      VALUES (${id}, ${n.recuperando_id}, ${n.titulo}, ${n.descricao}, ${n.categoria}, ${n.quantidade}, ${n.prioridade}, ${n.status})
      RETURNING *`);
    res.status(201).json(novo);
  } catch (e) { falha(res, e); }
});

router.put("/centro/necessidades/:nid", async (req, res) => {
  const id = requireCentro(req, res); if (!id) return;
  try {
    const n = await camposNecessidade(req.body ?? {}, id);
    if (!n.titulo) return void res.status(400).json({ error: "Informe o que o centro precisa." });
    const [up] = await rows(sql`UPDATE sos_necessidades SET recuperando_id = ${n.recuperando_id}, titulo = ${n.titulo},
      descricao = ${n.descricao}, categoria = ${n.categoria}, quantidade = ${n.quantidade}, prioridade = ${n.prioridade}, status = ${n.status}
      WHERE id = ${Number(req.params.nid)} AND centro_id = ${id} RETURNING *`);
    if (!up) return void res.status(404).json({ error: "not_found" });
    res.json(up);
  } catch (e) { falha(res, e); }
});

router.delete("/centro/necessidades/:nid", async (req, res) => {
  const id = requireCentro(req, res); if (!id) return;
  try {
    const r = await rows(sql`DELETE FROM sos_necessidades WHERE id = ${Number(req.params.nid)} AND centro_id = ${id} RETURNING id`);
    if (!r.length) return void res.status(404).json({ error: "not_found" });
    res.json({ ok: true });
  } catch (e) { falha(res, e); }
});

router.get("/centro/doacoes", async (req, res) => {
  const id = requireCentro(req, res); if (!id) return;
  try {
    const itens = await rows(sql`SELECT d.id, d.descricao, d.doador_nome, d.doador_contato, d.status, d.criado_em, n.titulo AS necessidade
      FROM sos_doacoes d LEFT JOIN sos_necessidades n ON n.id = d.necessidade_id
      WHERE d.centro_id = ${id} AND d.tipo = 'item' ORDER BY d.criado_em DESC LIMIT 200`);
    const repasses = await rows(sql`SELECT id, valor::float AS valor, observacao, criado_em FROM sos_distribuicoes
      WHERE centro_id = ${id} ORDER BY criado_em DESC LIMIT 200`);
    res.json({ itens, repasses });
  } catch (e) { falha(res, e); }
});

router.patch("/centro/doacoes/:did", async (req, res) => {
  const id = requireCentro(req, res); if (!id) return;
  try {
    const status = req.body?.status === "recebida" ? "recebida" : req.body?.status === "nao_recebida" ? "nao_recebida" : null;
    if (!status) return void res.status(400).json({ error: "status inválido" });
    const r = await rows(sql`UPDATE sos_doacoes SET status = ${status}
      WHERE id = ${Number(req.params.did)} AND centro_id = ${id} AND tipo = 'item' RETURNING id`);
    if (!r.length) return void res.status(404).json({ error: "not_found" });
    res.json({ ok: true });
  } catch (e) { falha(res, e); }
});

// ── Público (apps, PDV e site) ───────────────────────────────────────────────
router.get("/publico/centros", async (_req, res) => {
  try {
    const centros = await rows(sql`SELECT id, COALESCE(nome_fantasia, razao_social) AS nome, cidade, uf, descricao, necessidades,
      quantidade_recuperandos FROM sos_centros WHERE status = 'aprovado' ORDER BY razao_social`);
    const ids = centros.map((c) => Number(c.id));
    const necessidades = ids.length ? await rows(sql`
      SELECT n.id, n.centro_id, n.titulo, n.descricao, n.categoria, n.quantidade, n.prioridade,
        CASE WHEN r.id IS NULL THEN NULL ELSE 'Recuperando #' || r.id END AS recuperando,
        r.idade AS recuperando_idade
      FROM sos_necessidades n LEFT JOIN sos_recuperandos r ON r.id = n.recuperando_id
      WHERE n.status = 'aberta' AND n.centro_id IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})
      ORDER BY CASE n.prioridade WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END, n.criado_em DESC`) : [];
    res.json(centros.map((c) => ({ ...c, necessidades_lista: necessidades.filter((n) => Number(n.centro_id) === Number(c.id)) })));
  } catch (e) { falha(res, e); }
});

router.get("/publico/pix", async (req, res) => {
  try {
    const cfg = await lerConfigPix();
    if (!cfg.chave) return void res.json({ configurado: false, texto: cfg.texto });
    const valor = Number(String(req.query.valor ?? "").replace(",", "."));
    const v = Number.isFinite(valor) && valor > 0 && valor <= 100000 ? Math.round(valor * 100) / 100 : undefined;
    const brcode = buildPixBrCode({ chave: cfg.chave, nomeBeneficiario: cfg.nome, cidade: cfg.cidade, valor: v, txid: "SOSGOTAXI" });
    res.json({ configurado: true, chave: cfg.chave, nome: cfg.nome, cidade: cfg.cidade, texto: cfg.texto, valor: v ?? null, brcode });
  } catch (e) { falha(res, e); }
});

const limiteDoacao = new Map<string, number[]>();
function excedeuLimite(ip: string) {
  const agora = Date.now();
  const lista = (limiteDoacao.get(ip) ?? []).filter((t) => agora - t < 60 * 60 * 1000);
  lista.push(agora);
  limiteDoacao.set(ip, lista);
  return lista.length > 30;
}

router.post("/publico/doacoes", async (req, res) => {
  try {
    if (excedeuLimite(String(req.ip ?? ""))) return void res.status(429).json({ error: "Muitas doações seguidas. Tente mais tarde." });
    const b = req.body ?? {};
    const tipo = b.tipo === "item" ? "item" : b.tipo === "dinheiro" ? "dinheiro" : null;
    if (!tipo) return void res.status(400).json({ error: "Tipo de doação inválido." });
    const origem = SOS_ORIGENS.includes(b.origem) ? b.origem : "site";
    let centroId = int(b.centro_id);
    let necessidadeId = int(b.necessidade_id);
    if (necessidadeId) {
      const [n] = await rows(sql`SELECT n.centro_id FROM sos_necessidades n JOIN sos_centros c ON c.id = n.centro_id
        WHERE n.id = ${necessidadeId} AND c.status = 'aprovado'`);
      if (!n) necessidadeId = null; else centroId = Number(n.centro_id);
    }
    if (centroId) {
      const ok = await rows(sql`SELECT 1 FROM sos_centros WHERE id = ${centroId} AND status = 'aprovado'`);
      if (!ok.length) centroId = null;
    }
    let valor: number | null = null;
    const descricao = txt(b.descricao, 1000);
    if (tipo === "dinheiro") {
      valor = Number(String(b.valor ?? "").replace(",", "."));
      if (!Number.isFinite(valor) || valor <= 0 || valor > 100000) return void res.status(400).json({ error: "Informe um valor válido." });
      valor = Math.round(valor * 100) / 100;
    } else {
      if (!descricao) return void res.status(400).json({ error: "Descreva o que você vai doar." });
      if (!centroId) return void res.status(400).json({ error: "Escolha o centro que vai receber." });
    }
    const [d] = await rows(sql`INSERT INTO sos_doacoes (tipo, valor, descricao, centro_id, necessidade_id, doador_nome, doador_contato, origem)
      VALUES (${tipo}, ${valor}, ${descricao}, ${centroId}, ${necessidadeId}, ${txt(b.doador_nome, 200)}, ${txt(b.doador_contato, 200)}, ${origem})
      RETURNING id`);
    res.status(201).json({ ok: true, id: d.id });
  } catch (e) { falha(res, e); }
});

// ── Super Admin ──────────────────────────────────────────────────────────────
router.get("/admin/resumo", async (req, res) => {
  if (requireAdmin(req, res) === null) return;
  try {
    const [r] = await rows(sql`SELECT
      (SELECT COUNT(*) FROM sos_centros WHERE status = 'pendente')::int AS centros_pendentes,
      (SELECT COUNT(*) FROM sos_centros WHERE status = 'aprovado')::int AS centros_aprovados,
      (SELECT COUNT(*) FROM sos_recuperandos)::int AS recuperandos,
      (SELECT COALESCE(SUM(valor),0) FROM sos_doacoes WHERE tipo = 'dinheiro' AND status <> 'cancelada')::float AS total_informado,
      (SELECT COALESCE(SUM(valor),0) FROM sos_doacoes WHERE tipo = 'dinheiro' AND status = 'confirmada')::float AS total_confirmado,
      (SELECT COALESCE(SUM(valor),0) FROM sos_distribuicoes)::float AS total_distribuido`);
    res.json(r);
  } catch (e) { falha(res, e); }
});

router.get("/admin/centros", async (req, res) => {
  if (requireAdmin(req, res) === null) return;
  try {
    const status = ["pendente", "aprovado", "bloqueado"].includes(String(req.query.status)) ? String(req.query.status) : null;
    res.json(await rows(sql`SELECT ${CENTRO_PUBLICO},
      (SELECT COUNT(*) FROM sos_recuperandos r WHERE r.centro_id = sos_centros.id)::int AS total_recuperandos_cadastrados,
      (SELECT COUNT(*) FROM sos_necessidades n WHERE n.centro_id = sos_centros.id AND n.status = 'aberta')::int AS necessidades_abertas,
      (SELECT COALESCE(SUM(valor),0) FROM sos_distribuicoes d WHERE d.centro_id = sos_centros.id)::float AS total_distribuido
      FROM sos_centros WHERE (${status}::text IS NULL OR status = ${status})
      ORDER BY (status = 'pendente') DESC, criado_em DESC`));
  } catch (e) { falha(res, e); }
});

router.get("/admin/centros/:id", async (req, res) => {
  if (requireAdmin(req, res) === null) return;
  try {
    const cid = Number(req.params.id);
    const [centro] = await rows(sql`SELECT ${CENTRO_PUBLICO} FROM sos_centros WHERE id = ${cid}`);
    if (!centro) return void res.status(404).json({ error: "not_found" });
    const recuperandos = await rows(sql`SELECT * FROM sos_recuperandos WHERE centro_id = ${cid} ORDER BY criado_em DESC`);
    const necessidades = await rows(sql`SELECT * FROM sos_necessidades WHERE centro_id = ${cid} ORDER BY criado_em DESC`);
    res.json({ centro, recuperandos, necessidades });
  } catch (e) { falha(res, e); }
});

router.patch("/admin/centros/:id/status", async (req, res) => {
  if (requireAdmin(req, res) === null) return;
  try {
    const status = ["pendente", "aprovado", "bloqueado"].includes(req.body?.status) ? req.body.status : null;
    if (!status) return void res.status(400).json({ error: "status inválido" });
    const r = await rows(sql`UPDATE sos_centros SET status = ${status}, motivo_status = ${txt(req.body?.motivo, 500)}, atualizado_em = NOW()
      WHERE id = ${Number(req.params.id)} RETURNING id`);
    if (!r.length) return void res.status(404).json({ error: "not_found" });
    res.json({ ok: true });
  } catch (e) { falha(res, e); }
});

function periodo(req: Request) {
  const ok = (s: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s ?? "")) ? String(s) : null);
  return { de: ok(req.query.de) ?? "2000-01-01", ate: ok(req.query.ate) ?? "2100-01-01" };
}

router.get("/admin/doacoes", async (req, res) => {
  if (requireAdmin(req, res) === null) return;
  try {
    const { de, ate } = periodo(req);
    const tipo = req.query.tipo === "item" || req.query.tipo === "dinheiro" ? String(req.query.tipo) : null;
    res.json(await rows(sql`SELECT d.id, d.tipo, d.valor::float AS valor, d.descricao, d.doador_nome, d.doador_contato, d.origem,
      d.status, d.criado_em, d.centro_id, COALESCE(c.nome_fantasia, c.razao_social) AS centro, n.titulo AS necessidade
      FROM sos_doacoes d LEFT JOIN sos_centros c ON c.id = d.centro_id LEFT JOIN sos_necessidades n ON n.id = d.necessidade_id
      WHERE d.criado_em >= ${de}::date AND d.criado_em < (${ate}::date + INTERVAL '1 day')
        AND (${tipo}::text IS NULL OR d.tipo = ${tipo}::text)
      ORDER BY d.criado_em DESC LIMIT 1000`));
  } catch (e) { falha(res, e); }
});

router.patch("/admin/doacoes/:id", async (req, res) => {
  if (requireAdmin(req, res) === null) return;
  try {
    const status = ["informada", "confirmada", "cancelada", "recebida", "nao_recebida"].includes(req.body?.status) ? req.body.status : null;
    if (!status) return void res.status(400).json({ error: "status inválido" });
    const r = await rows(sql`UPDATE sos_doacoes SET status = ${status} WHERE id = ${Number(req.params.id)} RETURNING id`);
    if (!r.length) return void res.status(404).json({ error: "not_found" });
    res.json({ ok: true });
  } catch (e) { falha(res, e); }
});

router.get("/admin/doacoes.csv", async (req, res) => {
  if (requireAdmin(req, res) === null) return;
  try {
    const { de, ate } = periodo(req);
    const lista = await rows(sql`SELECT d.id, d.criado_em, d.tipo, d.valor, d.descricao, d.doador_nome, d.doador_contato, d.origem, d.status,
      COALESCE(c.nome_fantasia, c.razao_social) AS centro
      FROM sos_doacoes d LEFT JOIN sos_centros c ON c.id = d.centro_id
      WHERE d.criado_em >= ${de}::date AND d.criado_em < (${ate}::date + INTERVAL '1 day') ORDER BY d.criado_em`);
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const linhas = ["id;data;tipo;valor;descricao;doador;contato;origem;status;centro"].concat(lista.map((d) => [
      d.id, new Date(d.criado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }), d.tipo,
      d.valor != null ? String(d.valor).replace(".", ",") : "", d.descricao, d.doador_nome, d.doador_contato, d.origem, d.status, d.centro,
    ].map(esc).join(";")));
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="sos-doacoes-${de}-${ate}.csv"`);
    res.send("\uFEFF" + linhas.join("\n"));
  } catch (e) { falha(res, e); }
});

router.get("/admin/distribuicoes", async (req, res) => {
  if (requireAdmin(req, res) === null) return;
  try {
    res.json(await rows(sql`SELECT d.id, d.centro_id, d.valor::float AS valor, d.observacao, d.criado_em,
      COALESCE(c.nome_fantasia, c.razao_social) AS centro
      FROM sos_distribuicoes d JOIN sos_centros c ON c.id = d.centro_id ORDER BY d.criado_em DESC LIMIT 500`));
  } catch (e) { falha(res, e); }
});

router.post("/admin/distribuicoes", async (req, res) => {
  const adminId = requireAdmin(req, res); if (adminId === null) return;
  try {
    const centroId = int(req.body?.centro_id);
    const valor = Number(String(req.body?.valor ?? "").replace(",", "."));
    if (!centroId) return void res.status(400).json({ error: "Escolha o centro." });
    if (!Number.isFinite(valor) || valor <= 0) return void res.status(400).json({ error: "Informe um valor válido." });
    const ok = await rows(sql`SELECT 1 FROM sos_centros WHERE id = ${centroId}`);
    if (!ok.length) return void res.status(404).json({ error: "Centro não encontrado." });
    const [d] = await rows(sql`INSERT INTO sos_distribuicoes (centro_id, valor, observacao, admin_id)
      VALUES (${centroId}, ${Math.round(valor * 100) / 100}, ${txt(req.body?.observacao, 500)}, ${adminId || null}) RETURNING id`);
    res.status(201).json({ ok: true, id: d.id });
  } catch (e) { falha(res, e); }
});

router.delete("/admin/distribuicoes/:id", async (req, res) => {
  if (requireAdmin(req, res) === null) return;
  try {
    await db.execute(sql`DELETE FROM sos_distribuicoes WHERE id = ${Number(req.params.id)}`);
    res.json({ ok: true });
  } catch (e) { falha(res, e); }
});

router.get("/admin/config", async (req, res) => {
  if (requireAdmin(req, res) === null) return;
  try { res.json(await lerConfigPix()); } catch (e) { falha(res, e); }
});

router.patch("/admin/config", async (req, res) => {
  if (requireAdmin(req, res) === null) return;
  try {
    const b = req.body ?? {};
    const pares: [string, string][] = [
      ["sos_pix_chave", String(b.chave ?? "").trim().slice(0, 120)],
      ["sos_pix_nome", String(b.nome ?? "").trim().slice(0, 25)],
      ["sos_pix_cidade", String(b.cidade ?? "").trim().slice(0, 15)],
      ["sos_texto", String(b.texto ?? "").trim().slice(0, 1000)],
    ];
    for (const [chave, valor] of pares) {
      await db.execute(sql`INSERT INTO configuracoes_sistema (chave, valor) VALUES (${chave}, ${valor})
        ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor`);
    }
    res.json(await lerConfigPix());
  } catch (e) { falha(res, e); }
});

export default router;
