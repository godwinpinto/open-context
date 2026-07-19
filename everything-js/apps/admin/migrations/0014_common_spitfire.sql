CREATE TABLE `flag` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `flag_key_idx` ON `flag` (`team_id`,`key`);--> statement-breakpoint
CREATE TABLE `flag_environment` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `flag_environment_key_idx` ON `flag_environment` (`team_id`,`key`);--> statement-breakpoint
CREATE TABLE `flag_identity_override` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`flag_id` text NOT NULL,
	`environment_id` text NOT NULL,
	`identity_id` text NOT NULL,
	`identity_key` text NOT NULL,
	`enabled` integer NOT NULL,
	`value` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `flag_identity_override_idx` ON `flag_identity_override` (`flag_id`,`environment_id`,`identity_id`);--> statement-breakpoint
CREATE INDEX `flag_identity_override_env_idx` ON `flag_identity_override` (`environment_id`,`identity_id`);--> statement-breakpoint
CREATE TABLE `flag_segment_override` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`flag_id` text NOT NULL,
	`environment_id` text NOT NULL,
	`segment_key` text NOT NULL,
	`priority` integer DEFAULT 1 NOT NULL,
	`enabled` integer NOT NULL,
	`value` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `flag_segment_override_idx` ON `flag_segment_override` (`flag_id`,`environment_id`,`segment_key`);--> statement-breakpoint
CREATE INDEX `flag_segment_override_env_idx` ON `flag_segment_override` (`environment_id`);--> statement-breakpoint
CREATE TABLE `flag_state` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`flag_id` text NOT NULL,
	`environment_id` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`value` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `flag_state_idx` ON `flag_state` (`flag_id`,`environment_id`);