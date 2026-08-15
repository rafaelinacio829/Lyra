import { describe, expect, it } from "vitest";
import { queueVolumeFromRows, shouldReopenConversation } from "./metricsRules";

describe("conversation reporting rules", () => {
  it("reopens only a conversation that had been resolved", () => {
    expect(shouldReopenConversation("resolved")).toBe(true);
    expect(shouldReopenConversation("ai")).toBe(false);
    expect(shouldReopenConversation("human")).toBe(false);
  });

  it("normalizes the period volume for every queue even when a queue has no rows", () => {
    expect(queueVolumeFromRows([{ queue: "ai", value: "8" }, { queue: "resolved", value: 3 }])).toEqual({ ai: 8, human: 0, resolved: 3 });
  });
});
