CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`credit_limit` integer,
	`interest_rate` text,
	`statement_date` integer,
	`due_date` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bnpl_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`spending_limit` integer NOT NULL,
	`available_limit` integer NOT NULL,
	`late_fee_amount` integer,
	`is_active` integer DEFAULT true NOT NULL,
	`notes` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bnpl_plans` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bnpl_account_id` integer NOT NULL,
	`item_name` text NOT NULL,
	`total_amount` integer NOT NULL,
	`instalment_amount` integer NOT NULL,
	`instalment_frequency` text NOT NULL,
	`instalments_total` integer NOT NULL,
	`instalments_remaining` integer NOT NULL,
	`next_payment_date` text NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`bnpl_account_id`) REFERENCES `bnpl_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `fixed_expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`amount` integer NOT NULL,
	`frequency` text NOT NULL,
	`next_due_date` text NOT NULL,
	`category` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `income` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`amount` integer NOT NULL,
	`frequency` text NOT NULL,
	`next_pay_date` text NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `merchant_mappings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`raw_pattern` text NOT NULL,
	`clean_name` text NOT NULL,
	`category` text NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `savings_goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`target_amount` integer NOT NULL,
	`current_amount` integer DEFAULT 0 NOT NULL,
	`deadline` text,
	`priority` integer DEFAULT 3 NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settings_key_unique` ON `settings` (`key`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`date` text NOT NULL,
	`raw_description` text NOT NULL,
	`clean_description` text,
	`amount` integer NOT NULL,
	`balance_after` integer,
	`category` text,
	`is_income` integer DEFAULT false NOT NULL,
	`is_reviewed` integer DEFAULT false NOT NULL,
	`statement_month` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
