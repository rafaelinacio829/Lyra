import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { tenantOperatingRules } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { requireTenantAccess, requireTenantAdmin } from "../tenantAccess";
import { recordTenantAudit } from "../audit";
import { defaultBusinessHours, describeOperatingRule, normalizeBusinessHours } from "../operatingRules";

const businessHourSchema = z.object({ day: z.number().int().min(0).max(6), start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) });
const defaultRule = { isEnabled: true, timezone: "America/Sao_Paulo", businessHours: defaultBusinessHours, firstResponseSlaMinutes: 20, inboundRouting: "ai_first" as const, handoffOutsideBusinessHours: false, autoEscalateUnassigned: true };

export const operatingRulesRouter = router({
  get: protectedProcedure.input(z.object({ tenantId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    await requireTenantAccess(ctx.user.id, input.tenantId); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    const [row] = await db.select().from(tenantOperatingRules).where(eq(tenantOperatingRules.tenantId, input.tenantId)).limit(1);
    const rule = row ? { isEnabled: row.isEnabled, timezone: row.timezone, businessHours: normalizeBusinessHours(row.businessHours), firstResponseSlaMinutes: row.firstResponseSlaMinutes, inboundRouting: row.inboundRouting as "ai_first" | "human_first", handoffOutsideBusinessHours: row.handoffOutsideBusinessHours, autoEscalateUnassigned: row.autoEscalateUnassigned } : defaultRule;
    return { ...rule, summary: describeOperatingRule(rule), isDefault: !row };
  }),
  update: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), isEnabled: z.boolean(), timezone: z.string().min(3).max(80), businessHours: z.array(businessHourSchema).min(1).max(7), firstResponseSlaMinutes: z.number().int().min(5).max(240), inboundRouting: z.enum(["ai_first", "human_first"]), handoffOutsideBusinessHours: z.boolean(), autoEscalateUnassigned: z.boolean() })).mutation(async ({ ctx, input }) => {
    await requireTenantAdmin(ctx.user.id, input.tenantId); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    const values = { tenantId: input.tenantId, isEnabled: input.isEnabled, timezone: input.timezone.trim(), businessHours: input.businessHours, firstResponseSlaMinutes: input.firstResponseSlaMinutes, inboundRouting: input.inboundRouting, handoffOutsideBusinessHours: input.handoffOutsideBusinessHours, autoEscalateUnassigned: input.autoEscalateUnassigned };
    await db.insert(tenantOperatingRules).values(values).onDuplicateKeyUpdate({ set: { isEnabled: values.isEnabled, timezone: values.timezone, businessHours: values.businessHours, firstResponseSlaMinutes: values.firstResponseSlaMinutes, inboundRouting: values.inboundRouting, handoffOutsideBusinessHours: values.handoffOutsideBusinessHours, autoEscalateUnassigned: values.autoEscalateUnassigned } });
    await recordTenantAudit({ tenantId: input.tenantId, actorUserId: ctx.user.id, action: "operating_rules.updated", entityType: "operating_rules", entityId: input.tenantId, metadata: { isEnabled: values.isEnabled, firstResponseSlaMinutes: values.firstResponseSlaMinutes, inboundRouting: values.inboundRouting, handoffOutsideBusinessHours: values.handoffOutsideBusinessHours, autoEscalateUnassigned: values.autoEscalateUnassigned } });
    return { success: true as const };
  }),
});
