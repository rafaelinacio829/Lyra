import { COOKIE_NAME } from "@shared/const";
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

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
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
