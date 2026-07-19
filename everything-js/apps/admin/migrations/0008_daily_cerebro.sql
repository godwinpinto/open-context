CREATE TABLE `meter` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`aggregation` text NOT NULL,
	`event_type` text NOT NULL,
	`value_property` text,
	`group_by` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meter_slug_idx` ON `meter` (`team_id`,`slug`);--> statement-breakpoint
CREATE TABLE `meter_entitlement` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`feature_id` text NOT NULL,
	`subject` text NOT NULL,
	`type` text NOT NULL,
	`limit` real,
	`is_soft_limit` integer DEFAULT false NOT NULL,
	`usage_period` text DEFAULT 'month' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meter_entitlement_subject_idx` ON `meter_entitlement` (`team_id`,`feature_id`,`subject`);--> statement-breakpoint
CREATE TABLE `meter_event` (
	`store_row_id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`id` text NOT NULL,
	`type` text NOT NULL,
	`subject` text NOT NULL,
	`source` text DEFAULT 'api' NOT NULL,
	`time` integer NOT NULL,
	`data` text,
	`ingested_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meter_event_dedup_idx` ON `meter_event` (`team_id`,`source`,`id`);--> statement-breakpoint
CREATE INDEX `meter_event_type_time_idx` ON `meter_event` (`team_id`,`type`,`time`);--> statement-breakpoint
CREATE INDEX `meter_event_subject_time_idx` ON `meter_event` (`team_id`,`subject`,`time`);--> statement-breakpoint
CREATE TABLE `meter_feature` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`meter_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meter_feature_key_idx` ON `meter_feature` (`team_id`,`key`);