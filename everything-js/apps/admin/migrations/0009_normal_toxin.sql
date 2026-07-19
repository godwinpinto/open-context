CREATE TABLE `meter_grant` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`entitlement_id` text NOT NULL,
	`amount` real NOT NULL,
	`priority` integer DEFAULT 1 NOT NULL,
	`effective_at` integer NOT NULL,
	`expires_at` integer,
	`voided_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `meter_grant_entitlement_idx` ON `meter_grant` (`team_id`,`entitlement_id`);