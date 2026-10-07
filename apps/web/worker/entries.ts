// 게임 후기(plays)·위시리스트(wishes)·머더미스터리 후기(mysteries) 입력값 정리. 순수 함수라 테스트로 확인합니다.
import { CATEGORIES, parseWeight } from './ledger';
import type { Columns } from './rows';

export const WISH_STATUSES = ['곧 주문', '세일 기다리는 중', '고민 중'];
/** 머더미스터리 추천도. 위에서부터 높은 순서입니다. */
export const RANKS = ['S', 'A', 'B', 'C'];

type Input = Record<string, unknown>;
type Rule = [column: string, read: (v: unknown) => string | number | null, error: string];

const text = (v: unknown) => String(v ?? '').trim();
const required = (v: unknown) => text(v) || null;
const intIn = (min: number, max: number) => (v: unknown) => {
  const n = Number(text(v));
  return text(v) !== '' && Number.isInteger(n) && n >= min && n <= max ? n : null;
};
const date = (v: unknown) => {
  const s = text(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : null;
};
const bool = (v: unknown) => (v === true || v === 1 || text(v) === '1' || text(v) === 'true' ? 1 : v === false || v === 0 || text(v) === '0' || text(v) === 'false' ? 0 : null);
const oneOf = (list: string[], blank = false) => (v: unknown) => (list.includes(text(v)) || (blank && text(v) === '') ? text(v) : null);

const PLAY: Record<string, Rule> = {
  playedAt: ['played_at', date, '날짜는 YYYY-MM-DD 형식으로 입력해 주세요.'],
  gameName: ['game_name', required, '게임 이름을 입력해 주세요.'],
  gameNameEn: ['game_name_en', text, ''],
  players: ['players', text, ''],
  winner: ['winner', text, ''],
  duration: ['duration', text, ''],
  again: ['again', intIn(0, 5), '또 할래요는 0~5 사이 숫자로 입력해 주세요.'],
  memo: ['memo', text, ''],
};

const WISH: Record<string, Rule> = {
  priority: ['priority', intIn(1, 999), '순위는 1 이상의 숫자로 입력해 주세요.'],
  nameKo: ['name_ko', required, '게임 이름을 입력해 주세요.'],
  nameEn: ['name_en', text, ''],
  category: ['category', oneOf(CATEGORIES, true), '카테고리는 ' + CATEGORIES.join(', ') + ' 중 하나이거나 비워 두어야 합니다.'],
  players: ['players', text, ''],
  playTime: ['play_time', intIn(0, 10000), '시간은 분 단위 숫자로 입력해 주세요.'],
  weight: ['weight', (v) => (text(v) === '' ? 0 : parseWeight(v)), '웨이트는 0~5 사이 숫자로 입력해 주세요.'],
  expectedPrice: ['expected_price', text, ''],
  status: ['status', oneOf(WISH_STATUSES), '상태는 ' + WISH_STATUSES.join(', ') + ' 중 하나여야 합니다.'],
  reason: ['reason', text, ''],
};

const MYSTERY: Record<string, Rule> = {
  playedAt: ['played_at', date, '날짜는 YYYY-MM-DD 형식으로 입력해 주세요.'],
  title: ['title', required, '게임 이름을 입력해 주세요.'],
  players: ['players', text, ''],
  playTime: ['play_time', text, ''],
  gm: ['gm', bool, 'GM 여부는 있음·없음 중 하나여야 합니다.'],
  rank: ['rank', oneOf(RANKS), '추천도는 ' + RANKS.join(', ') + ' 중 하나여야 합니다.'],
  review: ['review', text, ''],
  spoiler: ['spoiler', text, ''],
};

// 새로 만들 때 비어 있으면 채우는 값. 이름·날짜처럼 꼭 필요한 칸은 여기 없어서 오류가 납니다.
const PLAY_DEFAULTS: Input = { gameNameEn: '', players: '', winner: '', duration: '', again: 3, memo: '' };
const MYSTERY_DEFAULTS: Input = { players: '', playTime: '', gm: 0, review: '', spoiler: '' };
const WISH_DEFAULTS: Input = { priority: 99, nameEn: '', category: '', players: '', playTime: 0, weight: 0, expectedPrice: '', status: '고민 중', reason: '' };

/**
 * 보낸 칸만 열 이름으로 바꿉니다. create면 모든 칸이 있어야 하고, 빠진 칸은 기본값으로 채웁니다.
 * 예시 행이 있는 표(sample)에서는 직접 적거나 고친 기록을 더 이상 예시로 보지 않도록 is_sample을 끕니다.
 */
function toColumns(rules: Record<string, Rule>, defaults: Input, input: Input, create: boolean, sample = true): Columns | string {
  const src = create ? { ...defaults, ...input } : input;
  const out: Columns = {};
  for (const [key, [column, read, error]] of Object.entries(rules)) {
    if (src[key] === undefined) {
      if (create) return error || `${key} 값이 없습니다.`;
      continue;
    }
    const value = read(src[key]);
    if (value === null) return error;
    out[column] = value;
  }
  if (!create && Object.keys(out).length === 0) return '바꿀 내용이 없습니다.';
  if (sample) out.is_sample = 0;
  return out;
}

export const toPlayColumns = (input: Input, create: boolean) => toColumns(PLAY, PLAY_DEFAULTS, input, create);
export const toWishColumns = (input: Input, create: boolean) => toColumns(WISH, WISH_DEFAULTS, input, create);
export const toMysteryColumns = (input: Input, create: boolean) => toColumns(MYSTERY, MYSTERY_DEFAULTS, input, create, false);
