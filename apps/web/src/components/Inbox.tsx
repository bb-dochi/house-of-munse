import { useEffect, useState } from "react";
import { AdminQuestion, api } from "../api";

const STATUS_LABEL: Record<AdminQuestion["status"], string> = { new: "새 질문", answered: "답변 완료", hidden: "숨김" };
const when = (iso: string) => iso.slice(0, 16).replace("T", " ");

/** 관리 페이지 버튼 줄의 질문함 버튼. 누르면 팝업으로 질문 목록을 엽니다. 새 질문 수는 버튼에 바로 보입니다. */
export function Inbox() {
    const [list, setList] = useState<AdminQuestion[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [open, setOpen] = useState(false);
    useEffect(() => {
        api.questions().then(setList, (e) => setError((e as Error).message));
    }, []);
    useEffect(() => {
        if (!open) return;
        const on = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        window.addEventListener("keydown", on);
        return () => window.removeEventListener("keydown", on);
    }, [open]);
    const fresh = list?.filter((q) => q.status === "new").length ?? 0;
    const replace = (q: AdminQuestion) => setList((l) => l && l.map((x) => (x.id === q.id ? q : x)));

    return (
        <>
            <button type="button" className="btn inbox-btn" onClick={() => setOpen(true)}>
                ✉ 질문함
                {fresh > 0 && <span className="direct-new">새 {fresh}</span>}
            </button>
            {open && (
                <div className="modal">
                    <button type="button" className="modal-back" aria-label="질문함 닫기" onClick={() => setOpen(false)} />
                    <div className="qbox inbox-box panel" role="dialog" aria-modal="true" aria-label="질문함">
                        <button type="button" className="x qbox-x" aria-label="닫기" autoFocus onClick={() => setOpen(false)}>
                            ✕
                        </button>
                        <div className="qbox-in">
                            <div className="g11 qbox-title">
                                질문함 <span className="dim">{list ? `새 ${fresh} · 전체 ${list.length}` : ""}</span>
                            </div>
                            {error && <div className="err">{error}</div>}
                            {!list && !error && <p className="dim">불러오는 중…</p>}
                            {list && list.length === 0 && <p className="dim">아직 들어온 질문이 없어요.</p>}
                            {list && list.length > 0 && (
                                <ul className="qlist">
                                    {list.map((q) => (
                                        <Item key={q.id} q={q} onSaved={replace} onDeleted={() => setList((l) => l && l.filter((x) => x.id !== q.id))} />
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function Item({ q, onSaved, onDeleted }: { q: AdminQuestion; onSaved: (q: AdminQuestion) => void; onDeleted: () => void }) {
    const [answer, setAnswer] = useState(q.answer);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const run = async (fn: () => Promise<AdminQuestion | void>) => {
        setBusy(true);
        setError(null);
        try {
            const r = await fn();
            if (r) onSaved(r);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };
    return (
        <li className={"qitem inbox-item " + q.status}>
            <div className="inbox-meta">
                <span className={"inbox-status " + q.status}>{STATUS_LABEL[q.status]}</span>
                <span>{q.name || "익명"}</span>
                <span className="dim">{when(q.createdAt)}</span>
                {q.allowPublic ? <span className="dim">공개 허락</span> : <span className="dim">비공개</span>}
            </div>
            <div className="qitem-q">{q.body}</div>
            <textarea className="fld inbox-answer" rows={3} maxLength={2000} placeholder="답변을 적어 주세요" value={answer} onChange={(e) => setAnswer(e.target.value)} />
            <div className="inbox-actions">
                <button type="button" className="btn mini" disabled={busy || !answer.trim() || answer.trim() === q.answer} onClick={() => run(() => api.updateQuestion(q.id, { answer }))}>
                    {q.status === "answered" ? "답변 고치기" : "답변 저장"}
                </button>
                {q.allowPublic && q.status === "answered" && (
                    <label className="qbox-check">
                        <input type="checkbox" checked={q.published} disabled={busy} onChange={(e) => run(() => api.updateQuestion(q.id, { published: e.target.checked }))} />
                        <span>공개 Q&amp;A에 올리기</span>
                    </label>
                )}
                <span className="inbox-spacer" />
                {q.status !== "hidden" ? (
                    <button type="button" className="ask-reset" disabled={busy} onClick={() => run(() => api.updateQuestion(q.id, { status: "hidden" }))}>
                        숨기기
                    </button>
                ) : (
                    <button type="button" className="ask-reset" disabled={busy} onClick={() => run(() => api.updateQuestion(q.id, { status: q.answer ? "answered" : "new" }))}>
                        되살리기
                    </button>
                )}
                <button
                    type="button"
                    className="ask-reset"
                    disabled={busy}
                    onClick={() => window.confirm("이 질문을 지울까요? 되돌릴 수 없습니다.") && run(async () => (await api.deleteQuestion(q.id), onDeleted()))}
                >
                    삭제
                </button>
            </div>
            {error && <div className="err">{error}</div>}
        </li>
    );
}
