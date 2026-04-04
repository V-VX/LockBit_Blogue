import { getCollection } from 'astro:content';
import { renderOgSvg } from '../../../utils/og-image';

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
  const svg = await renderOgSvg(props.title);

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
