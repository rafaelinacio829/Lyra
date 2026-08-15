import { and, eq } from "drizzle-orm";
import { integrationConfigs } from "../../drizzle/schema";
import { getDb } from "../db";
import { decryptTenantSecret } from "../tenantSecrets";

export type ErpDocument = {
  id: string;
  number: string;
  dueDate: string | null;
  total: number;
  status: string | null;
};

type CustomErpConfig = {
  baseUrl?: string;
  healthPath?: string;
  lookupPath?: string;
};

type CustomErpSecrets = { apiKey?: string };

export function assertCustomErpBaseUrl(value: string) {
  const parsed = new URL(value);
  const hostname = parsed.hostname.toLowerCase();
  const privateIpv4 = /^(10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(hostname);
  if (parsed.protocol !== "https:" || hostname === "localhost" || hostname.endsWith(".local") || privateIpv4) {
    throw new Error("A integração ERP deve usar uma URL HTTPS pública.");
  }
  return parsed;
}

function resolveSameOrigin(baseUrl: string, path: string) {
  const base = assertCustomErpBaseUrl(baseUrl);
  if (!path.startsWith("/")) throw new Error("O caminho do ERP deve iniciar com '/'.");
  const target = new URL(path, base);
  if (target.origin !== base.origin) throw new Error("O caminho do ERP deve permanecer no domínio configurado.");
  return target;
}

function mapDocument(value: Record<string, unknown>, index: number): ErpDocument {
  const id = String(value.id ?? value.documentId ?? value.number ?? `document-${index + 1}`);
  const number = String(value.number ?? value.code ?? value.documentNumber ?? id);
  const totalRaw = value.total ?? value.amount ?? value.value ?? 0;
  const total = typeof totalRaw === "number" ? totalRaw : Number(totalRaw);
  return {
    id,
    number,
    dueDate: typeof (value.dueDate ?? value.due_date) === "string" ? String(value.dueDate ?? value.due_date) : null,
    total: Number.isFinite(total) ? total : 0,
    status: typeof value.status === "string" ? value.status : null,
  };
}

async function customErpConfig(tenantId: number, integrationId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const [config] = await db.select().from(integrationConfigs).where(and(eq(integrationConfigs.tenantId, tenantId), eq(integrationConfigs.provider, "erp_custom"), ...(integrationId ? [eq(integrationConfigs.id, integrationId)] : [eq(integrationConfigs.status, "active")]))).limit(1);
  if (!config?.publicConfig) throw new Error(integrationId ? "Integração de ERP personalizada não encontrada." : "Integração de ERP personalizada ativa não encontrada.");
  const publicConfig = config.publicConfig as CustomErpConfig;
  if (!publicConfig.baseUrl || !publicConfig.lookupPath) throw new Error("A integração ERP não possui URL ou caminho de consulta configurado.");
  const secrets = config.secretCiphertext ? JSON.parse(decryptTenantSecret(config.secretCiphertext)) as CustomErpSecrets : {};
  return { config, publicConfig, secrets };
}

function requestHeaders(apiKey?: string) {
  return { Accept: "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) };
}

export async function verifyCustomErpConnection(tenantId: number, integrationId?: number) {
  const { publicConfig, secrets } = await customErpConfig(tenantId, integrationId);
  const url = resolveSameOrigin(publicConfig.baseUrl!, publicConfig.healthPath || "/health");
  const response = await fetch(url, { headers: requestHeaders(secrets.apiKey), signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`O ERP respondeu ${response.status} na verificação.`);
  return true;
}

export async function queryCustomErpDocuments(tenantId: number, reference: string) {
  const { publicConfig, secrets } = await customErpConfig(tenantId);
  const normalizedReference = reference.trim();
  if (!normalizedReference) throw new Error("Informe uma referência para consultar no ERP.");
  const path = publicConfig.lookupPath!.replaceAll("{reference}", encodeURIComponent(normalizedReference)).replaceAll("{cnpj}", encodeURIComponent(normalizedReference));
  const url = resolveSameOrigin(publicConfig.baseUrl!, path);
  const response = await fetch(url, { headers: requestHeaders(secrets.apiKey), signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`O ERP respondeu ${response.status} durante a consulta.`);
  const payload = await response.json() as { items?: unknown; data?: unknown; documents?: unknown };
  const values = Array.isArray(payload.items) ? payload.items : Array.isArray(payload.data) ? payload.data : Array.isArray(payload.documents) ? payload.documents : [];
  return values.filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object").map(mapDocument);
}
