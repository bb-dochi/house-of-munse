import { useState } from 'react';
import { api, Mystery } from '../api';
import { EntryForm, FieldDef, isAdmin } from '../components/EntryForm';
import { Band, Layout, LoadState } from '../components/Layout';
import { useLoad } from '../useLoad';

const RANKS = ['S', 'A', 'B', 'C'];
const RANK_COLOR: Record<string, string> = { S: '#F3C969', A: '#C08CF0', B: '#5FC8F0', C: '#B9AAB8' };
const GM = { yes: 'GM 있음', no: 'GM 없음' };

const FIELDS: FieldDef[] = [
  { key: 'playedAt', label: '날짜', type: 'date' },
  { key: 'title', label: '게임 이름' },
  { key: 'players', label: '인원', placeholder: '6인' },
  { key: 'playTime', label: '플레이타임', placeholder: '3시간 30분' },
  { key: 'gm', label: 'GM', type: 'select', options: [GM.yes, GM.no] },
  { key: 'rank', label: '추천도', type: 'select', options: RANKS },
  { key: 'review', label: '리뷰 (스포일러 없이)', type: 'textarea', wide: true },
  { key: 'spoiler', label: '스포일러 메모 (눌러야 보여요)', type: 'textarea', wide: true },
];

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const toValues = (m?: Mystery): Record<string, string> =>
  m
    ? { playedAt: m.playedAt.slice(0, 10), title: m.title, players: m.players, playTime: m.playTime, gm: m.gm ? GM.yes : GM.no, rank: m.rank, review: m.review, spoiler: m.spoiler }
    : { playedAt: today(), title: '', players: '', playTime: '', gm: GM.yes, rank: 'A', review: '', spoiler: '' };
const toInput = (v: Record<string, string>) => ({ ...v, gm: v.gm === GM.yes });

export function Mysteries() {
  const { data, loading, error, reload, setData } = useLoad(() => api.mysteries(), []);
  const [rank, setRank] = useState<string>('all');
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [shown, setShown] = useState<Set<number>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const admin = isAdmin();
  const all = data ?? [];
  const list = rank === 'all' ? all : all.filter((m) => m.rank === rank);

  const refresh = async () => {
    setData(await api.mysteries());
    setEditing(null);
  };
  const remove = async (m: Mystery) => {
    if (!window.confirm(`「${m.title}」 후기를 지울까요? 되돌릴 수 없습니다.`)) return;
    setActionError(null);
    try {
      await api.deleteMystery(m.id);
      await refresh();
    } catch (e) {
      setActionError((e as Error).message);
    }
  };
  const toggle = (id: number) => setShown((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <Layout page="mysteries">
      <Band label="THE CASE FILES" title="머더미스터리 후기" sub="한 번 풀면 다시 열 수 없는 사건들. 스포일러는 접어 두었으니, 아직 안 해 본 사건이면 펼치지 마세요." pos="0% 30%" narrow />
      <main className="wrap narrow pad">
        <div className="rank-tabs" role="tablist" aria-label="추천도로 보기">
          {['all', ...RANKS].map((r) => (
            <button key={r} type="button" role="tab" aria-selected={rank === r} className={'rank-tab' + (rank === r ? ' on' : '')} style={r !== 'all' ? { color: RANK_COLOR[r] } : undefined} onClick={() => setRank(r)}>
              {r === 'all' ? '전체' : `${r} 랭크`} <span className="dim">{r === 'all' ? all.length : all.filter((m) => m.rank === r).length}</span>
            </button>
          ))}
        </div>
        {admin && editing !== 'new' && (
          <button type="button" className="btn-gold entry-add" onClick={() => setEditing('new')}>+ 후기 적기</button>
        )}
        {actionError && <div className="err" role="alert">{actionError}</div>}
        {editing === 'new' && (
          <EntryForm title="새 머더미스터리 후기" fields={FIELDS} initial={toValues()} onCancel={() => setEditing(null)} onSave={async (v) => { await api.createMystery(toInput(v)); await refresh(); }} />
        )}
        <LoadState loading={loading && !data} error={error} onRetry={reload} />
        {data && list.length === 0 && <div className="state">{all.length ? `${rank} 랭크 사건이 아직 없어요.` : '아직 적어 둔 사건이 없어요.'}</div>}
        {list.map((m) => {
          if (editing === m.id) {
            return <EntryForm key={m.id} title={`「${m.title}」 고치기`} fields={FIELDS} initial={toValues(m)} onCancel={() => setEditing(null)} onSave={async (v) => { await api.updateMystery(m.id, toInput(v)); await refresh(); }} />;
          }
          const open = shown.has(m.id);
          return (
            <article key={m.id} className="case card">
              <div className="case-rank niche" style={{ color: RANK_COLOR[m.rank] }}>
                <span className="g11 case-letter" aria-label={`추천도 ${m.rank}`}>{m.rank}</span>
                <span className="dim">{m.playedAt.slice(0, 10).replace(/-/g, '.')}</span>
              </div>
              <div className="case-main">
                <h2 className="name">{m.title}</h2>
                <div className="case-meta dim">{[m.players, m.playTime, m.gm ? GM.yes : GM.no].filter(Boolean).join(' · ')}</div>
                {m.review && <p className="memo">{m.review}</p>}
                {m.spoiler && (
                  <div className={'spoiler' + (open ? ' open' : '')}>
                    <button type="button" className="spoiler-btn" aria-expanded={open} onClick={() => toggle(m.id)}>
                      {open ? '▾ 스포일러 접기' : '▸ 스포일러 보기'}
                    </button>
                    {open && <p className="spoiler-text">{m.spoiler}</p>}
                  </div>
                )}
                {admin && (
                  <div className="entry-tools">
                    <button type="button" className="btn mini" onClick={() => setEditing(m.id)}>수정</button>
                    <button type="button" className="btn mini" onClick={() => remove(m)}>삭제</button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </main>
    </Layout>
  );
}
