import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { api, ApiError, auth, LedgerRow, weightNumber } from "../api";
import { BggSearch } from "../components/BggSearch";
import { Cover } from "../components/Cover";
import { Inbox } from "../components/Inbox";
import { Layout } from "../components/Layout";
import { categoryColor } from "../pixel";

const STATUSES = ["보유", "대여 중", "방출 예정", "방출 완료"];
const STATUS_COLOR: Record<string, string> = { 보유: "#70E8A0", "대여 중": "#5FC8F0", "방출 예정": "#EBCB86", "방출 완료": "#B9AAB8" };
const won = (n: number) => n.toLocaleString("ko-KR") + "원";
const CATEGORIES = ["전략", "가족", "파티", "협력", "머더미스터리"];

type Field = "nameKo" | "weight" | "category" | "recommendedPlayers" | "purchasePrice" | "sellPrice" | "status";
/** 화면에서 고치는 값은 모두 글자로 들고 있다가, 칸을 떠날 때 서버로 보냅니다. */
interface Row {
    id: string;
    no: number;
    game: LedgerRow;
    saved: Record<Field, string>;
    draft: Record<Field, string>;
}

const toRow = (g: LedgerRow): Row => {
    const v: Record<Field, string> = {
        nameKo: g.nameKo,
        weight: g.weight ? weightNumber(g.weight) : "",
        category: g.category ?? "",
        recommendedPlayers: g.ownership?.recommendedPlayers ?? "",
        purchasePrice: g.ownership?.purchasePrice != null ? String(g.ownership.purchasePrice) : "",
        sellPrice: g.ownership?.sellPrice != null ? String(g.ownership.sellPrice) : "",
        status: g.ownership?.status ?? "보유",
    };
    return { id: g.id, no: g.no, game: g, saved: v, draft: { ...v } };
};

const BLANK: Record<Field, string> = { nameKo: "", weight: "", category: "", recommendedPlayers: "", purchasePrice: "", sellPrice: "", status: "보유" };

type SortKey = "no" | Field;
/** 정렬 값. 빈 값(null, 미정)은 가장 큰 값으로 쳐서 오름차순이면 맨 아래, 내림차순이면 맨 위로 갑니다. */
const sortValue = (r: Row, key: SortKey): string | number | null => {
    const g = r.game;
    switch (key) {
        case "no":
            return r.no;
        case "weight":
            return g.weight || null;
        case "recommendedPlayers":
            return g.minPlayers === null ? null : g.minPlayers * 100 + (g.maxPlayers ?? 0);
        case "purchasePrice":
            return g.ownership?.purchasePrice ?? null;
        case "sellPrice":
            return g.ownership?.sellPrice ?? null;
        case "status":
            return STATUSES.indexOf(r.saved.status);
        default:
            return r.saved[key] || null;
    }
};

function compareRows(a: Row, b: Row, key: SortKey, dir: 1 | -1): number {
    const x = sortValue(a, key);
    const y = sortValue(b, key);
    if (x === null || y === null) return x === y ? a.no - b.no : x === null ? dir : -dir;
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "ko");
    return dir * c || a.no - b.no;
}

/** 표지 파일을 긴 변 600px JPEG로 줄입니다. D1에 그대로 두기 때문에 작게 만듭니다. */
async function shrink(file: File): Promise<Blob> {
    let bmp: ImageBitmap;
    try {
        bmp = await createImageBitmap(file);
    } catch {
        throw new Error("이 이미지 파일은 읽을 수 없습니다. JPEG나 PNG로 바꿔서 올려 주세요.");
    }
    const scale = Math.min(1, 600 / Math.max(bmp.width, bmp.height));
    const canvas = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * scale), height: Math.round(bmp.height * scale) });
    const ctx = canvas.getContext("2d")!;
    // 투명한 PNG가 JPEG에서 검게 나오지 않도록 흰 바탕을 깝니다.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("이미지를 줄이지 못했습니다."))), "image/jpeg", 0.85));
}

const rangeText = (r: { min: number; max: number } | null) => (r ? (r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`) : "");

/**
 * 상세 수정 창. 표·장부에서 비교하지 않는 칸(표지, 한 줄 설명, 베스트 인원)을 여기서 고칩니다.
 * 표지는 올리거나 주소를 넣는 즉시 저장하고, 설명과 베스트 인원은 저장 단추로 함께 보냅니다.
 */
function DetailEditor({ row, onSaved, onClose }: { row: Row; onSaved: (g: LedgerRow, message: string) => void; onClose: () => void }) {
    const current = row.game.imageUrl ?? "";
    const [url, setUrl] = useState(current.startsWith("/api/covers/") ? "" : current);
    const [description, setDescription] = useState(row.game.description ?? "");
    const [best, setBest] = useState(rangeText(row.game.bestPlayers));
    const [busy, setBusy] = useState<"cover" | "save" | null>(null);
    const [error, setError] = useState<string | null>(null);

    const changes: Record<string, string> = {};
    if (description.trim() !== (row.game.description ?? "")) changes.description = description;
    if (best.trim() !== rangeText(row.game.bestPlayers)) changes.bestPlayers = best;
    const dirty = Object.keys(changes).length > 0;
    const close = () => {
        if (busy) return;
        if (dirty && !window.confirm("저장하지 않은 변경이 있습니다. 닫을까요?")) return;
        onClose();
    };
    useEffect(() => {
        const on = (e: KeyboardEvent) => e.key === "Escape" && close();
        window.addEventListener("keydown", on);
        return () => window.removeEventListener("keydown", on);
    });

    const run = async (kind: "cover" | "save", fn: () => Promise<LedgerRow>, message: string) => {
        setBusy(kind);
        setError(null);
        try {
            onSaved(await fn(), message);
            if (kind === "save") onClose();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(null);
        }
    };
    const upload = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) run("cover", async () => api.uploadCover(row.id, await shrink(file)), "표지를 저장했습니다.");
    };

    return (
        <div className="modal">
            <button type="button" className="modal-back" aria-label="상세 수정 닫기" onClick={close} />
            <div className="modal-box dlg" role="dialog" aria-modal="true" aria-label={`${row.saved.nameKo} 상세 수정`}>
                <header className="dlg-head">
                    <div>
                        <div className="lab">상세 수정</div>
                        <div className="name">{row.saved.nameKo}</div>
                        <div className="dim">
                            {[row.game.nameEn !== row.saved.nameKo ? row.game.nameEn : "", row.saved.category].filter(Boolean).join(" · ")}
                            {row.game.bggId && (
                                <>
                                    {" · "}
                                    <a href={`https://boardgamegeek.com/boardgame/${row.game.bggId}`} target="_blank" rel="noreferrer">
                                        BGG #{row.game.bggId}
                                    </a>
                                </>
                            )}
                        </div>
                    </div>
                    <button type="button" className="x" aria-label="닫기" onClick={close} disabled={!!busy}>
                        ✕
                    </button>
                </header>

                <div className="dlg-body">
                    <section className="dlg-cover" aria-label="표지">
                        <div className="dlg-preview niche">
                            <Cover imageUrl={row.game.imageUrl} />
                            {busy === "cover" && <span className="dlg-busy">저장하는 중…</span>}
                        </div>
                        <div className="cover-actions">
                            <label className={"btn mini cover-file" + (busy ? " off" : "")}>
                                {current ? "파일로 바꾸기" : "파일 올리기"}
                                <input type="file" accept="image/*" hidden onChange={upload} disabled={!!busy} />
                            </label>
                            {current && (
                                <button
                                    type="button"
                                    className="btn mini"
                                    disabled={!!busy}
                                    onClick={() => window.confirm("표지를 지울까요?") && run("cover", () => api.updateGame(row.id, { imageUrl: "" }), "표지를 지웠습니다.")}
                                >
                                    지우기
                                </button>
                            )}
                        </div>
                        <form
                            className="cover-url"
                            onSubmit={(e) => {
                                e.preventDefault();
                                run("cover", () => api.updateGame(row.id, { imageUrl: url }), "표지를 저장했습니다.");
                            }}
                        >
                            <input className="fld" type="url" aria-label="이미지 주소" placeholder="이미지 주소 https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
                            <button type="submit" className="btn mini" disabled={!!busy || !url.trim() || url.trim() === current}>
                                적용
                            </button>
                        </form>
                        <p className="hint">표지는 고르는 즉시 저장됩니다. 파일은 긴 변 600px로 줄여 올립니다.</p>
                    </section>

                    <form
                        id="detail-form"
                        className="dlg-fields"
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (dirty) run("save", () => api.updateGame(row.id, changes), "상세 정보를 저장했습니다.");
                        }}
                    >
                        <label>
                            <span className="lab-row">
                                <span className="lab">한 줄 설명</span>
                                <span className={"hint" + (description.trim().length > 60 ? " over" : "")}>{description.trim().length} / 60</span>
                            </span>
                            <textarea
                                className="fld"
                                rows={3}
                                value={description}
                                placeholder="타일을 이어 도시·길·수도원을 완성하는 대표 타일 놓기 게임."
                                onChange={(e) => setDescription(e.target.value)}
                            />
                            <span className="hint">컬렉션에서 게임을 누르면 보이는 설명입니다.</span>
                        </label>
                        <label>
                            <span className="lab">베스트 인원</span>
                            <input className="fld best-input" inputMode="numeric" value={best} placeholder="4 또는 3-4" onChange={(e) => setBest(e.target.value)} />
                            <span className="hint">BGG 유저 투표 기준입니다. 비우면 표시하지 않습니다.</span>
                        </label>
                    </form>
                </div>

                <footer className="dlg-foot">
                    {error ? (
                        <div className="err" role="alert">
                            {error}
                        </div>
                    ) : (
                        <span className="hint">{dirty ? "저장하지 않은 변경이 있습니다." : " "}</span>
                    )}
                    <div className="dlg-actions">
                        <button type="button" className="btn" onClick={close} disabled={!!busy}>
                            닫기
                        </button>
                        <button type="submit" form="detail-form" className="btn-gold" disabled={!!busy || !dirty}>
                            {busy === "save" ? "저장하는 중…" : "저장"}
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
}

function Login({ onDone }: { onDone: () => void }) {
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
            auth.set((await api.login(password)).token);
            onDone();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBusy(false);
        }
    };
    return (
        <form className="login panel" onSubmit={submit}>
            <div className="g11 eyebrow">▪ THE LEDGER</div>
            <h1 className="h1" style={{ fontSize: 30 }}>
                공방 장부 열기
            </h1>
            <label>
                <span className="lab">관리자 비밀번호</span>
                <input className="fld" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            </label>
            {error && (
                <div className="err" role="alert">
                    {error}
                </div>
            )}
            <button type="submit" className="btn-gold" disabled={busy || !password}>
                {busy ? "확인하는 중…" : "들어가기"}
            </button>
        </form>
    );
}

export function Admin() {
    const [authed, setAuthed] = useState(!!auth.get());
    const [rows, setRows] = useState<Row[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [note, setNote] = useState("");
    const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "no", dir: 1 });
    // 이번에 추가하거나 BGG에서 가져온 게임. 정렬과 상관없이 입력 줄 바로 아래에 모아 둡니다.
    const [fresh, setFresh] = useState<string[]>([]);
    const [entry, setEntry] = useState(BLANK);
    const [adding, setAdding] = useState(false);
    const [coverOf, setCoverOf] = useState<string | null>(null);
    const entryName = useRef<HTMLInputElement>(null);

    const fail = (e: unknown) => {
        if (e instanceof ApiError && e.status === 401) setAuthed(false);
        setError((e as Error).message);
    };
    const load = () => {
        setError(null);
        api.ledger()
            .then((list) => setRows(list.map(toRow)))
            .catch(fail);
    };
    useEffect(() => {
        if (authed) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authed]);

    const pin = (id: string) => setFresh((ids) => [id, ...ids.filter((x) => x !== id)]);
    const edit = (id: string, key: Field, value: string) => setRows((rs) => rs && rs.map((r) => (r.id === id ? { ...r, draft: { ...r.draft, [key]: value } } : r)));
    /** 서버가 돌려준 게임으로 바꾸되, 아직 저장하지 않고 고치는 중인 칸은 그대로 둡니다. */
    const replace = (g: LedgerRow, savedKey?: Field) =>
        setRows(
            (rs) =>
                rs &&
                rs.map((r) => {
                    if (r.id !== g.id) return r;
                    const next = toRow(g);
                    const draft = { ...next.draft };
                    for (const k of Object.keys(draft) as Field[]) if (k !== savedKey && r.draft[k] !== r.saved[k]) draft[k] = r.draft[k];
                    return { ...next, draft };
                }),
        );
    const save = async (row: Row, key: Field, value = row.draft[key]) => {
        if (value === row.saved[key]) return;
        setError(null);
        try {
            replace(await api.updateGame(row.id, { [key]: value }), key);
            setNote("저장했습니다.");
        } catch (e) {
            edit(row.id, key, row.saved[key]);
            fail(e);
        }
    };
    const add = async (e: FormEvent) => {
        e.preventDefault();
        if (!entry.nameKo.trim()) return setError("게임 이름을 입력해 주세요.");
        setError(null);
        setAdding(true);
        try {
            // 빈 칸은 보내지 않아 서버 기본값을 씁니다. 카테고리는 "미정"도 고른 값이라 그대로 보냅니다.
            const data = Object.fromEntries(Object.entries(entry).filter(([k, v]) => v !== "" || k === "category"));
            const g = await api.createGame(data);
            setRows((rs) => [...(rs ?? []), toRow(g)]);
            pin(g.id);
            setEntry(BLANK);
            setNote(`「${g.nameKo}」을(를) 추가했습니다. 표지 칸을 누르면 표지·한 줄 설명·베스트 인원을 넣을 수 있습니다.`);
            entryName.current?.focus();
        } catch (err) {
            fail(err);
        } finally {
            setAdding(false);
        }
    };
    const remove = async (row: Row) => {
        if (!window.confirm(`「${row.saved.nameKo}」을(를) 장부에서 지울까요? 되돌릴 수 없습니다.`)) return;
        setError(null);
        try {
            await api.deleteGame(row.id);
            setRows((rs) => rs && rs.filter((r) => r.id !== row.id));
            setFresh((ids) => ids.filter((id) => id !== row.id));
            setNote("지웠습니다.");
        } catch (e) {
            fail(e);
        }
    };

    const exportAs = async (format: "csv" | "json") => {
        setError(null);
        try {
            await api.exportLedger(format);
            setNote(`장부를 ${format.toUpperCase()} 파일로 내보냈습니다.`);
        } catch (e) {
            fail(e);
        }
    };
    const importFile = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        const format = /\.json$/i.test(file.name) ? "json" : /\.csv$/i.test(file.name) ? "csv" : null;
        if (!format) return setError("csv나 json 파일만 가져올 수 있습니다.");
        if (
            !window.confirm(`「${file.name}」을(를) 가져올까요?
같은 id의 게임은 파일 내용으로 덮어쓰고, 없는 게임은 새로 추가합니다. 파일에 없는 게임은 그대로 둡니다.`)
        )
            return;
        setError(null);
        setNote("가져오는 중…");
        try {
            const r = await api.importLedger(format, await file.text());
            setRows((await api.ledger()).map(toRow));
            setNote(`가져왔습니다. 새로 추가 ${r.inserted}개, 덮어쓰기 ${r.updated}개.${r.ignored.length ? ` 모르는 열은 건너뜀: ${r.ignored.join(", ")}` : ""}`);
        } catch (err) {
            setNote("");
            fail(err);
        }
    };

    const list = rows ?? [];
    const added = fresh.map((id) => list.find((r) => r.id === id)).filter((r): r is Row => !!r);
    const sorted = list.filter((r) => !fresh.includes(r.id)).sort((a, b) => compareRows(a, b, sort.key, sort.dir));
    const sum = (key: Field, rs = list) => rs.reduce((a, r) => a + (Number(r.saved[key].replace(/[^0-9]/g, "")) || 0), 0);
    // 방출 가격이 적힌 게임만 모아, 그 게임들을 얼마에 샀는지와 비교합니다.
    const sold = list.filter((r) => r.saved.sellPrice.trim());
    const soldGap = sum("sellPrice", sold) - sum("purchasePrice", sold);
    const count = (...statuses: string[]) => list.filter((r) => statuses.includes(r.saved.status)).length;
    const editing = coverOf ? list.find((r) => r.id === coverOf) : undefined;

    const cell = (r: Row, key: Field, label: string, extra = "", props: Record<string, string> = {}) => (
        <div className="tc" role="cell">
            <input
                className={"cell " + extra}
                aria-label={label}
                value={r.draft[key]}
                onChange={(e) => edit(r.id, key, e.target.value)}
                onBlur={() => save(r, key)}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                {...props}
            />
        </div>
    );
    const entryCell = (key: Field, label: string, extra = "", props: Record<string, string> = {}) => (
        <div className="tc" role="cell">
            <input className={"cell " + extra} aria-label={`새 게임 ${label}`} placeholder={label} value={entry[key]} onChange={(e) => setEntry({ ...entry, [key]: e.target.value })} {...props} />
        </div>
    );
    const categorySelect = (value: string, label: string, onChange: (v: string) => void) => (
        <div className="tc" role="cell">
            <select className="cell" aria-label={label} value={value} style={{ color: value ? categoryColor(value) : "var(--dim)" }} onChange={(e) => onChange(e.target.value)}>
                <option value="">미정</option>
                {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                        {c}
                    </option>
                ))}
            </select>
        </div>
    );
    const statusSelect = (value: string, label: string, onChange: (v: string) => void) => (
        <div className="tc" role="cell">
            <select className="cell" aria-label={label} value={value} style={{ color: STATUS_COLOR[value] }} onChange={(e) => onChange(e.target.value)}>
                {STATUSES.map((s) => (
                    <option key={s} value={s}>
                        {s}
                    </option>
                ))}
            </select>
        </div>
    );
    const head = (key: SortKey | null, label: string, align = "") => {
        if (!key)
            return (
                <div className={"tc th " + align} role="columnheader">
                    {label}
                </div>
            );
        const on = sort.key === key;
        return (
            <div className={"tc th sortable " + align} role="columnheader" aria-sort={on ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
                <button type="button" className={"th-sort" + (on ? " on" : "")} onClick={() => setSort(on ? { key, dir: sort.dir === 1 ? -1 : 1 } : { key, dir: 1 })}>
                    {label}
                    <span aria-hidden="true" className="arrow">
                        {on ? (sort.dir === 1 ? "▲" : "▼") : "↕"}
                    </span>
                </button>
            </div>
        );
    };
    const bodyRow = (r: Row, isNew = false) => (
        <div key={r.id} className={"trow body" + (isNew ? " fresh" : "")} role="row">
            <div className="tc rowno" role="cell">
                {isNew ? "NEW" : r.no}
            </div>
            <div className="tc" role="cell">
                <button type="button" className="thumb" aria-label={`${r.saved.nameKo} 상세 수정`} title="상세 수정 (표지·한 줄 설명·베스트 인원)" onClick={() => setCoverOf(r.id)}>
                    {r.game.imageUrl ? <img src={r.game.imageUrl} alt="" loading="lazy" /> : <span className="thumb-add">+</span>}
                </button>
            </div>
            {cell(r, "nameKo", "게임 이름")}
            {cell(r, "weight", "웨이트", "num", { inputMode: "decimal" })}
            {categorySelect(r.draft.category, "카테고리", (v) => {
                edit(r.id, "category", v);
                save(r, "category", v);
            })}
            {cell(r, "recommendedPlayers", "인원")}
            {cell(r, "purchasePrice", "구매 가격", "num", { inputMode: "numeric" })}
            {cell(r, "sellPrice", "방출 가격", "num", { inputMode: "numeric", placeholder: "-" })}
            {statusSelect(r.draft.status, "상태", (v) => {
                edit(r.id, "status", v);
                save(r, "status", v);
            })}
            <div className="tc" role="cell" style={{ textAlign: "center" }}>
                <button type="button" className="del" aria-label={`${r.saved.nameKo} 행 삭제`} onClick={() => remove(r)}>
                    ✕
                </button>
            </div>
        </div>
    );

    return (
        <Layout page="admin" footNote="가격은 이 화면에서만 보입니다">
            {!authed ? (
                <main className="wrap pad">
                    <Login onDone={() => setAuthed(true)} />
                </main>
            ) : (
                <main className="wrap pad" style={{ paddingTop: 40 }}>
                    <div className="adm-head">
                        <div className="txt">
                            <div className="g11 eyebrow">▪ THE LEDGER</div>
                            <h1 className="h1">공방 장부</h1>
                            <p>칸을 고치고 다른 곳을 누르면 바로 저장됩니다. 열 이름을 누르면 정렬되고, 표지 칸을 누르면 표지·한 줄 설명·베스트 인원을 고치는 상세 창이 열립니다.</p>
                        </div>
                        <div className="adm-actions">
                            <Inbox />
                            <button type="button" className="btn" onClick={() => exportAs("csv")}>
                                CSV 내보내기
                            </button>
                            <button type="button" className="btn" onClick={() => exportAs("json")}>
                                JSON 내보내기
                            </button>
                            <label className="btn">
                                가져오기
                                <input type="file" accept=".csv,.json,text/csv,application/json" hidden onChange={importFile} />
                            </label>
                            <button
                                type="button"
                                className="btn"
                                onClick={() => {
                                    auth.clear();
                                    setAuthed(false);
                                    setRows(null);
                                }}
                            >
                                로그아웃
                            </button>
                        </div>
                    </div>

                    <div className="tiles">
                        <div className="tile">
                            <span className="dim">전체 행</span>
                            <b>{list.length}개</b>
                        </div>
                        <div className="tile">
                            <span className="dim">보유 중</span>
                            <b>{count("보유", "대여 중")}개</b>
                        </div>
                        <div className="tile">
                            <span className="dim">대여 중</span>
                            <b>{count("대여 중")}개</b>
                        </div>
                        <div className="tile">
                            <span className="dim">구매 가격 합계</span>
                            <b>{won(sum("purchasePrice"))}</b>
                        </div>
                        <div className="tile">
                            <span className="dim">방출 가격 합계</span>
                            <b>{won(sum("sellPrice"))}</b>
                            {sold.length > 0 && (
                                <span className="tile-sub">(손익 {(soldGap > 0 ? "+" : soldGap < 0 ? "−" : "") + won(Math.abs(soldGap))})</span>
                            )}
                        </div>
                    </div>

                    <div role="status" aria-live="polite">
                        {error ? <div className="err">{error}</div> : <div className="dim">{rows ? note || " " : "장부를 펴는 중…"}</div>}
                    </div>

                    <BggSearch
                        actionLabel="장부에 가져오기"
                        onPick={async (h) => {
                            const g = await api.bggImport(h.bggId);
                            setRows((rs) => [...(rs ?? []).filter((r) => r.id !== g.id), toRow(g)]);
                            pin(g.id);
                            setNote(`「${g.nameKo}」을(를) 가져왔습니다.`);
                        }}
                    />

                    <div className="sheet panel">
                        <div className="sheet-in" role="table" aria-label="컬렉션 장부">
                            <div className="trow letters" aria-hidden="true">
                                <div className="tc" />
                                <div className="tc">A</div>
                                <div className="tc">B</div>
                                <div className="tc">C</div>
                                <div className="tc">D</div>
                                <div className="tc">E</div>
                                <div className="tc">F</div>
                                <div className="tc">G</div>
                                <div className="tc">H</div>
                                <div className="tc" />
                            </div>
                            <div className="trow heads" role="row">
                                {head("no", "", "c")}
                                {head(null, "상세", "c")}
                                {head("nameKo", "게임 이름")}
                                {head("weight", "웨이트", "r")}
                                {head("category", "카테고리")}
                                {head("recommendedPlayers", "인원")}
                                {head("purchasePrice", "구매 가격 (원)", "r")}
                                {head("sellPrice", "방출 가격 (원)", "r")}
                                {head("status", "상태")}
                                {head(null, "삭제", "c")}
                            </div>
                            <form className="trow entry" role="row" aria-label="새 게임 추가" onSubmit={add}>
                                <div className="tc rowno" role="cell">
                                    +
                                </div>
                                <div className="tc thumb-none dim" role="cell" title="추가한 뒤 표지를 넣을 수 있습니다">
                                    -
                                </div>
                                <div className="tc" role="cell">
                                    <input
                                        ref={entryName}
                                        className="cell"
                                        aria-label="새 게임 이름"
                                        placeholder="새 게임 이름"
                                        value={entry.nameKo}
                                        onChange={(e) => setEntry({ ...entry, nameKo: e.target.value })}
                                    />
                                </div>
                                {entryCell("weight", "웨이트", "num", { inputMode: "decimal" })}
                                {categorySelect(entry.category, "새 게임 카테고리", (v) => setEntry({ ...entry, category: v }))}
                                {entryCell("recommendedPlayers", "인원")}
                                {entryCell("purchasePrice", "구매 가격", "num", { inputMode: "numeric" })}
                                {entryCell("sellPrice", "방출 가격", "num", { inputMode: "numeric" })}
                                {statusSelect(entry.status, "새 게임 상태", (v) => setEntry({ ...entry, status: v }))}
                                <div className="tc" role="cell">
                                    <button type="submit" className="add-btn" disabled={adding || !entry.nameKo.trim()}>
                                        {adding ? "…" : "추가"}
                                    </button>
                                </div>
                            </form>
                            {added.map((r) => bodyRow(r, true))}
                            {sorted.map((r) => bodyRow(r))}
                        </div>
                    </div>
                    <p className="dim">좁은 화면에서는 표를 좌우로 밀어서 봅니다. 방출 완료로 바꾼 게임은 방문자 화면에서 빠지고, 대여 중인 게임은 컬렉션에 "대여 중"으로 표시됩니다.</p>
                    {editing && (
                        <DetailEditor
                            row={editing}
                            onClose={() => setCoverOf(null)}
                            onSaved={(g, message) => {
                                replace(g);
                                setNote(`「${g.nameKo}」 ${message}`);
                            }}
                        />
                    )}
                </main>
            )}
        </Layout>
    );
}
