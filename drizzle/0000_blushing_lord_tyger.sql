CREATE TABLE `account` (
	`userId` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`providerAccountId` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	PRIMARY KEY(`provider`, `providerAccountId`),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `authenticator` (
	`credentialID` text NOT NULL,
	`userId` text NOT NULL,
	`providerAccountId` text NOT NULL,
	`credentialPublicKey` text NOT NULL,
	`counter` integer NOT NULL,
	`credentialDeviceType` text NOT NULL,
	`credentialBackedUp` integer NOT NULL,
	`transports` text,
	PRIMARY KEY(`userId`, `credentialID`),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `authenticator_credentialID_unique` ON `authenticator` (`credentialID`);--> statement-breakpoint
CREATE TABLE `content_asset` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`trend_id` text,
	`generation_id` text,
	`kind` text NOT NULL,
	`platform` text NOT NULL,
	`title` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`scheduled_for` integer,
	`used_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trend_id`) REFERENCES `trend`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`generation_id`) REFERENCES `generation`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `asset_workspace_status_idx` ON `content_asset` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `asset_workspace_scheduled_idx` ON `content_asset` (`workspace_id`,`scheduled_for`);--> statement-breakpoint
CREATE TABLE `generation` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`trend_id` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`latency_ms` integer DEFAULT 0 NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trend_id`) REFERENCES `trend`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `generation_workspace_idx` ON `generation` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `session` (
	`sessionToken` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `trend` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`title` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`primary_source` text NOT NULL,
	`evidence` text DEFAULT '[]' NOT NULL,
	`velocity` integer DEFAULT 0 NOT NULL,
	`relevance` integer DEFAULT 0 NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`why` text DEFAULT '' NOT NULL,
	`angles` text DEFAULT '[]' NOT NULL,
	`dedupe_key` text NOT NULL,
	`discovered_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trend_workspace_dedupe_idx` ON `trend` (`workspace_id`,`dedupe_key`);--> statement-breakpoint
CREATE INDEX `trend_workspace_score_idx` ON `trend` (`workspace_id`,`score`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text,
	`emailVerified` integer,
	`image` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verificationToken` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
--> statement-breakpoint
CREATE TABLE `workspace` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`niche` text NOT NULL,
	`keywords` text DEFAULT '[]' NOT NULL,
	`platforms` text DEFAULT '["x","linkedin","shortform"]' NOT NULL,
	`styles` text DEFAULT '["hooks","thread","carousel","script"]' NOT NULL,
	`subreddits` text DEFAULT '[]' NOT NULL,
	`brand_voice` text,
	`last_refreshed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workspace_user_idx` ON `workspace` (`user_id`);