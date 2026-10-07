// BGG 번호가 있는 게임의 웨이트·카테고리·확장판 연결을 BGG에서 받아 채웁니다.
// 실행: npm run db:bgg:local  (배포 DB는 npm run db:bgg:remote)
// 토큰은 환경변수 BGG_TOKEN이나 .dev.vars의 BGG_TOKEN을 씁니다.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { mapThings, BggThing } from '../worker/map';
import { fillStatements, FillRow } from './bggfill';
import { writeSql } from './sql';

const where = process.argv.includes('--remote') ? '--remote' : '--local';
const token = process.env.BGG_TOKEN || (existsSync('.dev.vars') ? readFileSync('.dev.vars', 'utf8').match(/^BGG_TOKEN\s*=\s*"?([^"\r\n]*)"?/m)?.[1] : '');
if (!token) throw new Error('BGG_TOKEN이 없습니다. .dev.vars에 BGG_TOKEN="..."을 넣어 주세요.');

const d1 = (args: string) => execSync(`npx wrangler d1 execute house-of-munse ${where} ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
const rows: FillRow[] = JSON.parse(d1('--json --command "SELECT id, bgg_id FROM games WHERE bgg_id IS NOT NULL"'))[0].results;
const ids = [...new Set(rows.map((r) => r.bgg_id))];

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// BGG는 한 번에 20개까지 받고, 너무 자주 부르면 429를 돌려줍니다. 기다렸다가 다시 묻습니다.
async function fetchThings(batch: number[]): Promise<BggThing[]> {
  for (let attempt = 1; attempt <= 6; attempt++) {
    const res = await fetch(`https://boardgamegeek.com/xmlapi2/thing?id=${batch.join(',')}&stats=1`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok && res.status !== 202) return mapThings(parser.parse(await res.text()));
    if (res.status === 401 || res.status === 403) throw new Error('BGG가 토큰을 거부했습니다. 토큰과 앱 승인 상태를 확인해 주세요.');
    console.log(`  BGG 응답 ${res.status}, ${attempt * 5}초 뒤 다시 시도`);
    await sleep(attempt * 5000);
  }
  throw new Error('BGG가 계속 응답하지 않습니다. 잠시 뒤 다시 실행해 주세요.');
}

const things: BggThing[] = [];
for (let i = 0; i < ids.length; i += 20) {
  const batch = ids.slice(i, i + 20);
  console.log(`BGG ${i + 1}–${i + batch.length} / ${ids.length}`);
  things.push(...(await fetchThings(batch)));
  await sleep(2500);
}

const sql = fillStatements(rows, things);
const out = writeSql('.wrangler/bgg-fill.sql', sql);
d1(`--file "${out}"`);
const missing = ids.filter((id) => !things.some((t) => t.bggId === id));
console.log(`게임 ${sql.length}개를 채웠습니다 (${where}).${missing.length ? ` BGG에서 못 찾은 번호: ${missing.join(', ')}` : ''}`);
