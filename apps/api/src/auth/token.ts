import { createHmac, timingSafeEqual } from 'node:crypto';

// 관리자 한 명만 쓰는 사이트라, 외부 라이브러리 없이 서명된 만료 토큰만 씁니다.

const b64 = (s: string) => Buffer.from(s).toString('base64url');
const sign = (body: string, secret: string) => createHmac('sha256', secret).update(body).digest('base64url');

export function issueToken(secret: string, ttlSeconds = 60 * 60 * 12, now = Date.now()): string {
  const body = b64(JSON.stringify({ role: 'admin', exp: Math.floor(now / 1000) + ttlSeconds }));
  return `${body}.${sign(body, secret)}`;
}

export function verifyToken(token: string | undefined, secret: string, now = Date.now()): boolean {
  if (!token || !secret) return false;
  const [body, sig] = token.split('.');
  if (!body || !sig) return false;
  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    return payload.role === 'admin' && typeof payload.exp === 'number' && payload.exp * 1000 > now;
  } catch {
    return false;
  }
}

export function samePassword(given: string, expected: string): boolean {
  const a = Buffer.from(createHmac('sha256', 'pw').update(given).digest('hex'));
  const b = Buffer.from(createHmac('sha256', 'pw').update(expected).digest('hex'));
  return expected.length > 0 && timingSafeEqual(a, b);
}
