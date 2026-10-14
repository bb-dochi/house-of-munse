import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gameLine, kstDay, MAX_QUESTION, readAsk, sseToText, systemPrompt } from './ask';
import type { PublicGame } from './rows';

const game = (over: Partial<PublicGame> = {}): PublicGame => ({
  id: 'g1', no: 1, nameKo: '카탄', nameEn: 'Catan', minPlayers: 3, maxPlayers: 4, bestPlayers: { min: 4, max: 4 },
  playTime: 75, weight: 2.31, rating: 7.1, category: '가족', description: '', imageUrl: null, iconKey: null, onLoan: false, expansions: [], ...over,
});

test('질문: 비었거나 너무 길면 거절한다', () => {
  assert.equal(typeof readAsk({}), 'string');
  assert.equal(typeof readAsk({ question: '   ' }), 'string');
  assert.equal(typeof readAsk({ question: 'a'.repeat(MAX_QUESTION + 1) }), 'string');
});

test('질문: 대화 기록은 최근 6개만, 역할이 틀리면 거절한다', () => {
  const history = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }));
  const ok = readAsk({ question: ' 6명 게임? ', history });
  assert.ok(typeof ok !== 'string');
  assert.equal(ok.question, '6명 게임?');
  assert.equal(ok.history.length, 6);
  assert.equal(ok.history[0].content, 'm4');
  assert.equal(typeof readAsk({ question: 'x', history: [{ role: 'system', content: 'hi' }] }), 'string');
});

test('프롬프트: 게임 한 줄에 인원·베스트·시간·웨이트·확장을 담고 모르는 값은 뺀다', () => {
  assert.equal(gameLine(game()), '- 카탄 (Catan) | 가족 | 3–4인 (베스트 4인) | 75분 | 웨이트 2.3');
  const bare = gameLine(game({ nameEn: '구원컴퍼니', nameKo: '구원컴퍼니', category: '', minPlayers: null, maxPlayers: null, bestPlayers: null, playTime: 0, weight: 0, onLoan: true, expansions: [{ id: 'e', nameKo: '확장 A', onLoan: false }] }));
  assert.equal(bare, '- 구원컴퍼니 | 대여 중 | 확장: 확장 A');
});

test('프롬프트: 가격 정보는 넣지 않는다', () => {
  assert.ok(!/purchase|원\b/.test(systemPrompt([game()]).split('공방 선반')[1]));
});

test('스트림: 두 형식의 SSE 조각에서 글자만 꺼낸다', async () => {
  const enc = new TextEncoder();
  const src = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(enc.encode('data: {"response":"안녕"}\n\ndata: {"choi'));
      c.enqueue(enc.encode('ces":[{"delta":{"content":"하세요"}}]}\n\ndata: [DONE]\n\n'));
      c.close();
    },
  });
  const text = await new Response(src.pipeThrough(sseToText())).text();
  assert.equal(text, '안녕하세요');
});

test('날짜: 한국 시간 자정에 넘어간다', () => {
  assert.equal(kstDay(Date.UTC(2026, 9, 14, 14, 59)), '2026-10-14');
  assert.equal(kstDay(Date.UTC(2026, 9, 14, 15, 0)), '2026-10-15');
});
