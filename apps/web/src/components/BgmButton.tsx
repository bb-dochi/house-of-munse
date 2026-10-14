import { useSyncExternalStore } from 'react';
import { bgm } from '../bgm';

/** 화면 오른쪽 아래에 떠 있는 배경음 켜기/끄기 버튼. 페이지마다 다시 그려지지 않도록 App에서 한 번만 둡니다. */
export function BgmButton() {
  const { on } = useSyncExternalStore(bgm.subscribe, bgm.get);
  return (
    <div className={'bgm g11' + (on ? ' on' : '')}>
      <div className="bgm-row">
        <button type="button" className="bgm-btn" aria-pressed={on} aria-label="배경음" title={on ? '배경음 끄기' : '배경음 켜기'} onClick={() => (on ? bgm.pause() : bgm.play())}>
          <span className="bgm-icon" aria-hidden="true">{on ? '♫' : '♪'}</span>
          {on ? 'ON' : 'OFF'}
        </button>
      </div>
    </div>
  );
}
