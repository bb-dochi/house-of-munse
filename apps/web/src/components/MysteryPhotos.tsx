import { ChangeEvent, useEffect, useState } from 'react';
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

/** 후기 사진 묶음. 누르면 크게 보고, 관리자는 여기서 바로 올리고 지웁니다. */
export function MysteryPhotos({ mysteryId, title, photos, admin, onChanged }: Props) {
  const [viewing, setViewing] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!photos.length && !admin) return null;

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
    const files = [...(e.target.files ?? [])].slice(0, MAX_PHOTOS - photos.length);
    e.target.value = '';
    if (files.length) run(async () => { for (const f of files) await api.addMysteryPhoto(mysteryId, await shrink(f, 1280)); });
  };
  const remove = (p: MysteryPhoto) => window.confirm('이 사진을 지울까요?') && run(() => api.deleteMysteryPhoto(p.id));

  return (
    <div className="case-photos">
      {photos.length > 0 && (
        <ul className={'photo-grid' + (photos.length === 1 ? ' one' : photos.length === 2 ? ' two' : '')}>
          {photos.map((p, i) => (
            <li key={p.id}>
              <button type="button" className="photo-thumb" aria-label={`${title} 사진 ${i + 1} 크게 보기`} onClick={() => setViewing(i)}>
                <img src={p.url} alt="" loading="lazy" decoding="async" />
              </button>
              {admin && <button type="button" className="photo-del" aria-label={`사진 ${i + 1} 지우기`} disabled={busy} onClick={() => remove(p)}>×</button>}
            </li>
          ))}
        </ul>
      )}
      {admin && photos.length < MAX_PHOTOS && (
        <label className={'btn mini cover-file photo-add' + (busy ? ' off' : '')}>
          {busy ? '올리는 중…' : `+ 사진 (${photos.length}/${MAX_PHOTOS})`}
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={busy} onChange={upload} />
        </label>
      )}
      {error && <div className="err" role="alert">{error}</div>}
      {viewing !== null && photos[viewing] && <Lightbox title={title} photos={photos} index={viewing} onStep={(d) => setViewing((i) => (i === null ? i : (i + d + photos.length) % photos.length))} onClose={() => setViewing(null)} />}
    </div>
  );
}

function Lightbox({ title, photos, index, onStep, onClose }: { title: string; photos: MysteryPhoto[]; index: number; onStep: (d: number) => void; onClose: () => void }) {
  const many = photos.length > 1;
  const go = onStep;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (many && e.key === 'ArrowRight') go(1);
      else if (many && e.key === 'ArrowLeft') go(-1);
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
          {many ? <button type="button" className="btn mini" onClick={() => go(-1)} aria-label="이전 사진">◂</button> : <span />}
          <span className="dim">{index + 1} / {photos.length}</span>
          {many ? <button type="button" className="btn mini" onClick={() => go(1)} aria-label="다음 사진">▸</button> : <span />}
          <button type="button" className="btn mini photo-close" onClick={onClose} autoFocus>닫기</button>
        </figcaption>
      </figure>
    </div>
  );
}
