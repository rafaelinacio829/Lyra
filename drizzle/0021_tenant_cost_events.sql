CREATE TABLE `tenant_cost_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tenant_id` int NOT NULL,
  `category` varchar(40) NOT NULL,
  `provider` varchar(40),
  `units` int NOT NULL DEFAULT 1,
  `cost_cents` int NOT NULL DEFAULT 0,
  `metadata` json,
  `occurred_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `tenant_cost_events_tenant_date_idx` (`tenant_id`, `occurred_at`),
  CONSTRAINT `tenant_cost_events_tenant_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
);
