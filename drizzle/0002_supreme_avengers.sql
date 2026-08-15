CREATE TABLE `tenant_invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`tenant_role` enum('tenant_admin','agent') NOT NULL DEFAULT 'agent',
	`token_hash` varchar(128) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`accepted_at` timestamp,
	`created_by_user_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tenant_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenant_invites_token_hash_unique` UNIQUE(`token_hash`),
	CONSTRAINT `tenant_invite_email_pending_unique` UNIQUE(`tenant_id`,`email`)
);
--> statement-breakpoint
ALTER TABLE `tenant_invites` ADD CONSTRAINT `tenant_invites_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenant_invites` ADD CONSTRAINT `tenant_invites_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `tenant_invite_tenant_idx` ON `tenant_invites` (`tenant_id`,`expires_at`);