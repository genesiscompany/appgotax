import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { creditWallet } from "../lib/wallet";
import { customerIdFromRequest } from "../lib/customerToken";

const router: IRouter = Router();
const BETA = { beta: true };
const METHODS = ["pix", "card", "wallet"] as const;
type Method = typeof METHODS[number];
const JWT_SECRET = process.env.JWT_SECRET || "gotaxi-admin-secret-2024";

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required to store Mercado Pago credentials");
  return createHash("sha256").update(secret).digest();
}
function encryptToken(value: string) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  return `${iv.toString("base64url")}.${Buffer.concat([cipher.update(value, "utf8"), cipher.final()]).toString("base64url")}.${cipher.getAuthTag().toString("base64url")}`;
}
function decryptToken(value: string) {
  const [iv, encrypted, tag] = value.split(".");
  if (!iv || !encrypted || !tag) throw new Error("Invalid encrypted credential");
  const decipher = createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}
function customer(req: Request) {
  return customerIdFromRequest(req);
}
async function requireCustomer(req: Request, res: Response, next: NextFunction) {
  const id = customer(req);
  if (!id) { res.status(401).json({ error: "unauthorized" }); return; }
  const users = await db.execute(sql`SELECT id FROM usuarios WHERE id = ${id} AND papel = 'cliente' AND ativo = true LIMIT 1`);
  if (!users.rows[0]) { res.status(401).json({ error: "unauthorized" }); return; }
  (req as any).customerId = id; next();
}
async function requirePartner(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : "";
  let decoded = ""; try { decoded = Buffer.from(token, "base64").toString("utf8"); } catch {}
  const match = decoded.match(/^(\d+):(\d+):/);
  if (!match) { res.status(401).json({ error: "unauthorized" }); return; }
  const rows = await db.execute(sql`SELECT id, empresa_id FROM usuarios WHERE id = ${Number(match[1])} AND empresa_id = ${Number(match[2])} AND papel IN ('parceiro', 'admin') AND ativo = true LIMIT 1`);
  if (!rows.rows[0]) { res.status(403).json({ error: "forbidden" }); return; }
  (req as any).empresaId = Number(match[2]); next();
}
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : "";
  try { const p = jwt.verify(token, JWT_SECRET) as any; if (p.papel !== "admin") throw new Error(); (req as any).admin = p; next(); }
  catch { res.status(401).json({ error: "unauthorized" }); }
}
function missingCredentials(res: Response) { res.status(503).json({ error: "mercado_pago_not_configured", message: "Configure e ative as credenciais do Mercado Pago no Super Admin.", ...BETA }); }
class MercadoPagoApiError extends Error {
  constructor(public status: number, public providerCode?: string) {
    super(`Mercado Pago request failed (${status}${providerCode ? `: ${providerCode}` : ""})`);
  }
}
async function mp(path: string, token: string, options: RequestInit = {}) {
  const response = await fetch(`https://api.mercadopago.com${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) } });
  const body: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new MercadoPagoApiError(response.status, String(body?.code ?? body?.error ?? ""));
  return body as any;
}
function hostUrl(req: Request) {
  const host = req.get("host") || "";
  if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) throw new Error("Invalid request host");
  const forwardedProto = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0]?.trim();
  const protocol = forwardedProto === "https" || forwardedProto === "http" ? forwardedProto : req.protocol;
  return `${protocol}://${host}`;
}
async function fees() {
  const rows = await db.execute(sql`SELECT method, percentage_basis_points FROM payment_fees`);
  return Object.fromEntries(METHODS.map(m => [m, Number((rows.rows as any[]).find(r => r.method === m)?.percentage_basis_points ?? 0)])) as Record<Method, number>;
}
async function globalMercadoPagoConfig() {
  const rows = await db.execute(sql`SELECT public_key, encrypted_access_token, environment, enabled FROM mercado_pago_config WHERE id = 1 LIMIT 1`);
  const config = rows.rows[0] as any;
  const environment = config?.environment === "sandbox" ? "sandbox" : "production";
  const environmentPublicKey = environment === "sandbox"
    ? String(process.env.MERCADO_PAGO_ORDERS_TEST_PUBLIC_KEY ?? process.env.MERCADO_PAGO_TEST_PUBLIC_KEY ?? "")
    : String(process.env.MERCADO_PAGO_PUBLIC_KEY ?? "");
  const environmentAccessToken = environment === "sandbox"
    ? String(process.env.MERCADO_PAGO_ORDERS_TEST_ACCESS_TOKEN ?? process.env.MERCADO_PAGO_TEST_ACCESS_TOKEN ?? "")
    : String(process.env.MERCADO_PAGO_ACCESS_TOKEN ?? "");
  return {
    publicKey: String(config?.public_key ?? environmentPublicKey),
    encryptedAccessToken: String(config?.encrypted_access_token ?? ""),
    enabled: !!config?.enabled,
    environment,
    environmentAccessToken,
  };
}
async function globalAccessToken() {
  const config = await globalMercadoPagoConfig();
  if (config.encryptedAccessToken) return decryptToken(config.encryptedAccessToken);
  return config.environmentAccessToken;
}
function globalCredentialsAvailable(config: Awaited<ReturnType<typeof globalMercadoPagoConfig>>) {
  return !!config.publicKey && (!!config.encryptedAccessToken || !!config.environmentAccessToken);
}
function globalCredentialEnvironmentMatches(config: Awaited<ReturnType<typeof globalMercadoPagoConfig>>) {
  return config.environment === "sandbox"
    ? config.publicKey.startsWith("TEST-")
    : config.publicKey.startsWith("APP_USR-");
}
function globalIntegrationConfigured(config: Awaited<ReturnType<typeof globalMercadoPagoConfig>>) {
  return config.enabled && globalCredentialsAvailable(config) && globalCredentialEnvironmentMatches(config);
}
async function resolveAmount(module: string, referenceId: string) {
  const maps: Record<string, { table: string; amount: string }> = {
    ecommerce: { table: "pedidos", amount: "total" }, food: { table: "pedidos_pdv", amount: "total" },
    motorista: { table: "corridas", amount: "valor" }, entrega: { table: "entregas", amount: "valor" },
    encomendas: { table: "encomendas", amount: "valor_frete" }, servicos: { table: "agendamentos", amount: "valor" },
    passagens: { table: "reservas", amount: "total" }, gotaxi_pro: { table: "pro_corridas", amount: "COALESCE(valor_final, valor_estimado)" },
  };
  const map = maps[module]; const id = Number(referenceId);
  if (!map || !Number.isInteger(id) || id <= 0) return null;
  // table and column are fixed allow-list values; all input values remain bound.
  const rows = await db.execute(sql.raw(`SELECT empresa_id, ${map.amount} AS amount FROM ${map.table} WHERE id = ${id} LIMIT 1`));
  const row = rows.rows[0] as any;
  const amount = Number(row?.amount);
  return row && Number.isFinite(amount) && amount > 0 ? { empresaId: Number(row.empresa_id), amountCents: Math.round(amount * 100) } : null;
}
async function ensureServicePaymentSchema() {
  await db.execute(sql`ALTER TABLE corridas ADD COLUMN IF NOT EXISTS customer_id INTEGER`);
  await db.execute(sql`ALTER TABLE entregas ADD COLUMN IF NOT EXISTS customer_id INTEGER`);
  await db.execute(sql`ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS encrypted_payment_token TEXT`);
  await db.execute(sql`ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS provider_order_id TEXT`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_module_reference_idx ON payment_transactions (module, reference_id)`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS customer_mercado_pago_cards (
    id SERIAL PRIMARY KEY, customer_id INTEGER NOT NULL UNIQUE,
    mercado_pago_customer_id TEXT NOT NULL, mercado_pago_card_id TEXT NOT NULL,
    mercado_pago_payment_profile_id TEXT,
    last_four TEXT NOT NULL, payment_method TEXT NOT NULL, brand TEXT NOT NULL,
    payment_type TEXT NOT NULL DEFAULT 'credit_card',
    expiration_month INTEGER NOT NULL, expiration_year INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await db.execute(sql`ALTER TABLE customer_mercado_pago_cards ADD COLUMN IF NOT EXISTS mercado_pago_payment_profile_id TEXT`);
  await db.execute(sql`ALTER TABLE customer_mercado_pago_cards ALTER COLUMN mercado_pago_payment_profile_id DROP NOT NULL`);
  await db.execute(sql`ALTER TABLE customer_mercado_pago_cards ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'credit_card'`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS service_payment_settlements (
    id SERIAL PRIMARY KEY, module TEXT NOT NULL, reference_id TEXT NOT NULL, transaction_id INTEGER,
    settled_at TIMESTAMP NOT NULL DEFAULT NOW(), UNIQUE(module, reference_id)
  )`);
}
function savedCardResponse(card: any) {
  return {
    cardId: String(card.mercado_pago_card_id),
    lastFour: String(card.last_four),
    paymentMethod: String(card.payment_method),
    brand: String(card.brand),
    expirationMonth: Number(card.expiration_month),
    expirationYear: Number(card.expiration_year),
  };
}
function automaticPaymentStatus(order: any) {
  const payment = order?.transactions?.payments?.[0] ?? {};
  const status = String(payment.status ?? order?.status ?? "").toLowerCase();
  if (["processed", "approved", "accredited"].includes(status)) return "approved";
  if (status === "refunded") return "refunded";
  if (["cancelled", "canceled"].includes(status)) return "cancelled";
  if (["rejected", "failed"].includes(status)) return "rejected";
  return "pending";
}
function providerCardMetadata(card: any) {
  const lastFour = String(card?.last_four_digits ?? "");
  const paymentMethod = String(card?.payment_method?.id ?? card?.payment_method_id ?? "");
  const paymentType = String(card?.payment_method?.payment_type_id ?? card?.payment_type_id ?? "credit_card");
  const brand = String(card?.payment_method?.name ?? card?.issuer?.name ?? paymentMethod);
  const expirationMonth = Number(card?.expiration_month);
  const expirationYear = Number(card?.expiration_year);
  if (!card?.id || !/^\d{4}$/.test(lastFour) || !paymentMethod || !brand ||
    !Number.isInteger(expirationMonth) || expirationMonth < 1 || expirationMonth > 12 ||
    !Number.isInteger(expirationYear) || expirationYear < 2000) {
    throw new Error("invalid_mercado_pago_card_response");
  }
  return { cardId: String(card.id), lastFour, paymentMethod, paymentType, brand, expirationMonth, expirationYear };
}
/** Financial earnings are committed once, only after an approved app charge (or explicit direct policy). */
export async function settleServiceEarning(module: "motorista" | "entrega", referenceId: string, transactionId: number | null) {
  await ensureServicePaymentSchema();
  await db.transaction(async tx => {
    const inserted = await tx.execute(sql`INSERT INTO service_payment_settlements (module, reference_id, transaction_id)
      VALUES (${module}, ${referenceId}, ${transactionId}) ON CONFLICT (module, reference_id) DO NOTHING RETURNING id`);
    if (!inserted.rows[0]) return;
    const source = module === "motorista"
      ? await tx.execute(sql`SELECT cs.motorista_id AS professional_id, cs.valor_estimado AS amount, ma.percentual_repasse
          FROM corridas_solicitadas cs JOIN motoristas_app ma ON ma.id = cs.motorista_id WHERE cs.corrida_id = ${Number(referenceId)} AND cs.status = 'finalizada' FOR UPDATE`)
      : await tx.execute(sql`SELECT es.profissional_id, es.valor_estimado AS amount, ma.percentual_repasse
          FROM entregas_solicitadas es JOIN motoristas_app ma ON ma.id = es.profissional_id WHERE es.entrega_id = ${Number(referenceId)} AND es.status = 'finalizada' FOR UPDATE`);
    const row = source.rows[0] as any;
    if (!row) throw new Error("service_professional_not_found");
    const amount = Number(row.amount) || 0;
    const net = amount * (1 - (Number(row.percentual_repasse) || 3) / 100);
    await tx.execute(sql`UPDATE motoristas_app SET total_corridas = COALESCE(total_corridas, 0) + 1,
      total_ganhos = COALESCE(total_ganhos, 0) + ${amount}, saldo = COALESCE(saldo, 0) + ${net}
      WHERE id = ${row.professional_id}`);
  });
}
const TERMINAL_STATUSES = new Set(["approved", "rejected", "cancelled", "refunded"]);
function paymentState(status: string, source: string) {
  if (source === "direto") return "direto";
  if (status === "approved") return "pago";
  if (status === "pending" || status === "processing") return "pendente";
  return "rejeitado";
}
function validWebhookSignature(req: Request, paymentId: string) {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  const signature = String(req.headers["x-signature"] ?? "");
  const requestId = String(req.headers["x-request-id"] ?? "");
  if (!secret || !signature || !requestId) return false;
  const values = Object.fromEntries(signature.split(",").map(x => x.trim().split("=")).filter(x => x.length === 2));
  if (!values.ts || !values.v1) return false;
  const manifest = `id:${paymentId};request-id:${requestId};ts:${values.ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const actual = String(values.v1);
  return actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
function sanitizedPixData(value: any) {
  if (!value || typeof value !== "object") return null;
  const qrCode = typeof (value.qr_code ?? value.qrCode) === "string" ? (value.qr_code ?? value.qrCode) : null;
  const qrCodeBase64 = typeof (value.qr_code_base64 ?? value.qrCodeBase64) === "string" ? (value.qr_code_base64 ?? value.qrCodeBase64) : null;
  const rawTicketUrl = value.ticket_url ?? value.ticketUrl;
  const ticketUrl = typeof rawTicketUrl === "string" && /^https:\/\//i.test(rawTicketUrl) ? rawTicketUrl : null;
  return qrCode || qrCodeBase64 || ticketUrl ? { qrCode, qrCodeBase64, ticketUrl } : null;
}

/** Charge a staged service payment. The row lock plus provider idempotency key makes retries safe. */
export async function finalizeServicePayment(module: "motorista" | "entrega", referenceId: string, req: Request) {
  const locked = await db.transaction(async tx => {
    const found = await tx.execute(sql`SELECT * FROM payment_transactions
      WHERE module = ${module} AND reference_id = ${referenceId} FOR UPDATE`);
    if (found.rows.length > 1) throw new Error("ambiguous_existing_payment_intents");
    const row = found.rows[0] as any;
    if (!row) return null;
    if (!["pending", "processing"].includes(String(row.status))) return row;
    if (row.payment_source === "wallet") {
      await tx.execute(sql`INSERT INTO customer_wallet_accounts (customer_id, balance_cents) VALUES (${row.customer_id}, 0) ON CONFLICT (customer_id) DO NOTHING`);
      const accountRows = await tx.execute(sql`SELECT id, balance_cents FROM customer_wallet_accounts WHERE customer_id = ${row.customer_id} FOR UPDATE`);
      const account = accountRows.rows[0] as any;
      if (Number(account.balance_cents) < Number(row.gross_amount_cents)) {
        await tx.execute(sql`UPDATE payment_transactions SET status = 'rejected', updated_at = NOW() WHERE id = ${row.id}`);
        return { ...row, status: "rejected", failure: "insufficient_wallet_balance" };
      }
      const balance = Number(account.balance_cents) - Number(row.gross_amount_cents);
      await tx.execute(sql`UPDATE customer_wallet_accounts SET balance_cents = ${balance}, updated_at = NOW() WHERE id = ${account.id}`);
      await tx.execute(sql`INSERT INTO customer_wallet_ledger
        (wallet_account_id, customer_id, transaction_id, direction, amount_cents, balance_after_cents, idempotency_key, description)
        VALUES (${account.id}, ${row.customer_id}, ${row.id}, 'debit', ${row.gross_amount_cents}, ${balance}, ${`debit:finalize:${row.id}`}, 'Débito ao concluir serviço')
        ON CONFLICT (idempotency_key) DO NOTHING`);
      await tx.execute(sql`UPDATE payment_transactions SET status = 'approved', updated_at = NOW() WHERE id = ${row.id}`);
      return { ...row, status: "approved" };
    }
    await tx.execute(sql`UPDATE payment_transactions SET status = 'processing', updated_at = NOW() WHERE id = ${row.id}`);
    return { ...row, status: "processing" };
  });
  if (!locked || locked.payment_source !== "mercado_pago" || locked.status !== "processing") {
    return locked;
  }
  const config = await globalMercadoPagoConfig();
  if (!globalIntegrationConfigured(config)) throw new Error("mercado_pago_not_configured");
  const token = await globalAccessToken();
  const metadata = (locked.metadata || {}) as Record<string, unknown>;
  if (locked.method === "card" && locked.provider_order_id) {
    try {
      const existing = await mp(`/v1/orders/${encodeURIComponent(String(locked.provider_order_id))}`, token);
      const reconciled = automaticPaymentStatus(existing);
      const providerPaymentId = String(existing?.transactions?.payments?.[0]?.id ?? "");
      await db.execute(sql`UPDATE payment_transactions SET provider_payment_id = ${providerPaymentId || null},
        encrypted_payment_token = NULL, status = ${reconciled}, updated_at = NOW() WHERE id = ${locked.id}`);
      return { ...locked, status: reconciled, provider_payment_id: providerPaymentId || null, provider_order_id: String(existing.id), pix: null };
    } catch (error) {
      await db.execute(sql`UPDATE payment_transactions SET status = 'pending', updated_at = NOW()
        WHERE id = ${locked.id} AND status = 'processing'`);
      throw error;
    }
  }
  if (locked.provider_payment_id) {
    const existing = await mp(`/v1/payments/${encodeURIComponent(String(locked.provider_payment_id))}`, token);
    const reconciled = existing.status === "approved" ? "approved" : existing.status === "rejected" ? "rejected" : "pending";
    await db.execute(sql`UPDATE payment_transactions SET status = ${reconciled},
      encrypted_payment_token = NULL, updated_at = NOW() WHERE id = ${locked.id}`);
    const pix = sanitizedPixData(existing.point_of_interaction?.transaction_data);
    if (pix && reconciled === "pending") await db.execute(sql`UPDATE payment_transactions SET metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({ pix })}::jsonb WHERE id = ${locked.id}`);
    return { ...locked, status: reconciled, provider_payment_id: String(existing.id), pix: reconciled === "pending" ? pix : null };
  }
  const payload: Record<string, unknown> = {
    transaction_amount: Number(locked.gross_amount_cents) / 100,
    description: `Pagamento ${module} #${referenceId}`,
    external_reference: locked.external_reference,
    notification_url: `${hostUrl(req)}/api/payments/webhook/mercado-pago`,
    metadata: { transaction_id: locked.id },
  };
  try {
    if (locked.method === "pix") {
      payload.payment_method_id = "pix";
      payload.payer = { email: String(metadata.payerEmail || "customer@gotaxi.app") };
    } else if (locked.method === "card" && typeof metadata.mercadoPagoCustomerId === "string" &&
      typeof metadata.mercadoPagoCardId === "string" && typeof locked.encrypted_payment_token === "string") {
      const amount = (Number(locked.gross_amount_cents) / 100).toFixed(2);
      const order = await mp("/v1/orders", token, {
        method: "POST",
        headers: { "X-Idempotency-Key": locked.idempotency_key },
        body: JSON.stringify({
          type: "online",
          processing_mode: "automatic",
          capture_mode: "automatic",
          total_amount: amount,
          external_reference: locked.external_reference,
          description: `Pagamento ${module} #${referenceId}`,
          payer: { customer_id: metadata.mercadoPagoCustomerId },
          transactions: {
            payments: [{
              amount,
              payment_method: {
                id: metadata.paymentMethod,
                type: metadata.paymentType,
                token: decryptToken(locked.encrypted_payment_token),
                installments: 1,
              },
            }],
          },
        }),
      });
      const providerOrderId = String(order?.id ?? "");
      if (!providerOrderId) throw new Error("invalid_mercado_pago_order_response");
      const providerPaymentId = String(order?.transactions?.payments?.[0]?.id ?? "");
      const normalizedStatus = automaticPaymentStatus(order);
      await db.execute(sql`UPDATE payment_transactions SET provider_order_id = ${providerOrderId},
        provider_payment_id = ${providerPaymentId || null}, encrypted_payment_token = NULL,
        metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify(providerPaymentId ? { mercadoPagoTransactionId: providerPaymentId } : {})}::jsonb,
        status = ${normalizedStatus}, updated_at = NOW() WHERE id = ${locked.id}`);
      return { ...locked, provider_order_id: providerOrderId, provider_payment_id: providerPaymentId || null, status: normalizedStatus, pix: null };
    } else {
      throw new Error("payment_token_required");
    }
    const payment = await mp("/v1/payments", token, { method: "POST", headers: { "X-Idempotency-Key": locked.idempotency_key }, body: JSON.stringify(payload) });
    const status = String(payment.status);
    const normalizedStatus = status === "approved" ? "approved" : status === "rejected" ? "rejected" : "pending";
    const pix = sanitizedPixData(payment.point_of_interaction?.transaction_data);
    await db.execute(sql`UPDATE payment_transactions SET provider_payment_id = ${String(payment.id)},
      encrypted_payment_token = NULL,
      metadata = CASE WHEN ${normalizedStatus} = 'pending' AND ${pix !== null} THEN COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({ pix })}::jsonb ELSE COALESCE(metadata, '{}'::jsonb) - 'pix' END,
      status = ${normalizedStatus}, updated_at = NOW() WHERE id = ${locked.id}`);
    const result = { ...locked, provider_payment_id: String(payment.id), status: normalizedStatus, pix: normalizedStatus === "pending" ? pix : null };
    return result;
  } catch (error) {
    if (locked.method === "card" && error instanceof MercadoPagoApiError && error.status === 402) {
      const failure = {
        provider: "mercado_pago",
        httpStatus: 402,
        code: error.providerCode || "payment_required",
      };
      await db.execute(sql`UPDATE payment_transactions SET status = 'rejected',
        encrypted_payment_token = NULL,
        metadata = (COALESCE(metadata, '{}'::jsonb) - 'paymentFailure') || ${JSON.stringify({ paymentFailure: failure })}::jsonb,
        updated_at = NOW() WHERE id = ${locked.id} AND status = 'processing'`);
      return { ...locked, status: "rejected", failure: failure.code };
    }
    // Transport errors and provider 5xx responses are indeterminate. Retain the
    // encrypted one-use token and stable idempotency key for a safe retry.
    await db.execute(sql`UPDATE payment_transactions SET status = 'pending', updated_at = NOW() WHERE id = ${locked.id} AND status = 'processing'`);
    throw error;
  }
}

router.get("/options/:empresaId", async (req, res) => {
  const empresaId = Number(req.params.empresaId); if (!Number.isInteger(empresaId) || empresaId <= 0) { res.status(400).json({ error: "invalid_empresa_id" }); return; }
  const c = await db.execute(sql`SELECT enabled, direct_payment_enabled FROM empresa_mercado_pago_configs WHERE empresa_id = ${empresaId} LIMIT 1`);
  const partner = c.rows[0] as any;
  const global = await globalMercadoPagoConfig();
  const partnerEnabled = partner ? !!partner.enabled : true;
  res.json({ empresaId, mercadoPago: globalIntegrationConfigured(global) && partnerEnabled, directPayment: partner ? !!partner.direct_payment_enabled : true, wallet: true, ...BETA });
});
router.get("/partner-config", requirePartner, async (req, res) => {
  const r = await db.execute(sql`SELECT enabled, direct_payment_enabled FROM empresa_mercado_pago_configs WHERE empresa_id = ${(req as any).empresaId} LIMIT 1`);
  const partner = r.rows[0] as any;
  const global = await globalMercadoPagoConfig();
  res.json({
    mercadoPagoEnabled: partner ? !!partner.enabled : true,
    directPaymentEnabled: partner ? !!partner.direct_payment_enabled : true,
    configured: globalIntegrationConfigured(global),
    ...BETA,
  });
});
router.put("/partner-options", requirePartner, async (req, res) => {
  const b = req.body || {};
  if (b.publicKey !== undefined || b.userId !== undefined || b.accessToken !== undefined) {
    res.status(403).json({ error: "partner_credentials_admin_only", message: "Credenciais do Mercado Pago são administradas pelo Super Admin" });
    return;
  }
  const global = await globalMercadoPagoConfig();
  const configured = globalIntegrationConfigured(global);
  if (b.mercadoPagoEnabled && !configured) {
    res.status(400).json({ error: "mercado_pago_not_configured", message: "A integração global do Mercado Pago ainda não foi ativada pela GoTaxi" });
    return;
  }
  await db.execute(sql`INSERT INTO empresa_mercado_pago_configs (empresa_id, enabled, direct_payment_enabled)
    VALUES (${(req as any).empresaId}, ${!!b.mercadoPagoEnabled}, ${b.directPaymentEnabled !== false})
    ON CONFLICT (empresa_id) DO UPDATE SET enabled = EXCLUDED.enabled, direct_payment_enabled = EXCLUDED.direct_payment_enabled, updated_at = NOW()`);
  res.json({ mercadoPagoEnabled: !!b.mercadoPagoEnabled, directPaymentEnabled: b.directPaymentEnabled !== false, configured, ...BETA });
});
router.put("/partner-config", requirePartner, (_req, res) => {
  res.status(403).json({ error: "global_credentials_only", message: "Parceiros não possuem credenciais do Mercado Pago" });
});
router.get("/admin/partner-config/:empresaId", requireAdmin, async (req, res) => {
  const empresaId = Number(req.params.empresaId);
  if (!Number.isInteger(empresaId) || empresaId <= 0) { res.status(400).json({ error: "invalid_empresa_id" }); return; }
  const r = await db.execute(sql`SELECT enabled, direct_payment_enabled FROM empresa_mercado_pago_configs WHERE empresa_id = ${empresaId} LIMIT 1`);
  const x = r.rows[0] as any;
  const global = await globalMercadoPagoConfig();
  res.json({
    empresaId,
    publicKey: "",
    userId: "",
    mercadoPagoEnabled: x ? !!x.enabled : true,
    directPaymentEnabled: x ? !!x.direct_payment_enabled : true,
    configured: globalIntegrationConfigured(global),
    ...BETA,
  });
});
router.put("/admin/partner-config/:empresaId", requireAdmin, async (req, res) => {
  const empresaId = Number(req.params.empresaId);
  if (!Number.isInteger(empresaId) || empresaId <= 0) { res.status(400).json({ error: "invalid_empresa_id" }); return; }
  const b = req.body || {};
  if (b.publicKey !== undefined || b.userId !== undefined || b.accessToken !== undefined) {
    res.status(400).json({ error: "global_credentials_only", message: "As credenciais devem ser configuradas em Financeiro > Mercado Pago" });
    return;
  }
  await db.execute(sql`INSERT INTO empresa_mercado_pago_configs (empresa_id, enabled, direct_payment_enabled)
    VALUES (${empresaId}, ${!!b.mercadoPagoEnabled}, ${b.directPaymentEnabled !== false})
    ON CONFLICT (empresa_id) DO UPDATE SET enabled = EXCLUDED.enabled, direct_payment_enabled = EXCLUDED.direct_payment_enabled, updated_at = NOW()`);
  const global = await globalMercadoPagoConfig();
  res.json({ empresaId, mercadoPagoEnabled: !!b.mercadoPagoEnabled, directPaymentEnabled: b.directPaymentEnabled !== false, configured: globalIntegrationConfigured(global), ...BETA });
});
router.get("/admin/config", requireAdmin, async (_req, res) => {
  const config = await globalMercadoPagoConfig();
  res.json({ publicKey: config.publicKey, configured: globalCredentialsAvailable(config) && globalCredentialEnvironmentMatches(config), enabled: config.enabled, environment: config.environment, sandbox: config.environment === "sandbox", ...BETA });
});
router.put("/admin/config", requireAdmin, async (req, res) => {
  const b = req.body || {};
  const environment = b.environment === "sandbox" ? "sandbox" : "production";
  if (b.accessToken !== undefined && (typeof b.accessToken !== "string" || b.accessToken.trim().length < 10)) {
    res.status(400).json({ error: "invalid_access_token", message: "Access Token inválido" });
    return;
  }
  try {
    const previous = await globalMercadoPagoConfig();
    const publicKey = typeof b.publicKey === "string" ? b.publicKey.trim() : previous.publicKey;
    const environmentChanged = environment !== previous.environment;
    if (environment === "sandbox" && publicKey && !publicKey.startsWith("TEST-")) {
      res.status(400).json({ error: "invalid_public_key_environment", message: "No ambiente de teste, use uma Public Key iniciada por TEST-." }); return;
    }
    if (environment === "production" && publicKey && !publicKey.startsWith("APP_USR-")) {
      res.status(400).json({ error: "invalid_public_key_environment", message: "No ambiente de produção, use uma Public Key iniciada por APP_USR-." }); return;
    }
    if (b.accessToken !== undefined) {
      const accessToken = b.accessToken.trim();
      const validPrefix = environment === "sandbox" ? accessToken.startsWith("TEST-") : accessToken.startsWith("APP_USR-");
      if (!validPrefix) {
        res.status(400).json({ error: "invalid_access_token_environment", message: `O Access Token não pertence ao ambiente de ${environment === "sandbox" ? "teste" : "produção"}.` }); return;
      }
    }
    if (environmentChanged && b.accessToken === undefined) {
      res.status(400).json({ error: "access_token_required_for_environment_change", message: "Informe novamente o Access Token ao trocar o ambiente." }); return;
    }
    const encrypted = b.accessToken === undefined ? previous.encryptedAccessToken : encryptToken(b.accessToken.trim());
    const enabled = !!b.enabled;
    const environmentToken = environment === "sandbox"
      ? process.env.MERCADO_PAGO_ORDERS_TEST_ACCESS_TOKEN || process.env.MERCADO_PAGO_TEST_ACCESS_TOKEN
      : process.env.MERCADO_PAGO_ACCESS_TOKEN;
    const tokenAvailable = !!encrypted || !!environmentToken;
    if (enabled && (!publicKey || !tokenAvailable)) {
      res.status(400).json({ error: "mercado_pago_credentials_required", message: "Public Key e Access Token são obrigatórios para ativar o Mercado Pago" });
      return;
    }
    await db.execute(sql`INSERT INTO mercado_pago_config (id, public_key, encrypted_access_token, environment, enabled)
      VALUES (1, ${publicKey || null}, ${encrypted || null}, ${environment}, ${enabled})
      ON CONFLICT (id) DO UPDATE SET public_key = EXCLUDED.public_key, encrypted_access_token = EXCLUDED.encrypted_access_token, environment = EXCLUDED.environment, enabled = EXCLUDED.enabled, updated_at = NOW()`);
    res.json({ publicKey, configured: !!publicKey && tokenAvailable, enabled, environment, sandbox: environment === "sandbox", ...BETA });
  } catch (err) {
    (req as any).log?.error({ err: err instanceof Error ? err.message : "unknown" }, "Mercado Pago admin configuration failed");
    res.status(503).json({ error: "credential_encryption_unavailable", message: "Não foi possível armazenar as credenciais de pagamento" });
  }
});
router.get("/admin/fees", requireAdmin, async (_req, res) => res.json({ feesBasisPoints: await fees(), ...BETA }));
router.put("/admin/fees", requireAdmin, async (req, res) => {
  for (const m of METHODS) { const v = Number(req.body?.[m]); if (!Number.isInteger(v) || v < 0 || v > 10000) { res.status(400).json({ error: "invalid_fee", message: `${m} must be basis points from 0 to 10000` }); return; } }
  for (const m of METHODS) await db.execute(sql`INSERT INTO payment_fees (method, percentage_basis_points) VALUES (${m}, ${Number(req.body[m])}) ON CONFLICT (method) DO UPDATE SET percentage_basis_points = EXCLUDED.percentage_basis_points, updated_at = NOW()`);
  res.json({ feesBasisPoints: await fees(), ...BETA });
});
router.get("/cards/config", requireCustomer, async (_req, res) => {
  const config = await globalMercadoPagoConfig();
  if (!globalIntegrationConfigured(config)) { missingCredentials(res); return; }
  // This endpoint intentionally exposes only the SDK key and environment flag.
  res.json({ publicKey: config.publicKey, sandbox: config.environment === "sandbox" });
});
router.get("/cards", requireCustomer, async (req, res) => {
  await ensureServicePaymentSchema();
  const cards = await db.execute(sql`SELECT mercado_pago_card_id, last_four, payment_method, brand, expiration_month, expiration_year
    FROM customer_mercado_pago_cards WHERE customer_id = ${(req as any).customerId} LIMIT 1`);
  const card = cards.rows[0] as any;
  res.json({ card: card ? savedCardResponse(card) : null });
});
router.post("/cards", requireCustomer, async (req, res) => {
  const cardToken = req.body?.cardToken;
  if (!req.body || typeof req.body !== "object" || Object.keys(req.body).some(key => key !== "cardToken") ||
    typeof cardToken !== "string" || cardToken.length < 8 || cardToken.length > 512) {
    res.status(400).json({ error: "invalid_card_token" });
    return;
  }
  const config = await globalMercadoPagoConfig();
  if (!globalIntegrationConfigured(config)) { missingCredentials(res); return; }
  await ensureServicePaymentSchema();
  const customerId = (req as any).customerId as number;
  const users = await db.execute(sql`SELECT nome FROM usuarios WHERE id = ${customerId} AND papel = 'cliente' AND ativo = true LIMIT 1`);
  const user = users.rows[0] as any;
  if (!user) { res.status(404).json({ error: "customer_not_found" }); return; }
  const existingRows = await db.execute(sql`SELECT * FROM customer_mercado_pago_cards WHERE customer_id = ${customerId} LIMIT 1`);
  const existing = existingRows.rows[0] as any;
  if (existing?.mercado_pago_card_id) {
    const active = await db.execute(sql`SELECT id FROM payment_transactions
      WHERE customer_id = ${customerId}
        AND status IN ('pending', 'processing')
        AND metadata->>'mercadoPagoCardId' = ${String(existing.mercado_pago_card_id)}
      LIMIT 1`);
    if (active.rows[0]) { res.status(409).json({ error: "saved_card_in_use" }); return; }
  }
  const token = await globalAccessToken();
  const credentialTag = createHash("sha256").update(token).digest("hex").slice(0, 10);
  const mercadoPagoEmail = `cliente-${customerId}-${credentialTag}@clientes.gotaxi.app`;
  try {
    const search = await mp(`/v1/customers/search?email=${encodeURIComponent(mercadoPagoEmail)}`, token);
    const providerCustomer = search?.results?.[0] ?? await mp("/v1/customers", token, {
      method: "POST",
      body: JSON.stringify({ email: mercadoPagoEmail, first_name: String(user.nome ?? "").trim().slice(0, 255) || undefined }),
    });
    const mercadoPagoCustomerId = String(providerCustomer?.id ?? "");
    if (!mercadoPagoCustomerId) throw new Error("invalid_mercado_pago_customer_response");
    const providerCard = await mp(`/v1/customers/${encodeURIComponent(mercadoPagoCustomerId)}/cards`, token, {
      method: "POST",
      body: JSON.stringify({ token: cardToken }),
    });
    const card = providerCardMetadata(providerCard);
    if (card.paymentMethod === "amex") {
      await mp(`/v1/customers/${encodeURIComponent(mercadoPagoCustomerId)}/cards/${encodeURIComponent(card.cardId)}`, token, { method: "DELETE" }).catch(() => undefined);
      res.status(422).json({ error: "card_requires_four_digit_cvv" });
      return;
    }
    const replaced = await db.transaction(async tx => {
      const currentRows = await tx.execute(sql`SELECT * FROM customer_mercado_pago_cards WHERE customer_id = ${customerId} FOR UPDATE`);
      const current = currentRows.rows[0] as any;
      await tx.execute(sql`INSERT INTO customer_mercado_pago_cards
        (customer_id, mercado_pago_customer_id, mercado_pago_card_id, last_four, payment_method, payment_type, brand, expiration_month, expiration_year)
        VALUES (${customerId}, ${mercadoPagoCustomerId}, ${card.cardId}, ${card.lastFour}, ${card.paymentMethod}, ${card.paymentType}, ${card.brand}, ${card.expirationMonth}, ${card.expirationYear})
        ON CONFLICT (customer_id) DO UPDATE SET mercado_pago_customer_id = EXCLUDED.mercado_pago_customer_id,
          mercado_pago_card_id = EXCLUDED.mercado_pago_card_id,
          last_four = EXCLUDED.last_four, payment_method = EXCLUDED.payment_method, payment_type = EXCLUDED.payment_type, brand = EXCLUDED.brand,
          expiration_month = EXCLUDED.expiration_month, expiration_year = EXCLUDED.expiration_year, updated_at = NOW()`);
      return current;
    });
    if (replaced?.mercado_pago_card_id && String(replaced.mercado_pago_card_id) !== card.cardId) {
      await mp(`/v1/customers/${encodeURIComponent(String(replaced.mercado_pago_customer_id))}/cards/${encodeURIComponent(String(replaced.mercado_pago_card_id))}`, token, { method: "DELETE" })
        .catch(error => (req as any).log?.warn({ err: error instanceof Error ? error.message : "unknown" }, "Previous saved card provider deletion failed"));
    }
    res.status(201).json(savedCardResponse({
      mercado_pago_card_id: card.cardId, last_four: card.lastFour, payment_method: card.paymentMethod,
      brand: card.brand, expiration_month: card.expirationMonth, expiration_year: card.expirationYear,
    }));
  } catch (error) {
    (req as any).log?.error({ err: error instanceof Error ? error.message : "unknown" }, "Saved card creation failed");
    res.status(502).json({ error: "mercado_pago_card_unavailable" });
  }
});
router.delete("/cards/:cardId", requireCustomer, async (req, res) => {
  const cardId = String(req.params.cardId ?? "");
  if (!cardId || cardId.length > 255) { res.status(400).json({ error: "invalid_card_id" }); return; }
  await ensureServicePaymentSchema();
  const customerId = (req as any).customerId;
  const rows = await db.execute(sql`SELECT * FROM customer_mercado_pago_cards WHERE customer_id = ${customerId} AND mercado_pago_card_id = ${cardId} LIMIT 1`);
  const card = rows.rows[0] as any;
  if (!card) { res.status(404).json({ error: "saved_card_not_found" }); return; }
  const active = await db.execute(sql`SELECT id FROM payment_transactions
    WHERE customer_id = ${customerId}
      AND status IN ('pending', 'processing')
      AND metadata->>'mercadoPagoCardId' = ${cardId}
    LIMIT 1`);
  if (active.rows[0]) { res.status(409).json({ error: "saved_card_in_use" }); return; }
  const config = await globalMercadoPagoConfig();
  if (!globalIntegrationConfigured(config)) { missingCredentials(res); return; }
  try {
    await mp(`/v1/customers/${encodeURIComponent(String(card.mercado_pago_customer_id))}/cards/${encodeURIComponent(cardId)}`, await globalAccessToken(), { method: "DELETE" });
    await db.execute(sql`DELETE FROM customer_mercado_pago_cards WHERE customer_id = ${customerId} AND mercado_pago_card_id = ${cardId}`);
    res.status(204).send();
  } catch (error) {
    (req as any).log?.error({ err: error instanceof Error ? error.message : "unknown" }, "Saved card deletion failed");
    res.status(502).json({ error: "mercado_pago_card_unavailable" });
  }
});
router.get("/wallet", requireCustomer, async (req, res) => { const r = await db.execute(sql`SELECT balance_cents FROM customer_wallet_accounts WHERE customer_id = ${(req as any).customerId} LIMIT 1`); res.json({ balanceCents: Number((r.rows[0] as any)?.balance_cents ?? 0), ...BETA }); });
router.get("/wallet/ledger", requireCustomer, async (req, res) => { const r = await db.execute(sql`SELECT id, direction, amount_cents, balance_after_cents, description, created_at FROM customer_wallet_ledger WHERE customer_id = ${(req as any).customerId} ORDER BY id DESC LIMIT 100`); res.json({ entries: r.rows, ...BETA }); });
router.post("/wallet/topup", requireCustomer, async (req, res) => {
  const amountCents = Number(req.body?.amountCents);
  if (!Number.isInteger(amountCents) || amountCents < 100 || amountCents > 100000000) { res.status(400).json({ error: "invalid_amount_cents" }); return; }
  try {
    const config = await globalMercadoPagoConfig();
    if (!globalIntegrationConfigured(config)) { missingCredentials(res); return; }
    const token = await globalAccessToken();
    if (!token) { missingCredentials(res); return; }
    const externalReference = `wallet-topup:${(req as any).customerId}:${randomUUID()}`;
    const base = hostUrl(req);
    const preference = await mp("/checkout/preferences", token, { method: "POST", body: JSON.stringify({ items: [{ title: "Recarga de carteira", quantity: 1, unit_price: amountCents / 100, currency_id: "BRL" }], external_reference: externalReference, notification_url: `${base}/api/payments/webhook/mercado-pago`, back_urls: { success: `${base}/`, failure: `${base}/`, pending: `${base}/` }, auto_return: "approved" }) });
    const tx = await db.execute(sql`INSERT INTO payment_transactions (customer_id, module, reference_id, payment_source, method, status, gross_amount_cents, platform_fee_cents, provider_preference_id, init_point, sandbox_init_point, external_reference, idempotency_key)
      VALUES (${(req as any).customerId}, 'wallet_topup', ${externalReference}, 'mercado_pago', 'wallet', 'pending', ${amountCents}, 0, ${preference.id ?? null}, ${preference.init_point ?? null}, ${preference.sandbox_init_point ?? null}, ${externalReference}, ${`topup:${externalReference}`}) RETURNING id`);
    res.status(201).json({ transactionId: (tx.rows[0] as any).id, initPoint: preference.init_point ?? null, sandboxInitPoint: config.environment === "sandbox" ? preference.sandbox_init_point ?? null : null, sandbox: config.environment === "sandbox", ...BETA });
  } catch (err) { (req as any).log?.error({ err: err instanceof Error ? err.message : "unknown" }, "payment topup failed"); res.status(502).json({ error: "mercado_pago_unavailable", message: "O Mercado Pago recusou a criação da recarga. Confira se as credenciais e o ambiente estão corretos.", ...BETA }); }
});
router.post("/checkout", requireCustomer, async (req, res) => {
  const { module, referenceId, mercadoPagoMethod, paymentToken } = req.body || {};
  const requestedPaymentSource = req.body?.paymentSource;
  const paymentSource = requestedPaymentSource === "carteira" ? "wallet" : requestedPaymentSource;
  if (typeof module !== "string" || typeof referenceId !== "string" || !["mercado_pago", "wallet"].includes(paymentSource) || !METHODS.includes(mercadoPagoMethod)) { res.status(400).json({ error: "invalid_checkout_request" }); return; }
  if (!["motorista", "entrega"].includes(module)) { res.status(400).json({ error: "checkout_only_available_for_service_finalization" }); return; }
  await ensureServicePaymentSchema();
  const order = await resolveAmount(module, referenceId);
  if (!order) { res.status(404).json({ error: "authoritative_order_not_found" }); return; }
  const customerId = (req as any).customerId;
  let savedCard: any = null;
  let payerEmail = "";
  if (mercadoPagoMethod === "card") {
    if (typeof paymentToken !== "string" || paymentToken.length < 8 || paymentToken.length > 512) {
      res.status(400).json({ error: "invalid_payment_token" }); return;
    }
    const cardRows = await db.execute(sql`SELECT mercado_pago_customer_id, mercado_pago_card_id, payment_method, payment_type FROM customer_mercado_pago_cards WHERE customer_id = ${customerId} LIMIT 1`);
    savedCard = cardRows.rows[0] as any;
    if (!savedCard?.mercado_pago_customer_id || !savedCard?.mercado_pago_card_id) { res.status(409).json({ error: "saved_card_required" }); return; }
    payerEmail = `cliente-${customerId}@clientes.gotaxi.app`;
  } else if (paymentToken !== undefined) {
    res.status(400).json({ error: "payment_token_only_supported_for_card" }); return;
  }
  const service = module === "motorista"
    ? await db.execute(sql`SELECT empresa_id, customer_id, status, payment_source FROM corridas WHERE id = ${Number(referenceId)} LIMIT 1`)
    : await db.execute(sql`SELECT empresa_id, customer_id, status, payment_source FROM entregas WHERE id = ${Number(referenceId)} LIMIT 1`);
  const serviceRow = service.rows[0] as any;
  if (!serviceRow || Number(serviceRow.empresa_id) !== order.empresaId || Number(serviceRow.customer_id) !== customerId) { res.status(403).json({ error: "service_not_owned_by_customer" }); return; }
  if (serviceRow.payment_source !== paymentSource || ["concluida", "entregue", "cancelada"].includes(String(serviceRow.status))) { res.status(409).json({ error: "service_not_eligible_for_payment_staging" }); return; }
  try {
    const method = mercadoPagoMethod as Method;
    const attempt = randomUUID();
    const idempotencyKey = attempt;
    const externalReference = method === "card"
      ? `svc-${Number(referenceId)}-${attempt}`
      : `service_${module}_${referenceId}`;
    const feeCents = Math.round(order.amountCents * (await fees())[method] / 10000);
    const cardMetadata = method === "card" ? {
      payerEmail,
      mercadoPagoCustomerId: String(savedCard.mercado_pago_customer_id),
      mercadoPagoCardId: String(savedCard.mercado_pago_card_id),
      paymentMethod: String(savedCard.payment_method),
      paymentType: String(savedCard.payment_type),
      paymentAttempt: attempt,
    } : {};
    const staged = await db.transaction(async tx => {
      const previous = await tx.execute(sql`SELECT id, customer_id, status, payment_source, method FROM payment_transactions
        WHERE module = ${module} AND reference_id = ${referenceId} FOR UPDATE`);
      if (previous.rows.length > 1) return { conflict: "ambiguous_existing_payment_intents" };
      const current = previous.rows[0] as any;
      if (current) {
        if (Number(current.customer_id) !== customerId) return { conflict: "payment_intent_already_exists" };
        if (current.payment_source !== paymentSource) return { conflict: "payment_intent_already_exists" };
        if (current.status === "rejected" && current.method === "card" && method === "card") {
          const reset = await tx.execute(sql`UPDATE payment_transactions SET status = 'pending',
            gross_amount_cents = ${order.amountCents}, platform_fee_cents = ${feeCents},
            provider_order_id = NULL, provider_payment_id = NULL,
            external_reference = ${externalReference}, idempotency_key = ${idempotencyKey},
            encrypted_payment_token = ${encryptToken(paymentToken)},
            metadata = ${JSON.stringify(cardMetadata)}::jsonb, updated_at = NOW()
            WHERE id = ${current.id} AND status = 'rejected' RETURNING id`);
          return { row: reset.rows[0], reset: true };
        }
        return { row: current, reset: false };
      }
      const inserted = await tx.execute(sql`INSERT INTO payment_transactions (empresa_id, customer_id, module, reference_id, payment_source, method, status, gross_amount_cents, platform_fee_cents, external_reference, idempotency_key, encrypted_payment_token, metadata)
        VALUES (${order.empresaId}, ${customerId}, ${module}, ${referenceId}, ${paymentSource}, ${paymentSource === "wallet" ? "wallet" : method}, 'pending', ${order.amountCents}, ${feeCents}, ${externalReference}, ${idempotencyKey}, ${method === "card" ? encryptToken(paymentToken) : null}, ${JSON.stringify(cardMetadata)}::jsonb) RETURNING id`);
      return { row: inserted.rows[0], reset: false, created: true };
    });
    if (staged.conflict) { res.status(409).json({ error: staged.conflict }); return; }
    const stagedRow = staged.row as any;
    const response = { transactionId: stagedRow.id, status: staged.reset || staged.created ? "pending" : stagedRow.status, paymentStatus: staged.reset || staged.created ? "pendente" : paymentState(String(stagedRow.status), paymentSource), chargedAtFinalization: true, ...BETA };
    if (staged.created || staged.reset) res.status(201).json(response);
    else res.json(response);
  } catch (err: any) {
    if (err?.code === "23505" || err?.cause?.code === "23505") {
      const concurrent = await db.execute(sql`SELECT id, status FROM payment_transactions WHERE module = ${module} AND reference_id = ${referenceId} LIMIT 1`);
      if (concurrent.rows[0]) {
        const row = concurrent.rows[0] as any;
        res.json({ transactionId: row.id, status: row.status, paymentStatus: paymentState(String(row.status), paymentSource), chargedAtFinalization: true, ...BETA });
        return;
      }
    }
    (req as any).log?.error({ err: err instanceof Error ? err.message : "unknown" }, "payment staging failed"); res.status(500).json({ error: "payment_staging_failed", ...BETA });
  }
});
router.get("/services/:module/:referenceId/status", requireCustomer, async (req, res) => {
  const module = String(req.params.module);
  const referenceId = Number(req.params.referenceId);
  const customerId = (req as any).customerId;
  if (!["motorista", "entrega"].includes(module) || !Number.isInteger(referenceId) || referenceId <= 0) { res.status(400).json({ error: "invalid_service_reference" }); return; }
  await ensureServicePaymentSchema();
  const services = module === "motorista"
    ? await db.execute(sql`SELECT id, empresa_id, payment_source FROM corridas WHERE id = ${referenceId} AND customer_id = ${customerId} LIMIT 1`)
    : await db.execute(sql`SELECT id, empresa_id, payment_source FROM entregas WHERE id = ${referenceId} AND customer_id = ${customerId} LIMIT 1`);
  const service = services.rows[0] as any;
  if (!service) { res.status(404).json({ error: "service_not_found" }); return; }
  if (service.payment_source === "direto") {
    res.json({ module, referenceId, paymentSource: "direto", paymentStatus: "direto", status: "direct", method: null, pix: null });
    return;
  }
  const rows = await db.execute(sql`SELECT status, method, payment_source, metadata, provider_order_id,
    provider_payment_id, external_reference, gross_amount_cents
    FROM payment_transactions WHERE module = ${module} AND reference_id = ${String(referenceId)}`);
  if (rows.rows.length !== 1) { res.status(409).json({ error: "payment_intent_not_available" }); return; }
  const transaction = rows.rows[0] as any;
  let rawStatus = String(transaction.status);
  if (rawStatus === "pending" && transaction.method === "card" && transaction.provider_order_id) {
    try {
      const token = await globalAccessToken();
      if (!token) { missingCredentials(res); return; }
      const order = await mp(`/v1/orders/${encodeURIComponent(String(transaction.provider_order_id))}`, token);
      const providerAmountCents = Math.round(Number(order.total_amount) * 100);
      if (String(order.external_reference ?? "") !== String(transaction.external_reference) ||
        providerAmountCents !== Number(transaction.gross_amount_cents)) {
        res.status(502).json({ error: "invalid_payment_reference_or_amount" }); return;
      }
      const reconciled = automaticPaymentStatus(order);
      if (TERMINAL_STATUSES.has(reconciled)) {
        const providerPaymentId = String(order?.transactions?.payments?.[0]?.id ?? "");
        await db.execute(sql`UPDATE payment_transactions SET status = ${reconciled},
          provider_payment_id = ${providerPaymentId || transaction.provider_payment_id || null},
          encrypted_payment_token = NULL, updated_at = NOW()
          WHERE module = ${module} AND reference_id = ${String(referenceId)} AND status = 'pending'`);
        rawStatus = reconciled;
      }
    } catch (error) {
      (req as any).log?.warn({ err: error instanceof Error ? error.message : "unknown" }, "Mercado Pago order status reconciliation failed");
      res.status(502).json({ error: "payment_status_reconciliation_failed" }); return;
    }
  }
  const pending = !TERMINAL_STATUSES.has(rawStatus);
  const pix = pending && transaction.method === "pix" ? sanitizedPixData(transaction.metadata?.pix) : null;
  res.json({
    module,
    referenceId,
    paymentSource: transaction.payment_source === "wallet" ? "wallet" : "mercado_pago",
    paymentStatus: paymentState(rawStatus, String(transaction.payment_source)),
    status: rawStatus,
    method: transaction.method,
    pix,
  });
});
router.post("/services/:module/:referenceId/cancel", requireCustomer, async (req, res) => {
  const module = String(req.params.module);
  const referenceId = Number(req.params.referenceId);
  const customerId = (req as any).customerId;
  if (!["motorista", "entrega"].includes(module) || !Number.isInteger(referenceId) || referenceId <= 0) { res.status(400).json({ error: "invalid_service_reference" }); return; }
  await ensureServicePaymentSchema();
  const result = await db.transaction(async tx => {
    let paymentSource = "direto";
    if (module === "motorista") {
      const rows = await tx.execute(sql`SELECT id, empresa_id, status, COALESCE(payment_source, 'direto') AS payment_source FROM corridas WHERE id = ${referenceId} AND customer_id = ${customerId} FOR UPDATE`);
      const service = rows.rows[0] as any;
      if (!service) return "not_found";
      if (!["aguardando", "aceita", "a_caminho"].includes(String(service.status))) return "not_cancellable";
      paymentSource = String(service.payment_source);
      await tx.execute(sql`SELECT id FROM corridas_solicitadas WHERE corrida_id = ${referenceId} FOR UPDATE`);
    } else {
      const rows = await tx.execute(sql`SELECT id, empresa_id, status, COALESCE(payment_source, 'direto') AS payment_source FROM entregas WHERE id = ${referenceId} AND customer_id = ${customerId} FOR UPDATE`);
      const service = rows.rows[0] as any;
      if (!service) return "not_found";
      if (!["pendente", "aguardando"].includes(String(service.status))) return "not_cancellable";
      paymentSource = String(service.payment_source);
      await tx.execute(sql`SELECT id FROM entregas_solicitadas WHERE entrega_id = ${referenceId} FOR UPDATE`);
    }
    if (paymentSource !== "direto") {
      const intents = await tx.execute(sql`SELECT id, status FROM payment_transactions WHERE module = ${module} AND reference_id = ${String(referenceId)} FOR UPDATE`);
      if (intents.rows.length !== 1 || String((intents.rows[0] as any).status) !== "pending") return "payment_not_cancellable";
      await tx.execute(sql`UPDATE payment_transactions SET status = 'cancelled',
        encrypted_payment_token = NULL,
        metadata = COALESCE(metadata, '{}'::jsonb) - 'pix', updated_at = NOW()
        WHERE id = ${(intents.rows[0] as any).id} AND status = 'pending'`);
    }
    if (module === "motorista") {
      await tx.execute(sql`UPDATE corridas SET status = 'cancelada', cancelado_em = NOW() WHERE id = ${referenceId}`);
      await tx.execute(sql`UPDATE corridas_solicitadas SET status = 'cancelada' WHERE corrida_id = ${referenceId} AND status NOT IN ('finalizada','cancelada')`);
    } else {
      await tx.execute(sql`UPDATE entregas SET status = 'cancelada' WHERE id = ${referenceId}`);
      await tx.execute(sql`UPDATE entregas_solicitadas SET status = 'cancelada' WHERE entrega_id = ${referenceId} AND status NOT IN ('finalizada','cancelada')`);
    }
    return "cancelled";
  });
  if (result === "not_found") { res.status(404).json({ error: "service_not_found" }); return; }
  if (result === "not_cancellable") { res.status(409).json({ error: "service_not_cancellable" }); return; }
  if (result === "payment_not_cancellable") { res.status(409).json({ error: "payment_not_cancellable" }); return; }
  res.json({ cancelled: true, module, referenceId });
});
router.post("/webhook/mercado-pago", async (req, res) => {
  const providerObjectId = String(req.body?.data?.id ?? req.query["data.id"] ?? "");
  const eventType = String(req.body?.type ?? req.query.type ?? "payment");
  const isOrderEvent = eventType.toLowerCase().includes("order") || providerObjectId.startsWith("ORD");
  const eventId = String(req.headers["x-request-id"] ?? `${eventType}:${providerObjectId}`);
  if (!providerObjectId) { res.status(400).json({ error: "missing_provider_object_id" }); return; }
  if (!validWebhookSignature(req, providerObjectId)) { res.status(401).json({ error: "invalid_webhook_signature" }); return; }
  try {
    const recorded = await db.execute(sql`INSERT INTO mercado_pago_webhook_events (provider_event_id, provider_payment_id, event_type) VALUES (${eventId}, ${providerObjectId}, ${eventType}) ON CONFLICT (provider_event_id) DO NOTHING RETURNING id`);
    if (!recorded.rows[0]) { res.json({ received: true, duplicate: true, ...BETA }); return; }
    const token = await globalAccessToken();
    if (!token) {
      await db.execute(sql`DELETE FROM mercado_pago_webhook_events WHERE provider_event_id = ${eventId}`);
      missingCredentials(res);
      return;
    }
    const providerObject = await mp(isOrderEvent
      ? `/v1/orders/${encodeURIComponent(providerObjectId)}`
      : `/v1/payments/${encodeURIComponent(providerObjectId)}`, token);
    const providerPaymentId = String(isOrderEvent ? providerObject?.transactions?.payments?.[0]?.id ?? "" : providerObjectId);
    const providerOrderId = isOrderEvent ? String(providerObject.id) : "";
    const external = String(providerObject.external_reference || "");
    let found = await db.execute(sql`SELECT id, module, reference_id, customer_id, gross_amount_cents, status, external_reference
      FROM payment_transactions
      WHERE (${providerPaymentId || null}::text IS NOT NULL AND provider_payment_id = ${providerPaymentId || null})
         OR (${providerOrderId || null}::text IS NOT NULL AND provider_order_id = ${providerOrderId || null})
      LIMIT 1 FOR UPDATE`);
    // Provider IDs are authoritative once persisted. The external-reference
    // fallback is only for the create/webhook race and must match this attempt.
    if (!found.rows[0] && external) {
      found = await db.execute(sql`SELECT id, module, reference_id, customer_id, gross_amount_cents, status, external_reference
        FROM payment_transactions WHERE external_reference = ${external} LIMIT 1 FOR UPDATE`);
    }
    const transaction = found.rows[0] as any;
    if (!transaction) { res.json({ received: true, unmatched: true, ...BETA }); return; }
    const providerAmountCents = Math.round(Number(isOrderEvent ? providerObject.total_amount : providerObject.transaction_amount) * 100);
    const validCurrency = isOrderEvent || String(providerObject.currency_id) === "BRL";
    if (external !== transaction.external_reference || !validCurrency || providerAmountCents !== Number(transaction.gross_amount_cents)) {
      res.status(400).json({ error: "invalid_payment_reference_or_amount" }); return;
    }
    const rawStatus = isOrderEvent ? automaticPaymentStatus(providerObject) : String(providerObject.status);
    const candidateStatus = rawStatus === "in_process" ? "processing" : rawStatus;
    const status = ["approved", "pending", "processing", "rejected", "cancelled", "refunded"].includes(candidateStatus) ? candidateStatus : "pending";
    if (TERMINAL_STATUSES.has(String(transaction.status)) && String(transaction.status) !== status) {
      res.json({ received: true, ignored: "non_monotonic_transition", ...BETA }); return;
    }
    await db.execute(sql`UPDATE payment_transactions SET
      provider_payment_id = COALESCE(${providerPaymentId || null}, provider_payment_id),
      provider_order_id = COALESCE(${providerOrderId || null}, provider_order_id),
      encrypted_payment_token = CASE WHEN ${TERMINAL_STATUSES.has(status)} THEN NULL ELSE encrypted_payment_token END,
      metadata = COALESCE(metadata, '{}'::jsonb)
        || ${JSON.stringify(providerPaymentId ? { mercadoPagoTransactionId: providerPaymentId } : {})}::jsonb,
      status = ${status}, updated_at = NOW() WHERE id = ${transaction.id}`);
    await db.execute(sql`UPDATE payment_transactions SET
      metadata = CASE WHEN ${TERMINAL_STATUSES.has(status)} THEN COALESCE(metadata, '{}'::jsonb) - 'pix' ELSE metadata END,
      updated_at = NOW() WHERE id = ${transaction.id}`);
    if (transaction.module === "wallet_topup" && status === "approved") await creditWallet({ customerId: Number(transaction.customer_id), amountCents: Number(transaction.gross_amount_cents), transactionId: Number(transaction.id), idempotencyKey: `mp-topup:${transaction.id}:${providerPaymentId}`, description: "Recarga Mercado Pago" });
    if ((transaction.module === "motorista" || transaction.module === "entrega") && status === "approved") {
      await settleServiceEarning(transaction.module, String(transaction.reference_id), Number(transaction.id));
    }
    res.json({ received: true, ...BETA });
  } catch (err) {
    await db.execute(sql`DELETE FROM mercado_pago_webhook_events WHERE provider_event_id = ${eventId}`).catch(() => undefined);
    (req as any).log?.error({ err: err instanceof Error ? err.message : "unknown" }, "Mercado Pago webhook failed");
    res.status(502).json({ error: "webhook_processing_failed" });
  }
});
router.get("/transactions/:id", requireCustomer, async (req, res) => {
  const id = Number(req.params.id); if (!Number.isInteger(id)) { res.status(400).json({ error: "invalid_transaction_id" }); return; }
  const rows = await db.execute(sql`SELECT id, module, reference_id, payment_source, method, status, gross_amount_cents, platform_fee_cents, init_point, sandbox_init_point, created_at, updated_at FROM payment_transactions WHERE id = ${id} AND customer_id = ${(req as any).customerId} LIMIT 1`);
  if (!rows.rows[0]) { res.status(404).json({ error: "not_found" }); return; } res.json({ transaction: rows.rows[0], ...BETA });
});
router.get("/partner-transactions", requirePartner, async (req, res) => {
  const rows = await db.execute(sql`SELECT id, module, reference_id, payment_source, method, status, gross_amount_cents, platform_fee_cents, provider_payment_id, created_at FROM payment_transactions WHERE empresa_id = ${(req as any).empresaId} ORDER BY id DESC LIMIT 100`);
  const summary = await db.execute(sql`SELECT COUNT(*)::int AS count, COALESCE(SUM(gross_amount_cents) FILTER (WHERE status = 'approved'), 0)::int AS approved_gross_cents, COALESCE(SUM(platform_fee_cents) FILTER (WHERE status = 'approved'), 0)::int AS platform_fee_cents FROM payment_transactions WHERE empresa_id = ${(req as any).empresaId}`);
  res.json({ summary: summary.rows[0], transactions: rows.rows, ...BETA });
});

export default router;