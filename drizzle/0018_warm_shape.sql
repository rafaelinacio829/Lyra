CREATE TABLE `operational_incidents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` int,
	`integration_config_id` int,
	`dedupe_key` varchar(180) NOT NULL,
	`source` varchar(80) NOT NULL,
	`severity` varchar(16) NOT NULL DEFAULT 'warning',
	`summary` varchar(240) NOT NULL,
	`detail` text,
	`status` varchar(24) NOT NULL DEFAULT 'open',
	`occurrences` int NOT NULL DEFAULT 1,
	`first_seen_at` timestamp NOT NULL DEFAULT (now()),
	`last_seen_at` timestamp NOT NULL DEFAULT (now()),
	`resolved_at` timestamp,
	`resolved_by_user_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operational_incidents_id` PRIMARY KEY(`id`),
	CONSTRAINT `operational_incidents_dedupe_key_unique` UNIQUE(`dedupe_key`)
);
--> statement-breakpoint
ALTER TABLE `operational_incidents` ADD CONSTRAINT `oi_tenant_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operational_incidents` ADD CONSTRAINT `oi_integration_fk` FOREIGN KEY (`integration_config_id`) REFERENCES `integration_configs`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operational_incidents` ADD CONSTRAINT `oi_resolved_user_fk` FOREIGN KEY (`resolved_by_user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `operational_incident_tenant_idx` ON `operational_incidents` (`tenant_id`,`status`,`last_seen_at`);--> statement-breakpoint
CREATE INDEX `operational_incident_status_idx` ON `operational_incidents` (`status`,`last_seen_at`);
