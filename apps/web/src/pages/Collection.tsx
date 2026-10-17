import { useEffect, useState } from "react";
import { api, Game, playersText, timeText, weightText } from "../api";
import { Cover } from "../components/Cover";
import { Band, Layout, LoadState } from "../components/Layout";
import { categoryColor } from "../pixel";
import { useLoad } from "../useLoad";

const EMPTY = { q: "", players: "all", category: "all", sort: "no", order: "asc" };
const shelfNo = (no: number) => "HM-" + String(no).padStart(3, "0");

// 카드/표 보기는 방문자 브라우저에만 기억합니다. 저장소를 못 쓰면 카드로 시작합니다.
type View = "card" | "table";
const VIEW_KEY = "munse-collection-view";
const savedView = (): View => {
    try {
        return localStorage.getItem(VIEW_KEY) === "table" ? "table" : "card";
    } catch {
        return "card";
    }
};

const bestText = (g: Game) => (g.bestPlayers ? (g.bestPlayers.min === g.bestPlayers.max ? `${g.bestPlayers.min}` : `${g.bestPlayers.min}–${g.bestPlayers.max}`) : null);
const ratingText = (g: Game) => (g.rating ? g.rating.toFixed(1) : "-");

/** best를 켜면 인원 아래에 베스트 인원을 작게 붙입니다 (상세 창에서만). */
function Stats({ g, best = false }: { g: Game; best?: boolean }) {
    const star = best ? bestText(g) : null;
    return (
        <span className="stats">
            <span>
                <span className="dim">인원</span>
                <span className="v">
                    {playersText(g)}
                    {star && (
                        <span className="best-sub" title="BGG 유저 투표 기준">
                            베스트 {star}인
                        </span>
                    )}
                </span>
            </span>
            <span>
                <span className="dim">시간</span>
                <span className="v">{timeText(g)}</span>
            </span>
            <span>
                <span className="dim">웨이트</span>
                <span className="v">{weightText(g)}</span>
            </span>
            <span>
                <span className="dim">평점</span>
                <span className="v">{ratingText(g)}</span>
            </span>
        </span>
    );
}

export function Collection() {
    const [f, setF] = useState(EMPTY);
    const [q, setQ] = useState("");
    const [sel, setSel] = useState<Game | null>(null);
    const [view, setView] = useState<View>(savedView);
    const pickView = (v: View) => {
        setView(v);
        try {
            localStorage.setItem(VIEW_KEY, v);
        } catch {
            // 저장하지 못해도 이번 화면에서는 바뀝니다.
        }
    };
    // 글자를 칠 때마다 요청하지 않도록 검색어만 조금 늦춰 반영합니다.
    useEffect(() => {
        const t = window.setTimeout(() => setF((x) => (x.q === q ? x : { ...x, q })), 250);
        return () => window.clearTimeout(t);
    }, [q]);
    const { data, loading, error, reload } = useLoad(() => api.games(f), [f]);
    const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) => setF({ ...f, [key]: e.target.value });

    useEffect(() => {
        if (!sel) return;
        const on = (e: KeyboardEvent) => e.key === "Escape" && setSel(null);
        window.addEventListener("keydown", on);
        return () => window.removeEventListener("keydown", on);
    }, [sel]);

    const items = data?.items ?? [];
    // 전체 수(data.total)처럼 본판 카드에 묶인 확장판까지 상자 하나로 셉니다.
    const boxes = items.reduce((n, g) => n + 1 + g.expansions.length, 0);

    return (
        <Layout page="collection" count={data?.total} footNote="게임 정보 출처: BoardGameGeek, 직접 입력">
            <Band
                label="THE SHELVES"
                title="모든 컬렉션"
                sub="HOUSE OF MUNSE 선반에 놓인 상자를 모두 꺼내 봅니다."
                pos="0% 22%"
                aside={
                    data && (
                        <div className="g11 band-count">
                            {boxes}
                            <small> / {data.total} 상자</small>
                        </div>
                    )
                }
            />
            <main className="wrap pad">
                <form className="filters panel" onSubmit={(e) => e.preventDefault()}>
                    <label className="wide">
                        <span className="lab">검색</span>
                        <input className="fld" type="search" placeholder="게임 이름, 영문명" value={q} onChange={(e) => setQ(e.target.value)} />
                    </label>
                    <label>
                        <span className="lab">카테고리</span>
                        <select className="fld" value={f.category} onChange={set("category")}>
                            <option value="all">전체</option>
                            <option value="전략">전략</option>
                            <option value="가족">가족</option>
                            <option value="파티">파티</option>
                            <option value="협력">협력</option>
                            <option value="머더미스터리">머더미스터리</option>
                        </select>
                    </label>
                    <label>
                        <span className="lab">인원</span>
                        <select className="fld" value={f.players} onChange={set("players")}>
                            <option value="all">전체</option>
                            <option value="1-2">1–2인</option>
                            <option value="3-4">3–4인</option>
                            <option value="5-6">5–6인</option>
                            <option value="7+">7인 이상</option>
                        </select>
                    </label>
                    <div className="sort-field" role="group" aria-labelledby="sort-lab">
                        <span className="lab" id="sort-lab">정렬</span>
                        <span className="sort-row">
                            <select className="fld" aria-label="정렬 기준" value={f.sort} onChange={set("sort")}>
                                <option value="no">등록순</option>
                                <option value="name">이름</option>
                                <option value="rating">평점</option>
                                <option value="weight">웨이트</option>
                                <option value="time">시간</option>
                            </select>
                            <button
                                type="button"
                                className="btn order"
                                aria-label={f.order === "asc" ? "오름차순, 눌러서 내림차순으로" : "내림차순, 눌러서 오름차순으로"}
                                title={f.order === "asc" ? "오름차순" : "내림차순"}
                                onClick={() => setF({ ...f, order: f.order === "asc" ? "desc" : "asc" })}
                            >
                                {f.order === "asc" ? "▲" : "▼"}
                            </button>
                        </span>
                    </div>
                    <div className="end">
                        <button
                            type="button"
                            className="btn icon-btn"
                            aria-label="조건 초기화"
                            title="조건 초기화"
                            onClick={() => {
                                setQ("");
                                setF(EMPTY);
                            }}
                        >
                            ↺
                        </button>
                    </div>
                </form>

                <div className="view-bar" role="group" aria-label="보기 방식">
                    <button type="button" className={"btn icon-btn" + (view === "card" ? " on" : "")} aria-pressed={view === "card"} aria-label="카드로 보기" title="카드로 보기" onClick={() => pickView("card")}>
                        ▦
                    </button>
                    <button type="button" className={"btn icon-btn" + (view === "table" ? " on" : "")} aria-pressed={view === "table"} aria-label="표로 보기" title="표로 보기" onClick={() => pickView("table")}>
                        ☰
                    </button>
                </div>

                <LoadState loading={loading && !data} error={error} onRetry={reload} />
                {data && !error && items.length === 0 && (
                    <div className="state">
                        조건에 맞는 상자가 선반에 없어요.
                        <br />
                        조건을 조금 풀어 보세요.
                    </div>
                )}

                {view === "table" && items.length > 0 && (
                    <div className="sheet ctable-wrap">
                        <table className="ctable">
                            <thead>
                                <tr>
                                    <th>번호</th>
                                    <th>게임</th>
                                    <th>카테고리</th>
                                    <th>인원</th>
                                    <th className="r">시간</th>
                                    <th className="r">웨이트</th>
                                    <th className="r">평점</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((g) => (
                                    <tr key={g.id} onClick={() => setSel(g)}>
                                        <td className="dim ct-no">{shelfNo(g.no)}</td>
                                        <td className="ct-game">
                                            <span className="ct-name">
                                                <span className="ct-thumb niche">
                                                    <Cover imageUrl={g.imageUrl} />
                                                </span>
                                                <span className="ct-txt">
                                                    <button type="button" className="ct-link" onClick={(e) => (e.stopPropagation(), setSel(g))}>
                                                        {g.nameKo}
                                                    </button>
                                                    {g.nameEn && g.nameEn !== g.nameKo && <span className="dim ct-en">{g.nameEn}</span>}
                                                </span>
                                                {g.expansions.length > 0 && <span className="cat">확장 {g.expansions.length}</span>}
                                                {g.onLoan && <span className="cat loan">대여 중</span>}
                                            </span>
                                        </td>
                                        <td className="ct-cat">
                                            {g.category ? (
                                                <span className="cat" style={{ borderColor: categoryColor(g.category) }}>
                                                    {g.category}
                                                </span>
                                            ) : (
                                                "-"
                                            )}
                                        </td>
                                        <td className="ct-players">
                                            {playersText(g)}
                                            {bestText(g) && <span className="dim ct-best"> (베스트 {bestText(g)}인)</span>}
                                        </td>
                                        <td className="r ct-time">{timeText(g)}</td>
                                        <td className="r ct-weight">{weightText(g)}</td>
                                        <td className="r ct-rating">{ratingText(g)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {view === "card" && (
                    <div className="grid">
                        {items.map((g) => (
                            <button key={g.id} type="button" className="gcard card" onClick={() => setSel(g)}>
                                <span className="niche">
                                    <Cover imageUrl={g.imageUrl} />
                                </span>
                                <span className="body">
                                    <span className="name">{g.nameKo}</span>
                                    <span className="sub">
                                        <span className="dim en">{g.nameEn}</span>
                                        <span className="tags">
                                            {g.category && (
                                                <span className="cat" style={{ borderColor: categoryColor(g.category) }}>
                                                    {g.category}
                                                </span>
                                            )}
                                            {g.expansions.length > 0 && <span className="cat">확장 {g.expansions.length}</span>}
                                            {g.onLoan && <span className="cat loan">대여 중</span>}
                                        </span>
                                    </span>
                                    <Stats g={g} />
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </main>

            {sel && (
                <div className="modal">
                    <button type="button" className="modal-back" aria-label="상세 닫기" onClick={() => setSel(null)} />
                    <div className="modal-box" role="dialog" aria-modal="true" aria-label={sel.nameKo}>
                        <div className="modal-art niche">
                            <Cover imageUrl={sel.imageUrl} />
                        </div>
                        <div className="modal-info">
                            <div className="modal-top">
                                <div>
                                    <div className="dim" style={{ color: "var(--gold-dim)" }}>
                                        {shelfNo(sel.no)}
                                    </div>
                                    <div className="name">{sel.nameKo}</div>
                                    <div className="dim">{[sel.nameEn, sel.category].filter(Boolean).join(" · ")}</div>
                                    {sel.onLoan && <span className="cat loan" style={{ alignSelf: "flex-start" }}>대여 중 · 지금은 공방에 없어요</span>}
                                </div>
                                <button type="button" className="x" aria-label="닫기" autoFocus onClick={() => setSel(null)}>
                                    ✕
                                </button>
                            </div>
                            {sel.description && <p style={{ lineHeight: 1.8, color: "var(--text-2)" }}>{sel.description}</p>}
                            <Stats g={sel} best />
                            {sel.expansions.length > 0 && (
                                <div className="exps">
                                    <span className="dim">함께 있는 확장</span>
                                    <ul>
                                        {sel.expansions.map((e) => (
                                            <li key={e.id}>
                                                {e.nameKo}
                                                {e.onLoan && <span className="dim"> (대여 중)</span>}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}
