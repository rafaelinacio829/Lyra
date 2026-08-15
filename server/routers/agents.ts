import { and, count, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { agentProfiles } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { requireTenantAdmin, requireTenantAccess } from "../tenantAccess";
import { decryptTenantSecret, encryptTenantSecret, fingerprintTenantSecret } from "../tenantSecrets";
import { assertTenantQuota } from "../planLimits";

const agentInput = z.object({
  tenantId: z.number().int().positive(),
  name: z.string().min(2).max(160),
  purpose: z.string().min(8).max(280),
  mode: z.enum(["chat", "streaming", "workflow", "completion"]),
  apiBaseUrl: z.string().url().max(500).optional().or(z.literal("")),
  externalAppId: z.string().max(255).optional().or(z.literal("")),
  instructions: z.string().max(6000).optional().or(z.literal("")),
  handoffKeywords: z.array(z.string().min(1).max(80)).max(30).default([]),
});

export const agentRouter = router({
  list: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireTenantAccess(ctx.user.id, input.tenantId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });

      return db
        .select({
          id: agentProfiles.id,
          name: agentProfiles.name,
          purpose: agentProfiles.purpose,
          provider: agentProfiles.provider,
          mode: agentProfiles.mode,
          apiBaseUrl: agentProfiles.apiBaseUrl,
          externalAppId: agentProfiles.externalAppId,
          instructions: agentProfiles.instructions,
          handoffKeywords: agentProfiles.handoffKeywords,
          isActive: agentProfiles.isActive,
          isDefault: agentProfiles.isDefault,
          credentialConfigured: agentProfiles.credentialFingerprint,
          lastVerifiedAt: agentProfiles.lastVerifiedAt,
          updatedAt: agentProfiles.updatedAt,
        })
        .from(agentProfiles)
        .where(eq(agentProfiles.tenantId, input.tenantId))
        .orderBy(desc(agentProfiles.updatedAt));
    }),

  create: protectedProcedure.input(agentInput).mutation(async ({ ctx, input }) => {
    await requireTenantAdmin(ctx.user.id, input.tenantId);
    await assertTenantQuota(input.tenantId, "agents");
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });

    const [activeCount] = await db
      .select({ value: count() })
      .from(agentProfiles)
      .where(and(eq(agentProfiles.tenantId, input.tenantId), eq(agentProfiles.isActive, true)));

    const [created] = await db
      .insert(agentProfiles)
      .values({
        tenantId: input.tenantId,
        name: input.name.trim(),
        purpose: input.purpose.trim(),
        provider: "dify",
        mode: input.mode,
        apiBaseUrl: input.apiBaseUrl?.trim() || "https://api.dify.ai/v1",
        externalAppId: input.externalAppId?.trim() || null,
        instructions: input.instructions?.trim() || null,
        handoffKeywords: input.handoffKeywords,
        isActive: false,
        isDefault: activeCount?.value === 0,
      })
      .$returningId();

    return { id: created.id };
  }),

  setActive: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), agentId: z.number().int().positive(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await requireTenantAdmin(ctx.user.id, input.tenantId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });

      const [agent] = await db
        .select({ id: agentProfiles.id, credentialFingerprint: agentProfiles.credentialFingerprint, isActive: agentProfiles.isActive })
        .from(agentProfiles)
        .where(and(eq(agentProfiles.id, input.agentId), eq(agentProfiles.tenantId, input.tenantId)))
        .limit(1);
      if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: "Agente não encontrado." });
      if (input.isActive && !agent.credentialFingerprint) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Configure e valide a chave do Dify antes de ativar este agente." });
      }
      if (input.isActive && !agent.isActive) await assertTenantQuota(input.tenantId, "agents");

      await db
        .update(agentProfiles)
        .set({ isActive: input.isActive })
        .where(and(eq(agentProfiles.id, input.agentId), eq(agentProfiles.tenantId, input.tenantId)));

      return { success: true };
    }),

  configureDify: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), agentId: z.number().int().positive(), apiBaseUrl: z.string().url().max(500), apiKey: z.string().min(12).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      await requireTenantAdmin(ctx.user.id, input.tenantId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const [agent] = await db.select({ id: agentProfiles.id }).from(agentProfiles).where(and(eq(agentProfiles.id, input.agentId), eq(agentProfiles.tenantId, input.tenantId))).limit(1);
      if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: "Agente não encontrado nesta empresa." });
      await db.update(agentProfiles).set({ apiBaseUrl: input.apiBaseUrl.replace(/\/+$/, ""), credentialCiphertext: encryptTenantSecret(input.apiKey), credentialFingerprint: fingerprintTenantSecret(input.apiKey), lastVerifiedAt: null, isActive: false }).where(eq(agentProfiles.id, agent.id));
      return { success: true };
    }),

  testDify: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), agentId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireTenantAdmin(ctx.user.id, input.tenantId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const [agent] = await db.select().from(agentProfiles).where(and(eq(agentProfiles.id, input.agentId), eq(agentProfiles.tenantId, input.tenantId))).limit(1);
      if (!agent?.apiBaseUrl || !agent.credentialCiphertext) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Configure a URL e a chave Dify antes de testar." });
      try {
        const response = await fetch(`${agent.apiBaseUrl}/info`, { headers: { Authorization: `Bearer ${decryptTenantSecret(agent.credentialCiphertext)}` } });
        if (!response.ok) throw new Error(`Dify respondeu ${response.status}`);
        await db.update(agentProfiles).set({ lastVerifiedAt: new Date() }).where(eq(agentProfiles.id, agent.id));
        return { success: true };
      } catch {
        throw new TRPCError({ code: "BAD_GATEWAY", message: "O Dify não aceitou a configuração. Confirme a URL base e a chave da aplicação." });
      }
    }),
});
