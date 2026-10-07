// BG Stats 백업(JSON)에서 소장 중인 게임을 games 테이블 행으로 바꿉니다.
// house-of-munse2의 bgstats-import.ts와 같은 규칙(id, 인원·시간 모양, 평점 환산)을 따릅니다.

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : {});
const recs = (v: unknown): Rec[] => (Array.isArray(v) ? v.map(rec) : []);
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replaceAll(',', ''));
  return Number.isFinite(n) ? n : null;
};
const meta = (v: unknown): Rec => {
  try {
    return rec(JSON.parse(text(v)));
  } catch {
    return {};
  }
};

/** BG Stats는 모르는 값을 0으로 둡니다. 둘 다 없으면 빈 글자, 같으면 하나만. */
export function range(min: unknown, max: unknown, suffix = ''): string {
  const a = num(min);
  const b = num(max);
  const lo = a !== null && a > 0 ? a : null;
  const hi = b !== null && b > 0 ? b : null;
  if (lo === null && hi === null) return '';
  if (lo === null || hi === null || lo === hi) return `${lo ?? hi}${suffix}`;
  return `${lo}–${hi}${suffix}`;
}

export interface ImportedGame {
  id: string;
  title: string;
  english_title: string;
  bgg_id: number | null;
  bgg_year: number | null;
  bgstats_id: number | null;
  bgstats_uuid: string | null;
  cover_image: string;
  players: string;
  play_time: string;
  rating: number;
  is_expansion: boolean;
  cooperative: boolean;
  min_age: number | null;
  designers: string | null;
  purchase_price: number | null;
  purchase_date: string;
  purchase_store: string;
  play_count: number;
  last_played: string;
  source_data: string;
  play_data: string;
  /** 장부에 들어온 날 (YYYY-MM-DD). 선반 번호 순서를 정합니다. */
  added: string;
}

export interface Imported {
  games: ImportedGame[];
  /** [확장판 id, 본판 id]. 둘 다 소장 중인 것만 */
  links: [string, string][];
}

const ymd = (s: string) => (/^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s.slice(0, 10));

export function parseBgStats(value: unknown): Imported {
  const root = rec(value);
  if (!Array.isArray(root.games) || !Array.isArray(root.plays)) throw new Error('BG Stats 백업 파일이 아닙니다 (games, plays가 없음).');

  const plays = recs(root.plays).filter((p) => p.ignored !== true);
  const playsByGame = new Map<string, Rec[]>();
  const connect = (ref: unknown, p: Rec) => {
    const k = String(ref ?? '');
    if (k) playsByGame.set(k, [...(playsByGame.get(k) ?? []), p]);
  };
  for (const p of plays) {
    connect(p.gameRefId, p);
    for (const e of recs(p.expansionPlays)) connect(e.gameRefId, p);
  }

  const idOf = new Map<string, string>(); // BG Stats 게임 id → 우리 id
  const uuidOf = new Map<string, string>(); // 게임·사본 uuid → 우리 id
  const games: ImportedGame[] = [];
  for (const g of recs(root.games)) {
    const copy = recs(g.copies).find((c) => num(c.statusOwned) === 1);
    if (!copy) continue;
    const title = text(copy.gameName) || text(g.name) || text(g.bggName);
    if (!title) continue;
    const cm = meta(copy.metaData);
    const gm = meta(g.metaData);
    const id = `bgstats:${text(g.uuid) || text(copy.uuid) || String(g.bggId ?? g.id)}`;
    const mine = playsByGame.get(String(g.id)) ?? [];
    const rating = num(cm.Rating) ?? num(g.rating) ?? 0;
    const history = Object.keys(rec(gm.CollectionHistory)).sort();
    games.push({
      id,
      title,
      english_title: text(g.bggName) || text(g.name),
      bgg_id: num(g.bggId) || null,
      bgg_year: num(g.bggYear) || null,
      bgstats_id: num(g.id),
      bgstats_uuid: text(g.uuid) || null,
      cover_image: text(copy.urlImage) || text(g.urlImage) || text(copy.urlThumb) || text(g.urlThumb),
      players: range(g.minPlayerCount, g.maxPlayerCount),
      play_time: range(g.minPlayTime, g.maxPlayTime, ' min'),
      rating: Math.round((rating > 10 ? rating / 10 : rating) * 10) / 10,
      is_expansion: num(g.isExpansion) === 1,
      cooperative: Boolean(g.cooperative),
      min_age: num(g.minAge) || null,
      designers: text(g.designers) || null,
      purchase_price: num(cm.PricePaid),
      purchase_date: text(cm.AcquisitionDate).slice(0, 10),
      purchase_store: text(cm.AcquiredFrom),
      play_count: mine.length,
      last_played: mine.reduce((a, p) => (text(p.playDate).slice(0, 10) > a ? text(p.playDate).slice(0, 10) : a), ''),
      source_data: JSON.stringify(g),
      play_data: JSON.stringify(mine),
      added: text(cm.AcquisitionDate).slice(0, 10) || (history[0] ? ymd(history[0]) : ''),
    });
    idOf.set(String(g.id), id);
    if (text(g.uuid)) uuidOf.set(text(g.uuid), id);
    for (const c of recs(g.copies)) if (text(c.uuid)) uuidOf.set(text(c.uuid), id);
  }

  // 확장판 → 본판 연결. BG Stats의 isExpansion은 틀린 경우가 있어, 아래 근거가 있을 때만 잇습니다.
  // 나중에 BGG로 채우면(bgg-fill) BGG 정보로 다시 맞춥니다.
  const links = new Map<string, string>();
  const link = (exp: string | undefined, base: string | undefined) => {
    if (exp && base && exp !== base && !links.has(exp)) links.set(exp, base);
  };
  // 1) 본판에 직접 붙여 둔 확장 목록
  for (const g of recs(root.games)) {
    for (const u of (meta(g.metaData).GameAddedExpansions as unknown[] | undefined) ?? []) link(uuidOf.get(String(u)), idOf.get(String(g.id)));
  }
  // 2) 함께 플레이한 기록 (본판 판에 확장을 넣은 것)
  for (const p of plays) for (const e of recs(p.expansionPlays)) link(idOf.get(String(e.gameRefId)), idOf.get(String(p.gameRefId)));
  // 3) 확장판 이름이 본판 이름으로 시작 ("알케미스트: 왕의 골렘" → "알케미스트")
  const bases = games.filter((g) => !g.is_expansion);
  for (const e of games.filter((g) => g.is_expansion)) {
    const base = bases.filter((b) => e.title.startsWith(b.title) && /^[\s:：(-]/.test(e.title.slice(b.title.length))).sort((a, b) => b.title.length - a.title.length)[0];
    link(e.id, base?.id);
  }
  return { games, links: [...links] };
}
