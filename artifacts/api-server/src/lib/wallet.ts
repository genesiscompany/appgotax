import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * Credits a customer's wallet once. Ledger rows are immutable and the unique
 * idempotency key makes this safe for webhook and retry callers.
 */
export async function creditWallet({
  customerId,
  amountCents,
  idempotencyKey,
  description,
  transactionId,
}: {
  customerId: number;
  amountCents: number;
  idempotencyKey: string;
  description?: string;
  transactionId?: number;
}): Promise<{ credited: boolean; balanceCents: number }> {
  if (!Number.isInteger(customerId) || customerId <= 0) throw new Error("Invalid wallet customer");
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error("Invalid wallet credit amount");
  if (!idempotencyKey || idempotencyKey.length > 190) throw new Error("Invalid wallet idempotency key");

  return db.transaction(async (tx) => {
    await tx.execute(sql`
      INSERT INTO customer_wallet_accounts (customer_id, balance_cents)
      VALUES (${customerId}, 0)
      ON CONFLICT (customer_id) DO NOTHING
    `);
    const existing = await tx.execute(sql`
      SELECT balance_after_cents FROM customer_wallet_ledger
      WHERE idempotency_key = ${idempotencyKey} LIMIT 1
    `);
    if (existing.rows[0]) {
      return { credited: false, balanceCents: Number((existing.rows[0] as any).balance_after_cents) };
    }
    const account = await tx.execute(sql`
      SELECT id, balance_cents FROM customer_wallet_accounts
      WHERE customer_id = ${customerId} FOR UPDATE
    `);
    const row = account.rows[0] as any;
    const balanceCents = Number(row.balance_cents) + amountCents;
    await tx.execute(sql`UPDATE customer_wallet_accounts SET balance_cents = ${balanceCents}, updated_at = NOW() WHERE id = ${row.id}`);
    await tx.execute(sql`
      INSERT INTO customer_wallet_ledger
        (wallet_account_id, customer_id, transaction_id, direction, amount_cents, balance_after_cents, idempotency_key, description)
      VALUES (${row.id}, ${customerId}, ${transactionId ?? null}, 'credit', ${amountCents}, ${balanceCents}, ${idempotencyKey}, ${description ?? null})
    `);
    return { credited: true, balanceCents };
  });
}