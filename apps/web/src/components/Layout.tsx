import { ReactNode } from 'react';
import { Link } from '../router';

type Page = 'home' | 'collection' | 'reviews' | 'wishlist' | 'admin';

export function Layout({ page, count, children, footNote }: { page: Page; count?: number; children: ReactNode; footNote?: string }) {
  const cur = (p: Page) => (page === p ? { className: 'nv on', 'aria-current': 'page' as const } : { className: 'nv' });
  const dot = (p: Page) => (page === p ? <span className="nv-dot" aria-hidden="true">◆</span> : null);
  return (
    <div className="app g14">
      <header className="hd">
        <Link to="/" className="brand">
          <span className="g11 brand-name">HOUSE OF MUNSE</span>
          {page === 'admin' ? <span className="g11 brand-admin">ADMIN</span> : <span className="brand-star" aria-hidden="true">✦</span>}
        </Link>
        <nav aria-label="주 메뉴" className="hd-nav">
          <Link to="/" {...cur('home')}>{dot('home')}공방</Link>
          <Link to="/collection" {...cur('collection')}>
            {dot('collection')}컬렉션{count !== undefined && <span className="g11 count">{count}</span>}
          </Link>
          <Link to="/reviews" {...cur('reviews')}>{dot('reviews')}게임 후기</Link>
          <details className="more">
            <summary className={page === 'wishlist' ? 'nv on' : 'nv'}>{dot('wishlist')}기타 ▾</summary>
            <div className="more-menu">
              <Link to="/wishlist" {...cur('wishlist')}>위시리스트</Link>
            </div>
          </details>
        </nav>
        <Link to="/admin" className={page === 'admin' ? 'nv on adm' : 'nv adm'}>{dot('admin')}컬렉션 관리</Link>
      </header>
      {children}
      <footer className="ft g11">
        <div>HANDCRAFTED MOMENTS, ONE POT AT A TIME.</div>
        {footNote && <div>{footNote}</div>}
        <a href="https://boardgamegeek.com" target="_blank" rel="noreferrer">Powered by BGG</a>
      </footer>
    </div>
  );
}

export function Band({ label, title, sub, pos, narrow, aside }: { label: string; title: string; sub: string; pos: string; narrow?: boolean; aside?: ReactNode }) {
  return (
    <section className="band" style={{ backgroundPosition: pos }}>
      <div className="band-in pad">
        <div className={'band-row ' + (narrow ? 'narrow' : '')}>
          <div className="band-text">
            <div className="g11 eyebrow">▪ {label}</div>
            <h1 className="h1">{title}</h1>
            <p>{sub}</p>
          </div>
          {aside}
        </div>
      </div>
    </section>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="g11 notice">
      <span aria-hidden="true" className="notice-dot">■ </span>
      {children}
    </div>
  );
}

export function LoadState({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry: () => void }) {
  if (error)
    return (
      <div className="state">
        {error}
        <button type="button" className="btn" onClick={onRetry}>다시 불러오기</button>
      </div>
    );
  if (loading) return <div className="state">선반을 살펴보는 중…<span className="g11 state-sub">서버가 잠들어 있었다면 깨어나는 데 1분쯤 걸릴 수 있어요.</span></div>;
  return null;
}
