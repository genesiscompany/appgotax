import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

let ready = false;
export async function ensureTreinamentoVideosTable() {
  if (ready) return;
  await db.execute(sql`CREATE TABLE IF NOT EXISTS treinamento_videos (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    descricao TEXT,
    youtube_id VARCHAR(20) NOT NULL,
    categoria VARCHAR(100) NOT NULL DEFAULT 'Geral',
    ordem INTEGER NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT true,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW()
  )`);
  ready = true;
}

export function youtubeIdFromUrl(input: unknown): string | null {
  const value = String(input ?? "").trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  const host = url.hostname.replace(/^(www\.|m\.)/, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.split("/")[1] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = url.searchParams.get("v");
    if (!id) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live", "v"].includes(parts[0] ?? "")) id = parts[1] ?? null;
    }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}
