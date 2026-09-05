import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request } from "express";

const TTL_MS = 30 * 24 * 60 * 60 * 1000;

function signingSecret() {
  const secret = process.env.SESSION_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("SESSION_SECRET or JWT_SECRET is required for customer tokens");
  return secret;
}

export function issueCustomerToken(customerId: number, now = Date.now()) {
  const payload = `cl_${customerId}:${now}:${now + TTL_MS}`;
  const signature = createHmac("sha256", signingSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}:${signature}`, "utf8").toString("base64");
}

export function verifyCustomerToken(token: string | undefined | null, now = Date.now()): number | null {
  if (!token) return null;
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const match = decoded.match(/^(cl_(\d+):(\d+):(\d+)):([a-f0-9]{64})$/);
    if (!match) return null;
    const issuedAt = Number(match[3]), expiresAt = Number(match[4]);
    if (!Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(expiresAt) || issuedAt > now + 60_000 || expiresAt <= now || expiresAt <= issuedAt) return null;
    const expected = createHmac("sha256", signingSecret()).update(match[1]).digest("hex");
    const supplied = match[5];
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) return null;
    return Number(match[2]);
  } catch {
    return null;
  }
}

export function customerIdFromRequest(req: Request) {
  const authorization = req.headers.authorization;
  return verifyCustomerToken(authorization?.startsWith("Bearer ") ? authorization.slice(7) : null);
}