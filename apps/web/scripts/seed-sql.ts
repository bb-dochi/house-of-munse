// 예시 데이터(seed-data.ts)를 D1에 넣는 SQL로 만듭니다.
// 실행: npm run db:seed:local  (이 파일이 .wrangler/seed.sql을 만들고 wrangler가 실행합니다)
// 고정 id와 INSERT OR IGNORE를 써서 여러 번 실행해도 같은 행이 두 번 들어가지 않습니다.
import { playersColumn, playTimeColumn } from '../worker/rows';
import { GAMES, PLAYS, WISHES } from './seed-data';
import { insertSql as insert, writeSql } from './sql';

const sampleId = (nameEn: string) => 'sample-' + nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const sql = [
  ...GAMES.map((g, i) => {
    // 선반 번호가 예시 목록 순서를 따르도록 등록 시각을 1초씩 늘립니다.
    const at = new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString();
    return insert('games', {
      id: sampleId(g.nameEn),
      title: g.nameKo,
      english_title: g.nameEn,
      players: playersColumn(g.minPlayers, g.maxPlayers),
      play_time: playTimeColumn(g.playTime),
      weight: g.weight,
      rating: g.rating,
      category: g.category,
      description: g.description,
      icon_key: g.nameEn,
      status: g.own.status,
      owned: true,
      disposed: g.own.status === '방출 완료',
      purchase_price: g.own.purchasePrice,
      sale_price: g.own.sellPrice,
      created_at: at,
      updated_at: at,
    });
  }),
  ...PLAYS.map((p, i) =>
    insert('plays', {
      id: i + 1,
      played_at: p.playedAt,
      game_id: GAMES.some((g) => g.nameEn === p.gameNameEn) ? sampleId(p.gameNameEn) : null,
      game_name: p.gameName,
      game_name_en: p.gameNameEn,
      players: p.players,
      winner: p.winner,
      duration: p.duration,
      again: p.again,
      memo: p.memo,
      is_sample: true,
    }),
  ),
  ...WISHES.map((w, i) =>
    insert('wishes', {
      id: i + 1,
      priority: w.priority,
      name_ko: w.nameKo,
      name_en: w.nameEn,
      category: w.category,
      players: w.players,
      play_time: w.playTime,
      weight: w.weight,
      expected_price: w.expectedPrice,
      status: w.status,
      reason: w.reason,
      is_sample: true,
    }),
  ),
];

const out = writeSql(process.argv[2] ?? '.wrangler/seed.sql', sql);
console.log(`게임 ${GAMES.length}개, 후기 ${PLAYS.length}개, 위시 ${WISHES.length}개 → ${out}`);
