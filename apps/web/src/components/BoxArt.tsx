import { boxArt, categoryColor, hasIcon, titleSize } from '../pixel';

interface Props {
  name: string;
  category: string;
  iconKey?: string | null;
  imageUrl?: string | null;
  /** 픽셀 한 칸의 크기(px). 박스는 80x98칸입니다. */
  unit?: number | string;
  showTitle?: boolean;
  className?: string;
}

/** 직접 그린 아이콘이 없는 게임의 BGG 표지 주소. 표지가 있으면 상자 그림 대신 표지만 보여 줍니다. */
export const coverOf = (imageUrl?: string | null, iconKey?: string | null) => (imageUrl && !hasIcon(iconKey) ? imageUrl : null);

/** 게임 박스 한 개. 직접 그린 아이콘이 없고 BGG 이미지가 있으면 그 이미지를 표지 칸에 넣습니다. */
export function BoxArt({ name, category, iconKey, imageUrl, unit = 2, showTitle = true, className }: Props) {
  const useImage = !!imageUrl && !hasIcon(iconKey);
  return (
    <span className={'boxart ' + (className ?? '')} style={{ fontSize: typeof unit === 'number' ? `${unit}px` : unit, background: boxArt(iconKey, categoryColor(category), !useImage) }} aria-hidden="true">
      {useImage && <img className="boxart-img" src={imageUrl!} alt="" loading="lazy" />}
      {showTitle && (
        <span className="boxart-title">
          <span className="g11" style={{ fontSize: `${titleSize(name)}em` }}>
            {name}
          </span>
        </span>
      )}
    </span>
  );
}
