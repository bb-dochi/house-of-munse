-- 머더미스터리 후기. 한 번 하면 다시 하지 않는 게임이라 보드게임 후기(plays)와 따로 둡니다.
-- 배역은 그 자체가 스포일러라 적지 않고, 스포일러는 spoiler 칸에만 적어 화면에서 눌러야 보이게 합니다.
CREATE TABLE `mysteries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`played_at` text NOT NULL,
	`title` text NOT NULL,
	`players` text DEFAULT '' NOT NULL,
	`play_time` text DEFAULT '' NOT NULL,
	`gm` integer DEFAULT 0 NOT NULL,
	`rank` text NOT NULL,
	`review` text DEFAULT '' NOT NULL,
	`spoiler` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);--> statement-breakpoint
CREATE INDEX `idx_mysteries_played_at` ON `mysteries` (`played_at`);
