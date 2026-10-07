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

export function guessCategory(categories: string[], mechanics: string[], weight: number): string {
  const has = (list: string[], word: string) => list.some((x) => x.toLowerCase().includes(word));
  if (has(mechanics, 'cooperative')) return '협력';
  if (has(categories, 'party')) return '파티';
  if (has(categories, 'abstract')) return '추상';
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
  const weight = Math.round(num(ratings.averageweight) * 10) / 10;
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
    category: guessCategory(pickLinks('boardgamecategory'), pickLinks('boardgamemechanic'), weight),
    description: text.length > 160 ? text.slice(0, 157) + '…' : text,
    imageUrl: it.image ? String(it.image) : null,
  };
}
