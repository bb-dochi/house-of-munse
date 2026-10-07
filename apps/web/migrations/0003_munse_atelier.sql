-- 0000~0002는 house-of-munse2의 games 테이블을 그대로 옮긴 것입니다.
-- 여기서는 지금 화면에 필요한 열과 후기·위시리스트 테이블만 더합니다.

-- 추천 기분(파티·협력 등)과 박스 색
ALTER TABLE `games` ADD `category` text DEFAULT '' NOT NULL;--> statement-breakpoint
-- 결과 카드 설명
ALTER TABLE `games` ADD `description` text DEFAULT '' NOT NULL;--> statement-breakpoint
-- 직접 그린 픽셀 박스 그림 이름
ALTER TABLE `games` ADD `icon_key` text;--> statement-breakpoint
-- 보유 / 대여 중 / 방출 예정 / 방출 완료. 방출 완료면 disposed도 1로 맞춥니다.
ALTER TABLE `games` ADD `status` text DEFAULT '보유' NOT NULL;--> statement-breakpoint
CREATE TABLE `plays` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`played_at` text NOT NULL,
	`game_id` text REFERENCES `games`(`id`) ON DELETE SET NULL,
	`game_name` text NOT NULL,
	`game_name_en` text DEFAULT '' NOT NULL,
	`players` text NOT NULL,
	`winner` text NOT NULL,
	`duration` text NOT NULL,
	`again` integer NOT NULL,
	`memo` text NOT NULL,
	`is_sample` integer DEFAULT false NOT NULL
);--> statement-breakpoint
CREATE INDEX `idx_plays_played_at` ON `plays` (`played_at`);--> statement-breakpoint
CREATE TABLE `wishes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`priority` integer NOT NULL,
	`name_ko` text NOT NULL,
	`name_en` text NOT NULL,
	`category` text NOT NULL,
	`players` text NOT NULL,
	`play_time` integer NOT NULL,
	`weight` real NOT NULL,
	`expected_price` text NOT NULL,
	`status` text NOT NULL,
	`reason` text NOT NULL,
	`is_sample` integer DEFAULT false NOT NULL
);
