-- Custom SQL migration file, put your code below! --
ALTER TABLE `integration_configs` RENAME COLUMN `integration_provider` TO `provider`;--> statement-breakpoint
ALTER TABLE `integration_configs` RENAME COLUMN `integration_status` TO `status`;--> statement-breakpoint
ALTER TABLE `integration_configs` MODIFY COLUMN `provider` enum('zapi','evolution','meta','dify','erp_custom') NOT NULL;--> statement-breakpoint
CREATE TABLE `tenant_cost_events` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint unsigned NOT NULL,
  `integration_config_id` bigint unsigned,
  `category` varchar(40) NOT NULL,
  `provider` varchar(40),
  `units` int NOT NULL DEFAULT 1,
  `cost_cents` int NOT NULL DEFAULT 0,
  `metadata` json,
  `occurred_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `tenant_cost_events_tenant_date_idx` (`tenant_id`, `occurred_at`),
  KEY `tenant_cost_events_integration_idx` (`integration_config_id`, `occurred_at`),
  CONSTRAINT `tenant_cost_events_tenant_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
);