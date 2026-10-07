import { useState } from 'react';
import { api, Wish } from '../api';
import { EntryForm, FieldDef, isAdmin } from '../components/EntryForm';
import { Band, Layout, LoadState, Notice } from '../components/Layout';
import { useLoad } from '../useLoad';

const BRIGHT: Record<string, string> = { 가족: '#E0B15A', 파티: '#F08060', 추상: '#A77BF0', 협력: '#70E8A0', 전략: '#5FC8F0' };

const FIELDS: FieldDef[] = [
  { key: 'priority', label: '순위', type: 'number' },
  { key: 'nameKo', label: '게임 이름' },
  { key: 'nameEn', label: '영문 이름' },
  { key: 'category', label: '카테고리', type: 'select', options: ['', '가족', '파티', '추상', '협력', '전략'] },
  { key: 'status', label: '상태', type: 'select', options: ['곧 주문', '세일 기다리는 중', '고민 중'] },
  { key: 'players', label: '인원', placeholder: '1–4인' },
  { key: 'playTime', label: '시간 (분)', type: 'number' },
  { key: 'weight', label: '웨이트 (0~5)', placeholder: '2.5' },
  { key: 'expectedPrice', label: '예상 가격', placeholder: '예상 5만 원대' },
  { key: 'reason', label: '갖고 싶은 이유', type: 'textarea', wide: true },
];

const toValues = (w: Wish | undefined, nextPriority: number): Record<string, string> =>
  w
    ? { priority: String(w.priority), nameKo: w.nameKo, nameEn: w.nameEn, category: w.category, status: w.status, players: w.players, playTime: String(w.playTime), weight: w.weight ? w.weight.toFixed(1) : '', expectedPrice: w.expectedPrice, reason: w.reason }
    : { priority: String(nextPriority), nameKo: '', nameEn: '', category: '', status: '고민 중', players: '', playTime: '0', weight: '', expectedPrice: '', reason: '' };

export function Wishlist() {
  const { data, loading, error, reload, setData } = useLoad(() => api.wishlist(), []);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const admin = isAdmin();
  const wishes = data ?? [];
  const nextPriority = wishes.reduce((m, w) => Math.max(m, w.priority), 0) + 1;

  const refresh = async () => {
    setData(await api.wishlist());
    setEditing(null);
  };
  const remove = async (w: Wish) => {
    if (!window.confirm(`위시 「${w.nameKo}」을(를) 지울까요? 되돌릴 수 없습니다.`)) return;
    setActionError(null);
    try {
      await api.deleteWish(w.id);
      await refresh();
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  return (
    <Layout page="wishlist" footNote={wishes.some((w) => w.isSample) ? '목록과 가격은 예시입니다' : undefined}>
      <Band label="THE WISHLIST" title="다음에 끓일 재료" sub="선반에 빈자리가 생기면 채우고 싶은 상자들. 왜 갖고 싶은지 한 줄씩 적어 둡니다." pos="100% 24%" />
      <main className="wrap pad">
        {wishes.some((w) => w.isSample) && <Notice>지금 보이는 칸은 예시예요. 진짜 목록은 곧 여기에 적힙니다.</Notice>}
        {admin && editing !== 'new' && (
          <button type="button" className="btn-gold entry-add" onClick={() => setEditing('new')}>+ 위시 추가</button>
        )}
        {actionError && <div className="err" role="alert">{actionError}</div>}
        {editing === 'new' && (
          <EntryForm title="새 위시" fields={FIELDS} initial={toValues(undefined, nextPriority)} onCancel={() => setEditing(null)} onSave={async (v) => { await api.createWish(v); await refresh(); }} />
        )}
        <LoadState loading={loading && !data} error={error} onRetry={reload} />
        {data && wishes.length === 0 && <div className="state">아직 적어 둔 위시가 없어요.</div>}
        {typeof editing === 'number' && (() => {
          const w = wishes.find((x) => x.id === editing);
          return w ? <EntryForm title={`「${w.nameKo}」 고치기`} fields={FIELDS} initial={toValues(w, nextPriority)} onCancel={() => setEditing(null)} onSave={async (v) => { await api.updateWish(w.id, v); await refresh(); }} /> : null;
        })()}
        <div className="wgrid">
          {wishes.map((w) => {
            const col = BRIGHT[w.category] ?? '#B9AAB8';
            return (
              <article key={w.id} className={'wish card' + (editing === w.id ? ' editing' : '')}>
                <div className="top niche">
                  <div>
                    <span className="no" style={{ color: col }}>{String(w.priority).padStart(2, '0')}</span>
                    <span className={'st ' + (w.status === '곧 주문' ? 'soon' : w.status === '세일 기다리는 중' ? 'wait' : '')}>{w.status}</span>
                  </div>
                  <div className="empty" aria-hidden="true" style={{ borderColor: col, color: col }}>?</div>
                </div>
                <div className="body">
                  <h2 className="name">{w.nameKo}</h2>
                  <div className="dim">{[w.nameEn, w.category].filter(Boolean).join(' · ')}</div>
                  <p className="why">{w.reason}</p>
                  <div className="foot">
                    <span className="dim">{[w.players, w.playTime ? `${w.playTime}분` : '', w.weight ? w.weight.toFixed(1) : ''].filter(Boolean).join(' · ')}</span>
                    <span style={{ color: 'var(--gold)' }}>{w.expectedPrice}</span>
                  </div>
                  {admin && (
                    <div className="entry-tools">
                      <button type="button" className="btn mini" onClick={() => setEditing(w.id)}>수정</button>
                      <button type="button" className="btn mini" onClick={() => remove(w)}>삭제</button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </Layout>
  );
}
