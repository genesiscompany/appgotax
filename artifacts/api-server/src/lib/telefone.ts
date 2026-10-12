import { sql, type SQL } from "drizzle-orm";

/** Só dígitos; remove o prefixo 55 (Brasil) quando o número tem 12 ou 13 dígitos. */
export function normalizarTelefone(valor: unknown): string {
  const digitos = String(valor ?? "").replace(/\D/g, "");
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) {
    return digitos.slice(2);
  }
  return digitos;
}

/** Expressão SQL que aplica a mesma normalização a uma coluna (ignora máscara e prefixo 55). */
export function telefoneNormalizadoSql(coluna: string): SQL {
  if (!/^[a-z_][a-z0-9_.]*$/i.test(coluna)) throw new Error("coluna inválida");
  const digitos = `REGEXP_REPLACE(COALESCE(${coluna}, ''), '\\D', '', 'g')`;
  return sql.raw(
    `(CASE WHEN LENGTH(${digitos}) IN (12, 13) AND ${digitos} LIKE '55%' THEN SUBSTRING(${digitos} FROM 3) ELSE ${digitos} END)`,
  );
}
