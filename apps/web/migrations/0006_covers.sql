-- 장부에서 직접 올린 표지. BGG에 없는 게임(머더미스터리 등)에 씁니다.
-- R2 없이 D1에 두므로 화면에서 작게 줄여 올리고, base64 글자로 저장합니다. games.cover_image가 /api/covers/:id?v=… 로 가리킵니다.
CREATE TABLE `covers` (
	`game_id` text PRIMARY KEY NOT NULL REFERENCES `games`(`id`) ON DELETE CASCADE,
	`mime` text NOT NULL,
	`data` text NOT NULL,
	`updated_at` text NOT NULL
);
