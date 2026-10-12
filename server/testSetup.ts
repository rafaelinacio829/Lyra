const fallbackValues: Record<string, string> = {
  NODE_ENV: "test",
  JWT_SECRET: "dev-local-jwt-secret-please-change-in-production-123",
  DATABASE_URL: "mysql://root:root@127.0.0.1:3306/lyra",
  OWNER_OPEN_ID: "owner-local",
  TENANT_SECRETS_KEY: "local-dev-tenant-secrets-key-2026",
  LOCAL_AUTH_BOOTSTRAP_CODE: "local-bootstrap-code-2026",
  STRIPE_SECRET_KEY: "sk_test_local_dev_key_replace_for_production",
  STRIPE_WEBHOOK_SECRET: "whsec_local_dev_key_replace_for_production",
};

for (const [key, value] of Object.entries(fallbackValues)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}
