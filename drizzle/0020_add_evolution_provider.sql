ALTER TABLE `integration_configs` MODIFY COLUMN `provider` enum('zapi','evolution','meta','dify','erp_custom') NOT NULL;
