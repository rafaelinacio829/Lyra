import {
  boolean,
  index,
  integer,
  serial,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const platformRole = pgEnum("platform_role", ["user", "admin"]);
export const tenantStatus = pgEnum("tenant_status", ["trial", "active", "suspended", "cancelled"]);
export const tenantRole = pgEnum("tenant_role", ["tenant_admin", "agent"]);
export const memberPresence = pgEnum("member_presence", ["online", "busy", "away", "offline"]);
export const subscriptionStatus = pgEnum("subscription_status", ["trialing", "active", "past_due", "paused", "cancelled"]);
export const billingMethod = pgEnum("billing_method_enum", ["stripe", "pix", "invoice", "bank_transfer", "manual"]);
export const subscriptionPaymentMethod = pgEnum("subscription_payment_method", ["automatic", "card", "boleto"]);
export const capacityAddonType = pgEnum("capacity_addon_type", ["members", "agents", "messages"]);
export const capacityAddonStatus = pgEnum("capacity_addon_status", ["pending", "active", "past_due", "cancelled"]);
export const agentProvider = pgEnum("agent_provider", ["dify", "openai", "anthropic", "gemini", "adk", "langgraph", "flowise", "langflow", "n8n", "native", "other"]);
export const agentMode = pgEnum("agent_mode", ["chat", "streaming", "workflow", "completion"]);
export const conversationQueue = pgEnum("conversation_queue", ["ai", "human", "resolved"]);
export const messageDirection = pgEnum("message_direction", ["inbound", "outbound", "internal_note"]);
export const fileClassification = pgEnum("file_classification", ["media", "invoice", "financial_document", "conversation_export"]);
export const integrationProvider = pgEnum("integration_provider", ["zapi", "evolution", "meta", "dify", "erp_custom"]);
export const integrationStatus = pgEnum("integration_status", ["draft", "verified", "active", "error", "disabled"]);

/** Core identity table managed by Manus OAuth. */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("open_id", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("login_method", { length: 64 }),
  passwordHash: varchar("password_hash", { length: 255 }),
  passwordUpdatedAt: timestamp("password_updated_at"),
  role: platformRole("role").notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  lastSignedIn: timestamp("last_signed_in").defaultNow().notNull(),
});

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at"),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  table => [index("auth_session_user_idx").on(table.userId, table.expiresAt)]
);

export const accountRecoveryCodes = pgTable(
  "account_recovery_codes",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    codeHash: varchar("code_hash", { length: 128 }).notNull().unique(),
    createdByUserId: integer("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  table => [index("account_recovery_user_idx").on(table.userId, table.expiresAt)]
);

export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  monthlyPriceCents: integer("monthly_price_cents").notNull(),
  annualPriceCents: integer("annual_price_cents").notNull(),
  includedMembers: integer("included_members").notNull(),
  includedConversations: integer("included_conversations").notNull(),
  includedMessages: integer("included_messages").notNull(),
  includedAgents: integer("included_agents").notNull(),
  includedStorageMb: integer("included_storage_mb").notNull(),
  includedIntegrations: integer("included_integrations").notNull(),
  isPublic: boolean("is_public").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const tenants = pgTable(
  "tenants",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 80 }).notNull().unique(),
    primaryEmail: varchar("primary_email", { length: 320 }).notNull(),
    status: tenantStatus("status").notNull().default("trial"),
    trialEndsAt: timestamp("trial_ends_at"),
    timezone: varchar("timezone", { length: 64 }).notNull().default("America/Sao_Paulo"),
    brandColor: varchar("brand_color", { length: 16 }).notNull().default("#4F46E5"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  table => [index("tenant_status_idx").on(table.status)]
);

export const tenantMemberships = pgTable(
  "tenant_memberships",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: tenantRole("role").notNull().default("agent"),
    presence: memberPresence("presence").notNull().default("offline"),
    mfaEnabled: boolean("mfa_enabled").notNull().default(false),
    mfaSecretCiphertext: text("mfa_secret_ciphertext"),
    isActive: boolean("is_active").notNull().default(true),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  table => [
    uniqueIndex("tenant_member_unique").on(table.tenantId, table.userId),
    index("tenant_member_lookup_idx").on(table.tenantId, table.role, table.isActive),
  ]
);

export const teams = pgTable(
  "teams",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    leadMembershipId: integer("lead_membership_id").references(() => tenantMemberships.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  table => [uniqueIndex("team_name_per_tenant_unique").on(table.tenantId, table.name)]
);

export const teamMembers = pgTable(
  "team_members",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
    membershipId: integer("membership_id").notNull().references(() => tenantMemberships.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  table => [uniqueIndex("team_membership_unique").on(table.teamId, table.membershipId)]
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    planId: integer("plan_id").notNull().references(() => plans.id, { onDelete: "restrict" }),
    status: subscriptionStatus("status").notNull().default("trialing"),
    providerCustomerId: varchar("provider_customer_id", { length: 255 }),
    providerSubscriptionId: varchar("provider_subscription_id", { length: 255 }),
    billingMethod: billingMethod("billing_method").notNull().default("stripe"),
    paymentMethod: subscriptionPaymentMethod("payment_method").notNull().default("automatic"),
    billingReference: varchar("billing_reference", { length: 255 }),
    billingInterval: varchar("billing_interval", { length: 16 }).notNull().default("monthly"),
    currentPeriodEndsAt: timestamp("current_period_ends_at"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  table => [
    uniqueIndex("subscription_tenant_unique").on(table.tenantId),
    uniqueIndex("provider_subscription_unique").on(table.providerSubscriptionId),
    index("subscription_status_idx").on(table.status),
  ]
);

export const capacityAddons = pgTable(
  "capacity_addons",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    type: capacityAddonType("type").notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    status: capacityAddonStatus("status").notNull().default("pending"),
    billingMethod: billingMethod("billing_method").notNull().default("stripe"),
    providerCheckoutSessionId: varchar("provider_checkout_session_id", { length: 255 }).unique(),
    providerSubscriptionId: varchar("provider_subscription_id", { length: 255 }),
    startsAt: timestamp("starts_at"),
    endsAt: timestamp("ends_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  table => [index("capacity_addon_tenant_status_idx").on(table.tenantId, table.status), index("capacity_addon_type_idx").on(table.tenantId, table.type)]
);

export const usageCounters = pgTable(
  "usage_counters",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    periodKey: varchar("period_key", { length: 7 }).notNull(),
    activeMembers: integer("active_members").notNull().default(0),
    conversations: integer("conversations").notNull().default(0),
    messages: integer("messages").notNull().default(0),
    activeAgents: integer("active_agents").notNull().default(0),
    activeIntegrations: integer("active_integrations").notNull().default(0),
    storageBytes: integer("storage_bytes").notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  table => [uniqueIndex("usage_tenant_period_unique").on(table.tenantId, table.periodKey)]
);

export const tenantCostEvents = pgTable(
  "tenant_cost_events",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    integrationConfigId: integer("integration_config_id"),
    category: varchar("category", { length: 40 }).notNull(),
    provider: varchar("provider", { length: 40 }),
    units: integer("units").notNull().default(1),
    costCents: integer("cost_cents").notNull().default(0),
    metadata: jsonb("metadata"),
    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
  },
  table => [index("tenant_cost_events_tenant_date_idx").on(table.tenantId, table.occurredAt), index("tenant_cost_events_integration_idx").on(table.integrationConfigId, table.occurredAt)]
);

export const tenantInvites = pgTable(
  "tenant_invites",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    role: tenantRole("role").notNull().default("agent"),
    tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    createdByUserId: integer("created_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("tenant_invite_email_pending_unique").on(table.tenantId, table.email),
    index("tenant_invite_tenant_idx").on(table.tenantId, table.expiresAt),
  ]
);

export const tenantOperatingRules = pgTable(
  "tenant_operating_rules",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    isEnabled: boolean("is_enabled").notNull().default(true),
    timezone: varchar("timezone", { length: 80 }).notNull().default("America/Sao_Paulo"),
    businessHours: jsonb("business_hours"),
    firstResponseSlaMinutes: integer("first_response_sla_minutes").notNull().default(20),
    inboundRouting: varchar("inbound_routing", { length: 24 }).notNull().default("ai_first"),
    defaultWhatsAppIntegrationId: integer("default_whatsapp_integration_id"),
    handoffOutsideBusinessHours: boolean("handoff_outside_business_hours").notNull().default(false),
    autoEscalateUnassigned: boolean("auto_escalate_unassigned").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  table => [uniqueIndex("tenant_operating_rules_tenant_unique").on(table.tenantId)]
);

export const agentProfiles = pgTable(
  "agent_profiles",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    purpose: varchar("purpose", { length: 280 }).notNull(),
    provider: agentProvider("provider").notNull().default("dify"),
    mode: agentMode("mode").notNull().default("chat"),
    apiBaseUrl: varchar("api_base_url", { length: 500 }),
    externalAppId: varchar("external_app_id", { length: 255 }),
    credentialCiphertext: text("credential_ciphertext"),
    credentialFingerprint: varchar("credential_fingerprint", { length: 80 }),
    instructions: text("instructions"),
    handoffKeywords: jsonb("handoff_keywords"),
    inputSchema: jsonb("input_schema"),
    fallbackAgentId: integer("fallback_agent_id"),
    isActive: boolean("is_active").notNull().default(false),
    isDefault: boolean("is_default").notNull().default(false),
    lastVerifiedAt: timestamp("last_verified_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  table => [index("agent_tenant_active_idx").on(table.tenantId, table.isActive), index("agent_fallback_idx").on(table.fallbackAgentId)]
);

export const integrationConfigs = pgTable(
  "integration_configs",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    provider: integrationProvider("provider").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    channelIdentifier: varchar("channel_identifier", { length: 120 }),
    channelPurpose: varchar("channel_purpose", { length: 40 }).notNull().default("general"),
    status: integrationStatus("status").notNull().default("draft"),
    publicConfig: jsonb("public_config"),
    secretCiphertext: text("secret_ciphertext"),
    secretFingerprint: varchar("secret_fingerprint", { length: 80 }),
    webhookSecretCiphertext: text("webhook_secret_ciphertext"),
    lastVerifiedAt: timestamp("last_verified_at"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  table => [
    uniqueIndex("integration_name_per_tenant_unique").on(table.tenantId, table.provider, table.name),
    index("integration_tenant_status_idx").on(table.tenantId, table.status),
  ]
);

export const operationalIncidents = pgTable(
  "operational_incidents",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    integrationConfigId: integer("integration_config_id").references(() => integrationConfigs.id, { onDelete: "set null" }),
    dedupeKey: varchar("dedupe_key", { length: 180 }).notNull().unique(),
    source: varchar("source", { length: 80 }).notNull(),
    severity: varchar("severity", { length: 16 }).notNull().default("warning"),
    summary: varchar("summary", { length: 240 }).notNull(),
    detail: text("detail"),
    status: varchar("status", { length: 24 }).notNull().default("open"),
    occurrences: integer("occurrences").notNull().default(1),
    firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
    resolvedByUserId: integer("resolved_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  table => [index("operational_incident_tenant_idx").on(table.tenantId, table.status, table.lastSeenAt), index("operational_incident_status_idx").on(table.status, table.lastSeenAt)]
);

export const contacts = pgTable(
  "contacts",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 50 }).notNull(),
    email: varchar("email", { length: 320 }),
    company: varchar("company", { length: 255 }),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  table => [uniqueIndex("contact_phone_per_tenant_unique").on(table.tenantId, table.phone)]
);

export const conversations = pgTable(
  "conversations",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    contactId: integer("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    integrationConfigId: integer("integration_config_id").references(() => integrationConfigs.id, { onDelete: "set null" }),
    queue: conversationQueue("queue").notNull().default("ai"),
    assignedMembershipId: integer("assigned_membership_id").references(() => tenantMemberships.id, { onDelete: "set null" }),
    agentProfileId: integer("agent_profile_id").references(() => agentProfiles.id, { onDelete: "set null" }),
    externalConversationId: varchar("external_conversation_id", { length: 255 }),
    latestMessagePreview: varchar("latest_message_preview", { length: 500 }),
    unreadCount: integer("unread_count").notNull().default(0),
    tags: jsonb("tags"),
    firstResponseAt: timestamp("first_response_at"),
    resolvedAt: timestamp("resolved_at"),
    reopenedAt: timestamp("reopened_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  table => [
    index("conversation_tenant_queue_idx").on(table.tenantId, table.queue, table.updatedAt),
    index("conversation_tenant_integration_idx").on(table.tenantId, table.integrationConfigId, table.updatedAt),
    index("conversation_assignee_idx").on(table.tenantId, table.assignedMembershipId),
  ]
);

export const conversationEscalations = pgTable(
  "conversation_escalations",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    reason: varchar("reason", { length: 80 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("pending"),
    acknowledgedMembershipId: integer("acknowledged_membership_id").references(() => tenantMemberships.id, { onDelete: "set null" }),
    escalatedAt: timestamp("escalated_at").defaultNow().notNull(),
    acknowledgedAt: timestamp("acknowledged_at"),
    resolvedAt: timestamp("resolved_at"),
  },
  table => [uniqueIndex("escalation_conversation_unique").on(table.conversationId), index("escalation_tenant_status_idx").on(table.tenantId, table.status, table.escalatedAt)]
);

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    authorMembershipId: integer("author_membership_id").references(() => tenantMemberships.id, { onDelete: "set null" }),
    direction: messageDirection("direction").notNull(),
    channel: varchar("channel", { length: 32 }).notNull().default("whatsapp"),
    providerMessageId: varchar("provider_message_id", { length: 255 }),
    body: text("body").notNull(),
    mediaFileId: integer("media_file_id"),
    reactions: jsonb("reactions"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("provider_message_per_tenant_unique").on(table.tenantId, table.providerMessageId),
    index("message_conversation_created_idx").on(table.conversationId, table.createdAt),
  ]
);

export const privateFiles = pgTable(
  "private_files",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    conversationId: integer("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
    storageKey: varchar("storage_key", { length: 600 }).notNull().unique(),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 160 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    classification: fileClassification("classification").notNull(),
    uploadedByMembershipId: integer("uploaded_by_membership_id").references(() => tenantMemberships.id, { onDelete: "set null" }),
    retentionEndsAt: timestamp("retention_ends_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  table => [index("file_tenant_classification_idx").on(table.tenantId, table.classification)]
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    actorUserId: integer("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 120 }).notNull(),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    entityId: varchar("entity_id", { length: 80 }),
    metadata: jsonb("metadata"),
    ipAddress: varchar("ip_address", { length: 80 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  table => [index("audit_tenant_created_idx").on(table.tenantId, table.createdAt)]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Tenant = typeof tenants.$inferSelect;
export type TenantMembership = typeof tenantMemberships.$inferSelect;
export type TenantInvite = typeof tenantInvites.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type AgentProfile = typeof agentProfiles.$inferSelect;
export type IntegrationConfig = typeof integrationConfigs.$inferSelect;
