import { describe, expect, it } from "vitest";
import { summarizeTenantReport } from "./reportMetrics";

describe("tenant report metrics", () => {
  it("calculates reopens and queue volume from a tenant aggregate", () => {
    expect(summarizeTenantReport({ total: 20, resolved: 12, reopened: 3, avgFirstResponseSeconds: 210, queueRows: [{ queue: "ai", value: 5 }, { queue: "human", value: 4 }, { queue: "resolved", value: 11 }] })).toEqual({ total: 20, resolved: 12, resolutionRate: 60, reopenRate: 25, firstResponseMinutes: 4, queueVolume: { ai: 5, human: 4, resolved: 11 } });
  });
});
