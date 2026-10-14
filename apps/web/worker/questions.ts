// 문세에게 직접 묻기. 입력 검사와 디스코드 메시지는 순수 함수라 questions.spec.ts에서 테스트합니다.

export const QUESTION_STATUSES = ['new', 'answered', 'hidden'] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];
export const MAX_NAME = 30;
export const MAX_BODY = 500;
export const MAX_ANSWER = 2000;
/** 방문자 한 명이 하루에 남길 수 있는 질문 수 */
export const QUESTIONS_PER_IP = 5;

export interface QuestionRow {
  id: number;
  token: string;
  name: string;
  body: string;
  answer: string;
  status: string;
  allow_public: number;
  published: number;
  created_at: string;
  answered_at: string;
}

/** 질문한 사람이 링크로 보는 모양. 다른 질문의 정보는 담지 않습니다. */
export const toMine = (r: QuestionRow) => ({
  name: r.name,
  body: r.body,
  answer: r.status === 'answered' ? r.answer : '',
  answered: r.status === 'answered',
  createdAt: r.created_at,
  answeredAt: r.answered_at,
});

/** 공개 Q&A. 이름은 앞 글자만 남깁니다. */
export const toPublic = (r: QuestionRow) => ({ id: r.id, name: maskName(r.name), body: r.body, answer: r.answer, answeredAt: r.answered_at });

export const toAdmin = (r: QuestionRow) => ({
  id: r.id,
  name: r.name,
  body: r.body,
  answer: r.answer,
  status: r.status as QuestionStatus,
  allowPublic: r.allow_public === 1,
  published: r.published === 1,
  createdAt: r.created_at,
  answeredAt: r.answered_at,
});

export function maskName(name: string): string {
  const n = [...name.trim()];
  if (!n.length) return '익명';
  return n.length === 1 ? n[0] : n[0] + '*'.repeat(Math.min(n.length - 1, 3));
}

/** {name, body, allowPublic, website}. website는 사람 눈에 안 보이는 칸이라 채워져 있으면 봇으로 봅니다. */
export function readQuestion(body: Record<string, unknown>): { name: string; body: string; allowPublic: boolean; bot: boolean } | string {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!text) return '질문을 적어 주세요.';
  if (text.length > MAX_BODY) return `질문은 ${MAX_BODY}자까지 적을 수 있어요.`;
  if (name.length > MAX_NAME) return `이름은 ${MAX_NAME}자까지 적을 수 있어요.`;
  return { name, body: text, allowPublic: body.allowPublic === true, bot: typeof body.website === 'string' && body.website.trim() !== '' };
}

/** 관리자의 답변 수정. 바꿀 칸만 돌려줍니다. 공개는 질문한 사람이 허락했을 때만 켤 수 있습니다. */
export function readAnswer(body: Record<string, unknown>, row: Pick<QuestionRow, 'allow_public' | 'answer' | 'status'>): Record<string, string | number> | string {
  const out: Record<string, string | number> = {};
  if ('answer' in body) {
    if (typeof body.answer !== 'string') return '답변 형식이 맞지 않습니다.';
    const a = body.answer.trim();
    if (a.length > MAX_ANSWER) return `답변은 ${MAX_ANSWER}자까지 적을 수 있어요.`;
    out.answer = a;
  }
  if ('status' in body) {
    if (!QUESTION_STATUSES.includes(body.status as QuestionStatus)) return '상태 값이 맞지 않습니다.';
    out.status = body.status as string;
  }
  // 답을 적으면 상태를 따로 고르지 않아도 답변 완료로 바꿉니다.
  if (typeof out.answer === 'string' && out.answer && !('status' in out) && row.status === 'new') out.status = 'answered';
  if ('published' in body) {
    if (typeof body.published !== 'boolean') return '공개 값이 맞지 않습니다.';
    if (body.published && row.allow_public !== 1) return '질문한 분이 공개를 허락하지 않은 질문입니다.';
    out.published = body.published ? 1 : 0;
  }
  const status = out.status ?? row.status;
  const answer = typeof out.answer === 'string' ? out.answer : row.answer;
  if (status === 'answered' && !answer) return '답변을 적어야 답변 완료로 바꿀 수 있어요.';
  if (status !== 'answered' && out.published === 1) return '답변을 마친 질문만 공개할 수 있어요.';
  if (status !== 'answered' && !('published' in out)) out.published = 0;
  return out;
}

/** 디스코드 웹후크 본문. 멘션(@everyone 등)은 막습니다. */
export function discordMessage(q: { name: string; body: string; allowPublic: boolean }, adminUrl: string) {
  const quote = q.body.split('\n').map((l) => '> ' + l).join('\n');
  return {
    username: 'HOUSE OF MUNSE',
    content: `📮 **새 질문** — ${q.name || '익명'}${q.allowPublic ? ' (공개 허락)' : ''}\n${quote}\n${adminUrl}`.slice(0, 1900),
    allowed_mentions: { parse: [] as string[] },
  };
}
