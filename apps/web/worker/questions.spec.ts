import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discordMessage, maskName, MAX_BODY, readAnswer, readQuestion } from './questions';

test('질문: 비었거나 너무 길면 거절하고, 숨은 칸이 채워지면 봇으로 본다', () => {
  assert.equal(typeof readQuestion({ body: '  ' }), 'string');
  assert.equal(typeof readQuestion({ body: 'a'.repeat(MAX_BODY + 1) }), 'string');
  const ok = readQuestion({ name: ' 하린 ', body: ' 스카이 팀 빌릴 수 있어요? ', allowPublic: true });
  assert.deepEqual(ok, { name: '하린', body: '스카이 팀 빌릴 수 있어요?', allowPublic: true, bot: false });
  const bot = readQuestion({ body: 'hi', website: 'http://spam' });
  assert.ok(typeof bot !== 'string' && bot.bot);
});

test('이름 가리기: 첫 글자만 남긴다', () => {
  assert.equal(maskName(''), '익명');
  assert.equal(maskName('준'), '준');
  assert.equal(maskName('하린'), '하*');
  assert.equal(maskName('김문세입니다'), '김***');
});

test('답변: 답을 적으면 답변 완료가 되고, 공개는 허락받은 질문만 된다', () => {
  const row = { allow_public: 0, answer: '', status: 'new' };
  assert.deepEqual(readAnswer({ answer: ' 네 빌려드려요 ' }, row), { answer: '네 빌려드려요', status: 'answered' });
  assert.equal(typeof readAnswer({ published: true }, { ...row, status: 'answered', answer: 'x' }), 'string');
  assert.deepEqual(readAnswer({ published: true }, { allow_public: 1, status: 'answered', answer: 'x' }), { published: 1 });
});

test('답변: 답 없이 답변 완료로 바꿀 수 없고, 숨기면 공개도 내린다', () => {
  assert.equal(typeof readAnswer({ status: 'answered' }, { allow_public: 0, answer: '', status: 'new' }), 'string');
  assert.deepEqual(readAnswer({ status: 'hidden' }, { allow_public: 1, answer: 'x', status: 'answered' }), { status: 'hidden', published: 0 });
});

test('디스코드: 멘션을 막고 질문을 인용으로 넣는다', () => {
  const m = discordMessage({ name: '', body: '@everyone\n둘째 줄', allowPublic: false }, 'https://x/admin');
  assert.deepEqual(m.allowed_mentions, { parse: [] });
  assert.ok(m.content.includes('익명'));
  assert.ok(m.content.includes('> @everyone\n> 둘째 줄'));
});
