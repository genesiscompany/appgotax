import { objectStorageClient } from "./objectStorage";
import { randomUUID } from "crypto";
import path from "path";

const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || "";

export async function uploadImageToGCS(
  buffer: Buffer,
  originalName: string,
  folder: string = "uploads"
): Promise<string> {
  if (!BUCKET_ID) {
    throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  }

  const ext = path.extname(originalName) || ".jpg";
  const filename = `${folder}/${Date.now()}_${randomUUID()}${ext}`;

  const bucket = objectStorageClient.bucket(BUCKET_ID);
  const file = bucket.file(filename);

  await file.save(buffer, {
    metadata: { contentType: getMimeType(ext) },
  });

  return `/api/images/${filename}`;
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
