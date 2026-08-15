import { and, eq } from "drizzle-orm";
import { integrationConfigs } from "../../drizzle/schema";
import { getDb } from "../db";
import { decryptTenantSecret } from "../tenantSecrets";

type NetSuiteConfig = { restBaseUrl?: string; cnpjField?: string };
type NetSuiteSecrets = { clientId: string; clientSecret: string; refreshToken: string };

function sanitizeCnpj(cnpj: string) { const value = cnpj.replace(/\D/g, ""); if (value.length !== 14) throw new Error("CNPJ inválido."); return value; }

export async function queryNetSuiteDocuments(tenantId: number, cnpjInput: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const [config] = await db.select().from(integrationConfigs).where(and(eq(integrationConfigs.tenantId, tenantId), eq(integrationConfigs.provider, "netsuite"), eq(integrationConfigs.status, "active"))).limit(1);
  if (!config?.secretCiphertext || !config.publicConfig) throw new Error("Integração NetSuite ativa não encontrada.");
  const publicConfig = config.publicConfig as NetSuiteConfig;
  const baseUrl = publicConfig.restBaseUrl?.replace(/\/+$/, "");
  if (!baseUrl || !new URL(baseUrl).hostname.endsWith("netsuite.com")) throw new Error("Configuração NetSuite inválida.");
  const cnpjField = publicConfig.cnpjField && /^[A-Za-z_][A-Za-z0-9_]*$/.test(publicConfig.cnpjField) ? publicConfig.cnpjField : "vatregnumber";
  const cnpj = sanitizeCnpj(cnpjInput);
  const secrets = JSON.parse(decryptTenantSecret(config.secretCiphertext)) as NetSuiteSecrets;
  const tokenResponse = await fetch(`${baseUrl}/services/rest/auth/oauth2/v1/token`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${secrets.clientId}:${secrets.clientSecret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: secrets.refreshToken }).toString() });
  if (!tokenResponse.ok) throw new Error("O NetSuite não autorizou a consulta.");
  const token = (await tokenResponse.json()) as { access_token?: string };
  if (!token.access_token) throw new Error("Token NetSuite ausente.");
  const query = `SELECT id, tranid, trandate, duedate, total, status FROM transaction WHERE entity IN (SELECT id FROM customer WHERE ${cnpjField} = '${cnpj}') AND type IN ('CustInvc', 'CustCred') ORDER BY trandate DESC`;
  const response = await fetch(`${baseUrl}/services/rest/query/v1/suiteql`, { method: "POST", headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json", Prefer: "transient" }, body: JSON.stringify({ q: query }) });
  if (!response.ok) throw new Error("O NetSuite não retornou documentos para este CNPJ.");
  const payload = await response.json() as { items?: Array<Record<string, unknown>> };
  return (payload.items ?? []).map(item => ({ id: String(item.id ?? ""), number: String(item.tranid ?? "Documento"), date: item.trandate ? String(item.trandate) : null, dueDate: item.duedate ? String(item.duedate) : null, total: Number(item.total ?? 0), status: item.status ? String(item.status) : null }));
}
