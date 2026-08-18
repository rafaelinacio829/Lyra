ALTER TABLE `integration_configs` ADD `channel_identifier` varchar(120);--> statement-breakpoint
ALTER TABLE `integration_configs` ADD `channel_purpose` varchar(40) DEFAULT 'general' NOT NULL;