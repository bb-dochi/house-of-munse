// 공방 배경음. 음원 파일 없이 Web Audio로 직접 연주하는 8비트 곡이고, 아침·점심·노을·밤마다 곡이 다릅니다 (악보는 bgmSongs.ts).
// 화면 컴포넌트 밖(모듈)에 두어서 페이지를 옮겨도 끊기지 않습니다.
// 브라우저는 사용자가 누르기 전에는 소리를 못 내게 하므로, 켜 둔 채 떠났다면 다음 방문의 첫 클릭 때 다시 켭니다.

import { Song, SONGS, CHORDS } from './bgmSongs';
import { timeOfDay, TimeOfDay } from './timeOfDay';

const BAR = 16; // 한 마디의 16분음표 수

type Voice = 'lead' | 'arp' | 'bass' | 'kick' | 'snare' | 'hat' | 'bird' | 'bubble';
interface Note { voice: Voice; midi: number; steps: number }

const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midi = (n: string) => 12 * (Number(n.slice(-1)) + 1) + SEMI[n[0]] + (n[1] === '#' ? 1 : n[1] === 'b' ? -1 : 0);

const ARP = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3];
const BASS: Record<Song['bass'], [step: number, interval: number, steps: number][]> = {
  long: [[0, 0, 8], [8, 7, 6], [14, 12, 2]],
  walk: [[0, 0, 4], [6, 0, 2], [8, 7, 4], [14, 12, 2]],
  bounce: [0, 2, 4, 6, 8, 10, 12, 14].map((s, i) => [s, i % 2 ? 12 : 0, 2]),
};
// 효과음 자리: [마디 안 16분음표 위치, 높이(MIDI), 횟수]. 여덟 마디마다 되풀이하되 매번 같은 데서 나지 않게 흩어 둡니다.
const AMBIENCE: Record<NonNullable<Song['ambience']>, { voice: Voice; bars: [number, number, number][][] }> = {
  // 짹짹: 높은 음, 2~3번
  birds: {
    voice: 'bird',
    bars: [[[3, 100, 2]], [], [[10, 103, 3]], [[1, 98, 2], [13, 101, 2]], [], [[7, 104, 2]], [[4, 99, 3]], [[12, 102, 2]]],
  },
  // 보글보글: 낮은 음, 거품 2~4개
  bubbles: {
    voice: 'bubble',
    bars: [[[5, 55, 3]], [], [[11, 58, 2]], [[2, 53, 4]], [[14, 57, 2]], [], [[6, 54, 3], [13, 59, 2]], []],
  },
};
const DRUMS: Record<Song['arrangement'][number]['drums'], [Voice, number[]][]> = {
  none: [],
  hats: [['hat', [2, 6, 10, 14]]],
  soft: [['hat', [2, 6, 10, 14]], ['kick', [0, 8]]],
  full: [['hat', [0, 2, 4, 6, 8, 10, 12, 14]], ['kick', [0, 10]], ['snare', [4, 12]]],
};

/** 악보를 16분음표 칸마다 울릴 음 목록으로 펼칩니다. */
function compose(song: Song): Note[][] {
  const steps: Note[][] = [];
  for (const part of song.arrangement) {
    const sec = song.sections[part.section];
    sec.chords.forEach((name, bar) => {
      const chord = CHORDS[name];
      const at = steps.length;
      for (let i = 0; i < BAR; i++) steps.push([]);
      const add = (i: number, n: Note) => steps[at + i].push(n);
      for (let i = 0; i < BAR; i += song.arpEvery) add(i, { voice: 'arp', midi: midi(chord.tones[ARP[i]]), steps: 1 });
      const root = midi(chord.root);
      for (const [i, interval, len] of BASS[song.bass]) add(i, { voice: 'bass', midi: root + interval, steps: len });
      for (const [voice, hits] of DRUMS[part.drums]) hits.forEach((i) => add(i, { voice, midi: 0, steps: 1 }));
      if (song.ambience) {
        const { voice, bars } = AMBIENCE[song.ambience];
        for (const [i, pitch, count] of bars[(at / BAR) % bars.length]) add(i, { voice, midi: pitch, steps: count });
      }
      if (part.lead) {
        let pos = 0;
        for (const tok of sec.lead[bar].split(' ')) {
          const [note, len] = tok.split(':');
          if (note !== '-') add(pos, { voice: 'lead', midi: midi(note), steps: Number(len) * 2 });
          pos += Number(len) * 2;
        }
      }
    });
  }
  return steps;
}

// ---------- 소리 ----------

const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** 듀티비가 정해진 사각파. 8비트 소리의 질감은 대부분 이 듀티비에서 나옵니다. */
function pulse(ctx: AudioContext, duty: number): PeriodicWave {
  const n = 32;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  return ctx.createPeriodicWave(real, imag);
}

class Engine {
  private ctx: AudioContext;
  private master: GainNode;
  private leadBus: GainNode;
  private noise: AudioBuffer;
  private delay: DelayNode;
  private arpWave: PeriodicWave;
  private leadWave!: PeriodicWave;
  private time!: TimeOfDay;
  private song!: Song;
  private notes!: Note[][];
  private stepSec = 0; // 16분음표 길이(초)
  private step = 0;
  private nextTime = 0;
  private timer: number | undefined;

  constructor(volume: number, private onSong: (time: TimeOfDay) => void) {
    const ctx = (this.ctx = new AudioContext());
    // 사각파의 날카로운 윗소리를 조금 깎아 배경음답게 둡니다.
    const tone = Object.assign(ctx.createBiquadFilter(), { type: 'lowpass' });
    tone.frequency.value = 5200;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(tone).connect(ctx.destination);
    this.setVolume(volume);

    // 멜로디에만 점8분 메아리를 걸어 공간감을 줍니다.
    this.leadBus = ctx.createGain();
    const delay = (this.delay = ctx.createDelay(1));
    const feedback = ctx.createGain();
    feedback.gain.value = 0.28;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    this.leadBus.connect(this.master);
    this.leadBus.connect(delay).connect(feedback).connect(delay);
    delay.connect(wet).connect(this.master);

    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.arpWave = pulse(ctx, 0.125);
    this.load(timeOfDay());
  }

  /** 그 시간대의 곡을 처음부터 준비합니다. */
  private load(time: TimeOfDay) {
    const song = SONGS[time];
    this.time = time;
    this.song = song;
    this.notes = compose(song);
    this.stepSec = 60 / song.bpm / 4;
    this.leadWave = pulse(this.ctx, song.leadDuty);
    // 메아리는 곡 빠르기에 맞춘 점8분음표 길이입니다.
    this.delay.delayTime.setValueAtTime(this.stepSec * 3, this.ctx.currentTime);
    this.step = 0;
    this.onSong(time);
  }

  async start(volume: number) {
    await this.ctx.resume();
    if (timeOfDay() !== this.time) this.load(timeOfDay());
    this.nextTime = Math.max(this.nextTime, this.ctx.currentTime + 0.05);
    this.fadeTo(volume, 0.4);
    window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.schedule(), 25);
    this.schedule();
  }

  stop() {
    window.clearInterval(this.timer);
    this.timer = undefined;
    this.fadeTo(0, 0.25);
    window.setTimeout(() => {
      if (this.timer === undefined) void this.ctx.suspend();
    }, 300);
  }

  setVolume(v: number) {
    if (this.timer !== undefined) this.fadeTo(v, 0.05);
  }

  private fadeTo(v: number, sec: number) {
    const g = this.master.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    // 귀는 음량을 로그로 느끼므로 슬라이더 값을 제곱해서 씁니다.
    g.linearRampToValueAtTime(v * v * 0.8, now + sec);
  }

  private schedule() {
    // 뒤로 간 탭은 타이머가 1초에 한 번만 돌아서, 그동안 비지 않게 미리 넉넉히 잡아 둡니다.
    const horizon = this.ctx.currentTime + (document.hidden ? 1.5 : 0.15);
    while (this.nextTime < horizon) {
      // 셔플: 박 사이 엇박(8분음표 뒤쪽)만 조금 늦게 칩니다.
      const t = this.nextTime + (this.step % 4 === 2 ? (this.song.swing ?? 0) * this.stepSec : 0);
      for (const n of this.notes[this.step]) this.play(n, t);
      this.nextTime += this.stepSec;
      this.step = (this.step + 1) % this.notes.length;
      // 재생 중에 시간대가 바뀌면 곡이 한 바퀴 끝난 자리에서 다음 곡으로 넘어갑니다.
      if (this.step === 0 && timeOfDay() !== this.time) this.load(timeOfDay());
    }
  }

  private play(n: Note, t: number) {
    const ctx = this.ctx;
    const dur = n.steps * this.stepSec;
    const env = ctx.createGain();
    const g = env.gain;
    const shape = (peak: number, attack: number, hold: number, release: number) => {
      g.setValueAtTime(0, t);
      g.linearRampToValueAtTime(peak, t + attack);
      g.setTargetAtTime(peak * 0.6, t + attack, hold);
      g.setTargetAtTime(0, t + Math.max(attack, dur - release), release / 3);
    };

    if (n.voice === 'lead' || n.voice === 'arp' || n.voice === 'bass') {
      const osc = ctx.createOscillator();
      if (n.voice === 'bass') osc.type = 'triangle';
      else osc.setPeriodicWave(n.voice === 'lead' ? this.leadWave : this.arpWave);
      osc.frequency.value = hz(n.midi);
      if (n.voice === 'lead') {
        if (this.song.leadStyle === 'pluck') {
          // 오르골: 톡 치고 길이와 상관없이 천천히 사라집니다.
          g.setValueAtTime(0, t);
          g.linearRampToValueAtTime(0.15, t + 0.005);
          g.exponentialRampToValueAtTime(0.001, t + Math.min(dur + 0.3, 1.2));
        } else shape(0.13, 0.01, 0.2, 0.06);
        // 긴 음에만 살짝 떨림을 넣습니다.
        if (dur > 0.4) {
          const lfo = ctx.createOscillator();
          const depth = ctx.createGain();
          lfo.frequency.value = 5.5;
          depth.gain.setValueAtTime(0, t);
          depth.gain.linearRampToValueAtTime(12, t + 0.35);
          lfo.connect(depth).connect(osc.detune);
          lfo.start(t);
          lfo.stop(t + dur + 0.2);
        }
        osc.connect(env).connect(this.leadBus);
      } else if (n.voice === 'arp') {
        g.setValueAtTime(0.045, t);
        g.exponentialRampToValueAtTime(0.001, t + 0.14);
        osc.connect(env).connect(this.master);
      } else {
        shape(0.26, 0.01, 0.3, 0.05);
        osc.connect(env).connect(this.master);
      }
      osc.start(t);
      osc.stop(t + dur + 0.2);
      return;
    }

    if (n.voice === 'bird') {
      // 짧게 휙 올라갔다 떨어지는 사인파를 n.steps번 연달아. 사람 귀에 "짹"으로 들립니다.
      const osc = ctx.createOscillator();
      const f = hz(n.midi);
      const chirp = 0.055;
      g.setValueAtTime(0, t);
      for (let k = 0; k < n.steps; k++) {
        const s = t + k * (chirp + 0.035);
        osc.frequency.setValueAtTime(f, s);
        osc.frequency.exponentialRampToValueAtTime(f * 1.45, s + chirp * 0.6);
        osc.frequency.exponentialRampToValueAtTime(f * 1.15, s + chirp);
        g.setValueAtTime(0, s);
        g.linearRampToValueAtTime(0.04, s + 0.008);
        g.linearRampToValueAtTime(0, s + chirp);
      }
      osc.connect(env).connect(this.leadBus);
      osc.start(t);
      osc.stop(t + n.steps * (chirp + 0.035) + 0.05);
      return;
    }

    if (n.voice === 'bubble') {
      // 낮은 사인파가 짧게 쑥 올라가는 "뽁"을 n.steps번, 간격을 들쭉날쭉하게.
      const osc = ctx.createOscillator();
      const f = hz(n.midi);
      g.setValueAtTime(0, t);
      let s = t;
      for (let k = 0; k < n.steps; k++) {
        const pop = 0.05 + 0.02 * (k % 2);
        osc.frequency.setValueAtTime(f * (1 + 0.15 * k), s);
        osc.frequency.exponentialRampToValueAtTime(f * (2.6 + 0.3 * k), s + pop);
        g.setValueAtTime(0, s);
        g.linearRampToValueAtTime(0.09, s + 0.006);
        g.linearRampToValueAtTime(0, s + pop);
        s += pop + 0.06 + 0.05 * ((k * 7) % 3);
      }
      osc.connect(env).connect(this.leadBus);
      osc.start(t);
      osc.stop(s + 0.05);
      return;
    }

    if (n.voice === 'kick') {
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.setValueAtTime(0.32, t);
      g.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(env).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.2);
      return;
    }

    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    if (n.voice === 'snare') {
      filter.type = 'bandpass';
      filter.frequency.value = 1800;
      g.setValueAtTime(0.11, t);
      g.exponentialRampToValueAtTime(0.001, t + 0.13);
    } else {
      filter.type = 'highpass';
      filter.frequency.value = 7000;
      g.setValueAtTime(0.035, t);
      g.exponentialRampToValueAtTime(0.001, t + 0.04);
    }
    src.connect(filter).connect(env).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.15);
  }
}

// ---------- 상태 (화면은 useSyncExternalStore로 구독) ----------

const KEY = 'munse.bgm';
export interface BgmState { on: boolean; volume: number; title: string }

function load(): Pick<BgmState, 'on' | 'volume'> {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return { on: s.on === true, volume: typeof s.volume === 'number' && s.volume >= 0 && s.volume <= 1 ? s.volume : 0.5 };
  } catch {
    return { on: false, volume: 0.5 };
  }
}

let state: BgmState = { ...load(), on: false, title: SONGS[timeOfDay()].title };
const wantedOn = load().on;
let engine: Engine | undefined;
const listeners = new Set<() => void>();

function set(next: Partial<BgmState>) {
  state = { ...state, ...next };
  try {
    localStorage.setItem(KEY, JSON.stringify({ on: state.on, volume: state.volume }));
  } catch {
    /* 저장이 막힌 브라우저에서는 이번 방문 동안만 기억합니다 */
  }
  listeners.forEach((l) => l());
}

export const bgm = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  play() {
    try {
      engine ??= new Engine(state.volume, (time) => set({ title: SONGS[time].title }));
    } catch {
      return; // Web Audio가 없는 브라우저
    }
    void engine.start(state.volume);
    set({ on: true });
  },
  pause() {
    engine?.stop();
    set({ on: false });
  },
  setVolume(volume: number) {
    engine?.setVolume(volume);
    set({ volume });
  },
};

// 지난번에 켜 두고 떠났다면, 이번 방문의 첫 클릭·키 입력 때 이어서 켭니다. 재생 버튼을 누른 경우는 버튼이 처리합니다.
if (wantedOn) {
  const resume = (e: Event) => {
    window.removeEventListener('pointerup', resume, true);
    window.removeEventListener('keydown', resume, true);
    if ((e.target as Element | null)?.closest?.('.bgm')) return;
    if (!state.on) bgm.play();
  };
  window.addEventListener('pointerup', resume, true);
  window.addEventListener('keydown', resume, true);
}
