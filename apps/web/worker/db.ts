// D1 읽기·쓰기. ORM 없이 SQL을 직접 씁니다 (house-of-munse2와 같은 방식).
import type { BackupRow, ColumnInfo } from './backup';
import { Columns, GameRow, LedgerGame, PublicGame, toLedger, toPublic } from './rows';

const COLUMNS = `id, title, english_title, bgg_id, cover_image, players, play_time, weight, rating,
  category, description, icon_key, status, purchase_price, sale_price, owned, disposed, is_expansion, base_game_id`;

// 선반 번호는 방출한 게임까지 포함한 등록 순서라, 한 게임을 방출해도 다른 게임 번호가 바뀌지 않습니다.
const NUMBERED = `SELECT ${COLUMNS}, ROW_NUMBER() OVER (ORDER BY created_at, id) AS no FROM games`;
const ON_SHELF = 'owned = 1 AND disposed = 0';

/** 선반에 있는 게임. 본판이 선반에 있는 확장판은 따로 세우지 않고 본판의 expansions로 묶습니다. */
export async function shelf(db: D1Database): Promise<PublicGame[]> {
  const { results } = await db.prepare(`SELECT * FROM (${NUMBERED}) WHERE ${ON_SHELF} ORDER BY no`).all<GameRow>();
  const games = new Map(results.map((r) => [r.id, toPublic(r)]));
  const folded = new Set<string>();
  for (const r of results) {
    const base = r.base_game_id ? games.get(r.base_game_id) : undefined;
    if (!base) continue;
    base.expansions.push({ id: r.id, nameKo: r.title });
    folded.add(r.id);
  }
  return [...games.values()].filter((g) => !folded.has(g.id));
}

export async function shelfGame(db: D1Database, id: string): Promise<PublicGame | null> {
  return (await shelf(db)).find((g) => g.id === id) ?? null;
}

export async function ledger(db: D1Database): Promise<LedgerGame[]> {
  const { results } = await db.prepare(`SELECT * FROM (${NUMBERED}) ORDER BY no`).all<GameRow>();
  return results.map(toLedger);
}

export async function ledgerGame(db: D1Database, id: string): Promise<LedgerGame | null> {
  const row = await db.prepare(`SELECT * FROM (${NUMBERED}) WHERE id = ?`).bind(id).first<GameRow>();
  return row ? toLedger(row) : null;
}

export async function findByBggId(db: D1Database, bggId: number): Promise<string | null> {
  const row = await db.prepare('SELECT id FROM games WHERE bgg_id = ? ORDER BY created_at LIMIT 1').bind(bggId).first<{ id: string }>();
  return row?.id ?? null;
}

/** 새 게임을 넣고 id를 돌려줍니다. 열 이름은 이 파일과 rows.ts가 정한 것만 들어옵니다. */
export async function insertGame(db: D1Database, columns: Columns): Promise<string> {
  const now = new Date().toISOString();
  const row: Columns = {
    id: crypto.randomUUID(),
    title: '',
    english_title: '',
    players: '1–4',
    play_time: '0 min',
    category: '가족',
    status: '보유',
    owned: 1,
    disposed: 0,
    ...columns,
    created_at: now,
    updated_at: now,
  };
  const keys = Object.keys(row);
  await db
    .prepare(`INSERT INTO games (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`)
    .bind(...keys.map((k) => row[k] ?? null))
    .run();
  return String(row.id);
}

/** 바꿀 열만 고칩니다. 그 id의 게임이 없으면 false입니다. */
export async function updateGame(db: D1Database, id: string, columns: Columns): Promise<boolean> {
  const set: Columns = { ...columns, updated_at: new Date().toISOString() };
  const keys = Object.keys(set);
  const { meta } = await db
    .prepare(`UPDATE games SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
    .bind(...keys.map((k) => set[k] ?? null), id)
    .run();
  return meta.changes > 0;
}

export async function deleteGame(db: D1Database, id: string): Promise<boolean> {
  const { meta } = await db.prepare('DELETE FROM games WHERE id = ?').bind(id).run();
  return meta.changes > 0;
}

interface PlayRow {
  id: number;
  played_at: string;
  game_name: string;
  game_name_en: string;
  players: string;
  winner: string;
  duration: string;
  again: number;
  memo: string;
  is_sample: number;
  category: string | null;
  icon_key: string | null;
  cover_image: string | null;
  game_id: string | null;
}

const PLAY_SELECT = `SELECT p.*, g.category, g.icon_key, g.cover_image FROM plays p LEFT JOIN games g ON g.id = p.game_id`;

const toPlay = (p: PlayRow) => ({
  id: p.id,
  playedAt: p.played_at,
  gameName: p.game_name,
  gameNameEn: p.game_name_en,
  players: p.players,
  winner: p.winner,
  duration: p.duration,
  again: p.again,
  memo: p.memo,
  isSample: Boolean(p.is_sample),
  game: p.game_id ? { category: p.category ?? '', iconKey: p.icon_key, imageUrl: p.cover_image || null } : null,
});

export async function plays(db: D1Database) {
  const { results } = await db.prepare(`${PLAY_SELECT} ORDER BY p.played_at DESC, p.id DESC`).all<PlayRow>();
  return results.map(toPlay);
}

export async function play(db: D1Database, id: number) {
  const row = await db.prepare(`${PLAY_SELECT} WHERE p.id = ?`).bind(id).first<PlayRow>();
  return row ? toPlay(row) : null;
}

/** 후기의 게임 이름으로 장부의 게임을 찾아 표지를 잇습니다. 못 찾으면 null입니다. */
export async function findGameByName(db: D1Database, name: string, nameEn = ''): Promise<string | null> {
  const row = await db
    .prepare("SELECT id FROM games WHERE title = ?1 OR (?2 != '' AND english_title = ?2) ORDER BY is_expansion IS 1, created_at LIMIT 1")
    .bind(name, nameEn)
    .first<{ id: string }>();
  return row?.id ?? null;
}

interface WishRow {
  id: number;
  priority: number;
  name_ko: string;
  name_en: string;
  category: string;
  players: string;
  play_time: number;
  weight: number;
  expected_price: string;
  status: string;
  reason: string;
  is_sample: number;
}

const toWish = (w: WishRow) => ({
  id: w.id,
  priority: w.priority,
  nameKo: w.name_ko,
  nameEn: w.name_en,
  category: w.category,
  players: w.players,
  playTime: w.play_time,
  weight: w.weight,
  expectedPrice: w.expected_price,
  status: w.status,
  reason: w.reason,
  isSample: Boolean(w.is_sample),
});

export async function wishes(db: D1Database) {
  const { results } = await db.prepare('SELECT * FROM wishes ORDER BY priority, id').all<WishRow>();
  return results.map(toWish);
}

export async function wish(db: D1Database, id: number) {
  const row = await db.prepare('SELECT * FROM wishes WHERE id = ?').bind(id).first<WishRow>();
  return row ? toWish(row) : null;
}

interface MysteryRow {
  id: number;
  played_at: string;
  title: string;
  players: string;
  play_time: string;
  gm: number;
  rank: string;
  review: string;
  spoiler: string;
}

const toMystery = (m: MysteryRow) => ({
  id: m.id,
  playedAt: m.played_at,
  title: m.title,
  players: m.players,
  playTime: m.play_time,
  gm: Boolean(m.gm),
  rank: m.rank,
  review: m.review,
  spoiler: m.spoiler,
});

export async function mysteries(db: D1Database) {
  const { results } = await db.prepare('SELECT * FROM mysteries ORDER BY played_at DESC, id DESC').all<MysteryRow>();
  return results.map(toMystery);
}

export async function mystery(db: D1Database, id: number) {
  const row = await db.prepare('SELECT * FROM mysteries WHERE id = ?').bind(id).first<MysteryRow>();
  return row ? toMystery(row) : null;
}

// ---------- 후기·위시 쓰기. 열 이름은 entries.ts가 정한 것만 들어옵니다. ----------

export type EntryTable = 'plays' | 'wishes' | 'mysteries';

export async function insertEntry(db: D1Database, table: EntryTable, columns: Columns): Promise<number> {
  const keys = Object.keys(columns);
  const row = await db
    .prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')}) RETURNING id`)
    .bind(...keys.map((k) => columns[k]))
    .first<{ id: number }>();
  return row!.id;
}

export async function updateEntry(db: D1Database, table: EntryTable, id: number, columns: Columns): Promise<boolean> {
  const keys = Object.keys(columns);
  const { meta } = await db
    .prepare(`UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
    .bind(...keys.map((k) => columns[k]), id)
    .run();
  return meta.changes > 0;
}

export async function deleteEntry(db: D1Database, table: EntryTable, id: number): Promise<boolean> {
  const { meta } = await db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
  return meta.changes > 0;
}

// ---------- 백업 ----------

export async function gameColumns(db: D1Database): Promise<ColumnInfo[]> {
  const { results } = await db.prepare('PRAGMA table_info(games)').all<ColumnInfo>();
  return results;
}

/** games 표 전체를 등록 순서대로. 백업이라 공개 화면과 달리 모든 열을 그대로 내보냅니다. */
export async function allGames(db: D1Database): Promise<Record<string, unknown>[]> {
  const { results } = await db.prepare('SELECT * FROM games ORDER BY created_at, id').all<Record<string, unknown>>();
  return results;
}

/**
 * id가 같은 게임은 파일에 있는 열만 덮고, 없는 게임은 새로 넣습니다. 파일에 없는 게임은 지우지 않습니다.
 * 확장판 연결(base_game_id)은 본판이 먼저 들어가야 해서 모든 행을 넣은 뒤 따로 잇습니다.
 * 한 번의 batch라 중간에 실패하면 아무것도 바뀌지 않습니다.
 */
export async function importGames(db: D1Database, rows: BackupRow[]): Promise<{ inserted: number; updated: number }> {
  const { results } = await db.prepare('SELECT id FROM games').all<{ id: string }>();
  const existing = new Set(results.map((r) => r.id));
  const now = new Date().toISOString();
  const stmts: D1PreparedStatement[] = [];
  for (const row of rows) {
    const { base_game_id: _base, ...given } = row;
    const insert: BackupRow = { created_at: now, updated_at: now, ...given };
    const keys = Object.keys(insert);
    // 파일에 등록 시각이 없으면 기존 게임의 등록 시각(=서가 번호)은 그대로 둡니다.
    const update = Object.keys({ updated_at: now, ...given }).filter((k) => k !== 'id');
    stmts.push(
      db
        .prepare(`INSERT INTO games (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')}) ON CONFLICT(id) DO UPDATE SET ${update.map((k) => `${k} = excluded.${k}`).join(', ')}`)
        .bind(...keys.map((k) => insert[k])),
    );
  }
  for (const row of rows) {
    if (!('base_game_id' in row)) continue;
    const base = row.base_game_id;
    // 본판이 장부에 없거나 자기 자신이면 기존 연결을 그대로 둡니다.
    stmts.push(
      db
        .prepare('UPDATE games SET base_game_id = CASE WHEN ?1 IS NULL THEN NULL WHEN ?1 != id AND EXISTS (SELECT 1 FROM games WHERE id = ?1) THEN ?1 ELSE base_game_id END WHERE id = ?2')
        .bind(base, row.id),
    );
  }
  await db.batch(stmts);
  const inserted = rows.filter((r) => !existing.has(String(r.id))).length;
  return { inserted, updated: rows.length - inserted };
}
