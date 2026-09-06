import { db } from "@workspace/db";

let initialization: Promise<void> | null = null;

export function ensurePushTables(): Promise<void> {
  if (initialization) return initialization;

  initialization = (async () => {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS push_tokens (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER,
        token TEXT NOT NULL,
        plataforma TEXT DEFAULT 'expo',
        modulos TEXT[] DEFAULT '{}'::text[],
        ativo BOOLEAN DEFAULT true,
        criado_em TIMESTAMP DEFAULT NOW(),
        atualizado_em TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS push_tokens_token_idx
      ON push_tokens (token)
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS push_historico (
        id SERIAL PRIMARY KEY,
        titulo TEXT NOT NULL,
        mensagem TEXT NOT NULL,
        modulo TEXT DEFAULT 'todos',
        total_tokens INTEGER DEFAULT 0,
        total_enviado INTEGER DEFAULT 0,
        criado_em TIMESTAMP DEFAULT NOW()
      )
    `);
  })().catch(error => {
    initialization = null;
    throw error;
  });

  return initialization;
}