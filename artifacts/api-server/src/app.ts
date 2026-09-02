import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import router from "./routes";
import { politicaPrivacidade, termosDeUso } from "./legal";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { serveImageFromStorage } from "./lib/uploadImage";

const app: Express = express();

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Compute script directory — works in both ESM (tsx dev) and CJS (esbuild prod bundle).
const HERE = (() => {
  try {
    // CJS bundle (production)
    if (typeof __dirname !== "undefined") return __dirname;
  } catch {}
  try {
    // ESM (dev)
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return process.cwd();
  }
})();

// Resolve a folder by trying multiple candidate locations (works in dev and prod).
function resolvePublic(rel: string): string {
  const candidates = [
    path.join(process.cwd(), rel),
    path.join(process.cwd(), "artifacts", "api-server", rel),
    path.resolve(HERE, "..", rel),
    path.resolve(HERE, rel),
  ];
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch {}
  }
  return candidates[0];
}

const UPLOADS_PATH = resolvePublic("public/uploads");
const SOUNDS_PATH = resolvePublic("public/sounds");
console.log("[static] uploads:", UPLOADS_PATH, "sounds:", SOUNDS_PATH);

app.use("/uploads", express.static(UPLOADS_PATH));
app.use("/api/uploads", express.static(UPLOADS_PATH));
app.use("/api/sounds", express.static(SOUNDS_PATH));

async function getConfigSistema(chave: string): Promise<string | null> {
  try {
    const rows = (await db.execute(sql`SELECT valor FROM configuracoes_sistema WHERE chave = ${chave}`)).rows as any[];
    return rows[0]?.valor || null;
  } catch {
    return null;
  }
}

async function serveLegalPage(chave: string, fallback: string, res: Response) {
  const custom = await getConfigSistema(chave);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(custom && custom.trim().length > 100 ? custom : fallback);
}

// Acessível em dev (sem prefixo) e em produção (com /api)
app.get("/politica-de-privacidade", async (_req, res) => serveLegalPage("politica_privacidade", politicaPrivacidade, res as Response));
app.get("/api/politica-de-privacidade", async (_req, res) => serveLegalPage("politica_privacidade", politicaPrivacidade, res as Response));

app.get("/termos-de-uso", async (_req, res) => serveLegalPage("termos_de_uso", termosDeUso, res as Response));
app.get("/api/termos-de-uso", async (_req, res) => serveLegalPage("termos_de_uso", termosDeUso, res as Response));

app.get(["/api/images/:folder/:file", "/images/:folder/:file"], async (req: Request, res: Response) => {
  const { folder, file } = req.params;
  const result = await serveImageFromStorage(`${folder}/${file}`);
  if (!result) return (res as any).status(404).send("Not found");
  res.setHeader("Content-Type", result.contentType);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  (result.stream as any).pipe(res);
});

app.use("/api", router);

export default app;
