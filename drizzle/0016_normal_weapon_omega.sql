CREATE TABLE `account_recovery_codes` (
	`id` varchar(64) NOT NULL,
	`user_id` int NOT NULL,
	`code_hash` varchar(128) NOT NULL,
	`created_by_user_id` int,
	`expires_at` timestamp NOT NULL,
	`used_at` timestamp,
	`revoked_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `account_recovery_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `account_recovery_codes_code_hash_unique` UNIQUE(`code_hash`)
);
--> statement-breakpoint
ALTER TABLE `account_recovery_codes` ADD CONSTRAINT `account_recovery_codes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `account_recovery_codes` ADD CONSTRAINT `account_recovery_codes_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `account_recovery_user_idx` ON `account_recovery_codes` (`user_id`,`expires_at`);