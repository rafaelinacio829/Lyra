import type { ConversationQueue } from "./metricsRules";

export function transitionConversation(previousQueue: ConversationQueue, nextQueue: ConversationQueue, now: Date) {
  return {
    queue: nextQueue,
    resolvedAt: nextQueue === "resolved" ? now : null,
    reopenedAt: previousQueue === "resolved" && nextQueue !== "resolved" ? now : undefined,
  };
}
