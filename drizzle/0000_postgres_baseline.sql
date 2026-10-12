CREATE TYPE "public"."agent_mode" AS ENUM('chat', 'streaming', 'workflow', 'completion');--> statement-breakpoint
CREATE TYPE "public"."agent_provider" AS ENUM('dify', 'openai', 'anthropic', 'gemini', 'adk', 'langgraph', 'flowise', 'langflow', 'n8n', 'native', 'other');--> statement-breakpoint
CREATE TYPE "public"."billing_method_enum" AS ENUM('stripe', 'pix', 'invoice', 'bank_transfer', 'manual');--> statement-breakpoint
CREATE TYPE "public"."capacity_addon_status" AS ENUM('pending', 'active', 'past_due', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."capacity_addon_type" AS ENUM('members', 'agents', 'messages');--> statement-breakpoint
CREATE TYPE "public"."conversation_queue" AS ENUM('ai', 'human', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."file_classification" AS ENUM('media', 'invoice', 'financial_document', 'conversation_export');--> statement-breakpoint
CREATE TYPE "public"."integration_provider" AS ENUM('zapi', 'evolution', 'meta', 'dify', 'erp_custom');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('draft', 'verified', 'active', 'error', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."member_presence" AS ENUM('online', 'busy', 'away', 'offline');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('inbound', 'outbound', 'internal_note');--> statement-breakpoint
CREATE TYPE "public"."platform_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."subscription_payment_method" AS ENUM('automatic', 'card', 'boleto');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'paused', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."tenant_role" AS ENUM('tenant_admin', 'agent');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('trial', 'active', 'suspended', 'cancelled');--> statement-breakpoint
CREATE TABLE "account_recovery_codes" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"code_hash" varchar(128) NOT NULL,
	"created_by_user_id" integer,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "account_recovery_codes_code_hash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
CREATE TABLE "agent_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"name" varchar(160) NOT NULL,
	"purpose" varchar(280) NOT NULL,
	"provider" "agent_provider" DEFAULT 'dify' NOT NULL,
	"mode" "agent_mode" DEFAULT 'chat' NOT NULL,
	"api_base_url" varchar(500),
	"external_app_id" varchar(255),
	"credential_ciphertext" text,
	"credential_fingerprint" varchar(80),
	"instructions" text,
	"handoff_keywords" jsonb,
	"input_schema" jsonb,
	"fallback_agent_id" integer,
	"is_active" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"last_verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"actor_user_id" integer,
	"action" varchar(120) NOT NULL,
	"entity_type" varchar(80) NOT NULL,
	"entity_id" varchar(80),
	"metadata" jsonb,
	"ip_address" varchar(80),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auth_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "capacity_addons" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"type" "capacity_addon_type" NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"status" "capacity_addon_status" DEFAULT 'pending' NOT NULL,
	"billing_method" "billing_method_enum" DEFAULT 'stripe' NOT NULL,
	"provider_checkout_session_id" varchar(255),
	"provider_subscription_id" varchar(255),
	"starts_at" timestamp,
	"ends_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "capacity_addons_provider_checkout_session_id_unique" UNIQUE("provider_checkout_session_id")
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(50) NOT NULL,
	"email" varchar(320),
	"company" varchar(255),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_escalations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"conversation_id" integer NOT NULL,
	"reason" varchar(80) NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"acknowledged_membership_id" integer,
	"escalated_at" timestamp DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"contact_id" integer,
	"integration_config_id" integer,
	"queue" "conversation_queue" DEFAULT 'ai' NOT NULL,
	"assigned_membership_id" integer,
	"agent_profile_id" integer,
	"external_conversation_id" varchar(255),
	"latest_message_preview" varchar(500),
	"unread_count" integer DEFAULT 0 NOT NULL,
	"tags" jsonb,
	"first_response_at" timestamp,
	"resolved_at" timestamp,
	"reopened_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"name" varchar(120) NOT NULL,
	"channel_identifier" varchar(120),
	"channel_purpose" varchar(40) DEFAULT 'general' NOT NULL,
	"status" "integration_status" DEFAULT 'draft' NOT NULL,
	"public_config" jsonb,
	"secret_ciphertext" text,
	"secret_fingerprint" varchar(80),
	"webhook_secret_ciphertext" text,
	"last_verified_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"conversation_id" integer NOT NULL,
	"author_membership_id" integer,
	"direction" "message_direction" NOT NULL,
	"channel" varchar(32) DEFAULT 'whatsapp' NOT NULL,
	"provider_message_id" varchar(255),
	"body" text NOT NULL,
	"media_file_id" integer,
	"reactions" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operational_incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer,
	"integration_config_id" integer,
	"dedupe_key" varchar(180) NOT NULL,
	"source" varchar(80) NOT NULL,
	"severity" varchar(16) DEFAULT 'warning' NOT NULL,
	"summary" varchar(240) NOT NULL,
	"detail" text,
	"status" varchar(24) DEFAULT 'open' NOT NULL,
	"occurrences" integer DEFAULT 1 NOT NULL,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"resolved_by_user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "operational_incidents_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(40) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"monthly_price_cents" integer NOT NULL,
	"annual_price_cents" integer NOT NULL,
	"included_members" integer NOT NULL,
	"included_conversations" integer NOT NULL,
	"included_messages" integer NOT NULL,
	"included_agents" integer NOT NULL,
	"included_storage_mb" integer NOT NULL,
	"included_integrations" integer NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plans_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "private_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"conversation_id" integer,
	"storage_key" varchar(600) NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"mime_type" varchar(160) NOT NULL,
	"size_bytes" integer NOT NULL,
	"classification" "file_classification" NOT NULL,
	"uploaded_by_membership_id" integer,
	"retention_ends_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "private_files_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"plan_id" integer NOT NULL,
	"status" "subscription_status" DEFAULT 'trialing' NOT NULL,
	"provider_customer_id" varchar(255),
	"provider_subscription_id" varchar(255),
	"billing_method" "billing_method_enum" DEFAULT 'stripe' NOT NULL,
	"payment_method" "subscription_payment_method" DEFAULT 'automatic' NOT NULL,
	"billing_reference" varchar(255),
	"billing_interval" varchar(16) DEFAULT 'monthly' NOT NULL,
	"current_period_ends_at" timestamp,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"membership_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"lead_membership_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_cost_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"integration_config_id" integer,
	"category" varchar(40) NOT NULL,
	"provider" varchar(40),
	"units" integer DEFAULT 1 NOT NULL,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"email" varchar(320) NOT NULL,
	"role" "tenant_role" DEFAULT 'agent' NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"created_by_user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_invites_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "tenant_memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" "tenant_role" DEFAULT 'agent' NOT NULL,
	"presence" "member_presence" DEFAULT 'offline' NOT NULL,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"mfa_secret_ciphertext" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_operating_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"timezone" varchar(80) DEFAULT 'America/Sao_Paulo' NOT NULL,
	"business_hours" jsonb,
	"first_response_sla_minutes" integer DEFAULT 20 NOT NULL,
	"inbound_routing" varchar(24) DEFAULT 'ai_first' NOT NULL,
	"default_whatsapp_integration_id" integer,
	"handoff_outside_business_hours" boolean DEFAULT false NOT NULL,
	"auto_escalate_unassigned" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(180) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"primary_email" varchar(320) NOT NULL,
	"status" "tenant_status" DEFAULT 'trial' NOT NULL,
	"trial_ends_at" timestamp,
	"timezone" varchar(64) DEFAULT 'America/Sao_Paulo' NOT NULL,
	"brand_color" varchar(16) DEFAULT '#4F46E5' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "usage_counters" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"period_key" varchar(7) NOT NULL,
	"active_members" integer DEFAULT 0 NOT NULL,
	"conversations" integer DEFAULT 0 NOT NULL,
	"messages" integer DEFAULT 0 NOT NULL,
	"active_agents" integer DEFAULT 0 NOT NULL,
	"active_integrations" integer DEFAULT 0 NOT NULL,
	"storage_bytes" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"open_id" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"login_method" varchar(64),
	"password_hash" varchar(255),
	"password_updated_at" timestamp,
	"role" "platform_role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_signed_in" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_open_id_unique" UNIQUE("open_id")
);
--> statement-breakpoint
ALTER TABLE "account_recovery_codes" ADD CONSTRAINT "account_recovery_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_recovery_codes" ADD CONSTRAINT "account_recovery_codes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_profiles" ADD CONSTRAINT "agent_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capacity_addons" ADD CONSTRAINT "capacity_addons_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_escalations" ADD CONSTRAINT "conversation_escalations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_escalations" ADD CONSTRAINT "conversation_escalations_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_escalations" ADD CONSTRAINT "conversation_escalations_acknowledged_membership_id_tenant_memberships_id_fk" FOREIGN KEY ("acknowledged_membership_id") REFERENCES "public"."tenant_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_integration_config_id_integration_configs_id_fk" FOREIGN KEY ("integration_config_id") REFERENCES "public"."integration_configs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_membership_id_tenant_memberships_id_fk" FOREIGN KEY ("assigned_membership_id") REFERENCES "public"."tenant_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_agent_profile_id_agent_profiles_id_fk" FOREIGN KEY ("agent_profile_id") REFERENCES "public"."agent_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_configs" ADD CONSTRAINT "integration_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_membership_id_tenant_memberships_id_fk" FOREIGN KEY ("author_membership_id") REFERENCES "public"."tenant_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_incidents" ADD CONSTRAINT "operational_incidents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_incidents" ADD CONSTRAINT "operational_incidents_integration_config_id_integration_configs_id_fk" FOREIGN KEY ("integration_config_id") REFERENCES "public"."integration_configs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_incidents" ADD CONSTRAINT "operational_incidents_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_files" ADD CONSTRAINT "private_files_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_files" ADD CONSTRAINT "private_files_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_files" ADD CONSTRAINT "private_files_uploaded_by_membership_id_tenant_memberships_id_fk" FOREIGN KEY ("uploaded_by_membership_id") REFERENCES "public"."tenant_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_membership_id_tenant_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."tenant_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_lead_membership_id_tenant_memberships_id_fk" FOREIGN KEY ("lead_membership_id") REFERENCES "public"."tenant_memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_cost_events" ADD CONSTRAINT "tenant_cost_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_invites" ADD CONSTRAINT "tenant_invites_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_invites" ADD CONSTRAINT "tenant_invites_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_operating_rules" ADD CONSTRAINT "tenant_operating_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_recovery_user_idx" ON "account_recovery_codes" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "agent_tenant_active_idx" ON "agent_profiles" USING btree ("tenant_id","is_active");--> statement-breakpoint
CREATE INDEX "agent_fallback_idx" ON "agent_profiles" USING btree ("fallback_agent_id");--> statement-breakpoint
CREATE INDEX "audit_tenant_created_idx" ON "audit_logs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "auth_session_user_idx" ON "auth_sessions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "capacity_addon_tenant_status_idx" ON "capacity_addons" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "capacity_addon_type_idx" ON "capacity_addons" USING btree ("tenant_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_phone_per_tenant_unique" ON "contacts" USING btree ("tenant_id","phone");--> statement-breakpoint
CREATE UNIQUE INDEX "escalation_conversation_unique" ON "conversation_escalations" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "escalation_tenant_status_idx" ON "conversation_escalations" USING btree ("tenant_id","status","escalated_at");--> statement-breakpoint
CREATE INDEX "conversation_tenant_queue_idx" ON "conversations" USING btree ("tenant_id","queue","updated_at");--> statement-breakpoint
CREATE INDEX "conversation_tenant_integration_idx" ON "conversations" USING btree ("tenant_id","integration_config_id","updated_at");--> statement-breakpoint
CREATE INDEX "conversation_assignee_idx" ON "conversations" USING btree ("tenant_id","assigned_membership_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_name_per_tenant_unique" ON "integration_configs" USING btree ("tenant_id","provider","name");--> statement-breakpoint
CREATE INDEX "integration_tenant_status_idx" ON "integration_configs" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_message_per_tenant_unique" ON "messages" USING btree ("tenant_id","provider_message_id");--> statement-breakpoint
CREATE INDEX "message_conversation_created_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "operational_incident_tenant_idx" ON "operational_incidents" USING btree ("tenant_id","status","last_seen_at");--> statement-breakpoint
CREATE INDEX "operational_incident_status_idx" ON "operational_incidents" USING btree ("status","last_seen_at");--> statement-breakpoint
CREATE INDEX "file_tenant_classification_idx" ON "private_files" USING btree ("tenant_id","classification");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_tenant_unique" ON "subscriptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_subscription_unique" ON "subscriptions" USING btree ("provider_subscription_id");--> statement-breakpoint
CREATE INDEX "subscription_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "team_membership_unique" ON "team_members" USING btree ("team_id","membership_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_name_per_tenant_unique" ON "teams" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "tenant_cost_events_tenant_date_idx" ON "tenant_cost_events" USING btree ("tenant_id","occurred_at");--> statement-breakpoint
CREATE INDEX "tenant_cost_events_integration_idx" ON "tenant_cost_events" USING btree ("integration_config_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_invite_email_pending_unique" ON "tenant_invites" USING btree ("tenant_id","email");--> statement-breakpoint
CREATE INDEX "tenant_invite_tenant_idx" ON "tenant_invites" USING btree ("tenant_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_member_unique" ON "tenant_memberships" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "tenant_member_lookup_idx" ON "tenant_memberships" USING btree ("tenant_id","role","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_operating_rules_tenant_unique" ON "tenant_operating_rules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_status_idx" ON "tenants" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_tenant_period_unique" ON "usage_counters" USING btree ("tenant_id","period_key");