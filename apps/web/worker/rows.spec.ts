import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toPatch } from './ledger';
import { GameRow, minutes, toColumns, toLedger, toPublic } from './rows';

const row: GameRow = {
  id: 'bgstats:abc', no: 7, title: '윙스팬', english_title: 'Wingspan', bgg_id: 266192, cover_image: '',
  players: '1–5', play_time: '40–70 min', weight: 2.5, rating: 8, category: '전략', description: '',
  icon_key: null, status: '보유', purchase_price: 62000, sale_price: null, is_expansion: 0, base_game_id: null,
};

test('행 변환: munse2 글자 칸에서 인원·시간 숫자를 읽는다', () => {
  const g = toPublic(row);
  assert.equal(g.minPlayers, 1);
  assert.equal(g.maxPlayers, 5);
  assert.equal(g.playTime, 70);
  assert.equal(g.imageUrl, null);
  assert.equal(minutes(''), 0);
  assert.deepEqual([toPublic({ ...row, players: '' }).minPlayers, toPublic({ ...row, players: '' }).maxPlayers], [null, null]);
});

test('행 변환: 공개 모양에는 가격이 없고, 장부 모양에만 있다', () => {
  assert.ok(!JSON.stringify(toPublic(row)).includes('62000'));
  assert.equal(toLedger(row).ownership.purchasePrice, 62000);
  assert.equal(toLedger(row).ownership.recommendedPlayers, '1–5');
});

test('열 변환: 보낸 칸만 열로 바꾸고 인원·시간은 munse2 모양으로 저장한다', () => {
  const p = toPatch({ recommendedPlayers: '3~4명', playTime: 45 });
  assert.ok(typeof p !== 'string');
  assert.deepEqual(toColumns(p.game, p.ownership), { players: '3–4', play_time: '45 min' });
  const two = toPatch({ recommendedPlayers: '2인' });
  assert.ok(typeof two !== 'string');
  assert.deepEqual(toColumns(two.game, two.ownership), { players: '2' });
});

test('열 변환: 방출 완료면 disposed도 1, 다른 상태면 0이다', () => {
  const done = toPatch({ status: '방출 완료' });
  const lent = toPatch({ status: '대여 중' });
  assert.ok(typeof done !== 'string' && typeof lent !== 'string');
  assert.deepEqual(toColumns(done.game, done.ownership), { status: '방출 완료', disposed: 1 });
  assert.deepEqual(toColumns(lent.game, lent.ownership), { status: '대여 중', disposed: 0 });
});
