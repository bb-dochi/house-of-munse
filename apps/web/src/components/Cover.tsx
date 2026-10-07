import { IVORY_DIE } from '../pixel';

/** 게임 표지. BGG 이미지가 없으면 주사위 하나를 대신 놓습니다. 크기와 자리는 쓰는 곳의 CSS가 정합니다. */
export function Cover({ imageUrl, className }: { imageUrl?: string | null; className?: string }) {
  const cls = 'cover ' + (className ?? '');
  if (imageUrl) return <img className={cls} src={imageUrl} alt="" loading="lazy" />;
  return (
    <span className={cls + ' blank'} aria-hidden="true">
      <span style={{ background: IVORY_DIE.bg }} />
    </span>
  );
}
