// 장부 입력값 정리. 순수 함수라 테스트로 확인합니다.

export const STATUSES = ['보유', '대여 중', '방출 예정', '방출 완료'];

/** "3–4인", "2", "4~8명" 같은 글에서 최소·최대 인원을 읽습니다. */
export function parsePlayers(text: string): { min: number; max: number } | null {
  const nums = (text.match(/\d+/g) ?? []).map(Number).filter((n) => n > 0 && n < 100);
  if (nums.length === 0) return null;
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

/** "42,000원" → 42000, 빈 값 → null */
export function parsePrice(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/[^0-9]/g, '');
  return digits ? Number(digits) : null;
}

export function parseWeight(value: unknown): number | null {
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= 5 ? Math.round(n * 10) / 10 : null;
}

export interface LedgerInput {
  nameKo?: unknown;
  nameEn?: unknown;
  weight?: unknown;
  recommendedPlayers?: unknown;
  purchasePrice?: unknown;
  sellPrice?: unknown;
  status?: unknown;
  category?: unknown;
  playTime?: unknown;
  rating?: unknown;
  description?: unknown;
}

export interface GamePatch {
  nameKo?: string;
  nameEn?: string;
  weight?: number;
  minPlayers?: number;
  maxPlayers?: number;
  category?: string;
  description?: string;
  playTime?: number;
  rating?: number;
}

export interface OwnershipPatch {
  recommendedPlayers?: string;
  purchasePrice?: number | null;
  sellPrice?: number | null;
  status?: string;
}

export interface LedgerPatch {
  game: GamePatch;
  ownership: OwnershipPatch;
}

/** 보낸 칸만 골라 게임 정보와 소장 정보로 나눕니다. 잘못된 값은 오류 메시지로 돌려줍니다. */
export function toPatch(input: LedgerInput): LedgerPatch | string {
  const game: GamePatch = {};
  const ownership: OwnershipPatch = {};
  if (input.nameKo !== undefined) {
    const name = String(input.nameKo).trim();
    if (!name) return '게임 이름을 입력해 주세요.';
    game.nameKo = name;
  }
  if (input.nameEn !== undefined) game.nameEn = String(input.nameEn).trim();
  if (input.weight !== undefined) {
    const w = parseWeight(input.weight);
    if (w === null) return '웨이트는 0~5 사이 숫자로 입력해 주세요.';
    game.weight = w;
  }
  if (input.recommendedPlayers !== undefined) {
    const text = String(input.recommendedPlayers).trim();
    ownership.recommendedPlayers = text;
    const range = parsePlayers(text);
    if (range) {
      game.minPlayers = range.min;
      game.maxPlayers = range.max;
    }
  }
  if (input.purchasePrice !== undefined) ownership.purchasePrice = parsePrice(input.purchasePrice);
  if (input.sellPrice !== undefined) ownership.sellPrice = parsePrice(input.sellPrice);
  if (input.status !== undefined) {
    if (!STATUSES.includes(String(input.status))) return '상태는 ' + STATUSES.join(', ') + ' 중 하나여야 합니다.';
    ownership.status = String(input.status);
  }
  if (input.category !== undefined) game.category = String(input.category).trim();
  if (input.description !== undefined) game.description = String(input.description).trim();
  if (input.playTime !== undefined) {
    const t = Number(input.playTime);
    if (!Number.isInteger(t) || t < 0) return '시간은 분 단위 숫자로 입력해 주세요.';
    game.playTime = t;
  }
  if (input.rating !== undefined) {
    const r = Number(input.rating);
    if (!Number.isFinite(r) || r < 0 || r > 10) return '평점은 0~10 사이 숫자로 입력해 주세요.';
    game.rating = Math.round(r * 10) / 10;
  }
  return { game, ownership };
}
