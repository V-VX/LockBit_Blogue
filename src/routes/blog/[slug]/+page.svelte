<script lang=ts>
	// /** @type {import('./$types').PageData} */
	import type { PageServerData } from './$types';
	import { page } from '$app/stores';
	import * as crypto from 'crypto';
	import Post from '$lib/Post.svelte';

    export function decrypt(encryptedText: string, key: string, iv: string, algorithm = "aes-256-cbc"): string {
        const _iv = crypto.createHash('sha256').update(iv).digest().subarray(0, 16);
        const _key = crypto.createHash('sha256').update(key).digest();
		console.log(_iv)
		console.log(_key)
        const decipher = crypto.createDecipheriv(algorithm, _key, _iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf-8');
        decrypted += decipher.final('utf-8');
        return decrypted;
    }

	export let data: PageServerData;
	const url = $page.url;
	export const v = url.searchParams.get('v');
	export const iv = url.searchParams.get('iv');
	if (v && iv) {
		data.title = decrypt(data.title, v, iv);
	}
</script>

<Post title={data.title} uploaded_at={data.uploaded_at} updated_at={data.updated_at} />

<!-- {#if data.posts}
	<h1>{data.title}</h1>
	<ul class="links">
		{#each data.posts as post}
		<li>
			<a href={`blog/${post.slug}`}>{post.title}</a>
		</li>
		{/each}
	</ul>
{/if} -->
<!-- <ul class="links">
	{#each data.posts as post}
	<li>
		<a href={`blog/${post.slug}`}>{post.title}</a>
	</li>
	{/each}
</ul> -->