import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_COMMENT_BODY, MAX_COMMENT_NAME, readComment, toComment } from './comments';

test('댓글: 비었거나 너무 길면 거절한다', () => {
  assert.equal(typeof readComment({ body: '   ' }), 'string');
  assert.equal(typeof readComment({}), 'string');
  assert.equal(typeof readComment({ body: 'a'.repeat(MAX_COMMENT_BODY + 1) }), 'string');
  assert.equal(typeof readComment({ body: 'ok', name: '가'.repeat(MAX_COMMENT_NAME + 1) }), 'string');
  assert.equal(typeof readComment({ body: 'ok', spoiler: 'yes' }), 'string');
});

test('댓글: 앞뒤 공백과 긴 빈 줄을 정리하고 스포일러 여부를 읽는다', () => {
  assert.deepEqual(readComment({ name: ' 하린 ', body: ' 재밌었어요\n\n\n\n범인 몰랐음 ', spoiler: true }), { name: '하린', body: '재밌었어요\n\n범인 몰랐음', spoiler: true, bot: false });
  assert.deepEqual(readComment({ body: '좋아요' }), { name: '', body: '좋아요', spoiler: false, bot: false });
});

test('댓글: 숨은 칸이 채워지면 봇으로 본다', () => {
  const r = readComment({ body: 'hi', website: 'http://spam' });
  assert.ok(typeof r !== 'string' && r.bot);
});

test('댓글 모양: 이름이 비면 익명으로 보인다', () => {
  assert.deepEqual(toComment({ id: 1, mystery_id: 2, name: '', body: 'b', spoiler: 1, created_at: 't' }), { id: 1, name: '익명', body: 'b', spoiler: true, createdAt: 't' });
});
