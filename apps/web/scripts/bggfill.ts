// BGG에서 받은 정보로 games 행을 채우는 SQL을 만듭니다. 순수 함수라 그대로 테스트합니다.
import { playersColumn, playTimeColumn } from '../worker/rows';
import type { BggThing } from '../worker/map';
import { sqlValue } from './sql';

export interface FillRow {
  id: string;
  bgg_id: number;
}

/**
 * 빈 칸(웨이트 0, 카테고리·인원·시간·표지가 빈 것)만 채워, 장부에서 직접 고친 값은 덮지 않습니다.
 * 확장판 여부와 본판 연결은 BGG를 기준으로 다시 맞춥니다.
 * BGG가 본판이라고 하면 연결을 풀고, 확장판인데 본판이 우리 장부에 없으면 기존 연결을 그대로 둡니다.
 */
export function fillStatements(rows: FillRow[], things: BggThing[]): string[] {
  const byBgg = new Map<number, string>();
  for (const r of rows) if (!byBgg.has(r.bgg_id)) byBgg.set(r.bgg_id, r.id);
  const now = new Date().toISOString();
  const out: string[] = [];
  for (const t of things) {
    const ids = rows.filter((r) => r.bgg_id === t.bggId).map((r) => r.id);
    if (!ids.length) continue;
    const isExpansion = t.type === 'boardgameexpansion';
    const base = t.baseBggIds.map((b) => byBgg.get(b)).find(Boolean);
    const fill = (col: string, value: string | number | null, blank: string) =>
      value === null || value === '' || value === 0 ? null : `${col} = CASE WHEN ${col} = ${blank} THEN ${sqlValue(value)} ELSE ${col} END`;
    const sets = [
      fill('weight', t.weight, '0'),
      fill('category', t.category, "''"),
      fill('players', t.minPlayers > 0 && t.maxPlayers > 0 ? playersColumn(t.minPlayers, t.maxPlayers) : null, "''"),
      fill('play_time', t.playTime > 0 ? playTimeColumn(t.playTime) : null, "''"),
      fill('cover_image', t.imageUrl, "''"),
      `is_expansion = ${isExpansion ? 1 : 0}`,
      !isExpansion ? 'base_game_id = NULL' : base ? `base_game_id = ${sqlValue(base)}` : null,
      `updated_at = ${sqlValue(now)}`,
    ].filter(Boolean);
    for (const id of ids) {
      // 자기 자신을 본판으로 잇지 않도록 막습니다.
      const guard = base === id ? sets.filter((s) => !s!.startsWith('base_game_id')) : sets;
      out.push(`UPDATE games SET ${guard.join(', ')} WHERE id = ${sqlValue(id)};`);
    }
  }
  return out;
}
