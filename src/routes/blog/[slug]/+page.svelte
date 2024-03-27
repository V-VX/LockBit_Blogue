<script lang=ts>
	// /** @type {import('./$types').PageData} */
	import type { PageServerData } from './$types';
	// import type { PageData } from './$types';
	import { page } from '$app/stores';
	import * as crypto from 'crypto';
	import Post from '../../Post.svelte';
	import { onMount } from 'svelte';

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
            // p1はHTMLタグ、p2はタグ外のテキスト
            if (tag) {
                // HTMLタグはそのまま返す
                return tag;
            } else if (child) {
                // テキストのみを暗号化する
                return decrypt(child, key, iv, algorithm);
            }
            return match;
		});
	}

	export let data: PageServerData;
	const url = $page.url;
	export const v = url.searchParams.get('v');
	export const iv = url.searchParams.get('iv');

	if (v && iv) {
		const decrypted = decrypt(data.title, v, iv);
		let chars = [...data.title];
		setInterval(() => {
			const n = Math.floor(Math.random() * (126 - 33 + 1)) + 33;
			let char = String.fromCharCode(n);
			data.title = char;
			// console.log(chars.join(''));
			// return chars.join(''); 
		}, 1000);
		data.content = decrypt_html(data.content, v, iv);
	}
	let original = data.title
	let chars = [...data.title];

	onMount(() => {
		let timer = setInterval(() => {
			let chars = [...data.title]; // data.titleを文字の配列に変換
			for (let i = 0; i < chars.length; i++) {
				const n = Math.floor(Math.random() * (126 - 33 + 1)) + 33;
				const rnd = String.fromCharCode(n);
				chars[i] = rnd; // 各文字をランダムな文字に更新
				data.title = chars.join(''); // 更新された文字配列を文字列に戻す
			}
			data.title = chars.join(''); // 更新された文字配列を文字列に戻す
		}, 100); // 100ミリ秒ごとに更新

		// return () => {
		// 	clearInterval(timer); // コンポーネントが破棄される時にタイマーをクリア
		// };
		setTimeout(() => {
			data.title = original; // 元のタイトルに戻す
			console.log(original);
			clearInterval(timer); // ランダム変換の処理を停止
			return
		}, 1000);
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