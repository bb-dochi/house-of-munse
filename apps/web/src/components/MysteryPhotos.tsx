import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { api, ApiError, MysteryPhoto } from '../api';
import { shrink } from '../image';

const MAX_PHOTOS = 6;

interface Props {
  mysteryId: number;
  title: string;
  photos: MysteryPhoto[];
  admin: boolean;
  onChanged: () => Promise<void>;
}

/**
 * 후기 사진. 한 장씩 크게 보여 주고, 여러 장이면 밀어서(가로 스크롤 스냅) 또는 화살표로 넘깁니다.
 * 누르면 원래 비율로 크게 보고, 관리자는 여기서 바로 올리고 지웁니다. 사진이 없으면 관리자에게 올리기 단추만 보입니다.
 */
export function MysteryPhotos({ mysteryId, title, photos, admin, onChanged }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const [viewing, setViewing] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const count = photos.length;
  const cur = Math.min(at, Math.max(count - 1, 0));

  if (!count && !admin) return null;

  const slideTo = (i: number) => {
    const el = track.current;
    if (!el || !count) return;
    const n = (i + count) % count;
    // 처음↔끝으로 넘어갈 때는 여러 장을 미끄러지지 않고 바로 옮깁니다 (scroll-snap-stop이 중간에서 멈추게 합니다).
    el.scrollTo({ left: n * el.clientWidth, behavior: Math.abs(n - cur) === 1 ? 'smooth' : 'auto' });
    setAt(n);
  };
  const onScroll = () => {
    const el = track.current;
    if (el && el.clientWidth) setAt(Math.round(el.scrollLeft / el.clientWidth));
  };

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? '로그인이 끝났습니다. 컬렉션 관리에서 다시 로그인해 주세요.' : (e as Error).message);
    }
    // 일부만 올라갔어도 올라간 사진은 보이도록 늘 새로 받습니다.
    await onChanged().catch(() => undefined);
    setBusy(false);
  };
  const upload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])].slice(0, MAX_PHOTOS - count);
    e.target.value = '';
    if (files.length) run(async () => { for (const f of files) await api.addMysteryPhoto(mysteryId, await shrink(f, 1280)); });
  };
  const remove = () => photos[cur] && window.confirm('지금 보이는 사진을 지울까요?') && run(() => api.deleteMysteryPhoto(photos[cur].id));

  const tools = admin && (
    <div className="media-tools">
      {count < MAX_PHOTOS && (
        <label className={'btn mini cover-file' + (busy ? ' off' : '')}>
          {busy ? '올리는 중…' : `+ 사진 (${count}/${MAX_PHOTOS})`}
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={busy} onChange={upload} />
        </label>
      )}
      {count > 0 && <button type="button" className="btn mini" disabled={busy} onClick={remove}>이 사진 지우기</button>}
    </div>
  );

  if (!count) {
    return (
      <div className="media-empty">
        {tools}
        {error && <div className="err" role="alert">{error}</div>}
      </div>
    );
  }

  return (
    <div className="case-media">
      <div className="media-frame" role="group" aria-roledescription="사진 넘기기" aria-label={`${title} 사진 ${count}장`}>
        <div className="media-track" ref={track} onScroll={onScroll}>
          {photos.map((p, i) => (
            <button key={p.id} type="button" className="media-slide" aria-label={`${title} 사진 ${i + 1} 크게 보기`} onClick={() => setViewing(i)}>
              <img src={p.url} alt="" loading={i === 0 ? 'eager' : 'lazy'} decoding="async" draggable={false} />
            </button>
          ))}
        </div>
        {count > 1 && (
          <>
            <button type="button" className="media-nav prev" aria-label="이전 사진" onClick={() => slideTo(cur - 1)}>◂</button>
            <button type="button" className="media-nav next" aria-label="다음 사진" onClick={() => slideTo(cur + 1)}>▸</button>
            <span className="media-count g11">{cur + 1} / {count}</span>
          </>
        )}
      </div>
      {tools}
      {error && <div className="err" role="alert">{error}</div>}
      {viewing !== null && photos[viewing] && (
        <Lightbox title={title} photos={photos} index={viewing} onStep={(d) => setViewing((i) => (i === null ? i : (i + d + count) % count))} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}

function Lightbox({ title, photos, index, onStep, onClose }: { title: string; photos: MysteryPhoto[]; index: number; onStep: (d: number) => void; onClose: () => void }) {
  const many = photos.length > 1;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (many && e.key === 'ArrowRight') onStep(1);
      else if (many && e.key === 'ArrowLeft') onStep(-1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  return (
    <div className="modal photo-modal" role="dialog" aria-modal="true" aria-label={`${title} 사진`}>
      <button type="button" className="modal-back" aria-label="닫기" onClick={onClose} />
      <figure className="photo-view">
        <img src={photos[index].url} alt={`${title} 사진 ${index + 1}`} />
        <figcaption className="photo-bar">
          {many ? <button type="button" className="btn mini" onClick={() => onStep(-1)} aria-label="이전 사진">◂</button> : <span />}
          <span className="dim">{index + 1} / {photos.length}</span>
          {many ? <button type="button" className="btn mini" onClick={() => onStep(1)} aria-label="다음 사진">▸</button> : <span />}
          <button type="button" className="btn mini photo-close" onClick={onClose} autoFocus>닫기</button>
        </figcaption>
      </figure>
    </div>
  );
}
