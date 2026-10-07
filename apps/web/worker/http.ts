/** 사용자에게 그대로 보여 줄 메시지를 가진 오류. 화면(api.ts)은 body.message를 읽습니다. */
export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

/** 본문이 비었거나 JSON이 아니면 빈 객체로 봅니다. 값 검사는 각 처리기에서 합니다. */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
