import { db } from "@workspace/db";

/** O modo destino desliga sozinho quando o motorista chega a esta distância (km) do destino. */
export const DESTINO_CHEGADA_KM = 1;
export const DESTINOS_SALVOS_MAX = 20;

let initialization: Promise<void> | null = null;

export function ensureDestinoMotorista(): Promise<void> {
  if (initialization) return initialization;

  initialization = (async () => {
    await db.execute(`ALTER TABLE motoristas_app ADD COLUMN IF NOT EXISTS destino_ativo BOOLEAN NOT NULL DEFAULT false`);
    await db.execute(`ALTER TABLE motoristas_app ADD COLUMN IF NOT EXISTS destino_endereco TEXT`);
    await db.execute(`ALTER TABLE motoristas_app ADD COLUMN IF NOT EXISTS destino_lat DOUBLE PRECISION`);
    await db.execute(`ALTER TABLE motoristas_app ADD COLUMN IF NOT EXISTS destino_lng DOUBLE PRECISION`);
    await db.execute(`ALTER TABLE motoristas_app ADD COLUMN IF NOT EXISTS destino_ativado_em TIMESTAMP`);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS motorista_destinos_salvos (
        id SERIAL PRIMARY KEY,
        motorista_id INTEGER NOT NULL,
        nome VARCHAR(60) NOT NULL,
        endereco TEXT NOT NULL,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        criado_em TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(`
      CREATE INDEX IF NOT EXISTS motorista_destinos_salvos_motorista_idx
      ON motorista_destinos_salvos (motorista_id)
    `);
  })().catch((err) => {
    initialization = null;
    throw err;
  });

  return initialization;
}

export function coordenadaValida(lat: unknown, lng: unknown): lat is number {
  const a = Number(lat), b = Number(lng);
  return lat != null && lng != null && Number.isFinite(a) && Number.isFinite(b)
    && Math.abs(a) <= 90 && Math.abs(b) <= 180 && !(a === 0 && b === 0);
}

/** Distância em linha reta (km) entre dois pontos, como expressão SQL. */
export function distanciaKmSql(lat1: string, lng1: string, lat2: string, lng2: string): string {
  return `(6371 * acos(LEAST(1.0, GREATEST(-1.0,
    cos(radians(${lat1})) * cos(radians(${lat2})) * cos(radians(${lng2}) - radians(${lng1})) +
    sin(radians(${lat1})) * sin(radians(${lat2}))
  ))))`;
}

/**
 * Condição SQL para o despacho: o motorista está com o modo destino desligado,
 * ou a corrida termina mais perto do destino dele do que ele está agora.
 * Corrida sem coordenada de destino não vai para quem está com o modo ligado.
 */
export function destinoCompativelSql(latFim: unknown, lngFim: unknown, alias = "ma"): string {
  const desligado = `COALESCE(${alias}.destino_ativo, false) = false`;
  if (!coordenadaValida(latFim, lngFim)) return `(${desligado})`;
  const lat = String(Number(latFim)), lng = String(Number(lngFim));
  const fimAteDestino = distanciaKmSql(lat, lng, `${alias}.destino_lat`, `${alias}.destino_lng`);
  const agoraAteDestino = distanciaKmSql(`${alias}.lat`, `${alias}.lng`, `${alias}.destino_lat`, `${alias}.destino_lng`);
  return `(${desligado} OR (
    ${alias}.destino_lat IS NOT NULL AND ${alias}.destino_lng IS NOT NULL
    AND ${fimAteDestino} < ${agoraAteDestino}
  ))`;
}

export function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (v: number) => (v * Math.PI) / 180;
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
