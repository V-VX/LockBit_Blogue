import { renderOgSvg } from '../../utils/og-image';

export const prerender = true;

export const GET = async (): Promise<Response> => {
  const svg = await renderOgSvg('LockBit 5.0 Blogue');

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
