// API 호출 모음. 주소는 VITE_API_URL(없으면 같은 주소의 /api)을 씁니다.

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api';
const TOKEN_KEY = 'munse-admin-token';

export interface Game {
  id: number;
  nameKo: string;
  nameEn: string;
  minPlayers: number;
  maxPlayers: number;
  playTime: number;
  weight: number;
  rating: number;
  category: string;
  description: string;
  imageUrl: string | null;
  iconKey: string | null;
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
  return res.json() as Promise<T>;
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
  updateGame: (id: number, data: Record<string, unknown>) => call<LedgerRow>(`/admin/games/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, true),
  deleteGame: (id: number) => call<{ ok: true }>(`/admin/games/${id}`, { method: 'DELETE' }, true),
  bggSearch: (q: string) => call<BggHit[]>(`/admin/bgg/search?${qs({ q })}`, {}, true),
  bggImport: (bggId: number) => call<LedgerRow>('/admin/bgg/import', { method: 'POST', body: JSON.stringify({ bggId }) }, true),
};

export const playersText = (g: Pick<Game, 'minPlayers' | 'maxPlayers'>) => (g.minPlayers === g.maxPlayers ? `${g.minPlayers}인` : `${g.minPlayers}–${g.maxPlayers}인`);
