import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeEntities, guessCategory, mapSearch, mapThing } from './map';

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
        statistics: { ratings: { average: { value: '7.53' }, averageweight: { value: '2.4012' } } },
      },
    },
  };
  const g = mapThing(parsed)!;
  assert.equal(g.nameKo, '팬데믹');
  assert.equal(g.nameEn, 'Pandemic');
  assert.equal(g.category, '협력');
  assert.equal(g.weight, 2.4);
  assert.equal(g.rating, 7.5);
  assert.equal(g.minPlayers, 2);
  assert.equal(g.playTime, 45);
  assert.equal(g.description, 'Fight & cure four diseases.');
  assert.equal(mapThing({ items: {} }), null);
});

test('BGG 분류: 메커니즘과 카테고리가 없으면 웨이트로 나눈다', () => {
  assert.equal(guessCategory(['Party Game'], [], 1.2), '파티');
  assert.equal(guessCategory(['Abstract Strategy'], [], 1.8), '추상');
  assert.equal(guessCategory([], [], 3.1), '전략');
  assert.equal(guessCategory([], [], 1.9), '가족');
  assert.equal(decodeEntities('&lt;b&gt; &quot;x&quot;'), '<b> "x"');
});
