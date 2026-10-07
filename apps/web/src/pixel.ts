// 픽셀 그림 도구. 모든 그림은 색 사각형 목록을 CSS 배경 여러 겹으로 바꿔 그립니다.
// 단위는 em이라, 그리는 요소의 font-size가 곧 픽셀 한 칸의 크기입니다.

export type Rect = [x: number, y: number, w: number, h: number, color: string];
export interface Sprite {
  w: number;
  h: number;
  bg: string;
}

export function shade(c: string, f: number): string {
  const n = parseInt(c.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return '#' + [ch(n >> 16), ch((n >> 8) & 255), ch(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** 색상(도)·채도·밝기(%)를 조금씩 옮긴 색. */
export function tint(c: string, dh: number, ds = 0, dl = 0): string {
  const n = parseInt(c.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let l = (max + min) / 2;
  let s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (((h * 60 + dh) % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s + ds / 100));
  l = Math.max(0, Math.min(1, l + dl / 100));
  const k = (m: number) => (m + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (m: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(m) - 3, 9 - k(m), 1))));
  return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function paint(rects: Rect[]): string {
  const out: string[] = [];
  for (let i = rects.length - 1; i >= 0; i--) {
    const [x, y, w, h, c] = rects[i];
    out.push(`linear-gradient(${c},${c}) ${x}em ${y}em/${w}em ${h}em no-repeat`);
  }
  return out.join(',');
}

export function mapRows(rows: string[], pal: Record<string, string>, ox = 0, oy = 0, scale = 1): Rect[] {
  const out: Rect[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = pal[row[x]];
      if (!c) {
        x++;
        continue;
      }
      let e = x;
      while (e + 1 < row.length && row[e + 1] === row[x]) e++;
      out.push([ox + x * scale, oy + y * scale, (e - x + 1) * scale, scale, c]);
      x = e + 1;
    }
  });
  return out;
}

export function sprite(rows: string[], pal: Record<string, string>): Sprite {
  return { w: rows[0].length, h: rows.length, bg: paint(mapRows(rows, pal)) };
}

// 입체 주사위 (앞면·윗면·옆면). 20칸 격자를 반 칸 크기로 그려 10x10em을 차지합니다.
const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};

const SIDE_PIPS: Record<number, number[]> = { 1: [1], 2: [0, 2], 3: [0, 1, 2] };

export function die(front: number, top: number, side: number, body: string, pip: string): Sprite {
  const N = 20;
  const D = 4; // 깊이: 윗면 높이와 옆면 폭
  const F = 15; // 앞면 한 변 - 1
  const inSquare = (x: number, y: number, k: number) => x >= k && x <= F + k && y >= D - k && y <= D + F - k;
  const solid = (x: number, y: number) => [0, 1, 2, 3, 4].some((k) => inSquare(x, y, k));
  const grid: string[][] = Array.from({ length: N }, (_, y) =>
    Array.from({ length: N }, (_, x) => {
      if (!solid(x, y)) return '.';
      if (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1)) return 'o';
      if (inSquare(x, y, 0)) return x === F || y === D ? 'e' : 'f';
      return y < D && x - F < D - y ? 't' : 's';
    }),
  );
  const dot = (x: number, y: number, w: number, h: number, c: string) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (grid[y + j]?.[x + i] && grid[y + j][x + i] !== '.' && grid[y + j][x + i] !== 'o') grid[y + j][x + i] = c;
  };
  // 앞면: 3x3 자리 중 눈 위치마다 2x2 점 (1은 크게)
  for (const [i, j] of PIPS[front]) front === 1 ? dot(6, 10, 4, 4, 'p') : dot(2 + i * 5, D + 2 + j * 5, 2, 2, 'p');
  // 윗면: 비스듬히 누운 면이라 눈을 가로로 납작하게. 뒤쪽 줄일수록 오른쪽으로 밀립니다.
  for (const [i, j] of PIPS[top]) dot(D - (1 + j) + 2 + i * 5, 1 + j, 2, 1, 'q');
  // 옆면: 좁은 면이라 세로 한 줄로만 (1~3)
  for (const j of SIDE_PIPS[side]) dot(F + 2, D + 1 + j * 5, 1, 2, 'q');
  const rows = grid.map((r) => r.join(''));
  const pal = { o: shade(body, 0.32), f: body, e: shade(body, 0.86), t: shade(body, 1.12), s: shade(body, 0.72), p: pip, q: shade(pip, 0.85) };
  return { w: N / 2, h: N / 2, bg: paint(mapRows(rows, pal, 0, 0, 0.5)) };
}

/** 솥에서 굴러 떨어지는 상아색 주사위. 표지가 없는 게임의 기본 그림으로도 씁니다. */
export const IVORY_DIE = die(5, 2, 3, '#F4EAD2', '#2A1B2E');

export const CATEGORY_COLOR: Record<string, string> = { 가족: '#C9963A', 파티: '#B84A42', 추상: '#7A58B8', 협력: '#3F8F68', 전략: '#3D6FA8' };
export const categoryColor = (cat: string) => CATEGORY_COLOR[cat] ?? '#6B5A70';

const ICON_PAL: Record<string, string> = { w: '#FBF3DC', g: '#EBCB86', k: '#1B1220', r: '#D2505A', b: '#4E9FDB', c: '#A9D8F7', n: '#57C98A', p: '#9B6BE0', o: '#F0A23C', y: '#A8703F', s: '#B5B1BE' };

// 게임별 상징 그림(16x14 안쪽). 실제 박스 아트가 아니라 직접 그린 아이콘입니다.
const ICONS: Record<string, string[]> = {
  'Catan': ['.....oooooo.....', '....oooooooo....', '...oooooooooo...', '...oooooooooo...', '....oooooooo....', '.....oooooo.....', '.nnnnnn..ssssss.', 'nnnnnnnn.sssssss', 'nnnnnnnn.sssssss', 'nnnnnnnn.sssssss', '.nnnnnn..ssssss.'],
  'Splendor': ['....bbbbbbbb....', '...bwwcccccbb...', '..bwwccccccccb..', '.bcccccccccccbb.', 'bbbbbbbbbbbbbbbb', '.bccbbccccbbccb.', '..bccbbccbbccb..', '...bccbbbbccb...', '....bccbbccb....', '.....bccccb.....', '......bccb......', '.......bb.......'],
  'Carcassonne': ['..ss.ss.ss......', '..ssssssss......', '..ssssssss..r...', '..sskkssss.rrr..', '..sskkssssrrrrr.', '..ssssssss.sss..', 'nnssssssssnsksnn', 'nnsskkkkssnsssnn', 'nnsskkkkssnnnnnn', 'nnnnnnnnnnnnnnnn'],
  'Ticket to Ride': ['..........ss....', '.........ssss...', '...kk.....ss....', '...kk..rrrrrrr..', '..kkkk.rwwrwwr..', '.rrrrrrrwwrwwr..', '.rrrrrrrrrrrrrr.', '.rrrrrrrrrrrrrr.', '..kk..kk...kk...', '.kkkk.kkkk.kkkk.', '..kk..kk...kk...', 'yyyyyyyyyyyyyyyy'],
  'Codenames': ['www.www.www.www.', 'www.rrr.www.www.', '................', 'www.www.bbb.www.', 'www.www.bbb.www.', '................', 'rrr.www.www.kkk.', 'rrr.www.www.kkk.', '................', 'www.bbb.www.www.', 'www.bbb.www.www.'],
  'Dixit': ['..........w.....', '...ggg...www....', '..ggg.....w.....', '.ggg............', '.ggg.........w..', '.ggg............', '.gggg.....g.....', '..ggggg.ggg.....', '...ggggggg......', '.....ggg....w...'],
  'Just One': ['..wwwwwwwwwwww..', '..w..........w..', '..w....oo....w..', '..w...ooo....w..', '..w..oooo....w..', '..w....oo....w..', '..w....oo....w..', '..w....oo....w..', '..w..oooooo..w..', '..w..........w..', '..wwwwwwwwwwww..'],
  'Azul': ['bbb.www.ooo.bbb.', 'bwb.wbw.owo.bwb.', 'bbb.www.ooo.bbb.', '................', 'www.ooo.bbb.www.', 'wbw.owo.bwb.wbw.', 'www.ooo.bbb.www.', '................', 'ooo.bbb.www.ooo.', 'owo.bwb.wbw.owo.', 'ooo.bbb.www.ooo.'],
  'Patchwork': ['.rrrrnnnnnnpppp.', '.rrrrnnnnnnpppp.', '.rrrrggggggpppp.', '.bbbbggggggpppp.', '.bbbbggwwggrrrr.', '.bbbboooooorrrr.', '.nnnnoooooorrrr.', '.nnnnoooooobbbb.', '.nnnnppppppbbbb.', '.nnnnppppppbbbb.'],
  'Pandemic': ['.....bbbbbb.....', '...bbnnbbbbbb...', '..bnnnnbbbnnbb..', '.bbnnnbbbbnnnbb.', '.bbbnbbrrbbnnbb.', '.bbbbbbrrbbbbbb.', '.bbbbrrrrrrbbbb.', '.bbbbrrrrrrbbbb.', '.bbnbbbrrbbbbbb.', '.bnnnbbrrbbnbbb.', '..bnnbbbbbnnbb..', '...bbbbbbbbbb...', '.....bbbbbb.....'],
  'Gloomhaven': ['..............ww', '.............www', '............www.', '...........www..', '..........www...', '.........www....', '........www.....', '..g....www......', '..gg..www.......', '...ggwww........', '....ggg.........', '...yyggg........', '..yyy..gg.......', '.yyy............'],
  'Spirit Island': ['.......oo.......', '......oooo......', '......owwo......', '.......oo.......', '....nnnnnnn.....', '..nnnnnnnnnnn...', '.nnnnynnnnnnnn..', 'nnnnnnnnnnynnnn.', 'bbnnnnnnnnnnnbbb', 'bbbbbbnnnbbbbbbb', 'bbwwbbbbbbbwwbbb', 'bbbbbbbbbbbbbbbb'],
  'Wingspan': ['..........bbb...', '.........bbbbb..', '........bbbkbgg.', '........bbbbb...', '...bbbbbbbbb....', '..bbbbwwwbbb....', '.bbbbwwwwwbb....', 'bbb.bwwwwbb.....', 'bb...bbbbb......', '.......y.y......', '.......y.y......', '......yy.yy.....'],
  'Terraforming Mars': ['.....rrrrrr.....', '...rrrrrrrrrr...', '..rrrorrrrrrrr..', '.rrroorrrrrorrr.', '.rrrrrrrrrrrrrr.', 'rrrrrrnnrrrrrrrr', 'rrrrrnnnnrrrorrr', 'rrrrrrnnrrrrrrrr', '.rrrrrrrrrrrrrr.', '.rrorrrrrrnrrrr.', '..rrrrrrrrrrrr..', '...rrrrrrrrrr...', '.....rrrrrr.....'],
  'Brass: Birmingham': ['...ss......ss...', '..ssss....ssss..', '...ss......ss...', '...kk......kk...', '...kk......kk...', '...kk..y...kk...', '...kk.yyy..kk...', '..yyyyyyyyyyyy..', '..ywwyywwyywwy..', '..ywwyywwyywwy..', '..yyyyyyyyyyyy..', '..yyyykkkkyyyy..', '..yyyykkkkyyyy..'],
  'Agricola': ['......rr........', '.....rrrr.....g.', '....rrrrrr...ggg', '...rrrrrrrr...g.', '..rrrrrrrrrr.ggg', '...wwwwwwww...g.', '...wwkkwwww..ggg', '...wwkkwwbw...g.', '...wwkkwwww...n.', 'nnnnnnnnnnnnnnnn', 'nyynnnyynnnyynnn']
};

// 그림이 없는 게임에 쓰는 기본 그림(주사위)
const DEFAULT_ICON = ['..wwwwwwwwwwww..', '.wwwwwwwwwwwwww.', '.wwkkwwwwwwkkww.', '.wwkkwwwwwwkkww.', '.wwwwwwwwwwwwww.', '.wwwwwwkkwwwwww.', '.wwwwwwkkwwwwww.', '.wwwwwwwwwwwwww.', '.wwkkwwwwwwkkww.', '.wwkkwwwwwwkkww.', '.wwwwwwwwwwwwww.', '..ssssssssssss..'];

export const hasIcon = (key: string | null | undefined) => !!key && key in ICONS;

const boxCache = new Map<string, string>();

/** 80x98 칸짜리 게임 박스. 제목 칸(7,65 58x20)은 비워 두고 글자는 HTML로 얹습니다. */
export function boxArt(iconKey: string | null | undefined, color: string, withIcon = true): string {
  const key = `${iconKey}|${color}|${withIcon}`;
  const hit = boxCache.get(key);
  if (hit) return hit;
  const c = color;
  const L: Rect[] = [
    [0, 0, 80, 98, c], [0, 0, 80, 3, shade(c, 1.4)], [0, 0, 3, 98, shade(c, 1.4)], [71, 0, 9, 98, shade(c, 0.55)], [71, 0, 1, 98, shade(c, 0.4)],
    [7, 7, 58, 54, shade(c, 0.36)], [7, 7, 58, 2, shade(c, 0.22)], [7, 60, 58, 1, shade(c, 0.6)], [9, 9, 54, 1, shade(c, 0.5)],
    [7, 65, 58, 20, '#FBF3DC'], [7, 65, 58, 1, '#FFFFFF'], [7, 85, 58, 2, shade(c, 0.5)], [7, 91, 26, 2, '#EBCB86'], [37, 91, 6, 2, '#EBCB86'],
  ];
  if (withIcon) {
    const rows = (iconKey && ICONS[iconKey]) || DEFAULT_ICON;
    L.push(...mapRows(rows, ICON_PAL, 12, 8 + Math.floor((52 - rows.length * 3) / 2), 3));
  }
  const bg = paint(L);
  boxCache.set(key, bg);
  return bg;
}

export const titleSize = (name: string) => (name.length <= 4 ? 12 : name.length <= 6 ? 9 : 7);
