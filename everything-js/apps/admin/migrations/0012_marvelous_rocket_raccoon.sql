CREATE TABLE `oc_segment` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`type` text NOT NULL,
	`rules` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oc_segment_key_idx` ON `oc_segment` (`team_id`,`key`);--> statement-breakpoint
CREATE TABLE `oc_segment_identity` (
	`team_id` text NOT NULL,
	`segment_id` text NOT NULL,
	`identity_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oc_segment_identity_idx` ON `oc_segment_identity` (`segment_id`,`identity_id`);--> statement-breakpoint
CREATE INDEX `oc_segment_identity_team_idx` ON `oc_segment_identity` (`team_id`,`identity_id`);