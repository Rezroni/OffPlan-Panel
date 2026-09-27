CREATE TABLE IF NOT EXISTS `source_record_revision` (
	`id` text PRIMARY KEY NOT NULL,
	`source_connection_id` text NOT NULL,
	`source_run_id` text,
	`record_type` text NOT NULL,
	`source_record_id` text NOT NULL,
	`revision_no` integer DEFAULT 1 NOT NULL,
	`raw_payload` text NOT NULL,
	`payload_checksum` text NOT NULL,
	`change_type` text NOT NULL,
	`recorded_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`source_connection_id`) REFERENCES `source_connection`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_run_id`) REFERENCES `ingestion_run`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_src_rev_record` ON `source_record_revision` (`record_type`,`source_record_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_src_rev_run` ON `source_record_revision` (`source_run_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_src_rev_checksum` ON `source_record_revision` (`payload_checksum`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `quarantined_record` (
	`id` text PRIMARY KEY NOT NULL,
	`source_connection_id` text NOT NULL,
	`source_run_id` text,
	`record_type` text NOT NULL,
	`raw_payload` text NOT NULL,
	`rejection_reason` text NOT NULL,
	`quarantined_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`source_connection_id`) REFERENCES `source_connection`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_run_id`) REFERENCES `ingestion_run`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_quarantine_run` ON `quarantined_record` (`source_run_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_quarantine_type` ON `quarantined_record` (`record_type`);--> statement-breakpoint
ALTER TABLE `ingestion_run` ADD `records_updated` integer;--> statement-breakpoint
ALTER TABLE `ingestion_run` ADD `records_quarantined` integer;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_src_rev_unique` ON `source_record_revision` (`source_connection_id`,`record_type`,`source_record_id`,`revision_no`);--> statement-breakpoint
ALTER TABLE `transaction_fact` ADD `is_apartment_eligible` integer;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_tx_apt_metrics` ON `transaction_fact` (`is_apartment_eligible`,`is_off_plan`,`area_name_en`,`bedrooms`,`transaction_date`);--> statement-breakpoint
ALTER TABLE `rent_contract_fact` ADD `property_usage` text;--> statement-breakpoint
ALTER TABLE `rent_contract_fact` ADD `is_residential` integer;--> statement-breakpoint
ALTER TABLE `rent_contract_fact` ADD `is_apartment_eligible` integer;--> statement-breakpoint
ALTER TABLE `service_charge_fact` ADD `raw_service_cost` real;--> statement-breakpoint
ALTER TABLE `service_charge_fact` ADD `raw_service_cost_unit` text DEFAULT 'unknown';--> statement-breakpoint
ALTER TABLE `project` ADD `master_developer_name` text;--> statement-breakpoint
ALTER TABLE `project` ADD `operating_developer_name` text;--> statement-breakpoint
ALTER TABLE `project` ADD `property_type` text DEFAULT 'apartment';--> statement-breakpoint
ALTER TABLE `project` ADD `dld_project_number` text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_project_property_type` ON `project` (`property_type`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `report_snapshot` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`unit_type_id` text,
	`title` text NOT NULL,
	`locale` text DEFAULT 'ru' NOT NULL,
	`snapshot_hash` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`payload_json` text NOT NULL,
	`pdf_path` text,
	`pdf_size_bytes` integer,
	`generated_by` text DEFAULT 'agent:Mokhamed',
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `offer_revision` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`building_id` text,
	`file_name` text NOT NULL,
	`file_checksum` text NOT NULL,
	`file_size_bytes` integer,
	`sheet_name` text,
	`received_at` text NOT NULL,
	`confirmed_at` text,
	`confirmed_by` text,
	`revision_no` integer DEFAULT 1 NOT NULL,
	`total_units_parsed` integer DEFAULT 0 NOT NULL,
	`total_units_available` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`building_id`) REFERENCES `building`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_offer_rev_project` ON `offer_revision` (`project_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_offer_rev_checksum` ON `offer_revision` (`file_checksum`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_offer_rev_status` ON `offer_revision` (`status`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `developer_offer` (
	`id` text PRIMARY KEY NOT NULL,
	`revision_id` text NOT NULL,
	`project_id` text NOT NULL,
	`unit_no` text NOT NULL,
	`floor_no` integer,
	`bedrooms` integer,
	`unit_type` text,
	`view` text,
	`suite_area_sqft` real,
	`balcony_area_sqft` real,
	`total_area_sqft` real NOT NULL,
	`list_price_aed` integer,
	`discount_aed` integer,
	`net_price_aed` integer NOT NULL,
	`payment_plan_preset` text,
	`availability` text DEFAULT 'available' NOT NULL,
	`first_seen_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`revision_id`) REFERENCES `offer_revision`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_dev_offer_rev` ON `developer_offer` (`revision_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_dev_offer_project` ON `developer_offer` (`project_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_dev_offer_bedrooms` ON `developer_offer` (`bedrooms`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_dev_offer_availability` ON `developer_offer` (`availability`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `content_brief` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`topic` text NOT NULL,
	`target_audience` text,
	`hook_ru` text,
	`hook_ar` text,
	`script_json` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_content_brief_project` ON `content_brief` (`project_id`);
