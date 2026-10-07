import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterGames, recommend } from './logic';
import { GAMES } from '../scripts/seed-data';

const games = GAMES.map((g, i) => ({ no: i + 1, ...g }));

test('필터: 2인 전용 게임은 3인 검색에 나오지 않는다', () => {
  const names = filterGames(games, { players: '3' }).map((g) => g.nameKo);
  assert.ok(!names.includes('패치워크'));
  assert.ok(names.includes('카탄'));
});

test('필터: 6은 6인 이상으로 본다', () => {
  const names = filterGames(games, { players: '6' }).map((g) => g.nameKo).sort();
  assert.deepEqual(names, ['딕싯', '저스트 원', '코드네임']);
});

test('필터: 검색어는 한글명과 영문명 모두에 걸린다', () => {
  assert.equal(filterGames(games, { q: 'wing' })[0].nameKo, '윙스팬');
  assert.equal(filterGames(games, { q: '윙스' })[0].nameEn, 'Wingspan');
});

test('필터: 난이도와 카테고리, 정렬', () => {
  const heavy = filterGames(games, { weight: 'heavy', sort: 'heavy' });
  assert.equal(heavy[0].nameKo, '스피릿 아일랜드');
  assert.ok(heavy.every((g) => g.weight >= 3));
  assert.ok(filterGames(games, { category: '협력' }).every((g) => g.category === '협력'));
});

test('추천: 3명, 한 시간쯤, 적당한 전략이면 윙스팬이 먼저 나온다', () => {
  const r = recommend(games, 3, 'mid', 'mid');
  assert.equal(r.full, 3);
  assert.equal(r.candidates[0].game.nameKo, '윙스팬');
  assert.equal(r.candidates[0].score, 3);
  assert.ok(r.candidates.length >= 3);
});

test('추천: 인원이 맞지 않는 게임은 후보에 없다', () => {
  const r = recommend(games, 5, 'any', 'any');
  assert.ok(r.candidates.every((c) => c.game.maxPlayers >= 5));
});

test('추천: 인원을 모르는 게임은 후보와 인원 검색에서 빠지고, 전체 목록에는 남는다', () => {
  const withUnknown = [...games, { ...games[0], no: 99, nameKo: '인원 미정 게임', minPlayers: null, maxPlayers: null }];
  assert.ok(recommend(withUnknown, 3, 'any', 'any').candidates.every((c) => c.game.nameKo !== '인원 미정 게임'));
  assert.ok(!filterGames(withUnknown, { players: '3' }).some((g) => g.nameKo === '인원 미정 게임'));
  assert.ok(filterGames(withUnknown, {}).some((g) => g.nameKo === '인원 미정 게임'));
});

test('추천: 딱 맞는 게임이 없어도 후보 3개는 채운다', () => {
  const r = recommend(games, 2, 'short', 'heavy');
  assert.equal(r.exact, 0);
  assert.equal(r.candidates.length, 3);
});
