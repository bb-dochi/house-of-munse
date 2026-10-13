// 방문자 시계로 고르는 배경 시간대. 그림은 tools/scene_depth.py --time=all 로 만듭니다.
// 주소에 ?time=noon 처럼 붙이면 그 시간대로 볼 수 있습니다 (확인용).
import { useEffect, useState } from 'react';

export type TimeOfDay = 'morning' | 'noon' | 'sunset' | 'night';
const TIMES: TimeOfDay[] = ['morning', 'noon', 'sunset', 'night'];

export function timeOfDay(date = new Date()): TimeOfDay {
  const forced = new URLSearchParams(window.location.search).get('time');
  if (forced && (TIMES as string[]).includes(forced)) return forced as TimeOfDay;
  const h = date.getHours();
  if (h >= 6 && h < 11) return 'morning';
  if (h >= 11 && h < 16) return 'noon';
  if (h >= 16 && h < 19) return 'sunset';
  return 'night';
}

export const sceneUrl = (t: TimeOfDay) => (t === 'night' ? '/assets/atelier-back.png' : `/assets/atelier-back-${t}.png`);

/** 앞 레이어(솥·소품)는 밤 조명으로 그려져 있어, 밝은 시간대에는 조금 밝혀 배경과 맞춥니다. */
export const FRONT_FILTER: Record<TimeOfDay, string | undefined> = {
  morning: 'brightness(1.15)',
  noon: 'brightness(1.25)',
  sunset: 'brightness(1.05)',
  night: undefined,
};

/** 페이지를 오래 열어 두어도 시간대가 바뀌면 따라 바뀌도록 5분마다 다시 봅니다. */
export function useTimeOfDay(): TimeOfDay {
  const [t, setT] = useState(() => timeOfDay());
  useEffect(() => {
    const id = window.setInterval(() => setT(timeOfDay()), 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);
  return t;
}
