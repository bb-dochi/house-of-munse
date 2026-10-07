import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlayers, parsePrice, parseWeight, toPatch } from './ledger';

test('장부: 추천 인원 글에서 범위를 읽는다', () => {
  assert.deepEqual(parsePlayers('3–4인'), { min: 3, max: 4 });
  assert.deepEqual(parsePlayers('2인'), { min: 2, max: 2 });
  assert.deepEqual(parsePlayers('4~8명'), { min: 4, max: 8 });
  assert.equal(parsePlayers('모름'), null);
});

test('장부: 가격과 웨이트를 정리한다', () => {
  assert.equal(parsePrice('42,000원'), 42000);
  assert.equal(parsePrice(''), null);
  assert.equal(parsePrice(null), null);
  assert.equal(parseWeight('2,34'), 2.3);
  assert.equal(parseWeight('7'), null);
});

test('장부: 보낸 칸만 바꾸고, 잘못된 값은 메시지로 알려 준다', () => {
  assert.deepEqual(toPatch({ sellPrice: '30000' }), { game: {}, ownership: { sellPrice: 30000 } });
  assert.deepEqual(toPatch({ recommendedPlayers: '2–5인' }), { game: { minPlayers: 2, maxPlayers: 5 }, ownership: { recommendedPlayers: '2–5인' } });
  assert.equal(typeof toPatch({ nameKo: '  ' }), 'string');
  assert.equal(typeof toPatch({ status: '분실' }), 'string');
  assert.equal(typeof toPatch({ weight: 'abc' }), 'string');
});
