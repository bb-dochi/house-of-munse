import { FormEvent, useEffect, useRef, useState } from "react";
import { api, AskMessage } from "../api";
import { DirectForm, MyQuestions, myTokens, QnaList, rememberToken } from "../components/DirectQuestion";
import { Band, Layout } from "../components/Layout";

const MAX_QUESTION = 300;
const EXAMPLES = ["6명이서 1시간 안에 끝나는 게임 있어?", "둘이 하기 좋은 협력 게임 추천해 줘", "보드게임 처음 하는 친구랑 할 만한 거?", "밤샘(10시간 이상) 모임 보드게임 리스트업 해줄래?"];

/** 모델이 게임 이름을 **굵게** 감싸 보내므로 그 부분만 굵게 그립니다. 다른 마크다운은 글자 그대로 둡니다. */
function Rich({ text }: { text: string }) {
    return <>{text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))}</>;
}

export function Ask() {
    const [log, setLog] = useState<AskMessage[]>([]);
    const [draft, setDraft] = useState("");
    const [streaming, setStreaming] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [left, setLeft] = useState<number | null>(null);
    const end = useRef<HTMLDivElement>(null);
    const busy = streaming !== null;
    // 문세에게 직접 묻기: direct가 null이 아니면 그 글을 채운 채로 팝업을 엽니다.
    const [direct, setDirect] = useState<string | null>(null);
    const [mine, setMine] = useState<string[]>(myTokens);
    const [showMine, setShowMine] = useState(false);
    const [arrived, setArrived] = useState(0);

    // 답변 확인 링크(/ask?q=…)로 들어오면 이 브라우저에 기억하고 내 질문을 엽니다.
    useEffect(() => {
        const q = new URLSearchParams(window.location.search).get("q");
        if (!q || !/^[0-9a-f]{32}$/.test(q)) return;
        rememberToken(q);
        setMine(myTokens());
        setShowMine(true);
        window.history.replaceState(null, "", "/ask");
    }, []);
    useEffect(() => {
        let alive = true;
        Promise.all(mine.map((t) => api.myQuestion(t).then((q) => q.answered, () => false))).then((r) => alive && setArrived(r.filter(Boolean).length));
        return () => {
            alive = false;
        };
    }, [mine]);
    const lastQuestion = [...log].reverse().find((m) => m.role === "user")?.content ?? "";

    useEffect(() => {
        end.current?.scrollIntoView({ block: "nearest" });
    }, [log, streaming]);

    const send = async (text: string) => {
        const question = text.trim();
        if (!question || busy) return;
        setError(null);
        setDraft("");
        const history = log;
        setLog([...history, { role: "user", content: question }]);
        setStreaming("");
        try {
            const res = await api.ask(question, history, setStreaming);
            setLog((l) => [...l, { role: "assistant", content: res.answer || "음… 대답이 떠오르지 않네요. 다르게 물어봐 주세요." }]);
            if (res.left !== null) setLeft(res.left);
        } catch (e) {
            // 답을 받지 못한 질문은 기록에서 빼고 입력칸에 되돌려 다시 보낼 수 있게 합니다.
            setLog(history);
            setDraft(question);
            setError((e as Error).message);
        } finally {
            setStreaming(null);
        }
    };
    const submit = (e: FormEvent) => {
        e.preventDefault();
        send(draft);
    };

    return (
        <Layout page="ask" footNote="답은 AI가 만든 것이라 틀릴 수 있어요">
            <Band label="ASK THE KEEPER" title="공방지기에게 질문하기" sub="선반에 있는 게임 중에서 오늘 모임에 맞는 걸 골라 드려요." pos="0% 40%" narrow />
            <main className="wrap narrow pad">
                <section className="ask panel" aria-label="공방지기와의 대화">
                    <div className="ask-top">
                        <span className="g11 ask-top-title">
                            <span aria-hidden="true">✦ </span>공방지기 AI
                        </span>
                        <span className="ask-top-actions">
                            {mine.length > 0 && (
                                <button type="button" className="ask-top-btn" onClick={() => setShowMine(true)}>
                                    내 질문 {mine.length}
                                    {arrived > 0 && <span className="direct-new">답변 {arrived}</span>}
                                </button>
                            )}
                            <button type="button" className="ask-top-btn direct" title="AI 말고 문세가 직접 읽고 답해요" onClick={() => setDirect("")}>
                                ✉ 문세에게 직접 묻기
                            </button>
                        </span>
                    </div>
                    <div className="ask-log" aria-live="polite">
                        {log.length === 0 && !busy && (
                            <div className="ask-empty">
                                <p className="dim">이런 걸 물어볼 수 있어요</p>
                                <div className="ask-examples">
                                    {EXAMPLES.map((q) => (
                                        <button key={q} type="button" className="chip" onClick={() => send(q)}>
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {log.map((m, i) => (
                            <div key={i} className={"ask-msg " + m.role}>
                                {m.role === "assistant" && <span className="g11 ask-who">공방지기</span>}
                                <p>{m.role === "assistant" ? <Rich text={m.content} /> : m.content}</p>
                            </div>
                        ))}
                        {!busy && log.length > 0 && (
                            <button type="button" className="ask-handoff" onClick={() => setDirect(lastQuestion)}>
                                이건 문세에게 직접 물어볼래요 →
                            </button>
                        )}
                        {busy && (
                            <div className="ask-msg assistant">
                                <span className="g11 ask-who">공방지기</span>
                                <p>{streaming ? <Rich text={streaming} /> : <span className="dim">선반을 둘러보는 중…</span>}</p>
                            </div>
                        )}
                        <div ref={end} />
                    </div>
                    <form className="ask-form" onSubmit={submit}>
                        <textarea
                            className="fld"
                            rows={2}
                            maxLength={MAX_QUESTION}
                            placeholder="몇 명이서, 얼마나, 어떤 분위기로 하고 싶은지 적어 주세요"
                            aria-label="질문"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                                    e.preventDefault();
                                    send(draft);
                                }
                            }}
                        />
                        <button type="submit" className="btn-gold" disabled={busy || !draft.trim()}>
                            {busy ? "…" : "묻기"}
                        </button>
                    </form>
                    <div className="ask-foot dim" role="status">
                        {error ? <span className="err">{error}</span> : left !== null ? `오늘 ${left}번 더 물어볼 수 있어요` : "Enter로 보내고 Shift+Enter로 줄을 바꿔요"}
                        {log.length > 0 && !busy && (
                            <button type="button" className="ask-reset" onClick={() => (setLog([]), setError(null))}>
                                새 대화
                            </button>
                        )}
                    </div>
                </section>
                <QnaList />
                <aside className="rent-note" aria-label="대여 안내">
                    <p>
                        <b className="g10">대여 안내</b> · 공방의 게임은 아는 분들께만 빌려드려요. 빌려 가실 때와 돌아올 때 구성품을 확인하고 있어요.
                    </p>
                    <p>전략 게임은 공방에서 함께 해 본 분께, 파티 게임은 가까운 분들께 먼저 빌려드리고 있어요.</p>
                    <p>대여 기간은 최대 2주예요. 대여비는 없지만 부품이 없어지거나 상하면 부품값만 받고 있어요.</p>
                </aside>
            </main>
            {direct !== null && <DirectForm draft={direct} onClose={() => setDirect(null)} onSent={() => setMine(myTokens())} />}
            {showMine && <MyQuestions tokens={mine} onClose={() => setShowMine(false)} onForget={() => setMine(myTokens())} />}
        </Layout>
    );
}
