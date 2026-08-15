import PDFDocument from "pdfkit";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { privateFiles } from "../../drizzle/schema";
import { getDb } from "../db";
import { requireTenantAccess } from "../tenantAccess";
import { assertTenantQuota } from "../planLimits";
import { storagePut } from "../storage";
import { protectedProcedure, router } from "../_core/trpc";
import { queryNetSuiteDocuments } from "../services/netsuite";

function createDocumentPdf(input: { documentNumber: string; cnpj: string; dueDate: string | null; total: number; status: string | null }) {
  return new Promise<Buffer>((resolve, reject) => { const doc = new PDFDocument({ margin: 54 }); const chunks: Buffer[] = []; doc.on("data", chunk => chunks.push(Buffer.from(chunk))); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); doc.fontSize(21).fillColor("#1d3844").text("Documento financeiro", { align: "left" }); doc.moveDown(); doc.fontSize(11).fillColor("#354b55").text(`Documento: ${input.documentNumber}`); doc.text(`CNPJ consultado: ${input.cnpj}`); doc.text(`Vencimento: ${input.dueDate || "Não informado"}`); doc.text(`Situação: ${input.status || "Não informada"}`); doc.moveDown(); doc.fontSize(17).fillColor("#2f6c53").text(`Total: ${input.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`); doc.moveDown(2); doc.fontSize(9).fillColor("#6d7d84").text("Documento gerado pelo Lyra a partir de consulta autorizada ao ERP do tenant. Confirme os dados diretamente no NetSuite antes de realizar qualquer pagamento."); doc.end(); });
}

export const erpRouter = router({
  lookupByCnpj: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), cnpj: z.string().min(14).max(32) })).query(async ({ ctx, input }) => { await requireTenantAccess(ctx.user.id, input.tenantId); try { return await queryNetSuiteDocuments(input.tenantId, input.cnpj); } catch (error) { throw new TRPCError({ code: "BAD_GATEWAY", message: error instanceof Error ? error.message : "Falha na consulta NetSuite." }); } }),
  createPdf: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), cnpj: z.string().min(14).max(32), documentId: z.string().min(1).max(80) })).mutation(async ({ ctx, input }) => {
    const access = await requireTenantAccess(ctx.user.id, input.tenantId); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    let documents: Awaited<ReturnType<typeof queryNetSuiteDocuments>>;
    try { documents = await queryNetSuiteDocuments(input.tenantId, input.cnpj); } catch (error) { throw new TRPCError({ code: "BAD_GATEWAY", message: error instanceof Error ? error.message : "Falha ao validar o documento no NetSuite." }); }
    const document = documents.find(item => item.id === input.documentId);
    if (!document) throw new TRPCError({ code: "NOT_FOUND", message: "Documento não encontrado para este CNPJ no NetSuite." });
    const pdf = await createDocumentPdf({ cnpj: input.cnpj, documentNumber: document.number, dueDate: document.dueDate, total: document.total, status: document.status });
    await assertTenantQuota(input.tenantId, "storage", pdf.length);
    const safeNumber = document.number.replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 60); const stored = await storagePut(`tenants/${input.tenantId}/erp/${safeNumber}.pdf`, pdf, "application/pdf");
    const [created] = await db.insert(privateFiles).values({ tenantId: input.tenantId, storageKey: stored.key, originalName: `documento-${safeNumber}.pdf`, mimeType: "application/pdf", sizeBytes: pdf.length, classification: "financial_document", uploadedByMembershipId: access.membershipId }).$returningId();
    return { id: created.id, fileName: `documento-${safeNumber}.pdf` };
  }),
});
