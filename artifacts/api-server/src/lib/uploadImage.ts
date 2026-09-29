import { objectStorageClient } from "./objectStorage";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs/promises";

const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || "";
const LOCAL_UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(process.cwd(), "public", "uploads");

// Product images uploaded by the API cannot be resolved against the PDV host.
// Keep legacy /uploads/produtos URLs untouched: those may still live on PDV.
export function productImagePublicUrl(image: string | null | undefined): string | null {
  if (!image || !image.startsWith("/api/uploads/produtos/") && !image.startsWith("/api/images/produtos/")) {
    return image ?? null;
  }
  const base = (process.env.PUBLIC_API_BASE_URL || "https://api.gotaxi.com.br").replace(/\/$/, "");
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(base)) {
    throw new Error("PUBLIC_API_BASE_URL must be a valid HTTPS API origin");
  }
  return `${base}${image}`;
}

async function uploadImageLocally(
  buffer: Buffer,
  originalName: string,
  folder: string,
): Promise<string> {
  const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, "") || "uploads";
  const ext = path.extname(originalName).toLowerCase() || ".jpg";
  const filename = `${Date.now()}_${randomUUID()}${ext}`;
  const destination = path.join(LOCAL_UPLOADS_DIR, safeFolder);
  await fs.mkdir(destination, { recursive: true });
  await fs.writeFile(path.join(destination, filename), buffer);
  return `/api/uploads/${safeFolder}/${filename}`;
}

export async function uploadImageToGCS(
  buffer: Buffer,
  originalName: string,
  folder: string = "uploads"
): Promise<string> {
  if (!BUCKET_ID) {
    return uploadImageLocally(buffer, originalName, folder);
  }

  const ext = path.extname(originalName) || ".jpg";
  const filename = `${folder}/${Date.now()}_${randomUUID()}${ext}`;

  try {
    const bucket = objectStorageClient.bucket(BUCKET_ID);
    const file = bucket.file(filename);

    await file.save(buffer, {
      metadata: { contentType: getMimeType(ext) },
    });

    return `/api/images/${filename}`;
  } catch (error) {
    console.warn("[object-storage] Upload indisponível; usando armazenamento local.", error);
    return uploadImageLocally(buffer, originalName, folder);
  }
}

export async function serveImageFromStorage(
  filename: string
): Promise<{ stream: NodeJS.ReadableStream; contentType: string } | null> {
  if (!BUCKET_ID) return null;
  try {
    const bucket = objectStorageClient.bucket(BUCKET_ID);
    const file = bucket.file(filename);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [metadata] = await file.getMetadata();
    const contentType = (metadata.contentType as string) || "application/octet-stream";
    return { stream: file.createReadStream(), contentType };
  } catch {
    return null;
  }
}

function getMimeType(ext: string): string {
  const types: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".pdf": "application/pdf",
  };
  return types[ext.toLowerCase()] || "application/octet-stream";
}

export const memoryUpload = () => {
  const multer = require("multer");
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req: any, file: any, cb: any) => {
      const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
      cb(null, allowed.includes(file.mimetype));
    },
  });
};
