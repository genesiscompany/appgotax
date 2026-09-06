import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";
import { uploadImageToGCS } from "../lib/uploadImage";
import { finalizeServicePayment, settleServiceEarning } from "./payments";
import { issueMotoristaToken, motoristaIdFromRequest } from "../lib/motoristaToken";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { encryptToken } from "./payments";
import { gerarComissaoCliente } from "../lib/comissaoAfiliado";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `doc_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

const JWT_SECRET = process.env["JWT_SECRET"] || "gotaxi-admin-secret-2024";

async function resolveClienteComissao(usuarioId?: number | null, email?: string | null, telefone?: string | null) {
  const rows = await db.execute(sql`
    SELECT id, email, telefone FROM usuarios
    WHERE papel = 'cliente' AND (
      (${usuarioId ?? null} IS NOT NULL AND id = ${usuarioId ?? null})
      OR (${email?.trim().toLowerCase() || null} IS NOT NULL AND LOWER(email) = ${email?.trim().toLowerCase() || null})
      OR (${telefone?.replace(/\D/g, "") || null} IS NOT NULL
        AND REGEXP_REPLACE(COALESCE(telefone, ''), '\\D', '', 'g') = ${telefone?.replace(/\D/g, "") || null})
    )
    ORDER BY CASE WHEN id = ${usuarioId ?? null} THEN 0 ELSE 1 END
    LIMIT 1
  `);
  return rows.rows[0] as { id: number; email: string | null; telefone: string | null } | undefined;
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) { res.status(401).json({ error: "unauthorized" }); return; }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as any;
    if (payload.papel !== "admin") { res.status(403).json({ error: "forbidden" }); return; }
    next();
  } catch {
    res.status(401).json({ error: "invalid_token" });
  }
}

async function ensureExtraDocColumns() {
  await db.execute(sql`ALTER TABLE motoristas_app ADD COLUMN IF NOT EXISTS doc_antecedentes TEXT`);
  await db.execute(sql`ALTER TABLE motoristas_app ADD COLUMN IF NOT EXISTS doc_antecedentes_status TEXT NOT NULL DEFAULT 'pendente'`);
  await db.execute(sql`ALTER TABLE motoristas_app ADD COLUMN IF NOT EXISTS doc_rg TEXT`);
  await db.execute(sql`ALTER TABLE motoristas_app ADD COLUMN IF NOT EXISTS doc_rg_status TEXT NOT NULL DEFAULT 'pendente'`);
}

async function ensureRepassesProTable() {
  await db.execute(sql`
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
  await db.execute(sql`ALTER TABLE motoristas_app ADD COLUMN IF NOT EXISTS status_repasse TEXT NOT NULL DEFAULT 'ok'`);
  await db.execute(sql`UPDATE motoristas_app SET percentual_repasse = 3 WHERE percentual_repasse = 20`);
}

function getWeekBounds(referenceDate?: Date) {
  const now = referenceDate || new Date();
  const dayOfWeek = now.getDay();
  const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMon);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return {
    semanaInicio: monday.toISOString().split("T")[0],
    semanaFim: sunday.toISOString().split("T")[0],
    monday,
    nextMonday: new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000),
  };
}

const router: IRouter = Router();

function esc(s: string) { return String(s).replace(/'/g, "''"); }

async function ensureTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS motoristas_app (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      cpf TEXT,
      telefone TEXT NOT NULL UNIQUE,
      email TEXT,
      senha_pin TEXT,
      foto TEXT,
      status TEXT NOT NULL DEFAULT 'pendente',
      tipo_profissional TEXT NOT NULL DEFAULT 'motorista',
      cidade TEXT,
      estado TEXT,
      veiculo_marca TEXT,
      veiculo_modelo TEXT,
      veiculo_ano INTEGER,
      veiculo_cor TEXT,
      veiculo_placa TEXT,
      veiculo_tipo TEXT DEFAULT 'economico',
      tipo_veiculo TEXT DEFAULT 'economico',
      doc_cnh TEXT,
      doc_cnh_status TEXT DEFAULT 'pendente',
      doc_veiculo TEXT,
      doc_veiculo_status TEXT DEFAULT 'pendente',
      doc_selfie TEXT,
      doc_selfie_status TEXT DEFAULT 'pendente',
      ativo BOOLEAN DEFAULT true,
      percentual_repasse REAL DEFAULT 20,
      saldo REAL DEFAULT 0,
      total_ganhos REAL DEFAULT 0,
      total_corridas INTEGER DEFAULT 0,
      avaliacao_media REAL DEFAULT 0,
      criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
      atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`ALTER TABLE motoristas_app ADD COLUMN IF NOT EXISTS tipo_profissional TEXT NOT NULL DEFAULT 'motorista'`);
  await db.execute(sql`ALTER TABLE motoristas_app ADD COLUMN IF NOT EXISTS pix_tipo TEXT DEFAULT 'cpf'`);
  await db.execute(sql`ALTER TABLE motoristas_app ADD COLUMN IF NOT EXISTS pix_chave TEXT`);
  await db.execute(sql`ALTER TABLE motoristas_app ADD COLUMN IF NOT EXISTS pix_imagem_url TEXT`);
  await db.execute(sql`ALTER TABLE motoristas_app ADD COLUMN IF NOT EXISTS codigo_referral VARCHAR(20) UNIQUE`);
  await db.execute(sql`ALTER TABLE motoristas_app ADD COLUMN IF NOT EXISTS indicado_por VARCHAR(20)`);
  await db.execute(sql`ALTER TABLE motoristas_app ADD COLUMN IF NOT EXISTS aceita_pagamento_direto BOOLEAN NOT NULL DEFAULT true`);
  await db.execute(sql`ALTER TABLE motoristas_app ADD COLUMN IF NOT EXISTS aceita_pagamento_app BOOLEAN NOT NULL DEFAULT true`);
  await db.execute(sql`
    UPDATE motoristas_app SET
      codigo_referral = UPPER(LEFT(REGEXP_REPLACE(nome, '[^A-Za-z0-9]', '', 'g'), 4)) || LPAD(id::text, 4, '0')
    WHERE codigo_referral IS NULL
  `);
}

function oauthEnvironment() { return process.env.MERCADO_PAGO_OAUTH_ENVIRONMENT === "sandbox" ? "sandbox" : "production"; }
function oauthCallbackUrl() {
  const base = process.env.PUBLIC_API_BASE_URL || "https://api.gotaxi.com.br";
  if (!/^https:\/\//.test(base)) throw new Error("PUBLIC_API_BASE_URL must be an HTTPS public API URL");
  return `${base.replace(/\/$/, "")}/api/motorista-app/mercado-pago/callback`;
}
function oauthStateSecret() {
  if (!process.env.SESSION_SECRET) throw new Error("SESSION_SECRET is required for Mercado Pago OAuth");
  return process.env.SESSION_SECRET;
}
function signOauthState(motoristaId: number, nonce: string, environment: string, expiresAt: number) {
  const payload = `${motoristaId}.${nonce}.${environment}.${expiresAt}`;
  return `${payload}.${createHmac("sha256", oauthStateSecret()).update(payload).digest("base64url")}`;
}
function parseOauthState(value: string) {
  const parts = value.split(".");
  if (parts.length !== 5) return null;
  const [id, nonce, environment, expiry, signature] = parts;
  const payload = `${id}.${nonce}.${environment}.${expiry}`;
  const expected = createHmac("sha256", oauthStateSecret()).update(payload).digest("base64url");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const motoristaId = Number(id), expiresAt = Number(expiry);
  if (!Number.isInteger(motoristaId) || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now() || !nonce || !["sandbox", "production"].includes(environment)) return null;
  return { motoristaId, nonce, environment, expiresAt };
}
async function snapshotServiceCommission(tx: any, module: "motorista" | "entrega", referenceId: number, motoristaId: number) {
  const intent = await tx.execute(sql`SELECT id, payment_source, gross_amount_cents FROM payment_transactions
    WHERE module = ${module} AND reference_id = ${String(referenceId)} FOR UPDATE`);
  const payment = intent.rows[0] as any;
  if (!payment || !["mercado_pago", "wallet"].includes(String(payment.payment_source))) return;
  const driver = await tx.execute(sql`SELECT percentual_repasse FROM motoristas_app WHERE id = ${motoristaId} FOR UPDATE`);
  const row = driver.rows[0] as any;
  if (!row) throw new Error("service_driver_not_found");
  const percentage = Math.min(100, Math.max(0, Number(row.percentual_repasse ?? 0)));
  const feeCents = Math.min(Number(payment.gross_amount_cents), Math.round(Number(payment.gross_amount_cents) * percentage / 100));
  let commissionMetadata: Record<string, unknown>;
  if (payment.payment_source === "mercado_pago") {
    const seller = await tx.execute(sql`SELECT mercado_pago_user_id FROM motorista_mercado_pago_connections
      WHERE motorista_id = ${motoristaId} AND status = 'active' FOR UPDATE`);
    const sellerRow = seller.rows[0] as any;
    if (!sellerRow?.mercado_pago_user_id) throw new Error("marketplace_seller_connection_required");
    commissionMetadata = { motoristaId, sellerMercadoPagoUserId: String(sellerRow.mercado_pago_user_id), marketplaceCommissionPercent: percentage, marketplaceFeeCents: feeCents };
  } else {
    commissionMetadata = { motoristaId, internalCommission: true, internalCommissionPercent: percentage, internalCommissionFeeCents: feeCents };
  }
  await tx.execute(sql`UPDATE payment_transactions SET platform_fee_cents = ${feeCents},
    metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify(commissionMetadata)}::jsonb,
    updated_at = NOW() WHERE id = ${payment.id}`);
}
async function hasPendingMarketplacePayments(tx: any, motoristaId: number, sellerUserId?: string) {
  const pending = await tx.execute(sql`SELECT id FROM payment_transactions
    WHERE payment_source = 'mercado_pago'
      AND metadata->>'motoristaId' = ${String(motoristaId)}
      AND (${sellerUserId || null}::text IS NULL OR metadata->>'sellerMercadoPagoUserId' = ${sellerUserId || null})
      AND status NOT IN ('approved', 'rejected', 'cancelled', 'canceled', 'refunded')
    LIMIT 1 FOR UPDATE`);
  return !!pending.rows[0];
}

router.get("/mercado-pago/status", async (req, res) => {
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) { res.status(401).json({ error: "unauthorized" }); return; }
  const found = await db.execute(sql`SELECT mercado_pago_user_id, encrypted_refresh_token, expires_at, status, scopes, oauth_environment
    FROM motorista_mercado_pago_connections WHERE motorista_id = ${motoristaId} LIMIT 1`);
  const row = found.rows[0] as any;
  const active = row?.status === "active" && (!!row.encrypted_refresh_token || (!row.expires_at || new Date(row.expires_at).getTime() > Date.now()));
  res.json({ connected: active, status: active ? "active" : (row?.status || "disconnected"), expiresAt: row?.expires_at || null, scopes: row?.scopes || null });
});

router.post("/mercado-pago/connect", async (req, res) => {
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) { res.status(401).json({ error: "unauthorized" }); return; }
  const clientId = process.env.MERCADO_PAGO_CLIENT_ID;
  if (!clientId || !process.env.MERCADO_PAGO_CLIENT_SECRET) { res.status(503).json({ error: "mercado_pago_oauth_not_configured" }); return; }
  try {
    const environment = oauthEnvironment(), nonce = randomBytes(32).toString("base64url"), expiresAt = Date.now() + 10 * 60_000;
    await db.execute(sql`DELETE FROM motorista_mercado_pago_oauth_states WHERE expires_at < NOW()`);
    await db.execute(sql`INSERT INTO motorista_mercado_pago_oauth_states (motorista_id, nonce, oauth_environment, expires_at)
      VALUES (${motoristaId}, ${nonce}, ${environment}, ${new Date(expiresAt)})`);
    const authorizeUrl = new URL("https://auth.mercadopago.com.br/authorization");
    authorizeUrl.search = new URLSearchParams({ client_id: clientId, response_type: "code", platform_id: "mp", redirect_uri: oauthCallbackUrl(), state: signOauthState(motoristaId, nonce, environment, expiresAt) }).toString();
    res.json({ authorizeUrl: authorizeUrl.toString() });
  } catch (err) { (req as any).log?.error({ err }, "Mercado Pago OAuth start failed"); res.status(500).json({ error: "mercado_pago_oauth_start_failed" }); }
});

router.post("/mercado-pago/disconnect", async (req, res) => {
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) { res.status(401).json({ error: "unauthorized" }); return; }
  const disconnected = await db.transaction(async tx => {
    const connection = await tx.execute(sql`SELECT mercado_pago_user_id FROM motorista_mercado_pago_connections
      WHERE motorista_id = ${motoristaId} AND status = 'active' FOR UPDATE`);
    const sellerUserId = String((connection.rows[0] as any)?.mercado_pago_user_id || "");
    if (sellerUserId && await hasPendingMarketplacePayments(tx, motoristaId, sellerUserId)) return false;
    await tx.execute(sql`UPDATE motorista_mercado_pago_connections SET status = 'disconnected', revoked_at = NOW(),
      encrypted_access_token = NULL, encrypted_refresh_token = NULL, updated_at = NOW() WHERE motorista_id = ${motoristaId}`);
    await tx.execute(sql`UPDATE motoristas_app SET aceita_pagamento_app = false, atualizado_em = NOW() WHERE id = ${motoristaId}`);
    return true;
  });
  if (!disconnected) {
    res.status(409).json({ error: "marketplace_payments_pending", message: "Há pagamentos Mercado Pago pendentes. Aguarde a conclusão ou reconciliação antes de desconectar." });
    return;
  }
  res.json({ disconnected: true });
});

router.get("/mercado-pago/callback", async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const parsed = state ? parseOauthState(state) : null;
  if (!code || !parsed) { res.status(400).send("Conexão Mercado Pago inválida ou expirada."); return; }
  try {
    const body = new URLSearchParams({ grant_type: "authorization_code", client_id: process.env.MERCADO_PAGO_CLIENT_ID || "", client_secret: process.env.MERCADO_PAGO_CLIENT_SECRET || "", code, redirect_uri: oauthCallbackUrl() });
    const response = await fetch("https://api.mercadopago.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    const token: any = await response.json().catch(() => ({}));
    if (!response.ok || !token.access_token || !token.user_id) throw new Error(String(token.error || "oauth_exchange_failed"));
    const expiresAt = new Date(Date.now() + Math.max(60, Number(token.expires_in || 0)) * 1000);
    const connected = await db.transaction(async tx => {
      const stateConsumed = await tx.execute(sql`UPDATE motorista_mercado_pago_oauth_states SET consumed_at = NOW()
        WHERE motorista_id = ${parsed.motoristaId} AND nonce = ${parsed.nonce} AND oauth_environment = ${parsed.environment}
          AND expires_at > NOW() AND consumed_at IS NULL RETURNING id`);
      if (!stateConsumed.rows[0]) return "state_invalid";
      const previous = await tx.execute(sql`SELECT mercado_pago_user_id FROM motorista_mercado_pago_connections
        WHERE motorista_id = ${parsed.motoristaId} FOR UPDATE`);
      const previousSeller = String((previous.rows[0] as any)?.mercado_pago_user_id || "");
      if (previousSeller && previousSeller !== String(token.user_id) &&
        await hasPendingMarketplacePayments(tx, parsed.motoristaId, previousSeller)) {
        throw new Error("marketplace_payments_pending");
      }
      await tx.execute(sql`INSERT INTO motorista_mercado_pago_connections
        (motorista_id, mercado_pago_user_id, encrypted_access_token, encrypted_refresh_token, expires_at, scopes, status, oauth_environment, revoked_at, invalidated_at, last_error_code, updated_at)
        VALUES (${parsed.motoristaId}, ${String(token.user_id)}, ${encryptToken(token.access_token)}, ${token.refresh_token ? encryptToken(token.refresh_token) : null}, ${expiresAt}, ${String(token.scope || "")}, 'active', ${parsed.environment}, NULL, NULL, NULL, NOW())
        ON CONFLICT (motorista_id) DO UPDATE SET mercado_pago_user_id = EXCLUDED.mercado_pago_user_id, encrypted_access_token = EXCLUDED.encrypted_access_token, encrypted_refresh_token = EXCLUDED.encrypted_refresh_token, expires_at = EXCLUDED.expires_at, scopes = EXCLUDED.scopes, status = 'active', oauth_environment = EXCLUDED.oauth_environment, revoked_at = NULL, invalidated_at = NULL, last_error_code = NULL, updated_at = NOW()`);
      return "connected";
    });
    if (connected === "state_invalid") { res.status(400).send("Conexão Mercado Pago já utilizada ou expirada."); return; }
    res.type("html").send("<!doctype html><title>GoTaxi</title><p>Mercado Pago conectado. Você já pode voltar ao GoTaxi Pro.</p>");
  } catch (err) {
    if (err instanceof Error && err.message === "marketplace_payments_pending") {
      res.status(409).type("html").send("<!doctype html><title>GoTaxi</title><p>Não é possível trocar a conta Mercado Pago enquanto há pagamentos pendentes. Aguarde a conclusão ou reconciliação e tente novamente.</p>");
      return;
    }
    (req as any).log?.error({ err }, "Mercado Pago OAuth callback failed"); res.status(502).send("Não foi possível conectar o Mercado Pago. Tente novamente.");
  }
});

function gerarCodigoReferral(nome: string, id: number): string {
  const prefix = (nome || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "GT";
  return `${prefix}${String(id).padStart(4, "0")}`;
}

// ── Auto-block: se semana anterior não paga → bloquear ───────────────────────
async function checkAutoBlock(profissionalId: number) {
  try {
    const now = new Date();
    const { semanaInicio } = getWeekBounds(now);
    // Last week's Monday
    const lastWeekMon = new Date(now);
    lastWeekMon.setDate(now.getDate() - 7);
    const { semanaInicio: semanaPassada } = getWeekBounds(lastWeekMon);
    // If there's a pendente repasse from last week → block
    const unpaid = await db.execute(sql`
      SELECT id FROM repasses_pro
      WHERE profissional_id = ${profissionalId}
        AND semana_inicio = ${semanaPassada}
        AND status = 'pendente'
      LIMIT 1
    `);
    if (unpaid.rows.length > 0) {
      await db.execute(sql`UPDATE motoristas_app SET status_repasse = 'bloqueado' WHERE id = ${profissionalId}`);
      await db.execute(sql`UPDATE repasses_pro SET status = 'bloqueado' WHERE profissional_id = ${profissionalId} AND semana_inicio = ${semanaPassada} AND status = 'pendente'`);
    }
  } catch (_) {}
}

// ── Upsert this week's repasse for a professional ────────────────────────────
async function upsertRepasseSemana(profissionalId: number, tipoProfissional: string) {
  const { semanaInicio, semanaFim } = getWeekBounds();
  const isEntregador = tipoProfissional === "entregador" || tipoProfissional === "delivery";
  // total_ganhos = ALL earnings this week (shown to the professional as "seus ganhos").
  // total_taxavel = only the portion subject to the 3% fee (excludes PDV/food deliveries).
  let totalGanhos = 0;
  let totalTaxavel = 0;
  try {
    if (isEntregador) {
      // ALL deliveries (bruto) — for display purposes
      const rAll = await db.execute(sql`
        SELECT
          COALESCE(SUM(CASE WHEN pedido_pdv_id IS NULL AND COALESCE(tipo_servico,'') <> 'delivery'
                            THEN valor_estimado ELSE 0 END), 0) AS taxavel,
          COALESCE(SUM(valor_estimado), 0) AS total_entrega
        FROM entregas_solicitadas
        WHERE status = 'finalizada'
          AND profissional_id = ${profissionalId}
          AND criado_em >= ${semanaInicio}::date
          AND criado_em < (${semanaFim}::date + INTERVAL '1 day')
      `);
      // PDV earnings (taxa_entrega from pedidos_pdv, always isento)
      const rPdv = await db.execute(sql`
        SELECT COALESCE(SUM(
          COALESCE(NULLIF(p.taxa_entrega,0), c.taxa_minima, c.taxa_fixa, 0)
        ), 0) AS total_pdv
        FROM pedidos_pdv p
        LEFT JOIN config_entrega_pdv c ON c.empresa_id = p.empresa_id
        WHERE p.boy_id = ${profissionalId} AND p.status = 'entregue'
          AND COALESCE(p.entregue_em, p.criado_em) >= ${semanaInicio}::date
          AND COALESCE(p.entregue_em, p.criado_em) < (${semanaFim}::date + INTERVAL '1 day')
      `);
      const row = rAll.rows[0] as any;
      const pdvTotal = Number((rPdv.rows[0] as any)?.total_pdv ?? 0);
      totalTaxavel = Number(row?.taxavel ?? 0);
      totalGanhos  = Number(row?.total_entrega ?? 0) + pdvTotal;
    } else {
      const r = await db.execute(sql`
        SELECT COALESCE(SUM(valor_estimado), 0) AS total
        FROM corridas_solicitadas
        WHERE status = 'finalizada'
          AND motorista_id = ${profissionalId}
          AND criado_em >= ${semanaInicio}::date
          AND criado_em < (${semanaFim}::date + INTERVAL '1 day')
      `);
      totalGanhos  = Number((r.rows[0] as any)?.total ?? 0);
      totalTaxavel = totalGanhos; // motoristas: all earnings are taxable
    }
  } catch (e) {
    console.error("upsertRepasseSemana sum error:", e);
  }
  const percentual = 3;
  const valorRepasse = parseFloat((totalTaxavel * percentual / 100).toFixed(2));
  await db.execute(sql`
    INSERT INTO repasses_pro (profissional_id, tipo_profissional, semana_inicio, semana_fim, total_ganhos, percentual, valor_repasse, status)
    VALUES (${profissionalId}, ${tipoProfissional}, ${semanaInicio}, ${semanaFim}, ${totalGanhos}, ${percentual}, ${valorRepasse}, 'pendente')
    ON CONFLICT (profissional_id, semana_inicio) DO UPDATE SET
      total_ganhos = EXCLUDED.total_ganhos,
      valor_repasse = EXCLUDED.valor_repasse
    WHERE repasses_pro.status = 'pendente'
  `);
  const row = await db.execute(sql`
    SELECT * FROM repasses_pro WHERE profissional_id = ${profissionalId} AND semana_inicio = ${semanaInicio}
  `);
  return row.rows[0];
}

// ── POST /cadastro ─────────────────────────────────────────────────────────────
router.post("/cadastro", async (req: Request, res: Response) => {
  await ensureTable();
  const { nome, telefone, pin, cpf, email, cidade, estado, tipo_profissional, indicado_por } = req.body;
  if (!nome || !telefone || !pin) return res.status(400).json({ error: "nome, telefone e PIN são obrigatórios" });
  if (String(pin).length < 4) return res.status(400).json({ error: "PIN deve ter pelo menos 4 dígitos" });
  const tipo = tipo_profissional || "motorista";
  try {
    const rows = await db.execute(sql`
      INSERT INTO motoristas_app (nome, telefone, senha_pin, cpf, email, cidade, estado, tipo_profissional, indicado_por)
      VALUES (${nome}, ${telefone}, ${String(pin)}, ${cpf || null}, ${email || null}, ${cidade || null}, ${estado || null}, ${tipo}, ${indicado_por || null})
       RETURNING id, nome, telefone, status, tipo_profissional, criado_em,
                 aceita_pagamento_direto, aceita_pagamento_app
    `);
    const motorista = rows.rows[0] as any;
    const codigo_referral = gerarCodigoReferral(nome, motorista.id);
    await db.execute(sql`UPDATE motoristas_app SET codigo_referral = ${codigo_referral} WHERE id = ${motorista.id} AND codigo_referral IS NULL`);
    return res.status(201).json({ ...motorista, codigo_referral, token: issueMotoristaToken(motorista.id) });
  } catch (err: any) {
    if (err?.cause?.code === "23505" || err?.code === "23505") {
      return res.status(409).json({ error: "Telefone já cadastrado" });
    }
    return res.status(500).json({ error: "Erro ao cadastrar" });
  }
});

// ── POST /login ────────────────────────────────────────────────────────────────
router.post("/login", async (req: Request, res: Response) => {
  await ensureTable();
  await ensureRepassesProTable();
  const { telefone, pin } = req.body;
  if (!telefone || !pin) return res.status(400).json({ error: "telefone e PIN são obrigatórios" });
  try {
    const rows = await db.execute(sql`
      SELECT id, nome, telefone, cpf, email, foto, status, tipo_profissional, cidade, estado,
             veiculo_marca, veiculo_modelo, veiculo_ano, veiculo_cor, veiculo_placa, tipo_veiculo,
             doc_cnh_status, doc_veiculo_status, doc_selfie_status,
             percentual_repasse, saldo, total_ganhos, total_corridas, avaliacao_media, criado_em,
              status_repasse, pix_tipo, pix_chave, pix_imagem_url, codigo_referral,
              aceita_pagamento_direto, aceita_pagamento_app
      FROM motoristas_app WHERE telefone = ${telefone} AND senha_pin = ${String(pin)} AND ativo = true
    `);
    if (!rows.rows.length) return res.status(401).json({ error: "Telefone ou PIN incorretos" });
    const motorista = rows.rows[0] as any;
    await checkAutoBlock(motorista.id);
    const updated = await db.execute(sql`SELECT status_repasse FROM motoristas_app WHERE id = ${motorista.id}`);
    const statusRepasse = (updated.rows[0] as any)?.status_repasse || "ok";
    const catRows = await db.execute(`SELECT categoria_id, categoria_nome FROM motorista_categorias WHERE motorista_id = ${motorista.id} ORDER BY categoria_id`);
    return res.json({ ...motorista, status_repasse: statusRepasse, categorias_habilitadas: catRows.rows, token: issueMotoristaToken(motorista.id) });
  } catch (_) {
    return res.status(500).json({ error: "Erro no servidor" });
  }
});

// ── Middleware: extract motorista_id from token ────────────────────────────────
function getMotoristaId(req: Request): number | null {
  return motoristaIdFromRequest(req);
}
async function withDriverPaymentStatus(corrida: any) {
  const source = String(corrida.payment_source || "direto");
  if (source === "direto") return { ...corrida, paymentSource: "direto", paymentStatus: "direto" };
  const module = corrida.entrega_id ? "entrega" : "motorista";
  const referenceId = corrida.entrega_id ? String(corrida.entrega_id) : (corrida.corrida_id ? String(corrida.corrida_id) : "");
  const rows = referenceId ? await db.execute(sql`SELECT status FROM payment_transactions WHERE module = ${module} AND reference_id = ${referenceId} LIMIT 1`) : null;
  const status = String((rows?.rows[0] as any)?.status || "pending");
  return { ...corrida, paymentSource: source, paymentStatus: status === "approved" ? "pago" : "pendente" };
}

// ── GET /perfil ────────────────────────────────────────────────────────────────
router.get("/perfil", async (req: Request, res: Response) => {
  await ensureTable();
  await ensureRepassesProTable();
  await ensureMotoristaCategoriasTable();
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "Não autenticado" });
  try {
    await checkAutoBlock(motoristaId);
    const rows = await db.execute(sql`
      SELECT id, nome, telefone, cpf, email, foto, status, tipo_profissional, cidade, estado,
             veiculo_marca, veiculo_modelo, veiculo_ano, veiculo_cor, veiculo_placa, tipo_veiculo,
             doc_cnh_status, doc_veiculo_status, doc_selfie_status,
             percentual_repasse, saldo, total_ganhos, total_corridas, avaliacao_media, criado_em,
              status_repasse, pix_tipo, pix_chave, pix_imagem_url, codigo_referral,
              aceita_pagamento_direto, aceita_pagamento_app
      FROM motoristas_app WHERE id = ${motoristaId}
    `);
    if (!rows.rows.length) return res.status(404).json({ error: "Motorista não encontrado" });
    const motorista = rows.rows[0] as any;
    const catRows = await db.execute(`SELECT categoria_id, categoria_nome FROM motorista_categorias WHERE motorista_id = ${motoristaId} ORDER BY categoria_id`);
    motorista.categorias_habilitadas = catRows.rows;
    return res.json(motorista);
  } catch (err) {
    console.error("Erro em GET /perfil:", err);
    return res.status(500).json({ error: "Erro no servidor" });
  }
});

// ── PUT /pix — update PIX key and image ───────────────────────────────────────
router.put("/pix", async (req: Request, res: Response) => {
  await ensureTable();
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "Não autenticado" });
  const { pix_tipo, pix_chave, pix_imagem_url } = req.body;
  try {
    await db.execute(sql`
      UPDATE motoristas_app SET
        pix_tipo = ${pix_tipo || "cpf"},
        pix_chave = ${pix_chave || null},
        pix_imagem_url = ${pix_imagem_url || null}
      WHERE id = ${motoristaId}
    `);
    return res.json({ ok: true });
  } catch (err) {
    console.error("PUT /pix error:", err);
    return res.status(500).json({ error: "Erro ao salvar PIX" });
  }
});

const pixImageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── POST /pix/imagem — upload PIX bank image ──────────────────────────────────
router.post("/pix/imagem", pixImageUpload.single("file"), async (req: Request, res: Response) => {
  await ensureTable();
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "Não autenticado" });
  if (!req.file) return res.status(400).json({ error: "Arquivo não enviado" });
  try {
    const publicUrl = await uploadImageToGCS(req.file.buffer, req.file.originalname, "pix");
    await db.execute(sql`UPDATE motoristas_app SET pix_imagem_url = ${publicUrl} WHERE id = ${motoristaId}`);
    return res.json({ ok: true, url: publicUrl });
  } catch (err: any) {
    console.error("PIX imagem upload error:", err);
    return res.status(500).json({ error: "Erro ao enviar imagem" });
  }
});

// ── helpers: ensure motorista_categorias table ─────────────────────────────────
async function ensureMotoristaCategoriasTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS motorista_categorias (
      motorista_id INTEGER NOT NULL,
      categoria_id INTEGER NOT NULL,
      categoria_nome TEXT NOT NULL,
      PRIMARY KEY (motorista_id, categoria_id)
    )
  `);
}

// Save selected categories for a driver (driver chooses which to work in)
async function saveMotoristaCategoriasSelected(
  motoristaId: number,
  modeloNome: string | null | undefined,
  selectedIds: number[] | null | undefined
) {
  await ensureMotoristaCategoriasTable();
  await db.execute(`DELETE FROM motorista_categorias WHERE motorista_id = ${motoristaId}`);
  if (!modeloNome || !selectedIds?.length) return;
  // Look up the model to get eligible category IDs
  const modeloRows = await db.execute(`
    SELECT m.id FROM modelos_veiculo m
    WHERE LOWER(m.nome) = LOWER('${modeloNome.replace(/'/g, "''")}') AND m.ativo = true LIMIT 1
  `);
  if (!modeloRows.rows.length) return;
  const modeloId = (modeloRows.rows[0] as any).id;
  // Only save categories that are eligible for this model AND were selected by driver
  const eligibleRows = await db.execute(`
    SELECT c.id, c.nome FROM modelo_categorias mc
    JOIN categorias_corrida c ON c.id = mc.categoria_id AND c.ativo = true
    WHERE mc.modelo_id = ${modeloId} AND c.id IN (${selectedIds.map(Number).join(",")})
  `);
  for (const cat of eligibleRows.rows as any[]) {
    await db.execute(`
      INSERT INTO motorista_categorias (motorista_id, categoria_id, categoria_nome)
      VALUES (${motoristaId}, ${cat.id}, '${cat.nome.replace(/'/g, "''")}')
      ON CONFLICT DO NOTHING
    `);
  }
}

// Legacy: auto-assign all eligible categories (used by admin recalc)
async function updateMotoristaElegibilidade(motoristaId: number, modeloNome: string | null | undefined, anoVeiculo: number | null | undefined) {
  await ensureMotoristaCategoriasTable();
  await db.execute(`DELETE FROM motorista_categorias WHERE motorista_id = ${motoristaId}`);
  if (!modeloNome) return;
  const modeloRows = await db.execute(`
    SELECT m.id, m.ano_minimo FROM modelos_veiculo m
    WHERE LOWER(m.nome) = LOWER('${modeloNome.replace(/'/g, "''")}') AND m.ativo = true LIMIT 1
  `);
  if (!modeloRows.rows.length) return;
  const modelo = modeloRows.rows[0] as any;
  if (anoVeiculo && anoVeiculo < modelo.ano_minimo) return;
  const catRows = await db.execute(`
    SELECT c.id, c.nome FROM modelo_categorias mc
    JOIN categorias_corrida c ON c.id = mc.categoria_id AND c.ativo = true
    WHERE mc.modelo_id = ${modelo.id}
  `);
  for (const cat of catRows.rows as any[]) {
    await db.execute(`
      INSERT INTO motorista_categorias (motorista_id, categoria_id, categoria_nome)
      VALUES (${motoristaId}, ${cat.id}, '${cat.nome.replace(/'/g, "''")}')
      ON CONFLICT DO NOTHING
    `);
  }
}

// ── PATCH /fcm-token — register device push token ──────────────────────────
router.patch("/fcm-token", async (req: Request, res: Response) => {
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "unauthorized" });
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "token required" });
  try {
    await ensureTable();
    await db.execute(sql.raw(`UPDATE motoristas_app SET fcm_token = '${esc(token)}' WHERE id = ${motoristaId}`));
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── PATCH /alterar-pin — motorista changes their PIN ───────────────────────────
router.patch("/alterar-pin", async (req: Request, res: Response) => {
  await ensureTable();
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "unauthorized" });
  const { pinAtual, novoPin } = req.body;
  if (!pinAtual || !novoPin) return res.status(400).json({ error: "bad_request", message: "pinAtual e novoPin são obrigatórios" });
  if (String(novoPin).length < 4) return res.status(400).json({ error: "bad_request", message: "O PIN deve ter pelo menos 4 dígitos" });
  try {
    const rows = await db.execute(sql.raw(`SELECT senha_pin FROM motoristas_app WHERE id = ${motoristaId}`));
    const motorista = rows.rows[0] as any;
    if (!motorista) return res.status(404).json({ error: "not_found" });
    if (String(motorista.senha_pin) !== String(pinAtual)) return res.status(401).json({ error: "pin_incorreto", message: "PIN atual incorreto" });
    await db.execute(sql.raw(`UPDATE motoristas_app SET senha_pin = '${String(novoPin).replace(/'/g, "''")}' WHERE id = ${motoristaId}`));
    return res.json({ ok: true, message: "PIN alterado com sucesso" });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── PUT /perfil ────────────────────────────────────────────────────────────────
router.put("/perfil", async (req: Request, res: Response) => {
  await ensureTable();
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "Não autenticado" });
  const { nome, email, cidade, estado, veiculo_marca, veiculo_modelo, veiculo_ano, veiculo_cor, veiculo_placa, tipo_veiculo, selected_categoria_ids, aceita_pagamento_direto, aceita_pagamento_app } = req.body;
  if (aceita_pagamento_direto !== undefined && typeof aceita_pagamento_direto !== "boolean") {
    return res.status(400).json({ error: "aceita_pagamento_direto deve ser booleano" });
  }
  if (aceita_pagamento_app !== undefined && typeof aceita_pagamento_app !== "boolean") {
    return res.status(400).json({ error: "aceita_pagamento_app deve ser booleano" });
  }
  try {
    if (aceita_pagamento_app === true) {
      const connection = await db.execute(sql`SELECT id FROM motorista_mercado_pago_connections
        WHERE motorista_id = ${motoristaId} AND status = 'active' AND (expires_at > NOW() OR encrypted_refresh_token IS NOT NULL) LIMIT 1`);
      if (!connection.rows[0]) {
        return res.status(409).json({ error: "mercado_pago_connection_required", message: "Conecte uma conta Mercado Pago ativa antes de aceitar pagamentos pelo app." });
      }
    }
    await db.execute(sql`
      UPDATE motoristas_app SET
        nome = COALESCE(${nome || null}, nome),
        email = COALESCE(${email || null}, email),
        cidade = COALESCE(${cidade || null}, cidade),
        estado = COALESCE(${estado || null}, estado),
        veiculo_marca = COALESCE(${veiculo_marca || null}, veiculo_marca),
        veiculo_modelo = COALESCE(${veiculo_modelo || null}, veiculo_modelo),
        veiculo_ano = COALESCE(${veiculo_ano || null}, veiculo_ano),
        veiculo_cor = COALESCE(${veiculo_cor || null}, veiculo_cor),
        veiculo_placa = COALESCE(${veiculo_placa || null}, veiculo_placa),
        tipo_veiculo = COALESCE(${tipo_veiculo || null}, tipo_veiculo),
        aceita_pagamento_direto = COALESCE(${aceita_pagamento_direto ?? null}, aceita_pagamento_direto),
        aceita_pagamento_app = COALESCE(${aceita_pagamento_app ?? null}, aceita_pagamento_app),
        atualizado_em = NOW()
      WHERE id = ${motoristaId}
    `);

    // Save driver's selected categories (driver chooses which to work in)
    if (veiculo_modelo !== undefined || selected_categoria_ids !== undefined) {
      const fresh = await db.execute(sql`SELECT veiculo_modelo FROM motoristas_app WHERE id = ${motoristaId}`);
      const m = fresh.rows[0] as any;
      if (Array.isArray(selected_categoria_ids)) {
        await saveMotoristaCategoriasSelected(motoristaId, m.veiculo_modelo, selected_categoria_ids);
      } else if (veiculo_modelo !== undefined) {
        // Model changed without explicit category selection — clear categories
        await ensureMotoristaCategoriasTable();
        await db.execute(`DELETE FROM motorista_categorias WHERE motorista_id = ${motoristaId}`);
      }
    }

    const rows = await db.execute(sql`SELECT * FROM motoristas_app WHERE id = ${motoristaId}`);
    const motorista = rows.rows[0] as any;
    await ensureMotoristaCategoriasTable();
    const catRows = await db.execute(`SELECT categoria_id, categoria_nome FROM motorista_categorias WHERE motorista_id = ${motoristaId} ORDER BY categoria_id`);
    motorista.categorias_habilitadas = catRows.rows;
    return res.json(motorista);
  } catch (err) {
    console.error("Erro ao atualizar perfil:", err);
    return res.status(500).json({ error: "Erro ao atualizar perfil" });
  }
});

// ── POST /documentos ───────────────────────────────────────────────────────────
router.post("/documentos", async (req: Request, res: Response) => {
  await ensureTable();
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "Não autenticado" });
  const { tipo, url } = req.body;
  const tipos: Record<string, string> = { cnh: "doc_cnh", veiculo: "doc_veiculo", selfie: "doc_selfie" };
  const statusCols: Record<string, string> = { cnh: "doc_cnh_status", veiculo: "doc_veiculo_status", selfie: "doc_selfie_status" };
  if (!tipos[tipo]) return res.status(400).json({ error: "tipo deve ser: cnh, veiculo ou selfie" });
  if (typeof url !== "string" || !url.startsWith("/api/images/docs/")) {
    return res.status(400).json({ error: "url_documento_invalida", message: "Envie o arquivo antes de registrar o documento" });
  }
  try {
    await db.execute(sql.raw(`
      UPDATE motoristas_app
      SET ${tipos[tipo]} = '${esc(url)}', ${statusCols[tipo]} = 'em_analise', atualizado_em = NOW()
      WHERE id = ${motoristaId}
    `));
    await db.execute(sql`
      UPDATE motoristas_app SET status = 'em_analise' WHERE id = ${motoristaId}
        AND doc_cnh_status != 'pendente'
        AND doc_veiculo_status != 'pendente'
        AND doc_selfie_status != 'pendente'
    `);
    const rows = await db.execute(sql`
      SELECT doc_cnh_status, doc_veiculo_status, doc_selfie_status, status FROM motoristas_app WHERE id = ${motoristaId}
    `);
    return res.json({ ok: true, documentos: rows.rows[0] });
  } catch (err) {
    console.error("POST /documentos error:", err);
    return res.status(500).json({ error: "Erro ao enviar documento" });
  }
});

// ── GET /ganhos ────────────────────────────────────────────────────────────────
router.get("/ganhos", async (req: Request, res: Response) => {
  await ensureTable();
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "Não autenticado" });
  try {
    const perfil = await db.execute(sql`
      SELECT nome, tipo_profissional, percentual_repasse, total_ganhos, total_corridas, saldo FROM motoristas_app WHERE id = ${motoristaId}
    `);
    if (!perfil.rows.length) return res.status(404).json({ error: "Motorista não encontrado" });
    const m = perfil.rows[0] as any;
    const repasse = Number(m.percentual_repasse) || 3;
    const isEntregador = m.tipo_profissional === "entregador" || m.tipo_profissional === "delivery";

    let corridasRaw: any[] = [];
    if (isEntregador) {
      await ensureEntregasTable();
      // Exclui aqui as entregas vindas do PDV — elas serão carregadas separadamente
      // do pedidos_pdv (ver bloco abaixo) para evitar duplicidade.
      const rows = await db.execute(sql`
        SELECT id, cliente_nome,
               coleta_endereco AS origem_endereco, entrega_endereco AS destino_endereco,
               valor_estimado AS valor, distancia_entrega_km AS distancia_km,
               categoria_nome, criado_em,
               false AS is_isento_taxa
        FROM entregas_solicitadas
        WHERE status = 'finalizada' AND profissional_id = ${motoristaId}
          AND pedido_pdv_id IS NULL
          AND COALESCE(tipo_servico, '') <> 'delivery'
        ORDER BY criado_em DESC
        LIMIT 50
      `);
      corridasRaw = rows.rows as any[];
    } else {
      await ensureCorridasTable();
      const corridasRows = await db.execute(sql`
        SELECT id, cliente_nome, origem_endereco, destino_endereco, valor_estimado AS valor,
               distancia_viagem_km AS distancia_km, categoria_nome, criado_em,
               false AS is_isento_taxa
        FROM corridas_solicitadas
        WHERE status = 'finalizada' AND motorista_id = ${motoristaId}
        ORDER BY criado_em DESC
        LIMIT 50
      `);
      corridasRaw = corridasRows.rows as any[];
    }

    // ── Inclui também as entregas vindas do PDV (pizzarias/lojas) ──
    // Estas são SEMPRE isentas de repasse: a empresa já paga 3% sobre o pedido completo.
    try {
      await ensurePdvBoySchema();
      const pdvRows = await db.execute(sql`
        SELECT p.id, p.cliente_nome,
               COALESCE(c.endereco_restaurante, '') AS origem_endereco,
               COALESCE(p.cliente_endereco, '') AS destino_endereco,
               COALESCE(NULLIF(p.taxa_entrega, 0), c.taxa_minima, c.taxa_fixa, 0) AS valor,
               p.distancia_km,
               'PDV Delivery' AS categoria_nome,
               COALESCE(p.entregue_em, p.criado_em) AS criado_em,
               true AS is_isento_taxa
        FROM pedidos_pdv p
        LEFT JOIN config_entrega_pdv c ON c.empresa_id = p.empresa_id
        WHERE p.boy_id = ${motoristaId} AND p.status = 'entregue'
        ORDER BY COALESCE(p.entregue_em, p.criado_em) DESC
        LIMIT 50
      `);
      corridasRaw = [...corridasRaw, ...(pdvRows.rows as any[])]
        .sort((a: any, b: any) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())
        .slice(0, 50);
    } catch (e) {
      console.error("[ganhos] erro ao carregar pedidos_pdv:", e);
    }

    // Separa em taxável (3%) e isento (sem repasse).
    const isIsento = (c: any) => Boolean(c.is_isento_taxa);
    const totalBruto = corridasRaw.reduce((s: number, c: any) => s + Number(c.valor), 0);
    const totalTaxavel = corridasRaw.filter(c => !isIsento(c)).reduce((s, c: any) => s + Number(c.valor), 0);
    const totalRepasse = totalTaxavel * (repasse / 100);
    const totalLiquido = totalBruto - totalRepasse;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const corridasHoje = corridasRaw.filter((c: any) => new Date(c.criado_em) >= hoje);
    const ganhosHoje = corridasHoje.reduce((s: number, c: any) => s + Number(c.valor), 0);
    const ganhosHojeTaxavel = corridasHoje.filter(c => !isIsento(c)).reduce((s, c: any) => s + Number(c.valor), 0);
    const repasseHoje = ganhosHojeTaxavel * (repasse / 100);

    const semana = new Date();
    semana.setDate(semana.getDate() - 7);
    const corridasSemana = corridasRaw.filter((c: any) => new Date(c.criado_em) >= semana);
    const ganhosSemana = corridasSemana.reduce((s: number, c: any) => s + Number(c.valor), 0);

    return res.json({
      motorista: { nome: m.nome, percentual_repasse: repasse, saldo: m.saldo },
      resumo: {
        total_bruto: totalBruto,
        total_repasse: totalRepasse,
        total_liquido: totalLiquido,
        corridas_hoje: corridasHoje.length,
        ganhos_hoje: ganhosHoje,
        repasse_hoje: repasseHoje,
        ganhos_hoje_liquido: ganhosHoje - repasseHoje,
        corridas_semana: corridasSemana.length,
        ganhos_semana: ganhosSemana,
      },
      corridas: corridasRaw.map((c: any) => {
        const isento = isIsento(c);
        return {
          ...c,
          valor_bruto: Number(c.valor),
          valor_repasse: isento ? 0 : Number(c.valor) * (repasse / 100),
          valor_liquido: isento ? Number(c.valor) : Number(c.valor) * (1 - repasse / 100),
        };
      }),
    });
  } catch (_) {
    return res.status(500).json({ error: "Erro ao buscar ganhos" });
  }
});

// ── GET /stats ─────────────────────────────────────────────────────────────────
router.get("/stats", async (req: Request, res: Response) => {
  await ensureTable();
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "Não autenticado" });
  try {
    const perfil = await db.execute(sql`
      SELECT nome, tipo_profissional, percentual_repasse, total_ganhos, total_corridas, avaliacao_media, saldo, status
      FROM motoristas_app WHERE id = ${motoristaId}
    `);
    if (!perfil.rows.length) return res.status(404).json({ error: "Não encontrado" });
    const m = perfil.rows[0] as any;
    const isEntregador = m.tipo_profissional === "entregador" || m.tipo_profissional === "delivery";

    let corridas: any[] = [];
    if (isEntregador) {
      await ensureEntregasTable();
      // Exclui PDV — carregadas separadamente (pedidos_pdv) para evitar duplicidade.
      const rows = await db.execute(sql`
        SELECT valor_estimado AS valor, criado_em, false AS is_isento_taxa
        FROM entregas_solicitadas
        WHERE status = 'finalizada' AND profissional_id = ${motoristaId}
          AND pedido_pdv_id IS NULL
          AND COALESCE(tipo_servico, '') <> 'delivery'
      `);
      corridas = rows.rows as any[];
    } else {
      await ensureCorridasTable();
      const rows = await db.execute(sql`
        SELECT valor_estimado AS valor, criado_em, false AS is_isento_taxa FROM corridas_solicitadas
        WHERE status = 'finalizada' AND motorista_id = ${motoristaId}
      `);
      corridas = rows.rows as any[];
    }

    // ── Inclui também as entregas vindas do PDV (pizzarias/lojas) ──
    // SEMPRE isentas: empresa já paga 3% sobre o pedido completo (produto + entrega).
    try {
      await ensurePdvBoySchema();
      const pdvRows = await db.execute(sql`
        SELECT COALESCE(NULLIF(p.taxa_entrega, 0), c.taxa_minima, c.taxa_fixa, 0) AS valor,
               COALESCE(p.entregue_em, p.criado_em) AS criado_em,
               true AS is_isento_taxa
        FROM pedidos_pdv p
        LEFT JOIN config_entrega_pdv c ON c.empresa_id = p.empresa_id
        WHERE p.boy_id = ${motoristaId} AND p.status = 'entregue'
      `);
      corridas = [...corridas, ...(pdvRows.rows as any[])];
    } catch (e) {
      console.error("[stats] erro ao carregar pedidos_pdv:", e);
    }

    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const mesAtual = new Date(); mesAtual.setDate(1); mesAtual.setHours(0, 0, 0, 0);
    const semanaAtras = new Date(); semanaAtras.setDate(semanaAtras.getDate() - 7); semanaAtras.setHours(0, 0, 0, 0);

    const corridasHoje = corridas.filter((c: any) => new Date(c.criado_em) >= hoje);
    const corridasMes = corridas.filter((c: any) => new Date(c.criado_em) >= mesAtual);
    const corridasSemana = corridas.filter((c: any) => new Date(c.criado_em) >= semanaAtras);
    const repasse = Number(m.percentual_repasse) || 3;
    const isIsento = (c: any) => Boolean(c.is_isento_taxa);
    const sumValor = (arr: any[]) => arr.reduce((s, c: any) => s + Number(c.valor), 0);
    const sumTaxavel = (arr: any[]) => arr.filter(c => !isIsento(c)).reduce((s, c: any) => s + Number(c.valor), 0);

    const ganhosHoje = sumValor(corridasHoje);
    const ganhosMes = sumValor(corridasMes);
    const ganhosSemana = sumValor(corridasSemana);
    const totalBruto = sumValor(corridas);

    // Líquido = bruto − 3% somente sobre a parcela taxável (isentos entram 100% no líquido)
    const liquidoHoje = ganhosHoje - sumTaxavel(corridasHoje) * (repasse / 100);
    const liquidoSemana = ganhosSemana - sumTaxavel(corridasSemana) * (repasse / 100);
    const liquidoMes = ganhosMes - sumTaxavel(corridasMes) * (repasse / 100);
    const liquidoTotal = totalBruto - sumTaxavel(corridas) * (repasse / 100);

    return res.json({
      status: m.status,
      corridas_hoje: corridasHoje.length,
      corridas_semana: corridasSemana.length,
      corridas_mes: corridasMes.length,
      corridas_total: corridas.length,
      hoje: ganhosHoje,
      semana: ganhosSemana,
      mes: ganhosMes,
      ganhos_hoje: ganhosHoje,
      ganhos_hoje_liquido: liquidoHoje,
      ganhos_semana: ganhosSemana,
      ganhos_semana_liquido: liquidoSemana,
      ganhos_mes: ganhosMes,
      ganhos_mes_liquido: liquidoMes,
      ganhos_total_bruto: totalBruto,
      ganhos_total_liquido: liquidoTotal,
      percentual_repasse: repasse,
      saldo: m.saldo,
      avaliacao_media: String(m.avaliacao_media || 0),
    });
  } catch (err) {
    console.error("stats error:", err);
    return res.status(500).json({ error: "Erro ao buscar stats" });
  }
});

// ── Admin: GET /admin/motoristas-app ─────────────────────────────────────────
router.get("/admin/list", async (req: Request, res: Response) => {
  await ensureTable();
  await ensureMotoristaCategoriasTable();
  try {
    const tipo = req.query.tipo as string | undefined;
    const whereClause = tipo ? `WHERE m.tipo_profissional = '${tipo.replace(/'/g, "''")}'` : `WHERE m.tipo_profissional = 'motorista'`;
    const rows = await db.execute(`
      SELECT m.id, m.nome, m.telefone, m.cpf, m.email, m.status, m.tipo_profissional,
             m.tipo_veiculo, m.veiculo_marca, m.veiculo_modelo, m.veiculo_ano, m.veiculo_placa,
             m.doc_cnh_status, m.doc_veiculo_status, m.doc_selfie_status,
             m.total_corridas, m.avaliacao_media, m.criado_em,
             COALESCE(
               json_agg(json_build_object('categoria_id', mc.categoria_id, 'categoria_nome', mc.categoria_nome) ORDER BY mc.categoria_id)
               FILTER (WHERE mc.categoria_id IS NOT NULL), '[]'
             ) AS categorias_habilitadas
      FROM motoristas_app m
      LEFT JOIN motorista_categorias mc ON mc.motorista_id = m.id
      ${whereClause}
      GROUP BY m.id
      ORDER BY m.criado_em DESC
    `);
    return res.json(rows.rows);
  } catch (err) {
    console.error("admin/list error:", err);
    return res.status(500).json({ error: "Erro" });
  }
});

// ── Admin: DELETE /admin/:id — Excluir profissional (motorista/entregador) ──
router.delete("/admin/:id", requireAdmin, async (req: Request, res: Response) => {
  await ensureTable();
  const id = parseInt(String(req.params.id));
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: "ID inválido" });
  try {
    // Limpa vínculos antes de remover o profissional
    try { await db.execute(sql`DELETE FROM motorista_categorias WHERE motorista_id = ${id}`); } catch (_) {}
    try { await db.execute(sql`DELETE FROM repasses_pro WHERE profissional_id = ${id}`); } catch (_) {}
    const result = await db.execute(sql`DELETE FROM motoristas_app WHERE id = ${id} RETURNING id`);
    if (!result.rows.length) return res.status(404).json({ error: "Profissional não encontrado" });
    return res.json({ ok: true, id });
  } catch (err) {
    console.error("admin/delete profissional error:", err);
    return res.status(500).json({ error: "Erro ao excluir profissional" });
  }
});

// ── Admin: PATCH /admin/aprovar ─────────────────────────────────────────────
router.patch("/admin/:id/status", async (req: Request, res: Response) => {
  await ensureTable();
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ["pendente", "em_analise", "aprovado", "suspenso", "bloqueado"];
  if (!allowed.includes(status)) return res.status(400).json({ error: "Status inválido" });
  try {
    await db.execute(sql`UPDATE motoristas_app SET status = ${status}, atualizado_em = NOW() WHERE id = ${parseInt(String(id))}`);
    if (status === "aprovado") {
      await db.execute(sql`
        UPDATE motoristas_app SET
          doc_cnh_status = CASE WHEN doc_cnh_status = 'em_analise' THEN 'aprovado' ELSE doc_cnh_status END,
          doc_veiculo_status = CASE WHEN doc_veiculo_status = 'em_analise' THEN 'aprovado' ELSE doc_veiculo_status END,
          doc_selfie_status = CASE WHEN doc_selfie_status = 'em_analise' THEN 'aprovado' ELSE doc_selfie_status END
        WHERE id = ${parseInt(String(id))}
      `);
    }
    return res.json({ ok: true });
  } catch (_) {
    return res.status(500).json({ error: "Erro ao atualizar" });
  }
});

// ── GET /repasse/semana ──────────────────────────────────────────────────────
router.get("/repasse/semana", async (req: Request, res: Response) => {
  await ensureRepassesProTable();
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "Não autenticado" });
  try {
    const proRow = await db.execute(sql`SELECT tipo_profissional, status_repasse FROM motoristas_app WHERE id = ${motoristaId}`);
    const pro = proRow.rows[0] as any;
    if (!pro) return res.status(404).json({ error: "not_found" });
    const repasse = await upsertRepasseSemana(motoristaId, pro.tipo_profissional);
    const { nextMonday } = getWeekBounds();
    return res.json({ ...repasse, proximo_vencimento: nextMonday.toISOString(), status_repasse: pro.status_repasse });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── POST /repasse/comprovante ────────────────────────────────────────────────
router.post("/repasse/comprovante", upload.single("file"), async (req: Request, res: Response) => {
  await ensureRepassesProTable();
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "Não autenticado" });
  if (!req.file) return res.status(400).json({ error: "no_file" });
  try {
    const domain = process.env["REPLIT_DEV_DOMAIN"] || req.headers.host;
    const protocol = String(domain).includes("replit") ? "https" : "http";
    const url = `${protocol}://${domain}/uploads/${req.file.filename}`;
    const { semanaInicio } = getWeekBounds();
    const updated = await db.execute(sql`
      UPDATE repasses_pro SET comprovante = ${url}, status = 'aguardando'
      WHERE profissional_id = ${motoristaId} AND semana_inicio = ${semanaInicio}
      RETURNING *
    `);
    if (!updated.rows.length) return res.status(404).json({ error: "repasse_not_found" });
    return res.json({ ok: true, url });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

const genericUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// ── POST /upload ────────────────────────────────────────────────────────────
router.post("/upload", genericUpload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "no_file" });
  try {
    const url = await uploadImageToGCS(req.file.buffer, req.file.originalname, "docs");
    return res.json({ url, filename: url.split("/").pop() });
  } catch (err) {
    console.error("upload error:", err);
    return res.status(500).json({ error: "Erro ao enviar arquivo" });
  }
});

// ── GET /admin/documentos — Motoristas ─────────────────────────────────────
router.get("/admin/documentos", requireAdmin, async (_req: Request, res: Response) => {
  try {
    await ensureExtraDocColumns();
    const rows = await db.execute(sql`
      SELECT id, nome, telefone, email, status, tipo_veiculo, tipo_profissional,
             doc_cnh, doc_cnh_status, doc_veiculo, doc_veiculo_status,
             doc_selfie, doc_selfie_status, doc_antecedentes, doc_antecedentes_status,
             doc_rg, doc_rg_status, criado_em
      FROM motoristas_app WHERE tipo_profissional = 'motorista'
      ORDER BY criado_em DESC
    `);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── GET /admin/entregadores/documentos ─────────────────────────────────────
router.get("/admin/entregadores/documentos", requireAdmin, async (_req: Request, res: Response) => {
  try {
    await ensureExtraDocColumns();
    const rows = await db.execute(sql`
      SELECT id, nome, telefone, email, status, tipo_veiculo, tipo_profissional,
             doc_cnh, doc_cnh_status, doc_veiculo, doc_veiculo_status,
             doc_selfie, doc_selfie_status, doc_rg, doc_rg_status, criado_em
      FROM motoristas_app WHERE tipo_profissional = 'entregador'
      ORDER BY criado_em DESC
    `);
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── PATCH /admin/:id/documentos/:tipo/status ───────────────────────────────
router.patch("/admin/:id/documentos/:tipo/status", requireAdmin, async (req: Request, res: Response) => {
  try {
    await ensureExtraDocColumns();
    const { status } = req.body;
    const { id, tipo } = req.params;
    const ALLOWED: Record<string, string> = {
      cnh: "doc_cnh_status", veiculo: "doc_veiculo_status", selfie: "doc_selfie_status",
      antecedentes: "doc_antecedentes_status", rg: "doc_rg_status",
    };
    const VALID = ["pendente", "em_analise", "aprovado", "rejeitado"];
    if (!ALLOWED[String(tipo)]) return res.status(400).json({ error: "invalid_tipo" });
    if (!VALID.includes(status)) return res.status(400).json({ error: "invalid_status" });
    const col = ALLOWED[String(tipo)]!;
    await db.execute(sql.raw(`UPDATE motoristas_app SET ${col} = '${esc(status)}' WHERE id = ${Number(id)}`));
    return res.json({ id: Number(id), tipo, status });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── CORRIDAS SOLICITADAS ────────────────────────────────────────────────────
async function ensureCorridasTable() {
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS corridas_solicitadas (
      id SERIAL PRIMARY KEY,
      motorista_id INTEGER NOT NULL,
      tipo_servico VARCHAR(20) DEFAULT 'corrida',
      categoria_nome VARCHAR(100) DEFAULT 'GoTaxi X',
      valor_estimado DECIMAL(10,2) DEFAULT 0,
      origem_endereco TEXT,
      destino_endereco TEXT,
      distancia_motorista_km DECIMAL(5,2) DEFAULT 0,
      tempo_motorista_min INTEGER DEFAULT 0,
      distancia_viagem_km DECIMAL(5,2) DEFAULT 0,
      tempo_viagem_min INTEGER DEFAULT 0,
      cliente_nome VARCHAR(150),
      cliente_rating DECIMAL(3,2) DEFAULT 5.0,
      cliente_avaliacoes INTEGER DEFAULT 0,
      status VARCHAR(20) DEFAULT 'aguardando',
      criado_em TIMESTAMP DEFAULT NOW(),
      expira_em TIMESTAMP DEFAULT NOW() + INTERVAL '30 seconds'
    )
  `));
  await db.execute(sql.raw(`ALTER TABLE corridas_solicitadas ADD COLUMN IF NOT EXISTS forma_pagamento TEXT`));
  await db.execute(sql.raw(`ALTER TABLE corridas_solicitadas ADD COLUMN IF NOT EXISTS payment_source TEXT NOT NULL DEFAULT 'direto'`));
  await db.execute(sql.raw(`ALTER TABLE corridas ADD COLUMN IF NOT EXISTS customer_id INTEGER`));
}

// GET /corrida-pendente — poll for pending ride (driver app)
router.get("/corrida-pendente", async (req: Request, res: Response) => {
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "unauthorized" });
  try {
    await ensureCorridasTable();
    // Auto-expire old rides
    await db.execute(sql.raw(`
      UPDATE corridas_solicitadas SET status = 'expirada'
      WHERE status = 'aguardando' AND expira_em < NOW()
    `));
    const rows = await db.execute(sql.raw(`
      SELECT cs.*
      FROM corridas_solicitadas cs
      JOIN motoristas_app ma ON ma.id = cs.motorista_id
      WHERE cs.motorista_id = ${motoristaId} AND cs.status = 'aguardando'
        AND (
          (COALESCE(cs.payment_source, 'direto') = 'direto' AND ma.aceita_pagamento_direto = true)
          OR (cs.payment_source = 'mercado_pago' AND ma.aceita_pagamento_app = true AND EXISTS (SELECT 1 FROM motorista_mercado_pago_connections mp WHERE mp.motorista_id = ma.id AND mp.status = 'active' AND (mp.expires_at > NOW() OR mp.encrypted_refresh_token IS NOT NULL)))
        )
      ORDER BY criado_em DESC LIMIT 1
    `));
    if (!rows.rows.length) return res.json(null);
    return res.json(await withDriverPaymentStatus(rows.rows[0]));
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// POST /corrida/:id/aceitar
router.post("/corrida/:id/aceitar", async (req: Request, res: Response) => {
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "unauthorized" });
  try {
    await ensureCorridasTable();

    const corridaId = await db.transaction(async tx => {
    const updRows = await tx.execute(sql.raw(`
      UPDATE corridas_solicitadas SET status = 'aceita'
      WHERE id = ${Number(req.params.id)} AND motorista_id = ${motoristaId} AND status = 'aguardando'
      RETURNING corrida_id
    `));

    if (!updRows.rows.length) return null;

    const corrida_id = (updRows.rows[0] as any).corrida_id;

    // Get driver info to update main corridas table
    const driverRows = await tx.execute(sql.raw(`
      SELECT nome FROM motoristas_app WHERE id = ${motoristaId}
    `));
    const motoristaNome = driverRows.rows.length > 0 ? (driverRows.rows[0] as any).nome : "Motorista";

    // Sync status to main corridas table so passenger app sees the update
    if (corrida_id) {
      await tx.execute(sql.raw(`
        UPDATE corridas SET
          status = 'aceita',
          motorista_app_id = ${motoristaId},
          motorista_app_nome = '${motoristaNome.replace(/'/g, "''")}'
        WHERE id = ${corrida_id} AND status = 'aguardando'
      `));
      await snapshotServiceCommission(tx, "motorista", Number(corrida_id), motoristaId);
    }
    return Number(corrida_id);
    });
    if (!corridaId) return res.status(409).json({ error: "corrida_indisponivel" });

    return res.json({ ok: true, corrida_id: corridaId });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// POST /corrida/:id/recusar
router.post("/corrida/:id/recusar", async (req: Request, res: Response) => {
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "unauthorized" });
  try {
    await ensureCorridasTable();
    await db.execute(sql.raw(`
      UPDATE corridas_solicitadas SET status = 'recusada'
      WHERE id = ${Number(req.params.id)} AND motorista_id = ${motoristaId} AND status = 'aguardando'
    `));
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// GET /corrida-ativa — returns the currently accepted/in-progress ride
router.get("/corrida-ativa", async (req: Request, res: Response) => {
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "unauthorized" });
  try {
    await ensureCorridasTable();
    const rows = await db.execute(sql.raw(`
      SELECT * FROM corridas_solicitadas
      WHERE motorista_id = ${motoristaId} AND status IN ('aceita', 'em_andamento', 'finalizando_pagamento')
      ORDER BY criado_em DESC LIMIT 1
    `));
    if (!rows.rows.length) return res.json(null);
    return res.json(await withDriverPaymentStatus(rows.rows[0]));
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// POST /corrida/:id/chegou-embarque — driver arrived at pickup
router.post("/corrida/:id/chegou-embarque", async (req: Request, res: Response) => {
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "unauthorized" });
  try {
    await ensureCorridasTable();
    await db.execute(sql.raw(`
      UPDATE corridas_solicitadas SET status = 'em_andamento'
      WHERE id = ${Number(req.params.id)} AND motorista_id = ${motoristaId} AND status = 'aceita'
    `));
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// POST /corrida/:id/chegou-destino — driver arrived at destination (notifies passenger)
router.post("/corrida/:id/chegou-destino", async (req: Request, res: Response) => {
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "unauthorized" });
  try {
    await ensureCorridasTable();
    // Update corridas table so the passenger's poll detects it
    await db.execute(sql.raw(`
      UPDATE corridas SET status = 'chegou_destino'
      WHERE status IN ('aceita','a_caminho','em_andamento','chegou_destino')
        AND id = (
          SELECT corrida_id FROM corridas_solicitadas
          WHERE id = ${Number(req.params.id)} AND motorista_id = ${motoristaId} AND status = 'em_andamento'
        )
    `));
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// POST /corrida/:id/finalizar — driver completed the ride
router.post("/corrida/:id/finalizar", async (req: Request, res: Response) => {
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "unauthorized" });
  try {
    await ensureCorridasTable();
    const reserved = await db.transaction(async tx => {
      const ride = await tx.execute(sql`SELECT cs.status, cs.valor_estimado, cs.corrida_id, COALESCE(c.payment_source, cs.payment_source, 'direto') AS payment_source
        FROM corridas_solicitadas cs JOIN corridas c ON c.id = cs.corrida_id JOIN motoristas_app ma ON ma.id = cs.motorista_id
        WHERE cs.id = ${Number(req.params.id)} AND cs.motorista_id = ${motoristaId} AND ma.ativo = true AND ma.status = 'aprovado' FOR UPDATE OF cs, c, ma`);
      const row = ride.rows[0] as any;
      if (!row || !["em_andamento", "finalizando_pagamento", "finalizada"].includes(String(row.status))) return null;
      if (row.status === "finalizada") return { ...row, duplicate: true };
      if (row.payment_source !== "direto") {
        const intent = await tx.execute(sql`SELECT id, status FROM payment_transactions WHERE module = 'motorista' AND reference_id = ${String(row.corrida_id)} FOR UPDATE`);
        if (intent.rows.length !== 1) return { invalidIntent: "payment_intent_required" };
        if (["rejected", "cancelled", "refunded"].includes(String((intent.rows[0] as any).status))) return { invalidIntent: "payment_rejected" };
      }
      if (row.status === "em_andamento") {
        await tx.execute(sql`UPDATE corridas_solicitadas SET status = 'finalizando_pagamento' WHERE id = ${Number(req.params.id)} AND status = 'em_andamento'`);
        await tx.execute(sql`UPDATE corridas SET status = 'finalizando_pagamento' WHERE id = ${row.corrida_id}`);
      }
      return { ...row, duplicate: false };
    });
    if (!reserved) { res.status(404).json({ error: "corrida_not_found_or_not_finalizable" }); return; }
    if (reserved.invalidIntent) { res.status(409).json({ error: reserved.invalidIntent, paymentStatus: reserved.invalidIntent === "payment_rejected" ? "rejected" : undefined }); return; }
    let prePayment: any = null;
    try {
      prePayment = reserved.payment_source === "direto" ? null : await finalizeServicePayment("motorista", String(reserved.corrida_id), req);
      if (reserved.payment_source !== "direto" && prePayment?.status !== "approved") {
        throw new Error(["rejected", "cancelled", "refunded"].includes(String(prePayment?.status)) ? "payment_rejected" : "payment_pending");
      }
      if (prePayment && ["rejected", "cancelled", "refunded"].includes(String(prePayment.status))) throw new Error("payment_rejected");
    } catch (error) {
      await db.transaction(async tx => {
        await tx.execute(sql`UPDATE corridas_solicitadas SET status = 'em_andamento' WHERE id = ${Number(req.params.id)} AND motorista_id = ${motoristaId} AND status = 'finalizando_pagamento'`);
        await tx.execute(sql`UPDATE corridas SET status = 'em_andamento' WHERE id = ${reserved.corrida_id} AND status = 'finalizando_pagamento'`);
      });
      if (error instanceof Error && ["payment_rejected", "payment_pending"].includes(error.message)) {
        res.status(409).json({ error: error.message, paymentStatus: error.message === "payment_rejected" ? "rejected" : "pending" }); return;
      }
      throw error;
    }
    const finalized = await db.transaction(async tx => {
      const state = await tx.execute(sql`SELECT c.status AS service_status, cs.status AS assignment_status
        FROM corridas c JOIN corridas_solicitadas cs ON cs.corrida_id = c.id
        WHERE c.id = ${reserved.corrida_id} AND cs.id = ${Number(req.params.id)} FOR UPDATE OF c, cs`);
      const current = state.rows[0] as any;
      if (!current) return null;
      if (reserved.duplicate) {
        if (current.service_status !== "concluida" || current.assignment_status !== "finalizada") return null;
        return { ...reserved, valor: Number(reserved.valor_estimado) || 0 };
      }
      if (reserved.payment_source !== "direto") {
        const paymentRows = await tx.execute(sql`SELECT method, status FROM payment_transactions
          WHERE module = 'motorista' AND reference_id = ${String(reserved.corrida_id)} FOR UPDATE`);
        const payment = paymentRows.rows[0] as any;
        if (payment?.status !== "approved") {
          return { ...reserved, paymentBlocked: String(payment.status ?? "pending") };
        }
      }
      if (current.service_status !== "finalizando_pagamento" || current.assignment_status !== "finalizando_pagamento") return null;
      const changed = await tx.execute(sql`UPDATE corridas_solicitadas SET status = 'finalizada' WHERE id = ${Number(req.params.id)} AND motorista_id = ${motoristaId} AND status = 'finalizando_pagamento' RETURNING valor_estimado`);
      if (!changed.rows[0]) return null;
      const serviceChanged = await tx.execute(sql`UPDATE corridas SET status = 'concluida', concluido_em = COALESCE(concluido_em, NOW()) WHERE id = ${reserved.corrida_id} AND status = 'finalizando_pagamento' RETURNING id`);
      if (!serviceChanged.rows[0]) return null;
      return { ...reserved, valor: Number((changed.rows[0] as any)?.valor_estimado ?? reserved.valor_estimado) || 0 };
    });
    if (finalized?.paymentBlocked) {
      await db.transaction(async tx => {
        await tx.execute(sql`UPDATE corridas_solicitadas SET status = 'em_andamento' WHERE id = ${Number(req.params.id)} AND motorista_id = ${motoristaId} AND status = 'finalizando_pagamento'`);
        await tx.execute(sql`UPDATE corridas SET status = 'em_andamento' WHERE id = ${reserved.corrida_id} AND status = 'finalizando_pagamento'`);
      });
      res.status(409).json({ error: finalized.paymentBlocked === "rejected" ? "payment_rejected" : "payment_pending", paymentStatus: finalized.paymentBlocked });
      return;
    }
    if (!finalized) { res.status(409).json({ error: "finalization_reservation_lost" }); return; }
    if (finalized.payment_source === "direto") await settleServiceEarning("motorista", String(finalized.corrida_id), null);
    else if (prePayment?.status === "approved") await settleServiceEarning("motorista", String(finalized.corrida_id), Number(prePayment.id));
    // A solicitação pelo app já registra este mesmo evento. Repetir aqui é
    // seguro e cobre corridas legadas, pois tipo/referência são idênticos.
    try {
      const clienteRows = await db.execute(sql`SELECT customer_id, passageiro_telefone, valor, forma_pagamento
        FROM corridas WHERE id = ${Number(finalized.corrida_id)} LIMIT 1`);
      const corrida = clienteRows.rows[0] as any;
      const cliente = await resolveClienteComissao(corrida?.customer_id, null, corrida?.passageiro_telefone);
      // Corridas corporativas são comissionadas apenas quando o fluxo
      // corporativo confirma o valor final, não nesta etapa operacional.
      if (cliente && corrida?.forma_pagamento !== "corporativo") await gerarComissaoCliente({ usuarioId: cliente.id, usuarioEmail: cliente.email, usuarioTelefone: cliente.telefone, valor: corrida?.valor, tipoEvento: "corrida", referenciaId: Number(finalized.corrida_id), descricao: `Corrida #${finalized.corrida_id}` });
    } catch (commErr) { console.error("[corrida/finalizar] comissão erro:", commErr); }
    return res.json({ ok: true, valor: finalized.valor, duplicate: finalized.duplicate, paymentStatus: prePayment ? (prePayment.status === "approved" ? "pago" : "pendente") : "direto", paymentSource: finalized.payment_source, pix: prePayment?.pix ?? null });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// PDV deliveries (pizzaria-style assignments) — boy-side endpoints
// ─────────────────────────────────────────────────────────────────────────────

let _pdvSchemaReady = false;
async function ensurePdvBoySchema() {
  if (_pdvSchemaReady) return;
  await db.execute(sql.raw(`ALTER TABLE pedidos_pdv ADD COLUMN IF NOT EXISTS saiu_em TIMESTAMP`));
  _pdvSchemaReady = true;
}

// GET /pdv/minhas-entregas — list active PDV deliveries assigned to me
router.get("/pdv/minhas-entregas", async (req: Request, res: Response) => {
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "unauthorized" });
  try {
    await ensurePdvBoySchema();

    const rows = await db.execute(sql.raw(`
      SELECT
        p.id, p.empresa_id, p.cliente_nome, p.cliente_whatsapp, p.cliente_endereco,
        p.total, p.taxa_entrega, p.forma_pagamento,
        p.observacoes, p.status, p.criado_em, p.pronto_em, p.saiu_em,
        e.nome AS empresa_nome, e.telefone AS empresa_telefone,
        cep.endereco_restaurante, cep.lat_restaurante, cep.lng_restaurante,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'nome', i.produto_nome,
            'qtd', i.quantidade,
            'observacoes', i.observacoes
          ) ORDER BY i.id)
          FROM itens_pedido_pdv i WHERE i.pedido_id = p.id),
          '[]'::json
        ) AS itens
      FROM pedidos_pdv p
      JOIN empresas e ON e.id = p.empresa_id
      LEFT JOIN config_entrega_pdv cep ON cep.empresa_id = p.empresa_id
      WHERE p.boy_id = ${motoristaId}
        AND p.status NOT IN ('entregue','cancelado')
      ORDER BY p.criado_em ASC
    `));
    return res.json(rows.rows);
  } catch (err) { console.error("[minhas-entregas]", err); return res.status(500).json({ error: "server_error" }); }
});

// POST /pdv/entrega/:id/saiu — boy left for delivery
router.post("/pdv/entrega/:id/saiu", async (req: Request, res: Response) => {
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "unauthorized" });
  const pedidoId = Number(req.params.id);
  if (!pedidoId) return res.status(400).json({ error: "bad_request" });
  try {
    await ensurePdvBoySchema();
    const r = await db.execute(sql.raw(`
      UPDATE pedidos_pdv
      SET status = 'saiu_entrega', saiu_em = NOW(), atualizado_em = NOW()
      WHERE id = ${pedidoId} AND boy_id = ${motoristaId} AND status IN ('pronto','preparando','novo','pendente')
      RETURNING id, modulo, cliente_nome, cliente_whatsapp, total, taxa_entrega
    `));
    if (!r.rows.length) return res.status(404).json({ error: "not_found_or_not_yours" });
    // Keep entregas_solicitadas in sync (em_andamento = heading to destination)
    try {
      await db.execute(sql.raw(`
        UPDATE entregas_solicitadas SET status = 'em_andamento'
        WHERE pedido_pdv_id = ${pedidoId} AND profissional_id = ${motoristaId} AND status = 'aceita'
      `));
    } catch (_) { /* best-effort */ }
    return res.json({ ok: true });
  } catch (err) { console.error("[saiu]", err); return res.status(500).json({ error: "server_error" }); }
});

// POST /pdv/entrega/:id/entregue — boy delivered the order
router.post("/pdv/entrega/:id/entregue", async (req: Request, res: Response) => {
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "unauthorized" });
  const pedidoId = Number(req.params.id);
  if (!pedidoId) return res.status(400).json({ error: "bad_request" });
  try {
    const r = await db.execute(sql.raw(`
      UPDATE pedidos_pdv
      SET status = 'entregue', entregue_em = NOW(), atualizado_em = NOW()
      WHERE id = ${pedidoId} AND boy_id = ${motoristaId} AND status NOT IN ('entregue','cancelado')
      RETURNING id, modulo, cliente_nome, cliente_whatsapp, total, taxa_entrega
    `));
    if (!r.rows.length) return res.status(404).json({ error: "not_found_or_not_yours" });
    // Finalize the linked entregas_solicitadas record so it no longer appears as active
    // in the Pedidos tab (and is counted correctly in earnings with isenção).
    try {
      await db.execute(sql.raw(`
        UPDATE entregas_solicitadas SET status = 'finalizada'
        WHERE pedido_pdv_id = ${pedidoId} AND profissional_id = ${motoristaId}
          AND status NOT IN ('finalizada','cancelada')
      `));
      await db.execute(sql.raw(`
        UPDATE motoristas_app SET total_corridas = COALESCE(total_corridas, 0) + 1
        WHERE id = ${motoristaId}
      `));
    } catch (_) { /* best-effort */ }
    const pedido = r.rows[0] as any;
    // Pedidos food já recebem comissão na criação com esta mesma chave; a
    // chamada idempotente cobre pedidos PDV criados sem o fluxo food.
    try {
      if (pedido.modulo !== "ecommerce") {
        const cliente = await resolveClienteComissao(null, null, pedido.cliente_whatsapp);
        if (cliente) await gerarComissaoCliente({ usuarioId: cliente.id, usuarioEmail: cliente.email, usuarioTelefone: cliente.telefone, valor: Number(pedido.total || pedido.taxa_entrega || 0), tipoEvento: pedido.modulo === "food" ? "pedido_food" : "pedido_pdv", origemEvento: "pedidos_pdv", referenciaId: pedidoId, descricao: `Pedido delivery #${pedidoId}` });
      }
    } catch (commErr) { console.error("[pdv/entrega] comissão erro:", commErr); }
    return res.json({ ok: true });
  } catch (err) { console.error("[entregue]", err); return res.status(500).json({ error: "server_error" }); }
});

// POST /pdv/entrega/:id/recusar — boy refuses the assignment (clears boy_id)
router.post("/pdv/entrega/:id/recusar", async (req: Request, res: Response) => {
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "unauthorized" });
  const pedidoId = Number(req.params.id);
  if (!pedidoId) return res.status(400).json({ error: "bad_request" });
  try {
    const r = await db.execute(sql.raw(`
      UPDATE pedidos_pdv
      SET boy_id = NULL, atualizado_em = NOW()
      WHERE id = ${pedidoId} AND boy_id = ${motoristaId} AND status NOT IN ('entregue','cancelado','saiu_entrega')
      RETURNING id
    `));
    if (!r.rows.length) return res.status(404).json({ error: "not_found_or_already_started" });
    return res.json({ ok: true });
  } catch (err) { console.error("[recusar]", err); return res.status(500).json({ error: "server_error" }); }
});

// ── FCM push notification sender ─────────────────────────────────────────────
export async function sendFcmNotification(fcmToken: string, title: string, body: string, data: Record<string, string> = {}) {
  const serverKey = process.env.FIREBASE_SERVER_KEY;
  if (!serverKey || !fcmToken) return;
  try {
    const payload = {
      to: fcmToken,
      priority: "high",
      notification: {
        title,
        body,
        sound: "default",
        android_channel_id: "corrida_channel",
      },
      android: {
        priority: "high",
        notification: {
          channel_id: "corrida_channel",
          sound: "default",
          default_vibrate_timings: false,
          vibrate_timings_millis: [0, 500, 300, 500, 300, 500],
          notification_priority: "PRIORITY_MAX",
          visibility: "PUBLIC",
        },
      },
      apns: {
        headers: { "apns-priority": "10" },
        payload: {
          aps: {
            sound: "default",
            badge: 1,
            "content-available": 1,
          },
        },
      },
      data: { ...data, click_action: "FLUTTER_NOTIFICATION_CLICK" },
    };
    const resp = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `key=${serverKey}`,
      },
      body: JSON.stringify(payload),
    });
    const result = await resp.json() as any;
    if (result.failure) console.error("FCM send error:", JSON.stringify(result));
    else console.log("FCM sent ok, messageId:", result.results?.[0]?.message_id);
  } catch (err) {
    console.error("FCM send exception:", err);
  }
}

// POST /corrida/simular — create a test ride for a motorista (admin/testing)
router.post("/corrida/simular", requireAdmin, async (req: Request, res: Response) => {
  const { motorista_id, tipo_servico = "corrida", categoria_nome = "GoTaxi X",
    valor_estimado = 18.50, origem_endereco = "R. Benedito Leite, 300 — Centro",
    destino_endereco = "Av. Paulista, 1578 — Bela Vista, São Paulo",
    distancia_motorista_km = 1.7, tempo_motorista_min = 5,
    distancia_viagem_km = 5.8, tempo_viagem_min = 13,
    cliente_nome = "Cliente Teste", cliente_rating = 4.95, cliente_avaliacoes = 466
  } = req.body;
  if (!motorista_id) return res.status(400).json({ error: "motorista_id required" });
  try {
    await ensureCorridasTable();
    // Cancel any previous pending for this motorista
    await db.execute(sql.raw(`
      UPDATE corridas_solicitadas SET status = 'cancelada'
      WHERE motorista_id = ${Number(motorista_id)} AND status = 'aguardando'
    `));
    const rows = await db.execute(sql.raw(`
      INSERT INTO corridas_solicitadas
        (motorista_id, tipo_servico, categoria_nome, valor_estimado,
         origem_endereco, destino_endereco,
         distancia_motorista_km, tempo_motorista_min,
         distancia_viagem_km, tempo_viagem_min,
         cliente_nome, cliente_rating, cliente_avaliacoes,
         expira_em)
      VALUES (
        ${Number(motorista_id)}, '${esc(tipo_servico)}', '${esc(categoria_nome)}',
        ${Number(valor_estimado)}, '${esc(origem_endereco)}', '${esc(destino_endereco)}',
        ${Number(distancia_motorista_km)}, ${Number(tempo_motorista_min)},
        ${Number(distancia_viagem_km)}, ${Number(tempo_viagem_min)},
        '${esc(cliente_nome)}', ${Number(cliente_rating)}, ${Number(cliente_avaliacoes)},
        NOW() + INTERVAL '30 seconds'
      ) RETURNING *
    `));
    const corrida = rows.rows[0] as any;

    // Send FCM push notification to driver's device
    const fcmRows = await db.execute(sql.raw(
      `SELECT fcm_token FROM motoristas_app WHERE id = ${Number(motorista_id)} AND fcm_token IS NOT NULL`
    ));
    const fcmToken = (fcmRows.rows[0] as any)?.fcm_token;
    if (fcmToken) {
      const tipoLabel: Record<string, string> = { corrida: "🚗 Nova Corrida", entrega: "📦 Nova Entrega", delivery: "🛵 Novo Delivery" };
      const title = tipoLabel[tipo_servico] || "🚗 Nova Corrida";
      const valor = `R$ ${Number(valor_estimado).toFixed(2).replace(".", ",")}`;
      await sendFcmNotification(
        fcmToken,
        `${title} — ${categoria_nome}`,
        `${valor} • ${distancia_viagem_km}km • ${origem_endereco}`,
        { corrida_id: String(corrida.id), tipo: tipo_servico }
      );
    }

    return res.json(corrida);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── ENTREGAS SOLICITADAS ────────────────────────────────────────────────────
async function ensureEntregasTable() {
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS entregas_solicitadas (
      id SERIAL PRIMARY KEY,
      profissional_id INTEGER NOT NULL,
      tipo_servico VARCHAR(20) DEFAULT 'entrega',
      categoria_nome VARCHAR(100) DEFAULT 'Entrega Padrão',
      valor_estimado DECIMAL(10,2) DEFAULT 0,
      coleta_endereco TEXT,
      entrega_endereco TEXT,
      distancia_profissional_km DECIMAL(5,2) DEFAULT 0,
      tempo_profissional_min INTEGER DEFAULT 0,
      distancia_entrega_km DECIMAL(5,2) DEFAULT 0,
      tempo_entrega_min INTEGER DEFAULT 0,
      cliente_nome VARCHAR(150),
      cliente_rating DECIMAL(3,2) DEFAULT 5.0,
      cliente_avaliacoes INTEGER DEFAULT 0,
      descricao_item TEXT,
      status VARCHAR(20) DEFAULT 'aguardando',
      criado_em TIMESTAMP DEFAULT NOW(),
      expira_em TIMESTAMP DEFAULT NOW() + INTERVAL '30 seconds'
    )
  `));
  await db.execute(sql.raw(`ALTER TABLE entregas_solicitadas ADD COLUMN IF NOT EXISTS forma_pagamento TEXT`));
  await db.execute(sql.raw(`ALTER TABLE entregas_solicitadas ADD COLUMN IF NOT EXISTS payment_source TEXT NOT NULL DEFAULT 'direto'`));
  await db.execute(sql.raw(`ALTER TABLE entregas ADD COLUMN IF NOT EXISTS customer_id INTEGER`));
}

// POST /entrega/simular — create a test delivery for entregador/delivery (admin)
router.post("/entrega/simular", requireAdmin, async (req: Request, res: Response) => {
  const {
    profissional_id, tipo_servico = "entrega", categoria_nome = "Entrega Padrão",
    valor_estimado = 15.00,
    coleta_endereco = "R. Augusta, 500 — Consolação, São Paulo",
    entrega_endereco = "Av. Paulista, 1578 — Bela Vista, São Paulo",
    distancia_profissional_km = 0.8, tempo_profissional_min = 3,
    distancia_entrega_km = 2.4, tempo_entrega_min = 8,
    cliente_nome = "Cliente Teste", cliente_rating = 4.90, cliente_avaliacoes = 212,
    descricao_item = "Encomenda pequena",
  } = req.body;
  if (!profissional_id) return res.status(400).json({ error: "profissional_id required" });
  try {
    await ensureEntregasTable();
    await db.execute(sql.raw(`
      UPDATE entregas_solicitadas SET status = 'cancelada'
      WHERE profissional_id = ${Number(profissional_id)} AND status = 'aguardando'
    `));
    const rows = await db.execute(sql.raw(`
      INSERT INTO entregas_solicitadas
        (profissional_id, tipo_servico, categoria_nome, valor_estimado,
         coleta_endereco, entrega_endereco,
         distancia_profissional_km, tempo_profissional_min,
         distancia_entrega_km, tempo_entrega_min,
         cliente_nome, cliente_rating, cliente_avaliacoes, descricao_item,
         expira_em)
      VALUES (
        ${Number(profissional_id)}, '${esc(tipo_servico)}', '${esc(categoria_nome)}',
        ${Number(valor_estimado)}, '${esc(coleta_endereco)}', '${esc(entrega_endereco)}',
        ${Number(distancia_profissional_km)}, ${Number(tempo_profissional_min)},
        ${Number(distancia_entrega_km)}, ${Number(tempo_entrega_min)},
        '${esc(cliente_nome)}', ${Number(cliente_rating)}, ${Number(cliente_avaliacoes)},
        '${esc(descricao_item)}',
        NOW() + INTERVAL '30 seconds'
      ) RETURNING *
    `));
    const entrega = rows.rows[0] as any;

    // FCM push notification
    const fcmRows = await db.execute(sql.raw(
      `SELECT fcm_token FROM motoristas_app WHERE id = ${Number(profissional_id)} AND fcm_token IS NOT NULL`
    ));
    const fcmToken = (fcmRows.rows[0] as any)?.fcm_token;
    if (fcmToken) {
      const tipoLabel: Record<string, string> = { entrega: "📦 Nova Entrega", delivery: "🛵 Novo Delivery" };
      const title = tipoLabel[tipo_servico] || "📦 Nova Entrega";
      const valor = `R$ ${Number(valor_estimado).toFixed(2).replace(".", ",")}`;
      await sendFcmNotification(
        fcmToken,
        `${title} — ${categoria_nome}`,
        `${valor} • ${distancia_entrega_km}km • ${coleta_endereco}`,
        { entrega_id: String(entrega.id), tipo: tipo_servico }
      );
    }

    return res.json(entrega);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// GET /entrega-pendente — poll for pending delivery
router.get("/entrega-pendente", async (req: Request, res: Response) => {
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "unauthorized" });
  try {
    await ensureEntregasTable();
    await db.execute(sql.raw(`
      UPDATE entregas_solicitadas SET status = 'expirada'
      WHERE status = 'aguardando' AND expira_em < NOW()
    `));
    const rows = await db.execute(sql.raw(`
      SELECT es.*,
        es.coleta_endereco AS origem_endereco,
        es.entrega_endereco AS destino_endereco,
        es.distancia_profissional_km AS distancia_motorista_km,
        es.tempo_profissional_min AS tempo_motorista_min,
        es.distancia_entrega_km AS distancia_viagem_km,
        es.tempo_entrega_min AS tempo_viagem_min
      FROM entregas_solicitadas es
      JOIN motoristas_app ma ON ma.id = es.profissional_id
      WHERE es.profissional_id = ${motoristaId} AND es.status = 'aguardando'
        AND (
          (COALESCE(es.payment_source, 'direto') = 'direto' AND ma.aceita_pagamento_direto = true)
          OR (es.payment_source IN ('mercado_pago', 'wallet') AND ma.aceita_pagamento_app = true AND EXISTS (SELECT 1 FROM motorista_mercado_pago_connections mp WHERE mp.motorista_id = ma.id AND mp.status = 'active' AND (mp.expires_at > NOW() OR mp.encrypted_refresh_token IS NOT NULL)))
        )
      ORDER BY criado_em DESC LIMIT 1
    `));
    if (!rows.rows.length) return res.json(null);
    return res.json(await withDriverPaymentStatus(rows.rows[0]));
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// POST /entrega/:id/aceitar
router.post("/entrega/:id/aceitar", async (req: Request, res: Response) => {
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "unauthorized" });
  try {
    await ensureEntregasTable();
    const accepted = await db.transaction(async tx => {
    const sel = await tx.execute(sql.raw(`
      SELECT entrega_id, pedido_pdv_id, empresa_id FROM entregas_solicitadas
      WHERE id = ${Number(req.params.id)} AND profissional_id = ${motoristaId} AND status = 'aguardando'
      FOR UPDATE
    `));
    if (!sel.rows.length) return { error: "not_found" as const };
    const row = sel.rows[0] as any;
    const entregaId = row.entrega_id;
    const pedidoPdvId = row.pedido_pdv_id;
    const empresaId = row.empresa_id;

    // ── Caso 1: entrega vem de pedido do PDV (auto-despacho de delivery) ──
    if (pedidoPdvId) {
      // Race-safe: só assume o pedido se ainda não tem boy. Tenant-isolado por empresa_id.
      const claim = await tx.execute(sql.raw(`
        UPDATE pedidos_pdv SET boy_id = ${motoristaId}
        WHERE id = ${Number(pedidoPdvId)} AND boy_id IS NULL
          ${empresaId ? `AND empresa_id = ${Number(empresaId)}` : ""}
          AND status NOT IN ('entregue','cancelado')
        RETURNING id
      `));
      if (!claim.rows.length) {
        await tx.execute(sql.raw(`
          UPDATE entregas_solicitadas SET status = 'expirada'
          WHERE id = ${Number(req.params.id)}
        `));
        return { error: "already_taken" as const };
      }
      // Cancela demais broadcasts deste pedido (perderam a corrida)
      await tx.execute(sql.raw(`
        UPDATE entregas_solicitadas SET status = 'cancelada'
        WHERE pedido_pdv_id = ${Number(pedidoPdvId)}
          AND id <> ${Number(req.params.id)}
          AND status = 'aguardando'
      `));
      await tx.execute(sql.raw(`
        UPDATE entregas_solicitadas SET status = 'aceita'
        WHERE id = ${Number(req.params.id)} AND profissional_id = ${motoristaId}
      `));
      return { pedidoPdvId: Number(pedidoPdvId) };
    }

    // ── Caso 2: entrega comum (módulo encomendas/entregas) ──
    if (entregaId) {
      const claim = await tx.execute(sql.raw(`
        UPDATE entregas SET motorista_id = ${motoristaId}, status = 'coletado'
        WHERE id = ${Number(entregaId)} AND motorista_id IS NULL
        RETURNING id
      `));
      if (!claim.rows.length) {
        await tx.execute(sql.raw(`
          UPDATE entregas_solicitadas SET status = 'expirada'
          WHERE id = ${Number(req.params.id)}
        `));
        return { error: "already_taken" as const };
      }
      await tx.execute(sql.raw(`
        UPDATE entregas_solicitadas SET status = 'cancelada'
        WHERE entrega_id = ${Number(entregaId)} AND id <> ${Number(req.params.id)} AND status = 'aguardando'
      `));
    }
    await tx.execute(sql.raw(`
      UPDATE entregas_solicitadas SET status = 'aceita'
      WHERE id = ${Number(req.params.id)} AND profissional_id = ${motoristaId}
    `));
    if (entregaId) {
      await snapshotServiceCommission(tx, "entrega", Number(entregaId), motoristaId);
    }
    return { entregaId: Number(entregaId) };
    });
    if ("error" in accepted) return res.status(accepted.error === "not_found" ? 404 : 409).json({ error: accepted.error });
    if ("pedidoPdvId" in accepted) return res.json({ ok: true, pedido_pdv_id: accepted.pedidoPdvId });
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// POST /entrega/:id/recusar
router.post("/entrega/:id/recusar", async (req: Request, res: Response) => {
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "unauthorized" });
  try {
    await ensureEntregasTable();
    await db.execute(sql.raw(`
      UPDATE entregas_solicitadas SET status = 'recusada'
      WHERE id = ${Number(req.params.id)} AND profissional_id = ${motoristaId} AND status = 'aguardando'
    `));
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// GET /entrega-ativa
router.get("/entrega-ativa", async (req: Request, res: Response) => {
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "unauthorized" });
  try {
    await ensureEntregasTable();
    // Exclude PDV-linked records — those are managed exclusively via /pdv/minhas-entregas (green screen).
    const rows = await db.execute(sql.raw(`
      SELECT * FROM entregas_solicitadas
      WHERE profissional_id = ${motoristaId}
        AND status IN ('aceita', 'em_andamento', 'finalizando_pagamento')
        AND pedido_pdv_id IS NULL
      ORDER BY criado_em DESC LIMIT 1
    `));
    if (!rows.rows.length) return res.json(null);
    return res.json(rows.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// POST /entrega/:id/chegou-coleta — arrived at pickup point
router.post("/entrega/:id/chegou-coleta", async (req: Request, res: Response) => {
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "unauthorized" });
  try {
    await ensureEntregasTable();
    await db.execute(sql.raw(`
      UPDATE entregas_solicitadas SET status = 'em_andamento'
      WHERE id = ${Number(req.params.id)} AND profissional_id = ${motoristaId} AND status = 'aceita'
    `));
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// POST /entrega/:id/finalizar
router.post("/entrega/:id/finalizar", async (req: Request, res: Response) => {
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "unauthorized" });
  try {
    await ensureEntregasTable();
    const reserved = await db.transaction(async tx => {
      const found = await tx.execute(sql`SELECT es.id, es.entrega_id, COALESCE(e.payment_source, es.payment_source, 'direto') AS payment_source, es.status
        FROM entregas_solicitadas es JOIN entregas e ON e.id = es.entrega_id JOIN motoristas_app ma ON ma.id = es.profissional_id
        WHERE es.id = ${Number(req.params.id)} AND es.profissional_id = ${motoristaId} AND ma.ativo = true AND ma.status = 'aprovado' FOR UPDATE OF es, e, ma`);
      const row = found.rows[0] as any;
      if (!row?.entrega_id || !["em_andamento", "finalizando_pagamento", "finalizada"].includes(String(row.status))) return null;
      if (row.status === "finalizada") return { ...row, duplicate: true };
      if (row.payment_source !== "direto") {
        const intent = await tx.execute(sql`SELECT id, status FROM payment_transactions WHERE module = 'entrega' AND reference_id = ${String(row.entrega_id)} FOR UPDATE`);
        if (intent.rows.length !== 1) return { invalidIntent: "payment_intent_required" };
        if (["rejected", "cancelled", "refunded"].includes(String((intent.rows[0] as any).status))) return { invalidIntent: "payment_rejected" };
      }
      if (row.status === "em_andamento") {
        await tx.execute(sql`UPDATE entregas_solicitadas SET status = 'finalizando_pagamento' WHERE id = ${row.id} AND status = 'em_andamento'`);
        await tx.execute(sql`UPDATE entregas SET status = 'finalizando_pagamento' WHERE id = ${row.entrega_id}`);
      }
      return { ...row, duplicate: false };
    });
    if (!reserved) { res.status(404).json({ error: "not_found_or_not_finalizable" }); return; }
    if (reserved.invalidIntent) { res.status(409).json({ error: reserved.invalidIntent, paymentStatus: reserved.invalidIntent === "payment_rejected" ? "rejected" : undefined }); return; }
    const source = String(reserved.payment_source || "direto");
    let prePayment: any = null;
    try {
      prePayment = source === "direto" ? null : await finalizeServicePayment("entrega", String(reserved.entrega_id), req);
      if (source !== "direto" && prePayment?.status !== "approved") {
        throw new Error(["rejected", "cancelled", "refunded"].includes(String(prePayment?.status)) ? "payment_rejected" : "payment_pending");
      }
      if (prePayment && ["rejected", "cancelled", "refunded"].includes(String(prePayment.status))) throw new Error("payment_rejected");
    } catch (error) {
      await db.transaction(async tx => {
        await tx.execute(sql`UPDATE entregas_solicitadas SET status = 'em_andamento' WHERE id = ${Number(req.params.id)} AND profissional_id = ${motoristaId} AND status = 'finalizando_pagamento'`);
        await tx.execute(sql`UPDATE entregas SET status = 'coletado' WHERE id = ${reserved.entrega_id} AND status = 'finalizando_pagamento'`);
      });
      if (error instanceof Error && ["payment_rejected", "payment_pending"].includes(error.message)) {
        res.status(409).json({ error: error.message, paymentStatus: error.message === "payment_rejected" ? "rejected" : "pending" }); return;
      }
      throw error;
    }
    const final = await db.transaction(async tx => {
      const state = await tx.execute(sql`SELECT e.status AS service_status, es.status AS assignment_status
        FROM entregas e JOIN entregas_solicitadas es ON es.entrega_id = e.id
        WHERE e.id = ${reserved.entrega_id} AND es.id = ${Number(req.params.id)} FOR UPDATE OF e, es`);
      const current = state.rows[0] as any;
      if (!current) return null;
      if (reserved.duplicate) {
        if (current.service_status !== "entregue" || current.assignment_status !== "finalizada") return null;
        return reserved;
      }
      if (source !== "direto") {
        const paymentRows = await tx.execute(sql`SELECT method, status FROM payment_transactions
          WHERE module = 'entrega' AND reference_id = ${String(reserved.entrega_id)} FOR UPDATE`);
        const payment = paymentRows.rows[0] as any;
        if (payment?.status !== "approved") {
          return { ...reserved, paymentBlocked: String(payment.status ?? "pending") };
        }
      }
      if (current.service_status !== "finalizando_pagamento" || current.assignment_status !== "finalizando_pagamento") return null;
      const changed = await tx.execute(sql`UPDATE entregas_solicitadas SET status = 'finalizada' WHERE id = ${Number(req.params.id)} AND profissional_id = ${motoristaId} AND status = 'finalizando_pagamento' RETURNING id`);
      if (!changed.rows[0]) return null;
      const serviceChanged = await tx.execute(sql`UPDATE entregas SET status = 'entregue' WHERE id = ${reserved.entrega_id} AND status = 'finalizando_pagamento' RETURNING id`);
      if (!serviceChanged.rows[0]) return null;
      return reserved;
    });
    if (final?.paymentBlocked) {
      await db.transaction(async tx => {
        await tx.execute(sql`UPDATE entregas_solicitadas SET status = 'em_andamento' WHERE id = ${Number(req.params.id)} AND profissional_id = ${motoristaId} AND status = 'finalizando_pagamento'`);
        await tx.execute(sql`UPDATE entregas SET status = 'coletado' WHERE id = ${reserved.entrega_id} AND status = 'finalizando_pagamento'`);
      });
      res.status(409).json({ error: final.paymentBlocked === "rejected" ? "payment_rejected" : "payment_pending", paymentStatus: final.paymentBlocked });
      return;
    }
    if (!final) { res.status(409).json({ error: "finalization_reservation_lost" }); return; }
    if (source === "direto") await settleServiceEarning("entrega", String(reserved.entrega_id), null);
    else if (prePayment?.status === "approved") await settleServiceEarning("entrega", String(reserved.entrega_id), Number(prePayment.id));
    try {
      const clienteRows = await db.execute(sql`SELECT customer_id, remetente_telefone, valor
        FROM entregas WHERE id = ${Number(reserved.entrega_id)} LIMIT 1`);
      const entrega = clienteRows.rows[0] as any;
      const cliente = await resolveClienteComissao(entrega?.customer_id, null, entrega?.remetente_telefone);
      if (cliente) await gerarComissaoCliente({ usuarioId: cliente.id, usuarioEmail: cliente.email, usuarioTelefone: cliente.telefone, valor: entrega?.valor, tipoEvento: "entrega", referenciaId: Number(reserved.entrega_id), descricao: `Entrega #${reserved.entrega_id}` });
    } catch (commErr) { console.error("[entrega/finalizar] comissão erro:", commErr); }
    return res.json({ ok: true, paymentSource: source, paymentStatus: prePayment ? (prePayment.status === "approved" ? "pago" : "pendente") : "direto", pix: prePayment?.pix ?? null });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── AGENDAMENTOS ──────────────────────────────────────────────────────────────

// GET /agenda — list upcoming scheduled items for the logged-in professional
router.get("/agenda", async (req: Request, res: Response) => {
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "unauthorized" });
  try {
    const rows = await db.execute(sql.raw(`
      SELECT id, tipo, data_hora, local_embarque, local_destino, valor,
             cliente_nome, cliente_whatsapp, observacoes, status, criado_em
      FROM pro_agendamentos
      WHERE profissional_id = ${motoristaId}
        AND status IN ('pendente','aceito')
        AND data_hora >= NOW() - INTERVAL '2 hours'
      ORDER BY data_hora ASC
      LIMIT 30
    `));
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// POST /agenda/:id/aceitar
router.post("/agenda/:id/aceitar", async (req: Request, res: Response) => {
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "unauthorized" });
  try {
    await db.execute(sql.raw(`
      UPDATE pro_agendamentos SET status = 'aceito'
      WHERE id = ${Number(req.params.id)} AND profissional_id = ${motoristaId} AND status = 'pendente'
    `));
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// POST /agenda/:id/recusar
router.post("/agenda/:id/recusar", async (req: Request, res: Response) => {
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "unauthorized" });
  try {
    await db.execute(sql.raw(`
      UPDATE pro_agendamentos SET status = 'recusado'
      WHERE id = ${Number(req.params.id)} AND profissional_id = ${motoristaId} AND status = 'pendente'
    `));
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── ADMIN: Agendamentos ───────────────────────────────────────────────────────

// GET /admin/agendamentos
router.get("/admin/agendamentos", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, tipo, profissional_id } = req.query;
    let where = "WHERE 1=1";
    if (status) where += ` AND a.status = '${String(status).replace(/'/g,"")}'`;
    if (tipo)   where += ` AND a.tipo = '${String(tipo).replace(/'/g,"")}'`;
    if (profissional_id) where += ` AND a.profissional_id = ${Number(profissional_id)}`;
    const rows = await db.execute(sql.raw(`
      SELECT a.id, a.tipo, a.data_hora, a.local_embarque, a.local_destino,
             a.valor, a.cliente_nome, a.cliente_whatsapp, a.observacoes,
             a.status, a.criado_em,
             m.nome AS profissional_nome, m.telefone AS profissional_telefone,
             m.tipo_profissional
      FROM pro_agendamentos a
      LEFT JOIN motoristas_app m ON m.id = a.profissional_id
      ${where}
      ORDER BY a.data_hora ASC
      LIMIT 200
    `));
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// POST /admin/agendamentos — create new scheduled ride/delivery
router.post("/admin/agendamentos", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { tipo, profissionalId, dataHora, localEmbarque, localDestino, valor, clienteNome, clienteWhatsapp, observacoes } = req.body;
    if (!dataHora || !localEmbarque) return res.status(400).json({ error: "data_hora e local_embarque são obrigatórios" });
    const rows = await db.execute(sql.raw(`
      INSERT INTO pro_agendamentos (tipo, profissional_id, data_hora, local_embarque, local_destino, valor, cliente_nome, cliente_whatsapp, observacoes, status)
      VALUES (
        '${(tipo || "corrida").replace(/'/g,"")}',
        ${profissionalId ? Number(profissionalId) : "NULL"},
        '${String(dataHora).replace(/'/g,"")}',
        '${String(localEmbarque).replace(/'/g,"")}',
        ${localDestino ? `'${String(localDestino).replace(/'/g,"")}'` : "NULL"},
        ${Number(valor) || 0},
        ${clienteNome ? `'${String(clienteNome).replace(/'/g,"")}'` : "NULL"},
        ${clienteWhatsapp ? `'${String(clienteWhatsapp).replace(/'/g,"")}'` : "NULL"},
        ${observacoes ? `'${String(observacoes).replace(/'/g,"")}'` : "NULL"},
        'pendente'
      ) RETURNING *
    `));
    return res.status(201).json(rows.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// PATCH /admin/agendamentos/:id — update status or assign profissional
router.patch("/admin/agendamentos/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { status, profissionalId } = req.body;
    const updates: string[] = [];
    if (status)        updates.push(`status = '${String(status).replace(/'/g,"")}'`);
    if (profissionalId !== undefined) updates.push(`profissional_id = ${profissionalId ? Number(profissionalId) : "NULL"}`);
    if (!updates.length) return res.status(400).json({ error: "no_fields" });
    const rows = await db.execute(sql.raw(`UPDATE pro_agendamentos SET ${updates.join(", ")} WHERE id = ${id} RETURNING *`));
    if (!rows.rows.length) return res.status(404).json({ error: "not_found" });
    return res.json(rows.rows[0]);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// DELETE /admin/agendamentos/:id
router.delete("/admin/agendamentos/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    await db.execute(sql.raw(`DELETE FROM pro_agendamentos WHERE id = ${Number(req.params.id)}`));
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── POST /motorista-app/localizacao ──────────────────────────────────────────
// Driver sends their current position; sets them online and updates last ping.
router.post("/localizacao", async (req: Request, res: Response) => {
  try {
    const motoristaId = getMotoristaId(req);
    if (!motoristaId) return res.status(401).json({ error: "invalid_token" });

    const { lat, lng, online } = req.body;
    if (lat == null || lng == null) return res.status(400).json({ error: "lat e lng obrigatorios" });

    await db.execute(sql`
      UPDATE motoristas_app
      SET lat = ${Number(lat)}, lng = ${Number(lng)},
          online = ${online !== false},
          ultimo_ping = NOW()
      WHERE id = ${motoristaId}
    `);
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── Motivos de cancelamento ────────────────────────────────────────────────────
async function ensureMotivosTable() {
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS motivos_cancelamento (
      id SERIAL PRIMARY KEY,
      texto TEXT NOT NULL,
      ativo BOOLEAN NOT NULL DEFAULT true,
      criado_em TIMESTAMP DEFAULT NOW()
    )
  `));
  await db.execute(sql.raw(`
    ALTER TABLE corridas_solicitadas ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT
  `));
  const exists = await db.execute(sql.raw(`SELECT 1 FROM motivos_cancelamento LIMIT 1`));
  if (!exists.rows.length) {
    await db.execute(sql.raw(`
      INSERT INTO motivos_cancelamento (texto) VALUES
        ('Passageiro não estava no local'),
        ('Passageiro solicitou cancelamento'),
        ('Problema com o veículo'),
        ('Rota perigosa ou inacessível'),
        ('Emergência pessoal'),
        ('Outro motivo')
    `));
  }
}

// GET /motorista-app/motivos-cancelamento
router.get("/motivos-cancelamento", async (req: Request, res: Response) => {
  try {
    await ensureMotivosTable();
    const rows = await db.execute(sql.raw(`SELECT id, texto FROM motivos_cancelamento WHERE ativo = true ORDER BY id`));
    return res.json(rows.rows);
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// POST /motorista-app/corrida/:id/cancelar
router.post("/corrida/:id/cancelar", async (req: Request, res: Response) => {
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "unauthorized" });
  try {
    await ensureMotivosTable();
    await ensureCorridasTable();
    const { motivo_texto } = req.body;
    const texto = String(motivo_texto || "").slice(0, 500);
    const cancelled = await db.transaction(async tx => {
      const locked = await tx.execute(sql`SELECT cs.id, cs.corrida_id, cs.status AS assignment_status,
          c.status AS service_status, COALESCE(c.payment_source, cs.payment_source, 'direto') AS payment_source
        FROM corridas_solicitadas cs
        JOIN corridas c ON c.id = cs.corrida_id
        JOIN motoristas_app ma ON ma.id = cs.motorista_id
        WHERE cs.id = ${Number(req.params.id)} AND cs.motorista_id = ${motoristaId}
          AND ma.ativo = true AND ma.status = 'aprovado'
        FOR UPDATE OF c, cs, ma`);
      const row = locked.rows[0] as any;
      if (!row) return { error: "not_found", status: 404 };
      const assignmentAllowed = ["aguardando", "aceita", "em_andamento"].includes(String(row.assignment_status));
      const serviceAllowed = ["aguardando", "aceita", "a_caminho", "chegou_destino", "em_andamento"].includes(String(row.service_status));
      if (!assignmentAllowed || !serviceAllowed) return { error: "ride_not_cancellable", status: 409 };
      if (row.payment_source !== "direto") {
        const intents = await tx.execute(sql`SELECT id, status FROM payment_transactions
          WHERE module = 'motorista' AND reference_id = ${String(row.corrida_id)} FOR UPDATE`);
        if (intents.rows.length !== 1) return { error: "payment_intent_required", status: 409 };
        const intent = intents.rows[0] as any;
        if (String(intent.status) !== "pending") return { error: "payment_not_cancellable", status: 409 };
        await tx.execute(sql`UPDATE payment_transactions SET status = 'cancelled',
          metadata = COALESCE(metadata, '{}'::jsonb) - 'pix', updated_at = NOW() WHERE id = ${intent.id} AND status = 'pending'`);
      }
      const service = await tx.execute(sql`UPDATE corridas SET status = 'cancelada', cancelado_em = NOW()
        WHERE id = ${row.corrida_id} AND status IN ('aguardando','aceita','a_caminho','chegou_destino','em_andamento') RETURNING id`);
      if (!service.rows[0]) return { error: "ride_not_cancellable", status: 409 };
      await tx.execute(sql`UPDATE corridas_solicitadas SET status = 'cancelada', motivo_cancelamento = ${texto}
        WHERE id = ${row.id} AND status IN ('aguardando','aceita','em_andamento')`);
      return { ok: true };
    });
    if ("error" in cancelled) return res.status(cancelled.status ?? 409).json({ error: cancelled.error });
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// ── Caronas (viagens compartilhadas) do motorista de app ─────────────────────
async function ensureCaronasMotoristaColumns() {
  try { await db.execute(sql`ALTER TABLE caronas ADD COLUMN IF NOT EXISTS profissional_id INTEGER`); } catch (e) { console.error("[caronas migrate] add profissional_id:", e); }
  try { await db.execute(sql`ALTER TABLE caronas ADD COLUMN IF NOT EXISTS tipo_profissional TEXT`); } catch (e) { console.error("[caronas migrate] add tipo_profissional:", e); }
  try { await db.execute(sql`ALTER TABLE caronas ALTER COLUMN empresa_id DROP NOT NULL`); } catch (e) { console.error("[caronas migrate] drop NOT NULL empresa_id:", e); }
  // distancia_km originalmente era INTEGER — passamos a aceitar decimais (numeric)
  try { await db.execute(sql`ALTER TABLE caronas ALTER COLUMN distancia_km TYPE NUMERIC USING distancia_km::numeric`); } catch (e) { console.error("[caronas migrate] alter distancia_km:", e); }
}

router.get("/caronas", async (req: Request, res: Response) => {
  await ensureCaronasMotoristaColumns();
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "unauthorized" });
  try {
    const rows = await db.execute(sql`
      SELECT id, origem, destino, distancia_km, data_viagem, hora_partida,
             vagas_total, vagas_ocupadas, valor_por_vaga, tipo, status, observacoes, created_at
      FROM caronas
      WHERE profissional_id = ${motoristaId} AND tipo_profissional = 'motorista'
      ORDER BY data_viagem DESC, hora_partida DESC
    `);
    return res.json(rows.rows);
  } catch (err) { console.error("GET /caronas motorista", err); return res.status(500).json({ error: "server_error" }); }
});

router.post("/caronas", async (req: Request, res: Response) => {
  await ensureCaronasMotoristaColumns();
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "unauthorized" });
  const { origem, destino, distancia_km, data_viagem, hora_partida, vagas_total, valor_por_vaga, observacoes } = req.body || {};
  if (!origem || !destino || !data_viagem || !hora_partida) {
    return res.status(400).json({ error: "campos obrigatórios: origem, destino, data_viagem, hora_partida" });
  }
  const vagas = Math.max(1, Math.min(8, Number(vagas_total) || 3));
  const valor = Math.max(0, Number(valor_por_vaga) || 0);
  const km = distancia_km ? Number(distancia_km) : null;
  try {
    const mot = await db.execute(sql`SELECT status FROM motoristas_app WHERE id = ${motoristaId}`);
    const m = (mot.rows as any[])[0];
    if (!m) return res.status(404).json({ error: "motorista_not_found" });
    if (m.status !== "aprovado") return res.status(403).json({ error: "motorista_nao_aprovado", message: "Seu cadastro precisa estar aprovado para publicar caronas." });

    const row = await db.execute(sql`
      INSERT INTO caronas (empresa_id, profissional_id, tipo_profissional, origem, destino, distancia_km,
                            data_viagem, hora_partida, vagas_total, valor_por_vaga, tipo, observacoes, status)
      VALUES (NULL, ${motoristaId}, 'motorista', ${String(origem)}, ${String(destino)}, ${km},
              ${String(data_viagem)}, ${String(hora_partida)}, ${vagas}, ${valor}, 'direta',
              ${observacoes ? String(observacoes) : null}, 'ativa')
      RETURNING *
    `);
    return res.json((row.rows as any[])[0]);
  } catch (err) { console.error("POST /caronas motorista", err); return res.status(500).json({ error: "server_error" }); }
});

router.delete("/caronas/:id", async (req: Request, res: Response) => {
  await ensureCaronasMotoristaColumns();
  const motoristaId = getMotoristaId(req);
  if (!motoristaId) return res.status(401).json({ error: "unauthorized" });
  const cId = Number(req.params.id);
  try {
    await db.execute(sql`
      UPDATE caronas SET status = 'cancelada'
      WHERE id = ${cId} AND profissional_id = ${motoristaId} AND tipo_profissional = 'motorista'
    `);
    return res.json({ ok: true });
  } catch (err) { console.error("DELETE /caronas motorista", err); return res.status(500).json({ error: "server_error" }); }
});

// ── POST /motorista-app/status-online ─────────────────────────────────────────
// Driver toggles online/offline without sending location.
router.post("/status-online", async (req: Request, res: Response) => {
  try {
    const motoristaId = getMotoristaId(req);
    if (!motoristaId) return res.status(401).json({ error: "invalid_token" });

    const { online } = req.body;
    await db.execute(sql`
      UPDATE motoristas_app SET online = ${!!online}, ultimo_ping = NOW() WHERE id = ${motoristaId}
    `);
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "server_error" }); }
});

// Dispatch a customer-created entrega to all active entregadores
export async function dispatchEntregaToEntregadores(entrega: any): Promise<{ dispatched: number }> {
  try {
    await ensureEntregasTable();
    const moto = await db.execute(sql.raw(`
      SELECT id, fcm_token, lat, lng FROM motoristas_app
      WHERE tipo_profissional IN ('entregador','delivery') AND ativo = true
        AND (
          (COALESCE('${esc(String(entrega.payment_source || "direto"))}', 'direto') = 'direto' AND aceita_pagamento_direto = true)
          OR ('${esc(String(entrega.payment_source || "direto"))}' IN ('mercado_pago', 'wallet') AND aceita_pagamento_app = true AND EXISTS (SELECT 1 FROM motorista_mercado_pago_connections mp WHERE mp.motorista_id = motoristas_app.id AND mp.status = 'active' AND (mp.expires_at > NOW() OR mp.encrypted_refresh_token IS NOT NULL)))
        )
    `));
    const motoristas = moto.rows as any[];
    if (!motoristas.length) return { dispatched: 0 };

    const escTxt = (s: any) => s == null ? "" : String(s).replace(/'/g, "''");
    const cat = entrega.categoria === "expressa" ? "Entrega Expressa"
              : entrega.categoria === "grande" ? "Entrega Grande"
              : "Entrega Padrão";
    const km = Number(entrega.distancia_km) || 0;
    const valor = Number(entrega.valor) || 0;
    const tempoEntrega = Math.max(1, Math.round(km * 2));
    const coletaLat = entrega.coleta_lat != null ? Number(entrega.coleta_lat) : null;
    const coletaLng = entrega.coleta_lng != null ? Number(entrega.coleta_lng) : null;

    let count = 0;
    for (const m of motoristas) {
      let distMot = 0, tempoMot = 0;
      if (coletaLat != null && coletaLng != null && m.lat != null && m.lng != null) {
        const R = 6371;
        const mLat = Number(m.lat), mLng = Number(m.lng);
        const dLat = (coletaLat - mLat) * Math.PI / 180;
        const dLng = (coletaLng - mLng) * Math.PI / 180;
        const lat1 = mLat * Math.PI / 180;
        const lat2 = coletaLat * Math.PI / 180;
        const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
        distMot = Math.round(2 * R * Math.asin(Math.sqrt(x)) * 10) / 10;
        tempoMot = Math.max(1, Math.round(distMot * 2));
      }

      await db.execute(sql.raw(`
        UPDATE entregas_solicitadas SET status = 'cancelada'
        WHERE profissional_id = ${Number(m.id)} AND status = 'aguardando'
      `));
      await db.execute(sql.raw(`
        INSERT INTO entregas_solicitadas
          (profissional_id, tipo_servico, categoria_nome, valor_estimado,
           coleta_endereco, entrega_endereco,
           distancia_profissional_km, tempo_profissional_min,
           distancia_entrega_km, tempo_entrega_min,
           cliente_nome, cliente_rating, cliente_avaliacoes, descricao_item,
           entrega_id, forma_pagamento, payment_source, expira_em)
        VALUES (
          ${Number(m.id)}, 'entrega', '${escTxt(cat)}', ${valor},
          '${escTxt(entrega.endereco_coleta)}', '${escTxt(entrega.endereco_entrega)}',
          ${distMot}, ${tempoMot},
          ${km}, ${tempoEntrega},
          '${escTxt(entrega.remetente_nome)}', 5.0, 0, '${escTxt(entrega.descricao_pacote || "")}',
          ${Number(entrega.id)}, '${escTxt(entrega.forma_pagamento || (entrega.payment_source === "wallet" ? "wallet" : "pix"))}', '${escTxt(entrega.payment_source || "direto")}', NOW() + INTERVAL '60 seconds'
        )
      `));

      if (m.fcm_token) {
        await sendFcmNotification(
          m.fcm_token,
          "📦 Nova Entrega",
          `R$ ${valor.toFixed(2).replace(".", ",")} • ${km} km`,
          { type: "entrega", entrega_id: String(entrega.id) }
        );
      }
      count++;
    }
    return { dispatched: count };
  } catch (err) {
    console.error("dispatchEntregaToEntregadores:", err);
    return { dispatched: 0 };
  }
}

export default router;
