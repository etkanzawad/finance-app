CREATE TABLE `wishlist_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`price` integer NOT NULL,
	`url` text,
	`store` text,
	`priority` integer DEFAULT 3 NOT NULL,
	`notes` text,
	`category` text,
	`status` text DEFAULT 'wanted' NOT NULL,
	`linked_goal_id` integer,
	`date_added` text NOT NULL,
	`date_purchased` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`linked_goal_id`) REFERENCES `savings_goals`(`id`) ON UPDATE no action ON DELETE set null
);
