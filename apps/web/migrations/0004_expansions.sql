-- 확장판이 붙는 본판. 공개 화면에서는 본판 카드 안에 확장으로 묶어 보여 주고, 장부에는 따로 한 줄씩 둡니다.
ALTER TABLE `games` ADD `base_game_id` text REFERENCES `games`(`id`) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `idx_games_base_game` ON `games` (`base_game_id`);
