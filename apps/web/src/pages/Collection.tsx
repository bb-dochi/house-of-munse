import { useEffect, useState } from 'react';
import { api, Game, playersText } from '../api';
import { BoxArt } from '../components/BoxArt';
import { Band, Layout, LoadState } from '../components/Layout';
import { categoryColor } from '../pixel';
import { useLoad } from '../useLoad';

const EMPTY = { q: '', players: 'all', weight: 'all', category: 'all', sort: 'no' };
const shelfNo = (id: number) => 'HM-' + String(id).padStart(3, '0');

function Stats({ g }: { g: Game }) {
  return (
    <span className="stats">
      <span><span className="dim">인원</span><span className="v">{playersText(g)}</span></span>
      <span><span className="dim">시간</span><span className="v">{g.playTime}분</span></span>
      <span><span className="dim">웨이트</span><span className="v">{g.weight.toFixed(1)}</span></span>
      <span><span className="dim">평점</span><span className="v">{g.rating.toFixed(1)}</span></span>
    </span>
  );
}

export function Collection() {
  const [f, setF] = useState(EMPTY);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Game | null>(null);
  // 글자를 칠 때마다 요청하지 않도록 검색어만 조금 늦춰 반영합니다.
  useEffect(() => {
    const t = window.setTimeout(() => setF((x) => (x.q === q ? x : { ...x, q })), 250);
    return () => window.clearTimeout(t);
  }, [q]);
  const { data, loading, error, reload } = useLoad(() => api.games(f), [f]);
  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) => setF({ ...f, [key]: e.target.value });

  useEffect(() => {
    if (!sel) return;
    const on = (e: KeyboardEvent) => e.key === 'Escape' && setSel(null);
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [sel]);

  const items = data?.items ?? [];
  const weightWord = (w: number) => (w < 2 ? '가벼운' : w < 3 ? '적당히 생각하는' : '묵직한');

  return (
    <Layout page="collection" count={data?.total} footNote="게임 정보 출처: BoardGameGeek, 직접 입력">
      <Band
        label="THE SHELVES"
        title="공방의 서가"
        sub="HOUSE OF MUNSE 선반에 놓인 상자를 모두 꺼내 봅니다."
        pos="0% 22%"
        aside={data && <div className="g11 band-count">{items.length}<small> / {data.total} 상자</small></div>}
      />
      <main className="wrap pad">
        <form className="filters panel" onSubmit={(e) => e.preventDefault()}>
          <label className="wide"><span className="lab">검색</span>
            <input className="fld" type="search" placeholder="게임 이름, 영문명" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <label><span className="lab">인원</span>
            <select className="fld" value={f.players} onChange={set('players')}>
              <option value="all">전체</option><option value="1">1인</option><option value="2">2인</option><option value="3">3인</option><option value="4">4인</option><option value="5">5인</option><option value="6">6인 이상</option>
            </select>
          </label>
          <label><span className="lab">난이도</span>
            <select className="fld" value={f.weight} onChange={set('weight')}>
              <option value="all">전체</option><option value="light">가벼움 (2.0 미만)</option><option value="mid">보통 (2.0–2.9)</option><option value="heavy">묵직함 (3.0 이상)</option>
            </select>
          </label>
          <label><span className="lab">카테고리</span>
            <select className="fld" value={f.category} onChange={set('category')}>
              <option value="all">전체</option><option value="가족">가족</option><option value="파티">파티</option><option value="추상">추상</option><option value="협력">협력</option><option value="전략">전략</option>
            </select>
          </label>
          <label><span className="lab">정렬</span>
            <select className="fld" value={f.sort} onChange={set('sort')}>
              <option value="no">서가 번호순</option><option value="name">이름순</option><option value="rating">평점 높은 순</option><option value="light">웨이트 가벼운 순</option><option value="heavy">웨이트 무거운 순</option><option value="time">시간 짧은 순</option>
            </select>
          </label>
          <div className="end">
            <button type="button" className="btn" onClick={() => { setQ(''); setF(EMPTY); }}>초기화</button>
          </div>
        </form>

        <LoadState loading={loading && !data} error={error} onRetry={reload} />
        {data && !error && items.length === 0 && <div className="state">조건에 맞는 상자가 선반에 없어요.<br />조건을 조금 풀어 보세요.</div>}

        <div className="grid">
          {items.map((g) => (
            <button key={g.id} type="button" className="gcard card" onClick={() => setSel(g)}>
              <span className="niche">
                <span className="dim no">{shelfNo(g.id)}</span>
                <BoxArt name={g.nameKo} category={g.category} iconKey={g.iconKey} imageUrl={g.imageUrl} />
              </span>
              <span className="body">
                <span className="name">{g.nameKo}</span>
                <span className="sub">
                  <span className="dim">{g.nameEn}</span>
                  <span className="cat" style={{ borderColor: categoryColor(g.category) }}>{g.category}</span>
                </span>
                <span className="desc">{g.description}</span>
                <Stats g={g} />
              </span>
            </button>
          ))}
        </div>
      </main>

      {sel && (
        <div className="modal">
          <button type="button" className="modal-back" aria-label="상세 닫기" onClick={() => setSel(null)} />
          <div className="modal-box" role="dialog" aria-modal="true" aria-label={sel.nameKo}>
            <div className="modal-art niche">
              <BoxArt name={sel.nameKo} category={sel.category} iconKey={sel.iconKey} imageUrl={sel.imageUrl} unit={2.5} />
            </div>
            <div className="modal-info">
              <div className="modal-top">
                <div>
                  <div className="dim" style={{ color: 'var(--gold-dim)' }}>{shelfNo(sel.id)}</div>
                  <div className="name">{sel.nameKo}</div>
                  <div className="dim">{sel.nameEn} · {sel.category}</div>
                </div>
                <button type="button" className="x" aria-label="닫기" autoFocus onClick={() => setSel(null)}>✕</button>
              </div>
              <p style={{ lineHeight: 1.8, color: 'var(--text-2)' }}>{sel.description}</p>
              <Stats g={sel} />
              <div className="when g11">이럴 때 끓이세요: {playersText(sel)}이 모여 {sel.playTime}분쯤, {weightWord(sel.weight)} 판을 하고 싶을 때.</div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
