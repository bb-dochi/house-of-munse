import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ColumnInfo, normalizeRows, parseCsv, readBackup, toCsv } from './backup';

const col = (name: string, type: string, notnull = 0): ColumnInfo => ({ name, type, notnull, dflt_value: null });
const COLUMNS = [col('id', 'TEXT', 1), col('title', 'TEXT', 1), col('weight', 'REAL', 1), col('bgg_id', 'INTEGER'), col('owned', 'INTEGER', 1), col('base_game_id', 'TEXT'), col('description', 'TEXT', 1)];

test('백업 CSV: 쉼표·따옴표·줄바꿈·한글이 그대로 돌아온다', () => {
  const rows = [{ id: 'a', title: '알케미스트, "연금술"', weight: 3.5, bgg_id: null, description: '첫 줄\n둘째 줄' }];
  const csv = toCsv(rows, ['id', 'title', 'weight', 'bgg_id', 'description']);
  assert.ok(csv.startsWith('﻿'));
  assert.deepEqual(parseCsv(csv), [{ id: 'a', title: '알케미스트, "연금술"', weight: '3.5', bgg_id: '', description: '첫 줄\n둘째 줄' }]);
});

test('백업 읽기: 글자로 온 숫자를 맞추고, 모르는 열은 건너뛴다', () => {
  const { rows, ignored } = normalizeRows(parseCsv('id,title,weight,bgg_id,owned,base_game_id,memo\r\na,카탄,2.3,,true,,메모\r\n'), COLUMNS);
  assert.deepEqual(rows, [{ id: 'a', title: '카탄', weight: 2.3, bgg_id: null, owned: 1, base_game_id: null }]);
  assert.deepEqual(ignored, ['memo']);
});

test('백업 읽기: 내보낸 JSON과 배열 둘 다 받는다', () => {
  assert.equal(readBackup(JSON.stringify({ exportedAt: 'x', games: [{ id: 'a' }] }), 'json').length, 1);
  assert.equal(readBackup('[{"id":"a"},{"id":"b"}]', 'json').length, 2);
  assert.throws(() => readBackup('{"items":[]}', 'json'), /games/);
  assert.throws(() => readBackup('{', 'json'), /JSON/);
});

test('백업 읽기: id·이름 없음, 중복 id, 숫자 아님, 빈 필수 숫자를 막는다', () => {
  assert.throws(() => normalizeRows([{ title: '카탄' }], COLUMNS), /id가 없습니다/);
  assert.throws(() => normalizeRows([{ id: 'a', title: '' }], COLUMNS), /title/);
  assert.throws(() => normalizeRows([{ id: 'a', title: 'x' }, { id: 'a', title: 'y' }], COLUMNS), /두 번/);
  assert.throws(() => normalizeRows([{ id: 'a', title: 'x', weight: '무거움' }], COLUMNS), /숫자가 아닙니다/);
  assert.throws(() => normalizeRows([{ id: 'a', title: 'x', weight: '' }], COLUMNS), /비어 있습니다/);
  assert.throws(() => normalizeRows([], COLUMNS), /게임이 없습니다/);
  assert.throws(() => parseCsv('id,title\r\n"a,b'), /따옴표/);
});
