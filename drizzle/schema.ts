import {
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const platformRole = mysqlEnum("platform_role", ["user", "admin"]);
export const tenantStatus = mysqlEnum("tenant_status", ["trial", "active", "suspended", "cancelled"]);
export const tenantRole = mysqlEnum("tenant_role", ["tenant_admin", "agent"]);
export const memberPresence = mysqlEnum("member_presence", ["online", "busy", "away", "offline"]);
export const subscriptionStatus = mysqlEnum("subscription_status", ["trialing", "active", "past_due", "paused", "cancelled"]);
export const billingMethod = mysqlEnum("billing_method", ["stripe", "pix", "invoice", "bank_transfer", "manual"]);
export const subscriptionPaymentMethod = mysqlEnum("subscription_payment_method", ["automatic", "card", "boleto"]);
export const capacityAddonType = mysqlEnum("capacity_addon_type", ["members", "agents", "messages"]);
export const capacityAddonStatus = mysqlEnum("capacity_addon_status", ["pending", "active", "past_due", "cancelled"]);
export const agentProvider = mysqlEnum("agent_provider", ["dify", "openai", "anthropic", "gemini", "adk", "langgraph", "flowise", "langflow", "n8n", "native", "other"]);
export const agentMode = mysqlEnum("agent_mode", ["chat", "streaming", "workflow", "completion"]);
export const conversationQueue = mysqlEnum("conversation_queue", ["ai", "human", "resolved"]);
export const messageDirection = mysqlEnum("message_direction", ["inbound", "outbound", "internal_note"]);
export const fileClassification = mysqlEnum("file_classification", ["media", "invoice", "financial_document", "conversation_export"]);
export const integrationProvider = mysqlEnum("integration_provider", ["zapi", "meta", "dify", "erp_custom"]);
export const integrationStatus = mysqlEnum("integration_status", ["draft", "verified", "active", "error", "disabled"]);

/** Core identity table managed by Manus OAuth. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("open_id", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("login_method", { length: 64 }),
  passwordHash: varchar("password_hash", { length: 255 }),
  passwordUpdatedAt: timestamp("password_updated_at"),
  role: platformRole.notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("last_signed_in").defaultNow().notNull(),
});

export const authSessions = mysqlTable(
  "auth_sessions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at"),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  table => [index("auth_session_user_idx").on(table.userId, table.expiresAt)]
);

export const plans = mysqlTable("plans", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  monthlyPriceCents: int("monthly_price_cents").notNull(),
  annualPriceCents: int("annual_price_cents").notNull(),
  includedMembers: int("included_members").notNull(),
  includedConversations: int("included_conversations").notNull(),
  includedMessages: int("included_messages").notNull(),
  includedAgents: int("included_agents").notNull(),
  includedStorageMb: int("included_storage_mb").notNull(),
  includedIntegrations: int("included_integrations").notNull(),
  isPublic: boolean("is_public").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const tenants = mysqlTable(
  "tenants",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 80 }).notNull().unique(),
    primaryEmail: varchar("primary_email", { length: 320 }).notNull(),
    status: tenantStatus.notNull().default("trial"),
    trialEndsAt: timestamp("trial_ends_at"),
    timezone: varchar("timezone", { length: 64 }).notNull().default("America/Sao_Paulo"),
    brandColor: varchar("brand_color", { length: 16 }).notNull().default("#4F46E5"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("tenant_status_idx").on(table.status)]
);

export const tenantMemberships = mysqlTable(
  "tenant_memberships",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: tenantRole.notNull().default("agent"),
    presence: memberPresence.notNull().default("offline"),
    mfaEnabled: boolean("mfa_enabled").notNull().default(false),
    mfaSecretCiphertext: text("mfa_secret_ciphertext"),
    isActive: boolean("is_active").notNull().default(true),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("tenant_member_unique").on(table.tenantId, table.userId),
    index("tenant_member_lookup_idx").on(table.tenantId, table.role, table.isActive),
  ]
);

export const teams = mysqlTable(
  "teams",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    leadMembershipId: int("lead_membership_id").references(() => tenantMemberships.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("team_name_per_tenant_unique").on(table.tenantId, table.name)]
);

export const teamMembers = mysqlTable(
  "team_members",
  {
    id: int("id").autoincrement().primaryKey(),
    teamId: int("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
    membershipId: int("membership_id").notNull().references(() => tenantMemberships.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  table => [uniqueIndex("team_membership_unique").on(table.teamId, table.membershipId)]
);

export const subscriptions = mysqlTable(
  "subscriptions",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    planId: int("plan_id").notNull().references(() => plans.id, { onDelete: "restrict" }),
    status: subscriptionStatus.notNull().default("trialing"),
    providerCustomerId: varchar("provider_customer_id", { length: 255 }),
    providerSubscriptionId: varchar("provider_subscription_id", { length: 255 }),
    billingMethod: billingMethod.notNull().default("stripe"),
    paymentMethod: subscriptionPaymentMethod.notNull().default("automatic"),
    billingReference: varchar("billing_reference", { length: 255 }),
    billingInterval: varchar("billing_interval", { length: 16 }).notNull().default("monthly"),
    currentPeriodEndsAt: timestamp("current_period_ends_at"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("subscription_tenant_unique").on(table.tenantId),
    uniqueIndex("provider_subscription_unique").on(table.providerSubscriptionId),
    index("subscription_status_idx").on(table.status),
  ]
);

export const capacityAddons = mysqlTable(
  "capacity_addons",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    type: capacityAddonType.notNull(),
    quantity: int("quantity").notNull(),
    unitPriceCents: int("unit_price_cents").notNull(),
    status: capacityAddonStatus.notNull().default("pending"),
    billingMethod: billingMethod.notNull().default("stripe"),
    providerCheckoutSessionId: varchar("provider_checkout_session_id", { length: 255 }).unique(),
    providerSubscriptionId: varchar("provider_subscription_id", { length: 255 }),
    startsAt: timestamp("starts_at"),
    endsAt: timestamp("ends_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("capacity_addon_tenant_status_idx").on(table.tenantId, table.status), index("capacity_addon_type_idx").on(table.tenantId, table.type)]
);

export const usageCounters = mysqlTable(
  "usage_counters",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    periodKey: varchar("period_key", { length: 7 }).notNull(),
    activeMembers: int("active_members").notNull().default(0),
    conversations: int("conversations").notNull().default(0),
    messages: int("messages").notNull().default(0),
    activeAgents: int("active_agents").notNull().default(0),
    activeIntegrations: int("active_integrations").notNull().default(0),
    storageBytes: int("storage_bytes").notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("usage_tenant_period_unique").on(table.tenantId, table.periodKey)]
);

export const tenantInvites = mysqlTable(
  "tenant_invites",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    role: tenantRole.notNull().default("agent"),
    tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    createdByUserId: int("created_by_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("tenant_invite_email_pending_unique").on(table.tenantId, table.email),
    index("tenant_invite_tenant_idx").on(table.tenantId, table.expiresAt),
  ]
);

export const agentProfiles = mysqlTable(
  "agent_profiles",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    purpose: varchar("purpose", { length: 280 }).notNull(),
    provider: agentProvider.notNull().default("dify"),
    mode: agentMode.notNull().default("chat"),
    apiBaseUrl: varchar("api_base_url", { length: 500 }),
    externalAppId: varchar("external_app_id", { length: 255 }),
    credentialCiphertext: text("credential_ciphertext"),
    credentialFingerprint: varchar("credential_fingerprint", { length: 80 }),
    instructions: text("instructions"),
    handoffKeywords: json("handoff_keywords"),
    inputSchema: json("input_schema"),
    fallbackAgentId: int("fallback_agent_id"),
    isActive: boolean("is_active").notNull().default(false),
    isDefault: boolean("is_default").notNull().default(false),
    lastVerifiedAt: timestamp("last_verified_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("agent_tenant_active_idx").on(table.tenantId, table.isActive), index("agent_fallback_idx").on(table.fallbackAgentId)]
);

export const integrationConfigs = mysqlTable(
  "integration_configs",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    provider: integrationProvider.notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    status: integrationStatus.notNull().default("draft"),
    publicConfig: json("public_config"),
    secretCiphertext: text("secret_ciphertext"),
    secretFingerprint: varchar("secret_fingerprint", { length: 80 }),
    webhookSecretCiphertext: text("webhook_secret_ciphertext"),
    lastVerifiedAt: timestamp("last_verified_at"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("integration_name_per_tenant_unique").on(table.tenantId, table.provider, table.name),
    index("integration_tenant_status_idx").on(table.tenantId, table.status),
  ]
);

export const contacts = mysqlTable(
  "contacts",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 50 }).notNull(),
    email: varchar("email", { length: 320 }),
    company: varchar("company", { length: 255 }),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("contact_phone_per_tenant_unique").on(table.tenantId, table.phone)]
);

export const conversations = mysqlTable(
  "conversations",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    contactId: int("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    queue: conversationQueue.notNull().default("ai"),
    assignedMembershipId: int("assigned_membership_id").references(() => tenantMemberships.id, { onDelete: "set null" }),
    agentProfileId: int("agent_profile_id").references(() => agentProfiles.id, { onDelete: "set null" }),
    externalConversationId: varchar("external_conversation_id", { length: 255 }),
    latestMessagePreview: varchar("latest_message_preview", { length: 500 }),
    unreadCount: int("unread_count").notNull().default(0),
    tags: json("tags"),
    firstResponseAt: timestamp("first_response_at"),
    resolvedAt: timestamp("resolved_at"),
    reopenedAt: timestamp("reopened_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("conversation_tenant_queue_idx").on(table.tenantId, table.queue, table.updatedAt),
    index("conversation_assignee_idx").on(table.tenantId, table.assignedMembershipId),
  ]
);

export const messages = mysqlTable(
  "messages",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    conversationId: int("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    authorMembershipId: int("author_membership_id").references(() => tenantMemberships.id, { onDelete: "set null" }),
    direction: messageDirection.notNull(),
    channel: varchar("channel", { length: 32 }).notNull().default("whatsapp"),
    providerMessageId: varchar("provider_message_id", { length: 255 }),
    body: text("body").notNull(),
    mediaFileId: int("media_file_id"),
    reactions: json("reactions"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("provider_message_per_tenant_unique").on(table.tenantId, table.providerMessageId),
    index("message_conversation_created_idx").on(table.conversationId, table.createdAt),
  ]
);

export const privateFiles = mysqlTable(
  "private_files",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    conversationId: int("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
    storageKey: varchar("storage_key", { length: 600 }).notNull().unique(),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 160 }).notNull(),
    sizeBytes: int("size_bytes").notNull(),
    classification: fileClassification.notNull(),
    uploadedByMembershipId: int("uploaded_by_membership_id").references(() => tenantMemberships.id, { onDelete: "set null" }),
    retentionEndsAt: timestamp("retention_ends_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  table => [index("file_tenant_classification_idx").on(table.tenantId, table.classification)]
);

export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    tenantId: int("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    actorUserId: int("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 120 }).notNull(),
    entityType: varchar("entity_type", { length: 80 }).notNull(),
    entityId: varchar("entity_id", { length: 80 }),
    metadata: json("metadata"),
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
