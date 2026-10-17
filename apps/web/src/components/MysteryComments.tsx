import { FormEvent, useState } from 'react';
import { api, ApiError, MysteryComment } from '../api';

// 서버(worker/comments.ts)와 같은 한도입니다. 최종 검사는 서버가 합니다.
const MAX_NAME = 20;
const MAX_BODY = 500;

interface Props {
  mysteryId: number;
  comments: MysteryComment[];
  admin: boolean;
  onChanged: () => Promise<void>;
}

const when = (iso: string) => iso.slice(0, 10).replace(/-/g, '.');

/** 누구나 남기는 후기 댓글. 처음엔 접어 두어 후기 목록을 훑기 쉽게 하고, 스포일러 댓글은 눌러야 보입니다. */
export function MysteryComments({ mysteryId, comments, admin, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<Set<number>>(new Set());
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const panel = `case-cmt-${mysteryId}`;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await api.leaveMysteryComment(mysteryId, { name, body, spoiler, website });
      setBody('');
      setSpoiler(false);
      setDone(true);
      await onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  };
  const remove = async (c: MysteryComment) => {
    if (!window.confirm('이 댓글을 지울까요?')) return;
    setError(null);
    try {
      await api.deleteMysteryComment(c.id);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? '로그인이 끝났습니다. 컬렉션 관리에서 다시 로그인해 주세요.' : (err as Error).message);
    }
  };
  const reveal = (id: number) => setShown((s) => new Set(s).add(id));

  return (
    <section className="case-cmts" aria-label="댓글">
      <button type="button" className="cmt-toggle" aria-expanded={open} aria-controls={panel} onClick={() => setOpen(!open)}>
        <span>{open ? '▾' : '▸'} 댓글 <b>{comments.length}</b></span>
        {!open && <span className="dim">{comments.length ? '펼쳐서 읽기·남기기' : '첫 댓글 남기기'}</span>}
      </button>
      {open && (
        <div id={panel} className="cmt-panel">
          {comments.length > 0 && (
            <ul className="cmt-list">
              {comments.map((c) => {
                const hidden = c.spoiler && !shown.has(c.id);
                return (
                  <li key={c.id} className={'cmt' + (c.spoiler ? ' spoil' : '')}>
                    <div className="cmt-head">
                      <b className="cmt-name">{c.name}</b>
                      <span className="dim">{when(c.createdAt)}</span>
                      {c.spoiler && <span className="cmt-tag">스포</span>}
                      {admin && <button type="button" className="btn mini cmt-del" onClick={() => remove(c)}>삭제</button>}
                    </div>
                    {hidden ? (
                      <button type="button" className="cmt-veil" onClick={() => reveal(c.id)}>
                        <span className="cmt-blur" aria-hidden="true">{c.body}</span>
                        <span className="cmt-veil-lab">스포일러 댓글 · 눌러서 보기</span>
                      </button>
                    ) : (
                      <p className="cmt-body">{c.body}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <form className="cmt-form" onSubmit={submit}>
            <input className="fld cmt-name-fld" value={name} maxLength={MAX_NAME} placeholder="이름 (비우면 익명)" aria-label="이름" onChange={(e) => setName(e.target.value)} />
            <textarea className="fld cmt-body-fld" value={body} maxLength={MAX_BODY} rows={3} required placeholder="이 사건 해 보셨나요? 감상을 남겨 주세요." aria-label="댓글" onChange={(e) => { setBody(e.target.value); setDone(false); }} />
            {/* 사람 눈에는 보이지 않는 칸. 봇이 채우면 서버가 저장하지 않습니다. */}
            <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} />
            <div className="cmt-foot">
              <label className="qbox-check cmt-spoil">
                <input type="checkbox" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)} />
                <span>스포일러가 있어요 <span className="dim">(가려서 보여요)</span></span>
              </label>
              <span className="dim cmt-count">{[...body].length}/{MAX_BODY}</span>
              <button type="submit" className="btn-gold cmt-send" disabled={busy || !body.trim()}>{busy ? '남기는 중…' : '댓글 남기기'}</button>
            </div>
            {error && <div className="err" role="alert">{error}</div>}
            {done && <div className="cmt-done" role="status">댓글을 남겼어요.</div>}
          </form>
        </div>
      )}
    </section>
  );
}
