import { renderOgPng } from '../utils/og-image';

export const prerender = true;

export const GET = async (): Promise<Response> => {
  const png = await renderOgPng('LockBit 5.0 Blogue');

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
