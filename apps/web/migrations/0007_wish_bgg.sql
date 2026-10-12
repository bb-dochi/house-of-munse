-- 위시도 BGG에서 찾아 넣습니다. BGG 번호(없으면 0)와 표지 주소를 둡니다.
-- 예상 가격(expected_price)·갖고 싶은 이유(reason)는 화면에서 뺐지만, 지우지 않고 빈 값으로 둡니다.
ALTER TABLE `wishes` ADD `bgg_id` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `wishes` ADD `image_url` text DEFAULT '' NOT NULL;
