import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBgStats, range } from './bgstats';

const copy = (uuid: string, gameName: string, owned = 1, metaData = '') => ({ uuid, gameName, statusOwned: owned, metaData });
const backup = {
  games: [
    { id: 1, uuid: 'G1', name: '알케미스트', bggName: 'Alchemists', bggId: 161970, minPlayerCount: 2, maxPlayerCount: 4, minPlayTime: 120, maxPlayTime: 120, isExpansion: 0, rating: 84, copies: [copy('C1', '알케미스트', 1, '{"PricePaid":"55000","Rating":"90"}')], metaData: '{"CollectionHistory":{"20250714":1}}' },
    { id: 2, uuid: 'G2', name: '알케미스트: 왕의 골렘', bggId: 0, minPlayerCount: 0, maxPlayerCount: 0, isExpansion: 1, copies: [copy('C2', '알케미스트: 왕의 골렘')] },
    { id: 3, uuid: 'G3', name: '팔아 버린 게임', copies: [copy('C3', '팔아 버린 게임', 0)] },
    { id: 4, uuid: 'G4', name: '백로성', isExpansion: 0, copies: [copy('C4', '백로성')], metaData: '{"GameAddedExpansions":["C5"]}' },
    { id: 5, uuid: 'G5', name: '말차', isExpansion: 1, copies: [copy('C5', '말차')] },
  ],
  plays: [
    { gameRefId: 1, playDate: '2026-09-01 20:00:00', expansionPlays: [{ gameRefId: 2 }] },
    { gameRefId: 1, playDate: '2026-09-20 20:00:00' },
    { gameRefId: 1, playDate: '2026-09-30 20:00:00', ignored: true },
  ],
};

test('BG Stats: 소장 중인 게임만, munse2와 같은 모양으로 읽는다', () => {
  const { games } = parseBgStats(backup);
  assert.deepEqual(games.map((g) => g.title), ['알케미스트', '알케미스트: 왕의 골렘', '백로성', '말차']);
  const a = games[0];
  assert.equal(a.id, 'bgstats:G1');
  assert.equal(a.players, '2–4');
  assert.equal(a.play_time, '120 min');
  assert.equal(a.rating, 9);
  assert.equal(a.purchase_price, 55000);
  assert.equal(a.play_count, 2);
  assert.equal(a.last_played, '2026-09-20');
  assert.equal(a.added, '2025-07-14');
  assert.equal(games[1].players, '');
  assert.equal(games[1].bgg_id, null);
});

test('BG Stats: 확장판은 직접 붙인 목록, 함께 한 판, 이름으로 본판에 잇는다', () => {
  const { links } = parseBgStats(backup);
  assert.deepEqual(new Map(links), new Map([['bgstats:G5', 'bgstats:G4'], ['bgstats:G2', 'bgstats:G1']]));
});

test('BG Stats: 0은 모르는 값으로 본다', () => {
  assert.equal(range(0, 0), '');
  assert.equal(range(2, 0), '2');
  assert.equal(range(30, 60, ' min'), '30–60 min');
  assert.throws(() => parseBgStats({ games: [] }));
});
