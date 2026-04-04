import { readFile } from 'node:fs/promises';

export const OGP_IMAGE_WIDTH = 934;
export const OGP_IMAGE_HEIGHT = 449;

const DEFAULT_SITE_NAME = 'LockBit 5.0 Blogue';
const BACKGROUND_IMAGE_URL = new URL('../../public/bg.png', import.meta.url);
const OGP_BACKGROUND_COLOR = '#f8f8f8';
const SITE_SANS_FONT_STACK = `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;

let backgroundDataUriPromise: Promise<string> | null = null;

const getBackgroundDataUri = (): Promise<string> => {
  if (!backgroundDataUriPromise) {
    backgroundDataUriPromise = readFile(BACKGROUND_IMAGE_URL).then((buffer) => (
      `data:image/png;base64,${buffer.toString('base64')}`
    ));
  }

  return backgroundDataUriPromise;
};

const escapeXml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const normalizeTitle = (title: string): string =>
  title.replace(/\s+/g, ' ').trim() || DEFAULT_SITE_NAME;

const hasLatinLetters = (value: string): boolean => /[a-z]/i.test(value);

const displayTitle = (title: string): string => {
  const normalized = normalizeTitle(title);
  return hasLatinLetters(normalized) ? normalized.toUpperCase() : normalized;
};

const charWeight = (char: string): number => {
  if (char === ' ') return 0.34;
  if (/[A-Z]/.test(char)) return 0.78;
  if (/[a-z0-9]/.test(char)) return 0.62;
  if (/[.,!?'"():;/&-]/.test(char)) return 0.4;
  return 1;
};

const measureUnits = (text: string): number =>
  [...text].reduce((total, char) => total + charWeight(char), 0);

const splitWords = (title: string): string[] => title.split(' ').filter(Boolean);

const splitTitle = (title: string): [string, string | null] => {
  const normalized = displayTitle(title);
  const words = splitWords(normalized);

  if (words.length >= 2) {
    let bestLeft = normalized;
    let bestRight = '';
    let bestScore = Number.POSITIVE_INFINITY;

    for (let i = 1; i < words.length; i += 1) {
      const left = words.slice(0, i).join(' ');
      const right = words.slice(i).join(' ');
      const score = Math.abs(measureUnits(left) - measureUnits(right));

      if (score < bestScore) {
        bestLeft = left;
        bestRight = right;
        bestScore = score;
      }
    }

    return [bestLeft, bestRight];
  }

  const chars = [...normalized];
  if (chars.length >= 8) {
    const midpoint = Math.ceil(chars.length / 2);
    return [chars.slice(0, midpoint).join(''), chars.slice(midpoint).join('')];
  }

  return [normalized, null];
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const formatNumber = (value: number): string =>
  Number(value.toFixed(2)).toString();

const createTextBlock = (
  content: string,
  y: number,
  fontSize: number,
  fill: string,
): string => `
    <text
      x="${OGP_IMAGE_WIDTH / 2}"
      y="${formatNumber(y)}"
      text-anchor="middle"
      dominant-baseline="middle"
      fill="${fill}"
      font-size="${formatNumber(fontSize)}"
      font-family="${SITE_SANS_FONT_STACK}"
      font-weight="700"
      letter-spacing="${formatNumber(Math.max(0.2, fontSize * 0.008))}"
    >${escapeXml(content)}</text>
  `;

export const getOgImagePath = (slug?: string): string =>
  slug ? `/og/posts/${slug}.svg` : '/og.svg';

export const renderOgSvg = async (title: string): Promise<string> => {
  const background = await getBackgroundDataUri();
  const [headline, highlight] = splitTitle(title);
  const headlineUnits = measureUnits(headline);
  const highlightUnits = highlight ? measureUnits(highlight) : 0;
  const singleLine = !highlight;

  const headlineFontSize = singleLine
    ? clamp(720 / Math.max(headlineUnits, 4), 64, 102)
    : clamp(705 / Math.max(headlineUnits, 4), 62, 92);
  const highlightFontSize = highlight
    ? clamp(610 / Math.max(highlightUnits, 3), 60, 88)
    : 0;

  const topY = singleLine ? 214 : 135;
  const ribbonHeight = highlight ? Math.max(84, highlightFontSize + 26) : 0;
  const ribbonWidth = highlight
    ? clamp(highlightUnits * highlightFontSize * 0.84 + 120, 360, 760)
    : 0;
  const ribbonX = (OGP_IMAGE_WIDTH - ribbonWidth) / 2;
  const ribbonY = highlight ? 205 : 0;
  const highlightY = highlight ? ribbonY + ribbonHeight / 2 + 2 : 0;
  const accentRuleY = singleLine ? 302 : 0;

  const textMarkup = singleLine
    ? `${createTextBlock(headline, topY, headlineFontSize, '#262223')}
    <rect x="231" y="${formatNumber(accentRuleY)}" width="472" height="8" rx="4" fill="#f71b3a" opacity="0.96" />`
    : `${createTextBlock(headline, topY, headlineFontSize, '#262223')}
    <rect
      x="${formatNumber(ribbonX)}"
      y="${formatNumber(ribbonY)}"
      width="${formatNumber(ribbonWidth)}"
      height="${formatNumber(ribbonHeight)}"
      rx="0"
      fill="#ff173b"
    />
    ${createTextBlock(highlight!, highlightY, highlightFontSize, '#ffffff')}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${OGP_IMAGE_WIDTH}" height="${OGP_IMAGE_HEIGHT}" viewBox="0 0 ${OGP_IMAGE_WIDTH} ${OGP_IMAGE_HEIGHT}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(`Preview for ${normalizeTitle(title)}`)}">
  <defs>
    <linearGradient id="pageBackground" x1="${OGP_IMAGE_WIDTH / 2}" y1="${OGP_IMAGE_HEIGHT}" x2="${OGP_IMAGE_WIDTH / 2}" y2="0" gradientUnits="userSpaceOnUse">
      <stop stop-color="${OGP_BACKGROUND_COLOR}" />
      <stop offset="1" stop-color="${OGP_BACKGROUND_COLOR}" />
    </linearGradient>
  </defs>
  <rect width="${OGP_IMAGE_WIDTH}" height="${OGP_IMAGE_HEIGHT}" fill="url(#pageBackground)" />
  <image href="${background}" x="0" y="0" width="${OGP_IMAGE_WIDTH}" height="${OGP_IMAGE_HEIGHT}" preserveAspectRatio="xMidYMid slice" />
  <rect x="47" y="31" width="${OGP_IMAGE_WIDTH - 94}" height="${OGP_IMAGE_HEIGHT - 62}" fill="transparent" stroke="rgba(247,27,58,0.12)" stroke-width="1" stroke-dasharray="2 12" />
  ${textMarkup}
</svg>`;
};
