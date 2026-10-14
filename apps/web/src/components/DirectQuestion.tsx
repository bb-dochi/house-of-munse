import { FormEvent, ReactNode, useEffect, useState } from "react";
import { api, MyQuestion, PublicQna } from "../api";

// 내가 남긴 질문의 확인 열쇠는 이 브라우저에만 기억합니다. 저장소를 못 쓰면 링크로만 확인할 수 있습니다.
const MINE_KEY = "munse-my-questions";
const MAX_BODY = 500;

export const myTokens = (): string[] => {
    try {
        const v = JSON.parse(localStorage.getItem(MINE_KEY) ?? "[]");
        return Array.isArray(v) ? v.filter((t) => typeof t === "string") : [];
    } catch {
        return [];
    }
};
export const rememberToken = (token: string) => {
    try {
        localStorage.setItem(MINE_KEY, JSON.stringify([token, ...myTokens().filter((t) => t !== token)].slice(0, 20)));
    } catch {
        // 저장하지 못해도 확인 링크는 화면에 보여 줍니다.
    }
};
const forgetToken = (token: string) => {
    try {
        localStorage.setItem(MINE_KEY, JSON.stringify(myTokens().filter((t) => t !== token)));
    } catch {
        // 무시합니다.
    }
};

const day = (iso: string) => iso.slice(0, 10).replace(/-/g, ".");
const linkOf = (token: string) => `${window.location.origin}/ask?q=${token}`;

function Modal({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
    useEffect(() => {
        const on = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", on);
        return () => window.removeEventListener("keydown", on);
    }, [onClose]);
    return (
        <div className="modal">
            <button type="button" className="modal-back" aria-label="닫기" onClick={onClose} />
            <div className="qbox panel" role="dialog" aria-modal="true" aria-label={label}>
                <button type="button" className="x qbox-x" aria-label="닫기" onClick={onClose}>
                    ✕
                </button>
                {children}
            </div>
        </div>
    );
}

/** 문세에게 직접 묻는 팝업. draft가 null이 아니면 열립니다. */
export function DirectForm({ draft, onClose, onSent }: { draft: string; onClose: () => void; onSent: (token: string) => void }) {
    const [name, setName] = useState("");
    const [body, setBody] = useState(draft);
    const [allowPublic, setAllowPublic] = useState(false);
    const [website, setWebsite] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (!body.trim() || busy) return;
        setBusy(true);
        setError(null);
        try {
            const res = await api.leaveQuestion({ name, body, allowPublic, website });
            rememberToken(res.token);
            setToken(res.token);
            onSent(res.token);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBusy(false);
        }
    };
    const copy = async () => {
        if (!token) return;
        try {
            await navigator.clipboard.writeText(linkOf(token));
            setCopied(true);
        } catch {
            setCopied(false);
        }
    };

    return (
        <Modal label="문세에게 직접 묻기" onClose={onClose}>
            {token ? (
                <div className="qbox-in">
                    <div className="g11 qbox-title">질문을 남겼어요</div>
                    <p className="qbox-sub">문세가 확인하고 답을 적어 둘게요. 이 브라우저에서는 질문 페이지의 "내 질문"에서 답을 볼 수 있어요. 다른 기기에서 보려면 아래 링크를 간직해 주세요.</p>
                    <div className="qbox-link">
                        <input className="fld" readOnly value={linkOf(token)} aria-label="답변 확인 링크" onFocus={(e) => e.target.select()} />
                        <button type="button" className="btn" onClick={copy}>
                            {copied ? "복사됨" : "복사"}
                        </button>
                    </div>
                    <button type="button" className="btn-gold" onClick={onClose}>
                        확인
                    </button>
                </div>
            ) : (
                <form className="qbox-in" onSubmit={submit}>
                    <div className="g11 qbox-title">문세에게 직접 묻기</div>
                    <p className="qbox-sub">문세가 직접 읽고 답해요. 대여 문의도 여기로 남겨 주세요.</p>
                    <label className="qbox-field">
                        <span className="lab">이름 (선택)</span>
                        <input className="fld" maxLength={30} placeholder="문세가 알아볼 수 있는 이름" value={name} onChange={(e) => setName(e.target.value)} />
                    </label>
                    <label className="qbox-field">
                        <span className="lab-row">
                            <span className="lab">질문</span>
                            <span className="hint">
                                {body.trim().length} / {MAX_BODY}
                            </span>
                        </span>
                        <textarea className="fld" rows={5} maxLength={MAX_BODY} autoFocus value={body} onChange={(e) => setBody(e.target.value)} />
                    </label>
                    {/* 사람 눈에는 보이지 않는 칸. 봇이 채우면 서버가 저장하지 않습니다. */}
                    <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} />
                    <label className="qbox-check">
                        <input type="checkbox" checked={allowPublic} onChange={(e) => setAllowPublic(e.target.checked)} />
                        <span>답변을 공개 Q&amp;A에 올려도 괜찮아요 (이름은 첫 글자만 보여요)</span>
                    </label>
                    {error && <div className="err">{error}</div>}
                    <button type="submit" className="btn-gold" disabled={busy || !body.trim()}>
                        {busy ? "보내는 중…" : "질문 남기기"}
                    </button>
                </form>
            )}
        </Modal>
    );
}

/** 이 브라우저에서 남긴 질문과 답. */
export function MyQuestions({ tokens, onClose, onForget }: { tokens: string[]; onClose: () => void; onForget: (token: string) => void }) {
    const [items, setItems] = useState<Record<string, MyQuestion | "gone" | undefined>>({});
    useEffect(() => {
        for (const t of tokens) {
            api.myQuestion(t).then(
                (q) => setItems((s) => ({ ...s, [t]: q })),
                () => setItems((s) => ({ ...s, [t]: "gone" })),
            );
        }
    }, [tokens]);
    return (
        <Modal label="내 질문" onClose={onClose}>
            <div className="qbox-in">
                <div className="g11 qbox-title">내 질문</div>
                {tokens.length === 0 && <p className="qbox-sub">아직 남긴 질문이 없어요.</p>}
                <ul className="qlist">
                    {tokens.map((t) => {
                        const q = items[t];
                        if (q === "gone")
                            return (
                                <li key={t} className="qitem dim">
                                    찾을 수 없는 질문이에요.{" "}
                                    <button type="button" className="ask-reset" onClick={() => (forgetToken(t), onForget(t))}>
                                        목록에서 지우기
                                    </button>
                                </li>
                            );
                        if (!q)
                            return (
                                <li key={t} className="qitem dim">
                                    불러오는 중…
                                </li>
                            );
                        return (
                            <li key={t} className="qitem">
                                <div className="qitem-q">
                                    <span className="dim">{day(q.createdAt)}</span> {q.body}
                                </div>
                                {q.answered ? (
                                    <div className="qitem-a">
                                        <span className="g11 ask-who">문세</span>
                                        <p>{q.answer}</p>
                                    </div>
                                ) : (
                                    <div className="dim qitem-wait">아직 답을 기다리는 중이에요.</div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>
        </Modal>
    );
}

/** 문세가 공개로 고른 질문과 답. 하나도 없으면 아무것도 그리지 않습니다. */
export function QnaList() {
    const [list, setList] = useState<PublicQna[]>([]);
    useEffect(() => {
        api.qna().then(setList, () => setList([]));
    }, []);
    if (!list.length) return null;
    return (
        <details className="qna">
            <summary className="g11">
                문세의 Q&amp;A <span className="dim">{list.length}</span>
            </summary>
            <ul className="qlist">
                {list.map((q) => (
                    <li key={q.id} className="qitem">
                        <div className="qitem-q">
                            <span className="dim">{q.name}</span> {q.body}
                        </div>
                        <div className="qitem-a">
                            <span className="g11 ask-who">문세</span>
                            <p>{q.answer}</p>
                        </div>
                    </li>
                ))}
            </ul>
        </details>
    );
}
