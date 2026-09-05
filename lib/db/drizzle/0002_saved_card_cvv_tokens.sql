CREATE TABLE IF NOT EXISTS "payment_transactions" (
  "id" serial PRIMARY KEY NOT NULL,
  "empresa_id" integer,
  "customer_id" integer,
  "module" text NOT NULL,
  "reference_id" text NOT NULL,
  "payment_source" text NOT NULL,
  "method" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "gross_amount_cents" integer NOT NULL,
  "platform_fee_cents" integer DEFAULT 0 NOT NULL,
  "provider_preference_id" text,
  "provider_payment_id" text,
  "provider_order_id" text,
  "init_point" text,
  "sandbox_init_point" text,
  "external_reference" text NOT NULL UNIQUE,
  "idempotency_key" text NOT NULL UNIQUE,
  "encrypted_payment_token" text,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_mercado_pago_cards" (
  "id" serial PRIMARY KEY NOT NULL,
  "customer_id" integer NOT NULL UNIQUE,
  "mercado_pago_customer_id" text NOT NULL,
  "mercado_pago_card_id" text NOT NULL,
  "mercado_pago_payment_profile_id" text,
  "last_four" text NOT NULL,
  "payment_method" text NOT NULL,
  "payment_type" text DEFAULT 'credit_card' NOT NULL,
  "brand" text NOT NULL,
  "expiration_month" integer NOT NULL,
  "expiration_year" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_transactions_module_reference_idx" ON "payment_transactions" ("module", "reference_id");
--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "encrypted_payment_token" text;
--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "provider_order_id" text;
--> statement-breakpoint
ALTER TABLE "customer_mercado_pago_cards" ADD COLUMN IF NOT EXISTS "mercado_pago_payment_profile_id" text;
--> statement-breakpoint
ALTER TABLE "customer_mercado_pago_cards" ALTER COLUMN "mercado_pago_payment_profile_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "customer_mercado_pago_cards" ADD COLUMN IF NOT EXISTS "payment_type" text DEFAULT 'credit_card' NOT NULL;