import { CSSProperties, useState } from 'react';
import { api, Mystery } from '../api';
import { EntryForm, FieldDef, isAdmin } from '../components/EntryForm';
import { MysteryComments } from '../components/MysteryComments';
import { MysteryPhotos } from '../components/MysteryPhotos';
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

  // 사진·댓글이 바뀌면 고치던 입력 칸은 그대로 두고 목록만 새로 받습니다.
  const sync = async () => setData(await api.mysteries());
  const refresh = async () => {
    await sync();
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
              {r === 'all' ? '전체' : <>{r}<span className="rank-word"> 랭크</span></>} <span className="rank-n">{r === 'all' ? all.length : all.filter((m) => m.rank === r).length}</span>
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
          const day = m.playedAt.slice(0, 10);
          return (
            <article key={m.id} className="case card" style={{ '--rank': RANK_COLOR[m.rank] } as CSSProperties}>
              {/* 추천도는 카드 모서리에 붙인 띠 하나로만 보여 줍니다. */}
              <span className="g11 rank-ribbon" aria-label={`추천도 ${m.rank}`}>{m.rank}</span>
              <h2 className="case-title">{m.title}</h2>
              {/* 오른쪽 칸: 정보가 늘 맨 위, 사진은 그 아래. 사진이 없어도 정보 칸은 같은 자리·같은 크기입니다. */}
              <aside className="case-side" aria-label="사건 정보">
                <dl className="case-facts">
                  <div><dt>날짜</dt><dd><time dateTime={day}>{day.replace(/-/g, '.')}</time></dd></div>
                  {/* 칸이 비어도 자리를 지켜, 카드마다 정보의 모양과 순서가 같게 합니다. */}
                  <div><dt>인원</dt><dd>{m.players || '—'}</dd></div>
                  <div><dt>시간</dt><dd>{m.playTime || '—'}</dd></div>
                  <div><dt>GM</dt><dd>{m.gm ? '있음' : '없음'}</dd></div>
                </dl>
                <MysteryPhotos mysteryId={m.id} title={m.title} photos={m.photos} admin={admin} onChanged={sync} />
              </aside>
              <div className="case-body">
                {m.review && <p className="case-review">{m.review}</p>}
                {m.spoiler && (
                  <div className={'spoiler' + (open ? ' open' : '')}>
                    <button type="button" className="spoiler-btn" aria-expanded={open} onClick={() => toggle(m.id)}>
                      <span>{open ? '▾ 스포일러 접기' : '▸ 스포일러 보기'}</span>
                      {!open && <span className="spoiler-hint">결말·범인 포함</span>}
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
              <MysteryComments mysteryId={m.id} comments={m.comments} admin={admin} onChanged={sync} />
            </article>
          );
        })}
      </main>
    </Layout>
  );
}
