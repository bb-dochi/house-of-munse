import { useState } from 'react';
import { api, BggHit, playersText, weightNumber, Wish } from '../api';
import { BggSearch } from '../components/BggSearch';
import { Cover } from '../components/Cover';
import { EntryForm, FieldDef, isAdmin } from '../components/EntryForm';
import { Band, Layout, LoadState, Notice } from '../components/Layout';
import { useLoad } from '../useLoad';

const BRIGHT: Record<string, string> = { 가족: '#E0B15A', 파티: '#F08060', 협력: '#70E8A0', 전략: '#5FC8F0', 머더미스터리: '#A77BF0' };

const FIELDS: FieldDef[] = [
  { key: 'priority', label: '순위', type: 'number' },
  { key: 'nameKo', label: '게임 이름' },
  { key: 'nameEn', label: '영문 이름' },
  { key: 'category', label: '카테고리', type: 'select', options: ['', '전략', '가족', '파티', '협력', '머더미스터리'] },
  { key: 'status', label: '상태', type: 'select', options: ['곧 주문', '세일 기다리는 중', '고민 중'] },
  { key: 'players', label: '인원', placeholder: '1–4인' },
  { key: 'playTime', label: '시간 (분)', type: 'number' },
  { key: 'weight', label: '웨이트 (0~5)', placeholder: '2.5' },
];

// bggId·imageUrl은 입력 칸 없이 BGG에서 고른 값을 그대로 함께 저장합니다.
const toValues = (w: Wish | undefined, nextPriority: number): Record<string, string> =>
  w
    ? { priority: String(w.priority), nameKo: w.nameKo, nameEn: w.nameEn, category: w.category, status: w.status, players: w.players, playTime: String(w.playTime), weight: w.weight ? String(w.weight) : '', bggId: String(w.bggId ?? ''), imageUrl: w.imageUrl ?? '' }
    : { priority: String(nextPriority), nameKo: '', nameEn: '', category: '', status: '고민 중', players: '', playTime: '0', weight: '', bggId: '', imageUrl: '' };

export function Wishlist() {
  const { data, loading, error, reload, setData } = useLoad(() => api.wishlist(), []);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // BGG에서 고르면 입력 칸을 그 값으로 다시 채웁니다. key를 바꿔 입력 칸을 새로 그립니다.
  const [seed, setSeed] = useState<{ key: number; values: Record<string, string> } | null>(null);
  const admin = isAdmin();
  const wishes = data ?? [];
  const nextPriority = wishes.reduce((m, w) => Math.max(m, w.priority), 0) + 1;

  const refresh = async () => {
    setData(await api.wishlist());
    close();
  };
  const open = (target: number | 'new') => {
    setSeed(null);
    setEditing(target);
  };
  const close = () => {
    setSeed(null);
    setEditing(null);
  };
  /** 고른 BGG 게임으로 칸을 채웁니다. 순위·상태처럼 BGG에 없는 칸은 지금 값을 둡니다. */
  const fill = async (h: BggHit, current: Record<string, string>) => {
    const g = await api.bggThing(h.bggId);
    const values = {
      ...current,
      nameKo: g.nameKo,
      nameEn: g.nameEn,
      category: g.category,
      players: g.minPlayers > 0 ? playersText(g) : '',
      playTime: String(g.playTime),
      weight: g.weight ? String(g.weight) : '',
      bggId: String(g.bggId),
      imageUrl: g.imageUrl ?? '',
    };
    setSeed({ key: Date.now(), values });
  };
  const form = (title: string, base: Record<string, string>, onSave: (v: Record<string, string>) => Promise<unknown>) => {
    const initial = seed?.values ?? base;
    return (
      <>
        <BggSearch actionLabel="이 게임으로 채우기" onPick={(h) => fill(h, initial)} />
        <EntryForm key={seed?.key ?? 0} title={title} fields={FIELDS} initial={initial} onCancel={close} onSave={async (v) => { await onSave(v); await refresh(); }} />
      </>
    );
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
    <Layout page="wishlist" footNote={wishes.some((w) => w.isSample) ? '목록은 예시입니다' : undefined}>
      <Band label="THE WISHLIST" title="다음에 끓일 재료" sub="선반에 빈자리가 생기면 채우고 싶은 상자들." pos="100% 24%" />
      <main className="wrap pad">
        {wishes.some((w) => w.isSample) && <Notice>지금 보이는 칸은 예시예요. 진짜 목록은 곧 여기에 적힙니다.</Notice>}
        {admin && editing !== 'new' && (
          <button type="button" className="btn-gold entry-add" onClick={() => open('new')}>+ 위시 추가</button>
        )}
        {actionError && <div className="err" role="alert">{actionError}</div>}
        {editing === 'new' && form('새 위시', toValues(undefined, nextPriority), (v) => api.createWish(v))}
        <LoadState loading={loading && !data} error={error} onRetry={reload} />
        {data && wishes.length === 0 && <div className="state">아직 적어 둔 위시가 없어요.</div>}
        {typeof editing === 'number' && (() => {
          const w = wishes.find((x) => x.id === editing);
          return w ? form(`「${w.nameKo}」 고치기`, toValues(w, nextPriority), (v) => api.updateWish(w.id, v)) : null;
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
                  {w.imageUrl ? (
                    <Cover imageUrl={w.imageUrl} className="wish-cover" />
                  ) : (
                    <div className="empty" aria-hidden="true" style={{ borderColor: col, color: col }}>?</div>
                  )}
                </div>
                <div className="body">
                  <h2 className="name">{w.nameKo}</h2>
                  <div className="dim">{[w.nameEn, w.category].filter(Boolean).join(' · ')}</div>
                  <div className="foot">
                    <span className="dim">{[w.players, w.playTime ? `${w.playTime}분` : '', w.weight ? `웨이트 ${weightNumber(w.weight)}` : ''].filter(Boolean).join(' · ')}</span>
                    {w.bggId && <a href={`https://boardgamegeek.com/boardgame/${w.bggId}`} target="_blank" rel="noreferrer">BGG</a>}
                  </div>
                  {admin && (
                    <div className="entry-tools">
                      <button type="button" className="btn mini" onClick={() => open(w.id)}>수정</button>
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
