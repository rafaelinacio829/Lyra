import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { integrationConfigs } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { decryptTenantSecret, encryptTenantSecret, fingerprintTenantSecret } from "../tenantSecrets";
import { requireTenantAccess, requireTenantAdmin } from "../tenantAccess";
import { assertTenantQuota } from "../planLimits";
import { recordTenantAudit } from "../audit";
import { assertCustomErpBaseUrl, verifyCustomErpConnection } from "../services/customErp";

const tenantInput = z.object({ tenantId: z.number().int().positive() });

function requestOrigin(req: { protocol: string; get: (name: string) => string | undefined; header: (name: string) => string | undefined }) {
  const forwarded = req.header("x-forwarded-proto");
  const protocol = forwarded?.split(",")[0] || req.protocol || "https";
  const host = req.get("host");
  if (!host) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível construir o endereço de webhook." });
  return `${protocol}://${host}`;
}

export const integrationRouter = router({
  list: protectedProcedure.input(tenantInput).query(async ({ ctx, input }) => {
    await requireTenantAccess(ctx.user.id, input.tenantId);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    return db
      .select({ id: integrationConfigs.id, provider: integrationConfigs.provider, name: integrationConfigs.name, status: integrationConfigs.status, publicConfig: integrationConfigs.publicConfig, secretConfigured: integrationConfigs.secretFingerprint, lastVerifiedAt: integrationConfigs.lastVerifiedAt, lastError: integrationConfigs.lastError, updatedAt: integrationConfigs.updatedAt })
      .from(integrationConfigs)
      .where(eq(integrationConfigs.tenantId, input.tenantId))
      .orderBy(desc(integrationConfigs.updatedAt));
  }),

  saveZapi: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), name: z.string().min(2).max(120), instanceId: z.string().min(3).max(120), instanceToken: z.string().min(8).max(500), clientToken: z.string().min(8).max(500) }))
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
        status: "draft",
        publicConfig: { instanceId: input.instanceId.trim() },
        secretCiphertext: encryptTenantSecret(JSON.stringify(secret)),
        secretFingerprint: fingerprintTenantSecret(input.instanceToken),
        webhookSecretCiphertext: encryptTenantSecret(webhookKey),
      }).onDuplicateKeyUpdate({
        set: { status: "draft", publicConfig: { instanceId: input.instanceId.trim() }, secretCiphertext: encryptTenantSecret(JSON.stringify(secret)), secretFingerprint: fingerprintTenantSecret(input.instanceToken), webhookSecretCiphertext: encryptTenantSecret(webhookKey), lastError: null },
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
        throw new TRPCError({ code: "BAD_GATEWAY", message: "Não foi possível ativar o webhook Z-API. Revise a instância e as credenciais." });
      }
    }),

  saveMeta: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), name: z.string().trim().min(2).max(120), phoneNumberId: z.string().trim().min(4).max(120), accessToken: z.string().min(20).max(2000), appSecret: z.string().min(16).max(500), graphApiVersion: z.string().regex(/^v\d+\.\d+$/).default("v23.0") }))
    .mutation(async ({ ctx, input }) => {
      await requireTenantAdmin(ctx.user.id, input.tenantId);
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const [existing] = await db.select({ id: integrationConfigs.id }).from(integrationConfigs).where(and(eq(integrationConfigs.tenantId, input.tenantId), eq(integrationConfigs.provider, "meta"), eq(integrationConfigs.name, input.name))).limit(1);
      if (!existing) await assertTenantQuota(input.tenantId, "integrations");
      const verifyToken = randomBytes(24).toString("base64url");
      const secret = { accessToken: input.accessToken, appSecret: input.appSecret, verifyToken };
      const publicConfig = { phoneNumberId: input.phoneNumberId, graphApiVersion: input.graphApiVersion };
      await db.insert(integrationConfigs).values({ tenantId: input.tenantId, provider: "meta", name: input.name, status: "draft", publicConfig, secretCiphertext: encryptTenantSecret(JSON.stringify(secret)), secretFingerprint: fingerprintTenantSecret(input.accessToken), webhookSecretCiphertext: encryptTenantSecret(verifyToken) }).onDuplicateKeyUpdate({ set: { status: "draft", publicConfig, secretCiphertext: encryptTenantSecret(JSON.stringify(secret)), secretFingerprint: fingerprintTenantSecret(input.accessToken), webhookSecretCiphertext: encryptTenantSecret(verifyToken), lastError: null } });
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
      catch { const message = "A Meta não aceitou a conexão. Revise o Phone Number ID, o token de sistema, permissões e versão da Graph API."; await db.update(integrationConfigs).set({ status: "error", lastError: message }).where(eq(integrationConfigs.id, config.id)); throw new TRPCError({ code: "BAD_GATEWAY", message }); }
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
      catch (error) { const message = error instanceof Error ? error.message.slice(0, 500) : "O ERP não aceitou a conexão."; await db.update(integrationConfigs).set({ status: "error", lastError: message }).where(eq(integrationConfigs.id, config.id)); throw new TRPCError({ code: "BAD_GATEWAY", message }); }
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
