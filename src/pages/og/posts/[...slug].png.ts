import { getCollection } from 'astro:content';
import { renderOgPng } from '../../../utils/og-image';

export const prerender = true;

export async function getStaticPaths() {
  const posts = await getCollection('posts', ({ data }) => (
    import.meta.env.PROD ? data.draft !== true : true
  ));

  return posts.map((entry) => ({
    params: { slug: entry.slug },
    props: { title: entry.data.title },
  }));
}

export const GET = async ({
  props,
}: {
  props: { title: string };
}): Promise<Response> => {
  const png = await renderOgPng(props.title);

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
