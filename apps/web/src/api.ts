// API 호출 모음. 화면과 API(Worker)가 같은 주소에서 나가므로 /api를 그대로 씁니다.

const BASE = '/api';
const TOKEN_KEY = 'munse-admin-token';

export interface Game {
  id: string;
  /** 선반 번호. 장부에 들어온 순서입니다. */
  no: number;
  nameKo: string;
  nameEn: string;
  /** 인원을 모르면 null */
  minPlayers: number | null;
  maxPlayers: number | null;
  playTime: number;
  weight: number;
  rating: number;
  category: string;
  description: string;
  imageUrl: string | null;
  iconKey: string | null;
  /** 이 게임에 붙는 확장판 */
  expansions: { id: string; nameKo: string }[];
}

export interface Ownership {
  recommendedPlayers: string;
  purchasePrice: number | null;
  sellPrice: number | null;
  status: string;
}

export interface LedgerRow extends Game {
  bggId: number | null;
  ownership: Ownership | null;
}

export interface Recommendation {
  full: number;
  exact: number;
  candidates: { game: Game; score: number }[];
}

export interface Play {
  id: number;
  playedAt: string;
  gameName: string;
  gameNameEn: string;
  players: string;
  winner: string;
  duration: string;
  again: number;
  memo: string;
  isSample: boolean;
  game: { category: string; iconKey: string | null; imageUrl: string | null } | null;
}

export interface Wish {
  id: number;
  priority: number;
  nameKo: string;
  nameEn: string;
  category: string;
  players: string;
  playTime: number;
  weight: number;
  expectedPrice: string;
  status: string;
  reason: string;
  isSample: boolean;
}

export interface Mystery {
  id: number;
  playedAt: string;
  title: string;
  players: string;
  playTime: string;
  gm: boolean;
  rank: string;
  review: string;
  spoiler: string;
}

export interface BggHit {
  bggId: number;
  name: string;
  year: number | null;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export const auth = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (t: string) => sessionStorage.setItem(TOKEN_KEY, t),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

async function call<T>(path: string, init: RequestInit = {}, admin = false): Promise<T> {
  return (await send(path, init, admin)).json() as Promise<T>;
}

async function send(path: string, init: RequestInit = {}, admin = false): Promise<Response> {
  const headers: Record<string, string> = { ...(init.body ? { 'Content-Type': 'application/json' } : {}) };
  if (admin) headers.Authorization = `Bearer ${auth.get() ?? ''}`;
  let res: Response;
  try {
    res = await fetch(BASE + path, { ...init, headers });
  } catch {
    throw new ApiError('서버에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.', 0);
  }
  if (!res.ok) {
    let message = `요청이 실패했습니다 (${res.status}).`;
    try {
      const body = await res.json();
      if (typeof body?.message === 'string') message = body.message;
    } catch {
      /* 본문이 JSON이 아니면 기본 문구를 씁니다 */
    }
    if (res.status === 401 && admin) auth.clear();
    throw new ApiError(message, res.status);
  }
  return res;
}

const qs = (o: Record<string, string | number>) => new URLSearchParams(Object.entries(o).map(([k, v]) => [k, String(v)])).toString();

export const api = {
  games: (query: Record<string, string>) => call<{ total: number; items: Game[] }>(`/games?${qs(query)}`),
  recommend: (players: number, time: string, mood: string) => call<Recommendation>(`/recommend?${qs({ players, time, mood })}`),
  plays: () => call<Play[]>('/plays'),
  wishlist: () => call<Wish[]>('/wishlist'),
  login: (password: string) => call<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
  ledger: () => call<LedgerRow[]>('/admin/ledger', {}, true),
  createGame: (data: Record<string, unknown>) => call<LedgerRow>('/admin/games', { method: 'POST', body: JSON.stringify(data) }, true),
  updateGame: (id: string, data: Record<string, unknown>) => call<LedgerRow>(`/admin/games/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, true),
  deleteGame: (id: string) => call<{ ok: true }>(`/admin/games/${id}`, { method: 'DELETE' }, true),
  bggSearch: (q: string) => call<BggHit[]>(`/admin/bgg/search?${qs({ q })}`, {}, true),
  createPlay: (data: Record<string, unknown>) => call<Play>('/admin/plays', { method: 'POST', body: JSON.stringify(data) }, true),
  updatePlay: (id: number, data: Record<string, unknown>) => call<Play>(`/admin/plays/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, true),
  deletePlay: (id: number) => call<{ ok: true }>(`/admin/plays/${id}`, { method: 'DELETE' }, true),
  mysteries: () => call<Mystery[]>('/mysteries'),
  createMystery: (data: Record<string, unknown>) => call<Mystery>('/admin/mysteries', { method: 'POST', body: JSON.stringify(data) }, true),
  updateMystery: (id: number, data: Record<string, unknown>) => call<Mystery>(`/admin/mysteries/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, true),
  deleteMystery: (id: number) => call<{ ok: true }>(`/admin/mysteries/${id}`, { method: 'DELETE' }, true),
  createWish: (data: Record<string, unknown>) => call<Wish>('/admin/wishes', { method: 'POST', body: JSON.stringify(data) }, true),
  updateWish: (id: number, data: Record<string, unknown>) => call<Wish>(`/admin/wishes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, true),
  deleteWish: (id: number) => call<{ ok: true }>(`/admin/wishes/${id}`, { method: 'DELETE' }, true),
  /** 장부 전체를 파일로 받아 브라우저 다운로드로 저장합니다. */
  exportLedger: async (format: 'csv' | 'json') => {
    const res = await send(`/admin/export?${qs({ format })}`, {}, true);
    const name = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? `munse-ledger.${format}`;
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  importLedger: (format: 'csv' | 'json', text: string) =>
    call<{ inserted: number; updated: number; ignored: string[] }>('/admin/import', { method: 'POST', body: JSON.stringify({ format, text }) }, true),
  bggImport: (bggId: number) => call<LedgerRow>('/admin/bgg/import', { method: 'POST', body: JSON.stringify({ bggId }) }, true),
};

export const playersText = (g: Pick<Game, 'minPlayers' | 'maxPlayers'>) =>
  g.minPlayers === null || g.maxPlayers === null ? '인원 미정' : g.minPlayers === g.maxPlayers ? `${g.minPlayers}인` : `${g.minPlayers}–${g.maxPlayers}인`;
export const timeText = (g: Pick<Game, 'playTime'>) => (g.playTime ? `${g.playTime}분` : '시간 미정');
export const weightText = (g: Pick<Game, 'weight'>) => (g.weight ? g.weight.toFixed(1) : '-');
