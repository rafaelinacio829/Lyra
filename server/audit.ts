import { auditLogs } from "../drizzle/schema";
import { getDb } from "./db";

export async function recordTenantAudit(input: { tenantId: number; actorUserId: number | null; action: string; entityType: string; entityId?: number | string | null; metadata?: Record<string, unknown> }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values({ tenantId: input.tenantId, actorUserId: input.actorUserId, action: input.action, entityType: input.entityType, entityId: input.entityId === undefined || input.entityId === null ? null : String(input.entityId), metadata: input.metadata ?? null });
}
