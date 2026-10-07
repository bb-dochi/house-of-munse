// BG Stats 백업을 D1에 넣는 SQL을 만듭니다.
// 실행: npm run db:import:local  (data-private/ 안의 가장 최근 .json을 읽어 .wrangler/import.sql을 만들고 wrangler가 실행합니다)
//
// 다시 실행해도 안전합니다. 같은 게임은 BG Stats에서 오는 칸(인원·시간·평점·표지·구매 정보·플레이 수)만 새로 고치고,
// 장부에서 고친 이름·상태·카테고리·웨이트와 BGG로 채운 값은 그대로 둡니다.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseBgStats } from './bgstats';
import { insertSql, sqlValue, writeSql } from './sql';

const DIR = 'data-private';
const file =
  process.argv[2] ??
  readdirSync(DIR)
    .filter((f) => f.toLowerCase().endsWith('.json'))
    .map((f) => join(DIR, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
if (!file) throw new Error(`${DIR}/ 폴더에 BG Stats 백업(.json)을 넣어 주세요.`);

const { games, links } = parseBgStats(JSON.parse(readFileSync(file, 'utf8')));

// 선반 번호가 들어온 날 순서를 따르도록 등록 시각을 정합니다 (같은 날이면 이름순).
const ordered = [...games].sort((a, b) => (a.added || '9999').localeCompare(b.added || '9999') || a.title.localeCompare(b.title, 'ko'));
const now = new Date().toISOString();
const keepIfBlank = (col: string) => `${col} = CASE WHEN excluded.${col} = '' THEN games.${col} ELSE excluded.${col} END`;

const sql = ordered.map((g, i) => {
  const created = new Date(Date.parse(g.added || '2026-01-01') + i * 1000).toISOString();
  return insertSql(
    'games',
    {
      id: g.id, title: g.title, english_title: g.english_title, bgg_id: g.bgg_id, bgg_year: g.bgg_year,
      bgstats_id: g.bgstats_id, bgstats_uuid: g.bgstats_uuid, cover_image: g.cover_image, players: g.players,
      play_time: g.play_time, rating: g.rating, is_expansion: g.is_expansion, cooperative: g.cooperative,
      min_age: g.min_age, designers: g.designers, owned: true, disposed: false, status: '보유',
      category: g.cooperative ? '협력' : '', purchase_price: g.purchase_price, purchase_date: g.purchase_date,
      purchase_store: g.purchase_store, play_count: g.play_count, last_played: g.last_played,
      source_data: g.source_data, play_data: g.play_data, created_at: created, updated_at: now,
    },
    `ON CONFLICT(id) DO UPDATE SET english_title = excluded.english_title, bgg_id = COALESCE(excluded.bgg_id, games.bgg_id),
  bgg_year = COALESCE(excluded.bgg_year, games.bgg_year), bgstats_id = excluded.bgstats_id, bgstats_uuid = excluded.bgstats_uuid,
  ${keepIfBlank('cover_image')}, ${keepIfBlank('players')}, ${keepIfBlank('play_time')}, rating = excluded.rating,
  cooperative = excluded.cooperative, min_age = excluded.min_age, designers = excluded.designers,
  purchase_price = COALESCE(excluded.purchase_price, games.purchase_price), ${keepIfBlank('purchase_date')}, ${keepIfBlank('purchase_store')},
  play_count = excluded.play_count, last_played = excluded.last_played, source_data = excluded.source_data,
  play_data = excluded.play_data, updated_at = excluded.updated_at`,
  );
});
// 본판이 먼저 들어간 뒤에 잇습니다. 이미 이어 둔 것(장부나 BGG로 맞춘 것)은 건드리지 않습니다.
for (const [exp, base] of links) sql.push(`UPDATE games SET base_game_id = ${sqlValue(base)} WHERE id = ${sqlValue(exp)} AND base_game_id IS NULL;`);

const out = writeSql('.wrangler/import.sql', sql);
const longest = Math.max(...sql.map((s) => s.length));
console.log(`${file}: 게임 ${games.length}개 (확장 연결 ${links.length}개) → ${out}, 가장 긴 문장 ${Math.round(longest / 1024)}KB`);
