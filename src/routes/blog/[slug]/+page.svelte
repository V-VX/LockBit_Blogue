<script lang=ts>
	// /** @type {import('./$types').PageData} */
	import type { PageServerData } from './$types';
	// import type { PageData } from './$types';
	import { page } from '$app/stores';
	import * as crypto from 'crypto';
	import Post from '../../Post.svelte';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	export function matrix_render(text: string): string {
		let chars = [...text];
		setInterval(() => {
			chars.map((_, i) => {
				for (let i = 0; i < 4; i++) {
					const n = Math.floor(Math.random() * (126 - 33 + 1)) + 33;
					const char = String.fromCharCode(n);
					// chars[i] = char;

					chars[i] = char;
					return chars.join('');
				}
			});
			console.log(chars.join(''));
			return chars.join(''); 
		}, 1000);
		return text;
	}

    export function decrypt(encryptedText: string, key: string, iv: string, algorithm = "aes-256-cbc"): string {
		// return window.crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, encryptedText);
        const _iv = crypto.createHash('sha256').update(iv).digest().subarray(0, 16);
        const _key = crypto.createHash('sha256').update(key).digest();
        const decipher = crypto.createDecipheriv(algorithm, _key, _iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf-8');
        decrypted += decipher.final('utf-8');
        return decrypted;
    }

	export function decrypt_html(body: string, key: string, iv: string, algorithm = "aes-256-cbc"): string {
        const regex = /(<\/?[^>]+>)|([^<>]+)/g;
        return body.replace(regex, (match, tag, child) => {
            if (tag) {
                return tag;
            } else if (child) {
                return decrypt(child, key, iv, algorithm);
            }
            return match;
		});
	}

	export let data: PageServerData;
	const url = $page.url;
	export const v = $page.url.searchParams.get('v');
	export const iv = $page.url.searchParams.get('iv');
	let decrypted: string;
	// let original = data.title
	// let chars = [...data.title];

	// if (v && iv) {
	// 	decrypted = decrypt(data.title, v, iv);
	// 	original = decrypted;
	// 	chars = [...decrypted];
	// 	console.log(decrypted);
	// 	data.title = decrypted;
	// 	data.content = decrypt_html(data.content, v, iv);
	// }
	let original = v && iv ? decrypt(data.title, v, iv) : data.title;
	let chars = v && iv ? [...decrypt(data.title, v, iv)] : [...data.title];
	let isTransformed = new Array(chars.length).fill(false);
	console.log(original);


	let m = onMount(() => {
		console.log('mounted');
		chars.forEach((_, index) => {
			let randomTime = Math.floor(Math.random() * (5000 - 3000 + 1)) + 1000;

			let timer = setInterval(() => {
				if (!isTransformed[index]) {
					const n = Math.floor(Math.random() * (126 - 33 + 1)) + 33;
					const rnd = String.fromCharCode(n);
					chars[index] = rnd;
					data.title = chars.join('');
				}
			}, 100);

			setTimeout(() => {
				clearInterval(timer);
				isTransformed[index] = true;
				chars[index] = original[index];
				data.title = chars.join('');

				if (isTransformed.every(val => val)) {
					chars[index] = original[index];
				}
			}, randomTime);
		});
	});
</script>

<Post title={data.title} uploaded_at={data.uploaded_at} updated_at={data.updated_at} content={data.content}/>
<!-- <Post title={data.title} uploaded_at={data.uploaded_at} updated_at={data.updated_at}/> -->

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