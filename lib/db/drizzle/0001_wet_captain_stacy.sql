CREATE TABLE IF NOT EXISTS "subcategorias_alimentacao" (
"id" serial PRIMARY KEY NOT NULL,
"nome" text NOT NULL,
"slug" text NOT NULL,
"emoji" text,
"ordem" integer DEFAULT 0 NOT NULL,
"ativo" boolean DEFAULT true NOT NULL,
"criado_em" timestamp DEFAULT now() NOT NULL,
CONSTRAINT "subcategorias_alimentacao_nome_unique" UNIQUE("nome"),
CONSTRAINT "subcategorias_alimentacao_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "restaurantes" ADD COLUMN IF NOT EXISTS "subcategoria_id" integer;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "restaurantes"
    ADD CONSTRAINT "restaurantes_subcategoria_id_fkey"
    FOREIGN KEY ("subcategoria_id") REFERENCES "subcategorias_alimentacao"("id")
    ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
