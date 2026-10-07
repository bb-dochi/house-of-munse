// 장부 백업: games 표 전체를 CSV·JSON으로 내보내고, 같은 모양의 파일을 다시 읽어 들입니다.
// 열 목록은 DB에서 직접 읽어(PRAGMA table_info) 마이그레이션으로 열이 늘어나도 그대로 따라갑니다.

export interface ColumnInfo {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
}

export type Cell = string | number | null;
export type BackupRow = Record<string, Cell>;
export type Format = 'csv' | 'json';

// ---------- CSV ----------

const csvCell = (v: unknown) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
};

/** 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM을 붙입니다. */
export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const lines = [columns.join(','), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(','))];
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/** RFC 4180 CSV. 첫 줄은 열 이름이고, 따옴표 안의 쉼표·줄바꿈·"" 를 처리합니다. */
export function parseCsv(text: string): Record<string, string>[] {
  const src = text.replace(/^﻿/, '');
  const records: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') (cell += '"'), i++;
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === ',') row.push(cell), (cell = '');
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell), records.push(row), (row = []), (cell = '');
    } else cell += ch;
  }
  if (quoted) throw new Error('CSV의 따옴표가 닫히지 않았습니다.');
  if (cell !== '' || row.length) row.push(cell), records.push(row);
  const [head, ...body] = records.filter((r) => r.some((c) => c !== ''));
  if (!head) return [];
  const names = head.map((h) => h.trim());
  return body.map((r) => Object.fromEntries(names.map((n, i) => [n, r[i] ?? ''])));
}

// ---------- 읽어 들이기 ----------

/** 파일 내용을 행 목록으로. JSON은 내보낸 모양({ games: [...] })과 배열 둘 다 받습니다. */
export function readBackup(text: string, format: Format): unknown[] {
  if (format === 'csv') return parseCsv(text);
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    throw new Error('JSON 파일을 읽지 못했습니다.');
  }
  const list = Array.isArray(data) ? data : (data as { games?: unknown })?.games;
  if (!Array.isArray(list)) throw new Error('JSON에 games 목록이 없습니다.');
  return list;
}

const isNumeric = (c: ColumnInfo) => /INT|REAL|NUM|FLOA|DOUB/i.test(c.type);

/**
 * 파일의 행을 DB 열 모양으로 맞춥니다. 모르는 열은 건너뛰고, 파일에 없는 열은 건드리지 않습니다.
 * CSV는 모든 값이 글자라, 숫자 열의 빈 칸은 null(빈 값을 못 받는 열이면 오류)로 봅니다.
 */
export function normalizeRows(raw: unknown[], columns: ColumnInfo[]): { rows: BackupRow[]; ignored: string[] } {
  const byName = new Map(columns.map((c) => [c.name, c]));
  const ignored = new Set<string>();
  const errors: string[] = [];
  const seen = new Set<string>();
  const rows: BackupRow[] = [];
  raw.forEach((item, i) => {
    const line = `${i + 1}번째 게임`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) return void errors.push(`${line}: 형식이 올바르지 않습니다.`);
    const out: BackupRow = {};
    for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
      const col = byName.get(key);
      if (!col) {
        ignored.add(key);
        continue;
      }
      const blank = value === null || value === undefined || value === '';
      if (isNumeric(col)) {
        if (blank) {
          if (col.notnull) errors.push(`${line}: ${key} 값이 비어 있습니다.`);
          else out[key] = null;
          continue;
        }
        const n = value === true || value === 'true' ? 1 : value === false || value === 'false' ? 0 : Number(value);
        if (!Number.isFinite(n)) errors.push(`${line}: ${key} 값 "${value}"이(가) 숫자가 아닙니다.`);
        else out[key] = n;
      } else {
        out[key] = blank ? (col.notnull ? '' : null) : typeof value === 'object' ? JSON.stringify(value) : String(value);
      }
    }
    const id = typeof out.id === 'string' ? out.id.trim() : '';
    if (!id) errors.push(`${line}: id가 없습니다.`);
    else if (seen.has(id)) errors.push(`${line}: id "${id}"가 파일 안에 두 번 있습니다.`);
    if (typeof out.title !== 'string' || !out.title.trim()) errors.push(`${line}: title(게임 이름)이 없습니다.`);
    seen.add(id);
    out.id = id;
    rows.push(out);
  });
  if (errors.length) throw new Error(errors.slice(0, 5).join('\n') + (errors.length > 5 ? `\n…외 ${errors.length - 5}건` : ''));
  if (!rows.length) throw new Error('파일에 게임이 없습니다.');
  return { rows, ignored: [...ignored] };
}
