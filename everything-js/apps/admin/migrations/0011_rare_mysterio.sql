CREATE TABLE `oc_group` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`key` text NOT NULL,
	`properties` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oc_group_key_idx` ON `oc_group` (`team_id`,`key`);--> statement-breakpoint
CREATE TABLE `oc_identity` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`key` text NOT NULL,
	`properties` text NOT NULL,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oc_identity_key_idx` ON `oc_identity` (`team_id`,`key`);--> statement-breakpoint
CREATE INDEX `oc_identity_last_seen_idx` ON `oc_identity` (`team_id`,`last_seen_at`);--> statement-breakpoint
CREATE TABLE `oc_identity_group` (
	`team_id` text NOT NULL,
	`identity_id` text NOT NULL,
	`group_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oc_identity_group_idx` ON `oc_identity_group` (`identity_id`,`group_id`);--> statement-breakpoint
CREATE INDEX `oc_identity_group_team_idx` ON `oc_identity_group` (`team_id`,`group_id`);