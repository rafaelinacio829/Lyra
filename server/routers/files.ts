import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { privateFiles } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { storageGetSignedUrl, storagePut } from "../storage";
import { requireTenantAccess } from "../tenantAccess";
import { assertTenantQuota } from "../planLimits";

const tenantInput = z.object({ tenantId: z.number().int().positive() });

export const fileRouter = router({
  upload: protectedProcedure
    .input(tenantInput.extend({ conversationId: z.number().int().positive().optional(), originalName: z.string().min(1).max(255), mimeType: z.string().min(3).max(160), classification: z.enum(["media", "invoice", "financial_document", "conversation_export"]), base64: z.string().min(1).max(14_000_000) }))
    .mutation(async ({ ctx, input }) => {
      const access = await requireTenantAccess(ctx.user.id, input.tenantId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const bytes = Buffer.from(input.base64, "base64");
      if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "O arquivo deve ter até 10 MB." });
      await assertTenantQuota(input.tenantId, "storage", bytes.length);
      const safeName = input.originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const { key } = await storagePut(`tenants/${input.tenantId}/${input.classification}/${randomUUID()}-${safeName}`, bytes, input.mimeType);
      const [created] = await db.insert(privateFiles).values({ tenantId: input.tenantId, conversationId: input.conversationId ?? null, storageKey: key, originalName: safeName, mimeType: input.mimeType, sizeBytes: bytes.length, classification: input.classification, uploadedByMembershipId: access.membershipId }).$returningId();
      return { id: created.id, originalName: safeName };
    }),

  list: protectedProcedure.input(tenantInput.extend({ conversationId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
    await requireTenantAccess(ctx.user.id, input.tenantId);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    const filters = [eq(privateFiles.tenantId, input.tenantId)];
    if (input.conversationId) filters.push(eq(privateFiles.conversationId, input.conversationId));
    return db.select({ id: privateFiles.id, originalName: privateFiles.originalName, mimeType: privateFiles.mimeType, sizeBytes: privateFiles.sizeBytes, classification: privateFiles.classification, createdAt: privateFiles.createdAt }).from(privateFiles).where(and(...filters));
  }),

  downloadUrl: protectedProcedure.input(tenantInput.extend({ fileId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    await requireTenantAccess(ctx.user.id, input.tenantId);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    const [file] = await db.select({ storageKey: privateFiles.storageKey }).from(privateFiles).where(and(eq(privateFiles.id, input.fileId), eq(privateFiles.tenantId, input.tenantId))).limit(1);
    if (!file) throw new TRPCError({ code: "NOT_FOUND", message: "Arquivo não encontrado nesta empresa." });
    return { url: await storageGetSignedUrl(file.storageKey) };
  }),
});
