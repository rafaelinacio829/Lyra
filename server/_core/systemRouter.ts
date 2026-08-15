import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { getDb } from "../db";
import { tenants } from "../../drizzle/schema";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative").optional(),
      })
    )
    .query(async () => {
      const db = await getDb();
      if (!db) return { ok: false, database: "unavailable" as const, checkedAt: new Date().toISOString() };
      try { await db.select({ id: tenants.id }).from(tenants).limit(1); return { ok: true, database: "available" as const, checkedAt: new Date().toISOString() }; } catch { return { ok: false, database: "unavailable" as const, checkedAt: new Date().toISOString() }; }
    }),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
