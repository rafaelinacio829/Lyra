import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { operationalIncidents } from "../drizzle/schema";
import { getDb } from "./db";

type IncidentSeverity = "info" | "warning" | "critical";

function safeDetail(error: unknown) {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "Falha operacional sem detalhe disponível.";
  return raw
    .replace(/(bearer\s+)[a-z0-9._-]+/gi, "$1[REDACTED]")
    .replace(/([?&](?:token|key|secret|password|authorization)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/(access[_ -]?token|client[_ -]?token|instance[_ -]?token|app[_ -]?secret)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .slice(0, 900);
}

export async function reportOperationalIncident(input: { tenantId?: number | null; integrationConfigId?: number | null; source: string; severity: IncidentSeverity; summary: string; error?: unknown }) {
  try {
    const db = await getDb();
    if (!db) return;
    const tenantId = input.tenantId ?? null;
    const integrationConfigId = input.integrationConfigId ?? null;
    const dedupeKey = createHash("sha256").update(`${tenantId ?? "platform"}:${integrationConfigId ?? "none"}:${input.source}:${input.summary}`).digest("hex");
    const now = new Date();
    await db.insert(operationalIncidents).values({ tenantId, integrationConfigId, dedupeKey, source: input.source.slice(0, 80), severity: input.severity, summary: input.summary.slice(0, 240), detail: safeDetail(input.error), status: "open", firstSeenAt: now, lastSeenAt: now }).onDuplicateKeyUpdate({ set: { severity: input.severity, detail: safeDetail(input.error), status: "open", lastSeenAt: now, resolvedAt: null, resolvedByUserId: null, occurrences: sql`${operationalIncidents.occurrences} + 1` } });
  } catch (reportingError) {
    console.error("[OperationalIncident] failed to persist incident", reportingError);
  }
}

export { safeDetail };
