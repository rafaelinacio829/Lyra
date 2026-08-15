import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { auditLogs, authSessions, users } from "../drizzle/schema";
import { getDb } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { agentRouter } from "./routers/agents";
import { conversationRouter } from "./routers/conversations";
import { fileRouter } from "./routers/files";
import { integrationRouter } from "./routers/integrations";
import { billingRouter } from "./routers/billing";
import { reportRouter } from "./routers/reports";
import { contactRouter } from "./routers/contacts";
import { platformRouter } from "./routers/platform";
import { erpRouter } from "./routers/erp";
import { teamRouter } from "./routers/team";
import { tenantRouter } from "./routers/tenants";
import { operatingRulesRouter } from "./routers/operatingRules";
import { createLocalOpenId, createLocalSession, hashPassword, normalizeEmail, revokeLocalSession, sessionTokenHashFromRequest, verifyPassword } from "./localAuth";

const passwordSchema = z.string().min(12, "Use uma senha com ao menos 12 caracteres.").max(128);
function publicUser(user: NonNullable<import("./_core/context").TrpcContext["user"]>) { const { passwordHash: _passwordHash, passwordUpdatedAt: _passwordUpdatedAt, ...safe } = user; return safe; }
async function setSessionCookie(ctx: { req: any; res: any }, userId: number) { const session = await createLocalSession(userId); ctx.res.cookie(COOKIE_NAME, session.token, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS }); }
async function recordAccountAudit(userId: number, action: string, metadata: Record<string, unknown> = {}) { const db = await getDb(); if (!db) return; await db.insert(auditLogs).values({ tenantId: null, actorUserId: userId, action, entityType: "user_account", entityId: String(userId), metadata }); }

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user ? publicUser(opts.ctx.user) : null),
    register: publicProcedure.input(z.object({ name: z.string().trim().min(2).max(120), email: z.string().email(), password: passwordSchema })).mutation(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw new Error("Banco de dados indisponível."); const email = normalizeEmail(input.email);
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (existing) throw new Error("Já existe uma conta com este e-mail. Entre ou use a ativação inicial.");
      const passwordHash = await hashPassword(input.password); const now = new Date();
      const result = await db.insert(users).values({ openId: createLocalOpenId(), name: input.name.trim(), email, loginMethod: "password", passwordHash, passwordUpdatedAt: now, lastSignedIn: now });
      await setSessionCookie(ctx, Number(result[0].insertId)); return { success: true as const };
    }),
    login: publicProcedure.input(z.object({ email: z.string().email(), password: z.string().min(1) })).mutation(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw new Error("Banco de dados indisponível."); const email = normalizeEmail(input.email);
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user || !(await verifyPassword(input.password, user.passwordHash))) throw new Error("E-mail ou senha inválidos.");
      await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id)); await setSessionCookie(ctx, user.id); return { success: true as const };
    }),
    sessions: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb(); if (!db) throw new Error("Banco de dados indisponível."); const currentTokenHash = sessionTokenHashFromRequest(ctx.req);
      const rows = await db.select({ id: authSessions.id, createdAt: authSessions.createdAt, lastSeenAt: authSessions.lastSeenAt, expiresAt: authSessions.expiresAt, tokenHash: authSessions.tokenHash }).from(authSessions).where(and(eq(authSessions.userId, ctx.user.id), isNull(authSessions.revokedAt), gt(authSessions.expiresAt, new Date()))).orderBy(desc(authSessions.lastSeenAt));
      return rows.map(({ tokenHash, ...session }) => ({ ...session, isCurrent: tokenHash === currentTokenHash }));
    }),
    revokeSession: protectedProcedure.input(z.object({ sessionId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw new Error("Banco de dados indisponível.");
      const [session] = await db.select({ id: authSessions.id, tokenHash: authSessions.tokenHash }).from(authSessions).where(and(eq(authSessions.id, input.sessionId), eq(authSessions.userId, ctx.user.id), isNull(authSessions.revokedAt))).limit(1);
      if (!session) throw new Error("Sessão não encontrada."); await db.update(authSessions).set({ revokedAt: new Date() }).where(eq(authSessions.id, session.id)); await recordAccountAudit(ctx.user.id, "account.session_revoked", { sessionId: session.id });
      if (session.tokenHash === sessionTokenHashFromRequest(ctx.req)) ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true as const };
    }),
    changePassword: protectedProcedure.input(z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema })).mutation(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw new Error("Banco de dados indisponível."); const [user] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
      if (!user || !(await verifyPassword(input.currentPassword, user.passwordHash))) throw new Error("A senha atual está incorreta.");
      await db.update(users).set({ passwordHash: await hashPassword(input.newPassword), passwordUpdatedAt: new Date() }).where(eq(users.id, ctx.user.id)); await db.update(authSessions).set({ revokedAt: new Date() }).where(and(eq(authSessions.userId, ctx.user.id), isNull(authSessions.revokedAt))); await setSessionCookie(ctx, ctx.user.id); await recordAccountAudit(ctx.user.id, "account.password_changed"); return { success: true as const };
    }),
    deletionRequest: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb(); if (!db) throw new Error("Banco de dados indisponível."); const [request] = await db.select({ createdAt: auditLogs.createdAt, metadata: auditLogs.metadata }).from(auditLogs).where(and(eq(auditLogs.actorUserId, ctx.user.id), eq(auditLogs.action, "account.deletion_requested"))).orderBy(desc(auditLogs.createdAt)).limit(1); return request ?? null;
    }),
    requestDeletion: protectedProcedure.input(z.object({ password: z.string().min(1), confirmation: z.literal("EXCLUIR MINHA CONTA") })).mutation(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw new Error("Banco de dados indisponível."); const [user] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
      if (!user || !(await verifyPassword(input.password, user.passwordHash))) throw new Error("A senha está incorreta."); const [existing] = await db.select({ id: auditLogs.id }).from(auditLogs).where(and(eq(auditLogs.actorUserId, ctx.user.id), eq(auditLogs.action, "account.deletion_requested"))).orderBy(desc(auditLogs.createdAt)).limit(1);
      if (!existing) await recordAccountAudit(ctx.user.id, "account.deletion_requested", { status: "pending", requestedAt: new Date().toISOString() }); return { success: true as const, alreadyRequested: Boolean(existing) };
    }),
    bootstrapAdmin: publicProcedure.input(z.object({ email: z.string().email(), activationCode: z.string().min(8), password: passwordSchema })).mutation(async ({ ctx, input }) => {
      const configuredCode = process.env.LOCAL_AUTH_BOOTSTRAP_CODE; if (!configuredCode || input.activationCode !== configuredCode) throw new Error("Código de ativação inválido.");
      const db = await getDb(); if (!db) throw new Error("Banco de dados indisponível."); const email = normalizeEmail(input.email);
      const [user] = await db.select().from(users).where(and(eq(users.email, email), eq(users.role, "admin"))).limit(1);
      if (!user) throw new Error("Nenhum administrador existente foi encontrado com este e-mail.");
      await db.update(users).set({ passwordHash: await hashPassword(input.password), passwordUpdatedAt: new Date(), loginMethod: "password", lastSignedIn: new Date() }).where(eq(users.id, user.id)); await setSessionCookie(ctx, user.id); return { success: true as const };
    }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      await revokeLocalSession(ctx.req);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  tenant: tenantRouter,
  operatingRules: operatingRulesRouter,
  agents: agentRouter,
  conversations: conversationRouter,
  team: teamRouter,
  integrations: integrationRouter,
  files: fileRouter,
  billing: billingRouter,
  reports: reportRouter,
  contacts: contactRouter,
  platform: platformRouter,
  erp: erpRouter,
});

export type AppRouter = typeof appRouter;
