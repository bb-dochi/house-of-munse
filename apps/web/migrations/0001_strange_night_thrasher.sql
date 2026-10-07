CREATE INDEX `idx_games_title` ON `games` (`title`);--> statement-breakpoint
CREATE INDEX `idx_games_public_collection` ON `games` (`owned`,`disposed`);--> statement-breakpoint
PRAGMA optimize;
