import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { api, ApiError, auth, BggHit, LedgerRow } from '../api';
import { Layout } from '../components/Layout';
import { categoryColor } from '../pixel';

const STATUS_COLOR: Record<string, string> = { 보유: '#70E8A0', '대여 중': '#5FC8F0', '방출 예정': '#EBCB86', '방출 완료': '#B9AAB8' };
const won = (n: number) => n.toLocaleString('ko-KR') + '원';
const CATEGORIES = ['가족', '파티', '추상', '협력', '전략'];

type Field = 'nameKo' | 'weight' | 'category' | 'recommendedPlayers' | 'purchasePrice' | 'sellPrice' | 'status';
/** 화면에서 고치는 값은 모두 글자로 들고 있다가, 칸을 떠날 때 서버로 보냅니다. */
interface Row {
  id: string;
  no: number;
  saved: Record<Field, string>;
  draft: Record<Field, string>;
}

const toRow = (g: LedgerRow): Row => {
  const v: Record<Field, string> = {
    nameKo: g.nameKo,
    weight: g.weight ? g.weight.toFixed(1) : '',
    category: g.category ?? '',
    recommendedPlayers: g.ownership?.recommendedPlayers ?? '',
    purchasePrice: g.ownership?.purchasePrice != null ? String(g.ownership.purchasePrice) : '',
    sellPrice: g.ownership?.sellPrice != null ? String(g.ownership.sellPrice) : '',
    status: g.ownership?.status ?? '보유',
  };
  return { id: g.id, no: g.no, saved: v, draft: { ...v } };
};

function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      auth.set((await api.login(password)).token);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="login panel" onSubmit={submit}>
      <div className="g11 eyebrow">▪ THE LEDGER</div>
      <h1 className="h1" style={{ fontSize: 30 }}>공방 장부 열기</h1>
      <label>
        <span className="lab">관리자 비밀번호</span>
        <input className="fld" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
      </label>
      {error && <div className="err" role="alert">{error}</div>}
      <button type="submit" className="btn-gold" disabled={busy || !password}>{busy ? '확인하는 중…' : '들어가기'}</button>
    </form>
  );
}

function Bgg({ onImported }: { onImported: (g: LedgerRow) => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<BggHit[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <section className="bgg panel" aria-label="BGG에서 가져오기">
      <div className="lab">BGG에서 가져오기</div>
      <form className="bgg-row" onSubmit={(e) => { e.preventDefault(); run('search', async () => setHits(await api.bggSearch(q))); }}>
        <input className="fld" type="search" placeholder="영문 게임 이름 (두 글자 이상)" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="submit" className="btn" disabled={busy !== null || q.trim().length < 2}>{busy === 'search' ? '찾는 중…' : 'BGG 검색'}</button>
      </form>
      {error && <div className="err" role="alert">{error}</div>}
      {hits && hits.length === 0 && <div className="dim">BGG에서 찾은 게임이 없어요.</div>}
      {hits && hits.length > 0 && (
        <div className="bgg-hits">
          {hits.map((h) => (
            <div key={h.bggId} className="bgg-hit">
              <span>{h.name}{h.year ? <span className="dim"> ({h.year})</span> : null}</span>
              <button type="button" className="btn" disabled={busy !== null} onClick={() => run(String(h.bggId), async () => onImported(await api.bggImport(h.bggId)))}>
                {busy === String(h.bggId) ? '가져오는 중…' : '장부에 가져오기'}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function Admin() {
  const [authed, setAuthed] = useState(!!auth.get());
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const fail = (e: unknown) => {
    if (e instanceof ApiError && e.status === 401) setAuthed(false);
    setError((e as Error).message);
  };
  const load = () => {
    setError(null);
    api.ledger().then((list) => setRows(list.map(toRow))).catch(fail);
  };
  useEffect(() => {
    if (authed) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const edit = (id: string, key: Field, value: string) => setRows((rs) => rs && rs.map((r) => (r.id === id ? { ...r, draft: { ...r.draft, [key]: value } } : r)));
  const save = async (row: Row, key: Field, value = row.draft[key]) => {
    if (value === row.saved[key]) return;
    setError(null);
    try {
      const fresh = toRow(await api.updateGame(row.id, { [key]: value }));
      setRows((rs) => rs && rs.map((r) => (r.id === row.id ? { ...fresh, draft: { ...r.draft, [key]: fresh.saved[key] } } : r)));
      setNote('저장했습니다.');
    } catch (e) {
      edit(row.id, key, row.saved[key]);
      fail(e);
    }
  };
  const add = async () => {
    setError(null);
    try {
      const fresh = toRow(await api.createGame({ nameKo: '새 게임' }));
      setRows((rs) => [...(rs ?? []), fresh]);
      setNote('새 줄을 추가했습니다. 이름을 고쳐 주세요.');
    } catch (e) {
      fail(e);
    }
  };
  const remove = async (row: Row) => {
    if (!window.confirm(`「${row.saved.nameKo}」을(를) 장부에서 지울까요? 되돌릴 수 없습니다.`)) return;
    setError(null);
    try {
      await api.deleteGame(row.id);
      setRows((rs) => rs && rs.filter((r) => r.id !== row.id));
      setNote('지웠습니다.');
    } catch (e) {
      fail(e);
    }
  };

  const exportAs = async (format: 'csv' | 'json') => {
    setError(null);
    try {
      await api.exportLedger(format);
      setNote(`장부를 ${format.toUpperCase()} 파일로 내보냈습니다.`);
    } catch (e) {
      fail(e);
    }
  };
  const importFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const format = /\.json$/i.test(file.name) ? 'json' : /\.csv$/i.test(file.name) ? 'csv' : null;
    if (!format) return setError('csv나 json 파일만 가져올 수 있습니다.');
    if (!window.confirm(`「${file.name}」을(를) 가져올까요?
같은 id의 게임은 파일 내용으로 덮어쓰고, 없는 게임은 새로 추가합니다. 파일에 없는 게임은 그대로 둡니다.`)) return;
    setError(null);
    setNote('가져오는 중…');
    try {
      const r = await api.importLedger(format, await file.text());
      setRows((await api.ledger()).map(toRow));
      setNote(`가져왔습니다. 새로 추가 ${r.inserted}개, 덮어쓰기 ${r.updated}개.${r.ignored.length ? ` 모르는 열은 건너뜀: ${r.ignored.join(', ')}` : ''}`);
    } catch (err) {
      setNote('');
      fail(err);
    }
  };

  const list = rows ?? [];
  const sum = (key: Field) => list.reduce((a, r) => a + (Number(r.saved[key].replace(/[^0-9]/g, '')) || 0), 0);
  const cell = (r: Row, key: Field, label: string, extra = '', props: Record<string, string> = {}) => (
    <div className="tc" role="cell">
      <input className={'cell ' + extra} aria-label={label} value={r.draft[key]} onChange={(e) => edit(r.id, key, e.target.value)} onBlur={() => save(r, key)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} {...props} />
    </div>
  );

  return (
    <Layout page="admin" footNote="가격은 이 화면에서만 보입니다">
      {!authed ? (
        <main className="wrap pad"><Login onDone={() => setAuthed(true)} /></main>
      ) : (
        <main className="wrap pad" style={{ paddingTop: 40 }}>
          <div className="adm-head">
            <div className="txt">
              <div className="g11 eyebrow">▪ THE LEDGER</div>
              <h1 className="h1">공방 장부</h1>
              <p>칸을 고치고 다른 곳을 누르면 바로 저장됩니다. 웨이트와 카테고리는 솥 추천의 기분 조건에 쓰입니다.</p>
            </div>
            <div className="adm-actions">
              <button type="button" className="btn" onClick={() => exportAs('csv')}>CSV 내보내기</button>
              <button type="button" className="btn" onClick={() => exportAs('json')}>JSON 내보내기</button>
              <label className="btn">
                가져오기
                <input type="file" accept=".csv,.json,text/csv,application/json" hidden onChange={importFile} />
              </label>
              <button type="button" className="btn" onClick={() => { auth.clear(); setAuthed(false); setRows(null); }}>로그아웃</button>
              <button type="button" className="btn-gold" onClick={add}>+ 행 추가</button>
            </div>
          </div>

          <div className="tiles">
            <div className="tile"><span className="dim">전체 행</span><b>{list.length}개</b></div>
            <div className="tile"><span className="dim">보유 중</span><b>{list.filter((r) => r.saved.status === '보유' || r.saved.status === '대여 중').length}개</b></div>
            <div className="tile"><span className="dim">구매 가격 합계</span><b>{won(sum('purchasePrice'))}</b></div>
            <div className="tile"><span className="dim">방출 가격 합계</span><b>{won(sum('sellPrice'))}</b></div>
          </div>

          <div role="status" aria-live="polite">{error ? <div className="err">{error}</div> : <div className="dim">{rows ? note || ' ' : '장부를 펴는 중…'}</div>}</div>

          <Bgg onImported={(g) => { setRows((rs) => { const fresh = toRow(g); const others = (rs ?? []).filter((r) => r.id !== g.id); return [...others, fresh].sort((a, b) => a.no - b.no); }); setNote(`「${g.nameKo}」을(를) 가져왔습니다.`); }} />

          <div className="sheet panel">
            <div className="sheet-in" role="table" aria-label="컬렉션 장부">
              <div className="trow letters" aria-hidden="true">
                <div className="tc" /><div className="tc">A</div><div className="tc">B</div><div className="tc">C</div><div className="tc">D</div><div className="tc">E</div><div className="tc">F</div><div className="tc">G</div><div className="tc" />
              </div>
              <div className="trow heads" role="row">
                <div className="tc th c" role="columnheader">#</div>
                <div className="tc th" role="columnheader">게임 이름</div>
                <div className="tc th r" role="columnheader">웨이트</div>
                <div className="tc th" role="columnheader">카테고리</div>
                <div className="tc th" role="columnheader">추천 인원</div>
                <div className="tc th r" role="columnheader">구매 가격 (원)</div>
                <div className="tc th r" role="columnheader">방출 가격 (원)</div>
                <div className="tc th" role="columnheader">상태</div>
                <div className="tc th c" role="columnheader">삭제</div>
              </div>
              {list.map((r, i) => (
                <div key={r.id} className="trow body" role="row">
                  <div className="tc rowno" role="cell">{i + 1}</div>
                  {cell(r, 'nameKo', '게임 이름')}
                  {cell(r, 'weight', '웨이트', 'num', { inputMode: 'decimal' })}
                  <div className="tc" role="cell">
                    <select className="cell" aria-label="카테고리" value={r.draft.category} style={{ color: r.draft.category ? categoryColor(r.draft.category) : 'var(--dim)' }} onChange={(e) => { edit(r.id, 'category', e.target.value); save(r, 'category', e.target.value); }}>
                      <option value="">미정</option>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  {cell(r, 'recommendedPlayers', '추천 인원')}
                  {cell(r, 'purchasePrice', '구매 가격', 'num', { inputMode: 'numeric' })}
                  {cell(r, 'sellPrice', '방출 가격', 'num', { inputMode: 'numeric', placeholder: '-' })}
                  <div className="tc" role="cell">
                    <select className="cell" aria-label="상태" value={r.draft.status} style={{ color: STATUS_COLOR[r.draft.status] }} onChange={(e) => { edit(r.id, 'status', e.target.value); save(r, 'status', e.target.value); }}>
                      <option value="보유">보유</option><option value="대여 중">대여 중</option><option value="방출 예정">방출 예정</option><option value="방출 완료">방출 완료</option>
                    </select>
                  </div>
                  <div className="tc" role="cell" style={{ textAlign: 'center' }}>
                    <button type="button" className="del" aria-label={`${r.saved.nameKo} 행 삭제`} onClick={() => remove(r)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="addrow" onClick={add}>+ 새 게임을 이 줄에 추가</button>
          </div>
          <p className="dim">좁은 화면에서는 표를 좌우로 밀어서 봅니다. 방출 완료로 바꾼 게임은 방문자 화면에서 빠집니다.</p>
        </main>
      )}
    </Layout>
  );
}
