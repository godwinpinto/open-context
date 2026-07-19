CREATE TABLE `trail_event` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`name` text NOT NULL,
	`properties` text,
	`distinct_id` text,
	`timestamp` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `trail_event_team_time_idx` ON `trail_event` (`team_id`,`timestamp`);