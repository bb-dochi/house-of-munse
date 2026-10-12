import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterGames, recommend } from './logic';
import { GAMES } from '../scripts/seed-data';

const games = GAMES.map((g, i) => ({ no: i + 1, ...g }));

test('필터: 인원 구간 안의 어떤 인원으로든 할 수 있으면 나온다', () => {
  const names = filterGames(games, { players: '3-4' }).map((g) => g.nameKo);
  assert.ok(!names.includes('패치워크'));
  assert.ok(names.includes('카탄'));
  assert.ok(filterGames(games, { players: '1-2' }).some((g) => g.nameKo === '패치워크'));
});

test('필터: 7+는 7인 이상으로 할 수 있는 게임', () => {
  assert.ok(filterGames(games, { players: '7+' }).every((g) => g.maxPlayers !== null && g.maxPlayers >= 7));
  assert.ok(filterGames(games, { players: '7+' }).length > 0);
});

test('필터: 검색어는 한글명과 영문명 모두에 걸린다', () => {
  assert.equal(filterGames(games, { q: 'wing' })[0].nameKo, '윙스팬');
  assert.equal(filterGames(games, { q: '윙스' })[0].nameEn, 'Wingspan');
});

test('필터: 카테고리, 정렬', () => {
  assert.equal(filterGames(games, { sort: 'weight', order: 'desc' })[0].nameKo, '스피릿 아일랜드');
  assert.ok(filterGames(games, { category: '협력' }).every((g) => g.category === '협력'));
});

test('정렬: 등록순 내림차순은 최근에 넣은 게임이 먼저, 시간 오름차순은 짧은 게임이 먼저', () => {
  assert.deepEqual(filterGames(games, { sort: 'no', order: 'desc' }).map((g) => g.no), games.map((g) => g.no).reverse());
  const byTime = filterGames(games, { sort: 'time' }).map((g) => g.playTime);
  assert.deepEqual(byTime, [...byTime].sort((a, b) => a - b));
});

test('추천: 3명, 한 시간쯤, 적당한 전략이면 윙스팬이 먼저 나온다', () => {
  const r = recommend(games, 3, 'mid', 'mid');
  assert.equal(r.full, 3);
  assert.equal(r.candidates[0].game.nameKo, '윙스팬');
  assert.equal(r.candidates[0].score, 3);
  assert.ok(r.candidates.length >= 3);
});

test('추천: 조건 점수가 같으면 지금 인원이 베스트인 게임이 평점보다 먼저 나온다', () => {
  const base = { nameEn: '', minPlayers: 2, maxPlayers: 5, playTime: 60, weight: 2.5, category: '전략' };
  const list = [
    { ...base, no: 1, nameKo: '평점 높음', rating: 9, bestPlayers: { min: 2, max: 2 } },
    { ...base, no: 2, nameKo: '4인 베스트', rating: 7, bestPlayers: { min: 4, max: 4 } },
    { ...base, no: 3, nameKo: '시간도 맞음', rating: 6, playTime: 30, bestPlayers: null },
  ];
  assert.deepEqual(recommend(list, 4, 'any', 'any').candidates.map((c) => c.game.nameKo), ['4인 베스트', '평점 높음', '시간도 맞음']);
  // 조건을 더 많이 맞춘 게임은 베스트 인원보다 앞선다.
  assert.equal(recommend(list, 4, 'short', 'any').candidates[0].game.nameKo, '시간도 맞음');
  // 5는 "5명 이상"이라 6인 베스트도 맞는다.
  assert.equal(recommend([{ ...list[0], maxPlayers: 8, bestPlayers: { min: 6, max: 6 } }, list[1]], 5, 'any', 'any').candidates[0].game.nameKo, '평점 높음');
});

test('추천: 인원이 맞지 않는 게임은 후보에 없다', () => {
  const r = recommend(games, 5, 'any', 'any');
  assert.ok(r.candidates.every((c) => c.game.maxPlayers >= 5));
});

test('추천: 인원을 모르는 게임은 후보와 인원 검색에서 빠지고, 전체 목록에는 남는다', () => {
  const withUnknown = [...games, { ...games[0], no: 99, nameKo: '인원 미정 게임', minPlayers: null, maxPlayers: null }];
  assert.ok(recommend(withUnknown, 3, 'any', 'any').candidates.every((c) => c.game.nameKo !== '인원 미정 게임'));
  assert.ok(!filterGames(withUnknown, { players: '3-4' }).some((g) => g.nameKo === '인원 미정 게임'));
  assert.ok(filterGames(withUnknown, {}).some((g) => g.nameKo === '인원 미정 게임'));
});

test('추천: 딱 맞는 게임이 없어도 후보 3개는 채운다', () => {
  const r = recommend(games, 2, 'short', 'heavy');
  assert.equal(r.exact, 0);
  assert.equal(r.candidates.length, 3);
});
