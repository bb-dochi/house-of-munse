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
