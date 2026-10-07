import { useEffect, useMemo, useRef, useState } from 'react';
import { api, Game, playersText, Recommendation, timeText, weightText } from '../api';
import { Cover } from '../components/Cover';
import { Layout } from '../components/Layout';
import { categoryColor, die, IVORY_DIE, mapRows, paint, Rect, shade, Sprite, sprite, tint } from '../pixel';
import { Link } from '../router';

type Phase = 'raw' | 'pour' | 'done';
type TimePref = 'any' | 'short' | 'mid' | 'long';
type Mood = 'any' | 'light' | 'mid' | 'heavy' | 'party' | 'coop';

const POTION: Record<Mood, string> = { any: '#8A5BD6', light: '#57C98A', mid: '#4E9FDB', heavy: '#D2505A', party: '#F0A23C', coop: '#3FC4B6' };
// 솥 색: 기분이 바탕색을 고르고, 인원은 색상을 돌리고, 시간은 밝기를 바꿉니다. 조합마다 색이 다릅니다.
const HUE_BY_PLAYERS: Record<number, number> = { 2: -16, 3: 0, 4: 16, 5: 32 };
const TONE_BY_TIME: Record<TimePref, [sat: number, light: number]> = { any: [0, 0], short: [8, 10], mid: [0, 0], long: [-6, -12] };
const brewColor = (n: number, time: TimePref, mood: Mood) => tint(POTION[mood], HUE_BY_PLAYERS[n] ?? 0, ...TONE_BY_TIME[time]);
const POUR_MS = 800;

// ---------- 장면 위에 얹는 작은 그림들 (한 번만 만듭니다) ----------
// 보드게임 나무 미플. 칠한 나무처럼 위·왼쪽 모서리는 밝게, 아래·오른쪽은 어둡게, 옆면 두께와 나뭇결을 넣습니다.
const MEEPLE_SHAPE = [
  '....xxxxx....',
  '...xxxxxxx...',
  '...xxxxxxx...',
  '...xxxxxxx...',
  '....xxxxx....',
  '.xxxxxxxxxxx.',
  'xxxxxxxxxxxxx',
  'xxxxxxxxxxxxx',
  '.xxxxxxxxxxx.',
  '...xxxxxxx...',
  '...xxxxxxx...',
  '..xxxxxxxxx..',
  '..xxxx.xxxx..',
  '.xxxx...xxxx.',
  '.xxxx...xxxx.',
];
// 플레이어 색: 빨강, 파랑, 초록, 노랑, 보라
const MEEPLE_COLORS = ['#C9473D', '#3B6FC0', '#4C9A4B', '#E2B23A', '#8556B8'];

function meeple(c: string): Sprite {
  const on = (x: number, y: number) => MEEPLE_SHAPE[y]?.[x] === 'x';
  const rows = Array.from({ length: MEEPLE_SHAPE.length + 1 }, (_, y) =>
    Array.from({ length: MEEPLE_SHAPE[0].length + 1 }, (_, x) => {
      if (!on(x, y)) return on(x - 1, y - 1) ? 's' : '.';
      if (!on(x, y - 1) || !on(x - 1, y)) return 'L';
      if (!on(x + 1, y) || !on(x, y + 1)) return 'd';
      return (x * 5 + y * 3) % 11 === 0 || (y === 7 && x % 4 === 2) ? 'g' : 'm';
    }).join(''),
  );
  // 반 칸 크기로 그려, 예전 7x8 미플과 같은 자리를 더 고운 그림으로 채웁니다.
  return { w: rows[0].length / 2, h: rows.length / 2, bg: paint(mapRows(rows, { L: shade(c, 1.28), m: c, g: shade(c, 0.88), d: shade(c, 0.74), s: shade(c, 0.5) }, 0, 0, 0.5)) };
}
const MEEPLES = MEEPLE_COLORS.map(meeple);
const SPARK = sprite(['..w..', '..w..', 'wwwww', '..w..', '..w..'], { w: '#FFF1C2' });
const DICE_FACES = [IVORY_DIE, die(3, 1, 2, '#C9473D', '#FBF3DC'), die(6, 4, 1, '#8556B8', '#FBF3DC')];
// [왼쪽 위치, 주사위 면, 떨어지기 시작하는 시각(초)]
const DICE: [number, number, number][] = [[292, 0, 0], [340, 1, 0.07], [384, 2, 0.03], [314, 2, 0.15], [362, 0, 0.19], [404, 1, 0.11], [328, 1, 0.25], [376, 2, 0.28], [300, 0, 0.31], [396, 0, 0.23]];

function flame(phase: number): string {
  const L: Rect[] = [];
  for (let x = 0; x < 96; x++) {
    const env = Math.sin((x / 95) * Math.PI);
    const h = Math.round(env * (13 + 14 * Math.abs(Math.sin(x * 0.29 + phase)) + 5 * Math.sin(x * 0.9 + phase * 2)));
    if (h < 1) continue;
    L.push([x, 36 - h, 1, h, '#D9632E'], [x, 36 - Math.round(h * 0.72), 1, Math.round(h * 0.72), '#F09A3C'], [x, 36 - Math.round(h * 0.45), 1, Math.round(h * 0.45), '#F6C56B']);
    if (h > 16) L.push([x, 36 - Math.round(h * 0.22), 1, Math.round(h * 0.22), '#FFF1C2']);
  }
  return paint(L);
}
const FLAME_A = flame(0.4);
const FLAME_B = flame(2.1);

function potion(c: string): string {
  const L: Rect[] = [];
  for (let d = -9; d <= 9; d++) {
    const q = Math.round(79 * Math.sqrt(1 - (d / 9.6) * (d / 9.6)));
    L.push([79 - q, 9 + d, q * 2, 1, d < -4 ? shade(c, 0.7) : d < 0 ? shade(c, 0.88) : c], [79 - q, 9 + d, 4, 1, shade(c, 0.55)], [79 + q - 4, 9 + d, 4, 1, shade(c, 0.55)]);
  }
  for (const [x, y, w] of [[30, 7, 18], [66, 4, 12], [96, 10, 20], [46, 13, 14], [112, 6, 10], [78, 15, 16], [20, 11, 8], [128, 12, 9]]) {
    L.push([x, y, w, 1, shade(c, 1.45)], [x + 2, y + 1, w - 6, 1, shade(c, 1.2)]);
  }
  return paint(L);
}

function hourglass(time: TimePref) {
  const top = { any: 0, short: 1, mid: 3, long: 4 }[time];
  const rows = ['wwwwwwww', '.g....g.', '.g....g.', '.g....g.', '..g..g..', '...gg...', '...gg...', '..g..g..', '.g....g.', '.g....g.', '.gssssg.', 'wwwwwwww'].map((row, y) =>
    y >= 1 && y <= 4 && y > 4 - top ? row.replace(/\./g, (ch, i: number) => (i > row.indexOf('g') && i < row.lastIndexOf('g') ? 's' : ch)) : row,
  );
  return sprite(rows, { w: '#8A5A35', g: '#BFE3EE', s: '#F6C56B' });
}

function bottle(c: string) {
  return sprite(['..cc..', '..gg..', '..gg..', '.gggg.', 'gllllg', 'gLlllg', 'gLlllg', 'gllllg', 'gllllg', '.gggg.'], { c: '#C9A26B', g: '#EFE7D4', l: c, L: shade(c, 1.5) });
}

function useViewport() {
  // hd: 머리말 높이. 첫 그리기 전에는 머리말이 없어 기본값을 쓰고, 붙은 뒤 한 번 더 잽니다.
  const read = () => ({
    cw: document.documentElement.clientWidth || 1440,
    ch: window.innerHeight || 1070,
    hd: Math.round(document.querySelector('.hd')?.getBoundingClientRect().height ?? 72),
  });
  const [v, setV] = useState(read);
  useEffect(() => {
    const on = () => setV(read());
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return v;
}

/** 화면 크기에 맞춰 장면과 패널의 크기·위치를 정합니다. 640px 미만은 세로(폰) 배치입니다. */
function layout(cw: number, ch: number, hd: number) {
  const phone = cw < 640;
  const u = phone ? 1 : Math.min(1, Math.max(0.55, cw / 1280));
  const minH = Math.round(620 * u);
  // 홈에는 꼬리말이 없어 머리말 아래를 장면이 모두 채웁니다.
  const heroH = phone ? Math.round(Math.max(520, Math.min(ch - hd, 900))) : Math.round(Math.max(minH, Math.min((960 * cw) / 1440, Math.max(minH, ch - hd))));
  // 가로로 긴 화면에서도 그림 높이의 78%는 보이도록 확대를 제한하고, 남는 양옆은 흐린 배경으로 채웁니다.
  const sc = Math.max(heroH / 960, Math.min(cw / 1440, heroH / (960 * 0.78)));
  // 창문 아치(그림 위에서 30px쯤)가 잘리지 않도록 위는 20px까지만 자르고, 나머지는 바닥 쪽에서 자릅니다.
  const stageT = Math.round(Math.max(heroH - 960 * sc, -20 * sc));
  const stageL = Math.round((cw - 1440 * sc) / 2);
  // 패널은 솥 가장자리(그림 기준 중심에서 210px)에서 40px 떨어진 곳에 붙이되, 화면 밖으로 나가지 않게 합니다.
  const sideMin = Math.min(56, Math.max(12, Math.round(cw * 0.039)));
  const beside = (w: number) => Math.round(Math.max(sideMin, cw / 2 - 250 * sc - w * u));
  const titleFs = phone ? (heroH < 700 || cw < 360 ? 30 : 36) : Math.max(20, Math.round(60 * Math.min(1, heroH / 960)));
  const panelTop = Math.round(16 + titleFs * 2.4 + 40);
  const rightTop = phone ? panelTop : Math.round(Math.max(72 * u, Math.min(heroH * 0.41, heroH - 520 * u)));
  return {
    phone, u, heroH, sc, stageT, titleFs, panelTop,
    stageL,
    wide: stageL > 0,
    leftX: beside(264),
    rightX: beside(320),
    titleTop: phone ? 16 : Math.max(Math.round(20 * u), Math.round(stageT + 170 * sc)),
    subFs: phone ? 12 : Math.max(10, Math.round(15 * u)),
    eyebrow: !phone && heroH >= 700 * u,
    rightTop,
    // 재료 패널은 오른쪽 패널과 같은 높이에서 시작하되, 키가 큰 만큼 아래로 넘치지 않게 합니다.
    leftTop: Math.round(Math.min(rightTop, heroH - 460 * u)),
  };
}

export function Home() {
  const [n, setN] = useState(3);
  const [time, setTime] = useState<TimePref>('mid');
  const [mood, setMood] = useState<Mood>('mid');
  const [phase, setPhase] = useState<Phase>('raw');
  const [k, setK] = useState(0);
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [total, setTotal] = useState<number | undefined>(undefined);
  const timer = useRef<number>();
  const { cw, ch, hd } = useViewport();
  const L = layout(cw, ch, hd);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    api.games({}).then((r) => setTotal(r.total)).catch(() => undefined);
  }, []);

  // 재료가 바뀌면 후보를 다시 받아 옵니다.
  useEffect(() => {
    let alive = true;
    setError(null);
    const t = window.setTimeout(() => {
      api
        .recommend(n === 5 ? 5 : n, time, mood)
        .then((r) => alive && setRec(r))
        .catch((e: Error) => alive && setError(e.message));
    }, 120);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [n, time, mood, retry]);

  const change = (fn: () => void) => {
    window.clearTimeout(timer.current);
    fn();
    setPhase('raw');
    setK(0);
    setTick((x) => x + 1);
  };

  const pool = rec?.candidates ?? [];
  const cur = pool.length ? pool[k % pool.length] : null;
  const game: Game | null = cur?.game ?? null;
  const done = phase === 'done' && !!game;
  const pouring = phase === 'pour';
  const pcol = brewColor(n, time, mood);

  const brew = () => {
    if (pouring || !pool.length) return;
    const next = phase === 'done' ? k + 1 : 0;
    setPhase('pour');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setK(next);
      setPhase('done');
    }, POUR_MS);
  };

  const floaters = useMemo(() => {
    const list = Array.from({ length: n }, (_, i) => ({ ...MEEPLES[i % MEEPLES.length], d: `${i * 0.15}s` }));
    if (time !== 'any') list.push({ ...hourglass(time), d: '.3s' });
    if (mood !== 'any') list.push({ ...bottle(POTION[mood]), d: '.5s' });
    return list;
  }, [n, time, mood]);

  const potionBg = useMemo(() => potion(done ? shade(pcol, 1.15) : pcol), [pcol, done]);
  const bubble = shade(pcol, 1.5);
  const fit = !cur || !rec ? '' : cur.score === rec.full ? (rec.full ? '고른 재료에 모두 맞는 한 판이에요.' : '인원에 맞는 판 가운데 평점이 가장 높아요.') : cur.score > 0 ? '재료가 조금 달라요. 인원과 일부 조건만 맞췄어요.' : '딱 맞는 판이 없어 인원만 맞췄어요.';
  const hint = error ? error : !rec ? '재료를 손질하는 중…' : !pool.length ? '이 인원에 맞는 상자가 선반에 없어요.' : done ? '재료를 바꾸면 솥이 다시 비워져요.' : pouring ? '주사위가 솥으로 떨어지는 중…' : '재료 준비 끝. 주사위를 뿌려요.';
  const uiT = L.phone ? undefined : `scale(${L.u.toFixed(3)})`;

  return (
    <Layout page="home" count={total} footer={false}>
      <main className={`hero ${L.phone ? 'p' : 'd'}${done ? ' done' : ''}`} style={{ height: L.heroH }}>
        <div className="scene" aria-hidden="true">
          {L.wide && <div className="scene-fill" />}
          <div className={`stage${L.wide ? ' fade' : ''}`} style={{ left: L.stageL, top: L.stageT, transform: `scale(${L.sc.toFixed(4)})` }}>
            <img src="/assets/atelier-back.png" alt="" />
            <div style={{ left: '281em', top: '281em', width: '158em', height: '19em', background: potionBg }} />
            {done && game && (
              <div className="rising rise" key={`box-${game.id}-${k}`}>
                <Cover imageUrl={game.imageUrl} />
              </div>
            )}
            <img src="/assets/atelier-front.png" alt="" />
            <div className="fl1" style={{ left: '312em', top: '356em', width: '96em', height: '36em', background: FLAME_A }} />
            <div className="fl2" style={{ left: '312em', top: '356em', width: '96em', height: '36em', background: FLAME_B }} />
            {!done && (
              <div className={`floaters ${pouring ? 'sink' : 'plop'}`} key={pouring ? 'sink' : `plop-${tick}`}>
                {floaters.map((f, i) => (
                  <div key={i} className="bob" style={{ width: `${f.w}em`, height: `${f.h}em`, background: f.bg, animationDelay: f.d }} />
                ))}
              </div>
            )}
            {pouring &&
              DICE.map(([left, face, delay], i) => (
                <div key={i} className="drop" style={{ left: `${left}em`, top: '256em', animationDelay: `${delay}s` }}>
                  <div style={{ fontSize: '3em', width: '10em', height: '10em', background: DICE_FACES[face].bg }} />
                </div>
              ))}
            {done && (
              <>
                <div className="burst" style={{ left: '250em', top: '210em', width: '220em', height: '130em', mixBlendMode: 'screen', background: `radial-gradient(ellipse at center, ${pcol}, transparent 70%)` }} />
                {[[148, 103, 0], [206, 116, 0.4], [202, 90, 0.7]].map(([l, t, d], i) => (
                  <div key={i} className="tw" style={{ left: `${l}em`, top: `${t}em`, fontSize: '2em', width: '5em', height: '5em', background: SPARK.bg, animationDelay: `${d}s` }} />
                ))}
              </>
            )}
            {[[318, 280, 4, 0], [364, 283, 3, 0.6], [398, 280, 4, 1.1]].map(([l, t, s, d], i) => (
              <div key={i} className="bub" style={{ left: `${l}em`, top: `${t}em`, width: `${s}em`, height: `${s}em`, background: bubble, animationDelay: `${d}s` }} />
            ))}
            <div className="full glow" style={{ mixBlendMode: 'screen', background: 'radial-gradient(ellipse 170em 80em at 360em 404em, rgba(255,130,50,0.34), transparent 100%)' }} />
            <div className="full" style={{ mixBlendMode: 'screen', background: `radial-gradient(ellipse 150em 80em at 360em 282em, ${pcol}${done ? 'B3' : '66'}, transparent 100%)` }} />
            <div className="full" style={{ background: 'radial-gradient(ellipse 150em 110em at 360em 118em, rgba(8,7,26,0.68), transparent 100%), linear-gradient(rgba(13,8,16,0.45), transparent 16%)' }} />
          </div>
        </div>

        <div className="ov-tl g11">▪ THE MUNSE ATELIER</div>
        <div className="ov-tr g11">OPEN FOR ONE MORE GAME ✦</div>

        <div className="ov-title" style={{ top: L.titleTop }}>
          {L.eyebrow && <div className="pre" style={{ fontSize: L.subFs }}>고민은 솥에 넣어 두고</div>}
          <h1 style={{ fontSize: L.titleFs }}>
            오늘의 한 판,
            <br />
            <span>끓여보자.</span>
          </h1>
          <p style={{ fontSize: L.subFs }}>재료는 당신이. 불 조절은 공방이.</p>
        </div>

        <section className="ov-left" aria-label="오늘의 재료" style={L.phone ? { top: L.panelTop } : { left: L.leftX, top: L.leftTop, transform: uiT }}>
          <div className="ing-head">
            <h2>
              <span aria-hidden="true">✦ </span>오늘의 재료
            </h2>
            <div className="dim" style={{ letterSpacing: '.16em' }}>INGREDIENTS</div>
          </div>
          <div className="ing-field ing-people" role="group" aria-label="함께할 사람">
            <div className="lab ing-lab">함께할 사람 (미플)</div>
            <div className="people">
              {[2, 3, 4, 5].map((v) => (
                <button key={v} type="button" className="pp" aria-pressed={n === v} aria-label={v === 5 ? '5명 이상' : `${v}명`} onClick={() => change(() => setN(v))}>
                  {v === 5 ? '5+' : v}
                  {v !== 5 && <small>명</small>}
                </button>
              ))}
            </div>
          </div>
          <label className="ing-field">
            <span className="lab ing-lab">얼마나 놀까요? (모래)</span>
            <select className="fld" aria-label="얼마나 놀까요" value={time} onChange={(e) => change(() => setTime(e.target.value as TimePref))}>
              <option value="any">상관없어요</option>
              <option value="short">삼십 분 안쪽</option>
              <option value="mid">한 시간쯤</option>
              <option value="long">느긋하게 길게</option>
            </select>
          </label>
          <label className="ing-field">
            <span className="lab ing-lab">오늘의 기분 (물약)</span>
            <select className="fld" aria-label="오늘의 기분" value={mood} onChange={(e) => change(() => setMood(e.target.value as Mood))}>
              <option value="any">아무거나</option>
              <option value="light">가볍게</option>
              <option value="mid">적당한 전략</option>
              <option value="heavy">묵직하게</option>
              <option value="party">왁자지껄</option>
              <option value="coop">한 팀으로</option>
            </select>
          </label>
          <div className="ing-hint g11" role="status">
            {hint}
            {error && (
              <button type="button" className="btn" style={{ marginTop: 8 }} onClick={() => setRetry((x) => x + 1)}>
                다시 시도
              </button>
            )}
          </div>
        </section>

        <div className="ov-right" aria-live="polite" style={L.phone ? { top: L.rightTop } : { top: L.rightTop, right: L.rightX, transform: uiT }}>
          {!done && (
            <figure className="quote">
              <figcaption className="g11">공방지기의 한마디</figcaption>
              <blockquote>
                “좋은 재료가 따로 있나.
                <br />
                오늘 모인 사람이
                <br />
                제일 좋은 재료지.”
              </blockquote>
              <div className="dim">공방지기 문세</div>
            </figure>
          )}
          {done && game && (
            <section className="res">
              <div className="res-head g11">
                <span aria-hidden="true">✦ </span>솥에서 나온 한 판
              </div>
              <button type="button" className="res-reset only-p g11" onClick={() => change(() => undefined)}>
                재료 바꾸기
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <h2 className="name">{game.nameKo}</h2>
                <div className="dim">
                  {game.nameEn} · {game.category}
                </div>
              </div>
              <p className="res-desc">{game.description}</p>
              <div className="stats">
                <div><span className="dim">인원</span><span className="v">{playersText(game)}</span></div>
                <div><span className="dim">시간</span><span className="v">{timeText(game)}</span></div>
                <div><span className="dim">웨이트</span><span className="v">{weightText(game)}</span></div>
                <div><span className="dim">평점</span><span className="v">{game.rating.toFixed(1)}</span></div>
              </div>
              <div className="res-fit g11">{fit}</div>
            </section>
          )}
          {open && (
            <div className="cands">
              {pool.slice(0, 3).map((c, i) => (
                <button
                  key={c.game.id}
                  type="button"
                  className="chip"
                  aria-pressed={done && k % pool.length === i}
                  onClick={() => {
                    window.clearTimeout(timer.current);
                    setK(i);
                    setPhase('done');
                  }}
                >
                  <span>
                    <span aria-hidden="true" style={{ color: categoryColor(c.game.category) }}>■ </span>
                    {c.game.nameKo}
                  </span>
                  <span className="dim">
                    {playersText(c.game)} · {timeText(c.game)}
                  </span>
                </button>
              ))}
            </div>
          )}
          <Link to="/collection" className="col-link">
            우리의 컬렉션{total !== undefined && <span className="g11 count">{total}</span>}
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="ov-cta" style={L.phone ? { bottom: 16 } : { bottom: Math.round(24 * L.u), transform: `translateX(-50%) scale(${L.u.toFixed(3)})` }}>
          <button type="button" className="cta g11" disabled={pouring || !pool.length} onClick={brew}>
            <svg width="24" height="24" viewBox="0 0 12 12" shapeRendering="crispEdges" aria-hidden="true">
              <path fill="#1B1220" d="M1 3h10v1H1zM2 4h8v5H2zM3 9h6v1H3zM2 10h1v1H2zM9 10h1v1H9zM4 0h1v2H4zM7 1h1v1H7z" />
            </svg>
            {pouring ? '보글보글…' : done ? '한 번 더 끓이기' : '주사위 넣고 끓이기'}
          </button>
          <div className="cta-sub g11">
            <span>주사위 한 줌이 마지막 재료예요</span>
            <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? '후보 접기 ▴' : '후보 3개 펼치기 ▾'}
            </button>
          </div>
        </div>
      </main>
    </Layout>
  );
}
