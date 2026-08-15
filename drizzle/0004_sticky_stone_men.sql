ALTER TABLE `agent_profiles` ADD `fallback_agent_id` int;--> statement-breakpoint
CREATE INDEX `agent_fallback_idx` ON `agent_profiles` (`fallback_agent_id`);