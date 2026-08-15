import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb, requireTenantAccess, queryNetSuiteDocuments } = vi.hoisted(() => ({ getDb: vi.fn(), requireTenantAccess: vi.fn(), queryNetSuiteDocuments: vi.fn() }));
vi.mock("../db", () => ({ getDb }));
vi.mock("../tenantAccess", () => ({ requireTenantAccess }));
vi.mock("../services/netsuite", () => ({ queryNetSuiteDocuments }));

import { TRPCError } from "@trpc/server";
import { erpRouter } from "./erp";
import { fileRouter } from "./files";

const context = { user: { id: 7, openId: "tenant-a", name: "Tenant A", email: null, loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as never, res: {} as never };

describe("isolamento de tenant em arquivos e ERP", () => {
  beforeEach(() => { getDb.mockReset(); queryNetSuiteDocuments.mockReset(); requireTenantAccess.mockReset().mockRejectedValue(new TRPCError({ code: "FORBIDDEN", message: "Sem acesso ao tenant solicitado." })); });
  it("nega consulta ERP antes de acessar o NetSuite de outro tenant", async () => {
    await expect(erpRouter.createCaller(context).lookupByCnpj({ tenantId: 99, cnpj: "12345678000199" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(queryNetSuiteDocuments).not.toHaveBeenCalled(); expect(getDb).not.toHaveBeenCalled();
  });
  it("nega geração de PDF ERP antes de registrar arquivo privado de outro tenant", async () => {
    await expect(erpRouter.createCaller(context).createPdf({ tenantId: 99, cnpj: "12345678000199", documentId: "external-1" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(queryNetSuiteDocuments).not.toHaveBeenCalled(); expect(getDb).not.toHaveBeenCalled();
  });
  it("nega URL assinada de arquivo antes de consultar metadados de outro tenant", async () => {
    await expect(fileRouter.createCaller(context).downloadUrl({ tenantId: 99, fileId: 42 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(getDb).not.toHaveBeenCalled();
  });
});
