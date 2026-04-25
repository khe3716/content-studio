import { useEffect, useState } from 'react';
import { continueRender, delayRender } from 'remotion';

const FONTS_CSS = `
@font-face {
  font-family: 'Pretendard';
  font-weight: 900;
  font-style: normal;
  font-display: block;
  src: url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/static/woff2/Pretendard-Black.woff2') format('woff2');
}
@font-face {
  font-family: 'Pretendard';
  font-weight: 800;
  font-style: normal;
  font-display: block;
  src: url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/static/woff2/Pretendard-ExtraBold.woff2') format('woff2');
}
@font-face {
  font-family: 'Pretendard';
  font-weight: 700;
  font-style: normal;
  font-display: block;
  src: url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/static/woff2/Pretendard-Bold.woff2') format('woff2');
}
@font-face {
  font-family: 'Pretendard';
  font-weight: 500;
  font-style: normal;
  font-display: block;
  src: url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/static/woff2/Pretendard-Medium.woff2') format('woff2');
}
`;

let injected = false;

export const FontLoader: React.FC = () => {
  const [handle] = useState(() => delayRender('Loading Pretendard'));
  useEffect(() => {
    if (!injected) {
      const style = document.createElement('style');
      style.textContent = FONTS_CSS;
      document.head.appendChild(style);
      injected = true;
    }
    document.fonts.ready
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, [handle]);
  return null;
};
