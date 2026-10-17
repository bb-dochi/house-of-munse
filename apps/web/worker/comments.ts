// 머더미스터리 후기 댓글. 로그인 없이 누구나 남기므로 입력 검사는 순수 함수로 두고 comments.spec.ts에서 테스트합니다.

export const MAX_COMMENT_NAME = 20;
export const MAX_COMMENT_BODY = 500;
/** 방문자 한 명이 하루에 남길 수 있는 댓글 수 */
export const COMMENTS_PER_IP = 20;
/** 후기 하나에 붙일 수 있는 사진 수. D1에 그대로 두므로 넉넉하지 않게 둡니다. */
export const MAX_PHOTOS = 6;

export interface CommentRow {
  id: number;
  mystery_id: number;
  name: string;
  body: string;
  spoiler: number;
  created_at: string;
}

export const toComment = (r: CommentRow) => ({ id: r.id, name: r.name || '익명', body: r.body, spoiler: r.spoiler === 1, createdAt: r.created_at });

/** {name, body, spoiler, website}. website는 사람 눈에 안 보이는 칸이라 채워져 있으면 봇으로 봅니다. */
export function readComment(body: Record<string, unknown>): { name: string; body: string; spoiler: boolean; bot: boolean } | string {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  // 줄바꿈은 두 줄까지만 남겨 빈 줄로 화면을 길게 늘이지 못하게 합니다.
  const text = typeof body.body === 'string' ? body.body.trim().replace(/\n{3,}/g, '\n\n') : '';
  if (!text) return '댓글을 적어 주세요.';
  if ([...text].length > MAX_COMMENT_BODY) return `댓글은 ${MAX_COMMENT_BODY}자까지 적을 수 있어요.`;
  if ([...name].length > MAX_COMMENT_NAME) return `이름은 ${MAX_COMMENT_NAME}자까지 적을 수 있어요.`;
  if (body.spoiler !== undefined && typeof body.spoiler !== 'boolean') return '스포일러 여부 값이 맞지 않습니다.';
  return { name, body: text, spoiler: body.spoiler === true, bot: typeof body.website === 'string' && body.website.trim() !== '' };
}
