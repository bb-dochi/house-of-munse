import { useState } from 'react';
import { api, BggHit } from '../api';

interface Props {
  /** 결과 옆 단추 글자 (예: "장부에 가져오기") */
  actionLabel: string;
  onPick: (hit: BggHit) => Promise<void>;
}

/** BGG 영문 이름 검색. 장부 가져오기와 위시 추가가 함께 씁니다. BGG 토큰이 없으면 서버 오류 문구를 그대로 보여 줍니다. */
export function BggSearch({ actionLabel, onPick }: Props) {
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
    <section className="bgg panel" aria-label="BGG에서 찾기">
      <div className="lab">BGG에서 찾기</div>
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
              <button type="button" className="btn" disabled={busy !== null} onClick={() => run(String(h.bggId), () => onPick(h))}>
                {busy === String(h.bggId) ? '가져오는 중…' : actionLabel}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
