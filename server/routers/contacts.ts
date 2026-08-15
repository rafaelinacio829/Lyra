import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { contacts } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { requireTenantAccess } from "../tenantAccess";

const contactInput = z.object({ tenantId: z.number().int().positive(), name: z.string().min(2).max(255), phone: z.string().min(8).max(50), email: z.string().email().max(320).optional().or(z.literal("")), company: z.string().max(255).optional().or(z.literal("")), notes: z.string().max(4000).optional().or(z.literal("")) });

export const contactRouter = router({
  list: protectedProcedure.input(z.object({ tenantId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    await requireTenantAccess(ctx.user.id, input.tenantId);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    return db.select().from(contacts).where(eq(contacts.tenantId, input.tenantId)).orderBy(desc(contacts.updatedAt));
  }),
  create: protectedProcedure.input(contactInput).mutation(async ({ ctx, input }) => {
    await requireTenantAccess(ctx.user.id, input.tenantId);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    const [created] = await db.insert(contacts).values({ tenantId: input.tenantId, name: input.name.trim(), phone: input.phone.trim(), email: input.email?.trim() || null, company: input.company?.trim() || null, notes: input.notes?.trim() || null }).$returningId();
    return { id: created.id };
  }),
  update: protectedProcedure.input(contactInput.extend({ contactId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await requireTenantAccess(ctx.user.id, input.tenantId);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    const [contact] = await db.select({ id: contacts.id }).from(contacts).where(and(eq(contacts.id, input.contactId), eq(contacts.tenantId, input.tenantId))).limit(1);
    if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Contato não encontrado nesta empresa." });
    await db.update(contacts).set({ name: input.name.trim(), phone: input.phone.trim(), email: input.email?.trim() || null, company: input.company?.trim() || null, notes: input.notes?.trim() || null }).where(eq(contacts.id, contact.id));
    return { success: true };
  }),
  delete: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), contactId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await requireTenantAccess(ctx.user.id, input.tenantId);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    const result = await db.delete(contacts).where(and(eq(contacts.id, input.contactId), eq(contacts.tenantId, input.tenantId)));
    if (!result[0].affectedRows) throw new TRPCError({ code: "NOT_FOUND", message: "Contato não encontrado nesta empresa." });
    return { success: true };
  }),
});
