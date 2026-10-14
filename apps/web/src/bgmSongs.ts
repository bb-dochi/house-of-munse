// 시간대별 배경음 악보. 배경 그림과 같은 시간대(timeOfDay.ts)를 씁니다.
// 멜로디는 "음:8분음표 수", 쉼표는 "-:길이". 한 마디는 8분음표 8개입니다.
import type { TimeOfDay } from './timeOfDay';

export type Drums = 'none' | 'hats' | 'soft' | 'full';

export interface Song {
  title: string;
  bpm: number;
  /** 멜로디 사각파의 듀티비. 0.5는 둥글고, 낮을수록 가늘고 또렷합니다. */
  leadDuty: number;
  /** 아르페지오 간격 (1 = 16분음표, 2 = 8분음표) */
  arpEvery: 1 | 2;
  bass: 'long' | 'walk' | 'bounce';
  /** 멜로디 소리: 길게 이어지는 소리(기본) 또는 오르골처럼 톡 치고 사라지는 소리 */
  leadStyle?: 'sustain' | 'pluck';
  /** 엇박 8분음표를 이만큼(16분음표 단위) 늦춰 셔플 리듬을 만듭니다. 0.6쯤이면 통통 튀는 스윙. */
  swing?: number;
  /** 곡 사이사이 섞는 효과음: 아침 새소리, 밤 솥의 거품 */
  ambience?: 'birds' | 'bubbles';
  sections: Record<string, { chords: string[]; lead: string[] }>;
  /** 첫 줄은 멜로디 없는 도입. 끝나면 처음으로 돌아갑니다. */
  arrangement: { section: string; lead: boolean; drums: Drums }[];
}

/** 코드: 아르페지오 네 음과 베이스 뿌리음 */
export const CHORDS: Record<string, { tones: string[]; root: string }> = {
  C: { tones: ['C3', 'E3', 'G3', 'C4'], root: 'C3' },
  Cmaj7: { tones: ['C3', 'E3', 'G3', 'B3'], root: 'C3' },
  D: { tones: ['D3', 'F#3', 'A3', 'D4'], root: 'D2' },
  Dm7: { tones: ['D3', 'F3', 'A3', 'C4'], root: 'D2' },
  E7: { tones: ['E3', 'G#3', 'B3', 'D4'], root: 'E2' },
  Em7: { tones: ['E3', 'G3', 'B3', 'D4'], root: 'E2' },
  F: { tones: ['F3', 'A3', 'C4', 'F4'], root: 'F2' },
  Fmaj7: { tones: ['F3', 'A3', 'C4', 'E4'], root: 'F2' },
  G: { tones: ['G3', 'B3', 'D4', 'G4'], root: 'G2' },
  G7: { tones: ['G3', 'B3', 'D4', 'F4'], root: 'G2' },
  Gmaj7: { tones: ['G3', 'B3', 'D4', 'F#4'], root: 'G2' },
  Am: { tones: ['A3', 'C4', 'E4', 'A4'], root: 'A2' },
  Am7: { tones: ['A3', 'C4', 'E4', 'G4'], root: 'A2' },
  Bm7: { tones: ['B2', 'D3', 'F#3', 'A3'], root: 'B2' },
  // 밤 곡(D단조)
  Dm: { tones: ['D3', 'F3', 'A3', 'D4'], root: 'D2' },
  Bb: { tones: ['Bb2', 'D3', 'F3', 'Bb3'], root: 'Bb2' },
  Bbmaj7: { tones: ['Bb2', 'D3', 'F3', 'A3'], root: 'Bb2' },
  Gm: { tones: ['G3', 'Bb3', 'D4', 'G4'], root: 'G2' },
  Gm7: { tones: ['G3', 'Bb3', 'D4', 'F4'], root: 'G2' },
  A7: { tones: ['A3', 'C#4', 'E4', 'G4'], root: 'A2' },
};

export const SONGS: Record<TimeOfDay, Song> = {
  // 막 문을 연 공방. 둥글고 산뜻한 소리에 창밖 새소리.
  morning: {
    title: '아침 찻잔',
    bpm: 104,
    leadDuty: 0.5,
    arpEvery: 2,
    bass: 'walk',
    ambience: 'birds',
    sections: {
      A: {
        chords: ['Gmaj7', 'Cmaj7', 'Em7', 'D', 'Gmaj7', 'Cmaj7', 'Am7', 'D'],
        lead: [
          'D5:3 B4:1 G4:2 B4:2', 'C5:2 E5:2 G5:4', 'E5:2 D5:2 B4:4', 'A4:2 D5:2 F#5:2 E5:2',
          'D5:3 B4:1 G4:2 D5:2', 'E5:2 G5:3 F#5:1 E5:2', 'C5:2 E5:2 A5:2 G5:2', 'F#5:6 -:2',
        ],
      },
      B: {
        chords: ['Cmaj7', 'D', 'Bm7', 'Em7', 'Am7', 'D', 'G', 'G'],
        lead: [
          'G5:3 E5:1 C5:2 E5:2', 'F#5:3 D5:1 A4:2 D5:2', 'D5:2 F#5:2 B5:2 A5:2', 'G5:4 E5:2 D5:2',
          'C5:2 E5:2 A5:3 G5:1', 'F#5:2 E5:2 D5:2 A4:2', 'B4:2 D5:2 G5:4', 'G4:4 -:4',
        ],
      },
    },
    arrangement: [
      { section: 'A', lead: false, drums: 'none' },
      { section: 'A', lead: true, drums: 'hats' },
      { section: 'B', lead: true, drums: 'soft' },
      { section: 'A', lead: true, drums: 'hats' },
    ],
  },
  // 한창 바쁜 작업대. 빠르고 통통 튀는 베이스.
  noon: {
    title: '한낮의 작업대',
    bpm: 116,
    leadDuty: 0.25,
    arpEvery: 1,
    bass: 'bounce',
    sections: {
      A: {
        chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm7', 'G7'],
        lead: [
          'E5:1 G5:1 E5:1 C5:1 D5:2 E5:2', 'C5:2 A4:2 E5:3 -:1', 'F5:1 E5:1 F5:1 A5:1 G5:2 F5:2', 'D5:2 B4:2 G4:2 -:2',
          'E5:1 G5:1 E5:1 C5:1 D5:2 E5:2', 'A5:2 G5:2 E5:2 C5:2', 'D5:1 F5:1 A5:1 F5:1 C6:2 A5:2', 'G5:2 F5:2 D5:2 B4:2',
        ],
      },
      B: {
        chords: ['F', 'G', 'Em7', 'Am', 'Dm7', 'G', 'C', 'C'],
        lead: [
          'A5:3 G5:1 F5:2 C5:2', 'B4:2 D5:2 G5:4', 'G5:1 E5:1 G5:1 B5:1 A5:2 G5:2', 'E5:2 C5:2 A4:4',
          'F5:2 A5:2 D6:2 C6:2', 'B5:2 A5:2 G5:2 D5:2', 'E5:2 G5:2 C6:4', 'G5:2 E5:2 C5:4',
        ],
      },
    },
    arrangement: [
      { section: 'A', lead: false, drums: 'full' },
      { section: 'A', lead: true, drums: 'full' },
      { section: 'B', lead: true, drums: 'full' },
      { section: 'A', lead: true, drums: 'full' },
    ],
  },
  // 해 질 녘 골목. 셔플 리듬으로 느긋하게 흔들리고, 끝에 E7로 단조 쪽으로 기웁니다.
  sunset: {
    title: '노을 골목',
    bpm: 86,
    leadDuty: 0.375,
    arpEvery: 2,
    bass: 'walk',
    swing: 0.6,
    sections: {
      A: {
        chords: ['Fmaj7', 'G', 'Em7', 'Am7', 'Dm7', 'G', 'Cmaj7', 'E7'],
        lead: [
          'C5:2 E5:2 A5:4', 'G5:3 F5:1 D5:4', 'E5:2 G5:2 B5:2 G5:2', 'A5:6 -:2',
          'F5:2 A5:2 C6:2 A5:2', 'B5:3 A5:1 G5:4', 'E5:2 G5:2 B5:2 C6:2', 'B5:2 G#5:2 E5:4',
        ],
      },
      B: {
        chords: ['Fmaj7', 'G', 'Am7', 'Am7', 'Dm7', 'Em7', 'Fmaj7', 'E7'],
        lead: [
          'A5:3 G5:1 F5:2 E5:2', 'D5:3 E5:1 G5:4', 'C6:3 B5:1 A5:2 E5:2', 'G5:4 E5:4',
          'D5:2 F5:2 A5:2 C6:2', 'B5:3 A5:1 G5:4', 'A5:2 F5:2 E5:2 C5:2', 'D5:2 B4:2 G#4:4',
        ],
      },
    },
    arrangement: [
      { section: 'A', lead: false, drums: 'hats' },
      { section: 'A', lead: true, drums: 'soft' },
      { section: 'B', lead: true, drums: 'full' },
      { section: 'A', lead: true, drums: 'soft' },
    ],
  },
  // 한밤의 공방. D단조, 오르골 같은 멜로디에 솥 거품 소리. 스네어 없이 조용하게.
  night: {
    title: '한밤의 솥',
    bpm: 84,
    leadDuty: 0.125,
    arpEvery: 2,
    bass: 'long',
    leadStyle: 'pluck',
    ambience: 'bubbles',
    sections: {
      A: {
        chords: ['Dm', 'Bb', 'Gm', 'A7', 'Dm', 'Bb', 'C', 'A7'],
        lead: [
          'A4:2 D5:2 F5:2 E5:2', 'D5:3 C5:1 Bb4:4', 'G4:2 Bb4:2 D5:3 C5:1', 'C#5:4 E5:2 A4:2',
          'A4:2 D5:2 F5:2 A5:2', 'G5:3 F5:1 D5:4', 'E5:2 G5:2 C5:2 E5:2', 'C#5:6 -:2',
        ],
      },
      B: {
        chords: ['Gm7', 'Dm', 'Bbmaj7', 'C', 'Gm7', 'A7', 'Dm', 'A7'],
        lead: [
          'Bb5:3 A5:1 G5:2 D5:2', 'F5:3 E5:1 D5:2 A4:2', 'A5:3 F5:1 D5:2 Bb4:2', 'C5:2 E5:2 G5:4',
          'F5:2 G5:2 Bb5:2 D6:2', 'C#6:4 A5:2 E5:2', 'F5:2 E5:2 D5:4', 'E5:2 C#5:2 A4:4',
        ],
      },
    },
    arrangement: [
      { section: 'A', lead: false, drums: 'none' },
      { section: 'A', lead: true, drums: 'hats' },
      { section: 'B', lead: true, drums: 'soft' },
      { section: 'A', lead: true, drums: 'hats' },
    ],
  },
};
