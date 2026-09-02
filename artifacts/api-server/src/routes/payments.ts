import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { creditWallet } from "../lib/wallet";

const router: IRouter = Router();
const BETA = { beta: true, sandbox: true };
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
  const token = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : "";
  try { return Number(Buffer.from(token, "base64").toString("utf8").match(/^cl_(\d+):/)?.[1]) || null; } catch { return null; }
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
function missingCredentials(res: Response) { res.status(503).json({ error: "mercado_pago_not_configured", message: "Mercado Pago credentials are not configured", ...BETA }); }
async function mp(path: string, token: string, options: RequestInit = {}) {
  const response = await fetch(`https://api.mercadopago.com${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`Mercado Pago request failed (${response.status})`);
  return response.json() as Promise<any>;
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
  const rows = await db.execute(sql`SELECT public_key, encrypted_access_token, enabled FROM mercado_pago_config WHERE id = 1 LIMIT 1`);
  const config = rows.rows[0] as any;
  return {
    publicKey: String(config?.public_key ?? process.env.MERCADO_PAGO_PUBLIC_KEY ?? process.env.MP_PUBLIC_KEY ?? ""),
    encryptedAccessToken: String(config?.encrypted_access_token ?? ""),
    enabled: !!config?.enabled,
  };
}
async function globalAccessToken() {
  const config = await globalMercadoPagoConfig();
  if (config.encryptedAccessToken) return decryptToken(config.encryptedAccessToken);
  return process.env.MERCADO_PAGO_ACCESS_TOKEN || "";
}
function globalCredentialsAvailable(config: Awaited<ReturnType<typeof globalMercadoPagoConfig>>) {
  return !!config.publicKey && (!!config.encryptedAccessToken || !!process.env.MERCADO_PAGO_ACCESS_TOKEN);
}
function globalIntegrationConfigured(config: Awaited<ReturnType<typeof globalMercadoPagoConfig>>) {
  return config.enabled && globalCredentialsAvailable(config);
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
  res.json({ publicKey: config.publicKey, configured: globalCredentialsAvailable(config), enabled: config.enabled, ...BETA });
});
router.put("/admin/config", requireAdmin, async (req, res) => {
  const b = req.body || {};
  if (b.accessToken !== undefined && (typeof b.accessToken !== "string" || b.accessToken.trim().length < 10)) {
    res.status(400).json({ error: "invalid_access_token", message: "Access Token inválido" });
    return;
  }
  try {
    const previous = await globalMercadoPagoConfig();
    const publicKey = typeof b.publicKey === "string" ? b.publicKey.trim() : previous.publicKey;
    const encrypted = b.accessToken === undefined ? previous.encryptedAccessToken : encryptToken(b.accessToken.trim());
    const enabled = !!b.enabled;
    const tokenAvailable = !!encrypted || !!process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (enabled && (!publicKey || !tokenAvailable)) {
      res.status(400).json({ error: "mercado_pago_credentials_required", message: "Public Key e Access Token são obrigatórios para ativar o Mercado Pago" });
      return;
    }
    await db.execute(sql`INSERT INTO mercado_pago_config (id, public_key, encrypted_access_token, enabled)
      VALUES (1, ${publicKey || null}, ${encrypted || null}, ${enabled})
      ON CONFLICT (id) DO UPDATE SET public_key = EXCLUDED.public_key, encrypted_access_token = EXCLUDED.encrypted_access_token, enabled = EXCLUDED.enabled, updated_at = NOW()`);
    res.json({ publicKey, configured: !!publicKey && tokenAvailable, enabled, ...BETA });
  } catch (err) {
    console.error("[mercado-pago admin config]", err);
    res.status(503).json({ error: "credential_encryption_unavailable", message: "Não foi possível armazenar as credenciais de pagamento" });
  }
});
router.get("/admin/fees", requireAdmin, async (_req, res) => res.json({ feesBasisPoints: await fees(), ...BETA }));
router.put("/admin/fees", requireAdmin, async (req, res) => {
  for (const m of METHODS) { const v = Number(req.body?.[m]); if (!Number.isInteger(v) || v < 0 || v > 10000) { res.status(400).json({ error: "invalid_fee", message: `${m} must be basis points from 0 to 10000` }); return; } }
  for (const m of METHODS) await db.execute(sql`INSERT INTO payment_fees (method, percentage_basis_points) VALUES (${m}, ${Number(req.body[m])}) ON CONFLICT (method) DO UPDATE SET percentage_basis_points = EXCLUDED.percentage_basis_points, updated_at = NOW()`);
  res.json({ feesBasisPoints: await fees(), ...BETA });
});
router.get("/wallet", requireCustomer, async (req, res) => { const r = await db.execute(sql`SELECT balance_cents FROM customer_wallet_accounts WHERE customer_id = ${(req as any).customerId} LIMIT 1`); res.json({ balanceCents: Number((r.rows[0] as any)?.balance_cents ?? 0), ...BETA }); });
router.get("/wallet/ledger", requireCustomer, async (req, res) => { const r = await db.execute(sql`SELECT id, direction, amount_cents, balance_after_cents, description, created_at FROM customer_wallet_ledger WHERE customer_id = ${(req as any).customerId} ORDER BY id DESC LIMIT 100`); res.json({ entries: r.rows, ...BETA }); });
router.post("/wallet/topup", requireCustomer, async (req, res) => {
  const amountCents = Number(req.body?.amountCents);
  if (!Number.isInteger(amountCents) || amountCents < 100 || amountCents > 100000000) { res.status(400).json({ error: "invalid_amount_cents" }); return; }
  const token = await globalAccessToken();
  if (!token) { missingCredentials(res); return; }
  const externalReference = `wallet-topup:${(req as any).customerId}:${randomUUID()}`;
  try {
    const base = hostUrl(req);
    const preference = await mp("/checkout/preferences", token, { method: "POST", body: JSON.stringify({ items: [{ title: "Recarga de carteira", quantity: 1, unit_price: amountCents / 100, currency_id: "BRL" }], external_reference: externalReference, notification_url: `${base}/api/payments/webhook/mercado-pago`, back_urls: { success: `${base}/`, failure: `${base}/`, pending: `${base}/` }, auto_return: "approved" }) });
    const tx = await db.execute(sql`INSERT INTO payment_transactions (customer_id, module, reference_id, payment_source, method, status, gross_amount_cents, platform_fee_cents, provider_preference_id, init_point, sandbox_init_point, external_reference, idempotency_key)
      VALUES (${(req as any).customerId}, 'wallet_topup', ${externalReference}, 'mercado_pago', 'wallet', 'pending', ${amountCents}, 0, ${preference.id ?? null}, ${preference.init_point ?? null}, ${preference.sandbox_init_point ?? null}, ${externalReference}, ${`topup:${externalReference}`}) RETURNING id`);
    res.status(201).json({ transactionId: (tx.rows[0] as any).id, initPoint: preference.init_point ?? null, sandboxInitPoint: preference.sandbox_init_point ?? null, ...BETA });
  } catch (err) { (req as any).log?.error({ err: err instanceof Error ? err.message : "unknown" }, "payment topup failed"); res.status(502).json({ error: "mercado_pago_unavailable", ...BETA }); }
});
router.post("/checkout", requireCustomer, async (req, res) => {
  const { module, referenceId, paymentSource, mercadoPagoMethod } = req.body || {};
  if (typeof module !== "string" || typeof referenceId !== "string" || !["mercado_pago", "wallet"].includes(paymentSource) || !METHODS.includes(mercadoPagoMethod)) { res.status(400).json({ error: "invalid_checkout_request" }); return; }
  const order = await resolveAmount(module, referenceId);
  if (!order) { res.status(404).json({ error: "authoritative_order_not_found" }); return; }
  const externalReference = `checkout:${module}:${referenceId}:${randomUUID()}`, idempotencyKey = `checkout:${(req as any).customerId}:${externalReference}`;
  if (paymentSource === "wallet") {
    try {
      const result = await db.transaction(async tx => {
        await tx.execute(sql`INSERT INTO customer_wallet_accounts (customer_id, balance_cents) VALUES (${(req as any).customerId}, 0) ON CONFLICT (customer_id) DO NOTHING`);
        const a = await tx.execute(sql`SELECT id, balance_cents FROM customer_wallet_accounts WHERE customer_id = ${(req as any).customerId} FOR UPDATE`);
        const wallet = a.rows[0] as any; if (Number(wallet.balance_cents) < order.amountCents) throw new Error("insufficient_wallet_balance");
        const inserted = await tx.execute(sql`INSERT INTO payment_transactions (empresa_id, customer_id, module, reference_id, payment_source, method, status, gross_amount_cents, platform_fee_cents, external_reference, idempotency_key) VALUES (${order.empresaId}, ${(req as any).customerId}, ${module}, ${referenceId}, 'wallet', 'wallet', 'approved', ${order.amountCents}, 0, ${externalReference}, ${idempotencyKey}) RETURNING id`);
        const balance = Number(wallet.balance_cents) - order.amountCents;
        await tx.execute(sql`UPDATE customer_wallet_accounts SET balance_cents = ${balance}, updated_at = NOW() WHERE id = ${wallet.id}`);
        await tx.execute(sql`INSERT INTO customer_wallet_ledger (wallet_account_id, customer_id, transaction_id, direction, amount_cents, balance_after_cents, idempotency_key, description) VALUES (${wallet.id}, ${(req as any).customerId}, ${Number((inserted.rows[0] as any).id)}, 'debit', ${order.amountCents}, ${balance}, ${`debit:${idempotencyKey}`}, 'Pagamento com carteira')`);
        return { transactionId: Number((inserted.rows[0] as any).id), balanceCents: balance };
      }); res.status(201).json({ ...result, status: "approved", ...BETA }); return;
    } catch (err) { if (err instanceof Error && err.message === "insufficient_wallet_balance") { res.status(409).json({ error: "insufficient_wallet_balance" }); return; } res.status(500).json({ error: "wallet_payment_failed" }); return; }
  }
  const partnerRows = await db.execute(sql`SELECT enabled FROM empresa_mercado_pago_configs WHERE empresa_id = ${order.empresaId} LIMIT 1`);
  const partner = partnerRows.rows[0] as any;
  const global = await globalMercadoPagoConfig();
  if (!globalIntegrationConfigured(global) || (partner && !partner.enabled)) { missingCredentials(res); return; }
  try {
    const method = mercadoPagoMethod as Method;
    const token = await globalAccessToken(), feeCents = Math.round(order.amountCents * (await fees())[method] / 10000);
    const base = hostUrl(req);
    const p = await mp("/checkout/preferences", token, { method: "POST", body: JSON.stringify({ items: [{ title: `Pagamento ${module}`, quantity: 1, unit_price: order.amountCents / 100, currency_id: "BRL" }], external_reference: externalReference, notification_url: `${base}/api/payments/webhook/mercado-pago`, back_urls: { success: `${base}/`, failure: `${base}/`, pending: `${base}/` } }) });
    const saved = await db.execute(sql`INSERT INTO payment_transactions (empresa_id, customer_id, module, reference_id, payment_source, method, status, gross_amount_cents, platform_fee_cents, provider_preference_id, init_point, sandbox_init_point, external_reference, idempotency_key) VALUES (${order.empresaId}, ${(req as any).customerId}, ${module}, ${referenceId}, 'mercado_pago', ${mercadoPagoMethod}, 'pending', ${order.amountCents}, ${feeCents}, ${p.id ?? null}, ${p.init_point ?? null}, ${p.sandbox_init_point ?? null}, ${externalReference}, ${idempotencyKey}) RETURNING id`);
    res.status(201).json({ transactionId: (saved.rows[0] as any).id, initPoint: p.init_point ?? null, sandboxInitPoint: p.sandbox_init_point ?? null, ...BETA });
  } catch (err) { (req as any).log?.error({ err: err instanceof Error ? err.message : "unknown" }, "payment checkout failed"); res.status(502).json({ error: "mercado_pago_unavailable", ...BETA }); }
});
router.post("/webhook/mercado-pago", async (req, res) => {
  const providerPaymentId = String(req.body?.data?.id ?? req.query["data.id"] ?? "");
  const eventId = String(req.headers["x-request-id"] ?? `${req.body?.type ?? "payment"}:${providerPaymentId}`);
  if (!providerPaymentId) { res.status(400).json({ error: "missing_payment_id" }); return; }
  try {
    const recorded = await db.execute(sql`INSERT INTO mercado_pago_webhook_events (provider_event_id, provider_payment_id, event_type) VALUES (${eventId}, ${providerPaymentId}, ${typeof req.body?.type === "string" ? req.body.type : null}) ON CONFLICT (provider_event_id) DO NOTHING RETURNING id`);
    if (!recorded.rows[0]) { res.json({ received: true, duplicate: true, ...BETA }); return; }
    const token = await globalAccessToken();
    if (!token) {
      await db.execute(sql`DELETE FROM mercado_pago_webhook_events WHERE provider_event_id = ${eventId}`);
      missingCredentials(res);
      return;
    }
    const payment = await mp(`/v1/payments/${encodeURIComponent(providerPaymentId)}`, token);
    const external = String(payment.external_reference || "");
    const found = await db.execute(sql`SELECT id, module, customer_id, gross_amount_cents, status FROM payment_transactions WHERE external_reference = ${external} OR provider_payment_id = ${providerPaymentId} LIMIT 1`);
    const transaction = found.rows[0] as any;
    if (!transaction) { res.json({ received: true, unmatched: true, ...BETA }); return; }
    const status = ["approved", "pending", "in_process", "rejected", "cancelled", "refunded"].includes(payment.status) ? payment.status : "pending";
    await db.execute(sql`UPDATE payment_transactions SET provider_payment_id = ${providerPaymentId}, status = ${status}, updated_at = NOW() WHERE id = ${transaction.id}`);
    if (transaction.module === "wallet_topup" && status === "approved") await creditWallet({ customerId: Number(transaction.customer_id), amountCents: Number(transaction.gross_amount_cents), transactionId: Number(transaction.id), idempotencyKey: `mp-topup:${transaction.id}:${providerPaymentId}`, description: "Recarga Mercado Pago" });
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