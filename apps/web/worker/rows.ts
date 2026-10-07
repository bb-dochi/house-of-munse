// games 테이블(house-of-munse2 스키마) 행과 화면이 쓰는 모양을 서로 바꿉니다. 순수 함수라 그대로 테스트합니다.
import { GamePatch, OwnershipPatch, parsePlayers } from './ledger';
import { BggGame } from './map';

export interface GameRow {
  id: string;
  no: number;
  title: string;
  english_title: string;
  bgg_id: number | null;
  cover_image: string;
  players: string;
  play_time: string;
  weight: number;
  rating: number;
  category: string;
  description: string;
  icon_key: string | null;
  status: string;
  purchase_price: number | null;
  sale_price: number | null;
  is_expansion: number | null;
  base_game_id: string | null;
}

/** 방문자에게 보여 주는 필드. 가격 같은 소장 정보는 넣지 않습니다. */
export interface PublicGame {
  id: string;
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
  /** 이 게임에 붙는 확장판. 확장판 자체는 공개 목록에 따로 나오지 않습니다. */
  expansions: { id: string; nameKo: string }[];
}

export interface LedgerGame extends PublicGame {
  bggId: number | null;
  baseGameId: string | null;
  ownership: { recommendedPlayers: string; purchasePrice: number | null; sellPrice: number | null; status: string };
}

export type Columns = Record<string, string | number | null>;

/** "30–60 min", "45" 같은 글에서 분을 읽습니다. 범위면 긴 쪽을 씁니다. */
export function minutes(text: string): number {
  const nums = (text.match(/\d+/g) ?? []).map(Number);
  return nums.length ? Math.max(...nums) : 0;
}

/** house-of-munse2(BG Stats 가져오기)와 같은 모양으로 저장합니다: "2–4", "2", "30 min". */
export const playersColumn = (min: number, max: number) => (min === max ? `${min}` : `${min}–${max}`);
export const playTimeColumn = (n: number) => `${n} min`;

export function toPublic(r: GameRow): PublicGame {
  const range = parsePlayers(r.players);
  return {
    id: r.id,
    no: Number(r.no),
    nameKo: r.title,
    nameEn: r.english_title,
    minPlayers: range?.min ?? null,
    maxPlayers: range?.max ?? null,
    playTime: minutes(r.play_time),
    weight: Number(r.weight),
    rating: Number(r.rating),
    category: r.category,
    description: r.description,
    imageUrl: r.cover_image || null,
    iconKey: r.icon_key,
    expansions: [],
  };
}

export function toLedger(r: GameRow): LedgerGame {
  return {
    ...toPublic(r),
    bggId: r.bgg_id,
    baseGameId: r.base_game_id,
    ownership: { recommendedPlayers: r.players, purchasePrice: r.purchase_price, sellPrice: r.sale_price, status: r.status },
  };
}

/** BGG에서 가져온 정보를 열로 바꿉니다. 한글 이름(title)은 이미 있는 게임이면 우리가 붙인 이름을 지키도록 따로 넣습니다. */
export function bggColumns(g: BggGame): Columns {
  return {
    bgg_id: g.bggId,
    english_title: g.nameEn,
    players: playersColumn(g.minPlayers, g.maxPlayers),
    play_time: playTimeColumn(g.playTime),
    weight: g.weight,
    rating: g.rating,
    category: g.category,
    description: g.description,
    cover_image: g.imageUrl ?? '',
  };
}

/** 장부에서 고친 칸을 games 테이블 열로 바꿉니다. 보내지 않은 칸은 건드리지 않습니다. */
export function toColumns(game: GamePatch, own: OwnershipPatch): Columns {
  const c: Columns = {};
  if (game.nameKo !== undefined) c.title = game.nameKo;
  if (game.nameEn !== undefined) c.english_title = game.nameEn;
  if (game.weight !== undefined) c.weight = game.weight;
  if (game.rating !== undefined) c.rating = game.rating;
  if (game.category !== undefined) c.category = game.category;
  if (game.description !== undefined) c.description = game.description;
  if (game.playTime !== undefined) c.play_time = playTimeColumn(game.playTime);
  if (own.recommendedPlayers !== undefined) {
    c.players = game.minPlayers !== undefined && game.maxPlayers !== undefined ? playersColumn(game.minPlayers, game.maxPlayers) : own.recommendedPlayers;
  }
  if (own.purchasePrice !== undefined) c.purchase_price = own.purchasePrice;
  if (own.sellPrice !== undefined) c.sale_price = own.sellPrice;
  if (own.status !== undefined) {
    c.status = own.status;
    // house-of-munse2는 owned·disposed로 공개 여부를 정하므로 상태와 함께 맞춰 둡니다.
    c.disposed = own.status === '방출 완료' ? 1 : 0;
  }
  return c;
}
