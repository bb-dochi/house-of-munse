import { XMLParser } from 'fast-xml-parser';
import { HttpError } from './http';
import { BggGame, BggSearchHit, mapSearch, mapThing } from './map';

const BASE = 'https://boardgamegeek.com/xmlapi2';
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });

// BGG는 서버에서만 부르고, 가져온 결과는 DB에 저장해 방문자 요청 때는 다시 부르지 않습니다.
async function get(path: string, token: string | undefined) {
  if (!token) throw new HttpError(503, '서버에 BGG_TOKEN이 없습니다. BGG에서 앱을 등록하고 받은 토큰을 넣어 주세요.');
  let res: Response;
  try {
    res = await fetch(BASE + path, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new HttpError(502, 'BGG에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
  }
  if (res.status === 401 || res.status === 403) throw new HttpError(502, 'BGG가 토큰을 거부했습니다. 토큰과 앱 승인 상태를 확인해 주세요.');
  if (res.status === 429) throw new HttpError(502, 'BGG 요청 한도를 넘었습니다. 잠시 뒤 다시 시도해 주세요.');
  if (!res.ok) throw new HttpError(502, `BGG가 오류를 돌려줬습니다 (${res.status}).`);
  return parser.parse(await res.text());
}

export async function searchBgg(query: string, token: string | undefined): Promise<BggSearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  return mapSearch(await get(`/search?type=boardgame&query=${encodeURIComponent(q)}`, token)).slice(0, 20);
}

export async function fetchBggGame(bggId: number, token: string | undefined): Promise<BggGame> {
  const game = mapThing(await get(`/thing?id=${bggId}&stats=1`, token));
  if (!game) throw new HttpError(404, 'BGG에 그 번호의 게임이 없습니다.');
  return game;
}
