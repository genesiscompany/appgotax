import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request } from "express";

const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function secret(): string {
  return process.env.SESSION_SECRET || process.env.JWT_SECRET || "gotaxi-pdv-session-2024";
}

function signature(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function createPdvToken(userId: number, empresaId: number): string {
  const payload = `${userId}:${empresaId}:${Date.now()}`;
  return Buffer.from(`${payload}:${signature(payload)}`).toString("base64");
}

export function verifyPdvFinancialToken(req: Request): { userId: number; empresaId: number } | null {
  const raw = req.headers.authorization?.replace("Bearer ", "");
  if (!raw) return null;
  try {
    const [userRaw, empresaRaw, issuedRaw, supplied] = Buffer.from(raw, "base64").toString("utf-8").split(":");
    const userId = Number(userRaw);
    const empresaId = Number(empresaRaw);
    const issuedAt = Number(issuedRaw);
    if (!userId || !empresaId || !issuedAt || !supplied || Date.now() - issuedAt > TOKEN_MAX_AGE_MS) return null;
    const payload = `${userId}:${empresaId}:${issuedAt}`;
    const expected = signature(payload);
    if (supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return null;
    const requestedEmpresa = Number(req.headers["x-empresa-id"] || empresaId);
    if (requestedEmpresa !== empresaId) return null;
    return { userId, empresaId };
  } catch {
    return null;
  }
}