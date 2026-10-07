import { api } from '../api';
import { Band, Layout, LoadState, Notice } from '../components/Layout';
import { useLoad } from '../useLoad';

const BRIGHT: Record<string, string> = { 가족: '#E0B15A', 파티: '#F08060', 추상: '#A77BF0', 협력: '#70E8A0', 전략: '#5FC8F0' };

export function Wishlist() {
  const { data, loading, error, reload } = useLoad(() => api.wishlist(), []);
  const wishes = data ?? [];
  return (
    <Layout page="wishlist" footNote={wishes.some((w) => w.isSample) ? '목록과 가격은 예시입니다' : undefined}>
      <Band label="THE WISHLIST" title="다음에 끓일 재료" sub="선반에 빈자리가 생기면 채우고 싶은 상자들. 왜 갖고 싶은지 한 줄씩 적어 둡니다." pos="100% 24%" />
      <main className="wrap pad">
        {wishes.some((w) => w.isSample) && <Notice>지금 보이는 칸은 예시예요. 진짜 목록은 곧 여기에 적힙니다.</Notice>}
        <LoadState loading={loading} error={error} onRetry={reload} />
        {data && wishes.length === 0 && <div className="state">아직 적어 둔 위시가 없어요.</div>}
        <div className="wgrid">
          {wishes.map((w) => {
            const col = BRIGHT[w.category] ?? '#B9AAB8';
            return (
              <article key={w.id} className="wish card">
                <div className="top niche">
                  <div>
                    <span className="no" style={{ color: col }}>{String(w.priority).padStart(2, '0')}</span>
                    <span className={'st ' + (w.status === '곧 주문' ? 'soon' : w.status === '세일 기다리는 중' ? 'wait' : '')}>{w.status}</span>
                  </div>
                  <div className="empty" aria-hidden="true" style={{ borderColor: col, color: col }}>?</div>
                </div>
                <div className="body">
                  <h2 className="name">{w.nameKo}</h2>
                  <div className="dim">{w.nameEn} · {w.category}</div>
                  <p className="why">{w.reason}</p>
                  <div className="foot">
                    <span className="dim">{w.players} · {w.playTime}분 · {w.weight.toFixed(1)}</span>
                    <span style={{ color: 'var(--gold)' }}>{w.expectedPrice}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </Layout>
  );
}
