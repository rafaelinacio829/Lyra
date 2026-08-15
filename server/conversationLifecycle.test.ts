import { describe, expect, it } from "vitest";
import { transitionConversation } from "./conversationLifecycle";

describe("conversation lifecycle", () => {
  it("persists reopenedAt when a resolved conversation returns to a working queue", () => {
    const now = new Date("2026-08-15T12:00:00.000Z");
    expect(transitionConversation("resolved", "ai", now)).toEqual({ queue: "ai", resolvedAt: null, reopenedAt: now });
  });

  it("marks resolution without creating a false reopening", () => {
    const now = new Date("2026-08-15T12:00:00.000Z");
    expect(transitionConversation("human", "resolved", now)).toEqual({ queue: "resolved", resolvedAt: now, reopenedAt: undefined });
  });
});
