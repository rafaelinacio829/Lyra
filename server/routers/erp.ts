import PDFDocument from "pdfkit";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { privateFiles } from "../../drizzle/schema";
import { getDb } from "../db";
import { requireTenantAccess } from "../tenantAccess";
import { assertTenantQuota } from "../planLimits";
import { storagePut } from "../storage";
import { protectedProcedure, router } from "../_core/trpc";
import { queryCustomErpDocuments } from "../services/customErp";

function createDocumentPdf(input: { documentNumber: string; reference: string; dueDate: string | null; total: number; status: string | null }) {
  return new Promise<Buffer>((resolve, reject) => { const doc = new PDFDocument({ margin: 54 }); const chunks: Buffer[] = []; doc.on("data", chunk => chunks.push(Buffer.from(chunk))); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); doc.fontSize(21).fillColor("#1d3844").text("Documento do ERP", { align: "left" }); doc.moveDown(); doc.fontSize(11).fillColor("#354b55").text(`Documento: ${input.documentNumber}`); doc.text(`Referência consultada: ${input.reference}`); doc.text(`Vencimento: ${input.dueDate || "Não informado"}`); doc.text(`Situação: ${input.status || "Não informada"}`); doc.moveDown(); doc.fontSize(17).fillColor("#2f6c53").text(`Total: ${input.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`); doc.moveDown(2); doc.fontSize(9).fillColor("#6d7d84").text("Documento gerado pelo Lyra a partir de consulta autorizada ao ERP configurado por este tenant. Confirme os dados diretamente no ERP antes de realizar qualquer pagamento."); doc.end(); });
}

const erpInput = z.object({ tenantId: z.number().int().positive(), reference: z.string().trim().min(3).max(120) });

export const erpRouter = router({
  lookup: protectedProcedure.input(erpInput).query(async ({ ctx, input }) => { await requireTenantAccess(ctx.user.id, input.tenantId); try { return await queryCustomErpDocuments(input.tenantId, input.reference); } catch (error) { throw new TRPCError({ code: "BAD_GATEWAY", message: error instanceof Error ? error.message : "Falha na consulta do ERP." }); } }),
  createPdf: protectedProcedure.input(erpInput.extend({ documentId: z.string().min(1).max(80) })).mutation(async ({ ctx, input }) => {
    const access = await requireTenantAccess(ctx.user.id, input.tenantId); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    let documents: Awaited<ReturnType<typeof queryCustomErpDocuments>>;
    try { documents = await queryCustomErpDocuments(input.tenantId, input.reference); } catch (error) { throw new TRPCError({ code: "BAD_GATEWAY", message: error instanceof Error ? error.message : "Falha ao validar o documento no ERP." }); }
    const document = documents.find(item => item.id === input.documentId); if (!document) throw new TRPCError({ code: "NOT_FOUND", message: "Documento não encontrado no ERP para esta referência." });
    const pdf = await createDocumentPdf({ reference: input.reference, documentNumber: document.number, dueDate: document.dueDate, total: document.total, status: document.status });
    await assertTenantQuota(input.tenantId, "storage", pdf.length);
    const safeNumber = document.number.replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 60) || "documento"; const stored = await storagePut(`tenants/${input.tenantId}/erp/${safeNumber}.pdf`, pdf, "application/pdf");
    const [created] = await db.insert(privateFiles).values({ tenantId: input.tenantId, storageKey: stored.key, originalName: `erp-${safeNumber}.pdf`, mimeType: "application/pdf", sizeBytes: pdf.length, classification: "financial_document", uploadedByMembershipId: access.membershipId }).$returningId();
    return { id: created.id, fileName: `erp-${safeNumber}.pdf` };
  }),
});
