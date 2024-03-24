import type { PageServerLoad } from './$types';
// /** @type {import('./$types').PageLoad} */

// import type { PageLoad } from "../../$types";
export const prerender = true;

// /** @type {import('./$types').PageServerData} */
// export function load({ params }) {
// 	return {
// 		post: {
// 			title: `Title for ${params.slug} goes here`,
// 			content: `Content for ${params.slug} goes here`
// 		}
// 	};
// }

// export const load  = async ({ data }) => {
//     // const { slug } = params;

//     // get post with metadata
//     const post = data.posts.find((post) => slug === post.slug);
//     // load the markdown file based on slug
//     for (const post of data.posts) {
//         const component = await import(`../../lib/posts/${post}.md`);
//         return {
//             post: post,
//             component: component.default,
//             layout: {
//                 fullWidth: true,
//             },
//         };
//     }
    // const component = await import(`../../lib/posts/${data.posts[0].slug}.md`);

    // return {
    //     post: data.posts,
    //     component: component.default,
    //     layout: {
    //     fullWidth: true,
    //     },
    // };
// };
