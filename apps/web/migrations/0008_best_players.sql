-- BGG 유저 투표의 베스트 인원 ("4", "3–4"). 모르면 빈 값입니다. 상세 창과 솥 추천 순서에 씁니다.
ALTER TABLE `games` ADD `best_players` text DEFAULT '' NOT NULL;
