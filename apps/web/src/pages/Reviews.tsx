import { api } from '../api';
import { BoxArt } from '../components/BoxArt';
import { Band, Layout, LoadState, Notice } from '../components/Layout';
import { useLoad } from '../useLoad';

const DAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

export function Reviews() {
  const { data, loading, error, reload } = useLoad(() => api.plays(), []);
  const plays = data ?? [];
  return (
    <Layout page="reviews" footNote={plays.some((p) => p.isSample) ? '날짜·이름·결과는 예시입니다' : undefined}>
      <Band label="THE PLAY LOG" title="함께 끓인 판" sub="누가 왔고, 무엇을 했고, 누가 이겼는지. 이 공방 테이블에서 벌어진 판을 한 장씩 적어 둡니다." pos="50% 46%" narrow />
      <main className="wrap narrow pad">
        {plays.some((p) => p.isSample) && <Notice>아직 첫 기록 전이에요. 아래는 이렇게 쌓일 예정인 예시 페이지입니다.</Notice>}
        <LoadState loading={loading} error={error} onRetry={reload} />
        {data && plays.length === 0 && <div className="state">아직 적어 둔 판이 없어요.</div>}
        {plays.map((p) => {
          const d = new Date(p.playedAt);
          return (
            <article key={p.id} className="log card">
              <div className="side niche">
                <div className="date">
                  <span className="dim">{d.getUTCFullYear()}</span>
                  <b>{String(d.getUTCMonth() + 1).padStart(2, '0')}.{String(d.getUTCDate()).padStart(2, '0')}</b>
                  <span className="dim">{DAYS[d.getUTCDay()]}</span>
                </div>
                <BoxArt name={p.gameName} category={p.game?.category ?? ''} iconKey={p.game?.iconKey} imageUrl={p.game?.imageUrl} unit={1} showTitle={false} />
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
              </div>
            </article>
          );
        })}
      </main>
    </Layout>
  );
}
