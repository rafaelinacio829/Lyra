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

  saveNetSuite: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), name: z.string().min(2).max(120), accountId: z.string().min(3).max(120), restBaseUrl: z.string().url().max(500), clientId: z.string().min(8).max(500), clientSecret: z.string().min(8).max(500), refreshToken: z.string().min(8).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      await requireTenantAdmin(ctx.user.id, input.tenantId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const [existing] = await db.select({ id: integrationConfigs.id }).from(integrationConfigs).where(and(eq(integrationConfigs.tenantId, input.tenantId), eq(integrationConfigs.provider, "netsuite"), eq(integrationConfigs.name, input.name.trim()))).limit(1);
      if (!existing) await assertTenantQuota(input.tenantId, "integrations");
      const secret = { clientId: input.clientId, clientSecret: input.clientSecret, refreshToken: input.refreshToken };
      await db.insert(integrationConfigs).values({ tenantId: input.tenantId, provider: "netsuite", name: input.name.trim(), status: "draft", publicConfig: { accountId: input.accountId.trim(), restBaseUrl: input.restBaseUrl.replace(/\/+$/, "") }, secretCiphertext: encryptTenantSecret(JSON.stringify(secret)), secretFingerprint: fingerprintTenantSecret(input.clientId) }).onDuplicateKeyUpdate({ set: { status: "draft", publicConfig: { accountId: input.accountId.trim(), restBaseUrl: input.restBaseUrl.replace(/\/+$/, "") }, secretCiphertext: encryptTenantSecret(JSON.stringify(secret)), secretFingerprint: fingerprintTenantSecret(input.clientId), lastError: null } });
      await recordTenantAudit({ tenantId: input.tenantId, actorUserId: ctx.user.id, action: "integration.netsuite_configured", entityType: "integration", metadata: { name: input.name.trim(), accountId: input.accountId.trim() } });
      return { success: true };
    }),

  testNetSuite: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), integrationId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireTenantAdmin(ctx.user.id, input.tenantId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const [config] = await db.select().from(integrationConfigs).where(and(eq(integrationConfigs.id, input.integrationId), eq(integrationConfigs.tenantId, input.tenantId), eq(integrationConfigs.provider, "netsuite"))).limit(1);
      if (!config?.secretCiphertext || !config.publicConfig) throw new TRPCError({ code: "NOT_FOUND", message: "Configuração NetSuite não encontrada." });
      const publicConfig = config.publicConfig as { restBaseUrl?: string };
      const baseUrl = publicConfig.restBaseUrl?.replace(/\/+$/, "");
      if (!baseUrl) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "URL REST do NetSuite ausente." });
      let parsed: URL;
      try { parsed = new URL(baseUrl); } catch { throw new TRPCError({ code: "BAD_REQUEST", message: "URL REST do NetSuite inválida." }); }
      if (parsed.protocol !== "https:" || !parsed.hostname.endsWith("netsuite.com")) throw new TRPCError({ code: "BAD_REQUEST", message: "A URL REST deve usar HTTPS e domínio NetSuite." });
      const secrets = JSON.parse(decryptTenantSecret(config.secretCiphertext)) as { clientId: string; clientSecret: string; refreshToken: string };
      try {
        const tokenResponse = await fetch(`${baseUrl}/services/rest/auth/oauth2/v1/token`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${secrets.clientId}:${secrets.clientSecret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: secrets.refreshToken }).toString() });
        if (!tokenResponse.ok) throw new Error(`OAuth ${tokenResponse.status}`);
        const token = (await tokenResponse.json()) as { access_token?: string };
        if (!token.access_token) throw new Error("Token ausente");
        const verify = await fetch(`${baseUrl}/services/rest/record/v1/metadata-catalog`, { headers: { Authorization: `Bearer ${token.access_token}` } });
        if (!verify.ok) throw new Error(`REST ${verify.status}`);
        await db.update(integrationConfigs).set({ status: "active", lastVerifiedAt: new Date(), lastError: null }).where(eq(integrationConfigs.id, config.id));
        return { success: true };
      } catch {
        const message = "O NetSuite não aceitou a conexão. Revise a URL REST, o OAuth e as permissões da integração.";
        await db.update(integrationConfigs).set({ status: "error", lastError: message }).where(eq(integrationConfigs.id, config.id));
        throw new TRPCError({ code: "BAD_GATEWAY", message });
      }
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
