ALTER TABLE `integration_configs` MODIFY COLUMN `integration_provider` enum('zapi','meta','dify','netsuite','erp_custom') NOT NULL;
UPDATE `integration_configs` SET `integration_provider` = 'erp_custom' WHERE `integration_provider` = 'netsuite';
ALTER TABLE `integration_configs` MODIFY COLUMN `integration_provider` enum('zapi','meta','dify','erp_custom') NOT NULL;
