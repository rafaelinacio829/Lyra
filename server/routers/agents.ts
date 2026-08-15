import { and, count, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { agentProfiles, auditLogs, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { requireTenantAdmin, requireTenantAccess } from "../tenantAccess";
import { decryptTenantSecret, encryptTenantSecret, fingerprintTenantSecret } from "../tenantSecrets";
import { assertTenantQuota } from "../planLimits";
import { recordTenantAudit } from "../audit";
import { aiProviderCatalog, aiProviderIds, type AiProviderId } from "../../shared/aiProviders";
import { assertProviderConfiguration, testConfiguredAiAgent } from "../services/aiProvider";
import { findPresetAgent, presetAgentIds, presetAgents } from "../agents/presetAgents";
import { presentAgentAudit } from "../agentGovernance";

const agentInput = z.object({
  tenantId: z.number().int().positive(),
  name: z.string().min(2).max(160),
  purpose: z.string().min(8).max(280),
  provider: z.enum(aiProviderIds),
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
          fallbackAgentId: agentProfiles.fallbackAgentId,
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

  listPresets: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireTenantAccess(ctx.user.id, input.tenantId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });

      const installedAgents = await db
        .select({ id: agentProfiles.id, name: agentProfiles.name })
        .from(agentProfiles)
        .where(eq(agentProfiles.tenantId, input.tenantId));
      const agentsByName = new Map(installedAgents.map(agent => [agent.name.trim().toLocaleLowerCase("pt-BR"), agent.id]));

      return presetAgents.map(preset => {
        const installedAgentId = agentsByName.get(preset.name.toLocaleLowerCase("pt-BR")) ?? null;
        return { ...preset, isInstalled: installedAgentId !== null, installedAgentId };
      });
    }),

  history: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), agentId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireTenantAccess(ctx.user.id, input.tenantId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const [agent] = await db.select({ id: agentProfiles.id }).from(agentProfiles).where(and(eq(agentProfiles.id, input.agentId), eq(agentProfiles.tenantId, input.tenantId))).limit(1);
      if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: "Agente não encontrado." });
      const rows = await db.select({ action: auditLogs.action, createdAt: auditLogs.createdAt, actorName: users.name }).from(auditLogs).leftJoin(users, eq(auditLogs.actorUserId, users.id)).where(and(eq(auditLogs.tenantId, input.tenantId), eq(auditLogs.entityType, "agent"), eq(auditLogs.entityId, String(input.agentId)))).orderBy(desc(auditLogs.createdAt)).limit(20);
      return rows.map(presentAgentAudit);
    }),

  installPreset: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), presetId: z.enum(presetAgentIds) }))
    .mutation(async ({ ctx, input }) => {
      await requireTenantAdmin(ctx.user.id, input.tenantId);
      const preset = findPresetAgent(input.presetId);
      if (!preset) throw new TRPCError({ code: "NOT_FOUND", message: "Modelo de agente não encontrado." });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });

      const [existing] = await db
        .select({ id: agentProfiles.id })
        .from(agentProfiles)
        .where(and(eq(agentProfiles.tenantId, input.tenantId), eq(agentProfiles.name, preset.name)))
        .limit(1);
      if (existing) return { id: existing.id, alreadyInstalled: true, nextSteps: preset.setupHint };

      await assertTenantQuota(input.tenantId, "agents");
      const [activeCount] = await db
        .select({ value: count() })
        .from(agentProfiles)
        .where(and(eq(agentProfiles.tenantId, input.tenantId), eq(agentProfiles.isActive, true)));
      const [created] = await db
        .insert(agentProfiles)
        .values({
          tenantId: input.tenantId,
          name: preset.name,
          purpose: preset.purpose,
          provider: preset.provider,
          mode: preset.mode,
          apiBaseUrl: aiProviderCatalog[preset.provider].defaultBaseUrl || null,
          externalAppId: aiProviderCatalog[preset.provider].defaultModel || null,
          instructions: preset.instructions,
          handoffKeywords: preset.handoffKeywords,
          isActive: false,
          isDefault: activeCount?.value === 0,
        })
        .$returningId();

      await recordTenantAudit({ tenantId: input.tenantId, actorUserId: ctx.user.id, action: "agent.preset_installed", entityType: "agent", entityId: created.id, metadata: { presetId: preset.id, name: preset.name } });
      return { id: created.id, alreadyInstalled: false, nextSteps: preset.setupHint };
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
        provider: input.provider,
        mode: input.mode,
        apiBaseUrl: input.apiBaseUrl?.trim() || aiProviderCatalog[input.provider].defaultBaseUrl || null,
        externalAppId: input.externalAppId?.trim() || aiProviderCatalog[input.provider].defaultModel || null,
        instructions: input.instructions?.trim() || null,
        handoffKeywords: input.handoffKeywords,
        isActive: false,
        isDefault: activeCount?.value === 0,
      })
      .$returningId();
    await recordTenantAudit({ tenantId: input.tenantId, actorUserId: ctx.user.id, action: "agent.created", entityType: "agent", entityId: created.id, metadata: { provider: input.provider, mode: input.mode } });
    return { id: created.id };
  }),

  updateProfile: protectedProcedure.input(agentInput.extend({ agentId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await requireTenantAdmin(ctx.user.id, input.tenantId);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    const [agent] = await db.select({ id: agentProfiles.id }).from(agentProfiles).where(and(eq(agentProfiles.id, input.agentId), eq(agentProfiles.tenantId, input.tenantId))).limit(1);
    if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: "Agente não encontrado." });
    await db.update(agentProfiles).set({ name: input.name.trim(), purpose: input.purpose.trim(), provider: input.provider, mode: input.mode, apiBaseUrl: input.apiBaseUrl?.trim() || aiProviderCatalog[input.provider].defaultBaseUrl || null, externalAppId: input.externalAppId?.trim() || aiProviderCatalog[input.provider].defaultModel || null, instructions: input.instructions?.trim() || null, handoffKeywords: input.handoffKeywords, isActive: false, lastVerifiedAt: null }).where(eq(agentProfiles.id, agent.id));
    await recordTenantAudit({ tenantId: input.tenantId, actorUserId: ctx.user.id, action: "agent.profile_updated", entityType: "agent", entityId: agent.id, metadata: { mode: input.mode, provider: input.provider } });
    return { success: true };
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
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Configure e valide a credencial do provedor antes de ativar este agente." });
      }
      if (input.isActive && !agent.isActive) await assertTenantQuota(input.tenantId, "agents");

      await db
        .update(agentProfiles)
        .set({ isActive: input.isActive })
        .where(and(eq(agentProfiles.id, input.agentId), eq(agentProfiles.tenantId, input.tenantId)));
      await recordTenantAudit({ tenantId: input.tenantId, actorUserId: ctx.user.id, action: "agent.activation_updated", entityType: "agent", entityId: input.agentId, metadata: { isActive: input.isActive } });
      return { success: true };
    }),

  setFallback: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), agentId: z.number().int().positive(), fallbackAgentId: z.number().int().positive().nullable() }))
    .mutation(async ({ ctx, input }) => {
      await requireTenantAdmin(ctx.user.id, input.tenantId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const [agent] = await db.select({ id: agentProfiles.id }).from(agentProfiles).where(and(eq(agentProfiles.id, input.agentId), eq(agentProfiles.tenantId, input.tenantId))).limit(1);
      if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: "Agente não encontrado." });
      if (input.fallbackAgentId) {
        if (input.fallbackAgentId === input.agentId) throw new TRPCError({ code: "BAD_REQUEST", message: "Um agente não pode ser fallback de si mesmo." });
        const [fallback] = await db.select({ id: agentProfiles.id }).from(agentProfiles).where(and(eq(agentProfiles.id, input.fallbackAgentId), eq(agentProfiles.tenantId, input.tenantId), eq(agentProfiles.isActive, true))).limit(1);
        if (!fallback) throw new TRPCError({ code: "NOT_FOUND", message: "O fallback precisa ser um agente ativo desta empresa." });
      }
      await db.update(agentProfiles).set({ fallbackAgentId: input.fallbackAgentId }).where(eq(agentProfiles.id, input.agentId));
      await recordTenantAudit({ tenantId: input.tenantId, actorUserId: ctx.user.id, action: "agent.fallback_updated", entityType: "agent", entityId: input.agentId, metadata: { fallbackAgentId: input.fallbackAgentId } });
      return { success: true };
    }),

  configureProvider: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), agentId: z.number().int().positive(), apiBaseUrl: z.string().url().max(500).optional().or(z.literal("")), apiKey: z.string().min(8).max(1000), externalAppId: z.string().max(255).optional().or(z.literal("")) }))
    .mutation(async ({ ctx, input }) => {
      await requireTenantAdmin(ctx.user.id, input.tenantId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const [agent] = await db.select({ id: agentProfiles.id, provider: agentProfiles.provider }).from(agentProfiles).where(and(eq(agentProfiles.id, input.agentId), eq(agentProfiles.tenantId, input.tenantId))).limit(1);
      if (!agent) throw new TRPCError({ code: "NOT_FOUND", message: "Agente não encontrado nesta empresa." });
      const provider = agent.provider as AiProviderId; const resolvedBaseUrl = input.apiBaseUrl?.trim() || aiProviderCatalog[provider].defaultBaseUrl;
      try { assertProviderConfiguration(provider, resolvedBaseUrl, input.externalAppId); } catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Configuração do provedor inválida." }); }
      await db.update(agentProfiles).set({ apiBaseUrl: resolvedBaseUrl.replace(/\/+$/, ""), externalAppId: input.externalAppId?.trim() || aiProviderCatalog[provider].defaultModel || null, credentialCiphertext: encryptTenantSecret(input.apiKey), credentialFingerprint: fingerprintTenantSecret(input.apiKey), lastVerifiedAt: null, isActive: false }).where(eq(agentProfiles.id, agent.id));
      await recordTenantAudit({ tenantId: input.tenantId, actorUserId: ctx.user.id, action: "agent.provider_configured", entityType: "agent", entityId: agent.id, metadata: { provider, apiBaseUrl: resolvedBaseUrl.replace(/\/+$/, "") } });
      return { success: true };
    }),

  testProvider: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), agentId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireTenantAdmin(ctx.user.id, input.tenantId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const [agent] = await db.select().from(agentProfiles).where(and(eq(agentProfiles.id, input.agentId), eq(agentProfiles.tenantId, input.tenantId))).limit(1);
      if (!agent?.credentialCiphertext) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Configure a credencial do provedor antes de testar." });
      try {
        await testConfiguredAiAgent(agent);
        await db.update(agentProfiles).set({ lastVerifiedAt: new Date() }).where(eq(agentProfiles.id, agent.id));
        await recordTenantAudit({ tenantId: input.tenantId, actorUserId: ctx.user.id, action: "agent.provider_tested", entityType: "agent", entityId: agent.id, metadata: { provider: agent.provider, success: true } });
        return { success: true };
      } catch {
        throw new TRPCError({ code: "BAD_GATEWAY", message: "O provedor não aceitou a configuração. Confirme a URL, modelo ou identificador externo e a credencial." });
      }
    }),
});
