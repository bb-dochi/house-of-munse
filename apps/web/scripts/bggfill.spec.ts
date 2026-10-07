import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { BggThing } from '../worker/map';
import { fillStatements } from './bggfill';

const thing = (o: Partial<BggThing>): BggThing => ({
  bggId: 0, nameKo: '', nameEn: '', minPlayers: 2, maxPlayers: 4, playTime: 60, weight: 2.5, rating: 7.5,
  category: '전략', description: '', imageUrl: null, type: 'boardgame', baseBggIds: [], ...o,
});

test('BGG 채우기: 빈 칸만 채우고, 본판이면 확장 연결을 푼다', () => {
  const [sql] = fillStatements([{ id: 'a', bgg_id: 822 }], [thing({ bggId: 822 })]);
  assert.match(sql, /weight = CASE WHEN weight = 0 THEN 2.5 ELSE weight END/);
  assert.match(sql, /category = CASE WHEN category = '' THEN '전략' ELSE category END/);
  assert.match(sql, /players = CASE WHEN players = '' THEN '2–4' ELSE players END/);
  assert.match(sql, /is_expansion = 0/);
  assert.match(sql, /base_game_id = NULL/);
  assert.match(sql, /WHERE id = 'a';$/);
});

test('BGG 채우기: 확장판은 장부에 있는 본판에 잇고, 없으면 기존 연결을 둔다', () => {
  const rows = [{ id: 'base', bgg_id: 822 }, { id: 'inns', bgg_id: 2591 }, { id: 'lone', bgg_id: 9999 }];
  const [, inns, lone] = fillStatements(rows, [thing({ bggId: 822 }), thing({ bggId: 2591, type: 'boardgameexpansion', baseBggIds: [822] }), thing({ bggId: 9999, type: 'boardgameexpansion', baseBggIds: [1] })]);
  assert.match(inns, /is_expansion = 1, base_game_id = 'base'/);
  assert.doesNotMatch(lone, /base_game_id/);
});

test('BGG 채우기: 모르는 값(0, 빈 값)으로는 덮지 않는다', () => {
  const [sql] = fillStatements([{ id: 'a', bgg_id: 1 }], [thing({ bggId: 1, weight: 0, playTime: 0, minPlayers: 0, imageUrl: null })]);
  assert.doesNotMatch(sql, /weight =|play_time =|players =|cover_image =/);
});
