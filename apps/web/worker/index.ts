// /api/* 요청을 처리하는 Worker. 화면 파일은 Cloudflare 정적 자산이 바로 내려 줍니다 (wrangler.jsonc의 assets).
import { Format, normalizeRows, readBackup, toCsv } from './backup';
import { fetchBggGame, searchBgg } from './bgg';
import * as db from './db';
import { HttpError, json, readJson } from './http';
import { toMysteryColumns, toPlayColumns, toWishColumns } from './entries';
import { LedgerInput, toPatch } from './ledger';
import { filterGames, Mood, MOODS, recommend, TimePref, TIME_PREFS } from './logic';
import { bggColumns, toColumns } from './rows';
import { issueToken, samePassword, verifyToken } from './token';

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ADMIN_PASSWORD?: string;
  TOKEN_SECRET?: string;
  BGG_TOKEN?: string;
}

type Handler = (ctx: { req: Request; env: Env; url: URL; id: string }) => Promise<unknown> | unknown;

// [메서드, 경로, 관리자 전용 여부, 처리기]. 경로의 :id 자리는 ctx.id로 들어옵니다.
const ROUTES: [string, string, boolean, Handler][] = [
  ['GET', '/api/health', false, () => ({ ok: true })],
  ['GET', '/api/games', false, async ({ env, url }) => {
    const all = await db.shelf(env.DB);
    const q = (key: string) => url.searchParams.get(key) ?? undefined;
    return { total: all.length, items: filterGames(all, { q: q('q'), players: q('players'), weight: q('weight'), category: q('category'), sort: q('sort') }) };
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
  ['GET', '/api/plays', false, ({ env }) => db.plays(env.DB)],
  ['GET', '/api/wishlist', false, ({ env }) => db.wishes(env.DB)],
  ['GET', '/api/mysteries', false, ({ env }) => db.mysteries(env.DB)],
  ['POST', '/api/auth/login', false, async ({ req, env }) => {
    if (!env.ADMIN_PASSWORD || !env.TOKEN_SECRET) throw new HttpError(503, '서버에 ADMIN_PASSWORD와 TOKEN_SECRET이 설정되지 않았습니다.');
    const { password } = await readJson(req);
    if (!samePassword(String(password ?? ''), env.ADMIN_PASSWORD)) throw new HttpError(401, '비밀번호가 맞지 않습니다.');
    return { token: issueToken(env.TOKEN_SECRET) };
  }],
  ['GET', '/api/admin/ledger', true, ({ env }) => db.ledger(env.DB)],
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
