import { and, asc, desc, eq, like, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { contacts, conversationEscalations, conversations, messages, tenantMemberships, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { requireTenantAccess } from "../tenantAccess";
import { sendZapiText } from "../services/zapi";
import { assertTenantQuota } from "../planLimits";
import { transitionConversation } from "../conversationLifecycle";
import { recordTenantAudit } from "../audit";

const tenantInput = z.object({ tenantId: z.number().int().positive() });

export const conversationRouter = router({
  escalations: protectedProcedure
    .input(tenantInput)
    .query(async ({ ctx, input }) => {
      await requireTenantAccess(ctx.user.id, input.tenantId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      return db.select({ id: conversationEscalations.id, conversationId: conversationEscalations.conversationId, reason: conversationEscalations.reason, escalatedAt: conversationEscalations.escalatedAt, contactName: contacts.name, contactPhone: contacts.phone, latestMessagePreview: conversations.latestMessagePreview }).from(conversationEscalations).innerJoin(conversations, eq(conversationEscalations.conversationId, conversations.id)).leftJoin(contacts, eq(conversations.contactId, contacts.id)).where(and(eq(conversationEscalations.tenantId, input.tenantId), eq(conversationEscalations.status, "pending"))).orderBy(desc(conversationEscalations.escalatedAt)).limit(30);
    }),

  acknowledgeEscalation: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), escalationId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const access = await requireTenantAccess(ctx.user.id, input.tenantId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const [escalation] = await db.select({ id: conversationEscalations.id, conversationId: conversationEscalations.conversationId }).from(conversationEscalations).where(and(eq(conversationEscalations.id, input.escalationId), eq(conversationEscalations.tenantId, input.tenantId), eq(conversationEscalations.status, "pending"))).limit(1);
      if (!escalation) throw new TRPCError({ code: "NOT_FOUND", message: "Escalonamento não encontrado ou já assumido." });
      const now = new Date();
      await db.update(conversationEscalations).set({ status: "acknowledged", acknowledgedMembershipId: access.membershipId, acknowledgedAt: now }).where(eq(conversationEscalations.id, escalation.id));
      await db.update(conversations).set({ queue: "human", assignedMembershipId: access.membershipId, updatedAt: now }).where(and(eq(conversations.id, escalation.conversationId), eq(conversations.tenantId, input.tenantId)));
      await db.insert(messages).values({ tenantId: input.tenantId, conversationId: escalation.conversationId, authorMembershipId: access.membershipId, direction: "internal_note", channel: "internal", body: "Escalonamento assumido por um atendente." });
      await recordTenantAudit({ tenantId: input.tenantId, actorUserId: ctx.user.id, action: "conversation.escalation_acknowledged", entityType: "conversation_escalation", entityId: escalation.id, metadata: { conversationId: escalation.conversationId } });
      return { success: true as const, conversationId: escalation.conversationId };
    }),

  list: protectedProcedure
    .input(tenantInput.extend({ queue: z.enum(["ai", "human", "resolved"]).optional(), search: z.string().max(120).optional() }))
    .query(async ({ ctx, input }) => {
      await requireTenantAccess(ctx.user.id, input.tenantId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const conditions = [eq(conversations.tenantId, input.tenantId)];
      if (input.queue) conditions.push(eq(conversations.queue, input.queue));
      if (input.search?.trim()) {
        const pattern = `%${input.search.trim()}%`;
        conditions.push(or(like(contacts.name, pattern), like(contacts.phone, pattern))!);
      }
      return db
        .select({
          id: conversations.id,
          queue: conversations.queue,
          latestMessagePreview: conversations.latestMessagePreview,
          unreadCount: conversations.unreadCount,
          tags: conversations.tags,
          updatedAt: conversations.updatedAt,
          contactName: contacts.name,
          contactPhone: contacts.phone,
          assignedMembershipId: conversations.assignedMembershipId,
          assignedName: users.name,
        })
        .from(conversations)
        .leftJoin(contacts, eq(conversations.contactId, contacts.id))
        .leftJoin(tenantMemberships, eq(conversations.assignedMembershipId, tenantMemberships.id))
        .leftJoin(users, eq(tenantMemberships.userId, users.id))
        .where(and(...conditions))
        .orderBy(desc(conversations.updatedAt))
        .limit(100);
    }),

  detail: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), conversationId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireTenantAccess(ctx.user.id, input.tenantId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const [conversation] = await db
        .select({ id: conversations.id, queue: conversations.queue, tags: conversations.tags, latestMessagePreview: conversations.latestMessagePreview, contactName: contacts.name, contactPhone: contacts.phone })
        .from(conversations)
        .leftJoin(contacts, eq(conversations.contactId, contacts.id))
        .where(and(eq(conversations.id, input.conversationId), eq(conversations.tenantId, input.tenantId)))
        .limit(1);
      if (!conversation) throw new TRPCError({ code: "NOT_FOUND", message: "Conversa não encontrada." });
      const history = await db
        .select({ id: messages.id, direction: messages.direction, body: messages.body, channel: messages.channel, reactions: messages.reactions, createdAt: messages.createdAt, authorName: users.name })
        .from(messages)
        .leftJoin(tenantMemberships, eq(messages.authorMembershipId, tenantMemberships.id))
        .leftJoin(users, eq(tenantMemberships.userId, users.id))
        .where(and(eq(messages.tenantId, input.tenantId), eq(messages.conversationId, input.conversationId)))
        .orderBy(asc(messages.createdAt));
      return { conversation, messages: history };
    }),

  create: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), contactName: z.string().min(2).max(255), contactPhone: z.string().min(8).max(50), initialMessage: z.string().min(1).max(5000), queue: z.enum(["ai", "human"]).default("ai") }))
    .mutation(async ({ ctx, input }) => {
      const access = await requireTenantAccess(ctx.user.id, input.tenantId);
      await assertTenantQuota(input.tenantId, "conversations");
      await assertTenantQuota(input.tenantId, "messages");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      let [contact] = await db.select().from(contacts).where(and(eq(contacts.tenantId, input.tenantId), eq(contacts.phone, input.contactPhone))).limit(1);
      if (!contact) {
        const [createdContact] = await db.insert(contacts).values({ tenantId: input.tenantId, name: input.contactName.trim(), phone: input.contactPhone.trim() }).$returningId();
        [contact] = await db.select().from(contacts).where(eq(contacts.id, createdContact.id)).limit(1);
      }
      const [createdConversation] = await db.insert(conversations).values({ tenantId: input.tenantId, contactId: contact.id, queue: input.queue, assignedMembershipId: input.queue === "human" ? access.membershipId : null, latestMessagePreview: input.initialMessage.trim(), unreadCount: 1 }).$returningId();
      await db.insert(messages).values({ tenantId: input.tenantId, conversationId: createdConversation.id, direction: "inbound", body: input.initialMessage.trim(), channel: "whatsapp" });
      return { id: createdConversation.id };
    }),

  send: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), conversationId: z.number().int().positive(), body: z.string().min(1).max(5000) }))
    .mutation(async ({ ctx, input }) => {
      const access = await requireTenantAccess(ctx.user.id, input.tenantId);
      await assertTenantQuota(input.tenantId, "messages");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const [conversation] = await db.select({ id: conversations.id, contactId: conversations.contactId }).from(conversations).where(and(eq(conversations.id, input.conversationId), eq(conversations.tenantId, input.tenantId))).limit(1);
      if (!conversation) throw new TRPCError({ code: "NOT_FOUND", message: "Conversa não encontrada." });
      if (!conversation.contactId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A conversa não possui contato associado." });
      const [contact] = await db.select({ phone: contacts.phone }).from(contacts).where(and(eq(contacts.id, conversation.contactId), eq(contacts.tenantId, input.tenantId))).limit(1);
      if (!contact) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Ative uma integração Z-API válida para enviar mensagens pelo WhatsApp." });
      }
      let providerMessageId: string | null = null;
      try {
        providerMessageId = await sendZapiText(input.tenantId, contact.phone, input.body.trim());
      } catch {
        throw new TRPCError({ code: "BAD_GATEWAY", message: "A Z-API não confirmou o envio. Verifique a instância e tente novamente." });
      }
      await db.insert(messages).values({ tenantId: input.tenantId, conversationId: input.conversationId, authorMembershipId: access.membershipId, direction: "outbound", body: input.body.trim(), channel: "whatsapp", providerMessageId });
      await db.update(conversations).set({ latestMessagePreview: input.body.trim(), unreadCount: 0, firstResponseAt: new Date(), updatedAt: new Date() }).where(eq(conversations.id, input.conversationId));
      return { success: true };
    }),

  addNote: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), conversationId: z.number().int().positive(), body: z.string().min(1).max(5000) }))
    .mutation(async ({ ctx, input }) => {
      const access = await requireTenantAccess(ctx.user.id, input.tenantId);
      await assertTenantQuota(input.tenantId, "messages");
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const [conversation] = await db.select({ id: conversations.id }).from(conversations).where(and(eq(conversations.id, input.conversationId), eq(conversations.tenantId, input.tenantId))).limit(1);
      if (!conversation) throw new TRPCError({ code: "NOT_FOUND", message: "Conversa não encontrada." });
      await db.insert(messages).values({ tenantId: input.tenantId, conversationId: input.conversationId, authorMembershipId: access.membershipId, direction: "internal_note", body: input.body.trim(), channel: "internal" });
      return { success: true };
    }),

  transfer: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), conversationId: z.number().int().positive(), queue: z.enum(["ai", "human", "resolved"]), membershipId: z.number().int().positive().optional() }))
    .mutation(async ({ ctx, input }) => {
      const access = await requireTenantAccess(ctx.user.id, input.tenantId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const [conversation] = await db.select({ id: conversations.id, queue: conversations.queue }).from(conversations).where(and(eq(conversations.id, input.conversationId), eq(conversations.tenantId, input.tenantId))).limit(1);
      if (!conversation) throw new TRPCError({ code: "NOT_FOUND", message: "Conversa não encontrada." });
      if (input.membershipId) {
        const [target] = await db.select({ id: tenantMemberships.id }).from(tenantMemberships).where(and(eq(tenantMemberships.id, input.membershipId), eq(tenantMemberships.tenantId, input.tenantId), eq(tenantMemberships.isActive, true))).limit(1);
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Atendente não encontrado nesta empresa." });
      }
      const transition = transitionConversation(conversation.queue, input.queue, new Date());
      await db.update(conversations).set({ ...transition, assignedMembershipId: input.queue === "human" ? (input.membershipId ?? access.membershipId) : null, updatedAt: new Date() }).where(eq(conversations.id, input.conversationId));
      return { success: true };
    }),

  updateTags: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), conversationId: z.number().int().positive(), tags: z.array(z.string().min(1).max(40)).max(20) }))
    .mutation(async ({ ctx, input }) => {
      await requireTenantAccess(ctx.user.id, input.tenantId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      await db.update(conversations).set({ tags: input.tags, updatedAt: new Date() }).where(and(eq(conversations.id, input.conversationId), eq(conversations.tenantId, input.tenantId)));
      return { success: true };
    }),

  toggleReaction: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), messageId: z.number().int().positive(), reaction: z.string().min(1).max(12) }))
    .mutation(async ({ ctx, input }) => {
      await requireTenantAccess(ctx.user.id, input.tenantId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const [message] = await db.select({ id: messages.id, reactions: messages.reactions }).from(messages).where(and(eq(messages.id, input.messageId), eq(messages.tenantId, input.tenantId))).limit(1);
      if (!message) throw new TRPCError({ code: "NOT_FOUND", message: "Mensagem não encontrada nesta empresa." });
      const current = Array.isArray(message.reactions) ? message.reactions.filter((value): value is string => typeof value === "string") : [];
      const reactions = current.includes(input.reaction) ? current.filter(value => value !== input.reaction) : [...current, input.reaction];
      await db.update(messages).set({ reactions }).where(and(eq(messages.id, input.messageId), eq(messages.tenantId, input.tenantId)));
      return { reactions };
    }),
});
