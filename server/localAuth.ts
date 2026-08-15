import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { Request } from "express";
import { parse as parseCookies } from "cookie";
import { authSessions, type User, users } from "../drizzle/schema";
import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const";
import { getDb } from "./db";

const scrypt = promisify(scryptCallback);
const SESSION_DURATION_MS = ONE_YEAR_MS;

export function normalizeEmail(email: string) { return email.trim().toLocaleLowerCase("en-US"); }
export function createLocalOpenId() { return `local_${randomUUID()}`; }
export function createSessionToken() { return randomBytes(48).toString("base64url"); }
export function tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function sessionTokenHashFromRequest(req: Request) { const token = parseCookies(req.headers.cookie ?? "")[COOKIE_NAME]; return token ? tokenHash(token) : null; }

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex"); const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string | null) {
  if (!encoded) return false; const [algorithm, salt, expected] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const derived = await scrypt(password, salt, 64) as Buffer; const expectedBuffer = Buffer.from(expected, "hex");
  return expectedBuffer.length === derived.length && timingSafeEqual(expectedBuffer, derived);
}

export async function createLocalSession(userId: number) {
  const db = await getDb(); if (!db) throw new Error("Banco de dados indisponível.");
  const token = createSessionToken(); const now = new Date(); const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
  await db.insert(authSessions).values({ id: randomUUID(), userId, tokenHash: tokenHash(token), expiresAt, lastSeenAt: now });
  return { token, expiresAt };
}

export async function revokeLocalSession(req: Request) {
  const currentTokenHash = sessionTokenHashFromRequest(req); if (!currentTokenHash) return;
  const db = await getDb(); if (!db) return;
  await db.update(authSessions).set({ revokedAt: new Date() }).where(eq(authSessions.tokenHash, currentTokenHash));
}

export async function getLocalUserFromRequest(req: Request): Promise<User | null> {
  const currentTokenHash = sessionTokenHashFromRequest(req); if (!currentTokenHash) return null;
  const db = await getDb(); if (!db) return null;
  const [row] = await db.select({ sessionId: authSessions.id, user: users }).from(authSessions).innerJoin(users, eq(authSessions.userId, users.id)).where(and(eq(authSessions.tokenHash, currentTokenHash), isNull(authSessions.revokedAt), gt(authSessions.expiresAt, new Date()))).limit(1);
  if (!row) return null;
  await db.update(authSessions).set({ lastSeenAt: new Date() }).where(eq(authSessions.id, row.sessionId));
  return row.user;
}
