import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toMysteryColumns, toPlayColumns, toWishColumns } from './entries';

test('후기: 새로 만들 때 빠진 칸은 기본값, 날짜·이름은 꼭 필요하다', () => {
  assert.deepEqual(toPlayColumns({ playedAt: '2026-10-08', gameName: ' 윙스팬 ' }, true), {
    played_at: '2026-10-08', game_name: '윙스팬', game_name_en: '', players: '', winner: '', duration: '', again: 3, memo: '', is_sample: 0,
  });
  assert.match(String(toPlayColumns({ gameName: '윙스팬' }, true)), /날짜/);
  assert.match(String(toPlayColumns({ playedAt: '2026-10-08', gameName: '' }, true)), /게임 이름/);
  assert.match(String(toPlayColumns({ playedAt: '10/08', gameName: 'x' }, true)), /날짜/);
});

test('후기: 고칠 때는 보낸 칸만, 또 할래요는 0~5', () => {
  assert.deepEqual(toPlayColumns({ memo: '다음엔 이긴다' }, false), { memo: '다음엔 이긴다', is_sample: 0 });
  assert.match(String(toPlayColumns({ again: 6 }, false)), /0~5/);
  assert.match(String(toPlayColumns({ again: '' }, false)), /0~5/);
  assert.match(String(toPlayColumns({}, false)), /바꿀 내용/);
});

test('위시: 카테고리·상태·웨이트·순위를 검사한다', () => {
  const w = toWishColumns({ nameKo: '아크 노바', weight: '3.7', playTime: '120', category: '전략', status: '곧 주문', priority: '1' }, true);
  assert.equal(typeof w, 'object');
  assert.equal((w as Record<string, unknown>).weight, 3.7);
  assert.equal((w as Record<string, unknown>).play_time, 120);
  assert.equal((w as Record<string, unknown>).priority, 1);
  assert.match(String(toWishColumns({ category: '보드' }, false)), /카테고리/);
  assert.match(String(toWishColumns({ status: '샀음' }, false)), /상태/);
  assert.match(String(toWishColumns({ weight: '9' }, false)), /웨이트/);
  assert.match(String(toWishColumns({ priority: '0' }, false)), /순위/);
  assert.deepEqual(toWishColumns({ weight: '' }, false), { weight: 0, is_sample: 0 });
});

test('머미 후기: 날짜·이름·랭크는 꼭 필요하고, GM은 있음/없음, 예시 표시는 없다', () => {
  assert.deepEqual(toMysteryColumns({ playedAt: '2026-10-08', title: ' 망자의 저택 ', rank: 'S', gm: true }, true), {
    played_at: '2026-10-08', title: '망자의 저택', players: '', play_time: '', gm: 1, rank: 'S', review: '', spoiler: '',
  });
  assert.match(String(toMysteryColumns({ playedAt: '2026-10-08', title: 'x' }, true)), /추천도/);
  assert.match(String(toMysteryColumns({ rank: 'SS' }, false)), /추천도/);
  assert.match(String(toMysteryColumns({ gm: '모름' }, false)), /GM/);
  assert.deepEqual(toMysteryColumns({ gm: '0', spoiler: '범인은 집사' }, false), { gm: 0, spoiler: '범인은 집사' });
});
