import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issueToken, samePassword, verifyToken } from './token';

test('토큰: 발급한 토큰은 같은 비밀값으로만 통과한다', () => {
  const t = issueToken('secret-a');
  assert.equal(verifyToken(t, 'secret-a'), true);
  assert.equal(verifyToken(t, 'secret-b'), false);
});

test('토큰: 만료되거나 변조되면 거부한다', () => {
  const t = issueToken('s', 10, 0);
  assert.equal(verifyToken(t, 's', 5_000), true);
  assert.equal(verifyToken(t, 's', 11_000), false);
  const forged = Buffer.from(JSON.stringify({ role: 'admin', exp: 9999999999 })).toString('base64url') + '.' + t.split('.')[1];
  assert.equal(verifyToken(forged, 's', 5_000), false);
  assert.equal(verifyToken(undefined, 's'), false);
  assert.equal(verifyToken('garbage', 's'), false);
});

test('비밀번호: 빈 설정값은 항상 거부한다', () => {
  assert.equal(samePassword('', ''), false);
  assert.equal(samePassword('abc', 'abc'), true);
  assert.equal(samePassword('abc', 'abd'), false);
});
