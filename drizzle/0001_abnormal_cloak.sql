CREATE TABLE `agent_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`purpose` varchar(280) NOT NULL,
	`agent_provider` enum('dify','native','other') NOT NULL DEFAULT 'dify',
	`agent_mode` enum('chat','streaming','workflow','completion') NOT NULL DEFAULT 'chat',
	`api_base_url` varchar(500),
	`external_app_id` varchar(255),
	`credential_ciphertext` text,
	`credential_fingerprint` varchar(80),
	`instructions` text,
	`handoff_keywords` json,
	`input_schema` json,
	`is_active` boolean NOT NULL DEFAULT false,
	`is_default` boolean NOT NULL DEFAULT false,
	`last_verified_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` int,
	`actor_user_id` int,
	`action` varchar(120) NOT NULL,
	`entity_type` varchar(80) NOT NULL,
	`entity_id` varchar(80),
	`metadata` json,
	`ip_address` varchar(80),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`phone` varchar(50) NOT NULL,
	`email` varchar(320),
	`company` varchar(255),
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contacts_id` PRIMARY KEY(`id`),
	CONSTRAINT `contact_phone_per_tenant_unique` UNIQUE(`tenant_id`,`phone`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`contact_id` int,
	`conversation_queue` enum('ai','human','resolved') NOT NULL DEFAULT 'ai',
	`assigned_membership_id` int,
	`agent_profile_id` int,
	`external_conversation_id` varchar(255),
	`latest_message_preview` varchar(500),
	`unread_count` int NOT NULL DEFAULT 0,
	`tags` json,
	`first_response_at` timestamp,
	`resolved_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integration_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`integration_provider` enum('zapi','dify','netsuite') NOT NULL,
	`name` varchar(120) NOT NULL,
	`integration_status` enum('draft','verified','active','error','disabled') NOT NULL DEFAULT 'draft',
	`public_config` json,
	`secret_ciphertext` text,
	`secret_fingerprint` varchar(80),
	`webhook_secret_ciphertext` text,
	`last_verified_at` timestamp,
	`last_error` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integration_configs_id` PRIMARY KEY(`id`),
	CONSTRAINT `integration_name_per_tenant_unique` UNIQUE(`tenant_id`,`integration_provider`,`name`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`conversation_id` int NOT NULL,
	`author_membership_id` int,
	`message_direction` enum('inbound','outbound','internal_note') NOT NULL,
	`channel` varchar(32) NOT NULL DEFAULT 'whatsapp',
	`provider_message_id` varchar(255),
	`body` text NOT NULL,
	`media_file_id` int,
	`reactions` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_message_per_tenant_unique` UNIQUE(`tenant_id`,`provider_message_id`)
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(40) NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`monthly_price_cents` int NOT NULL,
	`annual_price_cents` int NOT NULL,
	`included_members` int NOT NULL,
	`included_conversations` int NOT NULL,
	`included_messages` int NOT NULL,
	`included_agents` int NOT NULL,
	`included_storage_mb` int NOT NULL,
	`included_integrations` int NOT NULL,
	`is_public` boolean NOT NULL DEFAULT true,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `plans_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `private_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`conversation_id` int,
	`storage_key` varchar(600) NOT NULL,
	`original_name` varchar(255) NOT NULL,
	`mime_type` varchar(160) NOT NULL,
	`size_bytes` int NOT NULL,
	`file_classification` enum('media','invoice','financial_document','conversation_export') NOT NULL,
	`uploaded_by_membership_id` int,
	`retention_ends_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `private_files_id` PRIMARY KEY(`id`),
	CONSTRAINT `private_files_storage_key_unique` UNIQUE(`storage_key`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`plan_id` int NOT NULL,
	`subscription_status` enum('trialing','active','past_due','paused','cancelled') NOT NULL DEFAULT 'trialing',
	`provider_customer_id` varchar(255),
	`provider_subscription_id` varchar(255),
	`billing_interval` varchar(16) NOT NULL DEFAULT 'monthly',
	`current_period_ends_at` timestamp,
	`cancel_at_period_end` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscription_tenant_unique` UNIQUE(`tenant_id`),
	CONSTRAINT `provider_subscription_unique` UNIQUE(`provider_subscription_id`)
);
--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`team_id` int NOT NULL,
	`membership_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `team_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `team_membership_unique` UNIQUE(`team_id`,`membership_id`)
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`lead_membership_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teams_id` PRIMARY KEY(`id`),
	CONSTRAINT `team_name_per_tenant_unique` UNIQUE(`tenant_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `tenant_memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`user_id` int NOT NULL,
	`tenant_role` enum('tenant_admin','agent') NOT NULL DEFAULT 'agent',
	`member_presence` enum('online','busy','away','offline') NOT NULL DEFAULT 'offline',
	`mfa_enabled` boolean NOT NULL DEFAULT false,
	`mfa_secret_ciphertext` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`joined_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenant_memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenant_member_unique` UNIQUE(`tenant_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`slug` varchar(80) NOT NULL,
	`primary_email` varchar(320) NOT NULL,
	`tenant_status` enum('trial','active','suspended','cancelled') NOT NULL DEFAULT 'trial',
	`trial_ends_at` timestamp,
	`timezone` varchar(64) NOT NULL DEFAULT 'America/Sao_Paulo',
	`brand_color` varchar(16) NOT NULL DEFAULT '#4F46E5',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenants_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `usage_counters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`period_key` varchar(7) NOT NULL,
	`active_members` int NOT NULL DEFAULT 0,
	`conversations` int NOT NULL DEFAULT 0,
	`messages` int NOT NULL DEFAULT 0,
	`active_agents` int NOT NULL DEFAULT 0,
	`active_integrations` int NOT NULL DEFAULT 0,
	`storage_bytes` int NOT NULL DEFAULT 0,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `usage_counters_id` PRIMARY KEY(`id`),
	CONSTRAINT `usage_tenant_period_unique` UNIQUE(`tenant_id`,`period_key`)
);
--> statement-breakpoint
ALTER TABLE `users` RENAME COLUMN `openId` TO `open_id`;--> statement-breakpoint
ALTER TABLE `users` RENAME COLUMN `loginMethod` TO `login_method`;--> statement-breakpoint
ALTER TABLE `users` RENAME COLUMN `role` TO `platform_role`;--> statement-breakpoint
ALTER TABLE `users` RENAME COLUMN `createdAt` TO `created_at`;--> statement-breakpoint
ALTER TABLE `users` RENAME COLUMN `updatedAt` TO `updated_at`;--> statement-breakpoint
ALTER TABLE `users` RENAME COLUMN `lastSignedIn` TO `last_signed_in`;--> statement-breakpoint
ALTER TABLE `users` DROP INDEX `users_openId_unique`;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_open_id_unique` UNIQUE(`open_id`);--> statement-breakpoint
ALTER TABLE `agent_profiles` ADD CONSTRAINT `agent_profiles_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_user_id_users_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contacts` ADD CONSTRAINT `contacts_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_contact_id_contacts_id_fk` FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_assigned_membership_id_tenant_memberships_id_fk` FOREIGN KEY (`assigned_membership_id`) REFERENCES `tenant_memberships`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_agent_profile_id_agent_profiles_id_fk` FOREIGN KEY (`agent_profile_id`) REFERENCES `agent_profiles`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `integration_configs` ADD CONSTRAINT `integration_configs_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_conversation_id_conversations_id_fk` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `messages` ADD CONSTRAINT `messages_author_membership_id_tenant_memberships_id_fk` FOREIGN KEY (`author_membership_id`) REFERENCES `tenant_memberships`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `private_files` ADD CONSTRAINT `private_files_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `private_files` ADD CONSTRAINT `private_files_conversation_id_conversations_id_fk` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `private_files` ADD CONSTRAINT `private_files_uploaded_by_membership_id_tenant_memberships_id_fk` FOREIGN KEY (`uploaded_by_membership_id`) REFERENCES `tenant_memberships`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_plan_id_plans_id_fk` FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_members` ADD CONSTRAINT `team_members_team_id_teams_id_fk` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `team_members` ADD CONSTRAINT `team_members_membership_id_tenant_memberships_id_fk` FOREIGN KEY (`membership_id`) REFERENCES `tenant_memberships`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teams` ADD CONSTRAINT `teams_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teams` ADD CONSTRAINT `teams_lead_membership_id_tenant_memberships_id_fk` FOREIGN KEY (`lead_membership_id`) REFERENCES `tenant_memberships`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenant_memberships` ADD CONSTRAINT `tenant_memberships_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenant_memberships` ADD CONSTRAINT `tenant_memberships_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `usage_counters` ADD CONSTRAINT `usage_counters_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `agent_tenant_active_idx` ON `agent_profiles` (`tenant_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `audit_tenant_created_idx` ON `audit_logs` (`tenant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `conversation_tenant_queue_idx` ON `conversations` (`tenant_id`,`conversation_queue`,`updated_at`);--> statement-breakpoint
CREATE INDEX `conversation_assignee_idx` ON `conversations` (`tenant_id`,`assigned_membership_id`);--> statement-breakpoint
CREATE INDEX `integration_tenant_status_idx` ON `integration_configs` (`tenant_id`,`integration_status`);--> statement-breakpoint
CREATE INDEX `message_conversation_created_idx` ON `messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `file_tenant_classification_idx` ON `private_files` (`tenant_id`,`file_classification`);--> statement-breakpoint
CREATE INDEX `subscription_status_idx` ON `subscriptions` (`subscription_status`);--> statement-breakpoint
CREATE INDEX `tenant_member_lookup_idx` ON `tenant_memberships` (`tenant_id`,`tenant_role`,`is_active`);--> statement-breakpoint
CREATE INDEX `tenant_status_idx` ON `tenants` (`tenant_status`);