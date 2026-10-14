-- 공방지기 질문 횟수. bucket은 'all'(하루 전체) 또는 'ip:<해시>'(방문자별)입니다. IP 원문은 저장하지 않습니다.
CREATE TABLE `ask_usage` (
	`day` text NOT NULL,
	`bucket` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY (`day`, `bucket`)
);
