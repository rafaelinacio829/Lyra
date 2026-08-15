import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { users } from "../drizzle/schema";
import { getDb } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
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
import { createLocalOpenId, createLocalSession, hashPassword, normalizeEmail, revokeLocalSession, verifyPassword } from "./localAuth";

const passwordSchema = z.string().min(12, "Use uma senha com ao menos 12 caracteres.").max(128);
function publicUser(user: NonNullable<import("./_core/context").TrpcContext["user"]>) { const { passwordHash: _passwordHash, passwordUpdatedAt: _passwordUpdatedAt, ...safe } = user; return safe; }
async function setSessionCookie(ctx: { req: any; res: any }, userId: number) { const session = await createLocalSession(userId); ctx.res.cookie(COOKIE_NAME, session.token, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS }); }

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
