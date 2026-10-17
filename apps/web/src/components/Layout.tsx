import { ReactNode } from 'react';
import { auth } from '../api';
import { Link } from '../router';
import { sceneUrl, useTimeOfDay } from '../timeOfDay';

type Page = 'home' | 'collection' | 'reviews' | 'wishlist' | 'mysteries' | 'admin' | 'ask' | 'insta';

export function Layout({ page, count, children, footNote, footer = true }: { page: Page; count?: number; children: ReactNode; footNote?: string; footer?: boolean }) {
  const cur = (p: Page) => (page === p ? { className: 'nv on', 'aria-current': 'page' as const } : { className: 'nv' });
  // 게임 후기(/reviews)는 당분간 메뉴에서 뺐습니다. 주소로 들어가면 그대로 열립니다.
  const inMore = page === 'wishlist' || page === 'reviews' || page === 'ask';
  const inAdmin = page === 'admin' || page === 'insta';
  const dot = (p: Page) => (page === p ? <span className="nv-dot" aria-hidden="true">◆</span> : null);
  const admin = (
    <>
      <Link to="/admin" {...cur('admin')}>컬렉션 관리</Link>
      {/* 인스타 운영은 관리자로 로그인한 탭에서만 보입니다. 내용도 관리자 API로만 받습니다. */}
      {auth.get() && <Link to="/insta" {...cur('insta')}>인스타 운영</Link>}
    </>
  );
  const extra = (
    <>
      <Link to="/wishlist" {...cur('wishlist')}>위시리스트</Link>
      <Link to="/ask" {...cur('ask')}>공방지기와 대화</Link>
      <a href="https://bg-mpti-test.vercel.app/" target="_blank" rel="noreferrer" className="nv">미플 유형 테스트 ↗</a>
    </>
  );
  return (
    <div className="app g14">
      <header className="hd">
        {/* 홈은 로고로 갑니다. */}
        <Link to="/" className="brand" aria-label="HOUSE OF MUNSE 홈">
          <span className="g11 brand-name">HOUSE OF MUNSE</span>
          {(page === 'admin' || page === 'insta') && <span className="g11 brand-admin">ADMIN</span>}
        </Link>
        <nav aria-label="주 메뉴" className="hd-nav">
          <Link to="/collection" {...cur('collection')}>
            {dot('collection')}컬렉션{count !== undefined && <span className="g11 count">{count}</span>}
          </Link>
          <Link to="/mysteries" {...cur('mysteries')}>{dot('mysteries')}머더미스터리<span className="nv-long"> 후기</span></Link>
          <details className="more">
            <summary className={inMore ? 'nv on' : 'nv'}>{inMore && <span className="nv-dot" aria-hidden="true">◆</span>}기타 ▾</summary>
            <div className="more-menu">{extra}</div>
          </details>
        </nav>
        <details className="more adm-more">
          <summary className={inAdmin ? 'nv on' : 'nv'}>{inAdmin && <span className="nv-dot" aria-hidden="true">◆</span>}관리자 ▾</summary>
          <div className="more-menu">
            {admin}
          </div>
        </details>
        {/* 폰에서는 컬렉션만 밖에 두고 나머지 메뉴는 모두 여기로 접습니다. */}
        <span className="hd-quick">
          <Link to="/collection" {...cur('collection')}>컬렉션{count !== undefined && <span className="g11 count">{count}</span>}</Link>
        </span>
        <details className="more burger">
          <summary className="nv" aria-label="메뉴 열기">≡</summary>
          <div className="more-menu">
            <Link to="/mysteries" {...cur('mysteries')}>머더미스터리 후기</Link>
            {extra}
            <hr className="menu-sep" />
            <span className="g11 menu-lab">관리자</span>
            {admin}
          </div>
        </details>
      </header>
      {children}
      {footer && (
        <footer className="ft g11">
          <div>HANDCRAFTED MOMENTS, ONE POT AT A TIME.</div>
          {footNote && <div>{footNote}</div>}
          <a href="https://boardgamegeek.com" target="_blank" rel="noreferrer">Powered by BGG</a>
        </footer>
      )}
    </div>
  );
}

export function Band({ label, title, sub, pos, narrow, aside }: { label: string; title: string; sub: string; pos: string; narrow?: boolean; aside?: ReactNode }) {
  const scene = sceneUrl(useTimeOfDay());
  return (
    <section className="band" style={{ backgroundImage: `url(${scene})`, backgroundPosition: pos }}>
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
  if (loading) return <div className="state">선반을 살펴보는 중…</div>;
  return null;
}
