CREATE TABLE `capacity_addons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant_id` int NOT NULL,
	`capacity_addon_type` enum('members','agents','messages') NOT NULL,
	`quantity` int NOT NULL,
	`unit_price_cents` int NOT NULL,
	`capacity_addon_status` enum('pending','active','past_due','cancelled') NOT NULL DEFAULT 'pending',
	`billing_method` enum('stripe','pix','invoice','bank_transfer','manual') NOT NULL DEFAULT 'stripe',
	`provider_checkout_session_id` varchar(255),
	`provider_subscription_id` varchar(255),
	`starts_at` timestamp,
	`ends_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `capacity_addons_id` PRIMARY KEY(`id`),
	CONSTRAINT `capacity_addons_provider_checkout_session_id_unique` UNIQUE(`provider_checkout_session_id`)
);
--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `billing_method` enum('stripe','pix','invoice','bank_transfer','manual') DEFAULT 'stripe' NOT NULL;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD `billing_reference` varchar(255);--> statement-breakpoint
ALTER TABLE `capacity_addons` ADD CONSTRAINT `capacity_addons_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `capacity_addon_tenant_status_idx` ON `capacity_addons` (`tenant_id`,`capacity_addon_status`);--> statement-breakpoint
CREATE INDEX `capacity_addon_type_idx` ON `capacity_addons` (`tenant_id`,`capacity_addon_type`);