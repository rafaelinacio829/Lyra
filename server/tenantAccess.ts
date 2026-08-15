import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { tenantMemberships, tenants } from "../drizzle/schema";

export type TenantAccess = {
  membershipId: number;
  tenantId: number;
  tenantName: string;
  tenantSlug: string;
  role: "tenant_admin" | "agent";
};

type AccessOptions = { allowBillingAccess?: boolean };

export async function requireTenantAccess(userId: number, tenantId: number, options: AccessOptions = {}): Promise<TenantAccess> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });

  const [access] = await db
    .select({
      membershipId: tenantMemberships.id,
      tenantId: tenants.id,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
      tenantStatus: tenants.status,
      trialEndsAt: tenants.trialEndsAt,
      role: tenantMemberships.role,
    })
    .from(tenantMemberships)
    .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
    .where(
      and(
        eq(tenantMemberships.tenantId, tenantId),
        eq(tenantMemberships.userId, userId),
        eq(tenantMemberships.isActive, true)
      )
    )
    .limit(1);

  if (!access) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Você não possui acesso a esta empresa." });
  }

  const trialExpired = access.tenantStatus === "trial" && access.trialEndsAt && access.trialEndsAt.getTime() <= Date.now();
  const inactive = access.tenantStatus === "suspended" || access.tenantStatus === "cancelled";
  if (!options.allowBillingAccess && (trialExpired || inactive)) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: trialExpired ? "O trial desta empresa terminou. Escolha um plano para continuar a operação." : "A operação desta empresa está suspensa. Acesse a cobrança para regularizar a assinatura." });
  }

  return { membershipId: access.membershipId, tenantId: access.tenantId, tenantName: access.tenantName, tenantSlug: access.tenantSlug, role: access.role };
}

export async function requireTenantAdmin(userId: number, tenantId: number, options: AccessOptions = {}): Promise<TenantAccess> {
  const access = await requireTenantAccess(userId, tenantId, options);
  if (access.role !== "tenant_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores da empresa podem executar esta ação." });
  }
  return access;
}

export function requirePlatformAdmin(role: "user" | "admin") {
  if (role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Apenas super-administradores da plataforma podem executar esta ação." });
  }
}
