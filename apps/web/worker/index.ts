// /api/* 요청을 처리하는 Worker. 화면 파일은 Cloudflare 정적 자산이 바로 내려 줍니다 (wrangler.jsonc의 assets).
import { ASK_MODEL, AskMessage, DAILY_LIMIT, kstDay, PER_IP_LIMIT, readAsk, sseToText, systemPrompt } from './ask';
import { Format, normalizeRows, readBackup, toCsv } from './backup';
import { fetchBggGame, searchBgg } from './bgg';
import * as db from './db';
import { HttpError, json, readJson } from './http';
import { toMysteryColumns, toPlayColumns, toWishColumns } from './entries';
import { LedgerInput, toPatch } from './ledger';
import { filterGames, Mood, MOODS, recommend, TimePref, TIME_PREFS } from './logic';
import { discordMessage, QUESTIONS_PER_IP, readAnswer, readQuestion, toAdmin, toMine, toPublic } from './questions';
import { bggColumns, toColumns } from './rows';
import { issueToken, samePassword, verifyToken } from './token';

export interface Env {
  DB: D1Database;
  AI: Ai;
  ASSETS: Fetcher;
  ADMIN_PASSWORD?: string;
  TOKEN_SECRET?: string;
  BGG_TOKEN?: string;
  /** 새 질문 알림을 보낼 디스코드 웹후크 주소. 없으면 알림 없이 저장만 합니다. */
  DISCORD_WEBHOOK_URL?: string;
}

type Handler = (ctx: { req: Request; env: Env; url: URL; id: string }) => Promise<unknown> | unknown;

// [메서드, 경로, 관리자 전용 여부, 처리기]. 경로의 :id 자리는 ctx.id로 들어옵니다.
const ROUTES: [string, string, boolean, Handler][] = [
  ['GET', '/api/health', false, () => ({ ok: true })],
  ['GET', '/api/games', false, async ({ env, url }) => {
    const all = await db.shelf(env.DB);
    const q = (key: string) => url.searchParams.get(key) ?? undefined;
    // 전체 수는 본판 카드에 묶인 확장판까지 센 상자 수입니다.
    const total = all.reduce((n, g) => n + 1 + g.expansions.length, 0);
    return { total, items: filterGames(all, { q: q('q'), players: q('players'), category: q('category'), sort: q('sort'), order: q('order') }) };
  }],
  ['GET', '/api/games/:id', false, async ({ env, id }) => (await db.shelfGame(env.DB, id)) ?? notFound()],
  ['GET', '/api/recommend', false, async ({ env, url }) => {
    const n = Number(url.searchParams.get('players') ?? '3');
    const time = url.searchParams.get('time') ?? 'any';
    const mood = url.searchParams.get('mood') ?? 'any';
    if (!Number.isInteger(n) || n < 1 || n > 12) throw new HttpError(400, '인원은 1~12 사이 숫자여야 합니다.');
    if (!TIME_PREFS.includes(time as TimePref)) throw new HttpError(400, '시간 조건이 올바르지 않습니다.');
    if (!MOODS.includes(mood as Mood)) throw new HttpError(400, '기분 조건이 올바르지 않습니다.');
    return recommend(await db.shelf(env.DB), n, time as TimePref, mood as Mood);
  }],
  ['GET', '/api/covers/:id', false, async ({ env, id }) => {
    const cover = (await db.cover(env.DB, id)) ?? notFound('표지가 없습니다.');
    // 주소에 ?v=올린시각이 붙으므로 바뀌면 주소도 바뀝니다. 오래 캐시해도 됩니다.
    return new Response(cover.data, { headers: { 'Content-Type': cover.mime, 'Cache-Control': 'public, max-age=31536000, immutable' } });
  }],
  ['GET', '/api/plays', false, ({ env }) => db.plays(env.DB)],
  ['GET', '/api/wishlist', false, ({ env }) => db.wishes(env.DB)],
  ['GET', '/api/mysteries', false, ({ env }) => db.mysteries(env.DB)],
  ['POST', '/api/ask', false, ({ req, env }) => ask(req, env)],
  ['POST', '/api/questions', false, ({ req, env, url }) => leaveQuestion(req, env, url)],
  ['GET', '/api/questions/:id', false, async ({ env, id }) => {
    const row = await db.questionByToken(env.DB, id);
    return row ? toMine(row) : notFound('그 질문을 찾을 수 없어요. 링크를 다시 확인해 주세요.');
  }],
  ['GET', '/api/qna', false, async ({ env }) => (await db.publicQuestions(env.DB)).map(toPublic)],
  ['POST', '/api/auth/login', false, async ({ req, env }) => {
    if (!env.ADMIN_PASSWORD || !env.TOKEN_SECRET) throw new HttpError(503, '서버에 ADMIN_PASSWORD와 TOKEN_SECRET이 설정되지 않았습니다.');
    const { password } = await readJson(req);
    if (!samePassword(String(password ?? ''), env.ADMIN_PASSWORD)) throw new HttpError(401, '비밀번호가 맞지 않습니다.');
    return { token: issueToken(env.TOKEN_SECRET) };
  }],
  ['GET', '/api/admin/ledger', true, ({ env }) => db.ledger(env.DB)],
  ['GET', '/api/admin/questions', true, async ({ env }) => (await db.allQuestions(env.DB)).map(toAdmin)],
  ['PATCH', '/api/admin/questions/:id', true, async ({ req, env, id }) => {
    const n = entryId(id);
    const row = (await db.questionById(env.DB, n)) ?? noEntry();
    await db.updateQuestion(env.DB, n, valid(readAnswer(await readJson(req), row)));
    return toAdmin((await db.questionById(env.DB, n))!);
  }],
  ['DELETE', '/api/admin/questions/:id', true, async ({ env, id }) => ((await db.deleteQuestion(env.DB, entryId(id))) ? { ok: true } : noEntry())],
  ['POST', '/api/admin/games', true, async ({ req, env }) => {
    const input = (await readJson(req)) as LedgerInput;
    const patch = toPatch({ nameKo: '', ...input });
    if (typeof patch === 'string') throw new HttpError(400, patch);
    const id = await db.insertGame(env.DB, toColumns(patch.game, patch.ownership));
    return json(await db.ledgerGame(env.DB, id), 201);
  }],
  ['PATCH', '/api/admin/games/:id', true, async ({ req, env, id }) => {
    const patch = toPatch((await readJson(req)) as LedgerInput);
    if (typeof patch === 'string') throw new HttpError(400, patch);
    if (!(await db.updateGame(env.DB, id, toColumns(patch.game, patch.ownership)))) notFound();
    // 다른 표지로 바꾸거나 지우면 올려 둔 표지 파일은 더 쓰지 않으니 지웁니다.
    if (patch.game.imageUrl !== undefined && !patch.game.imageUrl.startsWith(`/api/covers/${encodeURIComponent(id)}?`)) await db.deleteCover(env.DB, id);
    return db.ledgerGame(env.DB, id);
  }],
  ['PUT', '/api/admin/games/:id/cover', true, async ({ req, env, id }) => {
    const mime = (req.headers.get('Content-Type') ?? '').split(';')[0].trim();
    if (!COVER_TYPES.includes(mime)) throw new HttpError(400, '표지는 JPEG, PNG, WebP 이미지만 올릴 수 있습니다.');
    const data = await req.arrayBuffer();
    if (data.byteLength === 0) throw new HttpError(400, '이미지 파일이 비어 있습니다.');
    if (data.byteLength > COVER_MAX_BYTES) throw new HttpError(413, '이미지가 너무 큽니다 (1MB 이하).');
    if (!(await db.ledgerGame(env.DB, id))) notFound();
    await db.saveCover(env.DB, id, mime, data);
    await db.updateGame(env.DB, id, { cover_image: `/api/covers/${encodeURIComponent(id)}?v=${Date.now()}` });
    return db.ledgerGame(env.DB, id);
  }],
  ['DELETE', '/api/admin/games/:id', true, async ({ env, id }) => {
    if (!(await db.deleteGame(env.DB, id))) notFound();
    return { ok: true };
  }],
  ['POST', '/api/admin/plays', true, async ({ req, env }) => {
    const cols = valid(toPlayColumns(await readJson(req), true));
    cols.game_id = await db.findGameByName(env.DB, String(cols.game_name), String(cols.game_name_en));
    return json(await db.play(env.DB, await db.insertEntry(env.DB, 'plays', cols)), 201);
  }],
  ['PATCH', '/api/admin/plays/:id', true, async ({ req, env, id }) => {
    const cols = valid(toPlayColumns(await readJson(req), false));
    const before = (await db.play(env.DB, entryId(id))) ?? noEntry();
    if (cols.game_name !== undefined || cols.game_name_en !== undefined) {
      cols.game_id = await db.findGameByName(env.DB, String(cols.game_name ?? before.gameName), String(cols.game_name_en ?? before.gameNameEn));
    }
    await db.updateEntry(env.DB, 'plays', entryId(id), cols);
    return db.play(env.DB, entryId(id));
  }],
  ['DELETE', '/api/admin/plays/:id', true, async ({ env, id }) => ((await db.deleteEntry(env.DB, 'plays', entryId(id))) ? { ok: true } : noEntry())],
  ['POST', '/api/admin/wishes', true, async ({ req, env }) => {
    const cols = valid(toWishColumns(await readJson(req), true));
    return json(await db.wish(env.DB, await db.insertEntry(env.DB, 'wishes', cols)), 201);
  }],
  ['PATCH', '/api/admin/wishes/:id', true, async ({ req, env, id }) => {
    const cols = valid(toWishColumns(await readJson(req), false));
    if (!(await db.updateEntry(env.DB, 'wishes', entryId(id), cols))) noEntry();
    return db.wish(env.DB, entryId(id));
  }],
  ['DELETE', '/api/admin/wishes/:id', true, async ({ env, id }) => ((await db.deleteEntry(env.DB, 'wishes', entryId(id))) ? { ok: true } : noEntry())],
  ['POST', '/api/admin/mysteries', true, async ({ req, env }) => {
    const cols = valid(toMysteryColumns(await readJson(req), true));
    return json(await db.mystery(env.DB, await db.insertEntry(env.DB, 'mysteries', cols)), 201);
  }],
  ['PATCH', '/api/admin/mysteries/:id', true, async ({ req, env, id }) => {
    const cols = valid(toMysteryColumns(await readJson(req), false));
    if (!(await db.updateEntry(env.DB, 'mysteries', entryId(id), cols))) noEntry();
    return db.mystery(env.DB, entryId(id));
  }],
  ['DELETE', '/api/admin/mysteries/:id', true, async ({ env, id }) => ((await db.deleteEntry(env.DB, 'mysteries', entryId(id))) ? { ok: true } : noEntry())],
  ['GET', '/api/admin/export', true, async ({ env, url }) => {
    const format = url.searchParams.get('format') === 'json' ? 'json' : 'csv';
    const [rows, columns] = await Promise.all([db.allGames(env.DB), db.gameColumns(env.DB)]);
    const exportedAt = new Date().toISOString();
    const body = format === 'json' ? JSON.stringify({ exportedAt, games: rows }, null, 2) : toCsv(rows, columns.map((c) => c.name));
    return new Response(body, {
      headers: {
        'Content-Type': format === 'json' ? 'application/json; charset=utf-8' : 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="munse-ledger-${exportedAt.slice(0, 10)}.${format}"`,
        'Cache-Control': 'no-store',
      },
    });
  }],
  ['POST', '/api/admin/import', true, async ({ req, env }) => {
    const { format, text } = await readJson(req);
    if (format !== 'csv' && format !== 'json') throw new HttpError(400, '파일 형식은 csv나 json이어야 합니다.');
    if (typeof text !== 'string' || !text.trim()) throw new HttpError(400, '파일이 비어 있습니다.');
    let parsed: ReturnType<typeof normalizeRows>;
    try {
      parsed = normalizeRows(readBackup(text, format as Format), await db.gameColumns(env.DB));
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
    return { ...(await db.importGames(env.DB, parsed.rows)), ignored: parsed.ignored };
  }],
  ['GET', '/api/admin/bgg/search', true, ({ env, url }) => searchBgg(url.searchParams.get('q') ?? '', env.BGG_TOKEN)],
  // 위시처럼 장부에 넣지 않고 BGG 정보만 받아 칸을 채울 때 씁니다.
  ['GET', '/api/admin/bgg/thing/:id', true, ({ env, id }) => {
    const bggId = Number(id);
    if (!Number.isInteger(bggId) || bggId <= 0) throw new HttpError(400, 'BGG 번호가 올바르지 않습니다.');
    return fetchBggGame(bggId, env.BGG_TOKEN);
  }],
  ['POST', '/api/admin/bgg/import', true, async ({ req, env }) => {
    const bggId = Number((await readJson(req)).bggId);
    if (!Number.isInteger(bggId) || bggId <= 0) throw new HttpError(400, 'BGG 번호가 올바르지 않습니다.');
    const game = await fetchBggGame(bggId, env.BGG_TOKEN);
    const fresh = bggColumns(game);
    let id = await db.findByBggId(env.DB, bggId);
    if (id) await db.updateGame(env.DB, id, fresh);
    else id = await db.insertGame(env.DB, { title: game.nameKo, ...fresh });
    return db.ledgerGame(env.DB, id);
  }],
];

const COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// 화면에서 긴 변 600px JPEG로 줄여 올리므로 보통 100KB 안쪽입니다. D1 한 행 한도(2MB)보다 넉넉히 작게 둡니다.
const COVER_MAX_BYTES = 1024 * 1024;

/** 방문자 IP를 비밀값과 섞은 해시 앞부분. IP 원문은 저장하지 않습니다. */
async function visitorKey(req: Request, env: Env): Promise<string> {
  const ip = req.headers.get('CF-Connecting-IP') ?? 'local';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${env.TOKEN_SECRET ?? ''}:${ip}`));
  return [...new Uint8Array(digest).slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 문세에게 직접 남기는 질문. 저장한 뒤 디스코드로 알리고, 답을 확인할 열쇠(token)를 돌려줍니다. */
async function leaveQuestion(req: Request, env: Env, url: URL) {
  const q = valid(readQuestion(await readJson(req)));
  const token = crypto.randomUUID().replace(/-/g, '');
  // 봇은 저장하지 않지만 성공한 것처럼 답해 다시 시도하지 않게 합니다.
  if (q.bot) return { token };
  const day = kstDay();
  const bucket = ['q:' + (await visitorKey(req, env))];
  const [mine] = await db.bumpAsk(env.DB, day, bucket);
  if (mine > QUESTIONS_PER_IP) {
    await db.unbumpAsk(env.DB, day, bucket);
    throw new HttpError(429, `질문은 하루 ${QUESTIONS_PER_IP}개까지 남길 수 있어요. 내일 다시 남겨 주세요.`);
  }
  await db.insertQuestion(env.DB, { token, ...q });
  if (env.DISCORD_WEBHOOK_URL) {
    // 알림이 실패해도 질문은 이미 저장됐으니 방문자에게는 성공으로 답합니다.
    try {
      const res = await fetch(env.DISCORD_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(discordMessage(q, `${url.origin}/admin`)) });
      if (!res.ok) console.error('디스코드 알림 실패', res.status);
    } catch (e) {
      console.error('디스코드 알림 실패', e);
    }
  }
  return { token };
}

/** 공방지기 질문. 하루 상한과 방문자별 상한을 먼저 세고, 답은 글자가 나오는 대로 흘려 보냅니다. */
async function ask(req: Request, env: Env): Promise<Response> {
  const input = valid(readAsk(await readJson(req)));
  const day = kstDay();
  const buckets = ['all', 'ip:' + (await visitorKey(req, env))];
  const [all, mine] = await db.bumpAsk(env.DB, day, buckets);
  if (all > DAILY_LIMIT || mine > PER_IP_LIMIT) {
    await db.unbumpAsk(env.DB, day, buckets);
    throw new HttpError(429, all > DAILY_LIMIT ? '오늘은 공방지기가 질문을 많이 받아 쉬는 중이에요. 내일 다시 찾아와 주세요.' : `오늘 질문은 ${PER_IP_LIMIT}번까지예요. 내일 다시 물어봐 주세요.`);
  }
  let stream: ReadableStream<Uint8Array>;
  try {
    const messages: AskMessage[] = [...input.history, { role: 'user', content: input.question }];
    const res = await env.AI.run(ASK_MODEL, { messages: [{ role: 'system', content: systemPrompt(await db.shelf(env.DB)) }, ...messages], stream: true, max_tokens: 700,
      // 생각 과정을 켜면 답보다 생각에 글자를 다 써 버려서 끕니다. 무료 사용량도 덜 씁니다.
      chat_template_kwargs: { enable_thinking: false },
    });
    // stream: true면 SSE 스트림이 옵니다. 타입 정의는 일반 응답과 묶여 있어 여기서 좁힙니다.
    stream = res as unknown as ReadableStream<Uint8Array>;
  } catch (e) {
    // Workers AI 무료 사용량을 다 쓰면 여기로 옵니다. 답하지 못했으니 센 횟수도 돌려놓습니다.
    console.error(e);
    await db.unbumpAsk(env.DB, day, buckets);
    throw new HttpError(503, '공방지기가 지금은 대답하기 어려워요. 잠시 뒤에 다시 물어봐 주세요.');
  }
  return new Response(stream.pipeThrough(sseToText()), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Ask-Left': String(Math.max(PER_IP_LIMIT - mine, 0)) },
  });
}

function notFound(message = '그 번호의 게임이 없습니다.'): never {
  throw new HttpError(404, message);
}

const noEntry = () => notFound('그 번호의 기록이 없습니다.');

function entryId(id: string): number {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) noEntry();
  return n;
}

function valid<T>(result: T | string): T {
  if (typeof result === 'string') throw new HttpError(400, result);
  return result;
}

function match(method: string, path: string) {
  let pathFound = false;
  for (const [m, pattern, admin, handler] of ROUTES) {
    const re = new RegExp('^' + pattern.replace(':id', '([^/]+)') + '$');
    const hit = path.match(re);
    if (!hit) continue;
    pathFound = true;
    if (m === method) return { admin, handler, id: hit[1] ? decodeURIComponent(hit[1]) : '' };
  }
  throw pathFound ? new HttpError(405, '허용하지 않는 요청 방식입니다.') : new HttpError(404, '없는 주소입니다.');
}

async function handleApi(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  try {
    const route = match(req.method, url.pathname);
    if (route.admin) {
      const header = req.headers.get('Authorization');
      const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
      if (!verifyToken(token, env.TOKEN_SECRET ?? '')) throw new HttpError(401, '관리자 로그인이 필요합니다.');
    }
    const result = await route.handler({ req, env, url, id: route.id });
    return result instanceof Response ? result : json(result);
  } catch (e) {
    if (e instanceof HttpError) return json({ message: e.message }, e.status);
    console.error(e);
    return json({ message: '서버에서 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요.' }, 500);
  }
}

export default {
  fetch(req, env) {
    if (new URL(req.url).pathname.startsWith('/api/')) return handleApi(req, env);
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
