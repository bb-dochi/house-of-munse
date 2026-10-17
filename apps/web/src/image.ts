/**
 * 올릴 이미지를 긴 변 maxSide px JPEG로 줄입니다. 표지와 후기 사진은 D1에 그대로 두기 때문에 작게 만듭니다.
 * 긴 변 1280px까지는 JPEG 품질 0.85로도 서버 한도(1MB)보다 넉넉히 작습니다.
 */
export async function shrink(file: File, maxSide: number): Promise<Blob> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new Error('이 이미지 파일은 읽을 수 없습니다. JPEG나 PNG로 바꿔서 올려 주세요.');
  }
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * scale), height: Math.round(bmp.height * scale) });
  const ctx = canvas.getContext('2d')!;
  // 투명한 PNG가 JPEG에서 검게 나오지 않도록 흰 바탕을 깝니다.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지를 줄이지 못했습니다.'))), 'image/jpeg', 0.85));
}
