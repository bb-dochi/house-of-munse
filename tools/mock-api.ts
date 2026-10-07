// DB 없이 화면을 확인하기 위한 가짜 API. 실제 서버와 같은 필터·추천·장부 로직을 그대로 씁니다.
// 실행: npx tsx tools/mock-api.ts [정적 파일 폴더] [포트]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { filterGames, recommend, Mood, TimePref } from '../apps/api/src/games/logic';
import { toPatch } from '../apps/api/src/admin/ledger';
import { issueToken, verifyToken } from '../apps/api/src/auth/token';
import { GAMES, PLAYS, WISHES } from '../apps/api/prisma/seed-data';

const root = process.argv[2] ?? 'apps/web/dist';
const port = Number(process.argv[3] ?? 4173);
const SECRET = 'mock-secret';
const PASSWORD = 'munse';

let nextId = GAMES.length + 1;
let games = GAMES.map(({ own, ...g }, i) => ({ id: i + 1, bggId: null as number | null, ...g, imageUrl: null as string | null, iconKey: g.nameEn as string | null, ownership: { ...own } }));
const pub = () => games.filter((g) => g.ownership.status !== '방출 완료').map(({ ownership, bggId, ...g }) => g);
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' };

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const send = (code: number, body: unknown) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  const body = async () => { let s = ''; for await (const c of req) s += c; return s ? JSON.parse(s) : {}; };
  const p = url.pathname;
  if (p.startsWith('/api/')) {
    const q = Object.fromEntries(url.searchParams);
    if (p === '/api/games') return send(200, { total: pub().length, items: filterGames(pub(), q) });
    if (p === '/api/recommend') return send(200, recommend(pub(), Number(q.players ?? 3), (q.time ?? 'any') as TimePref, (q.mood ?? 'any') as Mood));
    if (p === '/api/plays') return send(200, PLAYS.map((x, i) => { const g = games.find((y) => y.nameEn === x.gameNameEn); return { id: i + 1, ...x, isSample: true, game: g ? { category: g.category, iconKey: g.iconKey, imageUrl: null } : null }; }));
    if (p === '/api/wishlist') return send(200, WISHES.map((w, i) => ({ id: i + 1, ...w, isSample: true })));
    if (p === '/api/auth/login') return (await body()).password === PASSWORD ? send(200, { token: issueToken(SECRET) }) : send(401, { message: '비밀번호가 맞지 않습니다.' });
    if (p.startsWith('/api/admin/')) {
      if (!verifyToken(req.headers.authorization?.slice(7), SECRET)) return send(401, { message: '관리자 로그인이 필요합니다.' });
      if (p === '/api/admin/ledger') return send(200, games);
      if (p === '/api/admin/bgg/search') return send(503, { message: '서버에 BGG_TOKEN이 없습니다. BGG에서 앱을 등록하고 받은 토큰을 넣어 주세요.' });
      const id = Number(p.split('/').pop());
      if (p === '/api/admin/games' && req.method === 'POST') {
        const patch = toPatch({ nameKo: '', ...(await body()) });
        if (typeof patch === 'string') return send(400, { message: patch });
        const g = { id: nextId++, bggId: null, nameKo: '', nameEn: '', minPlayers: 1, maxPlayers: 4, playTime: 0, weight: 0, rating: 0, category: '가족', description: '', imageUrl: null, iconKey: null, ...patch.game, ownership: { recommendedPlayers: '', purchasePrice: null, sellPrice: null, status: '보유', ...patch.ownership } };
        games.push(g as (typeof games)[number]);
        return send(201, g);
      }
      const g = games.find((x) => x.id === id);
      if (!g) return send(404, { message: '그 번호의 게임이 없습니다.' });
      if (req.method === 'PATCH') {
        const patch = toPatch(await body());
        if (typeof patch === 'string') return send(400, { message: patch });
        Object.assign(g, patch.game); Object.assign(g.ownership, patch.ownership);
        return send(200, g);
      }
      if (req.method === 'DELETE') { games = games.filter((x) => x.id !== id); return send(200, { ok: true }); }
    }
    return send(404, { message: '없는 주소입니다.' });
  }
  const file = extname(p) ? p : '/index.html';
  try {
    const data = await readFile(join(root, file));
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(port, () => console.log(`mock on http://localhost:${port} (비밀번호: ${PASSWORD})`));
