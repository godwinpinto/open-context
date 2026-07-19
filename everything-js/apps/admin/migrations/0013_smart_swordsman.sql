CREATE TABLE `exp_experiment` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`hypothesis` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`segment_key` text,
	`variants` text NOT NULL,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`stopped_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exp_experiment_key_idx` ON `exp_experiment` (`team_id`,`key`);--> statement-breakpoint
CREATE TABLE `exp_exposure` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`experiment_id` text NOT NULL,
	`identity_id` text NOT NULL,
	`identity_key` text NOT NULL,
	`variant` text NOT NULL,
	`exposed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exp_exposure_identity_idx` ON `exp_exposure` (`experiment_id`,`identity_id`);--> statement-breakpoint
CREATE INDEX `exp_exposure_variant_idx` ON `exp_exposure` (`experiment_id`,`variant`);--> statement-breakpoint
CREATE TABLE `exp_goal` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`experiment_id` text NOT NULL,
	`identity_id` text NOT NULL,
	`goal_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exp_goal_identity_idx` ON `exp_goal` (`experiment_id`,`identity_id`);