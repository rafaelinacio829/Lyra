import { and, count, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { conversations, teamMembers, teams, tenantInvites, tenantMemberships, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { requireTenantAccess, requireTenantAdmin } from "../tenantAccess";
import { assertTenantQuota } from "../planLimits";

const tenantInput = z.object({ tenantId: z.number().int().positive() });

export const teamRouter = router({
  members: protectedProcedure.input(tenantInput).query(async ({ ctx, input }) => {
    await requireTenantAccess(ctx.user.id, input.tenantId);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });

    return db
      .select({
        membershipId: tenantMemberships.id,
        userId: users.id,
        name: users.name,
        email: users.email,
        role: tenantMemberships.role,
        presence: tenantMemberships.presence,
        isActive: tenantMemberships.isActive,
        joinedAt: tenantMemberships.joinedAt,
        openWorkload: count(conversations.id),
      })
      .from(tenantMemberships)
      .innerJoin(users, eq(tenantMemberships.userId, users.id))
      .leftJoin(conversations, and(eq(conversations.assignedMembershipId, tenantMemberships.id), eq(conversations.queue, "human")))
      .where(eq(tenantMemberships.tenantId, input.tenantId))
      .groupBy(tenantMemberships.id, users.id)
      .orderBy(desc(tenantMemberships.joinedAt));
  }),

  invitations: protectedProcedure.input(tenantInput).query(async ({ ctx, input }) => {
    await requireTenantAdmin(ctx.user.id, input.tenantId);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    return db
      .select({ id: tenantInvites.id, email: tenantInvites.email, role: tenantInvites.role, expiresAt: tenantInvites.expiresAt, acceptedAt: tenantInvites.acceptedAt, createdAt: tenantInvites.createdAt })
      .from(tenantInvites)
      .where(eq(tenantInvites.tenantId, input.tenantId))
      .orderBy(desc(tenantInvites.createdAt));
  }),

  createInvitation: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), email: z.string().email(), role: z.enum(["tenant_admin", "agent"]).default("agent") }))
    .mutation(async ({ ctx, input }) => {
      await requireTenantAdmin(ctx.user.id, input.tenantId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const [existingInvite] = await db.select({ id: tenantInvites.id }).from(tenantInvites).where(and(eq(tenantInvites.tenantId, input.tenantId), eq(tenantInvites.email, input.email.toLowerCase()))).limit(1);
      if (!existingInvite) await assertTenantQuota(input.tenantId, "members");

      const rawToken = randomBytes(32).toString("base64url");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db.insert(tenantInvites).values({
        tenantId: input.tenantId,
        email: input.email.toLowerCase(),
        role: input.role,
        tokenHash,
        expiresAt,
        createdByUserId: ctx.user.id,
      }).onDuplicateKeyUpdate({ set: { role: input.role, tokenHash, expiresAt, acceptedAt: null, createdByUserId: ctx.user.id } });

      return { email: input.email.toLowerCase(), expiresAt };
    }),

  updatePresence: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), presence: z.enum(["online", "busy", "away", "offline"]) }))
    .mutation(async ({ ctx, input }) => {
      const access = await requireTenantAccess(ctx.user.id, input.tenantId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      await db.update(tenantMemberships).set({ presence: input.presence }).where(eq(tenantMemberships.id, access.membershipId));
      return { success: true };
    }),

  updateMemberRole: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), membershipId: z.number().int().positive(), role: z.enum(["tenant_admin", "agent"]) }))
    .mutation(async ({ ctx, input }) => {
      await requireTenantAdmin(ctx.user.id, input.tenantId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const result = await db.update(tenantMemberships).set({ role: input.role }).where(and(eq(tenantMemberships.id, input.membershipId), eq(tenantMemberships.tenantId, input.tenantId)));
      if (!result[0].affectedRows) throw new TRPCError({ code: "NOT_FOUND", message: "Membro não encontrado nesta empresa." });
      return { success: true };
    }),

  listTeams: protectedProcedure.input(tenantInput).query(async ({ ctx, input }) => {
    await requireTenantAccess(ctx.user.id, input.tenantId);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    return db
      .select({ id: teams.id, name: teams.name, description: teams.description, leadMembershipId: teams.leadMembershipId, createdAt: teams.createdAt, memberCount: count(teamMembers.id) })
      .from(teams)
      .leftJoin(teamMembers, eq(teamMembers.teamId, teams.id))
      .where(eq(teams.tenantId, input.tenantId))
      .groupBy(teams.id)
      .orderBy(teams.name);
  }),

  createTeam: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), name: z.string().min(2).max(120), description: z.string().max(800).optional() }))
    .mutation(async ({ ctx, input }) => {
      await requireTenantAdmin(ctx.user.id, input.tenantId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const [created] = await db.insert(teams).values({ tenantId: input.tenantId, name: input.name.trim(), description: input.description?.trim() || null }).$returningId();
      return { id: created.id };
    }),

  addMemberToTeam: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), teamId: z.number().int().positive(), membershipId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireTenantAdmin(ctx.user.id, input.tenantId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const [team] = await db.select({ id: teams.id }).from(teams).where(and(eq(teams.id, input.teamId), eq(teams.tenantId, input.tenantId))).limit(1);
      const [member] = await db.select({ id: tenantMemberships.id }).from(tenantMemberships).where(and(eq(tenantMemberships.id, input.membershipId), eq(tenantMemberships.tenantId, input.tenantId))).limit(1);
      if (!team || !member) throw new TRPCError({ code: "NOT_FOUND", message: "Time ou membro não encontrado nesta empresa." });
      await db.insert(teamMembers).values({ teamId: team.id, membershipId: member.id }).onDuplicateKeyUpdate({ set: { membershipId: member.id } });
      return { success: true };
    }),
});
