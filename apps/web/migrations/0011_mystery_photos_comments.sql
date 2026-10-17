-- 머더미스터리 후기에 붙이는 사진. 표지(covers)처럼 화면에서 줄여 올리고 base64 글자로 D1에 둡니다.
-- covers는 games를 가리키므로 따로 두고, 후기를 지우면 사진도 함께 지워지게 합니다.
CREATE TABLE `mystery_photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mystery_id` integer NOT NULL REFERENCES `mysteries`(`id`) ON DELETE CASCADE,
	`mime` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL
);--> statement-breakpoint
CREATE INDEX `idx_mystery_photos_mystery` ON `mystery_photos` (`mystery_id`);--> statement-breakpoint
-- 방문자 누구나 남기는 댓글. spoiler가 1이면 화면에서 가려 두고 눌러야 보여 줍니다.
CREATE TABLE `mystery_comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mystery_id` integer NOT NULL REFERENCES `mysteries`(`id`) ON DELETE CASCADE,
	`name` text DEFAULT '' NOT NULL,
	`body` text NOT NULL,
	`spoiler` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);--> statement-breakpoint
CREATE INDEX `idx_mystery_comments_mystery` ON `mystery_comments` (`mystery_id`);
