// 게임 목록 필터·정렬과 추천 채점. Worker와 DB에 의존하지 않는 순수 함수라 그대로 테스트합니다.

export interface GameLike {
  /** 선반 번호. 장부에 들어온 순서입니다. */
  no: number;
  nameKo: string;
  nameEn: string;
  /** 인원을 모르면 null. 인원 조건이 있는 검색과 추천에서는 빠집니다. */
  minPlayers: number | null;
  maxPlayers: number | null;
  /** BGG 유저 투표의 베스트 인원. 모르면 null */
  bestPlayers?: { min: number; max: number } | null;
  playTime: number;
  weight: number;
  rating: number;
  category: string;
}

export interface ListQuery {
  q?: string;
  /** 인원 구간: "1-2", "3-4", "5-6", "7+" */
  players?: string;
  category?: string;
  sort?: string;
  /** asc(기본) 또는 desc */
  order?: string;
}

export type TimePref = 'any' | 'short' | 'mid' | 'long';
export type Mood = 'any' | 'light' | 'mid' | 'heavy' | 'party' | 'coop';

export const TIME_PREFS: TimePref[] = ['any', 'short', 'mid', 'long'];
export const MOODS: Mood[] = ['any', 'light', 'mid', 'heavy', 'party', 'coop'];

/** 인원 조건. 6은 "6인 이상"으로 봅니다. */
export function fitsPlayers(g: GameLike, n: number, openEndedFrom = 6): boolean {
  if (g.minPlayers === null || g.maxPlayers === null) return false;
  return n >= openEndedFrom ? g.maxPlayers >= openEndedFrom : g.minPlayers <= n && g.maxPlayers >= n;
}

/** "3-4"나 "7+" 구간 안의 어떤 인원으로든 할 수 있으면 맞는 게임입니다. 인원을 모르는 게임은 빠집니다. */
export function fitsRange(g: GameLike, range: string): boolean {
  const m = range.match(/^(\d+)(?:-(\d+)|\+)$/);
  if (!m) return true;
  if (g.minPlayers === null || g.maxPlayers === null) return false;
  const lo = Number(m[1]);
  const hi = m[2] ? Number(m[2]) : Infinity;
  return g.minPlayers <= hi && g.maxPlayers >= lo;
}

export function filterGames<T extends GameLike>(games: T[], query: ListQuery): T[] {
  const k = (query.q ?? '').trim().toLowerCase();
  const p = query.players && query.players !== 'all' ? query.players : null;
  const c = query.category ?? 'all';
  const list = games.filter(
    (g) =>
      (!k || g.nameKo.toLowerCase().includes(k) || g.nameEn.toLowerCase().includes(k)) &&
      (p === null || fitsRange(g, p)) &&
      (c === 'all' || g.category === c),
  );
  // 모두 오름차순으로 적고, desc면 뒤집습니다. 값이 같으면 등록순으로 둡니다.
  const cmp: Record<string, (a: T, b: T) => number> = {
    no: () => 0,
    name: (a, b) => a.nameKo.localeCompare(b.nameKo, 'ko'),
    rating: (a, b) => a.rating - b.rating,
    weight: (a, b) => a.weight - b.weight,
    time: (a, b) => a.playTime - b.playTime,
  };
  const by = cmp[query.sort ?? 'no'] ?? cmp.no;
  const dir = query.order === 'desc' ? -1 : 1;
  return list.slice().sort((a, b) => dir * (by(a, b) || a.no - b.no));
}

function moodOk(g: GameLike, m: Mood): boolean {
  switch (m) {
    case 'light':
      return g.weight < 2 && g.category === '가족';
    case 'mid':
      return g.weight >= 2 && g.weight < 3;
    case 'heavy':
      return g.weight >= 3;
    case 'party':
      return g.category === '파티';
    case 'coop':
      return g.category === '협력';
    default:
      return false;
  }
}

function timeOk(g: GameLike, t: TimePref): boolean {
  if (t === 'short') return g.playTime <= 30;
  if (t === 'mid') return g.playTime > 30 && g.playTime <= 75;
  if (t === 'long') return g.playTime > 75;
  return false;
}

export interface Recommendation<T> {
  /** 고른 조건을 모두 만족할 때의 점수 */
  full: number;
  /** 모든 조건을 만족하는 게임 수 */
  exact: number;
  candidates: { game: T; score: number }[];
}

/** 모인 인원이 베스트 인원 안에 드는지. openEndedFrom 이상은 "그 이상"으로 봅니다. */
export function isBest(g: GameLike, n: number, openEndedFrom = 5): boolean {
  const b = g.bestPlayers;
  if (!b) return false;
  return n >= openEndedFrom ? b.max >= openEndedFrom : b.min <= n && b.max >= n;
}

/**
 * 인원은 필수 조건, 기분은 2점, 시간은 1점으로 채점합니다.
 * 점수가 같으면 지금 인원이 베스트인 게임을 먼저, 그다음 평점 순으로 둡니다.
 * 딱 맞는 게임이 3개보다 적으면 가까운 게임으로 3개까지 채웁니다.
 * players 5는 "5명 이상"입니다.
 */
export function recommend<T extends GameLike>(games: T[], players: number, time: TimePref, mood: Mood): Recommendation<T> {
  const full = (mood === 'any' ? 0 : 2) + (time === 'any' ? 0 : 1);
  const scored = games
    .filter((g) => fitsPlayers(g, players, 5))
    .map((game) => ({ game, score: (mood !== 'any' && moodOk(game, mood) ? 2 : 0) + (time !== 'any' && timeOk(game, time) ? 1 : 0) }))
    .sort((a, b) => b.score - a.score || Number(isBest(b.game, players)) - Number(isBest(a.game, players)) || b.game.rating - a.game.rating);
  const exact = scored.filter((x) => x.score === full).length;
  return { full, exact, candidates: scored.slice(0, Math.max(3, exact)) };
}
