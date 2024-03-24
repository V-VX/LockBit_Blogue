// src/lib/server/posts.ts

import { parse } from 'path';
export const prerender = true;

import { LockBit } from '$lib/utils/lockbit';

type GlobEntry = {
    metadata: Post;
    default: unknown;
};

export interface Post {
    title: string;
    encrypt_title?: boolean;
    key: string;
    iv: string;
    uploaded_at: string;
    updated_at: string;
}

// Get all posts and add metadata
export const posts = Object.entries(
import.meta.glob<GlobEntry>('/src/lib/posts/**/*.md', { eager: true })
)
.map(([filepath, globEntry]) => {
    return {
    ...globEntry.metadata,

    // generate the slug from the file path
    slug: parse(filepath).name,
    };
})
// sort by date
.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
// add references to the next/previous post
.map((post, index, allPosts) => {
    let lb = new LockBit(post.key, post.iv);
    let encrypted
    // post.slug = lb.encrypt(post.slug);
    post.title = lb.encrypt(post.title);
    return {
    ...post,
    next: allPosts[index - 1] || 0,
    previous: allPosts[index + 1] || 0,
}});
