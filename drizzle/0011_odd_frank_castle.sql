CREATE TABLE `tenant_operating_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`is_enabled` boolean NOT NULL DEFAULT true,
	`timezone` varchar(80) NOT NULL DEFAULT 'America/Sao_Paulo',
	`business_hours` json,
	`first_response_sla_minutes` int NOT NULL DEFAULT 20,
	`handoff_outside_business_hours` boolean NOT NULL DEFAULT false,
	`auto_escalate_unassigned` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenant_operating_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenant_operating_rules_tenant_unique` UNIQUE(`tenant_id`)
);
--> statement-breakpoint
ALTER TABLE `tenant_operating_rules` ADD CONSTRAINT `tenant_operating_rules_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;