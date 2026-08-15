CREATE TABLE `conversation_escalations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`conversation_id` int NOT NULL,
	`reason` varchar(80) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'pending',
	`acknowledged_membership_id` int,
	`escalated_at` timestamp NOT NULL DEFAULT (now()),
	`acknowledged_at` timestamp,
	`resolved_at` timestamp,
	CONSTRAINT `conversation_escalations_id` PRIMARY KEY(`id`),
	CONSTRAINT `escalation_conversation_unique` UNIQUE(`conversation_id`)
);
--> statement-breakpoint
ALTER TABLE `conversation_escalations` ADD CONSTRAINT `conversation_escalations_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversation_escalations` ADD CONSTRAINT `conversation_escalations_conversation_id_conversations_id_fk` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conversation_escalations` ADD CONSTRAINT `fk_ce_membership` FOREIGN KEY (`acknowledged_membership_id`) REFERENCES `tenant_memberships`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `escalation_tenant_status_idx` ON `conversation_escalations` (`tenant_id`,`status`,`escalated_at`);
