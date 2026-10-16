import { useState } from 'react';
import { api, auth, InstaPlan, InstaTask, TaskKind } from '../api';
import { Layout, LoadState, Notice } from '../components/Layout';
import { Link } from '../router';
import { useLoad } from '../useLoad';
import './insta.css';

const KIND: Record<TaskKind, string> = { reel: '릴스', card: '캐러셀', toon: '인스타툰', sponsor: '협찬', prep: '준비', check: '점검' };
const DONE_KEY = 'munse-insta-done';
const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

// 체크 표시는 이 브라우저에만 남깁니다. 저장소를 못 쓰면 새로고침 전까지만 기억합니다.
function loadDone(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(DONE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

/** 날짜 계산은 시간대 영향을 받지 않도록 UTC 자정 기준으로 합니다. */
const day = (iso: string) => new Date(iso + 'T00:00:00Z');
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const short = (s: string) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;
const weekday = (s: string) => DAYS[(day(s).getUTCDay() + 6) % 7];
const todayIso = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

export function Insta() {
  const authed = !!auth.get();
  return (
    <Layout page="insta" footNote="이 화면은 관리자에게만 보입니다">
      <main className="wrap pad insta" style={{ paddingTop: 40 }}>
        {authed ? (
          <Plan />
        ) : (
          <div className="state">
            관리자 로그인이 필요한 화면이에요.
            <Link to="/admin" className="btn-gold ig-login">장부에서 로그인하기</Link>
          </div>
        )}
      </main>
    </Layout>
  );
}

function Plan() {
  const { data, loading, error, reload } = useLoad(() => api.instaPlan(), []);
  const [done, setDone] = useState(loadDone);
  const toggle = (id: string) =>
    setDone((d) => {
      const next = { ...d, [id]: !d[id] };
      try {
        localStorage.setItem(DONE_KEY, JSON.stringify(next));
      } catch {
        /* 저장소를 쓸 수 없으면 화면에서만 표시합니다 */
      }
      return next;
    });

  if (!data) return <LoadState loading={loading} error={error} onRetry={reload} />;
  const p = data;
  const finished = p.tasks.filter((t) => done[t.id]).length;

  return (
    <>
      <div className="adm-head">
        <div className="txt">
          <div className="g11 eyebrow">▪ {p.account} · 인사이트 {p.checkedAt} 기준</div>
          <h1 className="h1">인스타 운영</h1>
          <p>{p.summary}</p>
        </div>
      </div>

      <div className="tiles">
        {p.kpis.map((k) => (
          <div className="tile" key={k.label}>
            <span className="dim">{k.label}</span>
            <b>{k.value}</b>
            <span className={'tile-sub' + (k.down ? ' ig-down' : '')}>{k.sub}</span>
          </div>
        ))}
      </div>

      <section className="ig-sec" aria-labelledby="ig-cal">
        <div className="ig-sec-head">
          <h2 id="ig-cal" className="ig-h2">운영 캘린더</h2>
          <span className="dim" aria-live="polite">완료 {finished} / {p.tasks.length}</span>
        </div>
        <Legend />
        <Calendar plan={p} done={done} />
      </section>

      <section className="ig-sec panel ig-sponsor" aria-labelledby="ig-sp">
        <div className="ig-sec-head">
          <h2 id="ig-sp" className="ig-h2"><span className="ig-chip k-sponsor">협찬</span>협찬 릴스</h2>
          <span className="dim">업로드 {short(p.sponsor.upload)} · 기한 {short(p.sponsor.deadline)}</span>
        </div>
        <ul className="ig-list">
          {p.sponsor.points.map((s) => <li key={s}>{s}</li>)}
        </ul>
      </section>

      <section className="ig-sec" aria-labelledby="ig-weeks">
        <h2 id="ig-weeks" className="ig-h2">주차별 할 일</h2>
        <div className="ig-rhythm">
          {p.rhythm.map((r) => (
            <div key={r.day} className="tile">
              <span className="ig-day">{r.day}</span>
              <span className="tile-sub">{r.what}</span>
            </div>
          ))}
        </div>
        {p.weeks.map((w) => (
          <div key={w.title} className="panel ig-week">
            <div className="ig-week-head">
              <h3 className="ig-h3">{w.title}</h3>
              <span className="dim">{short(w.start)} – {short(w.end)}</span>
              <p>{w.goal}</p>
            </div>
            <ul className="ig-tasks">
              {p.tasks.filter((t) => t.date >= w.start && t.date <= w.end).map((t) => (
                <TaskRow key={t.id} t={t} checked={!!done[t.id]} onToggle={() => toggle(t.id)} />
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="ig-sec" aria-labelledby="ig-picks">
        <h2 id="ig-picks" className="ig-h2">지금 바로 올릴 게시물</h2>
        <div className="ig-grid">
          {p.picks.map((k) => (
            <article key={k.title} className="panel ig-card">
              <span className="dim"><span className={'ig-chip k-' + k.kind}>{KIND[k.kind]}</span>{k.date}</span>
              <h3 className="ig-h3">{k.title}</h3>
              <p>{k.body}</p>
              <ul className="ig-list">{k.points.map((s) => <li key={s}>{s}</li>)}</ul>
            </article>
          ))}
        </div>
      </section>

      <section className="ig-sec" aria-labelledby="ig-goal">
        <h2 id="ig-goal" className="ig-h2">4주 뒤 목표</h2>
        <div className="tiles">
          {p.goals.map((g) => (
            <div className="tile" key={g.label}>
              <b>{g.value}</b>
              <span className="tile-sub">{g.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="ig-sec" aria-labelledby="ig-find">
        <h2 id="ig-find" className="ig-h2">핵심 발견</h2>
        <ol className="ig-find">
          {p.findings.map((f) => (
            <li key={f.title}>
              <b>{f.title}</b>
              <span>{f.body}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="ig-sec" aria-labelledby="ig-posts">
        <h2 id="ig-posts" className="ig-h2">게시물별 성과</h2>
        <div className="ig-table">
          <table>
            <thead>
              <tr><th>게시물</th><th>형식</th><th>조회수</th><th>팔로워 아닌 사람</th><th>좋아요</th><th>공유</th><th>저장</th><th>프로필 방문</th><th>팔로우</th></tr>
            </thead>
            <tbody>
              {p.posts.map((r) => (
                <tr key={r.name} className={r.top ? 'top' : undefined}>
                  <td>{r.name}{r.date && <span className="dim"> {r.date}</span>}</td>
                  <td>{r.type}</td>
                  <td>{r.views.toLocaleString('ko-KR')}</td>
                  <td>{r.nonFollower}</td>
                  <td>{r.likes}</td>
                  <td>{r.shares}</td>
                  <td>{r.saves}</td>
                  <td>{r.profileVisits ?? '—'}</td>
                  <td>{r.follows}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Notice>릴스는 웹 인사이트에서 프로필 방문 수를 따로 보여주지 않아 '—'로 표시했어요.</Notice>
      </section>

      <section className="ig-sec" aria-labelledby="ig-tools">
        <h2 id="ig-tools" className="ig-h2">바로 쓰는 도구</h2>
        <div className="ig-grid">
          <Copy title="소개글 예시" text={p.tools.bio} />
          <Copy title="캡션 틀" text={p.tools.caption} />
          <Copy title="게임 끝나고 남길 메모" text={p.tools.memo} />
          <div className="panel ig-card">
            <h3 className="ig-h3">릴스 체크리스트</h3>
            <ul className="ig-list">{p.tools.reelChecklist.map((s) => <li key={s}>{s}</li>)}</ul>
          </div>
        </div>
      </section>
    </>
  );
}

function Legend() {
  return (
    <div className="ig-legend">
      {(Object.keys(KIND) as TaskKind[]).map((k) => (
        <span key={k} className={'ig-chip k-' + k}>{KIND[k]}</span>
      ))}
    </div>
  );
}

function Calendar({ plan, done }: { plan: InstaPlan; done: Record<string, boolean> }) {
  const first = plan.weeks[0].start;
  const last = plan.weeks[plan.weeks.length - 1].end;
  // 첫 주 월요일부터 마지막 날이 든 주 일요일까지 그립니다.
  const start = addDays(day(first), -((day(first).getUTCDay() + 6) % 7));
  const cells: string[] = [];
  for (let d = start; iso(d) <= last || cells.length % 7 !== 0; d = addDays(d, 1)) cells.push(iso(d));
  const today = todayIso();
  return (
    <div className="ig-cal-scroll">
      <div className="ig-cal" role="grid" aria-label="운영 캘린더">
        {DAYS.map((d) => <div key={d} className="ig-cal-dow g11" role="columnheader">{d}</div>)}
        {cells.map((c) => {
          const tasks = plan.tasks.filter((t) => t.date === c);
          const out = c < first || c > last;
          return (
            <div key={c} role="gridcell" className={'ig-cell' + (out ? ' out' : '') + (c === today ? ' today' : '') + (c === plan.sponsor.deadline ? ' deadline' : '')}>
              <span className="ig-date g11">
                {c.slice(8) === '01' || c === cells[0] ? short(c) : Number(c.slice(8))}
                {c === plan.sponsor.deadline && <span className="ig-dl"> 협찬 기한</span>}
              </span>
              {tasks.map((t) => (
                <span key={t.id} className={'ig-ev k-' + t.kind + (done[t.id] ? ' done' : '')} title={`${KIND[t.kind]} · ${t.title}`}>
                  {t.title}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskRow({ t, checked, onToggle }: { t: InstaTask; checked: boolean; onToggle: () => void }) {
  const id = 'ig-' + t.id;
  return (
    <li className={checked ? 'done' : undefined}>
      <input type="checkbox" id={id} checked={checked} onChange={onToggle} />
      <label htmlFor={id}>
        <span className="ig-when g11">{short(t.date)} {weekday(t.date)}</span>
        <span className="ig-what">
          <span className="ig-title"><span className={'ig-chip k-' + t.kind}>{KIND[t.kind]}</span>{t.title}</span>
          {t.detail && <span className="tile-sub">{t.detail}</span>}
        </span>
      </label>
    </li>
  );
}

function Copy({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 복사를 막은 브라우저에서는 글자를 직접 선택해 복사합니다 */
    }
  };
  return (
    <div className="panel ig-card">
      <div className="ig-sec-head">
        <h3 className="ig-h3">{title}</h3>
        <button type="button" className="btn mini" onClick={copy}>{copied ? '복사했어요' : '복사'}</button>
      </div>
      <pre className="ig-pre">{text}</pre>
    </div>
  );
}
