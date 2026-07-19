CREATE TABLE `oc_webhook_attempt` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`message_id` text NOT NULL,
	`endpoint_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempt_number` integer DEFAULT 0 NOT NULL,
	`http_status` integer,
	`response_snippet` text,
	`next_attempt_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `oc_webhook_attempt_due_idx` ON `oc_webhook_attempt` (`team_id`,`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `oc_webhook_attempt_message_idx` ON `oc_webhook_attempt` (`message_id`);--> statement-breakpoint
CREATE TABLE `oc_webhook_endpoint` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`owner_type` text NOT NULL,
	`owner_key` text DEFAULT '' NOT NULL,
	`url` text NOT NULL,
	`description` text,
	`secret` text NOT NULL,
	`event_types` text,
	`disabled` integer DEFAULT false NOT NULL,
	`disabled_reason` text,
	`consecutive_failures` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `oc_webhook_endpoint_owner_idx` ON `oc_webhook_endpoint` (`team_id`,`owner_type`,`owner_key`);--> statement-breakpoint
CREATE TABLE `oc_webhook_message` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`owner_type` text NOT NULL,
	`owner_key` text DEFAULT '' NOT NULL,
	`event_type` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `oc_webhook_message_team_idx` ON `oc_webhook_message` (`team_id`,`created_at`);