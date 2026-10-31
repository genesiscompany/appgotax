import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

let schemaReady: Promise<void> | null = null;

export function ensureSosSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const stmts = [
        `CREATE TABLE IF NOT EXISTS sos_centros (
          id SERIAL PRIMARY KEY,
          razao_social TEXT NOT NULL,
          nome_fantasia TEXT,
          cnpj VARCHAR(14) NOT NULL UNIQUE,
          endereco TEXT NOT NULL,
          cidade TEXT,
          uf VARCHAR(2),
          telefone VARCHAR(20) NOT NULL,
          email TEXT NOT NULL UNIQUE,
          senha_hash TEXT NOT NULL,
          descricao TEXT,
          necessidades TEXT,
          quantidade_recuperandos INTEGER NOT NULL DEFAULT 0,
          banco_nome TEXT,
          banco_agencia TEXT,
          banco_conta TEXT,
          banco_tipo_conta TEXT,
          banco_titular TEXT,
          banco_chave_pix TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'pendente',
          motivo_status TEXT,
          criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        `CREATE TABLE IF NOT EXISTS sos_recuperandos (
          id SERIAL PRIMARY KEY,
          centro_id INTEGER NOT NULL REFERENCES sos_centros(id) ON DELETE CASCADE,
          nome TEXT NOT NULL,
          idade INTEGER,
          documento VARCHAR(20),
          motivo_internacao TEXT,
          status VARCHAR(30) NOT NULL DEFAULT 'em_tratamento',
          progressao TEXT,
          data_entrada DATE,
          criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS sos_recuperandos_centro_idx ON sos_recuperandos(centro_id)`,
        `CREATE TABLE IF NOT EXISTS sos_necessidades (
          id SERIAL PRIMARY KEY,
          centro_id INTEGER NOT NULL REFERENCES sos_centros(id) ON DELETE CASCADE,
          recuperando_id INTEGER REFERENCES sos_recuperandos(id) ON DELETE SET NULL,
          titulo TEXT NOT NULL,
          descricao TEXT,
          categoria VARCHAR(30) NOT NULL DEFAULT 'outros',
          quantidade TEXT,
          prioridade VARCHAR(10) NOT NULL DEFAULT 'media',
          status VARCHAR(20) NOT NULL DEFAULT 'aberta',
          criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS sos_necessidades_centro_idx ON sos_necessidades(centro_id)`,
        `CREATE TABLE IF NOT EXISTS sos_doacoes (
          id SERIAL PRIMARY KEY,
          tipo VARCHAR(10) NOT NULL,
          valor NUMERIC(12,2),
          descricao TEXT,
          centro_id INTEGER REFERENCES sos_centros(id) ON DELETE SET NULL,
          necessidade_id INTEGER REFERENCES sos_necessidades(id) ON DELETE SET NULL,
          doador_nome TEXT,
          doador_contato TEXT,
          origem VARCHAR(20) NOT NULL DEFAULT 'site',
          status VARCHAR(20) NOT NULL DEFAULT 'informada',
          criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
        `CREATE INDEX IF NOT EXISTS sos_doacoes_criado_idx ON sos_doacoes(criado_em)`,
        `CREATE TABLE IF NOT EXISTS sos_distribuicoes (
          id SERIAL PRIMARY KEY,
          centro_id INTEGER NOT NULL REFERENCES sos_centros(id) ON DELETE CASCADE,
          valor NUMERIC(12,2) NOT NULL,
          observacao TEXT,
          admin_id INTEGER,
          criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
      ];
      for (const s of stmts) await db.execute(sql.raw(s));
    })().catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}

export function somenteDigitos(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

export function cnpjValido(valor: unknown): boolean {
  const c = somenteDigitos(valor);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = base.split("").reduce((acc, d, i) => acc + Number(d) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(c.slice(0, 12));
  const d2 = calc(c.slice(0, 12) + d1);
  return c.endsWith(`${d1}${d2}`);
}

export const SOS_CATEGORIAS = ["alimentos", "higiene", "limpeza", "roupas", "remedios", "moveis", "dinheiro", "outros"];
export const SOS_PRIORIDADES = ["alta", "media", "baixa"];
export const SOS_STATUS_RECUPERANDO = ["em_tratamento", "em_observacao", "concluido", "desistente", "transferido"];
export const SOS_ORIGENS = ["site", "app_cliente", "app_pro", "pdv"];
