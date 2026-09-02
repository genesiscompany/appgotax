import { boolean, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** Amounts in this schema are always integer BRL cents. */
export const paymentFeesTable = pgTable("payment_fees", {
  id: serial("id").primaryKey(),
  method: text("method").notNull().unique(), // pix | card | wallet
  percentageBasisPoints: integer("percentage_basis_points").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mercadoPagoConfigTable = pgTable("mercado_pago_config", {
  id: integer("id").primaryKey().default(1),
  publicKey: text("public_key"),
  encryptedAccessToken: text("encrypted_access_token"),
  enabled: boolean("enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const empresaMercadoPagoConfigsTable = pgTable("empresa_mercado_pago_configs", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id").notNull().unique(),
  publicKey: text("public_key"),
  encryptedAccessToken: text("encrypted_access_token"),
  mercadoPagoUserId: text("mercado_pago_user_id"),
  enabled: boolean("enabled").notNull().default(false),
  directPaymentEnabled: boolean("direct_payment_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const paymentTransactionsTable = pgTable("payment_transactions", {
  id: serial("id").primaryKey(),
  empresaId: integer("empresa_id"),
  customerId: integer("customer_id"),
  module: text("module").notNull(),
  referenceId: text("reference_id").notNull(),
  paymentSource: text("payment_source").notNull(), // mercado_pago | wallet
  method: text("method"),
  status: text("status").notNull().default("pending"),
  grossAmountCents: integer("gross_amount_cents").notNull(),
  platformFeeCents: integer("platform_fee_cents").notNull().default(0),
  providerPreferenceId: text("provider_preference_id"),
  providerPaymentId: text("provider_payment_id"),
  initPoint: text("init_point"),
  sandboxInitPoint: text("sandbox_init_point"),
  externalReference: text("external_reference").notNull().unique(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customerWalletAccountsTable = pgTable("customer_wallet_accounts", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().unique(),
  balanceCents: integer("balance_cents").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customerWalletLedgerTable = pgTable("customer_wallet_ledger", {
  id: serial("id").primaryKey(),
  walletAccountId: integer("wallet_account_id").notNull(),
  customerId: integer("customer_id").notNull(),
  transactionId: integer("transaction_id"),
  direction: text("direction").notNull(), // credit | debit
  amountCents: integer("amount_cents").notNull(),
  balanceAfterCents: integer("balance_after_cents").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("customer_wallet_ledger_idempotency_key_idx").on(table.idempotencyKey)]);

export const mercadoPagoWebhookEventsTable = pgTable("mercado_pago_webhook_events", {
  id: serial("id").primaryKey(),
  providerEventId: text("provider_event_id").notNull().unique(),
  providerPaymentId: text("provider_payment_id"),
  eventType: text("event_type"),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPaymentFeeSchema = createInsertSchema(paymentFeesTable).omit({ id: true, updatedAt: true });
export type InsertPaymentFee = z.infer<typeof insertPaymentFeeSchema>;
export type PaymentTransaction = typeof paymentTransactionsTable.$inferSelect;
export type CustomerWalletAccount = typeof customerWalletAccountsTable.$inferSelect;