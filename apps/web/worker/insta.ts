// 관리자 전용 '인스타 운영' 화면의 내용. 인스타 인사이트(2026-10-16 조회)를 정리한 값이라 직접 고쳐서 배포합니다.
// 공개 화면 묶음에 넣지 않으려고 Worker에 두고 관리자 API로만 내보냅니다.

export type TaskKind = 'reel' | 'card' | 'toon' | 'sponsor' | 'prep' | 'check';

export interface InstaTask {
  /** 체크 표시를 기억하는 키. 한번 정하면 바꾸지 않습니다. */
  id: string;
  /** YYYY-MM-DD */
  date: string;
  kind: TaskKind;
  title: string;
  detail: string;
}

export interface InstaPlan {
  account: string;
  checkedAt: string;
  summary: string;
  kpis: { label: string; value: string; sub: string; down?: boolean }[];
  posts: { name: string; date: string; type: '릴스' | '캐러셀'; views: number; nonFollower: string; likes: number; shares: number; saves: number; profileVisits: number | null; follows: number; top?: boolean }[];
  findings: { title: string; body: string }[];
  goals: { value: string; label: string }[];
  rhythm: { day: string; what: string }[];
  sponsor: { deadline: string; upload: string; points: string[] };
  picks: { date: string; kind: TaskKind; title: string; body: string; points: string[] }[];
  weeks: { title: string; start: string; end: string; goal: string }[];
  tasks: InstaTask[];
  tools: { bio: string; caption: string; reelChecklist: string[]; memo: string };
}

export const INSTA_PLAN: InstaPlan = {
  account: '@meeple.munse',
  checkedAt: '2026-10-16',
  summary:
    '릴스는 팔로워가 아닌 사람에게 잘 퍼지지만 팔로우로 거의 이어지지 않아요. 팔로우를 실제로 만든 건 MPTI 콘텐츠였고, 9월 9일 이후 피드 업로드가 끊기면서 최근 30일 조회수가 90일 평균의 6분의 1로 줄었어요.',
  kpis: [
    { label: '팔로워', value: '554', sub: '팔로잉 557' },
    { label: '조회수 · 90일', value: '17,000', sub: '팔로워 아닌 사람 68.6%' },
    { label: '조회수 · 30일', value: '966', sub: '90일 월평균 대비 −83%', down: true },
    { label: '프로필 방문 · 30일', value: '58', sub: '외부 링크 클릭 1회' },
  ],
  posts: [
    { name: '보드게임콘 후기', date: '7/17', type: '릴스', views: 6290, nonFollower: '95.9%', likes: 91, shares: 37, saves: 3, profileVisits: null, follows: 5 },
    { name: '스피드 뽁뽁 #협찬', date: '7/20', type: '릴스', views: 2059, nonFollower: '87.2%', likes: 38, shares: 9, saves: 6, profileVisits: null, follows: 0 },
    { name: 'MPTI 결과 카드뉴스', date: '8/23', type: '캐러셀', views: 1925, nonFollower: '72.4%', likes: 56, shares: 16, saves: 6, profileVisits: 65, follows: 14, top: true },
    { name: '트랭글러', date: '8/27', type: '릴스', views: 1860, nonFollower: '90.6%', likes: 16, shares: 0, saves: 3, profileVisits: null, follows: 0 },
    { name: '매거진', date: '', type: '캐러셀', views: 1296, nonFollower: '66.3%', likes: 46, shares: 2, saves: 0, profileVisits: 11, follows: 1 },
    { name: '쿼클 #협찬', date: '', type: '릴스', views: 763, nonFollower: '62.7%', likes: 52, shares: 1, saves: 1, profileVisits: null, follows: 0 },
    { name: '포켓몬 코드톡 #협찬', date: '', type: '릴스', views: 667, nonFollower: '77.2%', likes: 40, shares: 1, saves: 1, profileVisits: null, follows: 0 },
    { name: '왕관은 내거야', date: '9/9', type: '릴스', views: 576, nonFollower: '70.5%', likes: 21, shares: 0, saves: 2, profileVisits: null, follows: 0 },
    { name: '하우스케칭', date: '', type: '캐러셀', views: 456, nonFollower: '19.1%', likes: 41, shares: 0, saves: 0, profileVisits: 7, follows: 1 },
    { name: '2025 보드게임 회고', date: '', type: '캐러셀', views: 441, nonFollower: '11.8%', likes: 47, shares: 0, saves: 0, profileVisits: 2, follows: 0 },
    { name: '두근두근 고백 대소동', date: '', type: '캐러셀', views: 399, nonFollower: '21.1%', likes: 18, shares: 0, saves: 0, profileVisits: 8, follows: 1 },
    { name: '5월 기록', date: '', type: '캐러셀', views: 378, nonFollower: '20.1%', likes: 40, shares: 0, saves: 0, profileVisits: 6, follows: 0 },
  ],
  findings: [
    { title: '팔로우는 MPTI 게시물 하나에서 대부분 나왔어요', body: '팔로우 14명, 링크 클릭 37회, 전환율 0.73%. 조회수 1위 보드게임콘 릴스는 0.08%, 게임 리뷰 릴스는 모두 0%였어요.' },
    { title: '릴스는 노출은 되지만 팔로우할 이유를 주지 못해요', body: '트랭글러는 1,604명이 봤는데 좋아요 16개, 팔로우 0명. 게임 하나 소개는 보고 끝나는 정보가 되기 쉬워요.' },
    { title: '조회수는 공유가 만들어요', body: '상위 콘텐츠인 보드게임콘(공유 37)과 MPTI(공유 16)는 친구에게 보내고 싶은 콘텐츠였어요.' },
    { title: '리뷰 게시물은 저장이 거의 0이에요', body: '나중에 다시 볼 이유가 약해요. 목적별 리스트 형식이 필요해요.' },
    { title: '협찬 릴스 3개의 팔로우는 모두 0명이었어요', body: '이번 협찬은 리뷰 대신 상황극·반응 형식으로 만들고, 끝에 팔로우 이유를 넣어요.' },
  ],
  goals: [
    { value: '554 → 620', label: '팔로워 (주 15명 이상)' },
    { value: '966 → 15,000', label: '30일 조회수' },
    { value: '58 → 300', label: '30일 프로필 방문' },
    { value: '0~3 → 10+', label: '캐러셀 1개당 저장' },
  ],
  rhythm: [
    { day: '화 · 릴스', what: '공유형: 상황극, 유형 밈, 현장 반응' },
    { day: '목 · 캐러셀', what: '저장형: 목적별 게임 리스트, MPTI 유형별 추천' },
    { day: '일 · 툰 또는 릴스', what: '인스타툰과 게임 소개 릴스를 격주로' },
    { day: '매일 · 스토리', what: '주 3~4회 투표·유형 질문·오늘 한 게임' },
  ],
  sponsor: {
    deadline: '2026-10-28',
    upload: '2026-10-27',
    points: [
      '형식은 릴스. 리뷰 나열 대신 "이 게임 하면 꼭 생기는 일" 같은 상황극·반응으로 시작해요.',
      '처음 1.5초에 상황을 화면 글자로 던지고, 실제 플레이하는 사람들의 반응을 중심으로 담아요.',
      'MPTI와 묶기: "○○ 유형이 제일 좋아할 게임" 한 줄을 넣으면 일반 협찬 릴스보다 팔로우 이유가 생겨요.',
      '캡션 첫 줄에 #협찬 또는 유료 광고 표시를 넣고, Instagram 유료 파트너십 라벨도 켜요.',
      '기한(10/28)보다 하루 앞선 10/27에 올려서, 협찬사가 수정을 요청해도 대응할 시간을 남겨요.',
      '올리고 24시간 뒤 조회수·공유·저장을 협찬사에 공유하면 다음 협찬 제안에 도움이 돼요.',
    ],
  },
  picks: [
    { date: '10/18 일', kind: 'reel', title: '"이번 달 한 게임 한 줄 평"', body: '갖고 있는 플레이 영상으로 바로 만들 수 있어요. 게임 하나당 2초씩 5~6개.', points: ['첫 화면: "보드게이머가 한 달 동안 한 게임 솔직 평가"', '끝: "궁금한 거 댓글로 → 풀리뷰 올림"'] },
    { date: '10/20 화', kind: 'toon', title: '인스타툰 1화 "보드게임 모임에 꼭 있는 사람"', body: 'MPTI의 타짜·악질·꿀빨러 캐릭터로 실제 모임 썰을 6~8컷.', points: ['1컷: 훅 한 문장', '마지막 컷: "너는 누구야? 친구 태그 / 내 유형은 프로필 링크"'] },
    { date: '10/22 목', kind: 'card', title: '"타짜 유형이 무조건 좋아할 게임 5"', body: 'MPTI 시리즈 첫 편. 해본 블러핑·심리전 게임 5개.', points: ['장마다 게임명 · 인원 · 시간 · 타짜가 좋아하는 이유', '마지막 장: "다음은 악질 유형 편 · 저장해두세요"'] },
  ],
  weeks: [
    { title: '준비', start: '2026-10-17', end: '2026-10-18', goal: '올리기 전에 팔로우로 이어지는 통로부터 정리해요.' },
    { title: '1주차 · 재시동과 협찬 준비', start: '2026-10-19', end: '2026-10-25', goal: '멈췄던 노출을 되살리고, 협찬 릴스를 미리 찍고 편집해 둬요.' },
    { title: '2주차 · 협찬과 할로윈', start: '2026-10-26', end: '2026-11-01', goal: '협찬 릴스를 기한 전에 올리고, 할로윈 검색 수요를 저장형 콘텐츠로 잡아요.' },
    { title: '3주차 · 현장감', start: '2026-11-02', end: '2026-11-08', goal: '가장 잘 퍼진 형식(사람 반응·현장)을 다시 만들어요.' },
    { title: '4주차 · 커플 시즌과 결산', start: '2026-11-09', end: '2026-11-15', goal: '빼빼로데이(11/11) 수요를 잡고 한 달 결과를 정리해요.' },
  ],
  tasks: [
    { id: 'bio', date: '2026-10-17', kind: 'prep', title: '소개글 바꾸기', detail: '"MPTI 만든 사람 · 성향별 보드게임 추천"처럼 정체성이 보이게.' },
    { id: 'pin', date: '2026-10-17', kind: 'prep', title: 'MPTI 게시물과 보드게임콘 릴스 고정', detail: '처음 온 사람이 가장 먼저 보는 두 개예요.' },
    { id: 'mpti-cta', date: '2026-10-18', kind: 'prep', title: 'MPTI 결과 화면에 인스타 팔로우 버튼 넣기', detail: '이번 계획에서 효과가 가장 클 작업이에요.' },
    { id: 'highlight', date: '2026-10-18', kind: 'prep', title: '하이라이트 정리: MPTI · 리뷰 · 행사', detail: '' },
    { id: 'reel-month', date: '2026-10-18', kind: 'reel', title: '"이번 달 한 게임 한 줄 평" 릴스', detail: '갖고 있는 플레이 영상으로 바로 만들어요.' },
    { id: 'shoot', date: '2026-10-18', kind: 'prep', title: '1~2주차 릴스 소재 미리 촬영', detail: '한 번 모임에서 몰아 찍어 두면 업로드가 끊기지 않아요.' },
    { id: 'sp-guide', date: '2026-10-19', kind: 'sponsor', title: '협찬 가이드 확인', detail: '필수 문구·해시태그, 협찬사 검수 여부, 게임 룰을 확인해요.' },
    { id: 'toon-1', date: '2026-10-20', kind: 'toon', title: '인스타툰 1화 "보드게임 모임에 꼭 있는 사람"', detail: '마지막 컷에 친구 태그 + MPTI 링크.' },
    { id: 'sp-shoot', date: '2026-10-21', kind: 'sponsor', title: '협찬 게임 플레이하며 촬영', detail: '3~4명이 2판 이상. 손·표정·비명 같은 반응 위주로 찍어요.' },
    { id: 'card-tazza', date: '2026-10-22', kind: 'card', title: 'MPTI 시리즈 ① "타짜 유형이 좋아할 게임 5"', detail: '마지막 장에 "다음은 악질 유형 편".' },
    { id: 'sp-edit', date: '2026-10-24', kind: 'sponsor', title: '협찬 릴스 편집, 협찬사에 초안 전달', detail: '검수가 있다면 이날 보내야 10/27 업로드에 맞출 수 있어요.' },
    { id: 'reel-game', date: '2026-10-25', kind: 'reel', title: '게임 소개 릴스', detail: '10/18 촬영분 사용. 게임 이름 대신 상황으로 시작.' },
    { id: 'sp-upload', date: '2026-10-27', kind: 'sponsor', title: '협찬 릴스 업로드 (기한 10/28)', detail: '#협찬 표시와 유료 파트너십 라벨. 끝에 팔로우 이유 넣기.' },
    { id: 'sp-report', date: '2026-10-28', kind: 'check', title: '협찬 릴스 24시간 성과를 협찬사에 공유', detail: '조회수·공유·저장·팔로워 아닌 사람 비율.' },
    { id: 'card-halloween', date: '2026-10-29', kind: 'card', title: '"할로윈에 하기 좋은 공포·마피아 게임 5"', detail: '첫 줄과 표지에 "할로윈 보드게임 추천".' },
    { id: 'toon-2', date: '2026-11-01', kind: 'toon', title: '인스타툰 2화 "악질 유형이랑 블러핑 게임 했을 때"', detail: '1화 반응을 보고 매주로 늘릴지 정해요.' },
    { id: 'check-2w', date: '2026-11-01', kind: 'check', title: '2주 점검: 업로드 시간 비교', detail: '밤 9~11시 업로드와 다른 시간대의 조회수 비교.' },
    { id: 'reel-party', date: '2026-11-03', kind: 'reel', title: '"룰 설명 30초 컷, 텐션 최고 파티게임"', detail: '손과 웃음 위주. 공유 유도.' },
    { id: 'card-mpti-2', date: '2026-11-05', kind: 'card', title: 'MPTI 시리즈 ② "악질·꿀빨러 유형을 위한 게임 5"', detail: '"다음 모임 전에 저장"으로 저장 유도.' },
    { id: 'reel-vlog', date: '2026-11-08', kind: 'reel', title: '보드게임 카페·모임 브이로그', detail: '보드게임콘 후기 형식 재현. 여러 게임 짧게 + 한 줄 평.' },
    { id: 'reel-couple', date: '2026-11-10', kind: 'reel', title: '"커플이 하면 싸우는 2인 게임 vs 사이 좋아지는 게임"', detail: '2인 추상전략을 상황극으로.' },
    { id: 'card-2p', date: '2026-11-12', kind: 'card', title: '"커플·2인 보드게임 TOP 5"', detail: '"2인 보드게임 추천"은 꾸준히 검색되는 키워드예요.' },
    { id: 'toon-3', date: '2026-11-15', kind: 'toon', title: '인스타툰 3화 + "댓글로 MPTI 남기면 게임 추천"', detail: '댓글이 다음 달 소재가 돼요.' },
    { id: 'check-month', date: '2026-11-15', kind: 'check', title: '한 달 결산', detail: '목표 대비 팔로워·조회수·저장 기록. 잘된 형식 2개를 다음 달 고정 시리즈로.' },
  ],
  tools: {
    bio: '🎲 보드게이머 성향 테스트 MPTI 만든 사람\n성향별 보드게임 추천 · 솔직 리뷰\n👇 내 MPTI 유형 확인하기',
    caption: '[검색어 첫 줄] 2인 보드게임 추천 | 게임명\n인원 · 시간 · 난이도\n💬 한 줄 평 (누구랑 하면 좋은지)\n📌 저장해두고 다음 모임 때 꺼내보세요\n👾 내 MPTI에 맞는 게임은 프로필 링크에서\n#보드게임 #보드게임추천 #2인보드게임 #게임명',
    reelChecklist: [
      '처음 1.5초 안에 화면 글자로 상황 던지기',
      '길이 15~30초, 룰 설명은 화면 글자로 압축',
      '사람 반응(웃음, 비명, 손)을 꼭 넣기',
      '마지막 2초에 팔로우 이유: "매주 성향별 게임 추천해요"',
      '업로드 후 1시간 안에 댓글 답장',
      '다음 날 앱에서 평균 시청 시간·건너뛰기율 기록',
    ],
    memo: '게임:\n누구랑 (몇 명, 어떤 사람들):\n제일 웃겼던 순간 / 싸운 순간:\n한 줄 평 + 이런 사람한테 추천:',
  },
};
