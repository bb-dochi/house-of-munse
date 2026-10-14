-- 문세에게 직접 남기는 질문. token은 질문한 사람이 답을 확인하는 링크의 열쇠입니다.
-- allow_public은 질문한 사람이 공개를 허락했는지, published는 문세가 공개 Q&A에 올렸는지입니다.
CREATE TABLE `questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`body` text NOT NULL,
	`answer` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`allow_public` integer DEFAULT false NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`answered_at` text DEFAULT '' NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_questions_token` ON `questions` (`token`);
