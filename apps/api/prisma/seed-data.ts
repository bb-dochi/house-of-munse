// 예시 데이터. 실제 컬렉션으로 바꾸기 전까지 화면을 채우는 용도입니다.

export interface SeedGame {
  nameKo: string;
  nameEn: string;
  minPlayers: number;
  maxPlayers: number;
  playTime: number;
  weight: number;
  rating: number;
  category: string;
  description: string;
  own: { recommendedPlayers: string; purchasePrice: number | null; sellPrice: number | null; status: string };
}

const g = (
  nameKo: string, nameEn: string, minPlayers: number, maxPlayers: number, playTime: number, weight: number, rating: number, category: string, description: string,
  recommendedPlayers: string, purchasePrice: number | null, sellPrice: number | null, status: string,
): SeedGame => ({ nameKo, nameEn, minPlayers, maxPlayers, playTime, weight, rating, category, description, own: { recommendedPlayers, purchasePrice, sellPrice, status } });

export const GAMES: SeedGame[] = [
  g('카탄', 'Catan', 3, 4, 75, 2.3, 7.1, '가족', '자원을 모으고 맞바꾸며 섬을 개척하는 협상 게임의 고전.', '3–4인', 42000, null, '보유'),
  g('스플렌더', 'Splendor', 2, 4, 30, 1.8, 7.4, '가족', '보석 칩을 모아 카드를 사들이는, 규칙은 쉽고 수싸움은 깊은 게임.', '2–4인', 35000, null, '보유'),
  g('카르카손', 'Carcassonne', 2, 5, 40, 1.9, 7.4, '가족', '타일을 이어 붙여 성과 길, 들판을 넓혀 가는 게임.', '2–5인', 33000, null, '보유'),
  g('티켓 투 라이드', 'Ticket to Ride', 2, 5, 50, 1.8, 7.4, '가족', '기차 카드를 모아 도시와 도시를 잇는 노선 경쟁.', '2–5인', 48000, 30000, '방출 예정'),
  g('코드네임', 'Codenames', 2, 8, 15, 1.3, 7.5, '파티', '한 단어 힌트로 우리 팀 요원을 찾아내는 연상 게임.', '4–8인', 22000, null, '보유'),
  g('딕싯', 'Dixit', 3, 8, 30, 1.2, 7.2, '파티', '몽환적인 그림 카드에 이야기를 붙이고 서로 알아맞힙니다.', '4–6인', 36000, null, '보유'),
  g('저스트 원', 'Just One', 3, 7, 20, 1.0, 7.6, '파티', '겹치지 않는 힌트를 써서 한 사람이 정답을 맞히게 돕습니다.', '4–7인', 24000, null, '보유'),
  g('아줄', 'Azul', 2, 4, 40, 1.8, 7.7, '추상', '타일을 골라 벽을 채우는 아름다운 패턴 맞추기.', '2–4인', 39000, null, '대여 중'),
  g('패치워크', 'Patchwork', 2, 2, 25, 1.6, 7.6, '추상', '천 조각을 이어 퀼트를 완성하는 둘만의 퍼즐 대결.', '2인', 21000, null, '보유'),
  g('팬데믹', 'Pandemic', 2, 4, 45, 2.4, 7.5, '협력', '모두 한 팀이 되어 전 세계로 번지는 전염병을 막아냅니다.', '2–4인', 41000, 25000, '방출 완료'),
  g('글룸헤이븐', 'Gloomhaven', 1, 4, 120, 3.9, 8.6, '협력', '카드로 싸우는 전술 던전 탐험. 캠페인이 길게 이어집니다.', '1–4인', 165000, 120000, '방출 예정'),
  g('스피릿 아일랜드', 'Spirit Island', 1, 4, 110, 4.1, 8.3, '협력', '섬의 정령이 되어 침략자를 몰아내는 묵직한 협력 게임.', '1–3인', 89000, null, '보유'),
  g('윙스팬', 'Wingspan', 1, 5, 60, 2.5, 8.0, '전략', '새를 불러 모아 서식지를 꾸리는 차분한 엔진 빌딩.', '1–5인', 62000, null, '보유'),
  g('테라포밍 마스', 'Terraforming Mars', 1, 5, 120, 3.3, 8.4, '전략', '기업이 되어 화성을 사람이 살 수 있는 별로 바꿔 갑니다.', '1–5인', 58000, null, '보유'),
  g('브라스: 버밍엄', 'Brass: Birmingham', 2, 4, 120, 3.9, 8.6, '전략', '산업혁명기 영국에서 공장과 운송망을 키우는 경제 게임.', '3–4인', 74000, null, '보유'),
  g('아그리콜라', 'Agricola', 1, 4, 100, 3.6, 7.9, '전략', '가족을 먹여 살리며 농장을 일구는 일꾼 놓기의 대표작.', '2–4인', 55000, null, '보유'),
];

export const PLAYS = [
  { playedAt: '2026-10-03', gameNameEn: 'Wingspan', gameName: '윙스팬', players: '문세, 하린, 도윤', winner: '하린', duration: '70분', again: 5, memo: '마지막 라운드에 까마귀 한 장으로 판이 뒤집혔다. 다들 새 이름만 외우고 갔다.' },
  { playedAt: '2026-09-26', gameNameEn: 'Codenames', gameName: '코드네임', players: '문세, 하린, 도윤, 서아, 준, 유나', winner: '파란 팀', duration: '45분 (세 판)', again: 4, memo: '힌트 “바다 3”에 아무도 고래를 고르지 않았다. 아직도 억울하다.' },
  { playedAt: '2026-09-13', gameNameEn: 'Pandemic', gameName: '팬데믹', players: '문세, 서아, 준', winner: '모두 패배', duration: '50분', again: 4, memo: '치료제 세 개까지 만들고 카드가 먼저 떨어졌다. 다음엔 꼭 이긴다.' },
  { playedAt: '2026-08-30', gameNameEn: 'Brass: Birmingham', gameName: '브라스: 버밍엄', players: '문세, 도윤, 준', winner: '도윤', duration: '150분', again: 5, memo: '규칙 설명만 사십 분. 그런데 끝나자마자 한 판 더 하자는 말이 나왔다.' },
  { playedAt: '2026-08-15', gameNameEn: 'Patchwork', gameName: '패치워크', players: '문세, 하린', winner: '문세', duration: '25분', again: 3, memo: '저녁 먹고 가볍게 한 판. 단추 두 개 차이로 이겼다.' },
];

export const WISHES = [
  { priority: 1, nameKo: '아크 노바', nameEn: 'Ark Nova', category: '전략', players: '1–4인', playTime: 120, weight: 3.7, expectedPrice: '예상 7만 원대', status: '곧 주문', reason: '윙스팬 다음 단계로 딱 좋다는 말을 너무 많이 들었다. 동물원을 내 손으로 지어 보고 싶다.' },
  { priority: 2, nameKo: '카스카디아', nameEn: 'Cascadia', category: '가족', players: '1–4인', playTime: 40, weight: 1.8, expectedPrice: '예상 4만 원대', status: '세일 기다리는 중', reason: '처음 온 손님과 바로 펼칠 수 있는 가벼운 타일 게임이 한 자리 더 필요하다.' },
  { priority: 3, nameKo: '듄: 임페리움', nameEn: 'Dune: Imperium', category: '전략', players: '1–4인', playTime: 100, weight: 3.0, expectedPrice: '예상 6만 원대', status: '고민 중', reason: '덱 빌딩과 일꾼 놓기를 한 번에. 선반에 넣을 자리가 있는지부터 봐야 한다.' },
  { priority: 4, nameKo: '스카이 팀', nameEn: 'Sky Team', category: '협력', players: '2인', playTime: 20, weight: 2.0, expectedPrice: '예상 3만 원대', status: '곧 주문', reason: '둘이서 말없이 비행기를 착륙시키는 게임. 둘이 하는 협력 게임이 아직 없다.' },
  { priority: 5, nameKo: '히트', nameEn: 'Heat: Pedal to the Metal', category: '가족', players: '1–6인', playTime: 60, weight: 2.2, expectedPrice: '예상 7만 원대', status: '세일 기다리는 중', reason: '여섯 명이 모여도 다 같이 할 수 있는 레이싱. 사람 많은 날을 위해 한 상자.' },
  { priority: 6, nameKo: '에버델', nameEn: 'Everdell', category: '전략', players: '1–4인', playTime: 80, weight: 2.8, expectedPrice: '예상 6만 원대', status: '고민 중', reason: '테이블에 나무가 서 있는 모습만으로도 갖고 싶다. 솔직히 반은 그림 때문이다.' },
];
