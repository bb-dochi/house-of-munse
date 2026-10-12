// BGG XML API2 응답(fast-xml-parser로 파싱한 객체)을 우리 게임 형태로 바꿉니다.
// 파서 옵션: { ignoreAttributes: false, attributeNamePrefix: '' }

const arr = <T>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
const num = (v: unknown, fallback = 0): number => {
  const n = Number(typeof v === 'object' && v !== null ? (v as { value?: unknown }).value : v);
  return Number.isFinite(n) ? n : fallback;
};
const HANGUL = /[가-힣]/;

export interface BggSearchHit {
  bggId: number;
  name: string;
  year: number | null;
}

export function mapSearch(parsed: any): BggSearchHit[] {
  return arr(parsed?.items?.item)
    .map((it: any) => ({ bggId: num(it.id), name: String(arr(it.name)[0]?.value ?? ''), year: it.yearpublished ? num(it.yearpublished) : null }))
    .filter((h) => h.bggId > 0 && h.name);
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * BGG의 유형(subdomain: Strategy·Family·Party·Thematic…), 카테고리, 메커니즘으로 우리 카테고리 하나를 고릅니다.
 * 머더미스터리 → 협력 → 파티 → 전략(Strategy·Thematic·Wargames) → 가족(Family·Children's) 순서로 보고,
 * 유형이 없는 게임(추상 포함)은 웨이트 2.5를 기준으로 전략과 가족으로 나눕니다.
 * 유형 이름은 XML의 순위 이름(strategygames)과 사이트 이름(Strategy Games) 모두 받습니다.
 */
export function guessCategory(categories: string[], mechanics: string[], subdomains: string[], weight: number): string {
  const has = (list: string[], word: string) => list.some((x) => x.toLowerCase().includes(word));
  const party = has(categories, 'party') || has(subdomains, 'party');
  // 늑대인간류처럼 Murder/Mystery가 붙은 파티 게임은 파티로 둡니다.
  if (has(categories, 'murder') && !party) return '머더미스터리';
  if (has(mechanics, 'cooperative')) return '협력';
  if (party) return '파티';
  if (has(subdomains, 'strateg') || has(subdomains, 'themat') || has(subdomains, 'war')) return '전략';
  if (has(subdomains, 'famil') || has(subdomains, 'child')) return '가족';
  return weight >= 2.5 ? '전략' : '가족';
}

export interface BggGame {
  bggId: number;
  nameKo: string;
  nameEn: string;
  minPlayers: number;
  maxPlayers: number;
  playTime: number;
  weight: number;
  rating: number;
  category: string;
  description: string;
  imageUrl: string | null;
  /** BGG 유저 투표의 베스트 인원 ("4", "3–4"). 투표가 없으면 빈 값 */
  bestPlayers: string;
}

/** poll-summary의 "Best with 3–4 players"를 "3–4"로 바꿉니다. */
export function bestPlayersOf(it: any): string {
  const summary = (arr(it['poll-summary']) as any[]).find((p) => p?.name === 'suggested_numplayers');
  const best = (arr(summary?.result) as { name?: string; value?: string }[]).find((r) => r.name === 'bestwith');
  const nums = (String(best?.value ?? '').match(/\d+/g) ?? []).map(Number).filter((n) => n > 0 && n < 100);
  if (!nums.length) return '';
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  return min === max ? `${min}` : `${min}–${max}`;
}

export function mapThing(parsed: any): BggGame | null {
  const it = arr(parsed?.items?.item)[0] as any;
  return it ? mapItem(it) : null;
}

export interface BggThing extends BggGame {
  /** 'boardgame' 또는 'boardgameexpansion' */
  type: string;
  /** 확장판이면 이 확장이 붙는 본판들의 BGG 번호 */
  baseBggIds: number[];
}

/** 여러 게임을 한 번에 물어본 응답(/thing?id=1,2,3)을 읽습니다. */
export function mapThings(parsed: any): BggThing[] {
  return arr(parsed?.items?.item).map((it: any) => ({
    ...mapItem(it),
    type: String(it.type ?? ''),
    baseBggIds: (arr(it.link) as { type?: string; id?: unknown; inbound?: unknown }[])
      .filter((l) => l.type === 'boardgameexpansion' && String(l.inbound) === 'true')
      .map((l) => num(l.id))
      .filter((n) => n > 0),
  }));
}

function mapItem(it: any): BggGame {
  const names = arr(it.name) as { type?: string; value?: string }[];
  const nameEn = String(names.find((n) => n.type === 'primary')?.value ?? names[0]?.value ?? '');
  const nameKo = String(names.find((n) => n.value && HANGUL.test(n.value))?.value ?? nameEn);
  const links = arr(it.link) as { type?: string; value?: string }[];
  const pickLinks = (type: string) => links.filter((l) => l.type === type).map((l) => String(l.value ?? ''));
  const ratings = it.statistics?.ratings ?? {};
  const weight = num(ratings.averageweight);
  const subdomains = (arr(ratings.ranks?.rank) as { type?: string; name?: string }[]).filter((r) => r.type === 'family').map((r) => String(r.name ?? ''));
  const text = decodeEntities(String(it.description ?? '')).replace(/\s+/g, ' ').trim();
  return {
    bggId: num(it.id),
    nameKo,
    nameEn,
    minPlayers: num(it.minplayers, 1),
    maxPlayers: num(it.maxplayers, 1),
    playTime: num(it.playingtime),
    weight,
    rating: Math.round(num(ratings.average) * 10) / 10,
    category: guessCategory(pickLinks('boardgamecategory'), pickLinks('boardgamemechanic'), subdomains, weight),
    description: text.length > 160 ? text.slice(0, 157) + '…' : text,
    imageUrl: it.image ? String(it.image) : null,
    bestPlayers: bestPlayersOf(it),
  };
}
