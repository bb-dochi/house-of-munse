// 스크립트들이 D1에 넣을 SQL 파일을 만들 때 쓰는 도구.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type SqlValue = string | number | boolean | null;

export const sqlValue = (x: SqlValue) =>
  x === null ? 'NULL' : typeof x === 'number' ? String(x) : typeof x === 'boolean' ? (x ? '1' : '0') : `'${x.replaceAll("'", "''")}'`;

export const insertSql = (table: string, row: Record<string, SqlValue>, tail = '') =>
  `INSERT ${tail ? '' : 'OR IGNORE '}INTO ${table} (${Object.keys(row).join(', ')}) VALUES (${Object.values(row).map(sqlValue).join(', ')})${tail ? ' ' + tail : ''};`;

export function writeSql(path: string, statements: string[]) {
  const out = resolve(path);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, statements.join('\n') + '\n');
  return out;
}
