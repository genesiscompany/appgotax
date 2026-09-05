import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request } from "express";

const TTL_MS = 30 * 24 * 60 * 60 * 1000;

function secret() {
  const value = process.env.SESSION_SECRET || process.env.JWT_SECRET;
  if (!value) throw new Error("SESSION_SECRET or JWT_SECRET is required for motorista tokens");
  return value;
}

export function issueMotoristaToken(motoristaId: number, now = Date.now()) {
  const payload = `ma_${motoristaId}_${now}_${now + TTL_MS}`;
  const signature = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}_${signature}`;
}

export function verifyMotoristaToken(token: string | undefined | null, now = Date.now()) {
  const match = token?.match(/^(ma_(\d+)_(\d+)_(\d+))_([a-f0-9]{64})$/);
  if (!match) return null;
  const issuedAt = Number(match[3]), expiresAt = Number(match[4]);
  if (!Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(expiresAt) || issuedAt > now + 60_000 || expiresAt <= now || expiresAt <= issuedAt) return null;
  const expected = createHmac("sha256", secret()).update(match[1]).digest("hex");
  const supplied = match[5];
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) return null;
  return Number(match[2]);
}

export function motoristaIdFromRequest(req: Request) {
  const raw = req.headers.authorization || (typeof req.query.token === "string" ? req.query.token : "");
  return verifyMotoristaToken(String(raw).replace(/^Bearer /, ""));
}