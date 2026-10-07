import { useState } from 'react';
import { api, Play } from '../api';
import { Cover } from '../components/Cover';
import { EntryForm, FieldDef, isAdmin } from '../components/EntryForm';
import { Band, Layout, LoadState, Notice } from '../components/Layout';
import { useLoad } from '../useLoad';

const DAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

const FIELDS: FieldDef[] = [
  { key: 'playedAt', label: '날짜', type: 'date' },
  { key: 'gameName', label: '게임 이름', placeholder: '장부의 이름과 같으면 표지가 붙어요' },
  { key: 'gameNameEn', label: '영문 이름' },
  { key: 'players', label: '함께한 사람', placeholder: '문세, 하린, 도윤' },
  { key: 'winner', label: '우승' },
  { key: 'duration', label: '걸린 시간', placeholder: '70분' },
  { key: 'again', label: '또 할래요 (0~5)', type: 'number' },
  { key: 'memo', label: '한 줄 후기', type: 'textarea', wide: true },
];

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const toValues = (p?: Play): Record<string, string> =>
  p
    ? { playedAt: p.playedAt.slice(0, 10), gameName: p.gameName, gameNameEn: p.gameNameEn, players: p.players, winner: p.winner, duration: p.duration, again: String(p.again), memo: p.memo }
    : { playedAt: today(), gameName: '', gameNameEn: '', players: '', winner: '', duration: '', again: '3', memo: '' };

export function Reviews() {
  const { data, loading, error, reload, setData } = useLoad(() => api.plays(), []);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const admin = isAdmin();
  const plays = data ?? [];

  const refresh = async () => {
    setData(await api.plays());
    setEditing(null);
  };
  const remove = async (p: Play) => {
    if (!window.confirm(`${p.playedAt.slice(0, 10)} 「${p.gameName}」 후기를 지울까요? 되돌릴 수 없습니다.`)) return;
    setActionError(null);
    try {
      await api.deletePlay(p.id);
      await refresh();
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  return (
    <Layout page="reviews" footNote={plays.some((p) => p.isSample) ? '날짜·이름·결과는 예시입니다' : undefined}>
      <Band label="THE PLAY LOG" title="함께 끓인 판" sub="누가 왔고, 무엇을 했고, 누가 이겼는지. 이 공방 테이블에서 벌어진 판을 한 장씩 적어 둡니다." pos="50% 46%" narrow />
      <main className="wrap narrow pad">
        {plays.some((p) => p.isSample) && <Notice>아직 첫 기록 전이에요. 아래는 이렇게 쌓일 예정인 예시 페이지입니다.</Notice>}
        {admin && editing !== 'new' && (
          <button type="button" className="btn-gold entry-add" onClick={() => setEditing('new')}>+ 후기 적기</button>
        )}
        {actionError && <div className="err" role="alert">{actionError}</div>}
        {editing === 'new' && (
          <EntryForm title="새 후기" fields={FIELDS} initial={toValues()} onCancel={() => setEditing(null)} onSave={async (v) => { await api.createPlay(v); await refresh(); }} />
        )}
        <LoadState loading={loading && !data} error={error} onRetry={reload} />
        {data && plays.length === 0 && <div className="state">아직 적어 둔 판이 없어요.</div>}
        {plays.map((p) => {
          if (editing === p.id) {
            return <EntryForm key={p.id} title={`「${p.gameName}」 후기 고치기`} fields={FIELDS} initial={toValues(p)} onCancel={() => setEditing(null)} onSave={async (v) => { await api.updatePlay(p.id, v); await refresh(); }} />;
          }
          const d = new Date(p.playedAt);
          return (
            <article key={p.id} className="log card">
              <div className="side niche">
                <div className="date">
                  <span className="dim">{d.getUTCFullYear()}</span>
                  <b>{String(d.getUTCMonth() + 1).padStart(2, '0')}.{String(d.getUTCDate()).padStart(2, '0')}</b>
                  <span className="dim">{DAYS[d.getUTCDay()]}</span>
                </div>
                <Cover imageUrl={p.game?.imageUrl} />
              </div>
              <div className="main">
                <div className="top">
                  <h2 className="name">{p.gameName}</h2>
                  <span className="dim">{p.gameNameEn}</span>
                </div>
                <p className="memo">“{p.memo}”</p>
                <div className="facts">
                  <div><span className="dim">함께한 사람</span><span>{p.players}</span></div>
                  <div><span className="dim">우승</span><span style={{ color: 'var(--gold)' }}>{p.winner}</span></div>
                  <div><span className="dim">걸린 시간</span><span>{p.duration}</span></div>
                  <div><span className="dim">또 할래요</span><span>{p.again} / 5</span></div>
                </div>
                {admin && (
                  <div className="entry-tools">
                    <button type="button" className="btn mini" onClick={() => setEditing(p.id)}>수정</button>
                    <button type="button" className="btn mini" onClick={() => remove(p)}>삭제</button>
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
