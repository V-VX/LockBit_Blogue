import { posts } from '$lib/server/posts';
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
/** @type {import('./$types').PageData} */

import { LockBit } from '$lib/utils/lockbit';

export const prerender = true;

// function encryptPost(post: any): any {
//     if (post.encrypt_title) {
//         post.title = encrypt(post.title);

//     }
//     post.slug = encrypt(post.slug);
//     return post;
// }
export const load: PageServerLoad = async ({ params }) => {
    const { slug } = params;
    // const ps = await import(`../../../lib/posts/${params.slug}.md`)


    // get post with metadata
    const post = posts.find((post) => slug === post.slug);
    // post?.content.render();.default
    // const content = await import(`../md-files/${post.slug}.md`)
    // const _post = {
    //     title: post.title,
    //     uploaded_at: post.uploaded_at,
    //     updated_at: post.updated_at,
    //     content: ps.default.render().html,
    //     meta: ps.metadata
    // }
    // console.log("content")
    // console.log(ps.default.render().html)
    // console.log("content post")
    // console.log(_post)


    if (!post) {
        throw error(404, 'Fuck You!');
    }
    // const title = post.title;
    console.log(post)
    // lb.appendYaml(post.slug, post);
    // lb.store();
    // console.log(lb._yml);
    // const encrypted = encrypt(title);
    // post.slug = encrypted;

    // return {
    //     // post,
    //     post
    // };
    // return _post
    return post
};



// export const load: PageServerLoad = async () => {
//     return {
//         posts, // make posts available on the client
//     };
// }