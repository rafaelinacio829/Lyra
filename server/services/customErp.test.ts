import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), decryptTenantSecret: vi.fn() }));
vi.mock("../db", () => ({ getDb: mocks.getDb }));
vi.mock("../tenantSecrets", () => ({ decryptTenantSecret: mocks.decryptTenantSecret }));

import { assertCustomErpBaseUrl, queryCustomErpDocuments } from "./customErp";

function queryChain(value: unknown) { const chain = { from: () => chain, where: () => chain, limit: () => Promise.resolve(value) }; return chain; }

describe("conector de ERP personalizado", () => {
  beforeEach(() => vi.clearAllMocks());
  it("aceita apenas URL HTTPS pública como base de integração", () => {
    expect(assertCustomErpBaseUrl("https://erp.exemplo.com/api").origin).toBe("https://erp.exemplo.com");
    expect(() => assertCustomErpBaseUrl("http://erp.exemplo.com")).toThrow("HTTPS pública");
    expect(() => assertCustomErpBaseUrl("https://localhost:3000")).toThrow("HTTPS pública");
    expect(() => assertCustomErpBaseUrl("https://10.0.0.5")).toThrow("HTTPS pública");
    expect(() => assertCustomErpBaseUrl("https://192.168.0.10")).toThrow("HTTPS pública");
  });
  it("normaliza a resposta operacional do ERP e envia a referência com segurança", async () => {
    mocks.getDb.mockResolvedValue({ select: vi.fn(() => queryChain([{ publicConfig: { baseUrl: "https://erp.exemplo.com", lookupPath: "/v1/documents?reference={reference}" }, secretCiphertext: "cipher" }])) });
    mocks.decryptTenantSecret.mockReturnValue(JSON.stringify({ apiKey: "tenant-token" }));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [{ documentId: "doc_1", code: "PED-100", amount: "249.90", due_date: "2026-09-01", status: "open" }] }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(queryCustomErpDocuments(8, "PED 100/1")).resolves.toEqual([{ id: "doc_1", number: "PED-100", total: 249.9, dueDate: "2026-09-01", status: "open" }]);
    expect(fetchMock).toHaveBeenCalledWith(expect.objectContaining({ href: "https://erp.exemplo.com/v1/documents?reference=PED%20100%2F1" }), expect.objectContaining({ headers: { Accept: "application/json", Authorization: "Bearer tenant-token" } }));
  });
  it("propaga falha de consulta do ERP sem aceitar uma resposta incompleta", async () => {
    mocks.getDb.mockResolvedValue({ select: vi.fn(() => queryChain([{ publicConfig: { baseUrl: "https://erp.exemplo.com", lookupPath: "/v1/documents?reference={reference}" }, secretCiphertext: "cipher" }])) });
    mocks.decryptTenantSecret.mockReturnValue(JSON.stringify({ apiKey: "tenant-token" }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502 }));
    await expect(queryCustomErpDocuments(8, "pedido-100")).rejects.toThrow("ERP respondeu 502");
  });
});
