CREATE TABLE `dash_dashboard` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`name` text NOT NULL,
	`layout` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `dash_dashboard_team_idx` ON `dash_dashboard` (`team_id`);--> statement-breakpoint
CREATE TABLE `dash_panel` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`dashboard_id` text NOT NULL,
	`title` text NOT NULL,
	`chart_type` text NOT NULL,
	`sql` text NOT NULL,
	`config` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `dash_panel_dashboard_idx` ON `dash_panel` (`dashboard_id`);--> statement-breakpoint
CREATE TABLE `dash_share` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`dashboard_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer,
	`disabled` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dash_share_token_idx` ON `dash_share` (`token`);--> statement-breakpoint
CREATE INDEX `dash_share_dashboard_idx` ON `dash_share` (`dashboard_id`);