CREATE TABLE `area` (
	`id` text PRIMARY KEY NOT NULL,
	`name_en` text NOT NULL,
	`name_ar` text,
	`dld_code` text,
	`parent_area_id` text,
	`lat` real,
	`lng` real,
	`coord_precision` text,
	`coord_source` text
);
--> statement-breakpoint
CREATE INDEX `idx_area_dld_code` ON `area` (`dld_code`);--> statement-breakpoint
CREATE TABLE `building` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name_en` text NOT NULL,
	`phase_name` text,
	`dld_building_id` text,
	`total_floors` integer,
	`lat` real,
	`lng` real,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_building_project` ON `building` (`project_id`);--> statement-breakpoint
CREATE TABLE `data_health_check` (
	`id` text PRIMARY KEY NOT NULL,
	`source_connection_id` text NOT NULL,
	`checked_at` text DEFAULT (datetime('now')) NOT NULL,
	`total_records` integer,
	`oldest_record` text,
	`newest_record` text,
	`coverage_notes` text,
	`status` text NOT NULL,
	FOREIGN KEY (`source_connection_id`) REFERENCES `source_connection`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `developer` (
	`id` text PRIMARY KEY NOT NULL,
	`legal_name` text NOT NULL,
	`brand_name` text,
	`dld_developer_id` text,
	`source_run_id` text,
	`first_seen_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`source_run_id`) REFERENCES `ingestion_run`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_developer_dld_id` ON `developer` (`dld_developer_id`);--> statement-breakpoint
CREATE TABLE `ingestion_run` (
	`id` text PRIMARY KEY NOT NULL,
	`source_connection_id` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`records_fetched` integer,
	`records_inserted` integer,
	`records_skipped` integer,
	`error_message` text,
	`filter_params` text,
	`checksum` text,
	FOREIGN KEY (`source_connection_id`) REFERENCES `source_connection`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_ingestion_source` ON `ingestion_run` (`source_connection_id`);--> statement-breakpoint
CREATE INDEX `idx_ingestion_status` ON `ingestion_run` (`status`);--> statement-breakpoint
CREATE TABLE `match_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`candidate_type` text NOT NULL,
	`internal_id` text,
	`external_source` text NOT NULL,
	`external_key` text NOT NULL,
	`external_name` text,
	`match_score` real,
	`match_reason` text,
	`rejection_reason` text,
	`confirmed_by` text,
	`confirmed_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_match_status` ON `match_queue` (`status`);--> statement-breakpoint
CREATE INDEX `idx_match_external` ON `match_queue` (`external_source`,`external_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_match_unique` ON `match_queue` (`external_source`,`external_key`,`candidate_type`);--> statement-breakpoint
CREATE TABLE `project` (
	`id` text PRIMARY KEY NOT NULL,
	`developer_id` text,
	`name_en` text NOT NULL,
	`name_ar` text,
	`area_id` text,
	`dld_project_id` text,
	`bayut_external_id` text,
	`status` text,
	`expected_handover_date` text,
	`handover_date_source` text,
	`construction_progress_pct` real,
	`escrow_bank_name` text,
	`escrow_account_no` text,
	`escrow_status` text,
	`total_units_reported` integer,
	`lat` real,
	`lng` real,
	`research_status` text DEFAULT 'discovered' NOT NULL,
	`source_run_id` text,
	`first_seen_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`developer_id`) REFERENCES `developer`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`area_id`) REFERENCES `area`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_run_id`) REFERENCES `ingestion_run`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_project_developer` ON `project` (`developer_id`);--> statement-breakpoint
CREATE INDEX `idx_project_area` ON `project` (`area_id`);--> statement-breakpoint
CREATE INDEX `idx_project_dld_id` ON `project` (`dld_project_id`);--> statement-breakpoint
CREATE INDEX `idx_project_status` ON `project` (`status`);--> statement-breakpoint
CREATE TABLE `rent_contract_fact` (
	`id` text PRIMARY KEY NOT NULL,
	`source_run_id` text,
	`contract_date` text NOT NULL,
	`start_date` text,
	`end_date` text,
	`contract_type` text,
	`area_name_en` text,
	`building_name_en` text,
	`unit_no` text,
	`bedrooms` integer,
	`area_sqm` real,
	`area_sqft` real,
	`annual_rent_aed` integer,
	`is_multi_property` integer,
	`is_excluded` integer DEFAULT false,
	`exclusion_reason` text,
	`matched_project_id` text,
	`match_confidence` text,
	FOREIGN KEY (`source_run_id`) REFERENCES `ingestion_run`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`matched_project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_rent_date` ON `rent_contract_fact` (`contract_date`);--> statement-breakpoint
CREATE INDEX `idx_rent_area` ON `rent_contract_fact` (`area_name_en`);--> statement-breakpoint
CREATE INDEX `idx_rent_bedrooms` ON `rent_contract_fact` (`bedrooms`);--> statement-breakpoint
CREATE INDEX `idx_rent_matched_project` ON `rent_contract_fact` (`matched_project_id`);--> statement-breakpoint
CREATE TABLE `service_charge_fact` (
	`id` text PRIMARY KEY NOT NULL,
	`source_run_id` text,
	`year` integer NOT NULL,
	`building_name_en` text,
	`area_name_en` text,
	`annual_charge_per_sqft` real,
	`annual_charge_per_sqm` real,
	`charge_category` text,
	`matched_project_id` text,
	`matched_building_id` text,
	FOREIGN KEY (`source_run_id`) REFERENCES `ingestion_run`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`matched_project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`matched_building_id`) REFERENCES `building`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sc_year` ON `service_charge_fact` (`year`);--> statement-breakpoint
CREATE INDEX `idx_sc_matched_project` ON `service_charge_fact` (`matched_project_id`);--> statement-breakpoint
CREATE TABLE `source_connection` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`base_url` text,
	`is_active` integer DEFAULT true NOT NULL,
	`terms_notes` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transaction_fact` (
	`id` text PRIMARY KEY NOT NULL,
	`source_run_id` text,
	`transaction_no` text,
	`transaction_date` text NOT NULL,
	`registration_date` text,
	`area_name_en` text,
	`building_name_en` text,
	`project_name_en` text,
	`dld_project_id` text,
	`unit_no` text,
	`bedrooms` integer,
	`area_sqm` real,
	`area_sqft` real,
	`transaction_value_aed` integer,
	`price_per_sqft_aed` real,
	`transaction_type` text,
	`property_type` text,
	`property_subtype` text,
	`is_off_plan` integer,
	`is_residential` integer,
	`is_excluded` integer DEFAULT false,
	`exclusion_reason` text,
	`matched_project_id` text,
	`matched_building_id` text,
	`match_confidence` text,
	FOREIGN KEY (`source_run_id`) REFERENCES `ingestion_run`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`matched_project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`matched_building_id`) REFERENCES `building`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_tx_date` ON `transaction_fact` (`transaction_date`);--> statement-breakpoint
CREATE INDEX `idx_tx_area` ON `transaction_fact` (`area_name_en`);--> statement-breakpoint
CREATE INDEX `idx_tx_project_dld` ON `transaction_fact` (`dld_project_id`);--> statement-breakpoint
CREATE INDEX `idx_tx_matched_project` ON `transaction_fact` (`matched_project_id`);--> statement-breakpoint
CREATE INDEX `idx_tx_bedrooms_date` ON `transaction_fact` (`bedrooms`,`transaction_date`);--> statement-breakpoint
CREATE TABLE `unit_type` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`building_id` text,
	`bedrooms` integer,
	`unit_type_label` text,
	`area_sqft_min` real,
	`area_sqft_max` real,
	`area_type` text,
	`list_price_aed` integer,
	`net_price_aed` integer,
	`price_source` text,
	`price_as_of` text,
	`assignment_policy` text,
	`min_paid_pct_for_noc` real,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`building_id`) REFERENCES `building`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_unit_type_project` ON `unit_type` (`project_id`);--> statement-breakpoint
CREATE INDEX `idx_unit_type_bedrooms` ON `unit_type` (`bedrooms`);