import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { conversations, integrationConfigs, tenantOperatingRules } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { decryptTenantSecret, encryptTenantSecret, fingerprintTenantSecret } from "../tenantSecrets";
import { requireTenantAccess, requireTenantAdmin } from "../tenantAccess";
import { assertTenantQuota } from "../planLimits";
import { recordTenantAudit } from "../audit";
import { assertCustomErpBaseUrl, verifyCustomErpConnection } from "../services/customErp";
import { reportOperationalIncident } from "../operationalIncidents";

const tenantInput = z.object({ tenantId: z.number().int().positive() });
const whatsappChannelPurpose = z.enum(["general", "sales", "support", "billing", "operations", "marketing", "other"]);

function requestOrigin(req: { protocol: string; get: (name: string) => string | undefined; header: (name: string) => string | undefined }) {
  const forwarded = req.header("x-forwarded-proto");
  const protocol = forwarded?.split(",")[0] || req.protocol || "https";
  const host = req.get("host");
  if (!host) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível construir o endereço de webhook." });
  return `${protocol}://${host}`;
}

export const integrationRouter = router({
  whatsappChannels: protectedProcedure.input(tenantInput).query(async ({ ctx, input }) => {
    await requireTenantAccess(ctx.user.id, input.tenantId);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    const [rules] = await db.select({ defaultWhatsAppIntegrationId: tenantOperatingRules.defaultWhatsAppIntegrationId }).from(tenantOperatingRules).where(eq(tenantOperatingRules.tenantId, input.tenantId)).limit(1);
    const channels = await db.execute<{ id: number; provider: "zapi" | "meta"; name: string; channelIdentifier: string | null; channelPurpose: string; status: "draft" | "active" | "error"; lastVerifiedAt: Date | null; lastError: string | null; totalConversations: number; pendingConversations: number; avgFirstResponseMinutes: number | null; lastActivityAt: Date | null }>(
      `SELECT i.id, i.provider, i.name, i.channel_identifier AS channelIdentifier, i.channel_purpose AS channelPurpose, i.status, i.last_verified_at AS lastVerifiedAt, i.last_error AS lastError,
        COUNT(c.id) AS totalConversations,
        COALESCE(SUM(CASE WHEN c.queue <> 'resolved' THEN 1 ELSE 0 END), 0) AS pendingConversations,
        ROUND(AVG(CASE WHEN c.first_response_at IS NOT NULL THEN TIMESTAMPDIFF(MINUTE, c.created_at, c.first_response_at) END), 1) AS avgFirstResponseMinutes,
        MAX(c.updated_at) AS lastActivityAt
      FROM integration_configs i
      LEFT JOIN conversations c ON c.integration_config_id = i.id AND c.tenant_id = i.tenant_id
      WHERE i.tenant_id = ${input.tenantId} AND i.provider IN ('zapi', 'meta')
      GROUP BY i.id, i.provider, i.name, i.status, i.last_verified_at, i.last_error
      ORDER BY CASE WHEN i.status = 'error' THEN 0 WHEN i.status = 'active' THEN 1 ELSE 2 END, i.updated_at DESC`
    );
    const rows = (Array.isArray(channels) ? channels : (channels as unknown as [Array<unknown>])[0] || []) as Array<{ id: number; provider: "zapi" | "meta"; name: string; channelIdentifier: string | null; channelPurpose: string; status: "draft" | "active" | "error"; lastVerifiedAt: Date | null; lastError: string | null; totalConversations: number; pendingConversations: number; avgFirstResponseMinutes: number | null; lastActivityAt: Date | null }>;
    return { defaultIntegrationId: rules?.defaultWhatsAppIntegrationId ?? null, channels: rows.map(row => ({ id: Number(row.id), provider: row.provider, name: row.name, channelIdentifier: row.channelIdentifier, channelPurpose: row.channelPurpose || "general", status: row.status, lastVerifiedAt: row.lastVerifiedAt, lastError: row.lastError, lastActivityAt: row.lastActivityAt, totalConversations: Number(row.totalConversations || 0), pendingConversations: Number(row.pendingConversations || 0), avgFirstResponseMinutes: row.avgFirstResponseMinutes == null ? null : Number(row.avgFirstResponseMinutes), isDefault: Number(row.id) === rules?.defaultWhatsAppIntegrationId })) };
  }),

  setDefaultWhatsAppChannel: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), integrationId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireTenantAdmin(ctx.user.id, input.tenantId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const [channel] = await db.select({ id: integrationConfigs.id, name: integrationConfigs.name, provider: integrationConfigs.provider }).from(integrationConfigs).where(and(eq(integrationConfigs.id, input.integrationId), eq(integrationConfigs.tenantId, input.tenantId), eq(integrationConfigs.status, "active"))).limit(1);
      if (!channel || (channel.provider !== "zapi" && channel.provider !== "meta")) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Selecione uma conexão WhatsApp ativa desta empresa." });
      await db.insert(tenantOperatingRules).values({ tenantId: input.tenantId, defaultWhatsAppIntegrationId: channel.id }).onDuplicateKeyUpdate({ set: { defaultWhatsAppIntegrationId: channel.id } });
      await recordTenantAudit({ tenantId: input.tenantId, actorUserId: ctx.user.id, action: "integration.whatsapp_default_changed", entityType: "integration", entityId: channel.id, metadata: { name: channel.name, provider: channel.provider } });
      return { success: true as const, integrationId: channel.id };
    }),

  updateWhatsAppChannelDetails: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), integrationId: z.number().int().positive(), channelIdentifier: z.string().trim().min(3).max(120), channelPurpose: whatsappChannelPurpose }))
    .mutation(async ({ ctx, input }) => {
      await requireTenantAdmin(ctx.user.id, input.tenantId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const [channel] = await db.select({ id: integrationConfigs.id, provider: integrationConfigs.provider, name: integrationConfigs.name }).from(integrationConfigs).where(and(eq(integrationConfigs.id, input.integrationId), eq(integrationConfigs.tenantId, input.tenantId))).limit(1);
      if (!channel || (channel.provider !== "zapi" && channel.provider !== "meta")) throw new TRPCError({ code: "NOT_FOUND", message: "Canal WhatsApp não encontrado nesta empresa." });
      await db.update(integrationConfigs).set({ channelIdentifier: input.channelIdentifier, channelPurpose: input.channelPurpose }).where(eq(integrationConfigs.id, channel.id));
      await recordTenantAudit({ tenantId: input.tenantId, actorUserId: ctx.user.id, action: "integration.whatsapp_details_updated", entityType: "integration", entityId: channel.id, metadata: { name: channel.name, channelIdentifier: input.channelIdentifier, channelPurpose: input.channelPurpose } });
      return { success: true as const };
    }),

  list: protectedProcedure.input(tenantInput).query(async ({ ctx, input }) => {
    await requireTenantAccess(ctx.user.id, input.tenantId);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    return db
      .select({ id: integrationConfigs.id, provider: integrationConfigs.provider, name: integrationConfigs.name, channelIdentifier: integrationConfigs.channelIdentifier, channelPurpose: integrationConfigs.channelPurpose, status: integrationConfigs.status, publicConfig: integrationConfigs.publicConfig, secretConfigured: integrationConfigs.secretFingerprint, lastVerifiedAt: integrationConfigs.lastVerifiedAt, lastError: integrationConfigs.lastError, updatedAt: integrationConfigs.updatedAt })
      .from(integrationConfigs)
      .where(eq(integrationConfigs.tenantId, input.tenantId))
      .orderBy(desc(integrationConfigs.updatedAt));
  }),

  saveZapi: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), name: z.string().min(2).max(120), instanceId: z.string().min(3).max(120), channelIdentifier: z.string().trim().min(3).max(120).optional(), channelPurpose: whatsappChannelPurpose.default("general"), instanceToken: z.string().min(8).max(500), clientToken: z.string().min(8).max(500) }))
    .mutation(async ({ ctx, input }) => {
      await requireTenantAdmin(ctx.user.id, input.tenantId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const [existing] = await db.select({ id: integrationConfigs.id }).from(integrationConfigs).where(and(eq(integrationConfigs.tenantId, input.tenantId), eq(integrationConfigs.provider, "zapi"), eq(integrationConfigs.name, input.name.trim()))).limit(1);
      if (!existing) await assertTenantQuota(input.tenantId, "integrations");
      const webhookKey = randomBytes(24).toString("base64url");
      const secret = { instanceToken: input.instanceToken, clientToken: input.clientToken, webhookKey };
      await db.insert(integrationConfigs).values({
        tenantId: input.tenantId,
        provider: "zapi",
        name: input.name.trim(),
        channelIdentifier: input.channelIdentifier?.trim() || input.instanceId.trim(),
        channelPurpose: input.channelPurpose,
        status: "draft",
        publicConfig: { instanceId: input.instanceId.trim() },
        secretCiphertext: encryptTenantSecret(JSON.stringify(secret)),
        secretFingerprint: fingerprintTenantSecret(input.instanceToken),
        webhookSecretCiphertext: encryptTenantSecret(webhookKey),
      }).onDuplicateKeyUpdate({
        set: { status: "draft", channelIdentifier: input.channelIdentifier?.trim() || input.instanceId.trim(), channelPurpose: input.channelPurpose, publicConfig: { instanceId: input.instanceId.trim() }, secretCiphertext: encryptTenantSecret(JSON.stringify(secret)), secretFingerprint: fingerprintTenantSecret(input.instanceToken), webhookSecretCiphertext: encryptTenantSecret(webhookKey), lastError: null },
      });
      const [config] = await db.select({ id: integrationConfigs.id }).from(integrationConfigs).where(and(eq(integrationConfigs.tenantId, input.tenantId), eq(integrationConfigs.provider, "zapi"), eq(integrationConfigs.name, input.name.trim()))).limit(1);
      if (!config) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Configuração Z-API não foi criada." });
      await recordTenantAudit({ tenantId: input.tenantId, actorUserId: ctx.user.id, action: "integration.zapi_configured", entityType: "integration", entityId: config.id, metadata: { name: input.name.trim(), instanceId: input.instanceId.trim() } });
      return { id: config.id, webhookUrl: `${requestOrigin(ctx.req)}/api/webhooks/zapi/${config.id}/${webhookKey}` };
    }),

  activateZapiWebhook: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), integrationId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireTenantAdmin(ctx.user.id, input.tenantId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const [config] = await db.select().from(integrationConfigs).where(and(eq(integrationConfigs.id, input.integrationId), eq(integrationConfigs.tenantId, input.tenantId), eq(integrationConfigs.provider, "zapi"))).limit(1);
      if (!config?.secretCiphertext || !config.publicConfig) throw new TRPCError({ code: "NOT_FOUND", message: "Configuração Z-API não encontrada." });
      const secrets = JSON.parse(decryptTenantSecret(config.secretCiphertext)) as { instanceToken: string; clientToken: string; webhookKey: string };
      const publicConfig = config.publicConfig as { instanceId?: string };
      if (!publicConfig.instanceId) throw new TRPCError({ code: "BAD_REQUEST", message: "Identificador da instância Z-API ausente." });
      const webhookUrl = `${requestOrigin(ctx.req)}/api/webhooks/zapi/${config.id}/${secrets.webhookKey}`;
      try {
        const response = await fetch(`https://api.z-api.io/instances/${encodeURIComponent(publicConfig.instanceId)}/token/${encodeURIComponent(secrets.instanceToken)}/update-every-webhooks`, {
          method: "PUT",
          headers: { "Client-Token": secrets.clientToken, "Content-Type": "application/json" },
          body: JSON.stringify({ value: webhookUrl, notifySentByMe: true }),
        });
        if (!response.ok) throw new Error(`Z-API respondeu ${response.status}`);
        await db.update(integrationConfigs).set({ status: "active", lastVerifiedAt: new Date(), lastError: null }).where(eq(integrationConfigs.id, config.id));
        return { webhookUrl, status: "active" as const };
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 500) : "Falha ao configurar webhook Z-API.";
        await db.update(integrationConfigs).set({ status: "error", lastError: message }).where(eq(integrationConfigs.id, config.id));
        await reportOperationalIncident({ tenantId: input.tenantId, integrationConfigId: config.id, source: "zapi.webhook_activation", severity: "critical", summary: "Falha ao ativar webhook Z-API", error });
        throw new TRPCError({ code: "BAD_GATEWAY", message: "Não foi possível ativar o webhook Z-API. Revise a instância e as credenciais." });
      }
    }),

  saveMeta: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), name: z.string().trim().min(2).max(120), phoneNumberId: z.string().trim().min(4).max(120), channelIdentifier: z.string().trim().min(3).max(120).optional(), channelPurpose: whatsappChannelPurpose.default("general"), accessToken: z.string().min(20).max(2000), appSecret: z.string().min(16).max(500), graphApiVersion: z.string().regex(/^v\d+\.\d+$/).default("v23.0") }))
    .mutation(async ({ ctx, input }) => {
      await requireTenantAdmin(ctx.user.id, input.tenantId);
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const [existing] = await db.select({ id: integrationConfigs.id }).from(integrationConfigs).where(and(eq(integrationConfigs.tenantId, input.tenantId), eq(integrationConfigs.provider, "meta"), eq(integrationConfigs.name, input.name))).limit(1);
      if (!existing) await assertTenantQuota(input.tenantId, "integrations");
      const verifyToken = randomBytes(24).toString("base64url");
      const secret = { accessToken: input.accessToken, appSecret: input.appSecret, verifyToken };
      const publicConfig = { phoneNumberId: input.phoneNumberId, graphApiVersion: input.graphApiVersion };
      await db.insert(integrationConfigs).values({ tenantId: input.tenantId, provider: "meta", name: input.name, channelIdentifier: input.channelIdentifier?.trim() || input.phoneNumberId, channelPurpose: input.channelPurpose, status: "draft", publicConfig, secretCiphertext: encryptTenantSecret(JSON.stringify(secret)), secretFingerprint: fingerprintTenantSecret(input.accessToken), webhookSecretCiphertext: encryptTenantSecret(verifyToken) }).onDuplicateKeyUpdate({ set: { status: "draft", channelIdentifier: input.channelIdentifier?.trim() || input.phoneNumberId, channelPurpose: input.channelPurpose, publicConfig, secretCiphertext: encryptTenantSecret(JSON.stringify(secret)), secretFingerprint: fingerprintTenantSecret(input.accessToken), webhookSecretCiphertext: encryptTenantSecret(verifyToken), lastError: null } });
      const [config] = await db.select({ id: integrationConfigs.id }).from(integrationConfigs).where(and(eq(integrationConfigs.tenantId, input.tenantId), eq(integrationConfigs.provider, "meta"), eq(integrationConfigs.name, input.name))).limit(1);
      if (!config) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Configuração Meta não foi criada." });
      await recordTenantAudit({ tenantId: input.tenantId, actorUserId: ctx.user.id, action: "integration.meta_configured", entityType: "integration", entityId: config.id, metadata: { name: input.name, phoneNumberId: input.phoneNumberId } });
      return { id: config.id, webhookUrl: `${requestOrigin(ctx.req)}/api/webhooks/meta/${config.id}`, verifyToken };
    }),

  testMeta: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), integrationId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireTenantAdmin(ctx.user.id, input.tenantId);
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const [config] = await db.select().from(integrationConfigs).where(and(eq(integrationConfigs.id, input.integrationId), eq(integrationConfigs.tenantId, input.tenantId), eq(integrationConfigs.provider, "meta"))).limit(1);
      if (!config?.secretCiphertext || !config.publicConfig) throw new TRPCError({ code: "NOT_FOUND", message: "Configuração da WhatsApp Cloud API não encontrada." });
      const publicConfig = config.publicConfig as { phoneNumberId?: string; graphApiVersion?: string }; const secrets = JSON.parse(decryptTenantSecret(config.secretCiphertext)) as { accessToken?: string };
      if (!publicConfig.phoneNumberId || !secrets.accessToken) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A integração Meta não possui identificador ou token configurado." });
      try { const response = await fetch(`https://graph.facebook.com/${publicConfig.graphApiVersion || "v23.0"}/${encodeURIComponent(publicConfig.phoneNumberId)}`, { headers: { Authorization: `Bearer ${secrets.accessToken}` }, signal: AbortSignal.timeout(10_000) }); if (!response.ok) throw new Error(`Meta respondeu ${response.status}`); await db.update(integrationConfigs).set({ status: "active", lastVerifiedAt: new Date(), lastError: null }).where(eq(integrationConfigs.id, config.id)); return { success: true }; }
      catch (error) { const message = "A Meta não aceitou a conexão. Revise o Phone Number ID, o token de sistema, permissões e versão da Graph API."; await db.update(integrationConfigs).set({ status: "error", lastError: message }).where(eq(integrationConfigs.id, config.id)); await reportOperationalIncident({ tenantId: input.tenantId, integrationConfigId: config.id, source: "meta.connection_test", severity: "critical", summary: "Falha na validação da WhatsApp Cloud API", error }); throw new TRPCError({ code: "BAD_GATEWAY", message }); }
    }),

  saveCustomErp: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), name: z.string().trim().min(2).max(120), baseUrl: z.string().url().max(500), healthPath: z.string().trim().min(1).max(240).default("/health"), lookupPath: z.string().trim().min(2).max(320), apiKey: z.string().min(8).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      await requireTenantAdmin(ctx.user.id, input.tenantId);
      let baseUrl: string;
      try { baseUrl = assertCustomErpBaseUrl(input.baseUrl).toString().replace(/\/$/, ""); } catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "URL do ERP inválida." }); }
      if (!input.healthPath.startsWith("/") || !input.lookupPath.startsWith("/")) throw new TRPCError({ code: "BAD_REQUEST", message: "Os caminhos de verificação e consulta devem iniciar com '/'." });
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const [existing] = await db.select({ id: integrationConfigs.id }).from(integrationConfigs).where(and(eq(integrationConfigs.tenantId, input.tenantId), eq(integrationConfigs.provider, "erp_custom"), eq(integrationConfigs.name, input.name))).limit(1);
      if (!existing) await assertTenantQuota(input.tenantId, "integrations");
      const publicConfig = { baseUrl, healthPath: input.healthPath, lookupPath: input.lookupPath };
      await db.insert(integrationConfigs).values({ tenantId: input.tenantId, provider: "erp_custom", name: input.name, status: "draft", publicConfig, secretCiphertext: encryptTenantSecret(JSON.stringify({ apiKey: input.apiKey })), secretFingerprint: fingerprintTenantSecret(input.apiKey) }).onDuplicateKeyUpdate({ set: { status: "draft", publicConfig, secretCiphertext: encryptTenantSecret(JSON.stringify({ apiKey: input.apiKey })), secretFingerprint: fingerprintTenantSecret(input.apiKey), lastError: null } });
      const [config] = await db.select({ id: integrationConfigs.id }).from(integrationConfigs).where(and(eq(integrationConfigs.tenantId, input.tenantId), eq(integrationConfigs.provider, "erp_custom"), eq(integrationConfigs.name, input.name))).limit(1);
      await recordTenantAudit({ tenantId: input.tenantId, actorUserId: ctx.user.id, action: "integration.custom_erp_configured", entityType: "integration", entityId: config?.id, metadata: { name: input.name, baseUrl, lookupPath: input.lookupPath } });
      return { id: config?.id, success: true };
    }),

  testCustomErp: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), integrationId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireTenantAdmin(ctx.user.id, input.tenantId);
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const [config] = await db.select({ id: integrationConfigs.id }).from(integrationConfigs).where(and(eq(integrationConfigs.id, input.integrationId), eq(integrationConfigs.tenantId, input.tenantId), eq(integrationConfigs.provider, "erp_custom"))).limit(1);
      if (!config) throw new TRPCError({ code: "NOT_FOUND", message: "Integração de ERP personalizada não encontrada." });
      try { await verifyCustomErpConnection(input.tenantId, config.id); await db.update(integrationConfigs).set({ status: "active", lastVerifiedAt: new Date(), lastError: null }).where(eq(integrationConfigs.id, config.id)); return { success: true }; }
      catch (error) { const message = error instanceof Error ? error.message.slice(0, 500) : "O ERP não aceitou a conexão."; await db.update(integrationConfigs).set({ status: "error", lastError: message }).where(eq(integrationConfigs.id, config.id)); await reportOperationalIncident({ tenantId: input.tenantId, integrationConfigId: config.id, source: "erp.connection_test", severity: "critical", summary: "Falha na validação do ERP personalizado", error }); throw new TRPCError({ code: "BAD_GATEWAY", message }); }
    }),
});

export async function validateZapiWebhook(integrationId: number, webhookKey: string) {
  const db = await getDb();
  if (!db) return null;
  const [config] = await db.select().from(integrationConfigs).where(and(eq(integrationConfigs.id, integrationId), eq(integrationConfigs.provider, "zapi"), eq(integrationConfigs.status, "active"))).limit(1);
  if (!config?.webhookSecretCiphertext) return null;
  const expected = decryptTenantSecret(config.webhookSecretCiphertext);
  const expectedBuffer = Buffer.from(expected);
  const givenBuffer = Buffer.from(webhookKey);
  if (expectedBuffer.length !== givenBuffer.length || !timingSafeEqual(expectedBuffer, givenBuffer)) return null;
  return config;
}

export async function getMetaWebhookConfig(integrationId: number, includeDraft = false) {
  const db = await getDb();
  if (!db) return null;
  const [config] = await db.select().from(integrationConfigs).where(and(eq(integrationConfigs.id, integrationId), eq(integrationConfigs.provider, "meta"), ...(includeDraft ? [] : [eq(integrationConfigs.status, "active")]))).limit(1);
  return config ?? null;
}
