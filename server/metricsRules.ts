export type ConversationQueue = "ai" | "human" | "resolved";

export function shouldReopenConversation(queue: ConversationQueue) {
  return queue === "resolved";
}

export function queueVolumeFromRows(rows: Array<{ queue: ConversationQueue; value: number | string | null }>) {
  const volume = { ai: 0, human: 0, resolved: 0 };
  for (const row of rows) volume[row.queue] = Number(row.value ?? 0);
  return volume;
}
