import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeEntities, guessCategory, mapSearch, mapThing, mapThings } from './map';

test('BGG 검색 결과: 결과가 하나일 때(배열이 아닐 때)도 읽는다', () => {
  const one = { items: { item: { id: '13', name: { type: 'primary', value: 'Catan' }, yearpublished: { value: '1995' } } } };
  assert.deepEqual(mapSearch(one), [{ bggId: 13, name: 'Catan', year: 1995 }]);
  assert.deepEqual(mapSearch({ items: {} }), []);
});

test('BGG 상세: 한글 이름이 있으면 한글명으로, 협력 메커니즘이면 협력으로 분류한다', () => {
  const parsed = {
    items: {
      item: {
        id: '30549',
        name: [{ type: 'primary', value: 'Pandemic' }, { type: 'alternate', value: '팬데믹' }],
        description: 'Fight &amp; cure&#10;four diseases.',
        image: 'https://example.test/p.jpg',
        minplayers: { value: '2' },
        maxplayers: { value: '4' },
        playingtime: { value: '45' },
        link: [{ type: 'boardgamecategory', value: 'Medical' }, { type: 'boardgamemechanic', value: 'Cooperative Game' }],
        'poll-summary': { name: 'suggested_numplayers', result: [{ name: 'bestwith', value: 'Best with 3–4 players' }, { name: 'recommmendedwith', value: 'Recommended with 2–4 players' }] },
        statistics: { ratings: { average: { value: '7.53' }, averageweight: { value: '2.4012' }, ranks: { rank: [{ type: 'subtype', name: 'boardgame' }, { type: 'family', name: 'strategygames' }] } } },
      },
    },
  };
  const g = mapThing(parsed)!;
  assert.equal(g.nameKo, '팬데믹');
  assert.equal(g.nameEn, 'Pandemic');
  assert.equal(g.category, '협력');
  assert.equal(g.weight, 2.4012);
  assert.equal(g.bestPlayers, '3–4');
  assert.equal(g.rating, 7.5);
  assert.equal(g.minPlayers, 2);
  assert.equal(g.playTime, 45);
  assert.equal(g.description, 'Fight & cure four diseases.');
  assert.equal(mapThing({ items: {} }), null);
});

test('BGG 분류: 머더미스터리 → 협력 → 파티 → 유형 순서로 보고, 유형이 없으면 웨이트로 나눈다', () => {
  assert.equal(guessCategory(['Murder / Mystery', 'Deduction'], [], [], 2), '머더미스터리');
  assert.equal(guessCategory(['Murder / Mystery', 'Party Game'], [], [], 1.5), '파티');
  assert.equal(guessCategory(['Medical'], ['Cooperative Game'], ['strategygames'], 3), '협력');
  assert.equal(guessCategory(['Party Game'], [], [], 1.2), '파티');
  assert.equal(guessCategory([], [], ['Party Games'], 1.2), '파티');
  assert.equal(guessCategory([], [], ['thematic'], 1.9), '전략');
  assert.equal(guessCategory([], [], ['familygames'], 2.7), '가족');
  assert.equal(guessCategory(['Abstract Strategy'], [], ['abstracts'], 1.8), '가족');
  assert.equal(guessCategory([], [], [], 3.1), '전략');
  assert.equal(guessCategory([], [], [], 1.9), '가족');
  assert.equal(decodeEntities('&lt;b&gt; &quot;x&quot;'), '<b> "x"');
});

test('BGG 여러 게임: 종류와 본판 번호(inbound 확장 링크)를 읽는다', () => {
  const parsed = {
    items: {
      item: [
        { type: 'boardgame', id: '822', name: { type: 'primary', value: 'Carcassonne' }, link: [{ type: 'boardgameexpansion', id: '2591', inbound: undefined }], statistics: { ratings: { averageweight: { value: '1.9' } } } },
        { type: 'boardgameexpansion', id: '2591', name: { type: 'primary', value: 'Carcassonne: Inns' }, link: [{ type: 'boardgameexpansion', id: '822', inbound: 'true' }] },
      ],
    },
  };
  const [base, exp] = mapThings(parsed);
  assert.deepEqual([base.type, base.baseBggIds, base.weight, base.bestPlayers], ['boardgame', [], 1.9, '']);
  assert.deepEqual([exp.type, exp.baseBggIds], ['boardgameexpansion', [822]]);
  assert.deepEqual(mapThings({ items: {} }), []);
});
