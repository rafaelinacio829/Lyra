export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  ownerEmail: process.env.OWNER_EMAIL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  zapiPartnerClientToken: process.env.ZAPI_PARTNER_CLIENT_TOKEN ?? "",
  evolutionApiUrl: process.env.EVOLUTION_API_URL ?? "",
  evolutionApiKey: process.env.EVOLUTION_API_KEY ?? "",
  platformProfitMarginPercent: Number(process.env.PLATFORM_PROFIT_MARGIN_PERCENT ?? "30"),
};

const productionRequiredEnvironment = [
  "DATABASE_URL",
  "JWT_SECRET",
  "TENANT_SECRETS_KEY",
  "LOCAL_AUTH_BOOTSTRAP_CODE",
] as const;

export function validateEnvironment() {
  if (!ENV.isProduction) return;

  const missing = productionRequiredEnvironment.filter(name => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Configuração de produção incompleta. Variáveis ausentes: ${missing.join(", ")}.`);
  }
  const placeholderValues = ["troque-", "replace_for_production", "xxxxxxxx", "local-dev-", "local-bootstrap-"];
  const hasPlaceholder = (name: (typeof productionRequiredEnvironment)[number]) =>
    placeholderValues.some(value => process.env[name]!.toLowerCase().includes(value));
  const placeholders = productionRequiredEnvironment.filter(hasPlaceholder);
  if (placeholders.length > 0) {
    throw new Error(`Configuração de produção contém valores de exemplo: ${placeholders.join(", ")}.`);
  }
  if (process.env.JWT_SECRET!.length < 32) {
    throw new Error("JWT_SECRET deve ter ao menos 32 caracteres em produção.");
  }
  if (process.env.TENANT_SECRETS_KEY!.length < 32) {
    throw new Error("TENANT_SECRETS_KEY deve ter ao menos 32 caracteres em produção.");
  }
  if (process.env.LOCAL_AUTH_BOOTSTRAP_CODE!.length < 16) {
    throw new Error("LOCAL_AUTH_BOOTSTRAP_CODE deve ter ao menos 16 caracteres em produção.");
  }
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY?.trim() || process.env.STRIPE_WEBHOOK_SECRET?.trim());
  if (stripeConfigured && (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_") || !process.env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_"))) {
    throw new Error("As credenciais Stripe de produção devem usar os formatos sk_* e whsec_*.");
  }
  if (!stripeConfigured) {
    console.warn("[Config] Stripe não configurado; os fluxos de cobrança permanecerão indisponíveis.");
  }
}
