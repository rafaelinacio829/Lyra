import { queueVolumeFromRows, type ConversationQueue } from "./metricsRules";

export function summarizeTenantReport(input: { total: number | string | null; resolved: number | string | null; reopened: number | string | null; avgFirstResponseSeconds: number | string | null; queueRows: Array<{ queue: ConversationQueue; value: number | string | null }> }) {
  const total = Number(input.total ?? 0);
  const resolved = Number(input.resolved ?? 0);
  const reopened = Number(input.reopened ?? 0);
  const averageSeconds = input.avgFirstResponseSeconds === null ? null : Number(input.avgFirstResponseSeconds);
  return { total, resolved, resolutionRate: total ? Math.round((resolved / total) * 100) : 0, reopenRate: resolved ? Math.round((reopened / resolved) * 100) : 0, firstResponseMinutes: averageSeconds === null || Number.isNaN(averageSeconds) ? null : Math.round(averageSeconds / 60), queueVolume: queueVolumeFromRows(input.queueRows) };
}
